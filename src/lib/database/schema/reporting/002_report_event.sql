-- ===========================================================================
-- Reporting foundation — 002 Event spine
-- Additive, idempotent. Implements Phase-2 §3.1 (report_event) + indexes §3.1.
-- Append-only, immutable, department-stamped. Fed by emit helpers + bridges.
-- No triggers — written by src/lib/database/reporting/reportEvent.js.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.report_event (
  event_id            bigserial PRIMARY KEY,
  event_uuid          uuid,                 -- stable external id (idempotency / dedupe)
  occurred_at         timestamptz NOT NULL DEFAULT now(),  -- business time
  recorded_at         timestamptz NOT NULL DEFAULT now(),  -- ingestion time (late-arrival detection)
  event_name          text NOT NULL,        -- canonical UPPERCASE name (catalogue)
  event_category      text,                 -- Phase-2 §3.3
  domain              text,                 -- open vocabulary (Phase-2 §3.1/§15)
  entity_type         text,
  entity_id           text,                 -- text to allow int + uuid + composite keys
  parent_entity_type  text,
  parent_entity_id    text,
  from_state          text,
  to_state            text,
  actor_kind          text,                 -- user|system|customer|integration
  actor_user_id       bigint,               -- canonical users.user_id (dim_actor)
  actor_auth_uuid     uuid,                 -- auth.users.id when that is the only id present
  actor_role          text,                 -- point-in-time role
  owner_department    text,                 -- the dimension (Phase-2 §7)
  related_departments text[],               -- consuming/affected departments
  amount_gbp          numeric,
  quantity            numeric,
  duration_seconds    bigint,
  payload             jsonb,                -- minimal typed extras (keys + delta only)
  source              text,                 -- emit|bridge:audit_log|bridge:job_activity_events|bridge:job_status_history|notification|backfill
  formula_context     text
);

-- Idempotency / dedupe on the deterministic event_uuid (Phase-2 §3.2).
CREATE UNIQUE INDEX IF NOT EXISTS report_event_uuid_idx
  ON public.report_event(event_uuid) WHERE event_uuid IS NOT NULL;

-- Query indexes (Phase-2 §3.1).
CREATE INDEX IF NOT EXISTS report_event_domain_time_idx
  ON public.report_event(domain, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_entity_idx
  ON public.report_event(entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_owner_dept_time_idx
  ON public.report_event(owner_department, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_name_time_idx
  ON public.report_event(event_name, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_actor_time_idx
  ON public.report_event(actor_user_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Row Level Security (mandatory — see README). Server-only spine; the service
-- role bypasses RLS, so enabling deny-by-default RLS keeps the append-only event
-- stream unreachable from the browser. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.report_event ENABLE ROW LEVEL SECURITY;
