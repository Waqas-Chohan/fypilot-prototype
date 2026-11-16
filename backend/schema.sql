-- FYPilot Database Schema for PostgreSQL
-- Run this in pgAdmin or psql before starting the backend

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funding_requests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    amount INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    student_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS archive_projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    year INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    supervisor VARCHAR(100) NOT NULL,
    similarity VARCHAR(20) NOT NULL DEFAULT 'low',
    summary TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (title, year)
);

INSERT INTO archive_projects (title, year, category, supervisor, similarity, summary) VALUES
('Deep-Rehab: CNN-Based Physiotherapy Coach', 2025, 'AI & ML', 'Dr. Tahir', 'low', 'A web app that uses a CNN to guide patients through prescribed physiotherapy exercises and tracks range-of-motion progress.')
ON CONFLICT (title, year) DO NOTHING;