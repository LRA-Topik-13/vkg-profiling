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
  `birth_date` date NULL,
  `email` varchar(100) NULL,
  PRIMARY KEY (`a_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic`
--

LOCK TABLES `academic` WRITE;
/*!40000 ALTER TABLE `academic` DISABLE KEYS */;
INSERT INTO `academic` VALUES
(1,'Danielle','Johnson',3,'1972-02-25','danielle.johnson604@example.edu'),
(2,'Jeffrey','Doyle',2,'1982-08-05','jeffrey.doyle285@example.edu'),
(3,'Patricia','Miller',2,'1975-12-21','patricia.miller829@example.edu'),
(4,'Anthony','Robinson',8,'1978-02-20','anthony.robinson891@example.edu'),
(5,'Anthony','Gonzalez',3,'1981-11-23','anthony.gonzalez7@example.edu'),
(6,'Amy','Robinson',1,'1980-04-27','amy.robinson778@example.edu'),
(7,'Lisa','Smith',1,'1985-12-13','lisa.smith826@example.edu'),
(8,'Helen','Peterson',2,'1969-01-16','helen.peterson164@example.edu'),
(9,'Susan','Rogers',2,'1967-05-31','susan.rogers715@example.edu'),
(10,'Colin','Abbott',2,'1980-09-11','colin.abbott433@example.edu'),
(11,'Lindsay','Blair',2,'1978-12-10','lindsay.blair349@example.edu'),
(12,'Teresa','Gray',8,'1979-05-09','teresa.gray285@example.edu'),
(13,'Maria','Montgomery',8,'1987-05-27','maria.montgomery160@example.edu'),
(14,'Barbara','Bush',3,'1966-03-12','barbara.bush221@example.edu'),
(15,'Jeremy','Roberts',3,'1967-01-28','jeremy.roberts981@example.edu'),
(16,'Jesse','Garcia',8,'1972-03-24','jesse.garcia782@example.edu'),
(17,'Cynthia','Diaz',1,'1974-08-16','cynthia.diaz345@example.edu'),
(18,'Jason','Adams',2,'1989-05-08','jason.adams105@example.edu'),
(19,'Deborah','Lynch',3,'1969-06-13','deborah.lynch95@example.edu'),
(20,'Jessica','Martin',1,'1974-11-12','jessica.martin390@example.edu'),
(21,'Veronica','Bowman',3,'1979-06-25','veronica.bowman100@example.edu'),
(22,'Gabrielle','Cameron',8,'1985-03-05','gabrielle.cameron368@example.edu'),
(23,'Jeremy','Johnson',1,'1973-03-15','jeremy.johnson868@example.edu'),
(24,'Joseph','Clark',8,'1989-07-06','joseph.clark353@example.edu'),
(25,'Nancy','Edwards',1,'1982-01-15','nancy.edwards619@example.edu'),
(26,'Randall','Rocha',2,'1976-12-05','randall.rocha271@example.edu'),
(27,'Joseph','Wright',3,'1979-08-06','joseph.wright827@example.edu'),
(28,'Jose','Richards',1,'1988-05-04','jose.richards45@example.edu'),
(29,'Reginald','Robinson',1,'1990-12-07','reginald.robinson748@example.edu'),
(30,'William','Davis',3,'1966-03-24','william.davis471@example.edu');
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
  `title` varchar(100) NULL,
  PRIMARY KEY (`c_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course`
--

LOCK TABLES `course` WRITE;
/*!40000 ALTER TABLE `course` DISABLE KEYS */;
INSERT INTO `course` VALUES (1,'Computer Networks A'),(2,'Computer Networks B'),(3,'Computer Networks C'),(4,'Computer Networks D'),(5,'Computer Networks E'),(6,'Computer Networks F'),(7,'Linear Algebra A'),(8,'Linear Algebra B'),(9,'Linear Algebra C'),(10,'Linear Algebra D'),(11,'Linear Algebra E'),(12,'Linear Algebra F'),(13,'Operating Systems A'),(14,'Operating Systems B'),(15,'Operating Systems C'),(16,'Operating Systems D'),(17,'Operating Systems E'),(18,'Operating Systems F'),(19,'Data Mining A'),(20,'Data Mining B'),(21,'Data Mining C'),(22,'Data Mining D'),(23,'Data Mining E'),(24,'Data Mining F'),(25,'Intelligent Systems A'),(26,'Intelligent Systems B'),(27,'Intelligent Systems C'),(28,'Intelligent Systems D'),(29,'Intelligent Systems E'),(30,'Intelligent Systems F');
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
INSERT INTO `course_registration` VALUES (30,1),(12,1),(29,1),(3,1),(8,1),(12,2),(10,2),(6,2),(15,2),(27,2),(18,3),(23,3),(10,3),(20,3),(26,3),(21,4),(17,4),(1,4),(22,4),(27,4),(18,5),(10,5),(30,5),(22,5),(4,5),(29,6),(5,6),(9,6),(4,6),(24,6),(18,7),(5,7),(9,7),(10,7),(20,7),(7,8),(23,8),(11,8),(22,8),(21,8),(28,9),(9,9),(17,9),(16,9),(29,9),(30,10),(28,10),(2,10),(3,10),(21,10),(14,11),(27,11),(9,11),(2,11),(1,11),(11,12),(25,12),(5,12),(21,12),(9,12),(6,13),(24,13),(15,13),(18,13),(23,13),(14,14),(18,14),(1,14),(4,14),(3,14),(29,15),(23,15),(5,15),(18,15),(2,15),(27,16),(12,16),(19,16),(18,16),(5,16),(14,17),(5,17),(2,17),(10,17),(12,17),(29,18),(30,18),(26,18),(28,18),(2,18),(29,19),(12,19),(7,19),(22,19),(8,19),(22,20),(4,20),(12,20),(25,20),(18,20),(29,21),(28,21),(14,21),(20,21),(24,21),(5,22),(30,22),(8,22),(28,22),(6,22),(26,23),(6,23),(29,23),(14,23),(1,23),(6,24),(24,24),(30,24),(11,24),(26,24),(30,25),(14,25),(26,25),(22,25),(28,25),(24,26),(26,26),(8,26),(9,26),(6,26),(26,27),(23,27),(4,27),(13,27),(28,27),(2,28),(28,28),(16,28),(8,28),(7,28),(27,29),(30,29),(15,29),(12,29),(10,29),(27,30),(26,30),(28,30),(8,30),(1,30),(22,31),(7,31),(13,31),(11,31),(9,31),(28,32),(3,32),(25,32),(9,32),(12,32),(21,33),(17,33),(13,33),(22,33),(27,33),(18,34),(11,34),(1,34),(4,34),(29,34),(9,35),(6,35),(19,35),(2,35),(4,35),(20,36),(14,36),(12,36),(24,36),(26,36),(11,37),(14,37),(20,37),(17,37),(4,37),(13,38),(29,38),(19,38),(7,38),(9,38),(2,39),(23,39),(14,39),(1,39),(17,39),(30,40),(26,40),(18,40),(22,40),(24,40);
INSERT INTO `course_registration` VALUES (24,41),(22,41),(7,41),(12,41),(14,41),(3,42),(22,42),(30,42),(11,42),(20,42),(11,43),(22,43),(28,43),(4,43),(24,43),(29,44),(10,44),(17,44),(22,44),(14,44),(11,45),(13,45),(23,45),(10,45),(18,45),(5,46),(7,46),(14,46),(22,46),(13,46),(22,47),(24,47),(29,47),(6,47),(20,47),(19,48),(10,48),(13,48),(18,48),(27,48),(1,49),(10,49),(7,49),(14,49),(26,49),(19,50),(20,50),(21,50),(11,50),(15,50),(15,51),(22,51),(7,51),(17,51),(16,51),(26,52),(29,52),(24,52),(6,52),(22,52),(3,53),(10,53),(17,53),(22,53),(21,53),(20,54),(11,54),(3,54),(27,54),(25,54),(8,55),(22,55),(10,55),(26,55),(7,55),(5,56),(1,56),(2,56),(8,56),(16,56),(20,57),(28,57),(25,57),(3,57),(15,57),(14,58),(29,58),(21,58),(19,58),(7,58),(23,59),(13,59),(16,59),(8,59),(5,59),(21,60),(23,60),(1,60),(29,60),(25,60),(28,61),(25,61),(29,61),(4,61),(14,61),(8,62),(6,62),(26,62),(23,62),(17,62),(15,63),(2,63),(18,63),(8,63),(30,63),(28,64),(4,64),(15,64),(5,64),(26,64),(15,65),(22,65),(17,65),(18,65),(20,65),(11,66),(25,66),(29,66),(15,66),(20,66),(27,67),(24,67),(29,67),(17,67),(14,67),(27,68),(30,68),(18,68),(15,68),(29,68),(6,69),(24,69),(28,69),(16,69),(15,69),(9,70),(25,70),(8,70),(27,70),(21,70),(9,71),(25,71),(17,71),(16,71),(21,71),(8,72),(9,72),(15,72),(3,72),(23,72),(10,73),(8,73),(9,73),(11,73),(29,73),(18,74),(3,74),(5,74),(8,74),(13,74),(23,75),(5,75),(7,75),(3,75),(14,75),(14,76),(11,76),(18,76),(15,76),(2,76),(7,77),(27,77),(14,77),(13,77),(29,77),(25,78),(19,78),(23,78),(1,78),(28,78),(29,79),(25,79),(19,79),(13,79),(16,79),(1,80),(12,80),(10,80),(25,80),(13,80);
INSERT INTO `course_registration` VALUES (28,81),(29,81),(27,81),(14,81),(18,81),(24,82),(18,82),(26,82),(20,82),(29,82),(8,83),(16,83),(9,83),(14,83),(1,83),(13,84),(11,84),(22,84),(26,84),(24,84),(6,85),(27,85),(15,85),(30,85),(5,85),(20,86),(18,86),(1,86),(30,86),(13,86),(19,87),(22,87),(1,87),(3,87),(21,87),(14,88),(5,88),(28,88),(15,88),(6,88),(2,89),(9,89),(13,89),(11,89),(7,89),(15,90),(11,90),(25,90),(29,90),(13,90),(9,91),(25,91),(27,91),(14,91),(3,91),(16,92),(1,92),(24,92),(18,92),(2,92),(12,93),(8,93),(21,93),(3,93),(25,93),(21,94),(2,94),(25,94),(1,94),(8,94),(7,95),(27,95),(1,95),(20,95),(5,95),(8,96),(5,96),(16,96),(22,96),(4,96),(19,97),(7,97),(15,97),(23,97),(9,97),(25,98),(12,98),(6,98),(20,98),(24,98),(23,99),(4,99),(25,99),(27,99),(6,99),(10,100),(4,100),(19,100),(1,100),(30,100),(10,101),(19,101),(22,101),(30,101),(13,101),(13,102),(23,102),(7,102),(3,102),(19,102),(23,103),(27,103),(21,103),(8,103),(4,103),(23,104),(25,104),(10,104),(28,104),(22,104),(20,105),(26,105),(4,105),(19,105),(2,105),(12,106),(18,106),(14,106),(22,106),(3,106),(17,107),(21,107),(11,107),(1,107),(28,107),(14,108),(27,108),(16,108),(4,108),(12,108),(21,109),(29,109),(27,109),(15,109),(23,109),(5,110),(14,110),(6,110),(24,110),(17,110),(21,111),(9,111),(20,111),(26,111),(30,111),(18,112),(25,112),(16,112),(15,112),(14,112),(27,113),(24,113),(19,113),(9,113),(11,113),(28,114),(8,114),(27,114),(30,114),(3,114),(9,115),(29,115),(15,115),(8,115),(25,115),(15,116),(19,116),(20,116),(22,116),(13,116),(11,117),(1,117),(16,117),(28,117),(6,117),(16,118),(7,118),(12,118),(26,118),(9,118),(11,119),(9,119),(29,119),(20,119),(23,119),(29,120),(9,120),(18,120),(1,120),(17,120);
INSERT INTO `course_registration` VALUES (7,121),(3,121),(8,121),(24,121),(14,121),(16,122),(18,122),(25,122),(8,122),(23,122),(16,123),(21,123),(23,123),(15,123),(26,123),(1,124),(3,124),(10,124),(8,124),(13,124),(23,125),(8,125),(10,125),(22,125),(19,125),(12,126),(16,126),(18,126),(17,126),(14,126),(24,127),(18,127),(11,127),(12,127),(23,127),(15,128),(9,128),(10,128),(8,128),(4,128),(24,129),(7,129),(11,129),(4,129),(18,129),(25,130),(23,130),(6,130),(7,130),(24,130),(16,131),(9,131),(24,131),(19,131),(25,131),(17,132),(20,132),(10,132),(4,132),(27,132),(7,133),(10,133),(8,133),(12,133),(6,133),(10,134),(1,134),(23,134),(18,134),(5,134),(9,135),(2,135),(18,135),(10,135),(23,135),(5,136),(21,136),(28,136),(25,136),(16,136),(4,137),(28,137),(1,137),(19,137),(10,137),(16,138),(15,138),(11,138),(6,138),(2,138),(9,139),(28,139),(16,139),(4,139),(27,139),(3,140),(13,140),(16,140),(19,140),(21,140),(22,141),(2,141),(5,141),(26,141),(19,141),(10,142),(3,142),(8,142),(4,142),(18,142),(25,143),(14,143),(20,143),(26,143),(8,143),(25,144),(17,144),(13,144),(15,144),(30,144),(15,145),(10,145),(28,145),(19,145),(14,145),(10,146),(19,146),(20,146),(2,146),(24,146),(4,147),(25,147),(7,147),(21,147),(9,147),(22,148),(3,148),(6,148),(8,148),(18,148),(3,149),(6,149),(1,149),(14,149),(15,149),(23,150),(20,150),(16,150),(10,150),(2,150),(8,151),(10,151),(23,151),(28,151),(15,151),(3,152),(22,152),(8,152),(30,152),(9,152),(26,153),(21,153),(19,153),(22,153),(30,153),(7,154),(14,154),(4,154),(18,154),(8,154),(21,155),(5,155),(30,155),(9,155),(27,155),(5,156),(3,156),(2,156),(6,156),(26,156),(10,157),(20,157),(24,157),(27,157),(19,157),(30,158),(10,158),(15,158),(4,158),(23,158),(10,159),(23,159),(13,159),(9,159),(17,159),(18,160),(16,160),(15,160),(3,160),(20,160);
INSERT INTO `course_registration` VALUES (2,161),(29,161),(14,161),(24,161),(11,161),(20,162),(9,162),(1,162),(3,162),(8,162),(22,163),(27,163),(28,163),(19,163),(1,163),(25,164),(22,164),(27,164),(9,164),(19,164),(2,165),(25,165),(6,165),(16,165),(17,165),(21,166),(15,166),(30,166),(9,166),(6,166),(19,167),(14,167),(21,167),(27,167),(16,167),(3,168),(16,168),(12,168),(14,168),(11,168),(11,169),(22,169),(4,169),(28,169),(6,169),(11,170),(14,170),(23,170),(16,170),(10,170),(22,171),(13,171),(27,171),(25,171),(18,171),(2,172),(15,172),(3,172),(11,172),(9,172),(11,173),(4,173),(25,173),(13,173),(28,173),(17,174),(27,174),(1,174),(22,174),(28,174),(18,175),(15,175),(14,175),(2,175),(7,175),(17,176),(12,176),(20,176),(25,176),(16,176),(21,177),(15,177),(25,177),(2,177),(7,177),(9,178),(18,178),(5,178),(30,178),(10,178),(15,179),(29,179),(23,179),(16,179),(4,179),(1,180),(21,180),(20,180),(26,180),(8,180),(23,181),(6,181),(10,181),(18,181),(1,181),(18,182),(14,182),(3,182),(8,182),(27,182),(30,183),(4,183),(15,183),(21,183),(27,183),(5,184),(16,184),(30,184),(23,184),(10,184),(17,185),(23,185),(9,185),(14,185),(27,185),(16,186),(8,186),(15,186),(18,186),(5,186),(13,187),(7,187),(30,187),(20,187),(17,187),(24,188),(29,188),(5,188),(28,188),(3,188),(9,189),(25,189),(26,189),(28,189),(14,189),(11,190),(30,190),(26,190),(17,190),(9,190),(27,191),(1,191),(10,191),(24,191),(19,191),(19,192),(22,192),(16,192),(28,192),(5,192),(15,193),(18,193),(16,193),(12,193),(11,193),(18,194),(25,194),(13,194),(15,194),(30,194),(11,195),(28,195),(7,195),(23,195),(8,195),(19,196),(13,196),(8,196),(28,196),(25,196),(14,197),(2,197),(11,197),(24,197),(16,197),(23,198),(30,198),(26,198),(13,198),(22,198),(26,199),(27,199),(21,199),(5,199),(16,199),(2,200),(5,200),(17,200),(19,200),(11,200);
INSERT INTO `course_registration` VALUES (28,201),(4,201),(15,201),(17,201),(30,201),(15,202),(1,202),(24,202),(5,202),(14,202),(28,203),(21,203),(5,203),(3,203),(16,203),(26,204),(9,204),(11,204),(20,204),(23,204),(13,205),(21,205),(3,205),(28,205),(11,205),(28,206),(22,206),(18,206),(13,206),(11,206),(21,207),(23,207),(29,207),(25,207),(16,207),(28,208),(18,208),(2,208),(20,208),(3,208),(8,209),(21,209),(22,209),(30,209),(10,209),(8,210),(24,210),(3,210),(14,210),(4,210),(25,211),(21,211),(23,211),(28,211),(4,211),(15,212),(6,212),(23,212),(10,212),(29,212),(1,213),(2,213),(11,213),(26,213),(10,213),(12,214),(14,214),(5,214),(8,214),(17,214),(14,215),(19,215),(22,215),(26,215),(6,215),(6,216),(3,216),(20,216),(28,216),(13,216),(20,217),(22,217),(8,217),(16,217),(30,217),(19,218),(5,218),(8,218),(15,218),(21,218),(9,219),(15,219),(22,219),(1,219),(29,219),(26,220),(15,220),(29,220),(10,220),(22,220),(18,221),(6,221),(3,221),(15,221),(12,221),(19,222),(10,222),(21,222),(14,222),(23,222),(9,223),(15,223),(28,223),(10,223),(7,223),(13,224),(28,224),(16,224),(4,224),(8,224),(13,225),(19,225),(12,225),(10,225),(23,225),(10,226),(1,226),(27,226),(22,226),(13,226),(9,227),(1,227),(19,227),(28,227),(22,227),(25,228),(24,228),(2,228),(30,228),(20,228),(24,229),(16,229),(27,229),(29,229),(10,229),(25,230),(26,230),(8,230),(20,230),(12,230),(8,231),(21,231),(7,231),(20,231),(9,231),(22,232),(25,232),(24,232),(27,232),(5,232),(21,233),(4,233),(29,233),(2,233),(10,233),(26,234),(15,234),(2,234),(19,234),(12,234),(24,235),(5,235),(3,235),(30,235),(10,235),(11,236),(24,236),(14,236),(6,236),(7,236),(5,237),(26,237),(18,237),(29,237),(12,237),(17,238),(30,238),(9,238),(27,238),(6,238),(9,239),(30,239),(27,239),(16,239),(26,239),(10,240),(24,240),(28,240),(11,240),(26,240);
INSERT INTO `course_registration` VALUES (4,241),(15,241),(3,241),(5,241),(25,241),(8,242),(28,242),(22,242),(24,242),(13,242),(28,243),(26,243),(18,243),(12,243),(3,243),(26,244),(13,244),(1,244),(9,244),(18,244),(4,245),(15,245),(12,245),(22,245),(24,245),(22,246),(9,246),(19,246),(13,246),(27,246),(21,247),(12,247),(4,247),(22,247),(8,247),(16,248),(1,248),(20,248),(29,248),(18,248),(11,249),(30,249),(20,249),(8,249),(21,249),(3,250),(21,250),(27,250),(15,250),(30,250),(23,251),(10,251),(21,251),(14,251),(4,251),(5,252),(2,252),(10,252),(16,252),(4,252),(4,253),(8,253),(29,253),(18,253),(5,253),(13,254),(15,254),(12,254),(22,254),(24,254),(23,255),(18,255),(14,255),(19,255),(24,255),(24,256),(5,256),(29,256),(14,256),(21,256),(4,257),(27,257),(16,257),(20,257),(14,257),(9,258),(2,258),(23,258),(12,258),(7,258),(15,259),(8,259),(28,259),(12,259),(4,259),(22,260),(12,260),(18,260),(29,260),(21,260),(12,261),(2,261),(13,261),(9,261),(7,261),(4,262),(28,262),(27,262),(15,262),(3,262),(22,263),(7,263),(21,263),(20,263),(1,263),(2,264),(26,264),(11,264),(8,264),(5,264),(26,265),(19,265),(7,265),(3,265),(27,265),(25,266),(18,266),(7,266),(19,266),(27,266),(28,267),(8,267),(11,267),(25,267),(5,267),(26,268),(29,268),(20,268),(1,268),(9,268),(28,269),(5,269),(18,269),(9,269),(26,269),(6,270),(4,270),(22,270),(28,270),(1,270),(5,271),(1,271),(12,271),(26,271),(8,271),(19,272),(11,272),(1,272),(6,272),(9,272),(2,273),(5,273),(24,273),(14,273),(17,273),(4,274),(24,274),(3,274),(16,274),(15,274),(25,275),(12,275),(17,275),(19,275),(4,275),(15,276),(17,276),(8,276),(20,276),(2,276),(24,277),(26,277),(30,277),(28,277),(22,277),(17,278),(10,278),(15,278),(21,278),(1,278),(2,279),(16,279),(28,279),(13,279),(14,279),(22,280),(4,280),(16,280),(23,280),(30,280);
INSERT INTO `course_registration` VALUES (15,281),(3,281),(29,281),(11,281),(20,281),(5,282),(3,282),(9,282),(20,282),(21,282),(19,283),(18,283),(23,283),(11,283),(13,283),(20,284),(17,284),(10,284),(15,284),(14,284),(4,285),(26,285),(23,285),(28,285),(21,285),(21,286),(29,286),(25,286),(18,286),(24,286),(28,287),(7,287),(14,287),(15,287),(29,287),(8,288),(14,288),(11,288),(27,288),(15,288),(13,289),(14,289),(24,289),(4,289),(11,289),(14,290),(11,290),(22,290),(9,290),(12,290),(5,291),(22,291),(30,291),(16,291),(3,291),(3,292),(27,292),(14,292),(4,292),(24,292),(24,293),(12,293),(26,293),(5,293),(18,293),(2,294),(19,294),(18,294),(11,294),(22,294),(4,295),(14,295),(12,295),(28,295),(22,295),(25,296),(14,296),(28,296),(30,296),(24,296),(2,297),(10,297),(20,297),(12,297),(4,297),(19,298),(17,298),(7,298),(5,298),(22,298),(16,299),(8,299),(28,299),(4,299),(12,299),(28,300),(18,300),(12,300),(4,300),(25,300),(9,301),(19,301),(8,301),(26,301),(14,301),(28,302),(18,302),(25,302),(27,302),(20,302),(20,303),(22,303),(21,303),(18,303),(1,303),(20,304),(30,304),(22,304),(27,304),(23,304),(9,305),(1,305),(6,305),(23,305),(25,305),(10,306),(30,306),(11,306),(12,306),(1,306),(6,307),(28,307),(5,307),(19,307),(22,307),(13,308),(3,308),(5,308),(24,308),(21,308),(1,309),(3,309),(24,309),(17,309),(7,309),(13,310),(14,310),(15,310),(11,310),(6,310),(12,311),(10,311),(24,311),(11,311),(25,311),(19,312),(20,312),(3,312),(29,312),(2,312),(5,313),(6,313),(25,313),(20,313),(2,313),(22,314),(3,314),(9,314),(15,314),(14,314),(16,315),(20,315),(15,315),(14,315),(9,315),(7,316),(25,316),(17,316),(4,316),(12,316),(14,317),(4,317),(10,317),(22,317),(19,317),(16,318),(17,318),(22,318),(10,318),(2,318),(8,319),(13,319),(20,319),(2,319),(1,319),(7,320),(10,320),(25,320),(5,320),(9,320);
INSERT INTO `course_registration` VALUES (10,321),(11,321),(4,321),(1,321),(16,321),(24,322),(14,322),(6,322),(5,322),(13,322),(18,323),(23,323),(8,323),(17,323),(27,323),(22,324),(26,324),(12,324),(3,324),(13,324),(28,325),(24,325),(2,325),(14,325),(1,325),(15,326),(30,326),(3,326),(28,326),(11,326),(19,327),(14,327),(13,327),(23,327),(21,327),(14,328),(10,328),(4,328),(13,328),(1,328),(11,329),(6,329),(26,329),(20,329),(15,329),(27,330),(23,330),(30,330),(12,330),(3,330),(14,331),(28,331),(4,331),(8,331),(19,331),(13,332),(17,332),(3,332),(28,332),(10,332),(24,333),(11,333),(8,333),(25,333),(6,333),(3,334),(17,334),(21,334),(4,334),(7,334),(29,335),(25,335),(12,335),(24,335),(27,335),(21,336),(27,336),(5,336),(8,336),(4,336),(5,337),(9,337),(7,337),(6,337),(20,337),(5,338),(25,338),(21,338),(3,338),(6,338),(25,339),(21,339),(16,339),(15,339),(19,339),(25,340),(19,340),(15,340),(22,340),(30,340),(29,341),(19,341),(21,341),(20,341),(11,341),(28,342),(21,342),(11,342),(5,342),(15,342),(3,343),(16,343),(15,343),(21,343),(10,343),(26,344),(9,344),(19,344),(2,344),(12,344),(17,345),(3,345),(10,345),(15,345),(2,345),(2,346),(12,346),(27,346),(10,346),(3,346),(21,347),(28,347),(3,347),(20,347),(17,347),(13,348),(15,348),(19,348),(18,348),(26,348),(24,349),(29,349),(2,349),(15,349),(30,349),(26,350),(19,350),(21,350),(7,350),(11,350),(20,351),(16,351),(17,351),(5,351),(2,351),(15,352),(4,352),(26,352),(29,352),(27,352),(11,353),(23,353),(3,353),(17,353),(21,353),(6,354),(2,354),(8,354),(23,354),(15,354),(15,355),(17,355),(20,355),(6,355),(12,355),(12,356),(30,356),(10,356),(13,356),(14,356),(25,357),(11,357),(22,357),(20,357),(2,357),(26,358),(21,358),(11,358),(3,358),(4,358),(18,359),(22,359),(13,359),(10,359),(9,359),(24,360),(28,360),(22,360),(30,360),(20,360);
INSERT INTO `course_registration` VALUES (28,361),(5,361),(11,361),(3,361),(19,361),(22,362),(5,362),(30,362),(12,362),(10,362),(21,363),(23,363),(22,363),(13,363),(5,363),(20,364),(23,364),(3,364),(10,364),(18,364),(13,365),(21,365),(26,365),(11,365),(27,365),(5,366),(22,366),(23,366),(27,366),(24,366),(22,367),(30,367),(17,367),(3,367),(21,367),(22,368),(14,368),(17,368),(12,368),(1,368),(12,369),(10,369),(6,369),(7,369),(11,369),(25,370),(16,370),(7,370),(8,370),(5,370),(5,371),(3,371),(10,371),(28,371),(26,371),(4,372),(17,372),(25,372),(18,372),(27,372),(24,373),(29,373),(17,373),(2,373),(22,373),(11,374),(29,374),(25,374),(20,374),(5,374),(20,375),(13,375),(5,375),(6,375),(27,375),(23,376),(25,376),(20,376),(26,376),(29,376),(6,377),(24,377),(15,377),(2,377),(14,377),(12,378),(22,378),(24,378),(8,378),(15,378),(20,379),(10,379),(25,379),(24,379),(26,379),(15,380),(8,380),(18,380),(10,380),(26,380),(26,381),(16,381),(29,381),(27,381),(7,381),(12,382),(22,382),(19,382),(15,382),(25,382),(10,383),(25,383),(13,383),(17,383),(14,383),(6,384),(27,384),(7,384),(26,384),(20,384),(5,385),(28,385),(9,385),(2,385),(21,385),(16,386),(28,386),(12,386),(18,386),(30,386),(4,387),(23,387),(28,387),(17,387),(10,387),(3,388),(25,388),(6,388),(9,388),(15,388),(29,389),(17,389),(5,389),(27,389),(14,389),(3,390),(30,390),(8,390),(27,390),(15,390),(29,391),(12,391),(30,391),(1,391),(14,391),(2,392),(13,392),(17,392),(12,392),(8,392),(13,393),(3,393),(12,393),(8,393),(1,393),(11,394),(30,394),(4,394),(27,394),(23,394),(21,395),(11,395),(26,395),(5,395),(2,395),(10,396),(30,396),(27,396),(16,396),(23,396),(27,397),(5,397),(25,397),(23,397),(16,397),(15,398),(20,398),(1,398),(29,398),(3,398),(1,399),(9,399),(7,399),(27,399),(5,399),(18,400),(24,400),(20,400),(17,400),(14,400);
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
  `birth_date` date NULL,
  `email` varchar(100) NULL,
  PRIMARY KEY (`s_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student`
--

LOCK TABLES `student` WRITE;
/*!40000 ALTER TABLE `student` DISABLE KEYS */;
INSERT INTO `student` VALUES
(1,'Daniel','Burton','2005-05-02','daniel.burton719@example.edu'),
(2,'Robert','Brown','2002-01-19','robert.brown960@example.edu'),
(3,'Wendy','Rice','2006-10-07','wendy.rice700@example.edu'),
(4,'Michelle','Smith','2004-10-06','michelle.smith664@example.edu'),
(5,'Erin','Herrera','2001-02-18','erin.herrera74@example.edu'),
(6,'Danielle','Rodriguez','2002-06-23','danielle.rodriguez624@example.edu'),
(7,'Shawn','Mckay','2006-01-02','shawn.mckay651@example.edu'),
(8,'Jose','Mason','2000-06-05','jose.mason176@example.edu'),
(9,'Rita','Harrell','2001-05-21','rita.harrell547@example.edu'),
(10,'Danielle','Lynch','2000-03-22','danielle.lynch747@example.edu'),
(11,'Kathryn','Ryan','2005-03-24','kathryn.ryan251@example.edu'),
(12,'Alyssa','Smith','2001-08-04','alyssa.smith168@example.edu'),
(13,'Andrew','Hickman','2006-01-10','andrew.hickman474@example.edu'),
(14,'Marie','Parker','1999-06-19','marie.parker389@example.edu'),
(15,'Natalie','Arroyo','1999-09-08','natalie.arroyo277@example.edu'),
(16,'Todd','Jones','2005-01-30','todd.jones948@example.edu'),
(17,'Katie','Anderson','2002-10-20','katie.anderson656@example.edu'),
(18,'Andrea','Baker','2005-12-23','andrea.baker705@example.edu'),
(19,'Rodney','Lewis','2003-04-25','rodney.lewis571@example.edu'),
(20,'Jessica','Harris','2001-06-29','jessica.harris225@example.edu'),
(21,'Wanda','Santos','2002-07-03','wanda.santos702@example.edu'),
(22,'Zachary','Martinez','2000-10-18','zachary.martinez333@example.edu'),
(23,'Matthew','Chapman','2000-11-03','matthew.chapman864@example.edu'),
(24,'Jeffrey','Jones','2004-01-18','jeffrey.jones787@example.edu'),
(25,'Jeremy','Whitehead','2005-11-15','jeremy.whitehead795@example.edu'),
(26,'Chad','Young','2004-05-08','chad.young58@example.edu'),
(27,'Jason','Anderson','2006-06-25','jason.anderson235@example.edu'),
(28,'Ashley','Kennedy','2005-04-10','ashley.kennedy842@example.edu'),
(29,'Lindsey','Lee','1999-10-11','lindsey.lee33@example.edu'),
(30,'Ryan','Henderson','2002-09-26','ryan.henderson825@example.edu'),
(31,'Jessica','Nunez','2006-11-14','jessica.nunez324@example.edu'),
(32,'Corey','Powell','2001-09-18','corey.powell411@example.edu'),
(33,'Michelle','Wright','2000-07-09','michelle.wright275@example.edu'),
(34,'Shane','Henderson','2001-03-24','shane.henderson68@example.edu'),
(35,'John','Leblanc','2002-07-18','john.leblanc217@example.edu'),
(36,'Michelle','Pierce','1999-05-28','michelle.pierce936@example.edu'),
(37,'Yvette','Huff','2006-10-01','yvette.huff966@example.edu'),
(38,'Sara','Allison','2000-04-30','sara.allison581@example.edu'),
(39,'Todd','Lewis','2002-03-17','todd.lewis898@example.edu'),
(40,'Brian','Gray','2006-11-18','brian.gray736@example.edu'),
(41,'Joseph','Bowers','2002-08-22','joseph.bowers323@example.edu'),
(42,'Rodney','Bernard','2006-12-17','rodney.bernard218@example.edu'),
(43,'Angela','Higgins','2000-03-28','angela.higgins672@example.edu'),
(44,'Kenneth','Novak','2003-08-19','kenneth.novak512@example.edu'),
(45,'Amy','Adkins','1999-06-16','amy.adkins406@example.edu'),
(46,'Breanna','Shaw','2005-10-26','breanna.shaw906@example.edu'),
(47,'Eric','Yu','1999-08-23','eric.yu937@example.edu'),
(48,'Jacob','Larson','2004-05-26','jacob.larson659@example.edu'),
(49,'Joe','Wilson','2006-02-13','joe.wilson470@example.edu'),
(50,'John','Wheeler','2003-12-15','john.wheeler147@example.edu'),
(51,'Robert','Silva','2003-03-08','robert.silva272@example.edu'),
(52,'Sarah','Harris','2004-09-22','sarah.harris143@example.edu'),
(53,'John','Foster','2004-05-16','john.foster253@example.edu'),
(54,'Kevin','Stewart','2005-01-05','kevin.stewart763@example.edu'),
(55,'Charles','Ellis','2006-12-26','charles.ellis575@example.edu'),
(56,'Wendy','Jones','2000-09-14','wendy.jones552@example.edu'),
(57,'Joseph','Mahoney','2006-01-17','joseph.mahoney270@example.edu'),
(58,'Natasha','Wood','2000-04-05','natasha.wood765@example.edu'),
(59,'Martha','Warner','2003-11-22','martha.warner599@example.edu'),
(60,'Vanessa','Valdez','1999-01-23','vanessa.valdez439@example.edu'),
(61,'Lisa','Evans','2004-04-21','lisa.evans920@example.edu'),
(62,'Sheila','Taylor','1999-12-04','sheila.taylor598@example.edu'),
(63,'Daniel','Tran','2001-03-06','daniel.tran409@example.edu'),
(64,'Cassandra','Robbins','2000-08-17','cassandra.robbins371@example.edu'),
(65,'Cynthia','Baker','2002-11-28','cynthia.baker225@example.edu'),
(66,'Rebecca','Mathis','1999-09-27','rebecca.mathis142@example.edu'),
(67,'Rodney','Hill','1999-01-11','rodney.hill522@example.edu'),
(68,'Kellie','Walsh','2001-02-04','kellie.walsh506@example.edu'),
(69,'Joyce','Arnold','2002-06-03','joyce.arnold94@example.edu'),
(70,'Alec','Jones','2006-01-23','alec.jones774@example.edu'),
(71,'Rebecca','Gardner','2005-09-03','rebecca.gardner49@example.edu'),
(72,'Brandi','Hernandez','2000-01-08','brandi.hernandez882@example.edu'),
(73,'Kyle','Nolan','2005-05-14','kyle.nolan113@example.edu'),
(74,'Michelle','Nolan','2000-09-05','michelle.nolan157@example.edu'),
(75,'John','Garcia','2005-03-28','john.garcia643@example.edu'),
(76,'Nicole','Russell','2003-12-18','nicole.russell164@example.edu'),
(77,'Eric','Spears','2005-11-30','eric.spears812@example.edu'),
(78,'Theresa','Cochran','2006-01-18','theresa.cochran697@example.edu'),
(79,'Angel','Doyle','2001-08-28','angel.doyle433@example.edu'),
(80,'Sarah','Pham','2005-11-28','sarah.pham611@example.edu'),
(81,'Lisa','Adams','2005-04-18','lisa.adams66@example.edu'),
(82,'Daniel','Brennan','2005-11-12','daniel.brennan395@example.edu'),
(83,'Jeffrey','Velasquez','2002-09-06','jeffrey.velasquez391@example.edu'),
(84,'Kevin','Pope','2000-10-26','kevin.pope611@example.edu'),
(85,'Andrew','Lee','2001-08-16','andrew.lee480@example.edu'),
(86,'Michelle','Rasmussen','2001-03-26','michelle.rasmussen542@example.edu'),
(87,'Darlene','Ross','2006-11-05','darlene.ross258@example.edu'),
(88,'Amanda','Crosby','1999-12-03','amanda.crosby995@example.edu'),
(89,'Tara','White','2006-09-12','tara.white567@example.edu'),
(90,'Joseph','Rodriguez','2002-06-23','joseph.rodriguez882@example.edu'),
(91,'Jessica','Edwards','2003-11-06','jessica.edwards966@example.edu'),
(92,'William','Cruz','2003-08-12','william.cruz12@example.edu'),
(93,'Jonathan','Fletcher','1999-01-05','jonathan.fletcher697@example.edu'),
(94,'Sara','Ryan','2004-10-02','sara.ryan739@example.edu'),
(95,'Judy','Lambert','2001-11-29','judy.lambert118@example.edu'),
(96,'Chad','Beck','2001-08-22','chad.beck699@example.edu'),
(97,'Lee','Charles','2004-10-03','lee.charles907@example.edu'),
(98,'Kevin','Parker','2002-04-07','kevin.parker550@example.edu'),
(99,'Richard','Phillips','2000-01-07','richard.phillips769@example.edu'),
(100,'Robert','Bentley','2004-06-01','robert.bentley274@example.edu');
INSERT INTO `student` VALUES
(101,'Raven','Gilbert','2001-05-29','raven.gilbert788@example.edu'),
(102,'Amy','Smith','2001-04-18','amy.smith657@example.edu'),
(103,'Russell','Carpenter','2004-03-27','russell.carpenter349@example.edu'),
(104,'Steven','Ramos','2000-09-16','steven.ramos115@example.edu'),
(105,'Thomas','Santana','2005-05-14','thomas.santana301@example.edu'),
(106,'Gene','Miller','2003-02-14','gene.miller446@example.edu'),
(107,'Cynthia','Rogers','2005-07-18','cynthia.rogers162@example.edu'),
(108,'Karen','Chambers','2000-10-18','karen.chambers465@example.edu'),
(109,'James','Johnson','2000-12-16','james.johnson4@example.edu'),
(110,'Thomas','Atkinson','1999-08-01','thomas.atkinson977@example.edu'),
(111,'Robert','Soto','2000-07-21','robert.soto740@example.edu'),
(112,'Heather','Snyder','2000-12-13','heather.snyder897@example.edu'),
(113,'Diana','Smith','2005-01-02','diana.smith737@example.edu'),
(114,'Kayla','Rodriguez','2002-05-26','kayla.rodriguez270@example.edu'),
(115,'Gregory','Rubio','2003-02-21','gregory.rubio996@example.edu'),
(116,'Brent','Wright','2005-10-13','brent.wright513@example.edu'),
(117,'Stephen','Solis','2004-05-03','stephen.solis781@example.edu'),
(118,'Vanessa','Larson','2006-08-07','vanessa.larson183@example.edu'),
(119,'Patricia','Salazar','2004-10-01','patricia.salazar520@example.edu'),
(120,'William','Rivas','2003-05-20','william.rivas935@example.edu'),
(121,'Phyllis','Manning','2002-10-18','phyllis.manning109@example.edu'),
(122,'Jonathon','Wright','2004-02-06','jonathon.wright892@example.edu'),
(123,'Katie','Boyd','2004-01-05','katie.boyd641@example.edu'),
(124,'Joshua','Jones','2001-04-14','joshua.jones306@example.edu'),
(125,'Joseph','Flores','2003-04-27','joseph.flores862@example.edu'),
(126,'Devon','Hall','2004-07-20','devon.hall655@example.edu'),
(127,'Jasmine','Brown','2002-04-05','jasmine.brown520@example.edu'),
(128,'Amy','Perry','2000-08-27','amy.perry624@example.edu'),
(129,'Robert','Stein','2003-09-03','robert.stein204@example.edu'),
(130,'Heather','Gates','2005-02-14','heather.gates157@example.edu'),
(131,'Omar','Smith','2001-10-24','omar.smith383@example.edu'),
(132,'Karen','Castaneda','2006-08-16','karen.castaneda781@example.edu'),
(133,'Robert','Adkins','2003-05-15','robert.adkins166@example.edu'),
(134,'Carrie','Walker','2000-10-02','carrie.walker553@example.edu'),
(135,'Ryan','Johnson','2001-09-08','ryan.johnson977@example.edu'),
(136,'Erin','Powell','2000-04-27','erin.powell798@example.edu'),
(137,'Tanner','Anderson','2003-12-23','tanner.anderson945@example.edu'),
(138,'Anthony','Long','2003-07-07','anthony.long544@example.edu'),
(139,'Anthony','Day','2000-02-01','anthony.day941@example.edu'),
(140,'Steven','Williams','2002-01-12','steven.williams1@example.edu'),
(141,'Jason','Murphy','2005-02-01','jason.murphy614@example.edu'),
(142,'Nicholas','Walton','2005-08-27','nicholas.walton332@example.edu'),
(143,'Johnny','Miller','1999-02-26','johnny.miller501@example.edu'),
(144,'Amber','Cooke','2001-10-19','amber.cooke20@example.edu'),
(145,'Debra','Harrington','2004-03-18','debra.harrington115@example.edu'),
(146,'Karen','Herring','2000-08-05','karen.herring952@example.edu'),
(147,'Andrew','Hernandez','2000-01-04','andrew.hernandez372@example.edu'),
(148,'Elizabeth','Elliott','2000-09-28','elizabeth.elliott900@example.edu'),
(149,'Holly','Wang','2000-05-05','holly.wang852@example.edu'),
(150,'Catherine','Adkins','1999-12-01','catherine.adkins827@example.edu'),
(151,'Lori','Oconnell','1999-11-12','lori.oconnell315@example.edu'),
(152,'Anthony','Collins','2004-06-01','anthony.collins246@example.edu'),
(153,'Susan','Sanders','2004-09-19','susan.sanders60@example.edu'),
(154,'Charles','Vaughn','2004-01-07','charles.vaughn247@example.edu'),
(155,'Curtis','Barton','2005-10-19','curtis.barton900@example.edu'),
(156,'Caroline','Martinez','2006-11-13','caroline.martinez581@example.edu'),
(157,'Kimberly','Reed','2002-06-05','kimberly.reed970@example.edu'),
(158,'Mitchell','Hunter','2001-09-23','mitchell.hunter81@example.edu'),
(159,'Melissa','Short','1999-11-05','melissa.short88@example.edu'),
(160,'Susan','Reid','2005-08-17','susan.reid750@example.edu'),
(161,'Jasmine','Graham','2004-11-13','jasmine.graham498@example.edu'),
(162,'Tammy','Nelson','2005-06-18','tammy.nelson836@example.edu'),
(163,'Amanda','Webb','2002-06-26','amanda.webb71@example.edu'),
(164,'Jessica','Adams','2005-10-23','jessica.adams779@example.edu'),
(165,'Mariah','Miller','2006-01-19','mariah.miller546@example.edu'),
(166,'John','Marshall','2003-11-18','john.marshall785@example.edu'),
(167,'Nicholas','Johnson','2005-10-21','nicholas.johnson129@example.edu'),
(168,'Hunter','Lewis','2005-05-19','hunter.lewis132@example.edu'),
(169,'Matthew','Beard','2004-08-10','matthew.beard676@example.edu'),
(170,'Joshua','Smith','2006-08-01','joshua.smith487@example.edu'),
(171,'Christopher','Cortez','2002-11-28','christopher.cortez970@example.edu'),
(172,'Katherine','Vaughn','2004-03-01','katherine.vaughn563@example.edu'),
(173,'Travis','Mcguire','1999-09-29','travis.mcguire170@example.edu'),
(174,'Jeffrey','Holt','2001-06-13','jeffrey.holt272@example.edu'),
(175,'Bonnie','Kennedy','2003-03-31','bonnie.kennedy541@example.edu'),
(176,'Ronald','Reese','2001-08-24','ronald.reese894@example.edu'),
(177,'Jacqueline','Nelson','2001-01-04','jacqueline.nelson622@example.edu'),
(178,'David','Lee','1999-12-16','david.lee434@example.edu'),
(179,'Amanda','Gill','2000-06-24','amanda.gill988@example.edu'),
(180,'Javier','Washington','2004-10-17','javier.washington217@example.edu'),
(181,'Tiffany','Warren','2001-04-06','tiffany.warren952@example.edu'),
(182,'Craig','Lee','2000-10-26','craig.lee553@example.edu'),
(183,'Harry','Smith','2003-04-10','harry.smith774@example.edu'),
(184,'Joshua','Mccann','2003-06-05','joshua.mccann748@example.edu'),
(185,'Heidi','Martinez','2005-12-11','heidi.martinez707@example.edu'),
(186,'Travis','Salas','2003-08-04','travis.salas206@example.edu'),
(187,'Taylor','Alexander','2000-06-22','taylor.alexander731@example.edu'),
(188,'Brett','Everett','2002-10-27','brett.everett320@example.edu'),
(189,'Lynn','Morales','1999-08-05','lynn.morales409@example.edu'),
(190,'Crystal','Brown','2000-03-11','crystal.brown688@example.edu'),
(191,'Anna','Torres','2006-12-13','anna.torres666@example.edu'),
(192,'David','Duran','2003-11-07','david.duran383@example.edu'),
(193,'Krystal','Perez','2003-03-07','krystal.perez449@example.edu'),
(194,'Shannon','Ramos','2005-11-17','shannon.ramos922@example.edu'),
(195,'Veronica','Torres','2003-12-20','veronica.torres530@example.edu'),
(196,'Chelsea','Singh','2006-07-30','chelsea.singh463@example.edu'),
(197,'Jared','Clark','2004-04-13','jared.clark124@example.edu'),
(198,'Eric','Thompson','1999-08-08','eric.thompson254@example.edu'),
(199,'Aaron','Hayes','2003-10-01','aaron.hayes231@example.edu'),
(200,'Kelly','Hall','2004-08-27','kelly.hall66@example.edu');
INSERT INTO `student` VALUES
(201,'Jacqueline','Gibson','2004-06-30','jacqueline.gibson347@example.edu'),
(202,'Sandra','French','2003-12-31','sandra.french22@example.edu'),
(203,'Donna','Peck','2002-05-26','donna.peck603@example.edu'),
(204,'Amy','Holland','2006-04-07','amy.holland568@example.edu'),
(205,'Margaret','Jones','2000-04-29','margaret.jones236@example.edu'),
(206,'Kyle','Curry','2003-07-21','kyle.curry603@example.edu'),
(207,'Keith','Martinez','2004-07-04','keith.martinez226@example.edu'),
(208,'Holly','Bender','2003-01-01','holly.bender8@example.edu'),
(209,'Troy','Miller','1999-04-27','troy.miller73@example.edu'),
(210,'Ryan','Morris','2001-01-01','ryan.morris725@example.edu'),
(211,'Christopher','Hayden','2005-09-07','christopher.hayden647@example.edu'),
(212,'Barbara','Sampson','2006-12-29','barbara.sampson61@example.edu'),
(213,'Emily','Adams','1999-04-28','emily.adams235@example.edu'),
(214,'Katelyn','Ruiz','2004-03-18','katelyn.ruiz70@example.edu'),
(215,'Sabrina','White','2003-09-06','sabrina.white928@example.edu'),
(216,'Cynthia','Vasquez','1999-09-24','cynthia.vasquez33@example.edu'),
(217,'Michael','Cook','2004-05-11','michael.cook881@example.edu'),
(218,'Mia','Rivera','2004-07-19','mia.rivera339@example.edu'),
(219,'Keith','Landry','2005-07-04','keith.landry73@example.edu'),
(220,'Andrea','Gibson','2001-07-07','andrea.gibson527@example.edu'),
(221,'Marcus','Cordova','2002-03-26','marcus.cordova244@example.edu'),
(222,'Xavier','Travis','2004-04-05','xavier.travis286@example.edu'),
(223,'Amy','Gutierrez','2000-07-01','amy.gutierrez686@example.edu'),
(224,'Michael','Avila','2004-01-01','michael.avila498@example.edu'),
(225,'Kathleen','Harris','2003-05-24','kathleen.harris220@example.edu'),
(226,'Sara','Kim','2004-08-01','sara.kim553@example.edu'),
(227,'David','Dudley','2003-11-14','david.dudley136@example.edu'),
(228,'John','Moore','2003-05-29','john.moore741@example.edu'),
(229,'Andrea','Davis','2006-12-08','andrea.davis958@example.edu'),
(230,'Robin','Murray','1999-12-10','robin.murray904@example.edu'),
(231,'Marilyn','Jimenez','2004-09-24','marilyn.jimenez585@example.edu'),
(232,'William','Hill','2005-09-04','william.hill591@example.edu'),
(233,'Tina','Sanchez','2003-05-30','tina.sanchez485@example.edu'),
(234,'Patrick','Weeks','2003-01-24','patrick.weeks249@example.edu'),
(235,'Natasha','Shields','2001-03-17','natasha.shields804@example.edu'),
(236,'Kristy','Perry','2006-06-21','kristy.perry485@example.edu'),
(237,'William','Hoover','2001-04-06','william.hoover827@example.edu'),
(238,'Kenneth','Matthews','2006-12-27','kenneth.matthews417@example.edu'),
(239,'Tracy','Hernandez','2003-04-23','tracy.hernandez195@example.edu'),
(240,'Michael','Arnold','2003-05-07','michael.arnold97@example.edu'),
(241,'Stanley','Morris','2000-07-05','stanley.morris100@example.edu'),
(242,'Heidi','Armstrong','2000-11-13','heidi.armstrong675@example.edu'),
(243,'Kimberly','Williams','2004-12-15','kimberly.williams442@example.edu'),
(244,'Janet','Shepherd','2002-02-01','janet.shepherd363@example.edu'),
(245,'Elizabeth','Hoover','2006-11-04','elizabeth.hoover434@example.edu'),
(246,'Tyler','Johnson','2003-01-07','tyler.johnson421@example.edu'),
(247,'Brittany','Kane','2005-12-28','brittany.kane479@example.edu'),
(248,'Scott','Fox','2002-08-27','scott.fox885@example.edu'),
(249,'Jennifer','Ortiz','2004-03-27','jennifer.ortiz747@example.edu'),
(250,'Eric','Harrison','2006-10-02','eric.harrison56@example.edu'),
(251,'Matthew','Schwartz','2004-03-13','matthew.schwartz690@example.edu'),
(252,'Melissa','Phelps','2005-11-15','melissa.phelps670@example.edu'),
(253,'Norman','Stewart','2004-09-30','norman.stewart662@example.edu'),
(254,'Katherine','Brennan','1999-04-15','katherine.brennan101@example.edu'),
(255,'Casey','Welch','2006-05-14','casey.welch63@example.edu'),
(256,'Wendy','Francis','2002-06-21','wendy.francis413@example.edu'),
(257,'Corey','Schultz','2005-12-23','corey.schultz746@example.edu'),
(258,'Scott','Benson','2006-03-23','scott.benson348@example.edu'),
(259,'Brandon','Flynn','2001-05-06','brandon.flynn820@example.edu'),
(260,'Nicholas','Thomas','2003-04-01','nicholas.thomas883@example.edu'),
(261,'Ashlee','Sparks','2000-05-11','ashlee.sparks112@example.edu'),
(262,'Christian','Pitts','2003-12-16','christian.pitts255@example.edu'),
(263,'John','Durham','2000-02-23','john.durham197@example.edu'),
(264,'Steven','King','2001-01-15','steven.king195@example.edu'),
(265,'Albert','Ballard','2006-03-17','albert.ballard550@example.edu'),
(266,'Erica','Moore','2002-07-14','erica.moore460@example.edu'),
(267,'Michael','Matthews','2004-02-10','michael.matthews144@example.edu'),
(268,'Roger','Wright','2005-10-05','roger.wright433@example.edu'),
(269,'James','Cruz','2002-11-12','james.cruz188@example.edu'),
(270,'John','Armstrong','2003-08-07','john.armstrong286@example.edu'),
(271,'Victoria','Phillips','2006-10-27','victoria.phillips474@example.edu'),
(272,'Dominique','Hill','2003-07-12','dominique.hill256@example.edu'),
(273,'Gina','Garner','1999-05-24','gina.garner896@example.edu'),
(274,'Catherine','Crawford','2006-03-26','catherine.crawford946@example.edu'),
(275,'Justin','Lindsey','2003-11-09','justin.lindsey78@example.edu'),
(276,'Michael','Fields','2003-12-19','michael.fields454@example.edu'),
(277,'Erica','Le','2004-04-09','erica.le828@example.edu'),
(278,'Mary','Fuller','2006-03-23','mary.fuller883@example.edu'),
(279,'Debbie','Parker','2002-07-11','debbie.parker877@example.edu'),
(280,'Bethany','Oconnor','1999-09-21','bethany.oconnor564@example.edu'),
(281,'Kenneth','Burgess','2000-05-28','kenneth.burgess101@example.edu'),
(282,'David','Ryan','2006-10-08','david.ryan52@example.edu'),
(283,'Alyssa','Mcintyre','2005-08-22','alyssa.mcintyre668@example.edu'),
(284,'Jonathan','Summers','2002-11-08','jonathan.summers554@example.edu'),
(285,'Lindsay','Francis','2001-09-16','lindsay.francis857@example.edu'),
(286,'Darius','Mccarty','2000-02-16','darius.mccarty16@example.edu'),
(287,'Tammy','Dalton','2004-10-16','tammy.dalton993@example.edu'),
(288,'Tina','Coffey','2005-06-08','tina.coffey96@example.edu'),
(289,'Michael','Gibbs','1999-02-10','michael.gibbs949@example.edu'),
(290,'Amanda','Gibson','2004-05-19','amanda.gibson772@example.edu'),
(291,'Emily','Richards','2005-07-30','emily.richards870@example.edu'),
(292,'Shelby','Rodriguez','2000-11-13','shelby.rodriguez243@example.edu'),
(293,'Angel','Henson','2003-06-28','angel.henson171@example.edu'),
(294,'Rose','Walker','1999-07-04','rose.walker417@example.edu'),
(295,'Madison','Blankenship','2001-06-01','madison.blankenship498@example.edu'),
(296,'Ricky','Taylor','2006-07-27','ricky.taylor493@example.edu'),
(297,'Kevin','Vasquez','1999-10-11','kevin.vasquez219@example.edu'),
(298,'Paige','Taylor','2002-08-18','paige.taylor886@example.edu'),
(299,'Ellen','Paul','2006-07-26','ellen.paul411@example.edu'),
(300,'Robert','Newton','2000-03-27','robert.newton925@example.edu');
INSERT INTO `student` VALUES
(301,'Robert','Garcia','2002-11-30','robert.garcia61@example.edu'),
(302,'Ricky','Lynn','1999-04-06','ricky.lynn169@example.edu'),
(303,'Mitchell','Ramos','2006-08-08','mitchell.ramos389@example.edu'),
(304,'Melissa','Garcia','2004-06-25','melissa.garcia3@example.edu'),
(305,'Amy','Levine','2001-11-13','amy.levine400@example.edu'),
(306,'Raymond','Lopez','1999-12-23','raymond.lopez272@example.edu'),
(307,'Melanie','Gibson','2004-04-19','melanie.gibson949@example.edu'),
(308,'Darlene','Harper','1999-03-04','darlene.harper803@example.edu'),
(309,'Kristin','Sanchez','2000-01-03','kristin.sanchez804@example.edu'),
(310,'Anne','Jones','2005-02-13','anne.jones466@example.edu'),
(311,'Jamie','Robinson','2005-12-15','jamie.robinson293@example.edu'),
(312,'Mark','Hernandez','2006-03-15','mark.hernandez434@example.edu'),
(313,'Aaron','Garrison','2000-02-27','aaron.garrison714@example.edu'),
(314,'David','King','2000-05-24','david.king981@example.edu'),
(315,'Donna','Johnson','1999-02-13','donna.johnson749@example.edu'),
(316,'Kristy','Young','2001-08-03','kristy.young803@example.edu'),
(317,'Grant','Williams','2004-12-06','grant.williams570@example.edu'),
(318,'Alicia','Reese','2002-10-23','alicia.reese678@example.edu'),
(319,'Kimberly','Palmer','1999-11-15','kimberly.palmer736@example.edu'),
(320,'William','Dougherty','1999-05-07','william.dougherty499@example.edu'),
(321,'Krista','Camacho','2003-03-04','krista.camacho159@example.edu'),
(322,'Stephen','Maynard','1999-06-27','stephen.maynard195@example.edu'),
(323,'Timothy','Morales','2004-06-27','timothy.morales304@example.edu'),
(324,'Tracy','Browning','1999-08-03','tracy.browning223@example.edu'),
(325,'Christopher','Franklin','1999-07-11','christopher.franklin992@example.edu'),
(326,'Joshua','Schultz','2003-05-21','joshua.schultz60@example.edu'),
(327,'Mark','Vang','2003-03-30','mark.vang594@example.edu'),
(328,'Shawn','Jacobs','1999-10-17','shawn.jacobs754@example.edu'),
(329,'Jacqueline','Farrell','2004-03-16','jacqueline.farrell556@example.edu'),
(330,'Kayla','Le','2000-09-20','kayla.le63@example.edu'),
(331,'Shannon','Perez','2001-09-17','shannon.perez766@example.edu'),
(332,'Shawn','Perry','1999-10-05','shawn.perry322@example.edu'),
(333,'Ronald','Ortega','2001-12-29','ronald.ortega59@example.edu'),
(334,'Elijah','Leblanc','1999-07-16','elijah.leblanc52@example.edu'),
(335,'Marie','Davis','1999-10-10','marie.davis599@example.edu'),
(336,'Joanne','Cain','2003-06-14','joanne.cain489@example.edu'),
(337,'Brenda','Hoffman','2001-08-20','brenda.hoffman515@example.edu'),
(338,'David','Gomez','2004-04-27','david.gomez942@example.edu'),
(339,'Karen','Parrish','2004-10-07','karen.parrish874@example.edu'),
(340,'Tanya','Burke','2001-10-24','tanya.burke544@example.edu'),
(341,'Becky','Lewis','2004-04-02','becky.lewis162@example.edu'),
(342,'Jeffrey','Rodriguez','2005-10-05','jeffrey.rodriguez59@example.edu'),
(343,'Michael','Farmer','2003-08-04','michael.farmer984@example.edu'),
(344,'Lindsay','Bruce','2006-10-17','lindsay.bruce521@example.edu'),
(345,'Loretta','Austin','2004-02-21','loretta.austin83@example.edu'),
(346,'Anthony','Hickman','2005-08-19','anthony.hickman872@example.edu'),
(347,'Joseph','White','2004-08-14','joseph.white191@example.edu'),
(348,'Kyle','Morgan','1999-01-18','kyle.morgan71@example.edu'),
(349,'Molly','Knight','2002-03-16','molly.knight610@example.edu'),
(350,'Donald','Schultz','1999-03-31','donald.schultz70@example.edu'),
(351,'Julie','Lewis','2002-05-11','julie.lewis692@example.edu'),
(352,'Matthew','Wood','2004-10-08','matthew.wood883@example.edu'),
(353,'Kimberly','Bradley','1999-09-06','kimberly.bradley241@example.edu'),
(354,'Brian','Moore','2003-12-10','brian.moore414@example.edu'),
(355,'Emily','Nelson','2004-04-17','emily.nelson123@example.edu'),
(356,'Todd','Ramos','2001-03-08','todd.ramos965@example.edu'),
(357,'Kari','Wilson','2002-06-09','kari.wilson912@example.edu'),
(358,'Justin','Gregory','2002-11-22','justin.gregory584@example.edu'),
(359,'Elizabeth','Williams','2002-02-28','elizabeth.williams253@example.edu'),
(360,'Carol','Smith','2001-05-30','carol.smith593@example.edu'),
(361,'Jason','Taylor','2001-01-16','jason.taylor609@example.edu'),
(362,'Mark','Smith','2004-12-22','mark.smith41@example.edu'),
(363,'Gregory','James','2004-08-17','gregory.james635@example.edu'),
(364,'Vincent','Whitaker','2005-06-12','vincent.whitaker84@example.edu'),
(365,'Charles','Hensley','1999-05-04','charles.hensley430@example.edu'),
(366,'Andrew','Morse','2005-11-23','andrew.morse674@example.edu'),
(367,'Barbara','Berry','2004-09-03','barbara.berry598@example.edu'),
(368,'Robert','Wilson','1999-03-02','robert.wilson579@example.edu'),
(369,'Mark','Solis','2003-12-11','mark.solis536@example.edu'),
(370,'Marilyn','Gillespie','1999-09-15','marilyn.gillespie324@example.edu'),
(371,'Megan','Sanchez','2003-09-17','megan.sanchez958@example.edu'),
(372,'Alexandria','Foster','2001-06-25','alexandria.foster268@example.edu'),
(373,'Matthew','Cook','2000-05-06','matthew.cook210@example.edu'),
(374,'William','Wilson','2003-01-29','william.wilson686@example.edu'),
(375,'Rebecca','Bailey','2004-10-25','rebecca.bailey734@example.edu'),
(376,'Lori','Briggs','2000-11-21','lori.briggs322@example.edu'),
(377,'Dwayne','Gonzalez','2003-10-26','dwayne.gonzalez245@example.edu'),
(378,'Kathleen','Rios','2000-06-01','kathleen.rios272@example.edu'),
(379,'Kendra','Snyder','2005-01-12','kendra.snyder406@example.edu'),
(380,'Kathleen','Cole','2006-05-23','kathleen.cole135@example.edu'),
(381,'Anne','Reid','2003-12-30','anne.reid688@example.edu'),
(382,'Michelle','Burton','2000-03-16','michelle.burton661@example.edu'),
(383,'Carlos','Ramos','2001-06-03','carlos.ramos308@example.edu'),
(384,'Joshua','Brown','2003-01-21','joshua.brown469@example.edu'),
(385,'Lance','Hayes','1999-06-16','lance.hayes324@example.edu'),
(386,'Marie','Jones','2005-11-29','marie.jones952@example.edu'),
(387,'Melissa','Gilbert','2003-01-21','melissa.gilbert770@example.edu'),
(388,'Steven','Spencer','2005-05-01','steven.spencer959@example.edu'),
(389,'Paula','Cole','2005-06-23','paula.cole75@example.edu'),
(390,'Denise','Morris','2002-10-21','denise.morris10@example.edu'),
(391,'Edward','Brown','1999-10-30','edward.brown470@example.edu'),
(392,'Rachel','Cooper','2004-09-17','rachel.cooper637@example.edu'),
(393,'William','Thompson','2000-12-24','william.thompson577@example.edu'),
(394,'Samuel','Gonzales','2003-03-07','samuel.gonzales103@example.edu'),
(395,'Erik','Watson','2001-04-06','erik.watson76@example.edu'),
(396,'Riley','Morgan','2003-10-13','riley.morgan551@example.edu'),
(397,'Kristina','Holland','1999-07-12','kristina.holland219@example.edu'),
(398,'Cody','Gregory','2001-04-09','cody.gregory519@example.edu'),
(399,'Jennifer','Douglas','2006-04-01','jennifer.douglas272@example.edu'),
(400,'Morgan','Cook','2003-08-30','morgan.cook136@example.edu');
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
INSERT INTO `teaching` VALUES (1,1),(2,28),(3,16),(4,11),(5,9),(6,24),(7,22),(8,6),(9,17),(10,5),(11,23),(12,15),(13,29),(14,14),(15,26),(16,25),(17,8),(18,2),(19,27),(20,7),(21,19),(22,12),(23,20),(24,21),(25,10),(26,30),(27,3),(28,13),(29,4),(30,18);
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
  `birth_date` date NULL,
  `email` varchar(100) NULL,
  PRIMARY KEY (`s_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- legacy_student intentionally left EMPTY in the clean (0-defect) dataset:
-- it is the unmapped "dummy" student rows used as a completeness defect elsewhere.
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-01-01 00:00:00
