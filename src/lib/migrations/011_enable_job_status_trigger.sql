-- file location: src/lib/migrations/011_enable_job_status_trigger.sql
-- Purpose: Activate job-status notification trigger permanently.

CREATE OR REPLACE FUNCTION public.handle_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_status_lower TEXT := lower(coalesce(NEW.status, ''));
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO notifications (message, target_role, job_number)
    VALUES (
      CASE
        WHEN new_status_lower = 'ready for workshop' THEN '🚗 Job #' || NEW.job_number || ' is ready for workshop.'
        WHEN new_status_lower = 'waiting for parts' THEN '🧩 Job #' || NEW.job_number || ' is waiting for parts approval.'
        WHEN new_status_lower IN ('vhc sent to service', 'vhc_sent_to_service', 'vhc sent') THEN '📋 Job #' || NEW.job_number || ' VHC sent to service managers.'
        WHEN new_status_lower IN ('job complete', 'completed', 'complete') THEN '🎉 Job #' || NEW.job_number || ' is complete and ready for review.'
        ELSE 'ℹ️ Job #' || NEW.job_number || ' status updated to ' || NEW.status
      END,
      CASE
        WHEN new_status_lower = 'ready for workshop' THEN 'Techs'
        WHEN new_status_lower = 'waiting for parts' THEN 'Parts'
        WHEN new_status_lower IN ('vhc sent to service', 'vhc_sent_to_service', 'vhc sent') THEN 'Managers'
        WHEN new_status_lower IN ('job complete', 'completed', 'complete') THEN 'Managers'
        ELSE NULL
      END,
      NEW.job_number
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_status_notify ON jobs;
CREATE TRIGGER job_status_notify
AFTER UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_job_status_change();
