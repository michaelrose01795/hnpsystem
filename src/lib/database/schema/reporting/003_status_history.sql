-- ===========================================================================
-- Reporting foundation — 003 Status history
-- Additive, idempotent. Implements Phase-2 §6 (generic per-entity pattern).
-- One table per entity (not polymorphic) — clean FKs/types/indexes, mirrors the
-- existing job_status_history (which already exists and is the reference template).
-- App-emitted (no triggers). Rollout priority per Phase-2 §6 / §19.
-- ===========================================================================

-- Generic pattern (Phase-2 §6.1):
--   history_id, entity_id, from_status, to_status, changed_by (canonical user id),
--   actor_kind, reason, department (denormalised owner), changed_at, meta jsonb.

-- P4 priority 1 — Parts (unlocks parts cycle-time, dwell, ageing, fill).
CREATE TABLE IF NOT EXISTS public.parts_job_items_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- parts_job_items.id
  from_status text,
  to_status   text,
  changed_by  bigint,               -- canonical user id (dim_actor), not free text
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'parts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS parts_status_history_entity_idx
  ON public.parts_job_items_status_history(entity_id, changed_at);

-- P4 priority 2 — VHC item (decision-level transitions, not derived projection).
CREATE TABLE IF NOT EXISTS public.vhc_item_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   integer NOT NULL,     -- vhc_checks.vhc_id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'workshop',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS vhc_item_status_history_entity_idx
  ON public.vhc_item_status_history(entity_id, changed_at);

-- P4 priority 3 — Invoice (Draft->Sent->Paid latency, AR ageing by transition).
CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- invoices.id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'accounts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS invoice_status_history_entity_idx
  ON public.invoice_status_history(entity_id, changed_at);

-- Account (credit-control freeze/close events with reason).
CREATE TABLE IF NOT EXISTS public.account_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- accounts.id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'accounts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS account_status_history_entity_idx
  ON public.account_status_history(entity_id, changed_at);

-- Appointment (booking funnel, no-show rate, lead time).
CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- appointments.id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'service',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS appointment_status_history_entity_idx
  ON public.appointment_status_history(entity_id, changed_at);

-- Delivery (delivery SLA, on-time %). NOTE: reconcile duplicate delivery
-- families first (debt D7) before treating this as authoritative.
CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   text NOT NULL,        -- delivery key (family TBD, D7)
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'parts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS delivery_status_history_entity_idx
  ON public.delivery_status_history(entity_id, changed_at);

-- NOTE: mot_test / paint_stage / wash status-history tables are intentionally
-- omitted — they require their missing domain entities first (Phase-2 TD-E / P7).
