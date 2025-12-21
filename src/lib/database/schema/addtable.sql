-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

-- ---------------------------------------------------------------------------
-- Table: vhc_item_aliases
-- Stores a persistent mapping between VHC builder display IDs (e.g. "Brakes & Hubs-1")
-- and the canonical vhc_checks.vhc_id created in the database. This allows the
-- UI to reconnect job card rows with their parts even after page reloads.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vhc_item_aliases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  display_id text NOT NULL,
  vhc_item_id integer NOT NULL REFERENCES public.vhc_checks(vhc_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vhc_item_aliases_job_display_key UNIQUE (job_id, display_id)
);

CREATE INDEX IF NOT EXISTS idx_vhc_item_aliases_vhc_item_id
  ON public.vhc_item_aliases (vhc_item_id);

