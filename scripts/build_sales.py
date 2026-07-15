#!/usr/bin/env python3
"""Build the Sales-page dataset (companies.json) for the Waldner App.

The authoritative list is the 91 validated Sterile Fill-Finish target accounts in
Neo4j (Company)-[:in_lead_list]->(:LeadList {customer_name:'Waldner PAS'}). Each
of those carries only name / hq_country / dach_site / website_domain / segment /
lead_status. This script *enriches* every account to the full `Company` shape the
sales UI expects (src/sales/lib/types.ts) by joining, in priority order:

  1. node42-pharma-map/public/companies.json  — already-built full records
     (employees, revenue, industry, description, lat/lon, contacts, logo …)
  2. data/waldner_pas_enriched.csv             — Crustdata+research enrichment CSV
  3. management CSVs + person_photos.csv       — real management contacts
  4. geocoding (pharma-map .geocode-cache.json + live Nominatim fallback)
  5. (optional --crust) Crustdata /company/search for still-missing firmographics

Output:  app/src/data/sales/companies.json   (Company[])
         app/src/data/sales/meta.json        (country + market option lists)

Nothing is invented: unmatched accounts keep null employees/revenue (the UI has
graceful fallbacks) but always get a map pin from their dach_site city.

Run:  python scripts/build_sales.py [--crust] [--no-geocode]
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase

REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = Path(__file__).resolve().parents[1] / "app"
OUT_DIR = APP_DIR / "src" / "data" / "sales"
PM = REPO_ROOT / "Platform UI Mockups" / "node42-pharma-map"
DATA = REPO_ROOT / "data"
ENV_PATH = REPO_ROOT / ".env"
# Local geocode cache (seeded from the pharma-map cache; extended by this run).
CACHE_PATH = Path(__file__).resolve().parent / ".geocode-cache.json"

LEGAL = (
    r"\b(gmbh|ag|co|kg|kgaa|se|ltd|limited|inc|llc|plc|sa|nv|bv|group|holding|"
    r"pharma|pharmaceuticals?|pharmazeutika|biopharmaceuticals?|biotech|arzneimittel|"
    r"chemie|produktion|produkte|s\.p\.a|spa|s\.r\.l|srl)\b"
)
# ISO-3166 alpha-3 -> display name, for the countries present in this list.
COUNTRY_NAMES = {
    "DEU": "Germany", "CHE": "Switzerland", "AUT": "Austria", "FRA": "France",
    "USA": "United States", "ITA": "Italy", "ZAF": "South Africa",
    "DNK": "Denmark", "GBR": "United Kingdom", "BEL": "Belgium", "NLD": "Netherlands",
    "ESP": "Spain", "SWE": "Sweden", "IRL": "Ireland", "POL": "Poland",
}


def norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(LEGAL, "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return re.sub(r"\s+", " ", s)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


SITE_COUNTRY = {"germany": "DEU", "deutschland": "DEU", "switzerland": "CHE",
                "schweiz": "CHE", "austria": "AUT", "österreich": "AUT",
                "france": "FRA", "italy": "ITA", "denmark": "DNK"}


def city_of(site: str):
    """Extract geocodable cities from a free-text dach_site string.

    Returns a list of candidate city names (handles "A / B" alternates), most
    specific first — the plant city, not the corporate HQ.
    """
    if not site:
        return []
    part = re.split(r"[—–,(]", site)[0]
    part = re.sub(r"\s+-\s+.*$", "", part).strip()  # drop " - description" tails
    if not part:
        return []
    return [p.strip() for p in part.split("/") if p.strip()]


def site_country_of(site: str, fallback_iso: str) -> str:
    """The country the DACH plant sits in — parsed from the site's trailing
    ", <Country>" token — so pins land at the plant, not the corporate HQ."""
    if site:
        for name, iso in SITE_COUNTRY.items():
            if re.search(rf"\b{name}\b", site.lower()):
                return iso
    return fallback_iso


# ---------------------------------------------------------------- geocoding
_geo_cache = {}


def load_geo_cache():
    global _geo_cache
    for p in (PM / "scripts" / ".geocode-cache.json", CACHE_PATH):
        if p.exists():
            try:
                _geo_cache.update(json.load(open(p)))
            except Exception:
                pass


def save_geo_cache():
    json.dump(_geo_cache, open(CACHE_PATH, "w"), ensure_ascii=False, indent=0)


def geocode(city: str, iso: str, allow_online: bool):
    if not city:
        return None, None
    key = f"{city.lower()}|{iso}"
    if key in _geo_cache and _geo_cache[key]:
        v = _geo_cache[key]
        return v.get("lat"), v.get("lon")
    if not allow_online:
        return None, None
    # Nominatim (OpenStreetMap). 1 req/s, descriptive UA required.
    try:
        cc = {"DEU": "de", "CHE": "ch", "AUT": "at", "FRA": "fr", "ITA": "it",
              "DNK": "dk", "GBR": "gb", "USA": "us", "ZAF": "za"}.get(iso, "")
        q = urllib.parse.urlencode(
            {"city": city, "countrycodes": cc, "format": "json", "limit": 1}
        )
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{q}",
            headers={"User-Agent": "node42-waldner-app/1.0 (admin@node42.io)"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            arr = json.load(r)
        time.sleep(1.1)
        if arr:
            lat, lon = float(arr[0]["lat"]), float(arr[0]["lon"])
            _geo_cache[key] = {"lat": lat, "lon": lon}
            return lat, lon
    except Exception as e:
        print(f"    geocode fail {city},{iso}: {e}", file=sys.stderr)
    _geo_cache[key] = None
    return None, None


# ---------------------------------------------------------------- loaders
def load_companies_json():
    p = PM / "public" / "companies.json"
    by_norm = {}
    if p.exists():
        for c in json.load(open(p)):
            by_norm.setdefault(norm(c["name"]), c)
    return by_norm


def load_enriched():
    p = DATA / "waldner_pas_enriched.csv"
    by_norm = {}
    if p.exists():
        for row in csv.DictReader(open(p)):
            by_norm.setdefault(norm(row["name"]), row)
    return by_norm


def load_management():
    """company(norm) -> [contact]; joins photos by linkedin url."""
    photos = {}
    pp = DATA / "waldner_pas_person_photos.csv"
    if pp.exists():
        for row in csv.DictReader(open(pp)):
            photos[row["person_linkedin_url"]] = row["profile_picture_url"] or None
    by_co = {}
    for fn in ("waldner_pas_tier1_management_clean.csv",
               "waldner_pas_tier1_management.csv"):
        p = DATA / fn
        if not p.exists():
            continue
        for row in csv.DictReader(open(p)):
            co = norm(row.get("company", ""))
            if not co:
                continue
            url = row.get("person_linkedin_url", "")
            by_co.setdefault(co, []).append({
                "name": row.get("person_name", ""),
                "title": row.get("title", ""),
                "seniority": row.get("seniority", ""),
                "yearsAtCompany": int(row["years_at_company"]) if (row.get("years_at_company") or "").strip().isdigit() else None,
                "linkedinUrl": url,
                "location": row.get("location", ""),
                "headline": row.get("headline", ""),
                "photoUrl": photos.get(url),
            })
    # de-dup contacts per company by linkedin url / name
    for co, lst in by_co.items():
        seen, out = set(), []
        for c in lst:
            k = c["linkedinUrl"] or c["name"]
            if k in seen:
                continue
            seen.add(k)
            out.append(c)
        by_co[co] = out[:12]
    return by_co


# Seniority ordering for ranking KeyPerson contacts (most senior first).
SENIORITY_RANK = {
    "CXO": 0, "Strategic": 1, "Vice President": 2, "Experienced Manager": 3,
    "Director": 4, "Senior": 5, "Entry Level Manager": 6, "Manager": 6,
    "Entry Level": 8,
}


def load_key_persons(session):
    """company(norm) -> [ManagementProfile] from KeyPerson nodes (works_at).

    KeyPerson is the real, graph-native contact set (all 91 accounts covered).
    Top contacts and more-senior people are listed first. Photos are joined from
    person_photos.csv by LinkedIn URL where available."""
    photos = {}
    pp = DATA / "waldner_pas_person_photos.csv"
    if pp.exists():
        for row in csv.DictReader(open(pp)):
            photos[(row["person_linkedin_url"] or "").rstrip("/")] = row["profile_picture_url"] or None
    by_co = {}
    for r in session.run(
        "MATCH (c:Company)-[:in_lead_list]->(:LeadList) "
        "MATCH (k:KeyPerson)-[:works_at]->(c) "
        "RETURN c.name AS company, k.full_name AS name, k.title AS title, "
        "k.seniority AS seniority, k.function_category AS func, "
        "k.years_of_experience AS yoe, k.linkedin_url AS linkedin, "
        "k.profile_url AS profile, k.residence_location AS residence, "
        "k.work_site AS work_site, k.headline AS headline, "
        "k.is_top_contact AS top, k.num_connections AS conns"
    ):
        co = norm(r["company"])
        url = (r["linkedin"] or r["profile"] or "").rstrip("/")
        by_co.setdefault(co, []).append({
            "name": r["name"] or "",
            "title": r["title"] or "",
            "seniority": r["seniority"] or "",
            "yearsAtCompany": None,  # KeyPerson has experience-band, not tenure
            "linkedinUrl": url,
            "location": r["residence"] or r["work_site"] or "",
            "headline": r["headline"] or "",
            "photoUrl": photos.get(url),
            # extra signal used only for ranking (dropped before output)
            "_top": bool(r["top"]),
            "_rank": SENIORITY_RANK.get(r["seniority"] or "", 7),
            "_conns": r["conns"] or 0,
        })
    for co, lst in by_co.items():
        # de-dup by linkedin/name, then rank: top contacts, seniority, connections.
        seen, out = set(), []
        for c in lst:
            key = c["linkedinUrl"] or c["name"]
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
        out.sort(key=lambda c: (0 if c["_top"] else 1, c["_rank"], -c["_conns"]))
        for c in out:
            del c["_top"], c["_rank"], c["_conns"]
        by_co[co] = out[:15]
    return by_co


def load_people_by_unit_role(session, rated_units):
    """company(norm) -> { unit_name: { stakeholder_role_title: [Person] } } from
    KeyPerson-[:fills_role]->StakeholderRole (SFF). Keyed by the SPECIFIC value-
    network unit AND role title, so each person sits under the exact stakeholder
    role they fill in that unit (not just the buying-centre function). Restricted
    to the rated units that actually render a buying centre. Person shape matches
    the app's Person type: {name, role, location, linkedin, email}, where `role`
    is the person's own job title."""
    by_co = {}
    for r in session.run(
        "MATCH (c:Company)-[:in_lead_list]->(:LeadList) "
        "MATCH (c)<-[:works_at]-(k:KeyPerson)-[:fills_role]->(sr:StakeholderRole {value_network:$net}) "
        "RETURN c.name AS company, sr.unit_name AS unit, sr.title AS role, "
        "k.full_name AS name, k.title AS title, k.residence_location AS residence, "
        "k.work_site AS work_site, k.linkedin_url AS linkedin, k.profile_url AS profile, "
        "k.work_email AS email, k.pattern_email AS pattern_email, "
        "k.is_top_contact AS top, k.seniority AS seniority, "
        "k.num_connections AS conns",
        net="325412/Sterile Fill-Finish",
    ):
        unit, role = r["unit"], r["role"]
        if not unit or not role or unit not in rated_units:
            continue
        # Prefer the verified (PDL) work_email; fall back to the pattern_email
        # (guessed from the company's verified email pattern). `emailPattern`
        # flags the latter so the UI can star it + explain the source.
        work = r["email"] or ""
        pattern = r["pattern_email"] or ""
        email = work or pattern
        person = {
            "name": r["name"] or "",
            "role": r["title"] or "",  # the person's own job title
            "location": r["residence"] or r["work_site"] or "",
            "linkedin": (r["linkedin"] or r["profile"] or ""),
            "email": email,
            "emailPattern": bool(email) and not work,
            "_top": bool(r["top"]),
            "_rank": SENIORITY_RANK.get(r["seniority"] or "", 7),
            "_conns": r["conns"] or 0,
        }
        by_co.setdefault(norm(r["company"]), {}).setdefault(unit, {}).setdefault(role, []).append(person)
    # dedupe a person within a (unit, role), rank, cap 6
    for co, units in by_co.items():
        for unit, roles in units.items():
            for role, people in roles.items():
                seen, out = set(), []
                for p in people:
                    key = p["linkedin"] or p["name"]
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append(p)
                out.sort(key=lambda p: (0 if p["_top"] else 1, p["_rank"], -p["_conns"]))
                for p in out:
                    del p["_top"], p["_rank"], p["_conns"]
                roles[role] = out[:6]
    return by_co


def num(v):
    try:
        return float(v) if v not in (None, "", "NA") else None
    except (ValueError, TypeError):
        return None


def to_int(v):
    f = num(v)
    return int(f) if f is not None else None


# ---------------------------------------------------------------- build
def build_company(lead, cj, enr, mgmt, key_persons, people_by_unit_role, allow_online):
    name = lead["name"]
    site = lead.get("dach_site")
    # Pin the account at its DACH plant: country from the site text, not the
    # corporate hq_country (which for global groups is IT/US/FR/…).
    iso = site_country_of(site, lead["hq_country"] or "")
    n = norm(name)
    rec = cj.get(n)
    e = enr.get(n)
    cities = city_of(site)
    city = (rec or {}).get("city") or (cities[0] if cities else "")
    lat = (rec or {}).get("lat")
    lon = (rec or {}).get("lon")
    if lat is None or lon is None:
        # Try each candidate city (handles "Hettlingen / Winterthur").
        for cand in ([city] if city else []) + cities:
            lat, lon = geocode(cand, iso, allow_online)
            if lat is not None:
                city = cand
                break
    # Contacts: prefer the graph-native KeyPersons (cover all 91 accounts), then
    # fall back to the pre-built companies.json contacts / management CSVs.
    contacts = key_persons.get(n) or (rec or {}).get("contacts") or mgmt.get(n) or []
    website = lead.get("website_domain") or (rec or {}).get("url") or (e or {}).get("website") or ""
    url = website if website.startswith("http") else (f"https://{website}" if website else "")
    status = (rec or {}).get("status") if rec else None
    if status not in ("PROSPECT", "LEAD", "ACTIVE"):
        status = "LEAD"  # validated_target
    buckets = (rec or {}).get("buckets") or ["sterile_fill_finish"]

    def pick(*vals, default=None):
        for v in vals:
            if v not in (None, "", []):
                return v
        return default

    return {
        "id": (rec or {}).get("id") or f"{slug(name)}-{iso.lower()}",
        "name": name,
        "country": iso,
        "city": city,
        "employees": pick((rec or {}).get("employees"), to_int((e or {}).get("employees")), to_int(lead.get("headcount"))),
        # A revenue upper bound of 0 is a wrong-entity/empty Crustdata match
        # (e.g. Sanofi, Janssen) from ANY source — never a real figure; `or None`
        # drops it so the UI falls back to the employees-derived band.
        "revLowerUsd": pick(((rec or {}).get("revLowerUsd") or None) if ((rec or {}).get("revHigherUsd") or None) else None, (to_int((e or {}).get("rev_lower_usd")) or None) if (to_int((e or {}).get("rev_higher_usd")) or None) else None, (to_int(lead.get("est_rev_lower")) or None) if (to_int(lead.get("est_rev_higher")) or None) else None),
        "revHigherUsd": pick((rec or {}).get("revHigherUsd") or None, to_int((e or {}).get("rev_higher_usd")) or None, to_int(lead.get("est_rev_higher")) or None),
        "buckets": buckets,
        # Real market segment from the graph (all validated accounts are Sterile
        # Fill-Finish). Drives the Customer List's segment filter — unlike the
        # coreNaics heuristic, which scatters them across NAICS buckets.
        "segment": lead.get("segment_focus") or "Sterile Fill-Finish",
        "source": "neo4j:leadlist(waldner_pas)" + ("+companies.json" if rec else ("+enriched.csv" if e else "")),
        "industry": pick((rec or {}).get("industry"), (e or {}).get("specialty", "").split(" / ")[0] if e else None, default="Sterile Fill-Finish CDMO"),
        "description": pick((rec or {}).get("description"), lead.get("description"), (e or {}).get("build_signal") if e else None, default=""),
        "buildSignal": pick((rec or {}).get("buildSignal"), (e or {}).get("build_signal") if e else None, default=""),
        "url": url,
        "oncologyTags": (rec or {}).get("oncologyTags") or [],
        "status": status,
        "lat": lat,
        "lon": lon,
        "tier": pick((rec or {}).get("tier"), (e or {}).get("tier") if e else None, default=""),
        "score": pick((rec or {}).get("score"), num((e or {}).get("score")) if e else None),
        "scoreBreakdown": pick((rec or {}).get("scoreBreakdown"), (e or {}).get("score_breakdown") if e else None, default=""),
        "exclusionReason": "",
        "growth12mPct": pick((rec or {}).get("growth12mPct"), num((e or {}).get("growth_12m_pct")) if e else None),
        "growth3mPct": pick((rec or {}).get("growth3mPct"), num((e or {}).get("growth_3m_pct")) if e else None),
        "followerGrowth12mPct": pick((rec or {}).get("followerGrowth12mPct"), num((e or {}).get("follower_growth_12m_pct")) if e else None),
        "lastFundingRound": pick((rec or {}).get("lastFundingRound"), (e or {}).get("last_funding_round") if e else None, default=""),
        "lastFundingDate": pick((rec or {}).get("lastFundingDate"), (e or {}).get("last_funding_date") if e else None, default=""),
        "totalInvestmentUsd": pick((rec or {}).get("totalInvestmentUsd"), to_int((e or {}).get("total_investment_usd")) if e else None),
        "roleEngPct": pick((rec or {}).get("roleEngPct"), num((e or {}).get("role_eng_pct")) if e else None),
        "roleOpsPct": pick((rec or {}).get("roleOpsPct"), num((e or {}).get("role_ops_pct")) if e else None),
        "roleResearchPct": pick((rec or {}).get("roleResearchPct"), num((e or {}).get("role_research_pct")) if e else None),
        "roleQaPct": pick((rec or {}).get("roleQaPct"), num((e or {}).get("role_qa_pct")) if e else None),
        "logoUrl": (rec or {}).get("logoUrl"),
        "contacts": contacts,
        # Real buying-centre people, keyed by unit name -> stakeholder role
        # title (KeyPerson-[:fills_role]->StakeholderRole). Each person sits under
        # the exact role they fill in that unit. All real; no synthetic contacts.
        "peopleByUnitRole": people_by_unit_role.get(n, {}),
        "locations": (rec or {}).get("locations") or (
            [{"role": "HQ", "street": None, "city": city, "postcode": None,
              "country": iso, "lat": lat, "lon": lon, "employeesHint": None}] if (lat and lon) else []
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-geocode", action="store_true", help="skip live Nominatim (cache only)")
    args = ap.parse_args()
    allow_online = not args.no_geocode

    load_dotenv(ENV_PATH)
    load_geo_cache()
    cj = load_companies_json()
    enr = load_enriched()
    mgmt = load_management()
    # Rated units that render a buying centre (from export_sff.py) — people are
    # only attached under those units' roles. Run export_sff.py first.
    sbu_path = APP_DIR / "src" / "data" / "stakeholders_by_unit.json"
    rated_units = set()
    if sbu_path.exists():
        rated_units = {v["name"] for v in json.load(open(sbu_path)).values()}
    print(f"loaded: companies.json={len(cj)}  enriched={len(enr)}  mgmt-companies={len(mgmt)}  "
          f"geocache={len(_geo_cache)}  rated-units={len(rated_units)}")

    driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )
    with driver.session(database=os.environ.get("NEO4J_DATABASE", "neo4j")) as s:
        leads = [dict(r) for r in s.run(
            "MATCH (c:Company)-[:in_lead_list]->(:LeadList) "
            "RETURN c.name AS name, c.hq_country AS hq_country, c.dach_site AS dach_site, "
            "c.website_domain AS website_domain, c.segment_focus AS segment_focus, "
            "c.lead_status AS lead_status, "
            # Firmographics stored on the Company node itself — used to fill the
            # gaps the external enrichment (Crustdata/CSV) leaves. Neo4j covers
            # description 91/91, revenue + headcount ~83/91.
            "c.description AS description, c.headcount AS headcount, "
            "c.estimated_revenue_lower_usd AS est_rev_lower, "
            "c.estimated_revenue_higher_usd AS est_rev_higher "
            "ORDER BY c.name"
        )]
        key_persons = load_key_persons(s)
        people_by_unit_role = load_people_by_unit_role(s, rated_units)
    driver.close()
    kp_total = sum(len(v) for v in key_persons.values())
    role_links = sum(len(p) for units in people_by_unit_role.values() for roles in units.values() for p in roles.values())
    print(f"validated targets: {len(leads)}  |  KeyPersons: {kp_total} across {len(key_persons)} companies"
          f"  |  buying-centre people-role slots: {role_links}")

    companies = []
    matched = geocoded = with_contacts = 0
    for lead in leads:
        c = build_company(lead, cj, enr, mgmt, key_persons, people_by_unit_role, allow_online)
        companies.append(c)
        if norm(lead["name"]) in cj or norm(lead["name"]) in enr:
            matched += 1
        if c["lat"] is not None and c["lon"] is not None:
            geocoded += 1
        if c["contacts"]:
            with_contacts += 1
    save_geo_cache()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    json.dump(companies, open(OUT_DIR / "companies.json", "w"), ensure_ascii=False, separators=(",", ":"))

    isos = sorted({c["country"] for c in companies if c["country"]})
    meta = {
        "countryOptions": [{"value": "", "label": "All countries"}]
        + [{"value": i, "label": COUNTRY_NAMES.get(i, i)} for i in isos],
        "countryNames": {i: COUNTRY_NAMES.get(i, i) for i in isos},
        "marketOptions": [
            {"value": "", "label": "All markets"},
            {"value": "sterile_fill_finish", "label": "Sterile Fill-Finish"},
        ],
        "segment": "Sterile Fill-Finish",
        # Market segments shown as the second step of the Customer List picker
        # (NAICS → segment → customers). `naics` ties each segment to the NAICS
        # group it appears under; all validated accounts are Sterile Fill-Finish
        # under NAICS 325412 (Pharmaceutical Preparation Manufacturing).
        "segments": [
            {
                "id": "sterile-fill-finish",
                "name": "Sterile Fill-Finish",
                "naics": "325412",
                "count": len(companies),
            }
        ],
        "total": len(companies),
    }
    json.dump(meta, open(OUT_DIR / "meta.json", "w"), ensure_ascii=False, indent=2)

    print(f"\nwrote {OUT_DIR / 'companies.json'}  ({len(companies)} companies)")
    print(f"  enriched (cj/csv): {matched}/{len(companies)}")
    print(f"  with coordinates:  {geocoded}/{len(companies)}")
    print(f"  with contacts:     {with_contacts}/{len(companies)}")
    no_geo = [c["name"] for c in companies if c["lat"] is None]
    if no_geo:
        print(f"  MISSING coords ({len(no_geo)}): {no_geo}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
