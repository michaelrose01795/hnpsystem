-- file location: src/lib/database/schema/migrations/2026-04-17-job-files-vhc-concern-link.sql
-- Adds a JSONB column that links a VHC media upload back to the exact
-- amber/red concern that prompted it. Consumed by the per-section
-- camera button on the six VHC detail modals (wheels, brakes, service,
-- external, internal, underside).
--
-- Payload shape, written by the browser via uploadVhcMediaFile({...,
-- concernLink}) and handled by /api/vhc/upload-media:
--   {
--     "section":        "external",
--     "category":       "Wipers/Washers/Horn",
--     "categoryLabel":  "Wipers/Washers/Horn",
--     "concernId":      "external-Wipers/Washers/Horn-0",
--     "index":          0,
--     "label":          "Front wiper blade split, requires replacing",
--     "status":         "red"
--   }

ALTER TABLE public.job_files ADD COLUMN IF NOT EXISTS vhc_concern_link jsonb;

-- GIN index keeps "show all media for this concern" lookups cheap.
CREATE INDEX IF NOT EXISTS job_files_vhc_concern_link_idx
  ON public.job_files USING gin (vhc_concern_link jsonb_path_ops);

NOTIFY pgrst, 'reload schema';
