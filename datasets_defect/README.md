# Graded completeness-defect datasets

Reproducible, seeded defect datasets for the **correctness evaluation** of the VKG profiling
dashboard. The clean baseline in [`../datasets_plan/`](../datasets_plan) is treated as 100%
complete; this directory contains copies degraded to five defect degrees.

**Design goal:** at level `p`, the targeted metric's **overall completeness reads `(100−p)%`**
on the dashboard. To make that possible each metric is degraded **in isolation** — population
and interlinking otherwise fight over the same link tables and can't both hit the target in
one dataset (degrading population necessarily severs shared links). So every level has four
independent sub-datasets:

```
datasets_defect/level_<L>/
  population/    → population overall   = (100−p)% ; attribute/interlinking 100%
  attribute/     → attribute overall    = (100−p)% ; population/interlinking 100%
  interlinking/  → interlinking overall = (100−p)% ; population/attribute 100%
  schema/        → mapping coverage degraded (graded; see caveat below)
each with mysql/ pgsql/ mssql/ SQL + manifest.json + MANIFEST.md
vkg/obda-defected/level_<L>/<metric>/university.obda
```

Levels: `00` (control), `02`, `05`, `10`, `20` → targets `100, 98, 95, 90, 80%`.

All files are **generated**, never hand-edited: `make gen-defects` (`python3
scripts/inject_defects.py`), fixed seed `2025`, byte-for-byte reproducible.

## How each metric is calibrated to the target

| Metric | Lever (applied alone) | Calibration |
|---|---|---|
| **Population** | shadow entities into `*_unmapped`/`legacy_student` **and** cut their links (so Ontop can't re-infer the type) until `represented/source` = target | exact (±rounding) |
| **Attribute** | NULL literal cells of represented entities until filled/total = target | exact (±~1%) |
| **Interlinking** | cut object-property link rows / FK cells until `linked/total` entities = target | exact **down to its 97.8% baseline** (level 0/2 sit at ~97.8%, can't exceed it) |
| **Schema** | drop `round(p%×32)` OBDA mappings (never the 9 core base-class mappings) | **graded only — cannot hit the ladder** |

### Why population needs shadow tables
`/completeness/population-summary` compares VKG-represented entities against a source count
queried live via Teiid from the **same mapped tables** (plus `EXTERNAL_SOURCE_TABLES`). Just
deleting rows drops both sides → 100%, hiding the defect. So population defects **move** rows
into unmapped shadow tables (counted as expected, not represented).

### Why schema can't be 80%
Mapping coverage = `(mapped classes + properties) / total in the ontology`. The ontology has
**18 classes, 20 properties**, of which only **13 + 15 = 73.7%** are mappable at all (the rest
— `Professor`, `Teacher`, `Researcher`, `isSupervisedBy`, … — have no source columns). So the
baseline is already below 80%, and 80% of 18 classes (14.4) isn't even an integer. The schema
dataset therefore just **degrades coverage step-by-step** and the manifest records the exact
resulting numbers — it is **not** on the `(100−p)%` ladder.

## Ground truth — the manifests

Each variant ships `manifest.json` + `MANIFEST.md`, computed from the **final generated
state** using the backend's own `app.population._build_specs` (so it mirrors the dashboard's
ontology subclass rollup + property domain/range inference). Validated to match the live
dashboard **exactly** (population & attribute per-class). Read against the dashboard:

- `expected.overall` → the headline `(100−p)%` for the focal metric.
- `expected.population` → `/completeness/population-summary` (`represented`/`source_population`/`completeness` per class).
- `expected.attribute` → `/completeness/class-summary` & `/completeness/by-property` (`filled`/`missing`/`completeness`).
- `expected.interlinking` → raw object-property link counts (the dashboard `/interlinking`
  page shows linked-entity ratios per class; compare against the ledger totals, not 1:1).
- `expected.mapping_coverage` → `/completeness/mapping-coverage` (classes/properties lost).

`make verify-defects` (`scripts/verify_manifest.py`) re-parses the generated SQL and asserts
it matches every manifest and that the focal overall hits its target — DB-free.

## Loading a dataset

Fully parallel to the clean stack (own DBs/Teiid/Ontop/API/frontend, distinct ports):

```bash
make up-defected   DEFECT_LEVEL=20 DEFECT_METRIC=population     # 80% population
make restart-defected DEFECT_LEVEL=20 DEFECT_METRIC=attribute   # switch dataset (wipes volumes)
make ps-defected ; make logs-defected
make down-defected
```

`DEFECT_METRIC ∈ {population, attribute, interlinking, schema}`. **Use `restart-defected` to
switch** — the DBs only run their init SQL on an empty volume.

| Service | URL |
|---|---|
| Defected API (Swagger) | http://localhost:8001/docs |
| Defected dashboard | http://localhost:5174 |
| Defected SPARQL (Ontop) | http://localhost:8089/sparql |

The defected API runs `METADATA_SOURCE=ontology`, `OBDA_FILE` = the chosen variant's mapping,
and `DEFECT_SHADOW_SOURCES=1` (switches on the `*_unmapped` shadow tables in
`backend/app/population.py`). The clean stack is untouched.

## Notes & scope

- Population & attribute hit the target exactly (±~1% from integer rounding); interlinking is
  capped at its 97.8% baseline; schema is graded/documented (not on the ladder).
- Core mappings (`compsci-student/academic/course`, `mathsci-person/course`,
  `academics-teacher/course/place/timeslot`) are never dropped, so a class is never wiped.
- Subtypes (FullProfessor, UndergraduateStudent, …) roll up into their base class via the
  ontology; the manifest reports every class as the dashboard does.
- FK constraints are dropped in the defected DDL (read-only profiling) and targeted literal /
  FK columns are made nullable so NULLs load.
- Scope is **completeness only** — accuracy/conciseness metrics are not targeted.
