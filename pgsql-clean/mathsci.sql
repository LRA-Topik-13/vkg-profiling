--
-- PostgreSQL database dump
--

-- Dumped from database version 13.2
-- Dumped by pg_dump version 13.2

-- Started on 2024-01-01 00:00:00 CEST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 201 (class 1259 OID 16405)
-- Name: course; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course (
    cid integer NOT NULL,
    lecturer integer,
    lab_teacher integer,
    topic character varying(100)
);

--
-- TOC entry 200 (class 1259 OID 16399)
-- Name: person; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person (
    pid integer NOT NULL,
    fname character varying(40) NOT NULL,
    lname character varying(40) NOT NULL,
    status integer NOT NULL,
    -- status mapping:
    -- 1 = UndergraduateStudent, 2 = GraduateStudent, 4 = PhDStudent
    -- 7 = FullProfessor, 8 = AssociateProfessor, 9 = AssistantProfessor
    birth_date date NULL,
    email character varying(100) NULL
);

--
-- TOC entry 202 (class 1259 OID 16412)
-- Name: registration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registration (
    pid integer NOT NULL,
    cid integer NOT NULL
);

--
-- TOC entry 203 (class 1259 OID 16418)
-- Name: supervision; Type: TABLE; Schema: public; Owner: postgres
-- Maps GraduateStudent/PhDStudent :isSupervisedBy Professor
--

CREATE TABLE public.supervision (
    pid_student    integer NOT NULL,
    pid_supervisor integer NOT NULL
);

--
-- TOC entry 3267 (class 0 OID 16405)
-- Dependencies: 201
-- Data for Name: course; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.course (cid, lecturer, lab_teacher, topic) FROM stdin;
1	39	29	Data Exploration and Visualization A
2	25	24	Data Exploration and Visualization B
3	58	60	Data Exploration and Visualization C
4	10	9	Data Exploration and Visualization D
5	54	12	Data Exploration and Visualization E
6	49	27	Data Exploration and Visualization F
7	11	19	Introduction to Multivariate Analysis A
8	7	46	Introduction to Multivariate Analysis B
9	34	31	Introduction to Multivariate Analysis C
10	8	43	Introduction to Multivariate Analysis D
11	16	4	Introduction to Multivariate Analysis E
12	57	35	Introduction to Multivariate Analysis F
13	51	55	Linear Models A
14	37	23	Linear Models B
15	56	28	Linear Models C
16	21	3	Linear Models D
17	53	5	Linear Models E
18	6	38	Linear Models F
19	41	14	Probability Theory A
20	42	48	Probability Theory B
21	40	1	Probability Theory C
22	18	17	Probability Theory D
23	32	26	Probability Theory E
24	22	2	Probability Theory F
25	50	47	Statistical Computing A
26	33	20	Statistical Computing B
27	59	52	Statistical Computing C
28	45	44	Statistical Computing D
29	15	30	Statistical Computing E
30	13	36	Statistical Computing F
\.


--
-- TOC entry 3266 (class 0 OID 16399)
-- Dependencies: 200
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.person (pid, fname, lname, status, birth_date, email) FROM stdin;
1	Donald	Bailey	7	1992-02-04	donald.bailey361@example.edu
2	Holly	Myers	9	1981-08-29	holly.myers560@example.edu
3	Sharon	Collins	8	1975-07-19	sharon.collins347@example.edu
4	Latasha	Li	8	1983-10-06	latasha.li834@example.edu
5	Maria	Rodgers	7	1984-03-11	maria.rodgers659@example.edu
6	Alicia	Lucas	9	1976-11-08	alicia.lucas180@example.edu
7	Michael	Cox	7	1970-01-18	michael.cox851@example.edu
8	Jason	Meza	8	1978-08-13	jason.meza798@example.edu
9	Jeremy	Taylor	8	1967-03-01	jeremy.taylor702@example.edu
10	Megan	Garcia	9	1986-08-01	megan.garcia476@example.edu
11	Mary	Stephenson	9	1966-01-22	mary.stephenson713@example.edu
12	Matthew	Miranda	9	1968-09-02	matthew.miranda491@example.edu
13	Nicholas	Martin	8	1988-04-11	nicholas.martin647@example.edu
14	Kellie	Lamb	7	1969-08-20	kellie.lamb187@example.edu
15	Samuel	Jenkins	7	1983-12-09	samuel.jenkins831@example.edu
16	John	Wallace	9	1972-12-23	john.wallace139@example.edu
17	Kaitlyn	Cole	9	1979-12-14	kaitlyn.cole65@example.edu
18	Kyle	Stokes	7	1978-02-18	kyle.stokes734@example.edu
19	Mary	Richardson	9	1991-07-09	mary.richardson795@example.edu
20	Tracey	Murray	8	1972-11-21	tracey.murray967@example.edu
21	Patrick	Rose	8	1992-01-21	patrick.rose469@example.edu
22	Lisa	Solis	8	1968-11-16	lisa.solis38@example.edu
23	John	Davidson	7	1989-06-22	john.davidson301@example.edu
24	Angela	Garcia	9	1988-09-07	angela.garcia207@example.edu
25	Melissa	Mitchell	8	1986-05-14	melissa.mitchell45@example.edu
26	Joshua	Whitehead	7	1969-02-15	joshua.whitehead811@example.edu
27	Samuel	Potts	7	1971-03-21	samuel.potts205@example.edu
28	Shannon	Bailey	7	1965-09-30	shannon.bailey908@example.edu
29	Brian	Shaw	9	1971-08-09	brian.shaw43@example.edu
30	Virginia	Brooks	8	1965-10-16	virginia.brooks324@example.edu
31	Sarah	Combs	7	1983-03-14	sarah.combs956@example.edu
32	Lacey	Taylor	9	1973-01-12	lacey.taylor318@example.edu
33	Maria	Horton	9	1968-11-20	maria.horton528@example.edu
34	Janice	West	8	1965-02-23	janice.west408@example.edu
35	Christian	Scott	7	1988-05-18	christian.scott835@example.edu
36	Ana	Acosta	8	1979-10-11	ana.acosta557@example.edu
37	Daniel	Roberts	9	1973-06-07	daniel.roberts485@example.edu
38	Brandon	Barnes	7	1987-03-25	brandon.barnes260@example.edu
39	Stephen	Rodriguez	9	1990-05-06	stephen.rodriguez38@example.edu
40	Candice	Smith	8	1979-06-07	candice.smith772@example.edu
41	John	Thomas	8	1977-01-07	john.thomas663@example.edu
42	Christina	Allen	9	1976-08-30	christina.allen196@example.edu
43	Elizabeth	Miller	7	1992-04-15	elizabeth.miller293@example.edu
44	Carlos	Fox	8	1979-03-16	carlos.fox366@example.edu
45	Vanessa	Spencer	8	1975-12-07	vanessa.spencer883@example.edu
46	Theodore	Reid	8	1992-06-20	theodore.reid800@example.edu
47	Jon	Smith	9	1987-01-29	jon.smith49@example.edu
48	Michael	Quinn	7	1982-08-04	michael.quinn887@example.edu
49	Kelsey	Moss	8	1974-04-24	kelsey.moss672@example.edu
50	Bradley	Payne	8	1987-10-11	bradley.payne340@example.edu
51	Gregory	Maxwell	9	1978-01-04	gregory.maxwell280@example.edu
52	Heather	Welch	8	1987-09-21	heather.welch128@example.edu
53	Bryan	Parsons	9	1977-10-25	bryan.parsons819@example.edu
54	Kelly	Williams	7	1970-08-02	kelly.williams377@example.edu
55	Bobby	Mahoney	9	1979-06-07	bobby.mahoney448@example.edu
56	Veronica	Daniels	7	1972-02-04	veronica.daniels911@example.edu
57	Karen	Lee	7	1974-12-30	karen.lee410@example.edu
58	Kimberly	Glenn	7	1974-04-18	kimberly.glenn762@example.edu
59	David	Richardson	9	1989-11-26	david.richardson451@example.edu
60	Julia	Kline	7	1975-10-29	julia.kline917@example.edu
61	Terri	Crawford	1	2002-12-24	terri.crawford33@example.edu
62	Sandra	Stone	1	2005-05-29	sandra.stone587@example.edu
63	Jessica	Miller	1	2003-10-26	jessica.miller971@example.edu
64	Lynn	Gardner	4	2001-07-27	lynn.gardner718@example.edu
65	Christopher	Guerrero	1	2001-06-14	christopher.guerrero113@example.edu
66	Carrie	Simmons	4	2004-07-07	carrie.simmons196@example.edu
67	Michael	Williams	1	2005-12-16	michael.williams20@example.edu
68	Michael	Bolton	1	2001-03-12	michael.bolton452@example.edu
69	Tina	Gould	1	1999-08-08	tina.gould322@example.edu
70	Dana	Cox	1	2005-05-29	dana.cox429@example.edu
71	Erin	Cisneros	4	2000-02-22	erin.cisneros156@example.edu
72	Cathy	Harrington	1	1999-04-12	cathy.harrington423@example.edu
73	Carlos	Osborne	1	2001-12-06	carlos.osborne708@example.edu
74	Patrick	Bradley	4	2003-11-03	patrick.bradley209@example.edu
75	Erika	Rush	1	2001-12-22	erika.rush421@example.edu
76	Kathryn	Berry	1	2003-03-27	kathryn.berry514@example.edu
77	Raymond	Banks	1	2000-12-30	raymond.banks794@example.edu
78	Daniel	Fitzgerald	1	2002-12-28	daniel.fitzgerald627@example.edu
79	Paul	Hoffman	1	2001-02-03	paul.hoffman943@example.edu
80	Jorge	Griffin	4	2006-12-20	jorge.griffin483@example.edu
81	Justin	Hendricks	1	2002-12-05	justin.hendricks894@example.edu
82	David	Farrell	1	2002-08-13	david.farrell869@example.edu
83	Rachel	Wallace	4	1999-09-14	rachel.wallace754@example.edu
84	Evelyn	Bruce	1	2001-07-22	evelyn.bruce745@example.edu
85	Michael	Brown	4	2003-05-03	michael.brown64@example.edu
86	Patricia	York	1	2004-09-10	patricia.york723@example.edu
87	Sara	Little	1	2005-05-07	sara.little142@example.edu
88	William	Martinez	1	2000-08-10	william.martinez532@example.edu
89	Dominic	Tyler	4	1999-03-18	dominic.tyler213@example.edu
90	Angela	Wood	1	2005-06-05	angela.wood575@example.edu
91	Andrea	Salazar	1	1999-09-09	andrea.salazar333@example.edu
92	Kyle	Key	4	2004-09-30	kyle.key679@example.edu
93	Alicia	Hammond	1	2005-08-01	alicia.hammond490@example.edu
94	Charles	Compton	4	2004-02-20	charles.compton539@example.edu
95	Shannon	Frazier	1	2001-10-03	shannon.frazier386@example.edu
96	Natalie	Deleon	1	2004-02-12	natalie.deleon322@example.edu
97	Hunter	Burch	1	2002-06-17	hunter.burch980@example.edu
98	Renee	Brown	1	1999-12-29	renee.brown178@example.edu
99	Eric	Martin	1	2001-07-31	eric.martin471@example.edu
100	Jenna	Reed	4	2006-07-11	jenna.reed935@example.edu
101	Patty	Singleton	4	2001-01-02	patty.singleton546@example.edu
102	Cynthia	Pierce	4	2000-01-01	cynthia.pierce351@example.edu
103	Kevin	Ferguson	1	2003-01-08	kevin.ferguson560@example.edu
104	Gary	David	4	2000-03-26	gary.david363@example.edu
105	Donna	Le	1	2003-11-03	donna.le693@example.edu
106	Megan	Elliott	1	2005-08-07	megan.elliott791@example.edu
107	Anthony	Williams	1	2004-02-17	anthony.williams889@example.edu
108	Barbara	Curtis	1	2005-02-18	barbara.curtis739@example.edu
109	Robert	Fowler	4	2002-12-25	robert.fowler698@example.edu
110	Courtney	Roberts	4	2006-08-26	courtney.roberts659@example.edu
111	Timothy	Ballard	1	2004-06-23	timothy.ballard823@example.edu
112	Kenneth	Jones	1	1999-06-25	kenneth.jones710@example.edu
113	Scott	Washington	1	2000-08-18	scott.washington271@example.edu
114	Catherine	Edwards	4	2004-09-29	catherine.edwards625@example.edu
115	Jessica	Valencia	4	2006-10-20	jessica.valencia496@example.edu
116	David	Wood	1	2003-06-29	david.wood197@example.edu
117	Luis	Owens	1	2001-02-20	luis.owens981@example.edu
118	John	Davis	1	2001-04-27	john.davis253@example.edu
119	Patrick	Gilbert	4	2000-12-26	patrick.gilbert286@example.edu
120	Michelle	Moore	4	2001-08-14	michelle.moore572@example.edu
121	Becky	Edwards	4	2005-02-07	becky.edwards306@example.edu
122	Tyrone	Robertson	1	2002-12-27	tyrone.robertson231@example.edu
123	Kyle	Johnson	1	2006-07-24	kyle.johnson965@example.edu
124	William	Levy	1	2000-09-20	william.levy997@example.edu
125	Michael	Williams	4	2002-12-16	michael.williams305@example.edu
126	Nicole	Pena	4	2002-10-06	nicole.pena790@example.edu
127	Amanda	Boone	1	2002-06-12	amanda.boone296@example.edu
128	Nicole	Luna	1	2005-02-09	nicole.luna722@example.edu
129	Michael	Morales	1	2003-07-24	michael.morales213@example.edu
130	James	Tran	1	1999-08-03	james.tran707@example.edu
131	William	Duran	1	2001-03-28	william.duran722@example.edu
132	Veronica	Becker	4	1999-12-14	veronica.becker501@example.edu
133	Theresa	Long	1	2005-05-10	theresa.long325@example.edu
134	Matthew	Mcmillan	1	2005-01-14	matthew.mcmillan492@example.edu
135	James	Hicks	1	2002-12-31	james.hicks358@example.edu
136	Brandon	Taylor	4	2001-08-30	brandon.taylor574@example.edu
137	Thomas	Bryant	4	2003-11-06	thomas.bryant957@example.edu
138	Zachary	Murphy	1	2003-11-26	zachary.murphy957@example.edu
139	Francisco	Ewing	1	2004-11-29	francisco.ewing815@example.edu
140	Kevin	Rogers	1	2005-08-16	kevin.rogers739@example.edu
141	Amanda	Erickson	1	2001-05-25	amanda.erickson281@example.edu
142	Lisa	Richardson	1	2004-05-22	lisa.richardson295@example.edu
143	Tina	Silva	1	2005-05-16	tina.silva125@example.edu
144	Jessica	Watts	1	1999-03-19	jessica.watts588@example.edu
145	Thomas	Coffey	4	2005-04-05	thomas.coffey693@example.edu
146	Kimberly	Lane	1	2004-10-08	kimberly.lane557@example.edu
147	Brandy	Jackson	4	2004-01-12	brandy.jackson389@example.edu
148	Christine	Randall	1	2000-03-07	christine.randall918@example.edu
149	Erin	Johnson	1	2006-08-01	erin.johnson405@example.edu
150	Daniel	Smith	4	2001-07-05	daniel.smith839@example.edu
151	Edward	Vaughn	4	2002-04-13	edward.vaughn354@example.edu
152	Kimberly	Knapp	4	2005-12-24	kimberly.knapp978@example.edu
153	Jill	Brown	1	2000-02-08	jill.brown792@example.edu
154	Jared	Nguyen	4	2004-04-18	jared.nguyen824@example.edu
155	Alicia	Edwards	4	2000-05-20	alicia.edwards150@example.edu
156	Rhonda	Peterson	1	2001-10-31	rhonda.peterson298@example.edu
157	Kelsey	Le	4	2004-02-23	kelsey.le44@example.edu
158	Heather	Bishop	1	2000-07-15	heather.bishop295@example.edu
159	John	Grant	1	2000-10-18	john.grant979@example.edu
160	Teresa	Evans	1	2001-04-24	teresa.evans732@example.edu
161	Jared	Bush	4	2001-07-15	jared.bush81@example.edu
162	Michael	Peck	1	2005-05-12	michael.peck355@example.edu
163	Joshua	Martinez	4	2004-05-30	joshua.martinez947@example.edu
164	Noah	Baird	1	2005-07-18	noah.baird453@example.edu
165	Stephanie	Ballard	1	2001-04-28	stephanie.ballard672@example.edu
166	Keith	Klein	1	2001-10-08	keith.klein263@example.edu
167	Scott	Scott	1	2002-10-31	scott.scott766@example.edu
168	James	Ryan	4	2006-06-18	james.ryan491@example.edu
169	Heather	Taylor	4	2003-12-04	heather.taylor220@example.edu
170	Brenda	Sanchez	4	2004-05-10	brenda.sanchez207@example.edu
171	Amanda	Little	1	1999-06-03	amanda.little848@example.edu
172	Robert	Love	1	1999-10-21	robert.love552@example.edu
173	Kelli	Smith	4	2003-05-27	kelli.smith278@example.edu
174	Sarah	Russell	1	2006-06-24	sarah.russell956@example.edu
175	Natalie	Woods	1	2000-08-05	natalie.woods576@example.edu
176	Tamara	Morris	1	2004-03-01	tamara.morris713@example.edu
177	Rebecca	Davis	1	2003-08-05	rebecca.davis279@example.edu
178	Amanda	Sharp	2	2006-06-29	amanda.sharp141@example.edu
179	Robin	Thompson	2	2006-01-21	robin.thompson112@example.edu
180	Gregory	Gillespie	1	2006-12-22	gregory.gillespie631@example.edu
181	Randy	Simpson	1	2006-06-28	randy.simpson759@example.edu
182	Suzanne	Howe	1	2006-01-04	suzanne.howe601@example.edu
183	Albert	Bradley	2	1999-11-10	albert.bradley246@example.edu
184	Tonya	Mitchell	1	2006-11-29	tonya.mitchell249@example.edu
185	Amy	Snyder	2	2006-07-04	amy.snyder52@example.edu
186	Melissa	Mcdonald	1	2000-07-17	melissa.mcdonald686@example.edu
187	Daniel	Martin	2	2002-09-02	daniel.martin927@example.edu
188	Jonathan	Lopez	1	2004-11-21	jonathan.lopez544@example.edu
189	Krystal	Bradley	1	2005-01-21	krystal.bradley232@example.edu
190	Gregory	Chase	2	2006-03-05	gregory.chase654@example.edu
191	Margaret	Robertson	1	1999-09-11	margaret.robertson239@example.edu
192	Elizabeth	Lopez	1	2000-02-15	elizabeth.lopez54@example.edu
193	Marcus	Wright	2	2001-01-31	marcus.wright103@example.edu
194	Joe	Molina	1	2006-08-18	joe.molina424@example.edu
195	Kevin	Sharp	1	1999-02-03	kevin.sharp339@example.edu
196	Desiree	Schwartz	1	1999-07-01	desiree.schwartz735@example.edu
197	David	Parker	2	2002-03-30	david.parker484@example.edu
198	Wayne	Jacobson	1	2004-08-17	wayne.jacobson103@example.edu
199	Larry	Wilson	1	2006-04-30	larry.wilson698@example.edu
200	Kenneth	Mendez	1	2000-10-02	kenneth.mendez790@example.edu
201	Dennis	Hernandez	1	2004-12-24	dennis.hernandez141@example.edu
202	Catherine	Perry	1	2003-05-24	catherine.perry6@example.edu
203	Thomas	Medina	1	2004-04-23	thomas.medina988@example.edu
204	Jeffery	Wright	1	2005-01-13	jeffery.wright564@example.edu
205	Morgan	Miller	2	2002-07-28	morgan.miller952@example.edu
206	Jane	Miller	1	2003-07-06	jane.miller162@example.edu
207	Bryan	Kelley	1	2003-01-16	bryan.kelley417@example.edu
208	Ashley	Hernandez	2	2001-08-16	ashley.hernandez669@example.edu
209	Abigail	Wilson	1	2000-08-22	abigail.wilson958@example.edu
210	Brandy	Davis	1	2003-01-30	brandy.davis902@example.edu
211	Lindsey	Chavez	2	2003-02-08	lindsey.chavez900@example.edu
212	Stephen	Brown	1	2002-09-12	stephen.brown488@example.edu
213	Lindsay	Cummings	2	2002-03-02	lindsay.cummings489@example.edu
214	Lisa	Reese	1	2003-08-17	lisa.reese667@example.edu
215	Brandon	Cooper	1	1999-07-06	brandon.cooper205@example.edu
216	Virginia	Michael	2	1999-07-21	virginia.michael775@example.edu
217	Sarah	Johnson	2	2002-04-09	sarah.johnson988@example.edu
218	Kayla	Cannon	1	2006-10-28	kayla.cannon295@example.edu
219	Debbie	Fisher	1	2006-12-10	debbie.fisher329@example.edu
220	Patrick	Kane	1	2006-04-02	patrick.kane293@example.edu
221	Nicholas	Vega	1	2004-04-17	nicholas.vega662@example.edu
222	Amber	Valdez	2	2001-10-12	amber.valdez61@example.edu
223	Gregory	Medina	1	2003-03-25	gregory.medina930@example.edu
224	Jessica	Walker	2	1999-01-11	jessica.walker788@example.edu
225	Andrew	Evans	1	2004-05-21	andrew.evans92@example.edu
226	Amy	Patel	1	2005-08-02	amy.patel668@example.edu
227	John	Reed	1	2001-03-16	john.reed588@example.edu
228	Sharon	Hardy	2	1999-11-26	sharon.hardy238@example.edu
229	Lisa	Barnes	2	2005-02-15	lisa.barnes548@example.edu
230	Nicole	Smith	2	2000-08-24	nicole.smith757@example.edu
231	Craig	Johnson	1	2003-10-13	craig.johnson741@example.edu
232	Jacqueline	Williams	1	2004-12-03	jacqueline.williams871@example.edu
233	Richard	Young	2	2000-09-26	richard.young960@example.edu
234	Michelle	Brown	1	2003-01-11	michelle.brown39@example.edu
235	Keith	Cabrera	1	2004-11-06	keith.cabrera936@example.edu
236	Luis	Harper	1	2004-05-18	luis.harper944@example.edu
237	Malik	Turner	1	2000-02-23	malik.turner180@example.edu
238	Donna	Walker	1	2001-05-27	donna.walker428@example.edu
239	Bruce	Fry	1	2006-01-13	bruce.fry904@example.edu
240	Rhonda	Garrett	1	2002-06-01	rhonda.garrett858@example.edu
241	Tyler	Compton	1	2006-07-13	tyler.compton181@example.edu
242	Emily	Floyd	1	2001-07-20	emily.floyd957@example.edu
243	Robert	Hernandez	1	2002-01-04	robert.hernandez942@example.edu
244	Karen	Wells	1	2005-10-16	karen.wells38@example.edu
245	Kevin	Zimmerman	1	2005-06-11	kevin.zimmerman857@example.edu
246	Robin	Hart	2	2006-09-27	robin.hart407@example.edu
247	Angela	Anderson	1	2000-12-10	angela.anderson807@example.edu
248	James	Lucas	1	2006-05-17	james.lucas508@example.edu
249	Melanie	Davis	1	2004-10-17	melanie.davis191@example.edu
250	James	Adams	1	2004-05-21	james.adams960@example.edu
251	Carrie	Russo	2	2000-07-03	carrie.russo767@example.edu
252	Kathleen	Ramsey	2	2003-06-21	kathleen.ramsey986@example.edu
253	Timothy	Booth	1	2001-08-30	timothy.booth894@example.edu
254	Susan	Smith	2	2006-06-30	susan.smith949@example.edu
255	Suzanne	Wilson	1	2006-12-29	suzanne.wilson297@example.edu
256	Timothy	Sanchez	1	2003-11-01	timothy.sanchez898@example.edu
257	James	Herman	2	2003-06-01	james.herman39@example.edu
258	Kimberly	James	1	2003-04-08	kimberly.james10@example.edu
259	Michael	Green	1	2003-02-06	michael.green306@example.edu
260	Tyler	Garcia	2	2006-11-06	tyler.garcia582@example.edu
261	Terrance	Franco	1	2006-04-24	terrance.franco618@example.edu
262	Nathan	Gutierrez	2	2003-07-02	nathan.gutierrez110@example.edu
263	Jeffrey	Thomas	2	2001-01-31	jeffrey.thomas951@example.edu
264	Sarah	Riley	1	2002-05-04	sarah.riley344@example.edu
265	Elijah	Rivera	1	2002-01-14	elijah.rivera292@example.edu
266	Martha	Porter	2	2004-03-27	martha.porter466@example.edu
267	Gail	Scott	1	2005-07-27	gail.scott657@example.edu
268	Tammy	May	1	2002-12-04	tammy.may557@example.edu
269	Gary	Norton	2	2000-05-09	gary.norton537@example.edu
270	Jennifer	Freeman	1	2006-05-02	jennifer.freeman506@example.edu
271	Amber	May	1	1999-06-21	amber.may911@example.edu
272	Arthur	Bradford	1	2006-07-23	arthur.bradford962@example.edu
273	Elizabeth	Duran	1	2002-04-19	elizabeth.duran138@example.edu
274	Megan	Hall	1	2004-08-27	megan.hall872@example.edu
275	Albert	Wagner	2	2001-12-26	albert.wagner517@example.edu
276	Christine	Estrada	1	2003-12-06	christine.estrada480@example.edu
277	Timothy	Freeman	2	1999-01-20	timothy.freeman280@example.edu
278	Andrea	Smith	1	2003-03-27	andrea.smith198@example.edu
279	Joshua	Madden	1	1999-02-20	joshua.madden829@example.edu
280	Lisa	Craig	2	2005-06-12	lisa.craig116@example.edu
281	Renee	Rodriguez	1	1999-10-09	renee.rodriguez339@example.edu
282	Eduardo	Lee	1	2003-03-18	eduardo.lee167@example.edu
283	Lisa	Adams	1	2002-03-05	lisa.adams749@example.edu
284	Nathan	Sullivan	2	2003-07-09	nathan.sullivan470@example.edu
285	Veronica	Perez	1	2004-06-21	veronica.perez664@example.edu
286	Melanie	Valdez	1	2005-11-11	melanie.valdez264@example.edu
287	Katherine	Davis	2	2002-01-12	katherine.davis736@example.edu
288	Angela	Brown	2	1999-01-28	angela.brown191@example.edu
289	George	Porter	1	2002-06-21	george.porter15@example.edu
290	Kristen	Knight	1	2005-11-11	kristen.knight755@example.edu
291	Cody	Rice	1	1999-05-05	cody.rice346@example.edu
292	Jason	Parrish	2	2006-02-05	jason.parrish810@example.edu
293	Thomas	Williams	1	1999-08-06	thomas.williams303@example.edu
294	Sara	Lam	2	2003-07-05	sara.lam582@example.edu
295	Antonio	Mcfarland	1	2001-07-07	antonio.mcfarland691@example.edu
296	Suzanne	Matthews	1	2005-01-06	suzanne.matthews776@example.edu
297	Jennifer	Sanders	1	1999-08-13	jennifer.sanders198@example.edu
298	Francisco	Allen	1	2005-09-04	francisco.allen180@example.edu
299	Paul	Mosley	1	2001-08-26	paul.mosley626@example.edu
300	Karla	Taylor	2	2006-11-27	karla.taylor877@example.edu
301	Jennifer	Mason	2	2006-10-16	jennifer.mason655@example.edu
302	Brian	Kim	1	2005-09-15	brian.kim919@example.edu
303	Matthew	Mack	1	2006-08-21	matthew.mack416@example.edu
304	Randy	Ayala	1	1999-03-28	randy.ayala847@example.edu
305	Joshua	Riddle	1	2002-12-04	joshua.riddle438@example.edu
306	Michael	Pugh	1	2002-06-15	michael.pugh528@example.edu
307	Erin	Guerrero	2	1999-09-08	erin.guerrero336@example.edu
308	Christine	Yates	1	2004-09-13	christine.yates89@example.edu
309	Christopher	Moore	2	2004-09-09	christopher.moore411@example.edu
310	Cynthia	Singh	1	2001-07-14	cynthia.singh686@example.edu
311	Daniel	Smith	2	2001-06-19	daniel.smith98@example.edu
312	Michael	Nelson	1	2000-01-23	michael.nelson190@example.edu
313	Jacob	Cole	1	2003-06-09	jacob.cole144@example.edu
314	Ricky	Johnson	1	2001-10-30	ricky.johnson489@example.edu
315	Christopher	George	2	2001-08-05	christopher.george332@example.edu
316	Paul	Carter	2	2002-02-06	paul.carter959@example.edu
317	Christopher	Santana	1	2006-03-29	christopher.santana255@example.edu
318	Tiffany	Armstrong	1	2000-05-10	tiffany.armstrong7@example.edu
319	Oscar	Taylor	2	2001-05-29	oscar.taylor268@example.edu
320	Trevor	Brown	1	2002-06-23	trevor.brown393@example.edu
321	Robert	Washington	2	1999-08-13	robert.washington242@example.edu
322	Johnathan	Wright	2	2003-12-31	johnathan.wright458@example.edu
323	Brittney	Gonzalez	1	1999-11-09	brittney.gonzalez772@example.edu
324	Kevin	Rush	1	2001-08-28	kevin.rush274@example.edu
325	Christine	Brock	2	2001-08-20	christine.brock977@example.edu
326	Matthew	Ochoa	2	2005-11-15	matthew.ochoa338@example.edu
327	Terri	Taylor	1	2001-07-25	terri.taylor310@example.edu
328	Stacey	Harris	2	2001-07-06	stacey.harris597@example.edu
329	Tamara	Novak	2	2001-05-01	tamara.novak741@example.edu
330	Heather	Henry	1	2003-08-10	heather.henry587@example.edu
331	John	Bennett	1	2005-07-12	john.bennett12@example.edu
332	Phillip	Wilson	1	2003-07-06	phillip.wilson268@example.edu
333	Brittany	Gardner	1	2004-06-14	brittany.gardner670@example.edu
334	Andrea	Benton	1	2002-09-10	andrea.benton369@example.edu
335	Jeanette	Gonzales	1	2001-04-30	jeanette.gonzales710@example.edu
336	Heather	Fuentes	1	2005-05-13	heather.fuentes242@example.edu
337	Robert	Porter	1	2004-01-24	robert.porter64@example.edu
338	John	Hopkins	2	2004-09-20	john.hopkins684@example.edu
339	Kristina	Jones	1	2006-12-03	kristina.jones122@example.edu
340	Timothy	Morales	1	2003-01-19	timothy.morales477@example.edu
341	Samantha	Holt	1	2003-05-07	samantha.holt315@example.edu
342	Krystal	Ward	1	2006-02-28	krystal.ward164@example.edu
343	Amanda	Little	1	1999-09-06	amanda.little416@example.edu
344	Kayla	Sandoval	1	2001-11-02	kayla.sandoval703@example.edu
345	Deborah	Williams	2	2006-11-13	deborah.williams515@example.edu
346	Erica	Ross	1	2005-01-07	erica.ross946@example.edu
347	Tammy	Jordan	1	1999-01-31	tammy.jordan917@example.edu
348	Jonathan	Dixon	2	2003-02-24	jonathan.dixon910@example.edu
349	Beverly	Johnston	1	2002-07-26	beverly.johnston721@example.edu
350	Peter	Barton	1	2003-09-16	peter.barton789@example.edu
351	Vincent	Cooper	1	1999-03-13	vincent.cooper319@example.edu
352	Dan	Perry	2	2006-09-10	dan.perry707@example.edu
353	Darren	Shepard	1	2000-02-18	darren.shepard121@example.edu
354	Larry	Gibson	2	2000-08-27	larry.gibson655@example.edu
355	Timothy	Alvarez	2	2002-07-03	timothy.alvarez939@example.edu
356	Heather	Flores	2	2001-05-27	heather.flores964@example.edu
357	Lisa	Wilson	1	2005-10-16	lisa.wilson303@example.edu
358	Deborah	Byrd	1	2000-04-25	deborah.byrd377@example.edu
359	Tonya	Sanchez	1	2000-05-24	tonya.sanchez630@example.edu
360	Ethan	Castro	1	2006-08-31	ethan.castro227@example.edu
361	Jesse	Sullivan	1	2000-06-22	jesse.sullivan225@example.edu
362	Danielle	Reynolds	1	1999-03-27	danielle.reynolds981@example.edu
363	Christina	Gonzalez	2	2003-09-26	christina.gonzalez137@example.edu
364	Paul	Bush	2	2000-08-24	paul.bush490@example.edu
365	Karen	Stokes	1	1999-07-02	karen.stokes157@example.edu
366	Cristian	Wiggins	2	2000-06-30	cristian.wiggins466@example.edu
367	Mark	Ellis	1	2001-02-05	mark.ellis766@example.edu
368	Michelle	Rose	2	2004-02-10	michelle.rose621@example.edu
369	Candice	Carr	1	2003-09-11	candice.carr383@example.edu
370	Michael	Bruce	1	2003-12-09	michael.bruce426@example.edu
371	Lisa	Mccarthy	1	2001-05-18	lisa.mccarthy719@example.edu
372	Christina	Miller	1	2000-01-27	christina.miller563@example.edu
373	David	Torres	2	2000-06-18	david.torres935@example.edu
374	Heather	Dixon	1	2002-05-06	heather.dixon483@example.edu
375	Devin	Reyes	2	2000-06-26	devin.reyes776@example.edu
376	Cynthia	Steele	1	2004-02-28	cynthia.steele551@example.edu
377	Zoe	Peters	1	2002-12-01	zoe.peters822@example.edu
378	Donald	Edwards	1	2002-08-10	donald.edwards681@example.edu
379	Brian	Howard	1	1999-01-28	brian.howard846@example.edu
380	Derrick	Ochoa	1	2006-09-16	derrick.ochoa224@example.edu
381	William	Simpson	1	2004-06-22	william.simpson781@example.edu
382	Robert	Larsen	1	2002-11-28	robert.larsen254@example.edu
383	Christopher	Johnson	1	2005-02-01	christopher.johnson697@example.edu
384	Kelly	Hill	2	2003-04-20	kelly.hill773@example.edu
385	Gary	Ellis	1	2004-12-08	gary.ellis611@example.edu
386	Katie	Dunn	1	1999-11-27	katie.dunn895@example.edu
387	Danny	Hampton	1	2005-08-01	danny.hampton807@example.edu
388	Michael	Carson	2	1999-05-02	michael.carson84@example.edu
389	Jennifer	Payne	1	2006-12-01	jennifer.payne539@example.edu
390	Curtis	Greer	1	2005-01-03	curtis.greer458@example.edu
391	Kenneth	Kidd	2	2002-08-06	kenneth.kidd541@example.edu
392	Michael	Montoya	1	2002-07-06	michael.montoya721@example.edu
393	Victoria	Rowe	1	2000-11-23	victoria.rowe371@example.edu
394	Lisa	Matthews	2	2001-10-21	lisa.matthews80@example.edu
395	Jennifer	Chen	1	2000-04-29	jennifer.chen940@example.edu
396	Donald	Clark	1	2000-08-27	donald.clark578@example.edu
397	Brian	Bell	2	2001-04-01	brian.bell115@example.edu
398	Amber	Morris	1	2004-08-18	amber.morris64@example.edu
399	Keith	Adams	1	2005-11-11	keith.adams849@example.edu
400	Tricia	Shelton	2	1999-10-06	tricia.shelton561@example.edu
401	Sydney	Floyd	1	2006-05-07	sydney.floyd925@example.edu
402	Victoria	Camacho	1	2000-01-06	victoria.camacho518@example.edu
403	Michelle	Wright	1	2004-09-08	michelle.wright208@example.edu
404	Maria	Juarez	1	2004-05-29	maria.juarez587@example.edu
405	Tracy	Ray	2	2001-02-23	tracy.ray550@example.edu
406	Robert	Hayes	1	2004-01-25	robert.hayes154@example.edu
407	Nicole	Davis	1	2003-02-15	nicole.davis169@example.edu
408	Joshua	Mayer	1	2001-12-14	joshua.mayer336@example.edu
409	Stephanie	Murphy	2	1999-01-08	stephanie.murphy875@example.edu
410	Kim	Oconnor	1	2004-11-05	kim.oconnor533@example.edu
411	Stephen	Beck	2	2001-11-12	stephen.beck453@example.edu
412	Bryan	Ferguson	1	2000-09-28	bryan.ferguson120@example.edu
413	Russell	Lewis	1	2001-02-23	russell.lewis697@example.edu
414	Maria	Morgan	1	2003-08-16	maria.morgan211@example.edu
415	Ashlee	Washington	2	2001-10-01	ashlee.washington735@example.edu
416	Felicia	Williams	1	1999-10-18	felicia.williams598@example.edu
417	Kristen	Stevens	2	1999-12-29	kristen.stevens501@example.edu
418	Mia	Alexander	1	1999-01-02	mia.alexander94@example.edu
419	Susan	Harris	1	2004-07-04	susan.harris921@example.edu
420	David	Santos	1	2000-04-09	david.santos523@example.edu
421	Sarah	Hill	1	2004-03-27	sarah.hill457@example.edu
422	John	Watson	1	2006-03-25	john.watson829@example.edu
423	Gabriel	Sanders	2	2001-06-11	gabriel.sanders57@example.edu
424	Holly	Young	1	2004-03-29	holly.young465@example.edu
425	Jane	Smith	2	2002-10-24	jane.smith136@example.edu
426	David	Perez	2	2004-06-09	david.perez526@example.edu
427	Albert	Dominguez	2	2005-07-14	albert.dominguez426@example.edu
428	Vanessa	Henderson	1	2000-01-22	vanessa.henderson468@example.edu
429	Chad	Reyes	1	2004-11-04	chad.reyes578@example.edu
430	Curtis	Edwards	1	2006-01-17	curtis.edwards60@example.edu
\.


--
-- TOC entry 3268 (class 0 OID 16412)
-- Dependencies: 202
-- Data for Name: registration; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.registration (pid, cid) FROM stdin;
61	5
61	9
61	7
61	30
61	29
62	24
62	25
62	4
62	2
62	26
63	22
63	14
63	20
63	25
63	30
64	29
64	1
64	8
64	7
64	3
65	4
65	20
65	2
65	15
65	22
66	23
66	28
66	2
66	8
66	24
67	2
67	13
67	15
67	8
67	18
68	7
68	25
68	28
68	2
68	5
69	17
69	10
69	8
69	27
69	30
70	24
70	19
70	11
70	20
70	25
71	22
71	27
71	11
71	8
71	10
72	29
72	5
72	22
72	17
72	8
73	14
73	10
73	9
73	2
73	18
74	19
74	29
74	24
74	30
74	6
75	21
75	22
75	14
75	18
75	16
76	2
76	12
76	21
76	22
76	13
77	26
77	17
77	11
77	23
77	14
78	14
78	5
78	10
78	13
78	6
79	25
79	18
79	16
79	8
79	28
80	8
80	10
80	28
80	23
80	5
81	26
81	15
81	30
81	2
81	18
82	14
82	18
82	17
82	5
82	13
83	8
83	9
83	7
83	11
83	21
84	3
84	30
84	15
84	28
84	12
85	3
85	18
85	24
85	27
85	7
86	2
86	9
86	13
86	22
86	20
87	20
87	2
87	28
87	3
87	7
88	26
88	25
88	19
88	24
88	22
89	18
89	7
89	16
89	28
89	30
90	11
90	10
90	30
90	1
90	7
91	30
91	7
91	24
91	4
91	25
92	16
92	30
92	8
92	23
92	20
93	23
93	7
93	13
93	30
93	8
94	18
94	11
94	25
94	10
94	13
95	15
95	18
95	21
95	12
95	10
96	9
96	12
96	17
96	29
96	16
97	15
97	4
97	26
97	24
97	16
98	25
98	27
98	11
98	30
98	7
99	12
99	11
99	14
99	2
99	19
100	28
100	8
100	24
100	5
100	1
101	9
101	18
101	30
101	19
101	24
102	14
102	10
102	5
102	7
102	11
103	8
103	13
103	19
103	27
103	16
104	18
104	21
104	22
104	11
104	9
105	25
105	27
105	16
105	24
105	21
106	24
106	16
106	15
106	6
106	26
107	12
107	6
107	5
107	24
107	18
108	16
108	6
108	30
108	29
108	18
109	21
109	2
109	17
109	27
109	28
110	3
110	27
110	22
110	2
110	25
111	1
111	14
111	5
111	27
111	21
112	8
112	3
112	23
112	5
112	1
113	7
113	17
113	15
113	12
113	2
114	20
114	21
114	22
114	30
114	16
115	22
115	16
115	1
115	18
115	14
116	1
116	17
116	24
116	9
116	18
117	10
117	1
117	17
117	27
117	23
118	22
118	14
118	26
118	30
118	6
119	4
119	30
119	17
119	5
119	8
120	7
120	20
120	17
120	9
120	27
121	12
121	9
121	26
121	13
121	3
122	12
122	13
122	15
122	19
122	8
123	23
123	8
123	10
123	22
123	27
124	28
124	3
124	21
124	25
124	2
125	3
125	13
125	18
125	16
125	2
126	21
126	1
126	23
126	6
126	3
127	16
127	28
127	14
127	21
127	26
128	11
128	19
128	28
128	4
128	29
129	17
129	30
129	2
129	8
129	7
130	29
130	28
130	23
130	19
130	16
131	9
131	2
131	30
131	3
131	22
132	30
132	9
132	29
132	18
132	19
133	22
133	2
133	6
133	30
133	28
134	11
134	1
134	7
134	19
134	5
135	25
135	27
135	23
135	13
135	30
136	3
136	10
136	6
136	19
136	8
137	19
137	27
137	28
137	13
137	22
138	29
138	18
138	11
138	13
138	25
139	24
139	5
139	26
139	23
139	3
140	17
140	24
140	12
140	2
140	4
141	14
141	8
141	27
141	3
141	11
142	20
142	25
142	13
142	11
142	1
143	21
143	9
143	26
143	15
143	16
144	8
144	12
144	18
144	13
144	14
145	6
145	22
145	19
145	13
145	3
146	25
146	20
146	10
146	26
146	8
147	23
147	3
147	9
147	5
147	13
148	23
148	26
148	21
148	5
148	24
149	13
149	11
149	12
149	4
149	3
150	1
150	10
150	15
150	12
150	25
151	9
151	4
151	5
151	3
151	6
152	14
152	15
152	18
152	17
152	4
153	1
153	3
153	12
153	18
153	20
154	20
154	26
154	11
154	28
154	13
155	1
155	10
155	14
155	13
155	25
156	3
156	24
156	29
156	18
156	8
157	19
157	17
157	6
157	22
157	13
158	6
158	5
158	9
158	10
158	16
159	5
159	3
159	6
159	14
159	9
160	14
160	10
160	16
160	26
160	3
161	12
161	9
161	8
161	24
161	21
162	16
162	20
162	7
162	15
162	4
163	5
163	10
163	1
163	13
163	11
164	27
164	20
164	13
164	26
164	28
165	11
165	15
165	14
165	27
165	28
166	21
166	20
166	5
166	10
166	11
167	20
167	23
167	7
167	16
167	11
168	6
168	13
168	11
168	10
168	24
169	23
169	21
169	16
169	19
169	26
170	8
170	11
170	13
170	9
170	27
171	26
171	13
171	12
171	4
171	30
172	19
172	7
172	18
172	6
172	22
173	25
173	18
173	1
173	24
173	15
174	23
174	7
174	15
174	26
174	10
175	27
175	23
175	3
175	28
175	26
176	26
176	14
176	22
176	16
176	5
177	21
177	10
177	8
177	9
177	22
178	5
178	23
178	14
178	26
178	13
179	3
179	15
179	20
179	16
179	19
180	13
180	18
180	17
180	30
180	28
181	23
181	14
181	18
181	2
181	26
182	12
182	23
182	29
182	26
182	18
183	20
183	21
183	30
183	3
183	4
184	25
184	8
184	22
184	12
184	6
185	21
185	20
185	2
185	19
185	22
186	21
186	13
186	25
186	11
186	26
187	14
187	4
187	1
187	9
187	8
188	17
188	24
188	18
188	19
188	23
189	19
189	8
189	15
189	12
189	13
190	15
190	25
190	22
190	19
190	23
191	17
191	5
191	12
191	1
191	16
192	4
192	10
192	14
192	30
192	3
193	4
193	27
193	24
193	5
193	12
194	10
194	11
194	15
194	26
194	7
195	17
195	16
195	12
195	4
195	15
196	24
196	23
196	15
196	11
196	3
197	10
197	2
197	26
197	23
197	4
198	1
198	28
198	11
198	21
198	4
199	22
199	26
199	6
199	30
199	24
200	8
200	17
200	6
200	18
200	11
201	18
201	14
201	15
201	8
201	26
202	13
202	21
202	6
202	22
202	14
203	13
203	1
203	24
203	20
203	29
204	7
204	15
204	19
204	14
204	13
205	1
205	23
205	7
205	9
205	25
206	23
206	26
206	3
206	19
206	4
207	26
207	28
207	18
207	6
207	12
208	11
208	7
208	15
208	4
208	9
209	22
209	28
209	16
209	17
209	21
210	11
210	20
210	13
210	19
210	4
211	12
211	28
211	15
211	20
211	6
212	27
212	22
212	23
212	26
212	10
213	30
213	20
213	19
213	3
213	22
214	5
214	11
214	4
214	8
214	10
215	4
215	6
215	12
215	23
215	5
216	17
216	13
216	14
216	20
216	5
217	19
217	13
217	14
217	6
217	16
218	21
218	18
218	23
218	30
218	6
219	18
219	6
219	16
219	10
219	5
220	6
220	11
220	27
220	15
220	20
221	2
221	28
221	12
221	1
221	16
222	5
222	7
222	27
222	13
222	18
223	17
223	21
223	16
223	14
223	22
224	16
224	14
224	23
224	27
224	15
225	16
225	6
225	3
225	19
225	1
226	26
226	25
226	8
226	10
226	2
227	9
227	8
227	18
227	10
227	6
228	25
228	15
228	19
228	24
228	16
229	18
229	17
229	4
229	19
229	9
230	25
230	18
230	27
230	12
230	2
231	25
231	24
231	15
231	18
231	7
232	14
232	4
232	24
232	27
232	21
233	25
233	8
233	10
233	28
233	2
234	15
234	9
234	12
234	28
234	27
235	3
235	15
235	28
235	4
235	25
236	26
236	8
236	7
236	24
236	19
237	23
237	12
237	28
237	20
237	21
238	14
238	6
238	20
238	5
238	26
239	7
239	27
239	26
239	2
239	19
240	12
240	18
240	9
240	20
240	6
241	11
241	23
241	10
241	19
241	9
242	28
242	17
242	29
242	22
242	27
243	4
243	5
243	25
243	26
243	14
244	30
244	2
244	9
244	28
244	21
245	5
245	23
245	28
245	8
245	11
246	27
246	8
246	25
246	22
246	13
247	16
247	5
247	19
247	21
247	9
248	21
248	14
248	13
248	15
248	3
249	21
249	26
249	29
249	25
249	3
250	13
250	17
250	24
250	9
250	23
251	30
251	29
251	12
251	15
251	16
252	11
252	19
252	1
252	28
252	25
253	28
253	24
253	3
253	15
253	21
254	22
254	23
254	12
254	28
254	3
255	26
255	18
255	13
255	7
255	14
256	27
256	7
256	16
256	9
256	11
257	27
257	10
257	11
257	18
257	19
258	5
258	19
258	28
258	16
258	26
259	11
259	29
259	22
259	25
259	2
260	2
260	4
260	21
260	26
260	27
261	15
261	1
261	4
261	30
261	28
262	6
262	15
262	1
262	14
262	7
263	23
263	30
263	5
263	29
263	21
264	10
264	6
264	28
264	30
264	29
265	9
265	3
265	21
265	12
265	22
266	29
266	21
266	6
266	2
266	13
267	21
267	10
267	24
267	23
267	25
268	8
268	14
268	21
268	3
268	23
269	4
269	1
269	7
269	16
269	3
270	5
270	19
270	8
270	17
270	22
271	15
271	1
271	23
271	11
271	27
272	4
272	28
272	14
272	23
272	5
273	16
273	3
273	8
273	13
273	24
274	26
274	4
274	11
274	12
274	29
275	10
275	5
275	13
275	25
275	27
276	25
276	28
276	5
276	21
276	22
277	5
277	3
277	17
277	19
277	1
278	20
278	21
278	6
278	15
278	12
279	24
279	7
279	21
279	5
279	30
280	14
280	20
280	22
280	15
280	28
281	7
281	3
281	29
281	4
281	5
282	25
282	4
282	19
282	24
282	13
283	12
283	14
283	11
283	26
283	5
284	8
284	9
284	21
284	3
284	18
285	20
285	24
285	10
285	25
285	23
286	1
286	28
286	22
286	29
286	10
287	7
287	17
287	20
287	24
287	13
288	10
288	21
288	2
288	26
288	29
289	26
289	8
289	16
289	13
289	4
290	8
290	16
290	21
290	20
290	3
291	17
291	29
291	1
291	12
291	30
292	11
292	5
292	13
292	28
292	27
293	19
293	14
293	12
293	18
293	22
294	6
294	25
294	16
294	3
294	1
295	19
295	3
295	1
295	9
295	7
296	2
296	30
296	26
296	13
296	17
297	10
297	21
297	23
297	17
297	25
298	14
298	23
298	13
298	3
298	21
299	18
299	20
299	5
299	9
299	3
300	10
300	3
300	17
300	30
300	7
301	26
301	5
301	18
301	11
301	13
302	19
302	21
302	25
302	27
302	22
303	21
303	3
303	10
303	23
303	14
304	24
304	28
304	8
304	2
304	3
305	30
305	14
305	4
305	15
305	20
306	20
306	2
306	10
306	22
306	24
307	22
307	24
307	6
307	4
307	1
308	23
308	5
308	1
308	6
308	16
309	12
309	17
309	26
309	27
309	24
310	9
310	6
310	12
310	5
310	24
311	25
311	28
311	9
311	24
311	29
312	4
312	25
312	29
312	1
312	11
313	26
313	14
313	9
313	17
313	3
314	9
314	23
314	19
314	21
314	3
315	16
315	15
315	17
315	12
315	2
316	16
316	28
316	19
316	6
316	12
317	6
317	9
317	25
317	4
317	29
318	19
318	22
318	24
318	4
318	8
319	24
319	17
319	1
319	2
319	28
320	28
320	1
320	8
320	2
320	16
321	12
321	13
321	30
321	5
321	6
322	30
322	28
322	2
322	18
322	26
323	30
323	23
323	24
323	21
323	14
324	8
324	11
324	14
324	30
324	24
325	11
325	9
325	27
325	3
325	19
326	12
326	4
326	17
326	22
326	29
327	2
327	6
327	8
327	26
327	17
328	2
328	13
328	3
328	29
328	15
329	28
329	10
329	25
329	11
329	3
330	18
330	15
330	1
330	12
330	7
331	10
331	19
331	26
331	24
331	20
332	8
332	15
332	12
332	19
332	16
333	25
333	7
333	24
333	29
333	18
334	25
334	26
334	8
334	5
334	1
335	30
335	14
335	1
335	8
335	18
336	12
336	21
336	27
336	23
336	29
337	1
337	11
337	25
337	22
337	13
338	28
338	24
338	10
338	4
338	7
339	17
339	8
339	14
339	16
339	2
340	5
340	23
340	9
340	3
340	2
341	30
341	8
341	29
341	28
341	17
342	14
342	23
342	29
342	12
342	15
343	24
343	3
343	19
343	4
343	17
344	5
344	21
344	27
344	13
344	3
345	19
345	2
345	14
345	22
345	5
346	8
346	10
346	9
346	28
346	11
347	30
347	26
347	13
347	23
347	27
348	24
348	11
348	15
348	9
348	8
349	3
349	7
349	5
349	25
349	19
350	4
350	5
350	6
350	15
350	11
351	14
351	4
351	18
351	12
351	25
352	7
352	15
352	10
352	9
352	28
353	4
353	3
353	6
353	26
353	22
354	10
354	27
354	23
354	20
354	2
355	7
355	27
355	28
355	11
355	5
356	3
356	23
356	8
356	12
356	13
357	17
357	2
357	22
357	10
357	9
358	27
358	6
358	1
358	13
358	28
359	15
359	18
359	24
359	8
359	4
360	15
360	4
360	26
360	5
360	1
361	2
361	27
361	25
361	8
361	5
362	7
362	27
362	13
362	12
362	22
363	21
363	3
363	19
363	9
363	30
364	27
364	3
364	1
364	7
364	29
365	21
365	15
365	26
365	5
365	3
366	29
366	28
366	27
366	26
366	11
367	4
367	2
367	15
367	6
367	30
368	19
368	14
368	27
368	24
368	13
369	16
369	1
369	13
369	22
369	14
370	6
370	12
370	7
370	30
370	9
371	9
371	15
371	29
371	5
371	2
372	20
372	8
372	21
372	10
372	16
373	14
373	29
373	18
373	16
373	2
374	3
374	9
374	13
374	5
374	14
375	7
375	21
375	29
375	26
375	17
376	8
376	21
376	26
376	18
376	1
377	13
377	26
377	23
377	12
377	16
378	18
378	26
378	16
378	12
378	30
379	19
379	17
379	11
379	13
379	9
380	6
380	1
380	11
380	20
380	8
381	1
381	29
381	26
381	25
381	9
382	2
382	26
382	16
382	17
382	12
383	25
383	19
383	8
383	6
383	4
384	8
384	22
384	9
384	18
384	27
385	26
385	30
385	24
385	2
385	25
386	8
386	19
386	28
386	26
386	13
387	12
387	30
387	27
387	28
387	6
388	6
388	8
388	19
388	11
388	26
389	24
389	23
389	12
389	30
389	19
390	1
390	23
390	12
390	19
390	5
391	19
391	7
391	27
391	26
391	29
392	16
392	18
392	10
392	6
392	2
393	3
393	2
393	8
393	20
393	1
394	17
394	16
394	1
394	11
394	30
395	20
395	7
395	26
395	5
395	11
396	23
396	6
396	30
396	26
396	28
397	28
397	11
397	2
397	1
397	5
398	19
398	23
398	30
398	5
398	25
399	4
399	28
399	17
399	12
399	3
400	12
400	23
400	22
400	13
400	19
401	4
401	11
401	10
401	5
401	6
402	24
402	14
402	26
402	21
402	16
403	21
403	11
403	6
403	23
403	18
404	23
404	29
404	30
404	20
404	26
405	12
405	8
405	22
405	19
405	27
406	6
406	13
406	10
406	24
406	23
407	10
407	5
407	6
407	24
407	1
408	23
408	19
408	13
408	28
408	25
409	19
409	2
409	6
409	20
409	11
410	30
410	26
410	20
410	8
410	21
411	19
411	4
411	30
411	16
411	5
412	11
412	24
412	3
412	8
412	12
413	11
413	6
413	21
413	29
413	3
414	27
414	23
414	22
414	21
414	24
415	29
415	11
415	15
415	1
415	9
416	7
416	8
416	23
416	3
416	12
417	9
417	26
417	4
417	24
417	1
418	2
418	13
418	15
418	24
418	14
419	6
419	29
419	14
419	16
419	13
420	12
420	18
420	13
420	4
420	27
421	16
421	26
421	28
421	19
421	21
422	25
422	22
422	8
422	6
422	15
423	3
423	26
423	28
423	2
423	10
424	1
424	11
424	9
424	4
424	3
425	11
425	6
425	29
425	13
425	24
426	3
426	18
426	29
426	11
426	20
427	20
427	29
427	16
427	23
427	1
428	14
428	21
428	6
428	20
428	29
429	14
429	6
429	2
429	4
429	11
430	7
430	14
430	23
430	18
430	24
\.


--
-- TOC entry 3269 (class 0 OID 16418)
-- Dependencies: 203
-- Data for Name: supervision; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supervision (pid_student, pid_supervisor) FROM stdin;
185	1
292	2
301	3
288	4
384	5
354	6
85	7
352	8
119	9
125	10
228	11
170	12
294	13
161	14
230	15
366	16
254	17
168	18
316	19
224	20
154	21
187	22
157	23
155	24
284	25
222	26
375	27
246	28
110	29
114	30
411	31
216	32
71	33
121	34
251	35
257	36
415	37
136	38
208	39
309	40
100	41
425	42
83	43
101	44
275	45
355	46
179	47
197	48
183	49
338	50
311	51
151	52
66	53
300	54
266	55
328	56
150	57
397	58
373	59
356	60
64	1
217	2
205	3
319	4
193	5
400	6
120	7
388	8
92	9
74	10
132	11
321	12
262	13
348	14
178	15
405	16
287	17
190	18
173	19
307	20
364	21
126	22
145	23
211	24
315	25
409	26
163	27
80	28
363	29
233	30
109	31
137	32
147	33
322	34
263	35
417	36
426	37
102	38
345	39
169	40
368	41
427	42
152	43
394	44
94	45
89	46
391	47
326	48
104	49
280	50
213	51
115	52
229	53
277	54
269	55
252	56
423	57
260	58
325	59
329	60
\.


--
-- TOC entry 3129 (class 2606 OID 16409)
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (cid);


--
-- TOC entry 3124 (class 2606 OID 16403)
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (pid);


--
-- TOC entry 3126 (class 1259 OID 16411)
-- Name: course_lab_teacher_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX course_lab_teacher_idx ON public.course USING btree (lab_teacher);


--
-- TOC entry 3127 (class 1259 OID 16410)
-- Name: course_lecturer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX course_lecturer_idx ON public.course USING btree (lecturer);


--
-- TOC entry 3125 (class 1259 OID 16404)
-- Name: person_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX person_status_idx ON public.person USING btree (status);


--
-- TOC entry 3130 (class 1259 OID 16416)
-- Name: registration_cid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX registration_cid_idx ON public.registration USING btree (cid);


--
-- TOC entry 3131 (class 1259 OID 16415)
-- Name: registration_pid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX registration_pid_idx ON public.registration USING btree (pid);


--
-- TOC entry 3136 (class 1259 OID 16430)
-- Name: supervision_student_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supervision_student_idx ON public.supervision USING btree (pid_student);


--
-- TOC entry 3137 (class 1259 OID 16431)
-- Name: supervision_supervisor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supervision_supervisor_idx ON public.supervision USING btree (pid_supervisor);


--
-- TOC entry 3133 (class 2606 OID 16422)
-- Name: course course_lab_teacher_fkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_lab_teacher_fkey FOREIGN KEY (lab_teacher) REFERENCES public.person(pid);


--
-- TOC entry 3132 (class 2606 OID 16417)
-- Name: course course_lecturer_fkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_lecturer_fkey FOREIGN KEY (lecturer) REFERENCES public.person(pid);


--
-- TOC entry 3135 (class 2606 OID 16432)
-- Name: registration registration_cid_fkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration
    ADD CONSTRAINT registration_cid_fkey FOREIGN KEY (cid) REFERENCES public.course(cid);


--
-- TOC entry 3134 (class 2606 OID 16427)
-- Name: registration registration_pid_fkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration
    ADD CONSTRAINT registration_pid_fkey FOREIGN KEY (pid) REFERENCES public.person(pid);


--
-- TOC entry 3138 (class 2606 OID 16433)
-- Name: supervision supervision_student_fkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervision
    ADD CONSTRAINT supervision_student_fkey FOREIGN KEY (pid_student) REFERENCES public.person(pid);


--
-- TOC entry 3139 (class 2606 OID 16434)
-- Name: supervision supervision_supervisor_fkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervision
    ADD CONSTRAINT supervision_supervisor_fkey FOREIGN KEY (pid_supervisor) REFERENCES public.person(pid);


-- Completed on 2024-01-01 00:00:00 CEST

--
-- PostgreSQL database dump complete
--