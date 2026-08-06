-- Phase 1: Developer-only Staff Global Style Review.
-- Immutable audit evidence is upserted separately from review state so a safe
-- re-import cannot erase decisions or the append-only review history.

CREATE TABLE IF NOT EXISTS public.staff_style_review_findings (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  audit_id                    text NOT NULL,
  original_audit_id           integer,
  source_key                  text NOT NULL,
  finding_type                text NOT NULL CHECK (finding_type IN ('Badge','Button','Input','Popup','Specialised')),
  audit_group                 text NOT NULL,
  category                    text NOT NULL CHECK (category IN ('badge','button','input','popup','specialised')),
  feature_area                text NOT NULL,
  subsection                  text,
  route                       text NOT NULL,
  section_name                text NOT NULL,
  visibility_instructions     text NOT NULL,
  issue_summary               text NOT NULL,
  source_reference            text NOT NULL,
  source_files                text[] NOT NULL DEFAULT '{}'::text[],
  line_references             text[] NOT NULL DEFAULT '{}'::text[],
  recommendation              text NOT NULL,
  partial_adoption            boolean NOT NULL DEFAULT false,
  partial_adoption_notes      text,
  specialist_exception_notes text,
  review_status               text NOT NULL DEFAULT 'Pending'
                                CHECK (review_status IN ('Pending','Keep','Change','Unable to Locate','Needs Manual Review','Final Check')),
  review_notes                text NOT NULL DEFAULT '',
  import_metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_imported_at           timestamp with time zone NOT NULL DEFAULT now(),
  last_synced_at              timestamp with time zone NOT NULL DEFAULT now(),
  updated_at                  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_style_review_findings_pkey PRIMARY KEY (id),
  CONSTRAINT staff_style_review_findings_original_id_check
    CHECK (original_audit_id IS NULL OR original_audit_id BETWEEN 1 AND 128),
  CONSTRAINT staff_style_review_findings_audit_source_unique UNIQUE (audit_id, source_key)
);

CREATE INDEX IF NOT EXISTS staff_style_review_findings_filter_idx
  ON public.staff_style_review_findings (category, review_status, partial_adoption);
CREATE INDEX IF NOT EXISTS staff_style_review_findings_original_id_idx
  ON public.staff_style_review_findings (original_audit_id);

CREATE TABLE IF NOT EXISTS public.staff_style_review_history (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  finding_id       uuid NOT NULL,
  audit_id         text NOT NULL,
  source_key       text NOT NULL,
  previous_status  text,
  new_status       text NOT NULL,
  previous_notes   text,
  new_notes        text,
  changed_by       text NOT NULL,
  changed_at       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_style_review_history_pkey PRIMARY KEY (id),
  CONSTRAINT staff_style_review_history_finding_fkey FOREIGN KEY (finding_id)
    REFERENCES public.staff_style_review_findings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_style_review_history_finding_idx
  ON public.staff_style_review_history (finding_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.staff_style_review_imports (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  source_path     text NOT NULL,
  source_hash     text NOT NULL,
  trigger         text NOT NULL CHECK (trigger IN ('initial','manual')),
  imported_by     text NOT NULL,
  parsed_total    integer NOT NULL,
  expected_total  integer NOT NULL,
  category_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_style_review_imports_pkey PRIMARY KEY (id)
);

ALTER TABLE public.staff_style_review_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_style_review_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_style_review_imports  ENABLE ROW LEVEL SECURITY;
