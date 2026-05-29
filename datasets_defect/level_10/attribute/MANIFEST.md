# Defect manifest — level 10%

Seed: `2025` · pools: metric=attribute, target_completeness=90, population_overall=100.0, interlinking_overall=97.83

This file is the **ground truth** for the correctness evaluation. Each section below is what the dashboard should report when this level is loaded.

## Overall completeness (target = 90%)

- **Population**: 100.0%
- **Attribute**: 89.91%
- **Interlinking**: 97.83%
- **Schema/mapping** (graded, cannot hit the ladder): classes 13 mapped (was 13), properties 15 mapped (was 15)

## Attribute completeness (literal property values)

| Class | Property | Total | Filled | Missing | Completeness % |
|---|---|---:|---:|---:|---:|
| AssistantProfessor | firstName | 8 | 7 | 1 | 87.5 |
| AssistantProfessor | lastName | 8 | 7 | 1 | 87.5 |
| AssociateProfessor | firstName | 17 | 17 | 0 | 100.0 |
| AssociateProfessor | lastName | 17 | 15 | 2 | 88.24 |
| Course | title | 135 | 122 | 13 | 90.37 |
| ExternalTeacher | firstName | 7 | 6 | 1 | 85.71 |
| ExternalTeacher | lastName | 7 | 6 | 1 | 85.71 |
| FacultyMember | firstName | 74 | 67 | 7 | 90.54 |
| FacultyMember | lastName | 74 | 66 | 8 | 89.19 |
| FullProfessor | firstName | 34 | 31 | 3 | 91.18 |
| FullProfessor | lastName | 34 | 31 | 3 | 91.18 |
| GraduateStudent | firstName | 20 | 17 | 3 | 85.0 |
| GraduateStudent | lastName | 20 | 18 | 2 | 90.0 |
| Person | firstName | 874 | 786 | 88 | 89.93 |
| Person | lastName | 874 | 786 | 88 | 89.93 |
| Place | building | 18 | 16 | 2 | 88.89 |
| Place | roomCode | 18 | 16 | 2 | 88.89 |
| PostDoc | firstName | 5 | 3 | 2 | 60.0 |
| PostDoc | lastName | 5 | 4 | 1 | 80.0 |
| Student | firstName | 800 | 719 | 81 | 89.88 |
| Student | lastName | 800 | 720 | 80 | 90.0 |
| TimeSlot | day | 20 | 18 | 2 | 90.0 |
| TimeSlot | endTime | 20 | 18 | 2 | 90.0 |
| TimeSlot | startTime | 20 | 18 | 2 | 90.0 |
| UndergraduateStudent | firstName | 380 | 342 | 38 | 90.0 |
| UndergraduateStudent | lastName | 380 | 342 | 38 | 90.0 |

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

