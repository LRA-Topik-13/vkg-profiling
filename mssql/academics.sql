-- ============================================================
-- academics (Microsoft SQL Server)
-- 2 existing concepts: course, teacher
-- 2 new concepts:      place, time_slot
-- 2 mapping tables:    teaching, schedule
-- ============================================================

-- EXISTING CONCEPT (mirrors compsci.course, mathsci.course)
CREATE TABLE course (
    c_id    INT             NOT NULL,
    title   VARCHAR(100)    NOT NULL,
    CONSTRAINT pk_course PRIMARY KEY (c_id)
);

-- EXISTING CONCEPT (mirrors compsci.academic, mathsci.person where status=teacher)
CREATE TABLE teacher (
    t_id        INT         NOT NULL,
    first_name  VARCHAR(40) NOT NULL,
    last_name   VARCHAR(40) NOT NULL,
    position    INT         NOT NULL,
    -- position mapping (consistent with compsci pattern from obda):
    -- 1 = FullProfessor, 2 = AssociateProfessor, 3 = AssistantProfessor
    -- 8 = ExternalTeacher, 9 = PostDoc
    birth_date  DATE        NOT NULL,
    email       VARCHAR(100) NOT NULL,
    CONSTRAINT pk_teacher PRIMARY KEY (t_id)
);

-- NEW CONCEPT — where a course is held
CREATE TABLE place (
    place_id    INT         NOT NULL,
    building    VARCHAR(100) NOT NULL,
    room_code   VARCHAR(20) NOT NULL,
    CONSTRAINT pk_place PRIMARY KEY (place_id)
);

-- NEW CONCEPT — when a course is held
CREATE TABLE time_slot (
    ts_id       INT         NOT NULL,
    day         VARCHAR(10) NOT NULL,
    start_time  TIME        NOT NULL,
    end_time    TIME        NOT NULL,
    CONSTRAINT pk_time_slot PRIMARY KEY (ts_id)
);

-- MAPPING TABLE — teacher teaches course (becomes :teaches triple)
CREATE TABLE teaching (
    c_id    INT NOT NULL,
    t_id    INT NOT NULL,
    CONSTRAINT fk_teaching_course  FOREIGN KEY (c_id) REFERENCES course(c_id),
    CONSTRAINT fk_teaching_teacher FOREIGN KEY (t_id) REFERENCES teacher(t_id)
);

-- MAPPING TABLE — course scheduled at place and time (becomes :isScheduledAt)
CREATE TABLE schedule (
    c_id        INT NOT NULL,
    place_id    INT NOT NULL,
    ts_id       INT NOT NULL,
    CONSTRAINT pk_schedule          PRIMARY KEY (c_id, place_id, ts_id),
    CONSTRAINT fk_schedule_course   FOREIGN KEY (c_id)     REFERENCES course(c_id),
    CONSTRAINT fk_schedule_place    FOREIGN KEY (place_id) REFERENCES place(place_id),
    CONSTRAINT fk_schedule_timeslot FOREIGN KEY (ts_id)    REFERENCES time_slot(ts_id)
);

-- ============================================================
-- Sample data
-- ============================================================

-- Teachers (14 total)
-- NOTE: t_id 1 "Anna Chambers"  overlaps compsci academic a_id=1 (FullProfessor)
-- NOTE: t_id 3 "Rachel Ward"    overlaps compsci a_id=3 AND mathsci pid=4
-- NOTE: t_id 4 "Victor Scott"   overlaps mathsci pid=6 (FullProfessor)
-- NOTE: t_id 9 "Zak Lane"       overlaps mathsci pid=1 (lecturer)
-- NOTE: t_id 10 "Kellie Griffin" overlaps mathsci pid=7 (lecturer)
-- NOTE: t_id 11 "Sueann Samora" overlaps mathsci pid=8 (lecturer)
INSERT INTO teacher VALUES (1,  'Anna',    'Chambers',  1, '1982-03-15', 'anna.chambers@gmail.com');
INSERT INTO teacher VALUES (2,  'Diego',   'Vargas',    2, '1983-08-07', 'diego.vargas@gmail.com');
INSERT INTO teacher VALUES (3,  'Rachel',  'Ward',      3, '1985-11-08', 'rachel.ward@gmail.com');
INSERT INTO teacher VALUES (4,  'Victor',  'Scott',     1, '1980-01-15', 'victor.scott@gmail.com');
INSERT INTO teacher VALUES (5,  'Tomoko',  'Nakamura',  9, '1989-04-22', 'tomoko.nakamura@gmail.com');
INSERT INTO teacher VALUES (6,  'Eleni',   'Papadaki',  8, '1987-10-13', 'eleni.papadaki@gmail.com');
INSERT INTO teacher VALUES (7,  'Marcus',  'Lindqvist', 2, '1981-12-19', 'marcus.lindqvist@gmail.com');
INSERT INTO teacher VALUES (8,  'Fatima',  'Al-Hassan', 1, '1984-06-03', 'fatima.alhassan@gmail.com');
INSERT INTO teacher VALUES (9,  'Zak',     'Lane',      1, '1981-05-19', 'zak.lane@gmail.com');
INSERT INTO teacher VALUES (10, 'Kellie',  'Griffin',   2, '1984-07-11', 'kellie.griffin@gmail.com');
INSERT INTO teacher VALUES (11, 'Sueann',  'Samora',    9, '1986-02-28', 'sueann.samora@gmail.com');
INSERT INTO teacher VALUES (12, 'Henrik',  'Johansson', 3, '1988-09-04', 'henrik.johansson@gmail.com');
INSERT INTO teacher VALUES (13, 'Mei',     'Tanaka',    2, '1985-03-17', 'mei.tanaka@gmail.com');
INSERT INTO teacher VALUES (14, 'Carlos',  'Rivera',    1, '1982-11-29', 'carlos.rivera@gmail.com');

-- Courses (14 total)
-- NOTE: c_id 1 "Linear Algebra"                        overlaps compsci c_id=1234
-- NOTE: c_id 2 "Data Exploration and Visualization"     overlaps mathsci cid=1
-- NOTE: c_id 9 "Introduction to Multivariate Analysis"  overlaps mathsci cid=2
-- NOTE: c_id 10 "Linear Models"                         overlaps mathsci cid=3
-- NOTE: c_id 11 "Nonparametric Statistics"              overlaps mathsci cid=4
-- NOTE: c_id 12 "Statistical Computing"                 overlaps mathsci cid=5
-- NOTE: c_id 13 "Probability Theory"                    overlaps mathsci cid=6
-- NOTE: c_id 14 "Bayesian Statistics"                   overlaps mathsci cid=8
INSERT INTO course VALUES (1, 'Linear Algebra');
INSERT INTO course VALUES (2, 'Data Exploration and Visualization');
INSERT INTO course VALUES (3, 'Cloud Computing');
INSERT INTO course VALUES (4, 'Embedded Systems');
INSERT INTO course VALUES (5, 'Compiler Design');
INSERT INTO course VALUES (6, 'Computer Networks');
INSERT INTO course VALUES (7, 'Human-Computer Interaction');
INSERT INTO course VALUES (8, 'Parallel Computing');
INSERT INTO course VALUES (9, 'Introduction to Multivariate Analysis');
INSERT INTO course VALUES (10, 'Linear Models');
INSERT INTO course VALUES (11, 'Nonparametric Statistics');
INSERT INTO course VALUES (12, 'Statistical Computing');
INSERT INTO course VALUES (13, 'Probability Theory');
INSERT INTO course VALUES (14, 'Bayesian Statistics');
INSERT INTO course VALUES (15, 'Linear Algebra');
INSERT INTO course VALUES (16, 'Cloud Computing');

-- Places (7)
INSERT INTO place VALUES (1, 'Engineering Building',  'E-101');
INSERT INTO place VALUES (2, 'Engineering Building',  'E-202');
INSERT INTO place VALUES (3, 'Science Hall',          'S-310');
INSERT INTO place VALUES (4, 'Library Annex',         'L-015');
INSERT INTO place VALUES (5, 'Computing Center',      'C-401');
INSERT INTO place VALUES (6, 'Mathematics Pavilion',  'M-201');
INSERT INTO place VALUES (7, 'Statistics Laboratory',  'ST-105');
INSERT INTO place VALUES (8, 'Statistics Laboratory',  'ST-106');

-- Time slots (10)
INSERT INTO time_slot VALUES (1, 'Monday',    '08:00', '09:30');
INSERT INTO time_slot VALUES (2, 'Monday',    '10:00', '11:30');
INSERT INTO time_slot VALUES (3, 'Tuesday',   '13:00', '14:30');
INSERT INTO time_slot VALUES (4, 'Wednesday', '08:00', '09:30');
INSERT INTO time_slot VALUES (5, 'Thursday',  '10:00', '11:30');
INSERT INTO time_slot VALUES (6, 'Friday',    '14:00', '15:30');
INSERT INTO time_slot VALUES (7, 'Tuesday',   '08:00', '09:30');
INSERT INTO time_slot VALUES (8, 'Wednesday', '13:00', '14:30');
INSERT INTO time_slot VALUES (9, 'Thursday',  '08:00', '09:30');
INSERT INTO time_slot VALUES (10, 'Friday',   '10:00', '11:30');

-- Teaching assignments
INSERT INTO teaching VALUES (1, 1);
INSERT INTO teaching VALUES (1, 3);
INSERT INTO teaching VALUES (2, 4);
INSERT INTO teaching VALUES (3, 2);
INSERT INTO teaching VALUES (4, 5);
INSERT INTO teaching VALUES (5, 7);
INSERT INTO teaching VALUES (6, 8);
INSERT INTO teaching VALUES (7, 6);
INSERT INTO teaching VALUES (8, 2);
INSERT INTO teaching VALUES (9, 11);
INSERT INTO teaching VALUES (9, 13);
INSERT INTO teaching VALUES (10, 10);
INSERT INTO teaching VALUES (11, 9);
INSERT INTO teaching VALUES (12, 12);
INSERT INTO teaching VALUES (12, 14);
INSERT INTO teaching VALUES (13, 10);
INSERT INTO teaching VALUES (14, 14);

-- Schedules (course at place and time)
INSERT INTO schedule VALUES (1, 1, 1);
INSERT INTO schedule VALUES (1, 3, 4);
INSERT INTO schedule VALUES (2, 2, 2);
INSERT INTO schedule VALUES (3, 5, 3);
INSERT INTO schedule VALUES (4, 1, 5);
INSERT INTO schedule VALUES (5, 4, 6);
INSERT INTO schedule VALUES (6, 2, 1);
INSERT INTO schedule VALUES (7, 3, 3);
INSERT INTO schedule VALUES (8, 5, 5);
INSERT INTO schedule VALUES (3, 5, 6);
INSERT INTO schedule VALUES (9, 6, 7);
INSERT INTO schedule VALUES (9, 7, 8);
INSERT INTO schedule VALUES (10, 6, 9);
INSERT INTO schedule VALUES (11, 7, 10);
INSERT INTO schedule VALUES (12, 7, 7);
INSERT INTO schedule VALUES (12, 6, 3);
INSERT INTO schedule VALUES (13, 6, 2);
INSERT INTO schedule VALUES (14, 7, 9);
INSERT INTO schedule VALUES (13, 8, 10);
INSERT INTO schedule VALUES (16, 5, 10);
