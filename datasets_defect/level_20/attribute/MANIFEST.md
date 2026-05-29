# Defect manifest — level 20%

Seed: `2025` · pools: metric=attribute, target_completeness=80, population_overall=100.0, interlinking_overall=97.83

This file is the **ground truth** for the correctness evaluation. Each section below is what the dashboard should report when this level is loaded.

## Overall completeness (target = 80%)

- **Population**: 100.0%
- **Attribute**: 80.1%
- **Interlinking**: 97.83%
- **Schema/mapping** (graded, cannot hit the ladder): classes 13 mapped (was 13), properties 15 mapped (was 15)

## Attribute completeness (literal property values)

| Class | Property | Total | Filled | Missing | Completeness % |
|---|---|---:|---:|---:|---:|
| AssistantProfessor | firstName | 8 | 5 | 3 | 62.5 |
| AssistantProfessor | lastName | 8 | 5 | 3 | 62.5 |
| AssociateProfessor | firstName | 17 | 12 | 5 | 70.59 |
| AssociateProfessor | lastName | 17 | 9 | 8 | 52.94 |
| Course | title | 135 | 108 | 27 | 80.0 |
| ExternalTeacher | firstName | 7 | 7 | 0 | 100.0 |
| ExternalTeacher | lastName | 7 | 6 | 1 | 85.71 |
| FacultyMember | firstName | 74 | 59 | 15 | 79.73 |
| FacultyMember | lastName | 74 | 58 | 16 | 78.38 |
| FullProfessor | firstName | 34 | 29 | 5 | 85.29 |
| FullProfessor | lastName | 34 | 31 | 3 | 91.18 |
| GraduateStudent | firstName | 20 | 18 | 2 | 90.0 |
| GraduateStudent | lastName | 20 | 13 | 7 | 65.0 |
| Person | firstName | 874 | 700 | 174 | 80.09 |
| Person | lastName | 874 | 700 | 174 | 80.09 |
| Place | building | 18 | 14 | 4 | 77.78 |
| Place | roomCode | 18 | 14 | 4 | 77.78 |
| PostDoc | firstName | 5 | 4 | 1 | 80.0 |
| PostDoc | lastName | 5 | 5 | 0 | 100.0 |
| Student | firstName | 800 | 641 | 159 | 80.12 |
| Student | lastName | 800 | 642 | 158 | 80.25 |
| TimeSlot | day | 20 | 16 | 4 | 80.0 |
| TimeSlot | endTime | 20 | 16 | 4 | 80.0 |
| TimeSlot | startTime | 20 | 16 | 4 | 80.0 |
| UndergraduateStudent | firstName | 380 | 303 | 77 | 79.74 |
| UndergraduateStudent | lastName | 380 | 309 | 71 | 81.32 |

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

