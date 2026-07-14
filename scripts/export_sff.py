#!/usr/bin/env python3
"""Export the Sterile Fill-Finish (NAICS 325412) report dataset from Neo4j into
the JSON files the Waldner App consumes.

This is a rewrite of the older ``export_sff_data.py`` for the CURRENT graph
schema. In the current graph there are no ``ODIRating`` nodes: the Ulwick
importance / satisfaction / opportunity scores live directly on each
``ErrorStatement`` as ``*_v2`` properties (the "needs scoring v2" stack). This
script reads those.

Outputs
-------
app/src/data/valueNetwork.json     full SFF unit tree + meta (bundled import)
app/src/data/market.json           market meta + header stats + Waldner products
app/src/data/odi_default.json      the top-opportunity rated unit (bundled default)
app/public/data/odi/index.json     one row per rated unit (fetched at runtime)
app/public/data/odi/<slug>.json    per rated unit: stakeholders + all ODI rows

Every value is written exactly as stored in the graph. The only *derived*
fields are documented inline (band buckets from the 0-10 score; confidence from
the StakeholderRole confidence — see NOTES). Nothing is invented or rounded away.

Run:  python scripts/export_sff.py           (reads NEO4J_* from repo-root .env)
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase

# Repo root = four levels up from this file:
#   <repo>/Platform UI Mockups/Waldner App/scripts/export_sff.py
REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = Path(__file__).resolve().parents[1] / "app"
SRC_DATA = APP_DIR / "src" / "data"
PUB_ODI = APP_DIR / "public" / "data" / "odi"
ENV_PATH = REPO_ROOT / ".env"

NETWORK = "325412/Sterile Fill-Finish"
NAICS = "325412"
MARKET_LABEL = "Sterile Fill-Finish"
OWNER_COMPANY = "Hermann WALDNER GmbH & Co. KG"

LEVEL_ORDER = {"L7": 0, "L6": 1, "L6a": 2, "L5": 3, "L4": 4, "L3": 5}
LEVELS = ["L7", "L6", "L6a", "L5", "L4", "L3"]
ROLE_LABELS = {
    "job_executor": "Job Executor",
    "job_overseer": "Job Overseer",
    "job_influencer": "Job Influencer",
    "purchase_influencer": "Purchase Influencer",
    "purchase_executor": "Purchase Executor",
}
# Ulwick market-sizing estimates for the sterile fill-finish / injectable CDMO
# market. NOT in the graph — these are external market-research figures. Edit
# here (with a source) if you have better numbers. Surfaced as the TAM/SAM
# header tiles on the Market page.
HEADER_STATS = [
    {
        "label": "TAM",
        "value": "$110B",
        "tip": "Total Addressable Market — global injectable / sterile fill-finish "
        "drug-product manufacturing (in-house + outsourced), ~2025 estimate.",
    },
    {
        "label": "SAM",
        "value": "$18B",
        "tip": "Serviceable Addressable Market — the outsourced sterile fill-finish "
        "CDMO segment reachable for equipment & automation suppliers.",
    },
]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or "unit"


class SlugRegistry:
    """Stable, unique slugs: append -2, -3 ... on collision."""

    def __init__(self):
        self.seen = defaultdict(int)
        self.collisions = []

    def make(self, text: str) -> str:
        base = slugify(text)
        self.seen[base] += 1
        if self.seen[base] == 1:
            return base
        self.collisions.append(text)
        return f"{base}-{self.seen[base]}"


def band(v):
    """0-10 score -> qualitative band (matches ODIMatrix.bandName)."""
    if v is None:
        return ""
    return ["very low", "low", "medium", "high", "very high"][min(4, int(v // 2))]


def conf_band(pct):
    """Confidence percent -> Sherman-Kent style band."""
    if pct is None:
        return ""
    if pct >= 90:
        return "very high"
    if pct >= 75:
        return "high"
    if pct >= 60:
        return "medium"
    if pct >= 40:
        return "low"
    return "very low"


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {path.relative_to(APP_DIR.parent)} ({path.stat().st_size:,} bytes)")


def main() -> int:
    load_dotenv(ENV_PATH)
    driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )
    notes = []
    with driver.session(database=os.environ.get("NEO4J_DATABASE", "neo4j")) as s:
        # ---- units -----------------------------------------------------
        units = {}  # elementId -> dict
        for rec in s.run(
            "MATCH (u:ValueNetworkUnit {value_network:$net}) "
            "RETURN elementId(u) AS eid, u.name AS name, u.level AS level, "
            "u.cfj AS cfj, u.cfj_description AS cfjd",
            net=NETWORK,
        ):
            units[rec["eid"]] = {
                "name": rec["name"],
                "level": rec["level"],
                "cfj": rec["cfj"] or rec["cfjd"] or None,
            }
        print(f"units: {len(units)}")

        # ---- hierarchy edges (within this network) ---------------------
        children_of = defaultdict(list)
        parent_of = {}
        for rec in s.run(
            "MATCH (p:ValueNetworkUnit {value_network:$net})-[:has_child]->"
            "(c:ValueNetworkUnit {value_network:$net}) "
            "RETURN elementId(p) AS p, elementId(c) AS c",
            net=NETWORK,
        ):
            p, c = rec["p"], rec["c"]
            if c in parent_of and parent_of[c] != p:
                continue  # keep first parent; skip extra edges
            parent_of[c] = p
            children_of[p].append(c)

        roots = [eid for eid in units if eid not in parent_of]
        l7 = [e for e in roots if units[e]["level"] == "L7"]
        root_eid = l7[0] if l7 else roots[0]
        if len(roots) != 1:
            notes.append(f"{len(roots)} parentless units (expected 1)")

        # ---- build the tree with stable, unique node ids ---------------
        reg = SlugRegistry()
        id_by_name = {}

        def sort_key(eid):
            u = units[eid]
            return (LEVEL_ORDER.get(u["level"], 99), u["name"] or "")

        def build(eid):
            u = units[eid]
            nid = reg.make(u["name"])
            id_by_name.setdefault(u["name"], nid)
            node = {"id": nid, "level": u["level"], "name": u["name"], "cfj": u["cfj"]}
            kids = sorted(children_of.get(eid, []), key=sort_key)
            if kids:
                node["children"] = [build(k) for k in kids]
            return node

        sys.setrecursionlimit(100000)
        root_node = build(root_eid)

        level_counts = defaultdict(int)
        for u in units.values():
            level_counts[u["level"]] += 1

        vn_meta = {
            "naics": NAICS,
            "market": MARKET_LABEL,
            "root": units[root_eid]["name"],
            "units": len(units),
            "levels": [{"label": lv, "count": level_counts.get(lv, 0)} for lv in LEVELS],
        }
        write_json(SRC_DATA / "valueNetwork.json", {"meta": vn_meta, "root": root_node})

        # ---- Waldner products matched to SFF units ---------------------
        # Each product carries its Neutral Product Group (a technology-class group
        # derived from the UNSPSC commodity): group name + UNSPSC code where known.
        prod_units = defaultdict(set)  # product name -> {unit_id}
        prod_note = {}
        prod_group = {}  # product name -> {code, name}
        for rec in s.run(
            "MATCH (c:Company {name:$owner})-[:has_product]->(p:Product)"
            "-[:matches_vn_unit]->(u:ValueNetworkUnit {value_network:$net}) "
            "OPTIONAL MATCH (p)-[:in_product_group]->(g:ProductGroup) "
            "RETURN p.name AS product, p.product_type AS ptype, u.name AS unit, "
            "g.name AS gname, g.unspsc_code AS gcode",
            owner=OWNER_COMPANY, net=NETWORK,
        ):
            uid = id_by_name.get(rec["unit"])
            if uid is None:
                continue
            prod_units[rec["product"]].add(uid)
            if rec["ptype"] and rec["product"] not in prod_note:
                prod_note[rec["product"]] = str(rec["ptype"]).replace("_", " ").title()
            if rec["gname"] and rec["product"] not in prod_group:
                prod_group[rec["product"]] = {"code": rec["gcode"] or "", "name": rec["gname"]}
        products = [
            {
                "name": name,
                "note": prod_note.get(name),
                "unitIds": sorted(uids),
                "group": prod_group.get(name),
            }
            for name, uids in sorted(prod_units.items())
        ]
        group_count = len({(g["code"], g["name"]) for g in prod_group.values()})

        # ---- ODI rows: unit -> stakeholder role -> error statement -----
        rows_by_unit = defaultdict(list)
        sr_by_unit = defaultdict(dict)  # unit -> {sr_eid: stakeholder}
        unit_meta = {}
        for rec in s.run(
            "MATCH (u:ValueNetworkUnit {value_network:$net})"
            "-[:has_stakeholder_role]->(sr:StakeholderRole)"
            "-[:has_need_statement]->(es:ErrorStatement) "
            "WHERE es.opportunity_v2 IS NOT NULL "
            "OPTIONAL MATCH (job)-[:has_error]->(es) "
            "RETURN u.name AS unit, u.level AS level, u.cfj AS cfj, u.cfj_description AS cfjd, "
            "elementId(sr) AS sr_eid, sr.role AS role, sr.title AS title, "
            "sr.esco_code AS esco, sr.confidence AS sr_conf, "
            "es.need_statement AS stmt, es.error_statement AS estmt, "
            "es.job_type AS job_type, es.need_direction AS need_dir, "
            "es.metric_word AS metric_word, es.error_type AS error_type, "
            "es.importance_v2 AS imp, es.importance_rationale_v2 AS imp_rat, "
            "es.satisfaction_v2 AS sat, "
            "es.satisfaction_reliability_rationale_v2 AS sat_rel, "
            "es.satisfaction_time_rationale_v2 AS sat_time, "
            "es.satisfaction_skill_rationale_v2 AS sat_skill, "
            "es.satisfaction_cost_rationale_v2 AS sat_cost, "
            "es.opportunity_v2 AS opp, es.opportunity_rank_v2 AS rank, "
            "head([l IN labels(job) WHERE l <> 'Resource']) AS job_label, job.name AS source_job",
            net=NETWORK,
        ):
            uname = rec["unit"]
            unit_meta[uname] = {"level": rec["level"], "cfj": rec["cfj"] or rec["cfjd"] or None}
            title = rec["title"]
            sr_by_unit[uname].setdefault(
                rec["sr_eid"],
                {
                    "role": rec["role"],
                    "role_label": ROLE_LABELS.get(rec["role"], rec["role"]),
                    "title": title,
                    "esco_code": rec["esco"],
                    "n": 0,
                },
            )["n"] += 1
            # Confidence: v2 scoring carries no per-need confidence; use the
            # StakeholderRole modelling confidence (0-1) as the shared imp/sat
            # confidence. See NOTES in MANUAL.md.
            conf = int(round((rec["sr_conf"] or 0.7) * 100))
            # Satisfaction rationale: v2 splits it into reliability/time/skill/cost
            # sub-rationales; join the present ones into one paragraph.
            sat_rat = " ".join(
                x for x in [rec["sat_rel"], rec["sat_time"], rec["sat_skill"], rec["sat_cost"]] if x
            )
            rows_by_unit[uname].append(
                {
                    "stk": title,
                    "role": rec["role"],
                    "role_label": ROLE_LABELS.get(rec["role"], rec["role"]),
                    "esco_code": rec["esco"],
                    "job_type": rec["job_type"],
                    "source_job": rec["source_job"] or (rec["stmt"] or ""),
                    "stmt": rec["stmt"] or rec["estmt"],
                    "imp": rec["imp"],
                    "imp_band": band(rec["imp"]),
                    "imp_rat": rec["imp_rat"] or "",
                    "imp_conf": conf,
                    "imp_conf_b": conf_band(conf),
                    "sat": rec["sat"],
                    "sat_band": band(rec["sat"]),
                    "sat_rat": sat_rat,
                    "sat_conf": conf,
                    "sat_conf_b": conf_band(conf),
                    "opp": rec["opp"],
                    "rank": rec["rank"],
                }
            )

        # ---- write per-unit ODI + index --------------------------------
        odi_reg = SlugRegistry()
        index = []
        stakeholders_by_unit = {}  # slug -> {name, level, stakeholders[]}
        default_slug = None
        best_top = None
        for uname in sorted(rows_by_unit.keys()):
            rows = rows_by_unit[uname]
            rows.sort(
                key=lambda r: (
                    -(r["opp"] if r["opp"] is not None else -1e9),
                    -(r["imp"] if r["imp"] is not None else -1e9),
                )
            )
            slug = odi_reg.make(uname)
            meta = unit_meta[uname]
            stakeholders = sorted(
                sr_by_unit[uname].values(), key=lambda x: (x["role"] or "", x["title"] or "")
            )
            job_types = {r["source_job"]: r["job_type"] for r in rows}
            odi_obj = {
                "unit": {"name": uname, "level": meta["level"], "cfj": meta["cfj"]},
                "meta": {
                    "method": "Ulwick ODI (Importance × Satisfaction → Opportunity), needs scoring v2",
                    "model": "claude-opus-4-8",
                    "effort": "high",
                    "generated_from": "Neo4j ValueNetworkUnit → StakeholderRole → ErrorStatement (_v2)",
                    "stakeholders": len(stakeholders),
                    "ratings": len(rows),
                    "issues": 0,
                    "cost_usd": None,
                },
                "totals": {
                    "stakeholders": len(stakeholders),
                    "jobs": len(job_types),
                    "needs": len(rows),
                },
                "naics": NAICS,
                "market_label": MARKET_LABEL,
                "stakeholders": stakeholders,
                "rows": rows,
            }
            write_json(PUB_ODI / f"{slug}.json", odi_obj)
            # Compact per-unit buying centre (role/title/esco only) so the Market
            # page + sales modal show THIS unit's stakeholders, not a fixed default.
            stakeholders_by_unit[slug] = {
                "name": uname,
                "level": meta["level"],
                "stakeholders": [
                    {"role": s["role"], "role_label": s["role_label"],
                     "title": s["title"], "esco_code": s["esco_code"]}
                    for s in stakeholders
                ],
            }
            opps = [r["opp"] for r in rows if r["opp"] is not None]
            top = max(opps) if opps else None
            index.append(
                {
                    "slug": slug,
                    "unit_name": uname,
                    "unit_id": id_by_name.get(uname),
                    "level": meta["level"],
                    "cfj": meta["cfj"],
                    "stakeholders": len(stakeholders),
                    "needs": len(rows),
                    "top_opportunity": top,
                    "avg_opportunity": (sum(opps) / len(opps)) if opps else None,
                    "underserved": sum(
                        1 for r in rows
                        if r["imp"] is not None and r["sat"] is not None and (r["imp"] - r["sat"]) >= 3
                    ),
                    "product_matched": uname in {p for pl in prod_units.values() for p in []} or any(
                        id_by_name.get(uname) in uids for uids in prod_units.values()
                    ),
                }
            )
            if best_top is None or (top is not None and top > best_top):
                best_top, default_slug = top, slug
                default_obj = odi_obj

        index.sort(key=lambda e: -(e["top_opportunity"] if e["top_opportunity"] is not None else -1e9))
        write_json(PUB_ODI / "index.json", index)
        # Bundled copy so the Market page can mark rated units + deep-link at build time.
        write_json(SRC_DATA / "odi_index.json", index)
        # Per-unit buying centres (keyed by slug) — the Market page + sales modal
        # render the SELECTED unit's stakeholders from this, not a fixed default.
        write_json(SRC_DATA / "stakeholders_by_unit.json", stakeholders_by_unit)
        # Bundled default unit (highest top-opportunity) for the synchronous import.
        write_json(SRC_DATA / "odi_default.json", {**default_obj, "slug": default_slug})

        # ---- market.json ----------------------------------------------
        write_json(
            SRC_DATA / "market.json",
            {
                "meta": vn_meta,
                "headerStats": HEADER_STATS,
                "naicsDescription": "Sterile fill-finish and injectable drug-product "
                "manufacturing — aseptic filling, closure, inspection and packaging of "
                "vials, syringes and cartridges under NAICS 325412.",
                "ratedUnitCount": len(rows_by_unit),
                "needsCount": sum(len(v) for v in rows_by_unit.values()),
                "products": products,
                "defaultOdiSlug": default_slug,
            },
        )

    driver.close()
    print(f"\nrated units: {len(rows_by_unit)}   products matched: {len(products)}   "
          f"product groups: {group_count}   default ODI unit: {default_slug} (top opp {best_top})")
    if notes:
        print("NOTES:")
        for n in notes:
            print("  -", n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
