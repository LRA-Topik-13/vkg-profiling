# Defect manifest — level 20%

Seed: `2025` · pools: metric=population, target_completeness=80, population_overall=79.99, interlinking_overall=76.89

This file is the **ground truth** for the correctness evaluation. Each section below is what the dashboard should report when this level is loaded.

## Overall completeness (target = 80%)

- **Population**: 79.99%
- **Attribute**: 100.0%
- **Interlinking**: 76.89%
- **Schema/mapping** (graded, cannot hit the ladder): classes 13 mapped (was 13), properties 15 mapped (was 15)

## Attribute completeness (literal property values)

| Class | Property | Total | Filled | Missing | Completeness % |
|---|---|---:|---:|---:|---:|
| AssistantProfessor | firstName | 8 | 8 | 0 | 100.0 |
| AssistantProfessor | lastName | 8 | 8 | 0 | 100.0 |
| AssociateProfessor | firstName | 11 | 11 | 0 | 100.0 |
| AssociateProfessor | lastName | 11 | 11 | 0 | 100.0 |
| Course | title | 105 | 105 | 0 | 100.0 |
| ExternalTeacher | firstName | 5 | 5 | 0 | 100.0 |
| ExternalTeacher | lastName | 5 | 5 | 0 | 100.0 |
| FacultyMember | firstName | 48 | 48 | 0 | 100.0 |
| FacultyMember | lastName | 48 | 48 | 0 | 100.0 |
| FullProfessor | firstName | 22 | 22 | 0 | 100.0 |
| FullProfessor | lastName | 22 | 22 | 0 | 100.0 |
| GraduateStudent | firstName | 20 | 20 | 0 | 100.0 |
| GraduateStudent | lastName | 20 | 20 | 0 | 100.0 |
| Person | firstName | 652 | 652 | 0 | 100.0 |
| Person | lastName | 652 | 652 | 0 | 100.0 |
| Place | building | 18 | 18 | 0 | 100.0 |
| Place | roomCode | 18 | 18 | 0 | 100.0 |
| PostDoc | firstName | 2 | 2 | 0 | 100.0 |
| PostDoc | lastName | 2 | 2 | 0 | 100.0 |
| Student | firstName | 604 | 604 | 0 | 100.0 |
| Student | lastName | 604 | 604 | 0 | 100.0 |
| TimeSlot | day | 20 | 20 | 0 | 100.0 |
| TimeSlot | endTime | 20 | 20 | 0 | 100.0 |
| TimeSlot | startTime | 20 | 20 | 0 | 100.0 |
| UndergraduateStudent | firstName | 380 | 380 | 0 | 100.0 |
| UndergraduateStudent | lastName | 380 | 380 | 0 | 100.0 |

## Population completeness (represented vs expected source)

| Class | Represented | Source pop. | Missing | Completeness % |
|---|---:|---:|---:|---:|
| AssistantProfessor | 8 | 8 | 0 | 100.0 |
| AssociateProfessor | 11 | 11 | 0 | 100.0 |
| Course | 105 | 135 | 30 | 77.78 |
| ExternalTeacher | 5 | 5 | 0 | 100.0 |
| FacultyMember | 48 | 74 | 26 | 64.86 |
| FullProfessor | 22 | 22 | 0 | 100.0 |
| GraduateStudent | 20 | 20 | 0 | 100.0 |
| Person | 652 | 874 | 222 | 74.6 |
| Place | 18 | 18 | 0 | 100.0 |
| PostDoc | 2 | 2 | 0 | 100.0 |
| Student | 604 | 800 | 196 | 75.5 |
| TimeSlot | 20 | 20 | 0 | 100.0 |
| UndergraduateStudent | 380 | 380 | 0 | 100.0 |

## Interlinking completeness (object-property links)

| Source : property | Baseline | Remaining | Removed |
|---|---:|---:|---:|
| academics:isScheduledAt/On | 150 | 150 | 0 |
| academics:teaches | 75 | 75 | 0 |
| compsci:attends | 2000 | 0 | 2000 |
| compsci:teaches | 50 | 0 | 50 |
| mathsci:attends | 2000 | 2000 | 0 |
| mathsci:givesLab | 30 | 30 | 0 |
| mathsci:givesLecture | 30 | 30 | 0 |

## Schema / mapping coverage

- Dropped mappings: `(none)`
- Classes lost: `(none)`
- Properties lost: `(none)`
- Mapped classes: 13 / 13
- Mapped properties: 15 / 15

