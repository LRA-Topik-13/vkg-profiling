# Defect manifest — level 2%

Seed: `2025` · pools: metric=schema, target_completeness=98, population_overall=100.0, interlinking_overall=98.07

This file is the **ground truth** for the correctness evaluation. Each section below is what the dashboard should report when this level is loaded.

## Overall completeness (target = 98%)

- **Population**: 100.0%
- **Attribute**: 100.0%
- **Interlinking**: 98.07%
- **Schema/mapping** (graded, cannot hit the ladder): classes 13 mapped (was 13), properties 15 mapped (was 15)

## Attribute completeness (literal property values)

| Class | Property | Total | Filled | Missing | Completeness % |
|---|---|---:|---:|---:|---:|
| AssistantProfessor | firstName | 8 | 8 | 0 | 100.0 |
| AssistantProfessor | lastName | 8 | 8 | 0 | 100.0 |
| AssociateProfessor | firstName | 12 | 12 | 0 | 100.0 |
| AssociateProfessor | lastName | 12 | 12 | 0 | 100.0 |
| Course | title | 135 | 135 | 0 | 100.0 |
| ExternalTeacher | firstName | 7 | 7 | 0 | 100.0 |
| ExternalTeacher | lastName | 7 | 7 | 0 | 100.0 |
| FacultyMember | firstName | 71 | 71 | 0 | 100.0 |
| FacultyMember | lastName | 71 | 71 | 0 | 100.0 |
| FullProfessor | firstName | 34 | 34 | 0 | 100.0 |
| FullProfessor | lastName | 34 | 34 | 0 | 100.0 |
| GraduateStudent | firstName | 20 | 20 | 0 | 100.0 |
| GraduateStudent | lastName | 20 | 20 | 0 | 100.0 |
| Person | firstName | 874 | 874 | 0 | 100.0 |
| Person | lastName | 874 | 874 | 0 | 100.0 |
| Place | building | 18 | 18 | 0 | 100.0 |
| Place | roomCode | 18 | 18 | 0 | 100.0 |
| PostDoc | firstName | 5 | 5 | 0 | 100.0 |
| PostDoc | lastName | 5 | 5 | 0 | 100.0 |
| Student | firstName | 800 | 800 | 0 | 100.0 |
| Student | lastName | 800 | 800 | 0 | 100.0 |
| TimeSlot | day | 20 | 20 | 0 | 100.0 |
| TimeSlot | endTime | 20 | 20 | 0 | 100.0 |
| TimeSlot | startTime | 20 | 20 | 0 | 100.0 |
| UndergraduateStudent | firstName | 380 | 380 | 0 | 100.0 |
| UndergraduateStudent | lastName | 380 | 380 | 0 | 100.0 |

## Population completeness (represented vs expected source)

| Class | Represented | Source pop. | Missing | Completeness % |
|---|---:|---:|---:|---:|
| AssistantProfessor | 8 | 8 | 0 | 100.0 |
| AssociateProfessor | 12 | 12 | 0 | 100.0 |
| Course | 135 | 135 | 0 | 100.0 |
| ExternalTeacher | 7 | 7 | 0 | 100.0 |
| FacultyMember | 71 | 71 | 0 | 100.0 |
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

- Dropped mappings: `mathsci-associate-prof`
- Classes lost: `(none)`
- Properties lost: `(none)`
- Mapped classes: 13 / 13
- Mapped properties: 15 / 15

