ALTER TABLE public.job_share_links
  ADD COLUMN IF NOT EXISTS viewed_at timestamp with time zone;
