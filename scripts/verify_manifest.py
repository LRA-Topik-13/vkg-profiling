#!/usr/bin/env python3
"""Re-parse the *generated* defect SQL and assert it matches each level's manifest.

This is the deterministic, DB-free guard for the correctness datasets: it proves the
emitted SQL actually contains the row counts, NULL cells, shadow rows and link rows the
manifest claims — so the manifest can be trusted as ground truth without booting Docker.

Usage:  python3 scripts/verify_manifest.py
Exit status is non-zero if any assertion fails.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inject_defects import (  # noqa: E402
    OUT_DIR, SCHEMA, build_sources, parse_value_tuples, pct_count, parse_baselines,
)


def discover_variants() -> list[tuple[int, str, str]]:
    """Every datasets_defect/level_<NN>/<metric> folder on disk -> (level, metric, dir)."""
    out = []
    for d in glob.glob(os.path.join(OUT_DIR, "level_*", "*")):
        m = re.search(r"level_(\d+)/([a-z]+)$", d)
        if m and os.path.isfile(os.path.join(d, "manifest.json")):
            out.append((int(m.group(1)), m.group(2), d))
    return sorted(out)

ENTITY_OF_SHADOW = {}  # (src, shadow) -> entity table
for _s, _src in build_sources().items():
    for _t, _m in _src.entity_tables.items():
        ENTITY_OF_SHADOW[(_s, _m["shadow"])] = _t

SHADOWS = {s: {m["shadow"]: t for t, m in src.entity_tables.items()}
           for s, src in build_sources().items()}

DIALECT = {"compsci": ("mysql", "compsci.sql"), "mathsci": ("pgsql", "mathsci.sql"),
           "academics": ("mssql", "academics.sql")}


def cols_for(src_name: str, table: str) -> list[str]:
    if table in SCHEMA[src_name]:
        return SCHEMA[src_name][table][0]
    # shadow table: inherits the feeding entity table's columns
    entity = SHADOWS[src_name][table]
    return SCHEMA[src_name][entity][0]


def parse_generated(path: str, src_name: str) -> dict[str, list[list]]:
    """Parse emitted INSERT statements (all three dialects) into table -> rows."""
    sql = open(path, encoding="utf-8").read()
    tables: dict[str, list[list]] = {}
    # matches:  INSERT INTO `t` (...) VALUES ...   /  INSERT INTO public.t (...) VALUES ...
    #           INSERT INTO t VALUES (...);
    pat = re.compile(
        r"INSERT INTO\s+`?(?:public\.)?(?P<t>[A-Za-z_][\w]*)`?\s*(?:\([^)]*\))?\s*VALUES\s*(?P<vals>.+?);",
        re.S,
    )
    for m in pat.finditer(sql):
        t = m.group("t")
        tables.setdefault(t, []).extend(parse_value_tuples(m.group("vals")))
    return tables


def main() -> int:
    baseline = parse_baselines()
    failures: list[str] = []
    variants = discover_variants()

    def check(cond: bool, msg: str):
        if not cond:
            failures.append(msg)

    for level, metric, vdir in variants:
        tag = f"{level:02d}/{metric}"
        man = json.load(open(os.path.join(vdir, "manifest.json"), encoding="utf-8"))

        parsed: dict[str, dict[str, list[list]]] = {}
        for src_name, (dia, fname) in DIALECT.items():
            parsed[src_name] = parse_generated(os.path.join(vdir, dia, fname), src_name)

        # ---- generated SQL matches the ledger (NULLs per column; mapped+shadow) ----
        ledger_attr = man["ledger"]["attribute_nulled"]
        for src_name, src in build_sources().items():
            for (cls, table, col, prop) in src.literal_cols:
                rows = parsed[src_name].get(table, [])
                ci = cols_for(src_name, table).index(col)
                nulls = sum(1 for r in rows if r[ci] is None)
                expected = ledger_attr.get(f"{src_name}.{table}.{col}", 0)
                check(nulls == expected,
                      f"L{tag} {src_name}.{table}.{col} NULLs: SQL={nulls} ledger={expected}")
            for table, meta in src.entity_tables.items():
                mapped = len(parsed[src_name].get(table, []))
                shadow = len(parsed[src_name].get(meta["shadow"], []))
                base = len(baseline[src_name].tables[table].rows)
                check(mapped + shadow == base,
                      f"L{tag} {src_name}.{table}: mapped({mapped})+shadow({shadow}) != baseline({base})")

        # ---- non-focal metrics stay pristine in this isolated dataset --------------
        if metric != "attribute":
            for src_name, src in build_sources().items():
                for (cls, table, col, prop) in src.literal_cols:
                    rows = parsed[src_name].get(table, [])
                    ci = cols_for(src_name, table).index(col)
                    check(all(r[ci] is not None for r in rows),
                          f"L{tag} non-attribute dataset has NULL in {src_name}.{table}.{col}")
        if metric != "population":
            for src_name, src in build_sources().items():
                for table, meta in src.entity_tables.items():
                    check(len(parsed[src_name].get(meta["shadow"], [])) == 0,
                          f"L{tag} non-population dataset shadowed {src_name}.{meta['shadow']}")

        # ---- the focal metric's overall lands at / near the target -----------------
        ov = man["expected"]["overall"]
        target = man["target_completeness"]
        if metric == "population":
            check(abs(ov["population_completeness"] - target) <= 1.0,
                  f"L{tag} population {ov['population_completeness']}% != target {target}%")
        elif metric == "attribute":
            check(abs(ov["attribute_completeness"] - target) <= 1.5,
                  f"L{tag} attribute {ov['attribute_completeness']}% != target {target}%")
        elif metric == "interlinking":
            # capped at the ~97.8% baseline; for targets at/above it, expect ~baseline
            check(abs(ov["interlinking_completeness"] - min(target, 97.83)) <= 1.5,
                  f"L{tag} interlinking {ov['interlinking_completeness']}% != target {target}%")

    if failures:
        print(f"FAIL ({len(failures)} issues):")
        for f in failures:
            print("  -", f)
        return 1
    print(f"OK — {len(variants)} variant(s) verified against their manifests.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
