-- Migration: Create notifications table for staff alerts
-- Generated: 2025-11-10 22:04:02Z
-- Purpose: Enable in-app messaging for role-based notifications.

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  target_role TEXT,
  job_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
