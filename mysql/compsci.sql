-- MySQL dump 10.13  Distrib 8.0.21, for macos10.15 (x86_64)
--
-- Host: localhost    Database: compsci
-- ------------------------------------------------------
-- Server version	8.0.21

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `academic`
--

DROP TABLE IF EXISTS `academic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic` (
  `a_id` int NOT NULL,
  `first_name` varchar(40) NOT NULL,
  `last_name` varchar(40) NOT NULL,
  `position` int NOT NULL,
  `birth_date` date NOT NULL,
  `email` varchar(100) NOT NULL,
  PRIMARY KEY (`a_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic`
--

LOCK TABLES `academic` WRITE;
/*!40000 ALTER TABLE `academic` DISABLE KEYS */;
INSERT INTO `academic` VALUES
(1,'Anna','Chambers',1,'1982-03-15','anna.chambers@gmail.com'),
(2,'Edward','May',9,'1989-07-22','edward.may@gmail.com'),
(3,'Rachel','Ward',8,'1985-11-08','rachel.ward@gmail.com'),
(4,'Priscilla','Hildr',2,'1983-05-30','priscilla.hildr@gmail.com'),
(5,'Zlata','Richmal',3,'1987-09-14','zlata.richmal@gmail.com'),
(6,'Nathaniel','Abolfazl',4,'1981-12-03','nathaniel.abolfazl@gmail.com'),
(7,'Sergei','Elian',5,'1984-04-19','sergei.elian@gmail.com'),
(8,'Alois','Jayant',6,'1986-08-25','alois.jayant@gmail.com'),
(9,'Torborg','Chernobog',7,'1980-02-11','torborg.chernobog@gmail.com'),
(10,'Udi','Heinrike',8,'1988-06-07','udi.heinrike@gmail.com'),
(11,'Alvena','Merry',9,'1990-10-28','alvena.merry@gmail.com'),
(12,'Kyler','Josephina',1,'1983-01-17','kyler.josephina@gmail.com'),
(13,'Gerard','Cosimo',2,'1985-07-04','gerard.cosimo@gmail.com'),
(14,'Karine','Attilio',3,'1988-03-22','karine.attilio@gmail.com');
/*!40000 ALTER TABLE `academic` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course`
--

DROP TABLE IF EXISTS `course`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course` (
  `c_id` int NOT NULL,
  `title` varchar(100) NOT NULL,
  PRIMARY KEY (`c_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course`
--

LOCK TABLES `course` WRITE;
/*!40000 ALTER TABLE `course` DISABLE KEYS */;
INSERT INTO `course` VALUES (1,'Computer Networks'),(2,'Computer Networks'),(1234,'Linear Algebra'),(1235,'Analysis'),(1236,'Operating Systems'),(1500,'Data Mining'),(1501,'Theory of Computing'),(1502,'Research Methods'),(1601,'Intelligent Systems'),(1602,'Information security');
/*!40000 ALTER TABLE `course` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_registration`
--

DROP TABLE IF EXISTS `course_registration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_registration` (
  `c_id` int NOT NULL,
  `s_id` int NOT NULL,
  KEY `c_id` (`c_id`),
  KEY `s_id` (`s_id`),
  CONSTRAINT `course_registration_ibfk_1` FOREIGN KEY (`c_id`) REFERENCES `course` (`c_id`),
  CONSTRAINT `course_registration_ibfk_2` FOREIGN KEY (`s_id`) REFERENCES `student` (`s_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_registration`
--

LOCK TABLES `course_registration` WRITE;
/*!40000 ALTER TABLE `course_registration` DISABLE KEYS */;
INSERT INTO `course_registration` VALUES (1234,1),(1234,2),(1234,3),(1235,1),(1235,2),(1236,1),(1236,3),(1500,4),(1500,5),(1501,4),(1502,5);
/*!40000 ALTER TABLE `course_registration` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student`
--

DROP TABLE IF EXISTS `student`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student` (
  `s_id` int NOT NULL,
  `first_name` varchar(40) NOT NULL,
  `last_name` varchar(40) NOT NULL,
  `birth_date` date NOT NULL,
  `email` varchar(100) NOT NULL,
  PRIMARY KEY (`s_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student`
--

LOCK TABLES `student` WRITE;
/*!40000 ALTER TABLE `student` DISABLE KEYS */;
INSERT INTO `student` VALUES
(1,'Mary','Smith','2001-04-12','mary.smith@gmail.com'),
(2,'John','Doe','2002-09-18','john.doe@gmail.com'),
(3,'Franck','Combs','2003-01-25','franck.combs@gmail.com'),
(4,'Billy','Hinkley','2001-11-07','billy.hinkley@gmail.com'),
(5,'Alison','Robards','2002-06-14','alison.robards@gmail.com');
/*!40000 ALTER TABLE `student` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teaching`
--

DROP TABLE IF EXISTS `teaching`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teaching` (
  `c_id` int NOT NULL,
  `a_id` int NOT NULL,
  KEY `c_id` (`c_id`),
  KEY `a_id` (`a_id`),
  CONSTRAINT `teaching_ibfk_1` FOREIGN KEY (`c_id`) REFERENCES `course` (`c_id`),
  CONSTRAINT `teaching_ibfk_2` FOREIGN KEY (`a_id`) REFERENCES `academic` (`a_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teaching`
--

LOCK TABLES `teaching` WRITE;
/*!40000 ALTER TABLE `teaching` DISABLE KEYS */;
INSERT INTO `teaching` VALUES (1234,1),(1234,2),(1235,1),(1235,3),(1236,4),(1236,8),(1236,9),(1500,12),(1500,2),(1501,12),(1501,14),(1501,7),(1502,13);
/*!40000 ALTER TABLE `teaching` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Legacy roster table: source-system students that have not been mapped into the VKG.
--

DROP TABLE IF EXISTS `legacy_student`;
CREATE TABLE `legacy_student` (
  `s_id` int NOT NULL,
  `first_name` varchar(40) NOT NULL,
  `last_name` varchar(40) NOT NULL,
  `birth_date` date NOT NULL,
  `email` varchar(100) NOT NULL,
  PRIMARY KEY (`s_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `legacy_student` VALUES
  (9001,'Alice','Legacy','2000-03-21','alice.legacy@gmail.com'),
  (9002,'Bob','Legacy','2001-07-14','bob.legacy@gmail.com'),
  (9003,'Carol','Legacy','2002-11-30','carol.legacy@gmail.com');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2021-03-28 20:56:50
