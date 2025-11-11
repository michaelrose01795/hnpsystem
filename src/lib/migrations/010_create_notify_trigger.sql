-- Migration: Create job-status notification trigger
-- Generated: 2025-11-10 22:04:02Z
-- Purpose: Provide an optional database-level automation for notifications.

CREATE OR REPLACE FUNCTION public.handle_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_status_lower TEXT := lower(coalesce(NEW.status, ''));
  feature_flag TEXT := coalesce(current_setting('app.enable_job_status_notifications', true), 'off');
BEGIN
  -- Allow turning the trigger on/off via: ALTER DATABASE ... SET app.enable_job_status_notifications = 'on';
  IF feature_flag <> 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF new_status_lower = 'ready for workshop' THEN
      INSERT INTO notifications (message, target_role, job_number)
      VALUES (
        CONCAT('🚗 Job #', NEW.job_number, ' is ready for workshop.'),
        'Techs',
        NEW.job_number
      );
    ELSIF new_status_lower = 'waiting for parts' THEN
      INSERT INTO notifications (message, target_role, job_number)
      VALUES (
        CONCAT('🧩 Job #', NEW.job_number, ' is waiting for parts approval.'),
        'Parts',
        NEW.job_number
      );
    ELSIF new_status_lower IN ('vhc sent to service', 'vhc_sent_to_service', 'vhc sent') THEN
      INSERT INTO notifications (message, target_role, job_number)
      VALUES (
        CONCAT('📋 Job #', NEW.job_number, ' VHC sent to service managers.'),
        'Managers',
        NEW.job_number
      );
    ELSIF new_status_lower IN ('job complete', 'complete', 'completed') THEN
      INSERT INTO notifications (message, target_role, job_number)
      VALUES (
        CONCAT('🎉 Job #', NEW.job_number, ' is complete and ready for review.'),
        'Managers',
        NEW.job_number
      );

      INSERT INTO notifications (message, target_role, job_number)
      VALUES (
        CONCAT('🧽 Job #', NEW.job_number, ' needs valeting before handover.'),
        'Valet',
        NEW.job_number
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_status_notify ON jobs;

CREATE TRIGGER job_status_notify
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_job_status_change();
