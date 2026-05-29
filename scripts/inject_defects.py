#!/usr/bin/env python3
"""Reproducible completeness-defect injector for the VKG profiling correctness study.

Reads the clean baseline SQL in ``datasets_plan/`` (compsci=MySQL, mathsci=PostgreSQL,
academics=MSSQL) and emits, for each defect degree p in {0, 2, 5, 10, 20}%, a defected
copy of all three databases plus a mapping-reduced ``university.obda`` and a ground-truth
manifest.

Four completeness sub-metrics are degraded at each level, with a single fixed seed so the
whole thing is byte-for-byte reproducible:

  * attribute    – NULL p% of literal property cells (Ontop emits no triple for NULL).
  * population   – move p% of entity rows into an *unmapped* shadow table, so the row is
                   still counted as expected source population but is no longer represented
                   in the VKG (deleting the row would drop both sides and hide the defect).
  * interlinking – remove p% of object-property links (delete link-table rows / NULL FK
                   columns) so entities lose their connections.
  * mapping      – drop p% of OBDA mapping declarations so schema (mapping) coverage falls.

Selection within every dimension is *global-pooled*: the relevant units are pooled across
all three sources and a seeded sample of size round(pool * p/100) is removed.

The accompanying ``manifest.json`` / ``MANIFEST.md`` are computed from the *final* generated
state and are the authoritative ground truth to compare the dashboard against.

Usage:  python3 scripts/inject_defects.py [--seed 2025]
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
from dataclasses import dataclass, field

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN_DIR = os.path.join(ROOT, "datasets_plan")
OUT_DIR = os.path.join(ROOT, "datasets_defect")
OBDA_SRC = os.path.join(ROOT, "vkg", "obda", "university.obda")
OBDA_OUT_DIR = os.path.join(ROOT, "vkg", "obda-defected")

LEVELS = [0, 2, 5, 10, 20]
# Each metric gets its own isolated dataset per level (degrade only that metric to the target;
# avoids the population↔interlinking coupling that prevents both hitting the target at once).
METRICS = ["population", "attribute", "interlinking", "schema"]
DEFAULT_SEED = 2025
VOC = "http://example.org/voc#"

# ──────────────────────────────────────────────────────────────────────────────
# Deterministic RNG: a self-contained linear-congruential shuffle so results never
# depend on the host CPython's random() implementation details.
# ──────────────────────────────────────────────────────────────────────────────
class DetRandom:
    """Minimal deterministic RNG seeded from a string (FNV-1a -> LCG)."""

    def __init__(self, seed_text: str):
        h = 2166136261
        for ch in seed_text.encode("utf-8"):
            h = ((h ^ ch) * 16777619) & 0xFFFFFFFF
        self.state = h or 1

    def _next(self) -> int:
        # Numerical Recipes LCG constants.
        self.state = (1664525 * self.state + 1013904223) & 0xFFFFFFFF
        return self.state

    def sample_indices(self, n: int, k: int) -> list[int]:
        """Return k distinct indices in [0, n) via a partial Fisher-Yates shuffle."""
        k = max(0, min(k, n))
        idx = list(range(n))
        for i in range(k):
            j = i + self._next() % (n - i)
            idx[i], idx[j] = idx[j], idx[i]
        return sorted(idx[:k])


def pct_count(pool: int, p: int) -> int:
    """round-half-to-even count of p% of pool (Python's banker's rounding)."""
    return int(round(pool * p / 100.0))


# ──────────────────────────────────────────────────────────────────────────────
# In-memory table model
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class Table:
    name: str
    cols: list[str]
    types: dict[str, str]          # col -> 'int' | 'str' | 'time'
    rows: list[list]               # values: int | str | None
    pk: list[str] = field(default_factory=list)

    def ci(self, col: str) -> int:
        return self.cols.index(col)


# ──────────────────────────────────────────────────────────────────────────────
# SQL value tokeniser (shared by MySQL & MSSQL INSERT parsing)
# ──────────────────────────────────────────────────────────────────────────────
def parse_value_tuples(s: str) -> list[list]:
    """Parse '(1,'a','b'),(2,'c',NULL)' into [[1,'a','b'],[2,'c',None]]."""
    out: list[list] = []
    i, n = 0, len(s)
    while i < n:
        while i < n and s[i] != "(":
            i += 1
        if i >= n:
            break
        i += 1  # consume '('
        row: list = []
        while True:
            while i < n and s[i] in " \n\t\r":
                i += 1
            if s[i] == "'":
                i += 1
                buf: list[str] = []
                while i < n:
                    if s[i] == "'":
                        if i + 1 < n and s[i + 1] == "'":
                            buf.append("'")
                            i += 2
                        else:
                            i += 1
                            break
                    else:
                        buf.append(s[i])
                        i += 1
                row.append("".join(buf))
            else:
                buf2: list[str] = []
                while i < n and s[i] not in ",)":
                    buf2.append(s[i])
                    i += 1
                tok = "".join(buf2).strip()
                if tok.upper() == "NULL":
                    row.append(None)
                elif re.fullmatch(r"-?\d+", tok):
                    row.append(int(tok))
                else:
                    row.append(tok)
            while i < n and s[i] in " \n\t\r":
                i += 1
            if i < n and s[i] == ",":
                i += 1
                continue
            if i < n and s[i] == ")":
                i += 1
                break
        out.append(row)
    return out


def parse_mysql_table(sql: str, table: str, cols: list[str], types: dict, pk: list[str]) -> Table:
    rows: list[list] = []
    for m in re.finditer(r"INSERT INTO `" + re.escape(table) + r"` VALUES\s*(.+?);", sql, re.S):
        rows.extend(parse_value_tuples(m.group(1)))
    return Table(table, cols, types, rows, pk)


def parse_mssql_table(sql: str, table: str, cols: list[str], types: dict, pk: list[str]) -> Table:
    rows: list[list] = []
    for m in re.finditer(r"INSERT INTO " + re.escape(table) + r"\s+VALUES\s*(\(.+?\))\s*;", sql, re.S):
        rows.extend(parse_value_tuples(m.group(1)))
    return Table(table, cols, types, rows, pk)


def parse_pg_table(sql: str, table: str, cols: list[str], types: dict, pk: list[str]) -> Table:
    """Parse a `COPY public.<table> (...) FROM stdin; ... \\.` block."""
    rows: list[list] = []
    pat = r"COPY public\." + re.escape(table) + r"\s*\(([^)]*)\)\s*FROM stdin;\n(.*?)\n\\\.\n"
    m = re.search(pat, sql, re.S)
    if not m:
        raise ValueError(f"COPY block for {table} not found")
    copy_cols = [c.strip() for c in m.group(1).split(",")]
    for line in m.group(2).split("\n"):
        if line == "":
            continue
        raw = line.split("\t")
        row_by_col: dict[str, object] = {}
        for cname, rawv in zip(copy_cols, raw):
            if rawv == r"\N":
                row_by_col[cname] = None
            elif types[cname] == "int":
                row_by_col[cname] = int(rawv)
            else:
                row_by_col[cname] = rawv
        rows.append([row_by_col[c] for c in cols])
    return Table(table, cols, types, rows, pk)


# ──────────────────────────────────────────────────────────────────────────────
# Source schema configuration
#   role of each column matters for which defect pool it joins.
# ──────────────────────────────────────────────────────────────────────────────
# literal_cols: (class_local, table, column, property_localName)  -> attribute pool
# entity_tables: table -> (class_local, pk, subject_base_uri, shadow_table)
# link_units: list of dicts describing object-property links -> interlinking pool

@dataclass
class Source:
    name: str            # compsci / mathsci / academics
    dialect: str         # mysql / pgsql / mssql
    tables: dict         # name -> Table (filled by parse)
    entity_tables: dict  # table -> dict(class, pk, base, shadow)
    literal_cols: list   # (class, table, col, prop)
    link_specs: list     # dicts (see below)


def build_sources() -> dict[str, Source]:
    return {
        "compsci": Source(
            name="compsci", dialect="mysql", tables={},
            entity_tables={
                "academic": dict(cls="FacultyMember", pk="a_id", base=VOC + "compsci/academic/", shadow="academic_unmapped"),
                "course":   dict(cls="Course",        pk="c_id", base=VOC + "compsci/course/",   shadow="course_unmapped"),
                "student":  dict(cls="Student",       pk="s_id", base=VOC + "compsci/student/",  shadow="legacy_student"),
            },
            literal_cols=[
                ("Student", "student", "first_name", "firstName"),
                ("Student", "student", "last_name", "lastName"),
                ("FacultyMember", "academic", "first_name", "firstName"),
                ("FacultyMember", "academic", "last_name", "lastName"),
                ("Course", "course", "title", "title"),
            ],
            link_specs=[
                dict(prop="teaches", mapping="compsci-teaching", table="teaching", mode="row"),
                dict(prop="attends", mapping="compsci-registration", table="course_registration", mode="row"),
            ],
        ),
        "mathsci": Source(
            name="mathsci", dialect="pgsql", tables={},
            entity_tables={
                "person": dict(cls="Person", pk="pid", base=VOC + "mathsci/person/", shadow="person_unmapped"),
                "course": dict(cls="Course", pk="cid", base=VOC + "mathsci/course/", shadow="course_unmapped"),
            },
            literal_cols=[
                ("Person", "person", "fname", "firstName"),
                ("Person", "person", "lname", "lastName"),
                ("Course", "course", "topic", "title"),
            ],
            link_specs=[
                dict(prop="attends", mapping="mathsci-registration", table="registration", mode="row"),
                dict(prop="givesLecture", mapping="mathsci-lecturer", table="course", mode="col", col="lecturer"),
                dict(prop="givesLab", mapping="mathsci-lab-teacher", table="course", mode="col", col="lab_teacher"),
            ],
        ),
        "academics": Source(
            name="academics", dialect="mssql", tables={},
            entity_tables={
                "course":    dict(cls="Course",        pk="c_id",     base=VOC + "academics/course/",   shadow="course_unmapped"),
                "teacher":   dict(cls="FacultyMember", pk="t_id",     base=VOC + "academics/teacher/",  shadow="teacher_unmapped"),
                "place":     dict(cls="Place",         pk="place_id", base=VOC + "academics/place/",    shadow="place_unmapped"),
                "time_slot": dict(cls="TimeSlot",      pk="ts_id",    base=VOC + "academics/timeslot/", shadow="time_slot_unmapped"),
            },
            literal_cols=[
                ("FacultyMember", "teacher", "first_name", "firstName"),
                ("FacultyMember", "teacher", "last_name", "lastName"),
                ("Course", "course", "title", "title"),
                ("Place", "place", "building", "building"),
                ("Place", "place", "room_code", "roomCode"),
                ("TimeSlot", "time_slot", "day", "day"),
                ("TimeSlot", "time_slot", "start_time", "startTime"),
                ("TimeSlot", "time_slot", "end_time", "endTime"),
            ],
            link_specs=[
                dict(prop="teaches", mapping="academics-teaching", table="teaching", mode="row"),
                # one schedule row yields two links (isScheduledAt + isScheduledOn);
                # removing the row removes both.
                dict(prop="isScheduledAt/On", mapping="academics-schedule-place|academics-schedule-time",
                     table="schedule", mode="row", links_per_row=2),
            ],
        ),
    }


# Column metadata per table (order matters for emission).
SCHEMA = {
    "compsci": {
        "academic": (["a_id", "first_name", "last_name", "position"],
                     {"a_id": "int", "first_name": "str", "last_name": "str", "position": "int"}, ["a_id"]),
        "course": (["c_id", "title"], {"c_id": "int", "title": "str"}, ["c_id"]),
        "student": (["s_id", "first_name", "last_name"],
                    {"s_id": "int", "first_name": "str", "last_name": "str"}, ["s_id"]),
        "course_registration": (["c_id", "s_id"], {"c_id": "int", "s_id": "int"}, []),
        "teaching": (["c_id", "a_id"], {"c_id": "int", "a_id": "int"}, []),
    },
    "mathsci": {
        "person": (["pid", "fname", "lname", "status"],
                   {"pid": "int", "fname": "str", "lname": "str", "status": "int"}, ["pid"]),
        "course": (["cid", "lecturer", "lab_teacher", "topic"],
                   {"cid": "int", "lecturer": "int", "lab_teacher": "int", "topic": "str"}, ["cid"]),
        "registration": (["pid", "cid"], {"pid": "int", "cid": "int"}, []),
    },
    "academics": {
        "course": (["c_id", "title"], {"c_id": "int", "title": "str"}, ["c_id"]),
        "teacher": (["t_id", "first_name", "last_name", "position"],
                    {"t_id": "int", "first_name": "str", "last_name": "str", "position": "int"}, ["t_id"]),
        "place": (["place_id", "building", "room_code"],
                  {"place_id": "int", "building": "str", "room_code": "str"}, ["place_id"]),
        "time_slot": (["ts_id", "day", "start_time", "end_time"],
                      {"ts_id": "int", "day": "str", "start_time": "time", "end_time": "time"}, ["ts_id"]),
        "teaching": (["c_id", "t_id"], {"c_id": "int", "t_id": "int"}, []),
        "schedule": (["c_id", "place_id", "ts_id"],
                     {"c_id": "int", "place_id": "int", "ts_id": "int"}, ["c_id", "place_id", "ts_id"]),
    },
}

# Literal columns that become nullable in the defected DDL (attribute pool) and FK
# columns that become nullable (interlinking pool, 'col' links).
NULLABLE_COLS = {
    "compsci": {"student": ["first_name", "last_name"], "academic": ["first_name", "last_name"], "course": ["title"]},
    "mathsci": {"person": ["fname", "lname"], "course": ["topic", "lecturer", "lab_teacher"]},
    "academics": {"teacher": ["first_name", "last_name"], "course": ["title"],
                  "place": ["building", "room_code"], "time_slot": ["day", "start_time", "end_time"]},
}

# Mapping declarations that must never be dropped (would wipe an entire base class) so the
# four dimensions stay interpretable. Everything else is fair game for the mapping pool.
CORE_MAPPINGS = {
    "compsci-student", "compsci-academic", "compsci-course",
    "mathsci-person", "mathsci-course",
    "academics-teacher", "academics-course", "academics-place", "academics-timeslot",
}


# ──────────────────────────────────────────────────────────────────────────────
# Parse baselines
# ──────────────────────────────────────────────────────────────────────────────
def parse_baselines() -> dict[str, Source]:
    srcs = build_sources()
    files = {"compsci": "compsci.sql", "mathsci": "mathsci.sql", "academics": "academics.sql"}
    for name, src in srcs.items():
        sql = open(os.path.join(PLAN_DIR, files[name]), encoding="utf-8").read()
        for tname, (cols, types, pk) in SCHEMA[name].items():
            if src.dialect == "mysql":
                t = parse_mysql_table(sql, tname, cols, types, pk)
            elif src.dialect == "mssql":
                t = parse_mssql_table(sql, tname, cols, types, pk)
            else:
                t = parse_pg_table(sql, tname, cols, types, pk)
            src.tables[tname] = t
    return srcs


# ──────────────────────────────────────────────────────────────────────────────
# Defect injection
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class Ledger:
    level: int
    seed: int
    metric: str = ""
    population: dict = field(default_factory=dict)     # (src,table) -> moved count
    attribute: dict = field(default_factory=dict)      # (src,table,col) -> nulled count
    interlinking: dict = field(default_factory=dict)   # (src,prop) -> removed count
    mapping: list = field(default_factory=list)        # dropped mappingIds
    pools: dict = field(default_factory=dict)          # pool sizes


# For population removal: to drop an entity from `represented`, shadow its row AND remove the
# object-property links that would otherwise let Ontop infer its type back. Each tuple is
# (link_table, column, mode): 'del' deletes link rows where column == entity id, 'null' sets
# the column to NULL. (All link tables live in the same source as the entity.)
ENTITY_REFS: dict[tuple[str, str], list[tuple[str, str, str]]] = {
    ("compsci", "academic"): [("teaching", "a_id", "del")],
    ("compsci", "course"):   [("teaching", "c_id", "del"), ("course_registration", "c_id", "del")],
    ("compsci", "student"):  [("course_registration", "s_id", "del")],
    ("mathsci", "person"):   [("registration", "pid", "del"), ("course", "lecturer", "null"),
                              ("course", "lab_teacher", "null")],
    ("mathsci", "course"):   [("registration", "cid", "del")],
    ("academics", "course"): [("teaching", "c_id", "del"), ("schedule", "c_id", "del")],
    ("academics", "teacher"): [("teaching", "t_id", "del")],
    ("academics", "place"):   [("schedule", "place_id", "del")],
    ("academics", "time_slot"): [("schedule", "ts_id", "del")],
}

# Dedicated link rows / FK cells used for interlinking calibration (cut to make entities
# unlinked without removing them from `represented`).
LINK_ROW_TABLES = [("compsci", "teaching"), ("compsci", "course_registration"),
                   ("mathsci", "registration"), ("academics", "teaching"), ("academics", "schedule")]


def _pop_overall(srcs: dict[str, Source], specs: dict) -> float:
    rep = src = 0
    for _cls, groups in specs.items():
        for g in groups:
            ri: set = set()
            si: set = set()
            for b in g.branches:
                cols, rows, sh = _branch_lookup(srcs, b.table)
                kc = cols.index(b.key) if b.key in cols else None
                for r in rows:
                    if _where_ok(b.where, cols, r):
                        idv = r[kc] if kc is not None else None
                        if idv is None:
                            continue
                        si.add(idv)
                        if not sh:
                            ri.add(idv)
            rep += len(ri)
            src += len(si)
    return rep / src * 100 if src else 100.0


def _linked_sets(srcs: dict[str, Source]) -> dict[tuple[str, str], set]:
    def ids(s, table, col):
        t = srcs[s].tables[table]
        ci = t.cols.index(col)
        return {r[ci] for r in t.rows if r[ci] is not None}
    linked = {
        ("compsci", "academic"): ids("compsci", "teaching", "a_id"),
        ("compsci", "course"): ids("compsci", "teaching", "c_id") | ids("compsci", "course_registration", "c_id"),
        ("compsci", "student"): ids("compsci", "course_registration", "s_id"),
        ("mathsci", "person"): ids("mathsci", "registration", "pid") | ids("mathsci", "course", "lecturer") | ids("mathsci", "course", "lab_teacher"),
        ("academics", "course"): ids("academics", "teaching", "c_id") | ids("academics", "schedule", "c_id"),
        ("academics", "teacher"): ids("academics", "teaching", "t_id"),
        ("academics", "place"): ids("academics", "schedule", "place_id"),
        ("academics", "time_slot"): ids("academics", "schedule", "ts_id"),
    }
    # mathsci course is linked if it is in registration OR carries a lecturer/lab_teacher
    t = srcs["mathsci"].tables["course"]
    cid, le, lb = t.cols.index("cid"), t.cols.index("lecturer"), t.cols.index("lab_teacher")
    mc = ids("mathsci", "registration", "cid")
    mc |= {r[cid] for r in t.rows if r[le] is not None or r[lb] is not None}
    linked[("mathsci", "course")] = mc
    return linked


def _interlink_overall(srcs: dict[str, Source], specs: dict, base_home: dict) -> float:
    linked = _linked_sets(srcs)
    tot = lnk = 0
    for _cls, groups in specs.items():
        for g in groups:
            home = base_home.get(g.base)
            rep: set = set()
            for b in g.branches:
                cols, rows, sh = _branch_lookup(srcs, b.table)
                if sh:
                    continue
                kc = cols.index(b.key) if b.key in cols else None
                for r in rows:
                    if _where_ok(b.where, cols, r):
                        idv = r[kc] if kc is not None else None
                        if idv is not None:
                            rep.add(idv)
            L = linked.get(home, set()) if home else set()
            tot += len(rep)
            lnk += len(rep & L)
    return lnk / tot * 100 if tot else 100.0


def _remove_entity(srcs: dict[str, Source], source: str, table: str, pk, led: Ledger) -> None:
    """Shadow an entity row and cut all its object-property links (defeats type inference)."""
    src = srcs[source]
    t = src.tables[table]
    ci = t.cols.index(SCHEMA[source][table][2][0])
    row = next((r for r in t.rows if r[ci] == pk), None)
    if row is None:
        return
    t.rows.remove(row)
    shadow = src.entity_tables[table]["shadow"]
    src.tables[f"__shadow__{shadow}"].rows.append(row)
    led.population[f"{source}.{table}->{shadow}"] = led.population.get(f"{source}.{table}->{shadow}", 0) + 1
    for (ltab, lcol, mode) in ENTITY_REFS.get((source, table), []):
        lt = src.tables[ltab]
        lci = lt.cols.index(lcol)
        if mode == "del":
            lt.rows[:] = [r for r in lt.rows if r[lci] != pk]
        else:
            for r in lt.rows:
                if r[lci] == pk:
                    r[lci] = None


def _ensure_shadows(srcs: dict[str, Source]) -> None:
    for sname, src in srcs.items():
        for tname, meta in src.entity_tables.items():
            key = f"__shadow__{meta['shadow']}"
            if key not in src.tables:
                src.tables[key] = Table(meta["shadow"], _shadow_cols(src, meta["shadow"]),
                                        _shadow_types(src, meta["shadow"]), [], _shadow_pk(src, meta["shadow"]))


def inject(srcs: dict[str, Source], level: int, seed: int, metric: str, obda_path: str) -> tuple[dict[str, Source], Ledger]:
    """Per-metric calibrated injection. `metric` selects the single lever to apply so that
    that metric's OVERALL completeness is driven to (100−p)% while the others stay ~100%:
      population    → shadow entities (+cut their links) ; exact
      attribute     → NULL literal cells               ; exact
      interlinking  → cut object-property links        ; exact down to its ~97.8% baseline
      schema        → no data change; obda_path is the graded-reduced mapping (can't hit ladder)
    Isolating one metric per dataset avoids the population↔interlinking coupling (both contend
    for the same link tables)."""
    srcs = copy.deepcopy(srcs)
    led = Ledger(level=level, seed=seed)
    led.metric = metric
    target = 100 - level
    _ensure_shadows(srcs)
    specs = _load_pop_module()._build_specs(obda_path, TTL_PATH)
    base_home = {meta["base"]: (s, tb) for s, src in srcs.items()
                 for tb, meta in src.entity_tables.items()}

    if level > 0 and metric == "population":
        # shadow entities (and cut their links) until population overall = target
        units = []
        for s, src in srcs.items():
            for tb in src.entity_tables:
                ci = src.tables[tb].cols.index(SCHEMA[s][tb][2][0])
                units += [(s, tb, r[ci]) for r in src.tables[tb].rows]
        rng = DetRandom(f"{seed}|{level}|population")
        order = [units[i] for i in rng.sample_indices(len(units), len(units))]
        for (s, tb, pk) in order:
            if _pop_overall(srcs, specs) <= target:
                break
            _remove_entity(srcs, s, tb, pk, led)

    elif level > 0 and metric == "interlinking":
        # cut dedicated link rows / FK cells until interlinking overall = target
        # (entities stay typed → population stays 100%)
        link_units: list = []
        for (s, tb) in LINK_ROW_TABLES:
            for r in srcs[s].tables[tb].rows:
                link_units.append(("row", s, tb, r, None))
        ct = srcs["mathsci"].tables["course"]
        le, lb = ct.cols.index("lecturer"), ct.cols.index("lab_teacher")
        for r in ct.rows:
            if r[le] is not None:
                link_units.append(("col", "mathsci", "course", r, "lecturer"))
            if r[lb] is not None:
                link_units.append(("col", "mathsci", "course", r, "lab_teacher"))
        rng = DetRandom(f"{seed}|{level}|interlinking")
        order = [link_units[i] for i in rng.sample_indices(len(link_units), len(link_units))]
        for inst in order:
            if _interlink_overall(srcs, specs, base_home) <= target:
                break
            kind, s, tb, row, col = inst
            trows = srcs[s].tables[tb].rows
            if kind == "row":
                try:
                    trows.remove(row)
                except ValueError:
                    continue
                led.interlinking[f"{s}.{tb}"] = led.interlinking.get(f"{s}.{tb}", 0) + 1
            else:
                ci = srcs[s].tables[tb].cols.index(col)
                if row[ci] is not None:
                    row[ci] = None
                    led.interlinking[f"{s}.{tb}.{col}"] = led.interlinking.get(f"{s}.{tb}.{col}", 0) + 1

    elif level > 0 and metric == "attribute":
        # NULL exactly (100−target)% of EACH literal column, so every data property — and
        # therefore every class's matrix "Overall Completeness" — reads exactly target%.
        for s, src in srcs.items():
            for (_cls, tb, col, _prop) in src.literal_cols:
                t = src.tables[tb]
                ci = t.cols.index(col)
                idxs = [i for i, r in enumerate(t.rows) if r[ci] is not None]
                k = len(idxs) - round(target / 100 * len(idxs))
                rng = DetRandom(f"{seed}|{level}|attribute|{s}.{tb}.{col}")
                for j in rng.sample_indices(len(idxs), k):
                    t.rows[idxs[j]][ci] = None
                    led.attribute[f"{s}.{tb}.{col}"] = led.attribute.get(f"{s}.{tb}.{col}", 0) + 1
    # metric == "schema": no data change; the graded mapping drop is in obda_path

    led.pools = {
        "metric": metric,
        "target_completeness": target,
        "population_overall": round(_pop_overall(srcs, specs), 2),
        "interlinking_overall": round(_interlink_overall(srcs, specs, base_home), 2),
    }
    return srcs, led


def _entity_table_for_shadow(src: Source, shadow: str) -> str:
    for tname, meta in src.entity_tables.items():
        if meta["shadow"] == shadow:
            return tname
    raise KeyError(shadow)


def _shadow_cols(src: Source, shadow: str) -> list[str]:
    return list(SCHEMA[src.name][_entity_table_for_shadow(src, shadow)][0])


def _shadow_types(src: Source, shadow: str) -> dict:
    return dict(SCHEMA[src.name][_entity_table_for_shadow(src, shadow)][1])


def _shadow_pk(src: Source, shadow: str) -> list[str]:
    return list(SCHEMA[src.name][_entity_table_for_shadow(src, shadow)][2])


# ──────────────────────────────────────────────────────────────────────────────
# SQL value emission
# ──────────────────────────────────────────────────────────────────────────────
def sqlval(v, typ: str) -> str:
    if v is None:
        return "NULL"
    if typ == "int":
        return str(int(v))
    return "'" + str(v).replace("'", "''") + "'"


def col_decl_mysql(col: str, typ: str, table: str, src_name: str, pk: list[str]) -> str:
    sqltype = {"int": "int", "str": "varchar(255)"}[typ]
    # use precise varchar widths matching the baseline where it matters
    width = _varchar_width(src_name, table, col)
    if typ == "str":
        sqltype = f"varchar({width})"
    nullable = col in NULLABLE_COLS.get(src_name, {}).get(table, [])
    notnull = "" if nullable else " NOT NULL"
    return f"  `{col}` {sqltype}{notnull}"


def _varchar_width(src_name: str, table: str, col: str) -> int:
    widths = {
        ("compsci", "academic", "first_name"): 40, ("compsci", "academic", "last_name"): 40,
        ("compsci", "course", "title"): 100,
        ("compsci", "student", "first_name"): 40, ("compsci", "student", "last_name"): 40,
        ("mathsci", "person", "fname"): 40, ("mathsci", "person", "lname"): 40,
        ("mathsci", "course", "topic"): 100,
        ("academics", "teacher", "first_name"): 40, ("academics", "teacher", "last_name"): 40,
        ("academics", "course", "title"): 100,
        ("academics", "place", "building"): 100, ("academics", "place", "room_code"): 20,
        ("academics", "time_slot", "day"): 10,
    }
    return widths.get((src_name, table, col), 100)


# ── MySQL emitter ──────────────────────────────────────────────────────────────
def emit_mysql(src: Source) -> str:
    out = ["-- ============================================================",
           "-- compsci (MySQL) — DEFECTED dataset (generated by inject_defects.py)",
           "-- ============================================================",
           "SET FOREIGN_KEY_CHECKS=0;", ""]

    def create(table: str, cols, types, pk):
        lines = [f"DROP TABLE IF EXISTS `{table}`;", f"CREATE TABLE `{table}` ("]
        decls = [col_decl_mysql(c, types[c], table, src.name, pk) for c in cols]
        if pk:
            decls.append("  PRIMARY KEY (" + ", ".join(f"`{c}`" for c in pk) + ")")
        lines.append(",\n".join(decls))
        lines.append(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;")
        return "\n".join(lines)

    def inserts(table: str, t: Table):
        if not t.rows:
            return f"-- (no rows in {table})"
        body = []
        for r in t.rows:
            vals = ", ".join(sqlval(v, t.types[c]) for v, c in zip(r, t.cols))
            body.append(f"({vals})")
        return (f"INSERT INTO `{table}` (" + ", ".join(f"`{c}`" for c in t.cols) + ") VALUES\n"
                + ",\n".join(body) + ";")

    # mapped tables (entities first, then links)
    order = ["academic", "course", "student", "course_registration", "teaching"]
    for tname in order:
        cols, types, pk = SCHEMA["compsci"][tname]
        out.append(create(tname, cols, types, pk))
        out.append(inserts(tname, src.tables[tname]))
        out.append("")
    # shadow tables
    for tname, meta in src.entity_tables.items():
        shadow = meta["shadow"]
        st = src.tables[f"__shadow__{shadow}"]
        out.append(create(shadow, st.cols, st.types, st.pk))
        out.append(inserts(shadow, st))
        out.append("")
    out.append("SET FOREIGN_KEY_CHECKS=1;")
    return "\n".join(out) + "\n"


# ── PostgreSQL emitter ───────────────────────────────────────────────────────
def emit_pgsql(src: Source) -> str:
    out = ["--", "-- mathsci (PostgreSQL) — DEFECTED dataset (generated by inject_defects.py)", "--",
           "SET client_encoding = 'UTF8';", "SET standard_conforming_strings = on;",
           "SET client_min_messages = warning;", ""]

    def pgtype(table, col, typ):
        if typ == "int":
            return "integer"
        return f"character varying({_varchar_width('mathsci', table, col)})"

    def create(table, cols, types, pk):
        lines = [f"DROP TABLE IF EXISTS public.{table};", f"CREATE TABLE public.{table} ("]
        decls = []
        for c in cols:
            nullable = c in NULLABLE_COLS["mathsci"].get(table, [])
            notnull = "" if nullable else " NOT NULL"
            decls.append(f"    {c} {pgtype(table, c, types[c])}{notnull}")
        if pk:
            decls.append("    PRIMARY KEY (" + ", ".join(pk) + ")")
        lines.append(",\n".join(decls))
        lines.append(");")
        return "\n".join(lines)

    def inserts(table, t: Table):
        if not t.rows:
            return f"-- (no rows in {table})"
        body = []
        for r in t.rows:
            vals = ", ".join(sqlval(v, t.types[c]) for v, c in zip(r, t.cols))
            body.append(f"({vals})")
        return (f"INSERT INTO public.{table} (" + ", ".join(t.cols) + ") VALUES\n"
                + ",\n".join(body) + ";")

    order = ["person", "course", "registration"]
    for tname in order:
        cols, types, pk = SCHEMA["mathsci"][tname]
        out.append(create(tname, cols, types, pk))
        out.append(inserts(tname, src.tables[tname]))
        out.append("")
    for tname, meta in src.entity_tables.items():
        shadow = meta["shadow"]
        st = src.tables[f"__shadow__{shadow}"]
        out.append(create(shadow, st.cols, st.types, st.pk))
        out.append(inserts(shadow, st))
        out.append("")
    return "\n".join(out) + "\n"


# ── MSSQL emitter ──────────────────────────────────────────────────────────────
def emit_mssql(src: Source) -> str:
    out = ["-- ============================================================",
           "-- academics (Microsoft SQL Server) — DEFECTED dataset (generated by inject_defects.py)",
           "-- ============================================================", ""]

    def mssqltype(table, col, typ):
        if typ == "int":
            return "INT"
        if typ == "time":
            return "TIME"
        return f"VARCHAR({_varchar_width('academics', table, col)})"

    drop_order = ["schedule", "teaching", "time_slot", "place", "teacher", "course"]
    shadow_tables = [meta["shadow"] for meta in src.entity_tables.values()]
    for t in drop_order + shadow_tables:
        out.append(f"IF OBJECT_ID('{t}', 'U') IS NOT NULL DROP TABLE {t};")
    out.append("GO\n")

    def create(table, cols, types, pk):
        lines = [f"CREATE TABLE {table} ("]
        decls = []
        for c in cols:
            nullable = c in NULLABLE_COLS["academics"].get(table, [])
            notnull = "" if nullable else " NOT NULL"
            decls.append(f"    {c} {mssqltype(table, c, types[c])}{notnull}")
        if pk:
            decls.append(f"    CONSTRAINT pk_{table} PRIMARY KEY (" + ", ".join(pk) + ")")
        lines.append(",\n".join(decls))
        lines.append(");")
        return "\n".join(lines)

    def inserts(table, t: Table):
        if not t.rows:
            return f"-- (no rows in {table})"
        rows = []
        for r in t.rows:
            vals = ", ".join(sqlval(v, t.types[c]) for v, c in zip(r, t.cols))
            rows.append(f"INSERT INTO {table} VALUES ({vals});")
        return "\n".join(rows)

    create_order = ["course", "teacher", "place", "time_slot", "teaching", "schedule"]
    for tname in create_order:
        cols, types, pk = SCHEMA["academics"][tname]
        out.append(create(tname, cols, types, pk))
        out.append("GO\n")
        out.append(inserts(tname, src.tables[tname]))
        out.append("GO\n")
    for tname, meta in src.entity_tables.items():
        shadow = meta["shadow"]
        st = src.tables[f"__shadow__{shadow}"]
        out.append(create(shadow, st.cols, st.types, st.pk))
        out.append("GO\n")
        out.append(inserts(shadow, st))
        out.append("GO\n")
    return "\n".join(out) + "\n"


EMITTERS = {"mysql": emit_mysql, "pgsql": emit_pgsql, "mssql": emit_mssql}
DIALECT_DIR = {"mysql": "mysql", "pgsql": "pgsql", "mssql": "mssql"}
DIALECT_FILE = {"compsci": "compsci.sql", "mathsci": "mathsci.sql", "academics": "academics.sql"}


# ──────────────────────────────────────────────────────────────────────────────
# OBDA mapping reduction
# ──────────────────────────────────────────────────────────────────────────────
def split_obda(text: str) -> tuple[str, list[tuple[str, str]], str]:
    """Return (header_incl_open_bracket, [(mappingId, block_text)], footer)."""
    open_idx = text.index("[[") + 2
    close_idx = text.rindex("]]")
    header = text[:open_idx]
    footer = text[close_idx:]
    body = text[open_idx:close_idx]
    blocks: list[tuple[str, str]] = []
    parts = re.split(r"(?m)^(?=mappingId\s)", body)
    for part in parts:
        m = re.match(r"mappingId\s+(\S+)", part)
        if m:
            blocks.append((m.group(1), part))
    return header, blocks, footer


def reduce_obda(text: str, level: int, seed: int) -> tuple[str, list[str], dict]:
    header, blocks, footer = split_obda(text)
    ids = [mid for mid, _ in blocks]
    droppable = [mid for mid in ids if mid not in CORE_MAPPINGS]
    k = pct_count(len(ids), level)
    rng = DetRandom(f"{seed}|{level}|mapping")
    drop_idx = rng.sample_indices(len(droppable), min(k, len(droppable)))
    dropped = {droppable[i] for i in drop_idx}
    kept_blocks = [(mid, blk) for mid, blk in blocks if mid not in dropped]
    new_body = "".join(blk for _, blk in kept_blocks)
    new_text = header + "\n" + new_body + footer
    coverage = obda_coverage(blocks, dropped)
    return new_text, sorted(dropped), coverage


def obda_coverage(blocks: list[tuple[str, str]], dropped: set) -> dict:
    """Mapped classes/properties before vs after, derived from mapping targets."""
    def parse_targets(blocks_subset):
        classes: set[str] = set()
        props: set[str] = set()
        for _mid, blk in blocks_subset:
            tgt = " ".join(
                line.split("target", 1)[1].strip()
                for line in blk.splitlines() if line.strip().startswith("target")
            )
            # split predicate-object pairs on ';'
            stmts = tgt.rstrip(" .").split(";")
            first = stmts[0].split()
            # first[0] = subject template; rest pairs
            pairs = []
            if len(first) >= 3:
                pairs.append((first[1], first[2]))
            for s in stmts[1:]:
                toks = s.split()
                if len(toks) >= 2:
                    pairs.append((toks[0], toks[1]))
            for pred, obj in pairs:
                if pred in ("a", "rdf:type"):
                    classes.add(_localname(obj))
                else:
                    props.add(_localname(pred))
        return classes, props

    c_all, p_all = parse_targets(blocks)
    c_kept, p_kept = parse_targets([(m, b) for m, b in blocks if m not in dropped])
    return {
        "mapped_classes_before": sorted(c_all),
        "mapped_classes_after": sorted(c_kept),
        "mapped_classes_lost": sorted(c_all - c_kept),
        "mapped_properties_before": sorted(p_all),
        "mapped_properties_after": sorted(p_kept),
        "mapped_properties_lost": sorted(p_all - p_kept),
    }


def _localname(tok: str) -> str:
    tok = tok.strip()
    tok = tok.split("{")[0]
    if tok.startswith("ex:voc#"):
        tok = tok[len("ex:voc#"):]
    elif ":" in tok:
        tok = tok.split(":", 1)[1]
    return tok.split("/")[-1].split("#")[-1]


# ──────────────────────────────────────────────────────────────────────────────
# Manifest (ground truth)
#
# Computed exactly the way the dashboard sees it: we reuse the backend's own
# `app.population._build_specs`, which rolls each class up over the ontology subclass
# hierarchy (so e.g. :Student includes mathsci UndergraduateStudent/GraduateStudent, and
# foaf:Person includes everyone). The level's *reduced* OBDA is fed in, so dropped
# mappings automatically remove the corresponding classes/links from the expectations.
# ──────────────────────────────────────────────────────────────────────────────
TTL_PATH = os.path.join(ROOT, "vkg", "obda", "university.ttl")
_pop_module = None


def _load_pop_module():
    global _pop_module
    if _pop_module is None:
        import sys as _sys
        backend = os.path.join(ROOT, "backend")
        if backend not in _sys.path:
            _sys.path.insert(0, backend)
        os.environ["DEFECT_SHADOW_SOURCES"] = "1"  # expose the *_unmapped shadow branches
        import app.population as P
        _pop_module = P
    return _pop_module


def _literal_index(srcs: dict[str, Source]) -> dict[tuple[str, str], list[tuple[str, str]]]:
    idx: dict[tuple[str, str], list[tuple[str, str]]] = {}
    for sname, src in srcs.items():
        for (_cls, table, col, prop) in src.literal_cols:
            idx.setdefault((sname, table), []).append((col, prop))
    return idx


def _branch_lookup(srcs: dict[str, Source], branch_table: str):
    """'source.table' -> (cols, rows, is_shadow) against the defected in-memory data."""
    source, table = branch_table.split(".", 1)
    src = srcs.get(source)
    if src is None:
        return [], [], False
    if table in SCHEMA[source]:
        t = src.tables[table]
        return t.cols, t.rows, False
    shadow_key = f"__shadow__{table}"
    if shadow_key in src.tables:
        t = src.tables[shadow_key]
        return t.cols, t.rows, True
    return [], [], False


_WHERE_RE = re.compile(r"\s*(\w+)\s*=\s*(\d+)\s*$")


def _where_ok(where: str | None, cols: list[str], row: list) -> bool:
    if not where:
        return True
    m = _WHERE_RE.match(where)
    if not m or m.group(1) not in cols:
        return True
    return row[cols.index(m.group(1))] == int(m.group(2))


def _ln(uri: str) -> str:
    return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]


def build_manifest(srcs: dict[str, Source], led: Ledger, dropped_maps: list[str],
                   coverage: dict, reduced_obda_path: str) -> dict:
    baseline = parse_baselines()
    P = _load_pop_module()
    specs = P._build_specs(reduced_obda_path, TTL_PATH)
    lit_idx = _literal_index(srcs)

    # population.py's `_build_specs` builds, per class C, the exact set of source branches
    # Ontop would type as C — including subclass rollup (UndergraduateStudent ⊆ Student) AND
    # property domain/range inference (a `teaching` subject is inferred a Teacher ⊆
    # FacultyMember). So:
    #   represented(C) = distinct ids over C's NON-shadow branches  (== SPARQL `?e a C`)
    #   source(C)      = distinct ids over ALL branches (adds the unmapped shadow rows)
    # Each subject's *home* entity table (by its URI base) is where its literal values live,
    # so attribute completeness reads literals there even when the subject was inferred into
    # the class via a different table's object property (e.g. a course lecturer → Teacher).
    pk_index: dict[tuple[str, str], dict] = {}
    for sname, src in srcs.items():
        for table, (cols, _types, pk) in SCHEMA[sname].items():
            if len(pk) == 1:
                t = src.tables[table]
                ci = t.cols.index(pk[0])
                pk_index[(sname, table)] = {r[ci]: r for r in t.rows}
    base_home: dict[str, tuple[str, str]] = {}
    for sname, src in srcs.items():
        for table, meta in src.entity_tables.items():
            base_home[meta["base"]] = (sname, table)

    pop: dict[str, dict] = {}
    represented_by_class: dict[str, int] = {}
    rep_ids_by_class: dict[str, list[tuple[str, set]]] = {}
    for cls_uri, groups in specs.items():
        rep_total = src_total = 0
        by_source = []
        for g in groups:
            rep_ids: set = set()
            src_ids: set = set()
            for b in g.branches:
                cols, rows, is_shadow = _branch_lookup(srcs, b.table)
                kc = cols.index(b.key) if b.key in cols else None
                for r in rows:
                    if _where_ok(b.where, cols, r):
                        idv = r[kc] if kc is not None else None
                        if idv is None:
                            continue  # Ontop emits no subject for a NULL URI-template value
                        src_ids.add(idv)
                        if not is_shadow:
                            rep_ids.add(idv)
            rep_total += len(rep_ids)
            src_total += len(src_ids)
            rep_ids_by_class.setdefault(cls_uri, []).append((g.base, rep_ids))
            by_source.append({"base": g.base, "represented": len(rep_ids),
                              "source_population": len(src_ids)})
        represented_by_class[cls_uri] = rep_total
        pop[_ln(cls_uri)] = {
            "represented": rep_total,
            "source_population": src_total,
            "missing": max(src_total - rep_total, 0),
            "completeness": round(rep_total / src_total * 100, 2) if src_total else 100.0,
            "by_source": by_source,
        }

    # ---- attribute: each represented entity's literal read from its home table -----
    # Denominator is represented(C); an entity inferred into C with no home row (e.g. a
    # shadowed academic still referenced by `teaching`) correctly counts as missing.
    attr: dict[str, dict] = {}
    for cls_uri, groups in specs.items():
        rep_total = represented_by_class[cls_uri]
        prop_filled: dict[str, int] = {}
        for base, ids in rep_ids_by_class.get(cls_uri, []):
            home = base_home.get(base)
            if home is None:
                continue
            cols = SCHEMA[home[0]][home[1]][0]
            idx = pk_index.get(home, {})
            for (col, prop) in lit_idx.get(home, []):
                ci = cols.index(col)
                filled = sum(1 for i in ids
                             if (row := idx.get(i)) is not None and row[ci] is not None)
                prop_filled[prop] = prop_filled.get(prop, 0) + filled
        if prop_filled and rep_total:
            attr[_ln(cls_uri)] = {
                "total_entities": rep_total,
                "properties": {
                    prop: {"total": rep_total, "filled": f, "missing": rep_total - f,
                           "completeness": round(f / rep_total * 100, 2)}
                    for prop, f in sorted(prop_filled.items())
                },
            }

    # ---- interlinking: per object property, links remaining vs baseline ---------
    # baseline = true clean state (full data, full mappings); remaining = final data
    # AND the level's reduced OBDA (a dropped mapping removes the link entirely).
    def count_links(source_set: dict[str, Source], apply_drops: bool) -> dict[str, int]:
        counts: dict[str, int] = {}
        for sname, src in source_set.items():
            for spec in src.link_specs:
                t = src.tables[spec["table"]]
                lpr = spec.get("links_per_row", 1)
                if spec["mode"] == "row":
                    n = len(t.rows) * lpr
                else:
                    ci = t.ci(spec["col"])
                    n = sum(1 for r in t.rows if r[ci] is not None)
                key = f"{sname}:{spec['prop']}"
                if apply_drops and any(m in dropped_maps for m in spec["mapping"].split("|")):
                    n = 0
                counts[key] = counts.get(key, 0) + n
        return counts

    base_links = count_links(baseline, apply_drops=False)
    now_links = count_links(srcs, apply_drops=True)
    inter = {}
    for key in sorted(base_links):
        inter[key] = {
            "baseline_links": base_links[key],
            "remaining_links": now_links.get(key, 0),
            "removed": base_links[key] - now_links.get(key, 0),
        }

    pop_rep = sum(e["represented"] for e in pop.values())
    pop_src = sum(e["source_population"] for e in pop.values())
    af = sum(p["filled"] for c in attr.values() for p in c["properties"].values())
    at = sum(p["total"] for c in attr.values() for p in c["properties"].values())
    overall = {
        "population_completeness": round(pop_rep / pop_src * 100, 2) if pop_src else 100.0,
        "attribute_completeness": round(af / at * 100, 2) if at else 100.0,
        "interlinking_completeness": led.pools.get("interlinking_overall"),
        "schema_classes_mapped": f"{len(coverage['mapped_classes_after'])} mapped (was {len(coverage['mapped_classes_before'])})",
        "schema_properties_mapped": f"{len(coverage['mapped_properties_after'])} mapped (was {len(coverage['mapped_properties_before'])})",
    }

    return {
        "level_pct": led.level,
        "seed": led.seed,
        "target_completeness": 100 - led.level,
        "pools": led.pools,
        "ledger": {
            "population_moved": led.population,
            "attribute_nulled": led.attribute,
            "interlinking_removed": led.interlinking,
            "mappings_dropped": dropped_maps,
        },
        "expected": {
            "overall": overall,
            "attribute": attr,
            "population": pop,
            "interlinking": inter,
            "mapping_coverage": coverage,
        },
    }


def manifest_md(man: dict) -> str:
    p = man["level_pct"]
    lines = [f"# Defect manifest — level {p}%", "",
             f"Seed: `{man['seed']}` · pools: " +
             ", ".join(f"{k}={v}" for k, v in man["pools"].items()), "",
             "This file is the **ground truth** for the correctness evaluation. Each section "
             "below is what the dashboard should report when this level is loaded.", ""]

    ov = man["expected"]["overall"]
    lines += [f"## Overall completeness (target = {man['target_completeness']}%)", "",
              f"- **Population**: {ov['population_completeness']}%",
              f"- **Attribute**: {ov['attribute_completeness']}%",
              f"- **Interlinking**: {ov['interlinking_completeness']}%",
              f"- **Schema/mapping** (graded, cannot hit the ladder): "
              f"classes {ov['schema_classes_mapped']}, properties {ov['schema_properties_mapped']}",
              ""]

    lines += ["## Attribute completeness (literal property values)", "",
              "| Class | Property | Total | Filled | Missing | Completeness % |",
              "|---|---|---:|---:|---:|---:|"]
    for cls, e in sorted(man["expected"]["attribute"].items()):
        for prop, pe in sorted(e["properties"].items()):
            lines.append(f"| {cls} | {prop} | {pe['total']} | {pe['filled']} | "
                         f"{pe['missing']} | {pe['completeness']} |")

    lines += ["", "## Population completeness (represented vs expected source)", "",
              "| Class | Represented | Source pop. | Missing | Completeness % |",
              "|---|---:|---:|---:|---:|"]
    for cls, e in sorted(man["expected"]["population"].items()):
        lines.append(f"| {cls} | {e['represented']} | {e['source_population']} | "
                     f"{e['missing']} | {e['completeness']} |")

    lines += ["", "## Interlinking completeness (object-property links)", "",
              "| Source : property | Baseline | Remaining | Removed |",
              "|---|---:|---:|---:|"]
    for key, e in man["expected"]["interlinking"].items():
        lines.append(f"| {key} | {e['baseline_links']} | {e['remaining_links']} | {e['removed']} |")

    cov = man["expected"]["mapping_coverage"]
    lines += ["", "## Schema / mapping coverage", "",
              f"- Dropped mappings: `{', '.join(man['ledger']['mappings_dropped']) or '(none)'}`",
              f"- Classes lost: `{', '.join(cov['mapped_classes_lost']) or '(none)'}`",
              f"- Properties lost: `{', '.join(cov['mapped_properties_lost']) or '(none)'}`",
              f"- Mapped classes: {len(cov['mapped_classes_after'])} / {len(cov['mapped_classes_before'])}",
              f"- Mapped properties: {len(cov['mapped_properties_after'])} / {len(cov['mapped_properties_before'])}",
              ""]
    return "\n".join(lines) + "\n"


# ──────────────────────────────────────────────────────────────────────────────
# Driver
# ──────────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument(
        "--levels",
        help="Comma-separated defect percentages to generate, e.g. '7' or '0,2,5,7,10,20'. "
        f"Default: {','.join(map(str, LEVELS))}.",
    )
    args = ap.parse_args()

    levels = LEVELS if not args.levels else sorted(
        {int(x) for x in re.split(r"[,\s]+", args.levels.strip()) if x}
    )

    baseline = parse_baselines()
    obda_text = open(OBDA_SRC, encoding="utf-8").read()

    print(f"Baseline parsed. Seed={args.seed}. Levels={levels}")
    for sname, src in baseline.items():
        counts = {t: len(src.tables[t].rows) for t in SCHEMA[sname]}
        print(f"  {sname}: {counts}")

    # Full mapping (no drops) reused by every non-schema metric variant.
    full_obda, _full_dropped, full_cov = reduce_obda(obda_text, 0, args.seed)

    for level in levels:
        tag = f"{level:02d}"
        print(f"  level {tag} (target {100-level}%):")
        for metric in METRICS:
            if metric == "schema":
                obda_text_v, dropped, coverage = reduce_obda(obda_text, level, args.seed)
            else:
                obda_text_v, dropped, coverage = full_obda, [], full_cov

            obda_dir = os.path.join(OBDA_OUT_DIR, f"level_{tag}", metric)
            os.makedirs(obda_dir, exist_ok=True)
            obda_path = os.path.join(obda_dir, "university.obda")
            with open(obda_path, "w", encoding="utf-8") as f:
                f.write(obda_text_v)

            srcs, led = inject(baseline, level, args.seed, metric, obda_path)
            man = build_manifest(srcs, led, dropped, coverage, obda_path)

            for sname, src in srcs.items():
                ddir = os.path.join(OUT_DIR, f"level_{tag}", metric, DIALECT_DIR[src.dialect])
                os.makedirs(ddir, exist_ok=True)
                with open(os.path.join(ddir, DIALECT_FILE[sname]), "w", encoding="utf-8") as f:
                    f.write(EMITTERS[src.dialect](src))

            mdir = os.path.join(OUT_DIR, f"level_{tag}", metric)
            with open(os.path.join(mdir, "manifest.json"), "w", encoding="utf-8") as f:
                json.dump(man, f, indent=2, ensure_ascii=False)
            with open(os.path.join(mdir, "MANIFEST.md"), "w", encoding="utf-8") as f:
                f.write(manifest_md(man))

            ov = man["expected"]["overall"]
            focus = {"population": f"{ov['population_completeness']}%",
                     "attribute": f"{ov['attribute_completeness']}%",
                     "interlinking": f"{ov['interlinking_completeness']}%",
                     "schema": f"classes {ov['schema_classes_mapped'].split()[0]}, props {ov['schema_properties_mapped'].split()[0]}"}[metric]
            print(f"      {metric:13} -> {focus}")
    print("Done.")


if __name__ == "__main__":
    main()
