-- file location: supabase/migrations/001_enable_rls.sql
-- Purpose: Enable Row Level Security on all public tables
-- This prevents unauthorized access to your database tables

-- Enable RLS on parts_inventory table
ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;

-- Enable RLS on parts_requests table
ALTER TABLE public.parts_requests ENABLE ROW LEVEL SECURITY;

-- Enable RLS on vhc_checks table
ALTER TABLE public.vhc_checks ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sales_tracking table
ALTER TABLE public.sales_tracking ENABLE ROW LEVEL SECURITY;

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable RLS on activity_logs table
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on job_notes table
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on job_writeups table
ALTER TABLE public.job_writeups ENABLE ROW LEVEL SECURITY;

-- Enable RLS on job_files table
ALTER TABLE public.job_files ENABLE ROW LEVEL SECURITY;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on appointments table
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;