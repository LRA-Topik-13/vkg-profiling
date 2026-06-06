-- ============================================================
-- academics (Microsoft SQL Server)
-- 2 existing concepts: course, teacher
-- 2 new concepts:      place, time_slot
-- 2 mapping tables:    teaching, schedule
-- ============================================================

-- EXISTING CONCEPT (mirrors compsci.course, mathsci.course)
CREATE TABLE course (
    c_id    INT             NOT NULL,
    title   VARCHAR(100)    NULL,
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
    birth_date  DATE        NULL,
    email       VARCHAR(100) NULL,
    CONSTRAINT pk_teacher PRIMARY KEY (t_id)
);

-- NEW CONCEPT — where a course is held
CREATE TABLE place (
    place_id    INT         NOT NULL,
    building    VARCHAR(100) NULL,
    room_code   VARCHAR(20) NULL,
    CONSTRAINT pk_place PRIMARY KEY (place_id)
);

-- NEW CONCEPT — when a course is held
CREATE TABLE time_slot (
    ts_id       INT         NOT NULL,
    day         VARCHAR(10) NULL,
    start_time  TIME        NULL,
    end_time    TIME        NULL,
    CONSTRAINT pk_time_slot PRIMARY KEY (ts_id)
);

-- MAPPING TABLE — teacher teaches course (becomes :teaches triple)
CREATE TABLE teaching (
    c_id    INT NOT NULL,
    t_id    INT NOT NULL,
    CONSTRAINT fk_teaching_course  FOREIGN KEY (c_id) REFERENCES course(c_id),
    CONSTRAINT fk_teaching_teacher FOREIGN KEY (t_id) REFERENCES teacher(t_id)
);

-- MAPPING TABLE — course scheduled at place and time (becomes :isScheduledAt/:isScheduledOn)
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

-- Teachers (40 total)
INSERT INTO teacher VALUES ( 1, 'Derrick', 'Ayala', 1, '1986-02-01', 'derrick.ayala190@example.edu');
INSERT INTO teacher VALUES ( 2, 'Dean', 'Haney', 2, '1968-12-31', 'dean.haney380@example.edu');
INSERT INTO teacher VALUES ( 3, 'Alyssa', 'Smith', 3, '1983-03-15', 'alyssa.smith907@example.edu');
INSERT INTO teacher VALUES ( 4, 'Scott', 'Bowen', 2, '1982-08-02', 'scott.bowen391@example.edu');
INSERT INTO teacher VALUES ( 5, 'Edward', 'Jenkins', 8, '1984-03-22', 'edward.jenkins379@example.edu');
INSERT INTO teacher VALUES ( 6, 'Michelle', 'Miller', 3, '1967-10-25', 'michelle.miller192@example.edu');
INSERT INTO teacher VALUES ( 7, 'Karen', 'Lawrence', 8, '1975-10-03', 'karen.lawrence457@example.edu');
INSERT INTO teacher VALUES ( 8, 'Sylvia', 'Edwards', 3, '1968-11-30', 'sylvia.edwards46@example.edu');
INSERT INTO teacher VALUES ( 9, 'Joshua', 'Miller', 8, '1980-06-30', 'joshua.miller270@example.edu');
INSERT INTO teacher VALUES (10, 'Carol', 'Lawson', 3, '1986-10-23', 'carol.lawson451@example.edu');
INSERT INTO teacher VALUES (11, 'Hannah', 'Abbott', 2, '1983-06-08', 'hannah.abbott477@example.edu');
INSERT INTO teacher VALUES (12, 'Kevin', 'Holmes', 1, '1979-04-08', 'kevin.holmes270@example.edu');
INSERT INTO teacher VALUES (13, 'Julie', 'Phillips', 3, '1966-07-13', 'julie.phillips232@example.edu');
INSERT INTO teacher VALUES (14, 'Rachael', 'Blevins', 8, '1978-11-09', 'rachael.blevins858@example.edu');
INSERT INTO teacher VALUES (15, 'Daniel', 'Porter', 2, '1981-08-18', 'daniel.porter276@example.edu');
INSERT INTO teacher VALUES (16, 'Allison', 'Levine', 1, '1992-08-18', 'allison.levine578@example.edu');
INSERT INTO teacher VALUES (17, 'Sarah', 'Anderson', 3, '1989-02-06', 'sarah.anderson64@example.edu');
INSERT INTO teacher VALUES (18, 'Ashley', 'Diaz', 3, '1984-02-14', 'ashley.diaz155@example.edu');
INSERT INTO teacher VALUES (19, 'Kathryn', 'Best', 8, '1986-07-27', 'kathryn.best771@example.edu');
INSERT INTO teacher VALUES (20, 'Alvin', 'Jones', 8, '1972-05-05', 'alvin.jones714@example.edu');
INSERT INTO teacher VALUES (21, 'Bill', 'Brown', 8, '1987-02-06', 'bill.brown684@example.edu');
INSERT INTO teacher VALUES (22, 'William', 'Fuller', 8, '1979-01-11', 'william.fuller100@example.edu');
INSERT INTO teacher VALUES (23, 'Robert', 'Miles', 3, '1967-04-23', 'robert.miles88@example.edu');
INSERT INTO teacher VALUES (24, 'Amanda', 'Jensen', 3, '1972-10-08', 'amanda.jensen685@example.edu');
INSERT INTO teacher VALUES (25, 'Kyle', 'Dixon', 1, '1970-09-09', 'kyle.dixon353@example.edu');
INSERT INTO teacher VALUES (26, 'Lindsey', 'Herrera', 1, '1975-12-10', 'lindsey.herrera828@example.edu');
INSERT INTO teacher VALUES (27, 'Cynthia', 'Davenport', 2, '1984-01-26', 'cynthia.davenport555@example.edu');
INSERT INTO teacher VALUES (28, 'Carl', 'Hale', 1, '1985-06-09', 'carl.hale424@example.edu');
INSERT INTO teacher VALUES (29, 'Meghan', 'Brown', 2, '1967-06-01', 'meghan.brown995@example.edu');
INSERT INTO teacher VALUES (30, 'Ryan', 'Chavez', 1, '1982-01-17', 'ryan.chavez775@example.edu');
INSERT INTO teacher VALUES (31, 'Kyle', 'Harmon', 1, '1985-09-26', 'kyle.harmon604@example.edu');
INSERT INTO teacher VALUES (32, 'David', 'Zimmerman', 8, '1984-08-22', 'david.zimmerman233@example.edu');
INSERT INTO teacher VALUES (33, 'Frank', 'Benton', 3, '1979-08-24', 'frank.benton567@example.edu');
INSERT INTO teacher VALUES (34, 'Krista', 'Le', 1, '1969-09-04', 'krista.le63@example.edu');
INSERT INTO teacher VALUES (35, 'David', 'Norman', 1, '1972-07-11', 'david.norman861@example.edu');
INSERT INTO teacher VALUES (36, 'Olivia', 'Wise', 2, '1965-10-28', 'olivia.wise397@example.edu');
INSERT INTO teacher VALUES (37, 'Lindsay', 'Nelson', 2, '1966-10-16', 'lindsay.nelson839@example.edu');
INSERT INTO teacher VALUES (38, 'Jennifer', 'Ray', 2, '1967-02-28', 'jennifer.ray536@example.edu');
INSERT INTO teacher VALUES (39, 'Spencer', 'Ward', 2, '1978-12-28', 'spencer.ward429@example.edu');
INSERT INTO teacher VALUES (40, 'Ashley', 'Richardson', 8, '1972-02-22', 'ashley.richardson989@example.edu');

-- Courses (40 total)
-- Structure: 6 titles x 6 sections (A-F) + 1 title x 4 sections (A-D) = 40
INSERT INTO course VALUES ( 1, 'Cloud Computing A');
INSERT INTO course VALUES ( 2, 'Cloud Computing B');
INSERT INTO course VALUES ( 3, 'Cloud Computing C');
INSERT INTO course VALUES ( 4, 'Cloud Computing D');
INSERT INTO course VALUES ( 5, 'Cloud Computing E');
INSERT INTO course VALUES ( 6, 'Cloud Computing F');
INSERT INTO course VALUES ( 7, 'Embedded Systems A');
INSERT INTO course VALUES ( 8, 'Embedded Systems B');
INSERT INTO course VALUES ( 9, 'Embedded Systems C');
INSERT INTO course VALUES (10, 'Embedded Systems D');
INSERT INTO course VALUES (11, 'Embedded Systems E');
INSERT INTO course VALUES (12, 'Embedded Systems F');
INSERT INTO course VALUES (13, 'Compiler Design A');
INSERT INTO course VALUES (14, 'Compiler Design B');
INSERT INTO course VALUES (15, 'Compiler Design C');
INSERT INTO course VALUES (16, 'Compiler Design D');
INSERT INTO course VALUES (17, 'Compiler Design E');
INSERT INTO course VALUES (18, 'Compiler Design F');
INSERT INTO course VALUES (19, 'Bayesian Statistics A');
INSERT INTO course VALUES (20, 'Bayesian Statistics B');
INSERT INTO course VALUES (21, 'Bayesian Statistics C');
INSERT INTO course VALUES (22, 'Bayesian Statistics D');
INSERT INTO course VALUES (23, 'Bayesian Statistics E');
INSERT INTO course VALUES (24, 'Bayesian Statistics F');
INSERT INTO course VALUES (25, 'Nonparametric Statistics A');
INSERT INTO course VALUES (26, 'Nonparametric Statistics B');
INSERT INTO course VALUES (27, 'Nonparametric Statistics C');
INSERT INTO course VALUES (28, 'Nonparametric Statistics D');
INSERT INTO course VALUES (29, 'Nonparametric Statistics E');
INSERT INTO course VALUES (30, 'Nonparametric Statistics F');
INSERT INTO course VALUES (31, 'Human-Computer Interaction A');
INSERT INTO course VALUES (32, 'Human-Computer Interaction B');
INSERT INTO course VALUES (33, 'Human-Computer Interaction C');
INSERT INTO course VALUES (34, 'Human-Computer Interaction D');
INSERT INTO course VALUES (35, 'Human-Computer Interaction E');
INSERT INTO course VALUES (36, 'Human-Computer Interaction F');
INSERT INTO course VALUES (37, 'Parallel Computing A');
INSERT INTO course VALUES (38, 'Parallel Computing B');
INSERT INTO course VALUES (39, 'Parallel Computing C');
INSERT INTO course VALUES (40, 'Parallel Computing D');

-- Places (50 total, 10 buildings x 5 rooms)
INSERT INTO place VALUES ( 1, 'Alpha Building', 'A-101');
INSERT INTO place VALUES ( 2, 'Alpha Building', 'A-102');
INSERT INTO place VALUES ( 3, 'Alpha Building', 'A-103');
INSERT INTO place VALUES ( 4, 'Alpha Building', 'A-201');
INSERT INTO place VALUES ( 5, 'Alpha Building', 'A-202');
INSERT INTO place VALUES ( 6, 'Alpha Building', 'A-203');
INSERT INTO place VALUES ( 7, 'Alpha Building', 'A-301');
INSERT INTO place VALUES ( 8, 'Alpha Building', 'A-302');
INSERT INTO place VALUES ( 9, 'Alpha Building', 'A-303');
INSERT INTO place VALUES (10, 'Alpha Building', 'A-401');
INSERT INTO place VALUES (11, 'Alpha Building', 'A-402');
INSERT INTO place VALUES (12, 'Alpha Building', 'A-403');
INSERT INTO place VALUES (13, 'Alpha Building', 'A-501');
INSERT INTO place VALUES (14, 'Alpha Building', 'A-502');
INSERT INTO place VALUES (15, 'Alpha Building', 'A-503');
INSERT INTO place VALUES (16, 'Beta Hall', 'B-101');
INSERT INTO place VALUES (17, 'Beta Hall', 'B-102');
INSERT INTO place VALUES (18, 'Beta Hall', 'B-103');
INSERT INTO place VALUES (19, 'Beta Hall', 'B-201');
INSERT INTO place VALUES (20, 'Beta Hall', 'B-202');
INSERT INTO place VALUES (21, 'Beta Hall', 'B-203');
INSERT INTO place VALUES (22, 'Beta Hall', 'B-301');
INSERT INTO place VALUES (23, 'Beta Hall', 'B-302');
INSERT INTO place VALUES (24, 'Beta Hall', 'B-303');
INSERT INTO place VALUES (25, 'Beta Hall', 'B-401');
INSERT INTO place VALUES (26, 'Beta Hall', 'B-402');
INSERT INTO place VALUES (27, 'Beta Hall', 'B-403');
INSERT INTO place VALUES (28, 'Beta Hall', 'B-501');
INSERT INTO place VALUES (29, 'Beta Hall', 'B-502');
INSERT INTO place VALUES (30, 'Beta Hall', 'B-503');
INSERT INTO place VALUES (31, 'Gamma Center', 'G-101');
INSERT INTO place VALUES (32, 'Gamma Center', 'G-102');
INSERT INTO place VALUES (33, 'Gamma Center', 'G-103');
INSERT INTO place VALUES (34, 'Gamma Center', 'G-201');
INSERT INTO place VALUES (35, 'Gamma Center', 'G-202');
INSERT INTO place VALUES (36, 'Gamma Center', 'G-203');
INSERT INTO place VALUES (37, 'Gamma Center', 'G-301');
INSERT INTO place VALUES (38, 'Gamma Center', 'G-302');
INSERT INTO place VALUES (39, 'Gamma Center', 'G-303');
INSERT INTO place VALUES (40, 'Gamma Center', 'G-401');
INSERT INTO place VALUES (41, 'Gamma Center', 'G-402');
INSERT INTO place VALUES (42, 'Gamma Center', 'G-403');
INSERT INTO place VALUES (43, 'Gamma Center', 'G-501');
INSERT INTO place VALUES (44, 'Gamma Center', 'G-502');
INSERT INTO place VALUES (45, 'Gamma Center', 'G-503');
INSERT INTO place VALUES (46, 'Delta Pavilion', 'D-101');
INSERT INTO place VALUES (47, 'Delta Pavilion', 'D-102');
INSERT INTO place VALUES (48, 'Delta Pavilion', 'D-103');
INSERT INTO place VALUES (49, 'Delta Pavilion', 'D-201');
INSERT INTO place VALUES (50, 'Delta Pavilion', 'D-202');

-- Time slots (50 total, 5 days x 10 time windows)
INSERT INTO time_slot VALUES ( 1, 'Monday', '07:00', '08:30');
INSERT INTO time_slot VALUES ( 2, 'Monday', '08:00', '09:30');
INSERT INTO time_slot VALUES ( 3, 'Monday', '09:00', '10:30');
INSERT INTO time_slot VALUES ( 4, 'Monday', '10:00', '11:30');
INSERT INTO time_slot VALUES ( 5, 'Monday', '11:00', '12:30');
INSERT INTO time_slot VALUES ( 6, 'Monday', '13:00', '14:30');
INSERT INTO time_slot VALUES ( 7, 'Monday', '14:00', '15:30');
INSERT INTO time_slot VALUES ( 8, 'Monday', '15:00', '16:30');
INSERT INTO time_slot VALUES ( 9, 'Monday', '16:00', '17:30');
INSERT INTO time_slot VALUES (10, 'Monday', '17:00', '18:30');
INSERT INTO time_slot VALUES (11, 'Tuesday', '07:00', '08:30');
INSERT INTO time_slot VALUES (12, 'Tuesday', '08:00', '09:30');
INSERT INTO time_slot VALUES (13, 'Tuesday', '09:00', '10:30');
INSERT INTO time_slot VALUES (14, 'Tuesday', '10:00', '11:30');
INSERT INTO time_slot VALUES (15, 'Tuesday', '11:00', '12:30');
INSERT INTO time_slot VALUES (16, 'Tuesday', '13:00', '14:30');
INSERT INTO time_slot VALUES (17, 'Tuesday', '14:00', '15:30');
INSERT INTO time_slot VALUES (18, 'Tuesday', '15:00', '16:30');
INSERT INTO time_slot VALUES (19, 'Tuesday', '16:00', '17:30');
INSERT INTO time_slot VALUES (20, 'Tuesday', '17:00', '18:30');
INSERT INTO time_slot VALUES (21, 'Wednesday', '07:00', '08:30');
INSERT INTO time_slot VALUES (22, 'Wednesday', '08:00', '09:30');
INSERT INTO time_slot VALUES (23, 'Wednesday', '09:00', '10:30');
INSERT INTO time_slot VALUES (24, 'Wednesday', '10:00', '11:30');
INSERT INTO time_slot VALUES (25, 'Wednesday', '11:00', '12:30');
INSERT INTO time_slot VALUES (26, 'Wednesday', '13:00', '14:30');
INSERT INTO time_slot VALUES (27, 'Wednesday', '14:00', '15:30');
INSERT INTO time_slot VALUES (28, 'Wednesday', '15:00', '16:30');
INSERT INTO time_slot VALUES (29, 'Wednesday', '16:00', '17:30');
INSERT INTO time_slot VALUES (30, 'Wednesday', '17:00', '18:30');
INSERT INTO time_slot VALUES (31, 'Thursday', '07:00', '08:30');
INSERT INTO time_slot VALUES (32, 'Thursday', '08:00', '09:30');
INSERT INTO time_slot VALUES (33, 'Thursday', '09:00', '10:30');
INSERT INTO time_slot VALUES (34, 'Thursday', '10:00', '11:30');
INSERT INTO time_slot VALUES (35, 'Thursday', '11:00', '12:30');
INSERT INTO time_slot VALUES (36, 'Thursday', '13:00', '14:30');
INSERT INTO time_slot VALUES (37, 'Thursday', '14:00', '15:30');
INSERT INTO time_slot VALUES (38, 'Thursday', '15:00', '16:30');
INSERT INTO time_slot VALUES (39, 'Thursday', '16:00', '17:30');
INSERT INTO time_slot VALUES (40, 'Thursday', '17:00', '18:30');
INSERT INTO time_slot VALUES (41, 'Friday', '07:00', '08:30');
INSERT INTO time_slot VALUES (42, 'Friday', '08:00', '09:30');
INSERT INTO time_slot VALUES (43, 'Friday', '09:00', '10:30');
INSERT INTO time_slot VALUES (44, 'Friday', '10:00', '11:30');
INSERT INTO time_slot VALUES (45, 'Friday', '11:00', '12:30');
INSERT INTO time_slot VALUES (46, 'Friday', '13:00', '14:30');
INSERT INTO time_slot VALUES (47, 'Friday', '14:00', '15:30');
INSERT INTO time_slot VALUES (48, 'Friday', '15:00', '16:30');
INSERT INTO time_slot VALUES (49, 'Friday', '16:00', '17:30');
INSERT INTO time_slot VALUES (50, 'Friday', '17:00', '18:30');

-- Teaching assignments (40 total, 1:1 teacher-to-course)
INSERT INTO teaching VALUES ( 1, 10);
INSERT INTO teaching VALUES ( 2, 12);
INSERT INTO teaching VALUES ( 3, 13);
INSERT INTO teaching VALUES ( 4,  8);
INSERT INTO teaching VALUES ( 5, 21);
INSERT INTO teaching VALUES ( 6, 27);
INSERT INTO teaching VALUES ( 7,  9);
INSERT INTO teaching VALUES ( 8, 38);
INSERT INTO teaching VALUES ( 9, 32);
INSERT INTO teaching VALUES (10, 25);
INSERT INTO teaching VALUES (11, 14);
INSERT INTO teaching VALUES (12, 11);
INSERT INTO teaching VALUES (13,  2);
INSERT INTO teaching VALUES (14, 28);
INSERT INTO teaching VALUES (15,  1);
INSERT INTO teaching VALUES (16, 23);
INSERT INTO teaching VALUES (17, 18);
INSERT INTO teaching VALUES (18,  7);
INSERT INTO teaching VALUES (19, 24);
INSERT INTO teaching VALUES (20, 34);
INSERT INTO teaching VALUES (21, 15);
INSERT INTO teaching VALUES (22,  4);
INSERT INTO teaching VALUES (23,  5);
INSERT INTO teaching VALUES (24, 40);
INSERT INTO teaching VALUES (25, 22);
INSERT INTO teaching VALUES (26, 30);
INSERT INTO teaching VALUES (27, 33);
INSERT INTO teaching VALUES (28, 36);
INSERT INTO teaching VALUES (29, 29);
INSERT INTO teaching VALUES (30, 19);
INSERT INTO teaching VALUES (31, 17);
INSERT INTO teaching VALUES (32,  3);
INSERT INTO teaching VALUES (33, 26);
INSERT INTO teaching VALUES (34,  6);
INSERT INTO teaching VALUES (35, 20);
INSERT INTO teaching VALUES (36, 39);
INSERT INTO teaching VALUES (37, 16);
INSERT INTO teaching VALUES (38, 37);
INSERT INTO teaching VALUES (39, 31);
INSERT INTO teaching VALUES (40, 35);

-- Schedules (60 total)
INSERT INTO schedule VALUES ( 1, 15, 16);
INSERT INTO schedule VALUES ( 2, 17, 12);
INSERT INTO schedule VALUES ( 3, 32, 28);
INSERT INTO schedule VALUES ( 4, 24, 33);
INSERT INTO schedule VALUES ( 5, 37, 46);
INSERT INTO schedule VALUES ( 6,  3, 35);
INSERT INTO schedule VALUES ( 7, 11, 22);
INSERT INTO schedule VALUES ( 8, 46, 11);
INSERT INTO schedule VALUES ( 9, 48, 30);
INSERT INTO schedule VALUES (10, 44, 47);
INSERT INTO schedule VALUES (11, 45, 43);
INSERT INTO schedule VALUES (12,  4, 36);
INSERT INTO schedule VALUES (13, 12,  8);
INSERT INTO schedule VALUES (14, 39, 50);
INSERT INTO schedule VALUES (15, 42, 34);
INSERT INTO schedule VALUES (16, 22,  2);
INSERT INTO schedule VALUES (17, 25, 42);
INSERT INTO schedule VALUES (18,  5, 48);
INSERT INTO schedule VALUES (19, 28, 37);
INSERT INTO schedule VALUES (20, 31,  1);
INSERT INTO schedule VALUES (21,  6, 19);
INSERT INTO schedule VALUES (22,  2, 25);
INSERT INTO schedule VALUES (23, 26,  5);
INSERT INTO schedule VALUES (24, 20, 38);
INSERT INTO schedule VALUES (25, 33, 31);
INSERT INTO schedule VALUES (26, 16, 23);
INSERT INTO schedule VALUES (27, 49, 10);
INSERT INTO schedule VALUES (28, 13,  3);
INSERT INTO schedule VALUES (29,  9, 40);
INSERT INTO schedule VALUES (30, 14, 26);
INSERT INTO schedule VALUES (31, 29, 17);
INSERT INTO schedule VALUES (32, 23,  4);
INSERT INTO schedule VALUES (33, 19, 24);
INSERT INTO schedule VALUES (34, 35, 32);
INSERT INTO schedule VALUES (35, 50, 41);
INSERT INTO schedule VALUES (36,  7, 14);
INSERT INTO schedule VALUES (37, 43, 49);
INSERT INTO schedule VALUES (38, 10, 13);
INSERT INTO schedule VALUES (39, 41,  6);
INSERT INTO schedule VALUES (40,  8, 39);
INSERT INTO schedule VALUES ( 1, 27, 43);
INSERT INTO schedule VALUES ( 2, 47, 36);
INSERT INTO schedule VALUES ( 3, 38,  8);
INSERT INTO schedule VALUES ( 4, 40, 50);
INSERT INTO schedule VALUES ( 5,  1, 34);
INSERT INTO schedule VALUES ( 6, 30,  2);
INSERT INTO schedule VALUES ( 7, 34, 42);
INSERT INTO schedule VALUES ( 8, 18, 48);
INSERT INTO schedule VALUES ( 9, 21, 37);
INSERT INTO schedule VALUES (10, 36,  1);
INSERT INTO schedule VALUES (11, 15, 27);
INSERT INTO schedule VALUES (12, 17, 18);
INSERT INTO schedule VALUES (13, 32, 21);
INSERT INTO schedule VALUES (14, 24, 29);
INSERT INTO schedule VALUES (15, 37, 20);
INSERT INTO schedule VALUES (16,  3,  9);
INSERT INTO schedule VALUES (17, 11, 15);
INSERT INTO schedule VALUES (18, 46,  7);
INSERT INTO schedule VALUES (19, 48, 44);
INSERT INTO schedule VALUES (20, 44, 45);