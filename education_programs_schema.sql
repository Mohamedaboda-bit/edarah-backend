
-- إنشاء قاعدة البيانات
CREATE DATABASE IF NOT EXISTS education_programs;
USE education_programs;

-- جدول البرامج
CREATE TABLE programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_years INT DEFAULT 2,
    is_professional BOOLEAN DEFAULT TRUE
);

-- جدول الترمات
CREATE TABLE semesters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT,
    number INT,
    semester_code VARCHAR(50),
    FOREIGN KEY (program_id) REFERENCES programs(id)
);

-- جدول المستويات
CREATE TABLE levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT,
    level_number INT,
    FOREIGN KEY (program_id) REFERENCES programs(id)
);

-- جدول الأماكن
CREATE TABLE places (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(255)
);

-- جدول المواد الدراسية
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    estimated_hours INT, -- input manually, default 3 for most
    is_optional BOOLEAN DEFAULT FALSE
);

-- جدول الربط بين البرنامج والمادة والمستوى والترم والمكان
CREATE TABLE program_courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT,
    course_id INT,
    level_id INT,
    semester_id INT,
    place_id INT,
    FOREIGN KEY (program_id) REFERENCES programs(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (level_id) REFERENCES levels(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    FOREIGN KEY (place_id) REFERENCES places(id)
);

-- جدول المصاريف
CREATE TABLE fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT,
    book_fee DECIMAL(10,2),
    other_fee DECIMAL(10,2),
    external_students_fee DECIMAL(10,2),
    required_documents_count INT,
    FOREIGN KEY (program_id) REFERENCES programs(id)
);

-- جدول النظام التعليمي
CREATE TABLE system_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT,
    education_type VARCHAR(50), -- Hybrid, Offline, etc.
    hybrid_ratio VARCHAR(20),   -- "60,40"
    exams_type VARCHAR(50),
    study_days VARCHAR(100),
    duration_weeks INT,
    admission_start_months VARCHAR(50), -- e.g., "August, September"
    study_start_month VARCHAR(50),      -- e.g., "October"
    graduation_project BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (program_id) REFERENCES programs(id)
);

-- جدول الطلاب (اختياري)
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    program_id INT,
    FOREIGN KEY (program_id) REFERENCES programs(id)
);
