-- Allow an explicitly confirmed finding deletion to remove its dependent
-- review history in the same PostgreSQL transaction.

ALTER TABLE public.staff_style_review_history
  DROP CONSTRAINT IF EXISTS staff_style_review_history_finding_fkey;

ALTER TABLE public.staff_style_review_history
  ADD CONSTRAINT staff_style_review_history_finding_fkey
  FOREIGN KEY (finding_id)
  REFERENCES public.staff_style_review_findings(id)
  ON DELETE CASCADE;
