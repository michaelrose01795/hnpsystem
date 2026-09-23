begin;

-- Rollback for
-- supabase/migrations/20260923120000_job_card_settings_fields.sql.
--
-- This file lives in supabase/rollbacks/, NOT supabase/migrations/, on purpose.
-- `supabase db push` applies every file in the migrations folder in filename
-- order, so a rollback sitting next to its own migration would be applied
-- immediately after it. Run this one by hand (SQL editor or psql) and only when
-- you actually want to revert.
--
-- Dropping the columns discards every priority, service advisor, next-update
-- owner and reminder flag set from the job card settings popup. The popup falls
-- back to its `migrationPending` state; nothing else on the job card reads them.

drop index if exists public.jobs_priority_idx;

alter table public.jobs drop constraint if exists jobs_priority_check;
alter table public.jobs drop constraint if exists jobs_service_advisor_id_fkey;
alter table public.jobs drop constraint if exists jobs_next_update_owner_id_fkey;

alter table public.jobs
  drop column if exists priority,
  drop column if exists service_advisor_id,
  drop column if exists next_update_owner_id,
  drop column if exists next_update_reminder_enabled;

commit;
