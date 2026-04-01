-- file location: supabase/seed/reset-test-data.sql
-- Cleans up all test data (TEST- prefixed jobs and seed data).
-- Run with: npm run db:reset-test
-- Safe to run against dev DB — only deletes rows matching test patterns.

-- Delete TEST- prefixed jobs and linked records
DELETE FROM job_clocking WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM job_writeups WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM job_notes WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM job_files WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM job_status_history WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM vhc_checks WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM vhc_workflow_status WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM parts_job_items WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM job_requests WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'TEST-%');
DELETE FROM jobs WHERE job_number LIKE 'TEST-%';

-- Delete SEED- prefixed jobs and linked records
DELETE FROM job_clocking WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM job_writeups WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM job_notes WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM job_files WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM job_status_history WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM vhc_checks WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM vhc_workflow_status WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM parts_job_items WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM job_requests WHERE job_id IN (SELECT id FROM jobs WHERE job_number LIKE 'SEED-%');
DELETE FROM jobs WHERE job_number LIKE 'SEED-%';
