-- Migration: Add missing job columns needed by Supabase
-- Generated: 2025-11-10 22:04:02Z
-- Purpose: Ensure the jobs table exposes new fields for rectification workflows.

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS completion_status TEXT,
ADD COLUMN IF NOT EXISTS rectification_notes TEXT,
ADD COLUMN IF NOT EXISTS job_description_snapshot TEXT,
ADD COLUMN IF NOT EXISTS vhc_authorization_reference TEXT,
ADD COLUMN IF NOT EXISTS task_checklist JSONB;
