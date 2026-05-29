# Defect manifest — level 5%

Seed: `2025` · pools: metric=attribute, target_completeness=95, population_overall=100.0, interlinking_overall=97.83

This file is the **ground truth** for the correctness evaluation. Each section below is what the dashboard should report when this level is loaded.

## Overall completeness (target = 95%)

- **Population**: 100.0%
- **Attribute**: 95.05%
- **Interlinking**: 97.83%
- **Schema/mapping** (graded, cannot hit the ladder): classes 13 mapped (was 13), properties 15 mapped (was 15)

## Attribute completeness (literal property values)

| Class | Property | Total | Filled | Missing | Completeness % |
|---|---|---:|---:|---:|---:|
| AssistantProfessor | firstName | 8 | 7 | 1 | 87.5 |
| AssistantProfessor | lastName | 8 | 8 | 0 | 100.0 |
| AssociateProfessor | firstName | 17 | 16 | 1 | 94.12 |
| AssociateProfessor | lastName | 17 | 14 | 3 | 82.35 |
| Course | title | 135 | 127 | 8 | 94.07 |
| ExternalTeacher | firstName | 7 | 7 | 0 | 100.0 |
| ExternalTeacher | lastName | 7 | 7 | 0 | 100.0 |
| FacultyMember | firstName | 74 | 72 | 2 | 97.3 |
| FacultyMember | lastName | 74 | 71 | 3 | 95.95 |
| FullProfessor | firstName | 34 | 34 | 0 | 100.0 |
| FullProfessor | lastName | 34 | 34 | 0 | 100.0 |
| GraduateStudent | firstName | 20 | 19 | 1 | 95.0 |
| GraduateStudent | lastName | 20 | 20 | 0 | 100.0 |
| Person | firstName | 874 | 831 | 43 | 95.08 |
| Person | lastName | 874 | 831 | 43 | 95.08 |
| Place | building | 18 | 17 | 1 | 94.44 |
| Place | roomCode | 18 | 17 | 1 | 94.44 |
| PostDoc | firstName | 5 | 5 | 0 | 100.0 |
| PostDoc | lastName | 5 | 5 | 0 | 100.0 |
| Student | firstName | 800 | 759 | 41 | 94.88 |
| Student | lastName | 800 | 760 | 40 | 95.0 |
| TimeSlot | day | 20 | 19 | 1 | 95.0 |
| TimeSlot | endTime | 20 | 19 | 1 | 95.0 |
| TimeSlot | startTime | 20 | 19 | 1 | 95.0 |
| UndergraduateStudent | firstName | 380 | 360 | 20 | 94.74 |
| UndergraduateStudent | lastName | 380 | 360 | 20 | 94.74 |

## Population completeness (represented vs expected source)

| Class | Represented | Source pop. | Missing | Completeness % |
|---|---:|---:|---:|---:|
| AssistantProfessor | 8 | 8 | 0 | 100.0 |
| AssociateProfessor | 17 | 17 | 0 | 100.0 |
| Course | 135 | 135 | 0 | 100.0 |
| ExternalTeacher | 7 | 7 | 0 | 100.0 |
| FacultyMember | 74 | 74 | 0 | 100.0 |
| FullProfessor | 34 | 34 | 0 | 100.0 |
| GraduateStudent | 20 | 20 | 0 | 100.0 |
| Person | 874 | 874 | 0 | 100.0 |
| Place | 18 | 18 | 0 | 100.0 |
| PostDoc | 5 | 5 | 0 | 100.0 |
| Student | 800 | 800 | 0 | 100.0 |
| TimeSlot | 20 | 20 | 0 | 100.0 |
| UndergraduateStudent | 380 | 380 | 0 | 100.0 |

## Interlinking completeness (object-property links)

| Source : property | Baseline | Remaining | Removed |
|---|---:|---:|---:|
| academics:isScheduledAt/On | 150 | 150 | 0 |
| academics:teaches | 75 | 75 | 0 |
| compsci:attends | 2000 | 2000 | 0 |
| compsci:teaches | 50 | 50 | 0 |
| mathsci:attends | 2000 | 2000 | 0 |
| mathsci:givesLab | 30 | 30 | 0 |
| mathsci:givesLecture | 30 | 30 | 0 |

## Schema / mapping coverage

- Dropped mappings: `(none)`
- Classes lost: `(none)`
- Properties lost: `(none)`
- Mapped classes: 13 / 13
- Mapped properties: 15 / 15

