-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 18, 2025 at 03:55 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `professional_master's_degree`
--

-- --------------------------------------------------------

--
-- Table structure for table `classschedules`
--

CREATE TABLE `classschedules` (
  `schedule_id` int(11) NOT NULL,
  `course_id` int(11) DEFAULT NULL,
  `semester_id` int(11) DEFAULT NULL,
  `day_of_week` varchar(20) DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `classschedules`
--

INSERT INTO `classschedules` (`schedule_id`, `course_id`, `semester_id`, `day_of_week`, `start_time`, `end_time`) VALUES
(1, 1, 1, 'Monday', '05:00:00', '08:00:00'),
(2, 2, 1, 'Wednesday', '05:00:00', '08:00:00'),
(3, 3, 1, 'Tuesday', '05:00:00', '08:00:00'),
(4, 4, 1, 'Sunday', '05:00:00', '08:00:00'),
(5, 5, 2, 'Saturday', '02:00:00', '05:00:00'),
(6, 6, 2, 'Saturday', '05:00:00', '08:00:00'),
(7, 7, 2, 'Saturday', '11:00:00', '02:00:00'),
(8, 8, 2, 'Saturday', '08:00:00', '11:00:00'),
(9, 9, 3, 'Saturday', '08:00:00', '11:00:00'),
(10, 10, 3, 'Saturday', '05:00:00', '08:00:00'),
(11, 11, 3, 'Saturday', '02:00:00', '05:00:00'),
(12, 12, 3, 'Saturday', '11:00:00', '02:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `course_id` int(11) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `credit_hours` int(11) DEFAULT 3,
  `course_type` varchar(50) DEFAULT NULL,
  `program_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`course_id`, `course_name`, `credit_hours`, `course_type`, `program_id`) VALUES
(1, 'Analysis and Evaluation of Public Policies', 3, NULL, 1),
(2, 'Public and Local Administration in Egypt', 3, NULL, 1),
(3, 'Introduction to Public Policies and Development Policies', 3, NULL, 1),
(4, 'Administrative Development: Concepts and Strategies', 3, NULL, 1),
(5, 'Administrative Development Policies in Egypt', 3, NULL, 1),
(6, 'Comparative Public Policies', 3, NULL, 1),
(7, 'Good Governance and Administrative Reform', 3, NULL, 1),
(8, 'Public Policy-Making in Egypt', 3, NULL, 1),
(9, 'Enhancing Development Projects in Egypt', 3, NULL, 1),
(10, 'Civil Society and Development Projects in Egypt', 3, NULL, 1),
(11, 'Research Project', 3, NULL, 1),
(12, 'International Organizations and Development Projects in Egypt', 3, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `course_lecturers`
--

CREATE TABLE `course_lecturers` (
  `course_id` int(11) NOT NULL,
  `lecturer_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course_lecturers`
--

INSERT INTO `course_lecturers` (`course_id`, `lecturer_id`) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(4, 5),
(5, 5),
(5, 6),
(6, 7),
(6, 8),
(7, 9),
(8, 10),
(9, 2),
(9, 9),
(10, 5),
(10, 6),
(11, 1),
(12, 8),
(12, 10);

-- --------------------------------------------------------

--
-- Table structure for table `lecturers`
--

CREATE TABLE `lecturers` (
  `lecturer_id` int(11) NOT NULL,
  `lecturer_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `lecturers`
--

INSERT INTO `lecturers` (`lecturer_id`, `lecturer_name`) VALUES
(1, 'Prof. Dr. Abdel Salam Nwair'),
(2, 'Prof. Dr. Abdel Rahim Khalil'),
(3, 'Prof. Dr. Alaa Abdel Hafeez Mohamed'),
(4, 'Prof. Dr. Ahmed Al-Adawy'),
(5, 'Dr. Ahmed Al-Shoury'),
(6, 'Dr. Naglaa Gameel Shalaby'),
(7, 'Prof. Dr. Mohamed Ahmed Adawy'),
(8, 'Dr. Abdallah Faisal Allam'),
(9, 'Dr. Marwa Bakr'),
(10, 'Dr. Marwa Mamdouh Kedwany');

-- --------------------------------------------------------

--
-- Table structure for table `programs`
--

CREATE TABLE `programs` (
  `program_id` int(11) NOT NULL,
  `program_name` varchar(255) NOT NULL,
  `duration_semesters` int(11) NOT NULL,
  `start_month` varchar(50) DEFAULT NULL,
  `education_system` varchar(50) DEFAULT NULL,
  `fee_per_semester` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `programs`
--

INSERT INTO `programs` (`program_id`, `program_name`, `duration_semesters`, `start_month`, `education_system`, `fee_per_semester`) VALUES
(1, 'Professional Master\'s Degree in Public Policy and Development Project Evaluation', 4, 'October', 'Hybrid', 6360.00),
(2, 'Professional Master\'s Degree in Insurance and Risk Management', 4, 'October', 'Hybrid', 7360.00);

-- --------------------------------------------------------

--
-- Table structure for table `semesters`
--

CREATE TABLE `semesters` (
  `semester_id` int(11) NOT NULL,
  `program_id` int(11) DEFAULT NULL,
  `semester_number` int(11) DEFAULT NULL,
  `total_fees` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `semesters`
--

INSERT INTO `semesters` (`semester_id`, `program_id`, `semester_number`, `total_fees`) VALUES
(1, 1, 1, 6360.00),
(2, 1, 2, 6360.00),
(3, 1, 4, 6360.00),
(4, 2, 1, 7360.00);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `classschedules`
--
ALTER TABLE `classschedules`
  ADD PRIMARY KEY (`schedule_id`),
  ADD KEY `course_id` (`course_id`),
  ADD KEY `semester_id` (`semester_id`);

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`course_id`),
  ADD KEY `program_id` (`program_id`);

--
-- Indexes for table `course_lecturers`
--
ALTER TABLE `course_lecturers`
  ADD PRIMARY KEY (`course_id`,`lecturer_id`),
  ADD KEY `lecturer_id` (`lecturer_id`);

--
-- Indexes for table `lecturers`
--
ALTER TABLE `lecturers`
  ADD PRIMARY KEY (`lecturer_id`);

--
-- Indexes for table `programs`
--
ALTER TABLE `programs`
  ADD PRIMARY KEY (`program_id`);

--
-- Indexes for table `semesters`
--
ALTER TABLE `semesters`
  ADD PRIMARY KEY (`semester_id`),
  ADD KEY `program_id` (`program_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `classschedules`
--
ALTER TABLE `classschedules`
  MODIFY `schedule_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `course_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `lecturers`
--
ALTER TABLE `lecturers`
  MODIFY `lecturer_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `programs`
--
ALTER TABLE `programs`
  MODIFY `program_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `semesters`
--
ALTER TABLE `semesters`
  MODIFY `semester_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `classschedules`
--
ALTER TABLE `classschedules`
  ADD CONSTRAINT `classschedules_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`),
  ADD CONSTRAINT `classschedules_ibfk_2` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`semester_id`);

--
-- Constraints for table `courses`
--
ALTER TABLE `courses`
  ADD CONSTRAINT `courses_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `programs` (`program_id`);

--
-- Constraints for table `course_lecturers`
--
ALTER TABLE `course_lecturers`
  ADD CONSTRAINT `course_lecturers_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`),
  ADD CONSTRAINT `course_lecturers_ibfk_2` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`lecturer_id`);

--
-- Constraints for table `semesters`
--
ALTER TABLE `semesters`
  ADD CONSTRAINT `semesters_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `programs` (`program_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
