#!/usr/bin/env python3
"""Export the Sterile Fill-Finish (NAICS 325412) CONSOLIDATED-needs dataset from
Neo4j into the JSON files the Waldner App's Clusters view consumes.

This is the hierarchical, ODI-scored, opportunity-ranked view of:
    CLUSTER (ConsolidatedNeed) -> its CONSOLIDATED statements (ConsolidatedErrorStatement)

for every rated unit already present in ``app/public/data/odi/index.json``. The
slugs + unit names come from that index (authoritative) — this script never
re-slugifies. Consolidated / cluster scores are frequently NULL (unscored); NULL
is preserved (never coerced to 0), sorted last, and left for the frontend to
render as an em-dash.

Outputs
-------
app/public/data/consolidated/<slug>.json   per rated unit: clusters + nested consolidated
app/public/data/consolidated/index.json    one row per unit (slug, unit, clusters, consolidated)

Run:  python scripts/export_consolidated.py    (reads NEO4J_* from repo-root .env)
"""

import json
import os
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase

# Repo root = four levels up from this file:
#   <repo>/Platform UI Mockups/Waldner App/scripts/export_consolidated.py
REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = Path(__file__).resolve().parents[1] / "app"
ENV_PATH = REPO_ROOT / ".env"

NETWORK = "325412/Sterile Fill-Finish"

PUB_CONS = APP_DIR / "public" / "data" / "consolidated"


def band(v):
    """0-10 score -> qualitative band (matches ODIMatrix.bandName)."""
    if v is None:
        return ""
    return ["very low", "low", "medium", "high", "very high"][min(4, int(v // 2))]


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {path.relative_to(APP_DIR.parent)} ({path.stat().st_size:,} bytes)")


def main() -> int:
    load_dotenv(ENV_PATH)

    # Authoritative slug set: reuse the ODI index slugs, do NOT re-slugify.
    odi_index = json.loads(
        (APP_DIR / "public" / "data" / "odi" / "index.json").read_text(encoding="utf-8")
    )
    slug_by_unit = {e["unit_name"]: e["slug"] for e in odi_index}

    r1 = lambda v: round(v, 1) if v is not None else None

    driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )

    clusters_by_unit = defaultdict(list)  # unit_name -> [cluster dict]
    with driver.session(database=os.environ.get("NEO4J_DATABASE", "neo4j")) as s:
        for rec in s.run(
            "MATCH (u:ValueNetworkUnit {value_network:$net})-[:has_consolidated_need]->(cn:ConsolidatedNeed) "
            "OPTIONAL MATCH (cn)-[:groups]->(ces:ConsolidatedErrorStatement) "
            "WITH u, cn, ces "
            "ORDER BY ces.avg_opportunity_v2 IS NULL, ces.avg_opportunity_v2 DESC "
            "WITH u, cn, "
            "     [x IN collect( "
            "        CASE WHEN ces IS NULL THEN NULL ELSE { "
            "          stmt:         ces.consolidated_statement, "
            "          imp:          ces.avg_importance_v2, "
            "          sat:          ces.avg_satisfaction_v2, "
            "          opp:          ces.avg_opportunity_v2, "
            "          members:      ces.member_count, "
            "          stakeholders: ces.stakeholder_count, "
            "          jobTypes:     ces.job_types "
            "        } END "
            "     ) WHERE x IS NOT NULL] AS consolidated "
            "RETURN u.name              AS unit, "
            "       cn.need_statement   AS need, "
            "       cn.avg_importance_v2 AS imp, "
            "       cn.avg_satisfaction_v2 AS sat, "
            "       cn.avg_opportunity_v2  AS opp, "
            "       cn.member_ces_count AS cesCount, "
            "       cn.member_es_count  AS esCount, "
            "       cn.stakeholder_count AS stakeholders, "
            "       cn.job_types        AS jobTypes, "
            "       cn.track            AS track, "
            "       consolidated",
            net=NETWORK,
        ):
            unit = rec["unit"]
            if unit not in slug_by_unit:
                continue  # defensive: only index units are wanted
            consolidated = rec["consolidated"] or []
            cluster = {
                "need": rec["need"],
                "imp": r1(rec["imp"]),
                "sat": r1(rec["sat"]),
                "opp": r1(rec["opp"]),
                "imp_band": band(rec["imp"]),
                "sat_band": band(rec["sat"]),
                "cesCount": rec["cesCount"],
                "esCount": rec["esCount"],
                "stakeholders": rec["stakeholders"],
                "jobTypes": rec["jobTypes"] or [],
                "track": rec["track"],
                "consolidated": [
                    {
                        "stmt": c["stmt"],
                        "imp": r1(c["imp"]),
                        "sat": r1(c["sat"]),
                        "opp": r1(c["opp"]),
                        "imp_band": band(c["imp"]),
                        "sat_band": band(c["sat"]),
                        "members": c["members"],
                        "stakeholders": c["stakeholders"],
                        "jobTypes": c["jobTypes"] or [],
                    }
                    for c in consolidated
                ],
            }
            clusters_by_unit[unit].append(cluster)

    driver.close()

    # ---- write per-unit files (every index unit, even zero-cluster) ----
    index = []
    total_clusters = 0
    total_consolidated = 0
    for unit_name, slug in slug_by_unit.items():
        clusters = clusters_by_unit.get(unit_name, [])
        # Sort clusters within a unit by opp DESC, NULL last.
        clusters.sort(key=lambda k: -(k["opp"] if k["opp"] is not None else -1e9))
        consolidated_count = sum(len(c["consolidated"]) for c in clusters)
        obj = {
            "unit": unit_name,
            "slug": slug,
            "totals": {"clusters": len(clusters), "consolidated": consolidated_count},
            "clusters": clusters,
        }
        write_json(PUB_CONS / f"{slug}.json", obj)
        index.append(
            {
                "slug": slug,
                "unit": unit_name,
                "clusters": len(clusters),
                "consolidated": consolidated_count,
            }
        )
        total_clusters += len(clusters)
        total_consolidated += consolidated_count

    index.sort(key=lambda e: (-e["clusters"], e["unit"]))
    write_json(PUB_CONS / "index.json", index)

    print(
        f"\nunits written: {len(index)}   total clusters: {total_clusters}   "
        f"total consolidated: {total_consolidated}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
