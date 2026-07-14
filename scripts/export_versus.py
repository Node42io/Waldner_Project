#!/usr/bin/env python3
"""Export the Waldner-vs-Brinox comparison over the NAICS 325412 value network.

Both companies' portfolios are matched (Product-[:matches_vn_unit]->) into the
broad 325412 "Pharmaceutical Preparation Manufacturing" value network. This script
tags every matched unit W (Waldner only), B (Brinox only) or WB (both), rolls the
matched L5 units up to their L6 process stage, and writes a PRUNED tree (matched
units + their ancestors only) the comparison page renders.

Output: app/src/data/versus.json

Run:  python scripts/export_versus.py
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase

REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = Path(__file__).resolve().parents[1] / "app"
SRC_DATA = APP_DIR / "src" / "data"
ENV_PATH = REPO_ROOT / ".env"

VN = "325412"
WALDNER = "Hermann WALDNER GmbH & Co. KG"
BRINOX = "BRINOX d.o.o."
LEVEL_ORDER = {"L7": 0, "L6": 1, "L6a": 2, "L5": 3, "L4": 4, "L3": 5}

QUESTION = (
    "Who owns which part of the pharmaceutical manufacturing process — and where "
    "do Waldner and Brinox go head-to-head?"
)


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or "unit"


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
    with driver.session(database=os.environ.get("NEO4J_DATABASE", "neo4j")) as s:
        # ---- all units in the VN (name/level) -------------------------
        units = {}
        for r in s.run(
            "MATCH (u:ValueNetworkUnit {value_network:$vn}) "
            "RETURN elementId(u) AS eid, u.name AS name, u.level AS level, u.cfj AS cfj",
            vn=VN,
        ):
            units[r["eid"]] = {"name": r["name"], "level": r["level"], "cfj": r["cfj"]}

        # ---- hierarchy ------------------------------------------------
        parent_of = {}
        children_of = defaultdict(list)
        for r in s.run(
            "MATCH (p:ValueNetworkUnit {value_network:$vn})-[:has_child]->"
            "(c:ValueNetworkUnit {value_network:$vn}) RETURN elementId(p) AS p, elementId(c) AS c",
            vn=VN,
        ):
            if r["c"] not in parent_of:
                parent_of[r["c"]] = r["p"]
                children_of[r["p"]].append(r["c"])
        roots = [e for e in units if e not in parent_of]
        l7 = [e for e in roots if units[e]["level"] == "L7"]
        root_eid = l7[0] if l7 else roots[0]

        # ---- matched units per company + their products ---------------
        matched = defaultdict(set)          # eid -> {'W','B'}
        products = defaultdict(lambda: {"W": set(), "B": set()})
        for co, tag in [(WALDNER, "W"), (BRINOX, "B")]:
            for r in s.run(
                "MATCH (c:Company {name:$co})-[:has_product]->(p:Product)"
                "-[:matches_vn_unit]->(u:ValueNetworkUnit {value_network:$vn}) "
                "RETURN elementId(u) AS eid, p.name AS product",
                co=co, vn=VN,
            ):
                matched[r["eid"]].add(tag)
                products[r["eid"]][tag].add(r["product"])

    driver.close()

    def tag_of(eid):
        t = matched.get(eid)
        if not t:
            return None
        return "WB" if len(t) == 2 else ("W" if "W" in t else "B")

    # ---- prune: keep matched units + all their ancestors --------------
    keep = set()
    for eid in matched:
        cur = eid
        while cur is not None and cur not in keep:
            keep.add(cur)
            cur = parent_of.get(cur)

    def dominance(st):
        w, b, wb = st["W"], st["B"], st["WB"]
        if w == 0 and b == 0:
            return "shared"
        if w > b:
            return "waldner"
        if b > w:
            return "brinox"
        return "contested"

    # ---- build the pruned tree, rolling W/B/WB coverage up EVERY level -
    reg_seen = defaultdict(int)

    def nid(name):
        reg_seen[name] += 1
        return slugify(name) if reg_seen[name] == 1 else f"{slugify(name)}-{reg_seen[name]}"

    def build(eid):
        u = units[eid]
        node = {"id": nid(u["name"]), "name": u["name"], "level": u["level"]}
        if u.get("cfj"):
            node["cfj"] = u["cfj"]
        # Subtree coverage: count of matched units below (and incl.) this node,
        # so every level shows its Waldner/Brinox coverage at a glance.
        st = {"W": 0, "B": 0, "WB": 0}
        t = tag_of(eid)
        if t:
            node["tag"] = t
            st[t] += 1
            prod = products[eid]
            if prod["W"]:
                node["waldnerProducts"] = sorted(prod["W"])
            if prod["B"]:
                node["brinoxProducts"] = sorted(prod["B"])
        kids = [c for c in children_of.get(eid, []) if c in keep]
        kids.sort(key=lambda c: (LEVEL_ORDER.get(units[c]["level"], 9), units[c]["name"] or ""))
        if kids:
            node["children"] = []
            for c in kids:
                cn = build(c)
                node["children"].append(cn)
                cs = cn.get("stats")
                if cs:
                    for k in ("W", "B", "WB"):
                        st[k] += cs[k]
        if st["W"] + st["B"] + st["WB"] > 0:
            node["stats"] = st
            node["dominant"] = dominance(st)
        return node

    sys.setrecursionlimit(100000)
    root = build(root_eid)

    # ---- ordered stage list for the summary strip (L6 coverage) --------
    stages = []
    for l6 in root.get("children", []):
        st = l6.get("stats", {"W": 0, "B": 0, "WB": 0})
        stages.append({
            "name": l6["name"],
            "w": st["W"], "b": st["B"], "wb": st["WB"],
            "total": st["W"] + st["B"] + st["WB"],
            "dominant": l6.get("dominant", "shared"),
        })
    stages.sort(key=lambda x: -x["total"])

    wal_units = sum(1 for e in matched if "W" in matched[e])
    bri_units = sum(1 for e in matched if "B" in matched[e])
    both_units = sum(1 for e in matched if len(matched[e]) == 2)

    write_json(SRC_DATA / "versus.json", {
        "meta": {
            "naics": VN,
            "naics_title": "Pharmaceutical Preparation Manufacturing",
            "root": units[root_eid]["name"],
            "waldner": "Waldner PAS",
            "brinox": "Brinox",
        },
        "question": QUESTION,
        "summary": {
            "waldnerUnits": wal_units,
            "brinoxUnits": bri_units,
            "both": both_units,
            "stages": len(stages),
            "waldnerStages": sum(1 for x in stages if x["dominant"] == "waldner"),
            "brinoxStages": sum(1 for x in stages if x["dominant"] == "brinox"),
        },
        "stages": stages,
        "root": root,
    })
    print(f"\nWaldner units: {wal_units}   Brinox units: {bri_units}   both: {both_units}   "
          f"stages: {len(stages)}   tree nodes kept: {len(keep)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
