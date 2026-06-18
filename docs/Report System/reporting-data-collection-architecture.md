# HNPSystem — Reporting Data Collection & Event Architecture (Phase 2 Design)

> **Status:** Design only. No code, migrations, or database changes have been created.
> **Document type:** Master implementation blueprint for all reporting **data collection** — event tracking, status history, ownership, actor attribution, KPI snapshots, aggregation, audit, retention and data quality.
> **Audience:** Future implementation phases and future AI/engineering sessions.
> **Companion documents:**
> - [`docs/reporting-readiness-audit.md`](reporting-readiness-audit.md) — the factual audit (what exists).
> - [`docs/reporting-platform-architecture.md`](reporting-platform-architecture.md) — Phase 1 platform architecture (the read-side fabric).
> This document (Phase 2) defines the **write-side / capture-side**: exactly what data flows into the reporting platform, how, and where it is stored.

---

## 0. How to use this document

- **Naming convention:** `EVENT_NAME` = a reporting event (uppercase NOUN_VERB). Objects prefixed `report_*`, `*_status_history`, `kpi_*`, `dim_*`, `agg_*`, or marked _(proposed)_ are design targets that **do not exist yet**. Backticked names without _(proposed)_ already exist in the repo (verified in the audit).
- **Stack constraints (unchanged):** Next.js Pages Router, React, Supabase (PostgreSQL), NextAuth.js, Tailwind v4 + CSS custom properties. DB access only via `src/lib/database/*` helpers. App-emitted history, **no DB triggers** (matches the existing convention — Phase 1 ADR-3).
- **Relationship to Phase 1:** Phase 1 named the four foundations (event spine, status-history pattern, department dimension, KPI snapshot/rollup layer). Phase 2 **specifies them in full** so they can be built without further design.

### Table of contents
1. Executive Summary
2. Data Collection Philosophy
3. Event Architecture (categories + standard event envelope)
4. Event Catalogue (per department, complete inventory)
5. Event Ownership Architecture
6. Status History Architecture (+ lifecycle diagrams)
7. Department Dimension Architecture
8. Actor Architecture
9. KPI Snapshot Architecture
10. Aggregation Architecture
11. Audit Architecture
12. Retention Architecture
13. Data Quality Architecture
14. Reporting Data Dictionary
15. Future Scalability
16. Risks
17. Architecture Decisions
18. Technical Debt
19. Recommended Build Order
20. Phase 2 Success Criteria

---

## 1. Executive Summary

Phase 1 established that HNPSystem can report on current state but cannot reliably report on **change over time** — because only `jobs` has a status-history table, there is no unified event stream, department is not a real dimension, and there is no snapshot/rollup layer. Phase 2 designs the **data-collection backbone** that fixes this at the source.

The backbone is a single, append-only, department-stamped **event spine** (`report_event`) fed by three mechanisms: (a) a forward bridge from the systems that already record truth (`audit_log`, `job_activity_events`, `job_status_history`), (b) thin `emit*` helpers added inside existing DB helpers where coverage is missing, and (c) the existing status→notification path. Beneath the event spine sits a **generic per-entity status-history pattern** (modelled on the proven `job_status_history`), a **canonical department dimension**, a **canonical actor model** (resolving the int-vs-uuid identity split), and on top sit **immutable KPI snapshots** rolled up daily→weekly→monthly→quarterly→yearly for 10+ year trend retention.

The design is **capture-once, derive-many**: every meaningful business moment is captured exactly once as an event with full context (what, which entity, who, which department, when), and every report/KPI/trend is derived from that durable record rather than re-querying mutable operational tables. This is what makes cycle-time, dwell-time, SLA, throughput, conversion and audit reporting possible and trustworthy.

Every department in scope (Workshop, Parts, Service Advisors, MOT, Valeting, Paint, Accounts, Admin, Management) receives a complete event inventory, ownership rules, and a status-history model. The architecture is explicitly forward-compatible with future domains (Sales, vehicle stock, buying, customer/supplier portals, warranty/manufacturer integrations) by using a domain-agnostic event/dimension shape — new domains add catalogue entries and emitters, never new infrastructure.

**Phase 2 produces the capture blueprint only. Implementation begins in later phases.**

---

## 2. Data Collection Philosophy

### 2.1 What SHOULD be captured
- **Every business-meaningful state transition** of a reportable entity (job, VHC item, part line, invoice, account, appointment, delivery, MOT, paint stage, wash, warranty claim).
- **Every lifecycle milestone** (created, assigned, started, completed, released, cancelled).
- **Every decision** with commercial or compliance weight (VHC authorise/decline, parts approval, invoice issue/void, credit freeze, role change).
- **Every actor + timestamp + department** for the above (the "who/when/where" context).
- **Financial events** (invoice raised/paid, payment received, transaction posted, refund/credit).
- **Communication outcomes** that drive KPIs (VHC sent, customer viewed, customer responded) — at the *event* level, not message content.
- **Inputs to ratio KPIs** (sold hours, clocked hours, parts cost, labour cost) at the moment they become known.

### 2.2 What should NOT be captured (anti-scope)
- **High-frequency UI noise** — keystrokes, scroll, hovers, tab switches, page views that aren't reporting-relevant.
- **Message/content bodies** in the event stream (PII bloat) — capture the comms *event* (sent/viewed/replied) and reference the source, not the text.
- **Duplicated state** the event already implies — don't re-store the whole entity in every event payload; store identifying keys + the delta.
- **Derived values that can be recomputed** — store inputs (numerator/denominator), not pre-rounded ratios, in raw events.
- **Secrets / raw PII beyond what audit already governs** — reuse `audit_log`'s existing redaction policy; never widen PII exposure for analytics.
- **Speculative future-domain events** not yet in scope — the shape supports them (§15) but we don't emit empty Sales/stock events now.

### 2.3 Event-driven reporting principles
1. **Capture once, derive many.** A business moment is one event; all reports derive from it.
2. **Events are immutable & append-only.** Corrections are new events, never edits.
3. **Events are self-describing.** Each carries entity, type, from/to state, actor, department, timestamp, and a minimal typed payload.
4. **Emit at the source of truth.** Events are emitted inside the DB helper that performs the operation, not reconstructed later.
5. **Reuse existing truth before inventing.** Bridge `audit_log` / `job_activity_events` / `job_status_history` before adding new emitters.
6. **Department & actor stamped at write time.** No post-hoc inference.

### 2.4 Reporting data ownership principles
1. **Every event has exactly one producing department** (owner) and zero-or-more consuming departments.
2. **Ownership follows the actor's department**, falling back to the entity's department, falling back to `system`.
3. **Cross-department events carry both producer and the downstream-affected department(s)** so each can report on its slice.
4. **Management always has read visibility** across all departments; it owns no operational events directly.

### 2.5 Audit principles
1. **One audit backbone:** reuse `audit_log` (hash-chained, redacting, tamper-evident). Do not build a parallel audit engine.
2. **Audit the high-value writes the audit found unlogged:** role changes, clocking edits, invoice/payment create/void, deletes.
3. **Reporting access is itself audited** (who viewed/exported what).
4. **Audit ≠ events ≠ history** — distinct concerns that share a feed: audit is for compliance/forensics, events for analytics, history for lifecycle reconstruction. The event spine bridges all three but each has its own retention and access rules.

### 2.6 Historical tracking principles
1. **Never overwrite history.** State changes append to `*_status_history`; aggregates snapshot immutably.
2. **Versioned definitions.** KPI formulas, status maps, and snapshot logic carry a version so a 2026 number stays explainable in 2036.
3. **Reconstructable trends.** Daily snapshots + raw events allow any rollup to be rebuilt from scratch.
4. **Late data tolerated.** Recompute the affected day idempotently; never silently drop.

---

## 3. Event Architecture

### 3.1 The event spine — `report_event` _(proposed)_
The single normalised, append-only stream. (Schema first proposed in Phase 1 §9.14; finalised here.)

```
report_event (proposed)
  event_id        bigserial PRIMARY KEY
  event_uuid      uuid            -- stable external id (idempotency / dedupe)
  occurred_at     timestamptz     -- business time of the event (default now())
  recorded_at     timestamptz     -- ingestion time (for late-arrival detection)
  event_name      text            -- canonical UPPERCASE name (e.g. JOB_CHECKED_IN)
  event_category  text            -- see §3.3
  domain          text            -- workshop|parts|vhc|service|mot|valet|paint|accounts|admin|system|<future>
  entity_type     text            -- job|vhc_item|part_line|invoice|account|appointment|delivery|mot_test|paint_job|wash|warranty_claim|user|report
  entity_id       text            -- entity key (text to allow int + uuid + composite)
  parent_entity_type text         -- e.g. job for a vhc_item (drill-up)
  parent_entity_id   text
  from_state      text            -- nullable (creation events have none)
  to_state        text
  actor_kind      text            -- user|system|customer|integration  (see §8)
  actor_user_id   int             -- canonical users.user_id (see §8.4)
  actor_auth_uuid uuid            -- auth.users.id when that's the only id present
  actor_role      text
  owner_department text           -- producing department (the dimension, §7)
  related_departments text[]      -- consuming/affected departments
  amount_gbp      numeric         -- nullable; for financial/value events
  quantity        numeric         -- nullable; for count/qty events
  duration_seconds bigint         -- nullable; pre-computed where the event closes an interval
  payload         jsonb           -- minimal typed extras (keys + delta only)
  source          text            -- emit|bridge:audit_log|bridge:job_activity_events|bridge:job_status_history|notification
  formula_context text            -- optional version tag for derived fields
```

**Indexes (design):** `(domain, occurred_at)`, `(entity_type, entity_id, occurred_at)`, `(owner_department, occurred_at)`, `(event_name, occurred_at)`, `(actor_user_id, occurred_at)`, unique `(event_uuid)`.

### 3.2 Standard event envelope (applies to EVERY catalogue event)
To avoid repeating nine fields per event in §4, **every catalogued event MUST capture the following unless explicitly noted otherwise**:

| Envelope field | Rule (default for all events) |
|---|---|
| **Timestamp** | `occurred_at` = the real business moment (not ingestion). Mandatory. `recorded_at` set on insert. |
| **Actor** | `actor_kind` + canonical `actor_user_id` (or `actor_auth_uuid`) + `actor_role`. Mandatory; `system`/`customer`/`integration` allowed (§8). |
| **Owner department** | Resolved at write time (§7.5). Mandatory. |
| **Audit** | If the event is in the **audit-required set** (§11.2) it ALSO writes an `audit_log` row. Default: analytics-only events do not. |
| **Entity linkage** | `entity_type`/`entity_id` mandatory; `parent_*` where a drill-up exists. |
| **Idempotency** | `event_uuid` deterministic per (entity, event_name, occurred_at) so re-emits dedupe. |

The per-department tables in §4 therefore specify only what **differs or matters per event**: Purpose, Trigger source, Owner, Related departments, key Required-data/payload, and primary Reporting usage. Where an event has **non-default actor/timestamp/audit needs**, it is flagged in the row.

### 3.3 Event categories
| Category | Meaning | Examples |
|---|---|---|
| **LIFECYCLE** | Entity created/closed/cancelled | `JOB_CREATED`, `INVOICE_CREATED`, `WASH_CREATED` |
| **ASSIGNMENT** | Ownership/assignee changes | `JOB_ASSIGNED`, `MOT_TESTER_ASSIGNED` |
| **STATUS_TRANSITION** | A tracked from→to state move | `PART_STATUS_CHANGED`, `JOB_STATUS_CHANGED` |
| **MILESTONE** | A significant lifecycle waypoint (no full state machine) | `JOB_CHECKED_IN`, `VHC_COMPLETED`, `WARRANTY_QC_STARTED` |
| **DECISION** | A commercial/compliance choice | `VHC_AUTHORISED`, `VHC_DECLINED`, `PART_APPROVED`, `INVOICE_VOIDED` |
| **FINANCIAL** | Money movement / value crystallised | `INVOICE_PAID`, `PAYMENT_RECEIVED`, `TRANSACTION_POSTED` |
| **COMMUNICATION** | Customer/staff comms outcome | `VHC_SENT`, `VHC_VIEWED`, `NOTIFICATION_SENT` |
| **DOCUMENT_MEDIA** | Files/photos/videos | `VHC_MEDIA_UPLOADED`, `DOCUMENT_ATTACHED` |
| **INVENTORY** | Stock movement | `STOCK_RECEIVED`, `STOCK_ALLOCATED`, `STOCK_ADJUSTED` |
| **TIME_LABOUR** | Clocking / labour | `CLOCK_ON`, `CLOCK_OFF`, `CLOCKING_EDITED` |
| **AUDIT_SECURITY** | Access/identity/compliance | `ROLE_CHANGED`, `LOGIN_SUCCEEDED`, `RECORD_DELETED` |
| **SYSTEM_AUTOMATED** | Background/cron/integration | `AUTO_CLOCKOUT`, `SNAPSHOT_BUILT`, `DVLA_SYNCED` |

### 3.4 Event naming convention
`NOUN_VERB` in past tense, uppercase, domain-prefixed where ambiguous (`PART_*`, `VHC_*`, `INVOICE_*`). Status-transition events use `<ENTITY>_STATUS_CHANGED` with `from_state`/`to_state` carrying the specifics, **plus** named milestone aliases for the few transitions that are KPI-critical (e.g. `PART_FITTED` is emitted alongside `PART_STATUS_CHANGED to_state=fitted`) so KPIs can target a stable name.

---

## 4. Event Catalogue (complete inventory by department)

> Every row inherits the §3.2 envelope (timestamp + actor + owner-department + entity linkage + idempotency). Columns show what is event-specific. **Audit?** = also writes `audit_log`. **Src** = primary trigger source today.

### 4.1 Workshop (owner: Workshop)
| Event | Category | Purpose | Trigger source (Src) | Related depts | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `JOB_CREATED` | LIFECYCLE | New job card opened | `jobs` insert helper | Service, Parts, Accounts | job_number, type, division, service_mode, source | – | Throughput, intake volume |
| `JOB_ASSIGNED` | ASSIGNMENT | Technician assigned | `jobs.assigned_to` update | Management | technician_id (from/to) | – | Workload distribution, per-tech volume |
| `JOB_CHECKED_IN` | MILESTONE | Vehicle arrived/booked in | `jobs.checked_in_at`/`checked_in_by` | Service | mileage, checked_in_by | – | Arrival throughput, check-in→start latency |
| `JOB_STARTED` | MILESTONE | Workshop work began | `workshop_started_at`/`by`; first `job_clocking` clock-on | – | started_by, work_type | – | Stage cycle-time start |
| `TECH_WORK_COMPLETED` | MILESTONE | Technician finished main work | `tech_completion_status=tech_complete` | Service, Parts | completion_status | – | Cycle-time, additional-work split |
| `JOB_STATUS_CHANGED` | STATUS_TRANSITION | Any main status move | `updateJobStatus` / `/api/status/update` | all | from/to (booked→checked_in→in_progress→invoiced→released) | – | Time-in-stage, funnel |
| `JOB_COMPLETED` | MILESTONE | Job work complete | `jobs.completed_at` | Service, Accounts, Valet | completed_by | – | Completed/day, total cycle-time |
| `JOB_REDIRECTED_FROM_MOBILE` | MILESTONE | Mobile→workshop redirect | `redirected_from_mobile_at` | Service | reason, mobile_outcome | – | Mobile failure analysis |
| `CLOCK_ON` | TIME_LABOUR | Tech clocked onto job | `jobClocking` clock-in | Management | request_id, work_type | – | Labour hours, utilisation |
| `CLOCK_OFF` | TIME_LABOUR | Tech clocked off | `jobClocking` clock-out | Management | duration_seconds | – | Clocked vs sold hours |
| `CLOCKING_EDITED` | AUDIT_SECURITY | Manual clock adjustment/override/delete | clocking edit helper | Accounts/HR, Management | before/after times, reason | **Yes** | Payroll integrity, edit audit |
| `JOB_REOPENED` | STATUS_TRANSITION | Job moved backwards (manager) | manager status override | Management | from/to, reason | **Yes** | Rework signal, exception audit |

### 4.2 Parts (owner: Parts)
| Event | Category | Purpose | Src | Related depts | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `PART_REQUESTED` | LIFECYCLE | Part line created/requested | `parts_job_items`/`parts_requests` insert | Workshop, VHC | part_id, qty_requested, origin, vhc_item_id | – | Demand, VHC→parts conversion |
| `PART_APPROVED` | DECISION | Request authorised | status→`allocated`/auth | Workshop | approved_by | – | Approval latency |
| `PART_ORDERED` | STATUS_TRANSITION | Put on order with supplier | status→`on_order`; `jobs.parts_ordered_at` | Accounts | supplier(text), eta | – | On-order pipeline, lead-time start |
| `PART_RECEIVED` | INVENTORY | Goods-in received | `parts_deliveries`→`received`; `parts_stock_movements` | Workshop | qty_received, delivery_id | – | Lead time, goods-in accuracy |
| `PART_ALLOCATED` | STATUS_TRANSITION | Reserved to a job | status→`allocated` | Workshop | qty_allocated | – | Allocation rate |
| `PART_PRE_PICKED` / `PART_PICKED` | STATUS_TRANSITION | Pre-pick / picked | status→`pre_picked`/`picked` | Workshop | pre_pick_location | – | Pick workload, dwell time |
| `PART_FITTED` | MILESTONE | Fitted to vehicle | status→`fitted` | Workshop | qty_fitted | – | Fit rate, fitted vs ordered |
| `PART_CANCELLED` / `PART_REMOVED` / `PART_UNAVAILABLE` | STATUS_TRANSITION | Negative outcomes | status→`cancelled`/`removed`/`unavailable` | Workshop, Accounts | reason | – | Waste, recovery, supplier fill |
| `PART_STATUS_CHANGED` | STATUS_TRANSITION | Generic catch-all transition | parts status helper | Workshop | from/to (14-value enum) | – | Dwell time per status, ageing |
| `STOCK_RECEIVED` / `STOCK_ALLOCATED` / `STOCK_ADJUSTED` / `STOCK_RETURNED` | INVENTORY | Ledger movements | `parts_stock_movements` insert | Accounts | movement_type, qty, unit_cost | – | Stock turn, valuation, shrinkage |
| `PART_ORDER_CARD_CREATED`/`_COMPLETED` | LIFECYCLE | Counter/trade order | `parts_order_cards` | Accounts | order_number, total | – | Counter sales (future revenue link) |

### 4.3 Service Advisors (owner: Service)
| Event | Category | Purpose | Src | Related depts | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `APPOINTMENT_BOOKED` | LIFECYCLE | Appointment created | `appointments` insert | Workshop | scheduled_time | – | Booking volume, capacity |
| `APPOINTMENT_STATUS_CHANGED` | STATUS_TRANSITION | Appt state move | `appointments.status` | Workshop | from/to | – | Booking funnel, no-shows |
| `BOOKING_REQUEST_SUBMITTED`/`_APPROVED` | DECISION | Pre-job booking workflow | `job_booking_requests` | Management | price_estimate, approved_by | – | Conversion of enquiries |
| `VHC_SENT` | COMMUNICATION | VHC sent to customer | `vhc_send_history`; `jobs.vhc_sent_at` | Workshop, VHC | send_method, customer_email | – | Send→decision latency, conversion denominator |
| `CUSTOMER_STATUS_SET` | MILESTONE | Waiting/loan/collection set | `job_customer_statuses` | Workshop | customer_status | – | Waiting mix |
| `CUSTOMER_CONTACTED` | COMMUNICATION | Outbound comms logged | messaging/notes | – | channel | – | Comms responsiveness (event-level) |

### 4.4 VHC (cross-cutting; produced in Workshop, sent by Service, decided by Customer)
> VHC is a cross-department flow; catalogued separately because ownership shifts (see §5.4). Owner of each event = the acting department.
| Event | Category | Purpose | Src | Owner | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|---|
| `VHC_CREATED` | LIFECYCLE | VHC item raised | `vhc_checks` insert | Workshop | Service | section, severity (R/A/G) | – | Inspection volume, RAG counts |
| `VHC_ITEM_PRICED` | MILESTONE | Labour/parts cost set | vhc price update | Service | Parts | labour_hours, parts_cost | – | Pricing latency, upsell value |
| `VHC_SENT` | COMMUNICATION | Sent to customer | `vhc_send_history` | Service | Workshop | send_method | – | Conversion funnel |
| `VHC_VIEWED` | COMMUNICATION | Customer opened share link | `job_share_links.viewed_at` | Service | – | viewed_at | – | Engagement, view→decision time |
| `VHC_AUTHORISED` | DECISION | Customer/staff authorised item | `vhc_checks.approval_status`=authorized; share endpoint | Service (or Customer) | Workshop, Parts | item_id, authorized_total_gbp | – | Conversion rate, upsell £ |
| `VHC_DECLINED` | DECISION | Customer/staff declined | `vhc_declinations` | Service (or Customer) | Workshop | declined_total_gbp, reason | – | Decline rate, lost £ |
| `VHC_ITEM_STATUS_CHANGED` | STATUS_TRANSITION | Derived-workflow transition (persisted at decision level) | vhc item helper | Workshop | Parts | from/to (new→awaiting_customer→approved→in_progress→completed/declined) | – | Per-item stage timing |
| `VHC_COMPLETED` | MILESTONE | VHC work complete | `jobs.vhc_completed_at` | Workshop | Service | – | VHC cycle-time |
| `VHC_REOPENED` | DECISION | Decision reversed | vhc reopen | Workshop | Service | prior_decision | **Yes** | Re-authorisation audit |
| `VHC_MEDIA_UPLOADED` | DOCUMENT_MEDIA | Photo/video attached | `job_files` + `vhc_concern_link` | Workshop | Service | concern_id, is_main_video | – | Media completeness |

### 4.5 MOT (owner: MOT) — _requires `mot_tests` entity (§15/P7); interim events use job overlay_
| Event | Category | Purpose | Src | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `MOT_BOOKED` | LIFECYCLE | MOT job/request created | `jobs.type='MOT'` / request | Service | vehicle_id | – | MOT volume |
| `MOT_TESTER_ASSIGNED` | ASSIGNMENT | Tester assigned | clocking `work_type='mot'` / assignment | Management | tester_id | – | Per-tester throughput |
| `MOT_STARTED` | MILESTONE | Test started | clocking mot clock-on | – | tester_id | – | Test duration start |
| `MOT_RESULT_RECORDED` | DECISION | Pass/fail/retest result | _`mot_tests` (proposed)_ / `completion_status` | Service, Workshop | result, mileage_at_test | **Yes** | Pass rate, first-time pass |
| `MOT_ADVISORY_ADDED` | DOCUMENT_MEDIA | Advisory/defect logged | _`mot_advisories` (proposed)_ | Service | severity, defect_code | – | Advisory analytics |
| `MOT_RETEST_LINKED` | MILESTONE | Retest tied to original | _`mot_tests.retest_of`_ | – | original_test_id | – | First-time pass rate |
| `MOT_CERTIFICATE_ISSUED` | MILESTONE | Pass cert + expiry issued | _proposed_ | Accounts | expiry_date | – | Expiry pipeline |

### 4.6 Valeting (owner: Valeting) — _requires `wash_completed_at`/assignee (§15/P7)_
| Event | Category | Purpose | Src | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `WASH_QUEUED` | LIFECYCLE | Car enters wash queue | derived/`valetChecklist` | Workshop | job_id | – | Queue depth |
| `WASH_STARTED` | MILESTONE | Wash begun | `jobs.wash_started_at` | – | wash_assignee _(proposed)_ | – | Duration start |
| `WASH_COMPLETED` | MILESTONE | Wash done | `wash_completed_by` (+ `wash_completed_at` proposed) | Service | washState=complete, completed_by | – | Throughput, duration, SLA |
| `WASH_SKIPPED` | DECISION | No-wash chosen | `valetChecklist.washState=no_wash` | Service | reason | – | Skip rate |
| `WASH_STATUS_CHANGED` | STATUS_TRANSITION | Wash state move | valet helper | – | from/to (blank→complete/no_wash) | – | Valet funnel |

### 4.7 Paint / Bodyshop (owner: Paint) — _requires paint stage model (§15/P7); interim events are coarse_
| Event | Category | Purpose | Src | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `PAINT_JOB_IDENTIFIED` | LIFECYCLE | Bodyshop job flagged | `jobs.type ILIKE paint`/category | Workshop | job_id | – | Paint volume |
| `PAINT_STAGE_CHANGED` | STATUS_TRANSITION | prep→spray→dry→buff→ready | _paint stage table (proposed)_ | Workshop | from/to, bay, painter_id | – | Stage cycle-time, bay utilisation |
| `PAINT_PAINTER_ASSIGNED` | ASSIGNMENT | Painter allocated | _proposed_ | Management | painter_id | – | Painter productivity |
| `PAINT_MATERIAL_USED` | INVENTORY | Paint code/material consumed | _proposed_ | Parts, Accounts | paint_code, qty | – | Material cost, usage |
| `PAINT_COMPLETED` | MILESTONE | Paintwork finished | _proposed_/`completed_at` | Valet | – | Throughput, first-pass quality |

### 4.8 Accounts / Invoicing (owner: Accounts)
| Event | Category | Purpose | Src | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `INVOICE_CREATED` | LIFECYCLE | Invoice raised | `invoices` insert (`/api/invoices/create`) | Service, Workshop, Parts | invoice_number, job_id, grand_total | **Yes** | Revenue, raised count |
| `INVOICE_ISSUED`/`SENT` | COMMUNICATION | Sent to customer | `sent_email_at`/`sent_portal_at` | – | channel | **Yes** | AR start, DSO |
| `INVOICE_STATUS_CHANGED` | STATUS_TRANSITION | Draft→Sent→Paid→Overdue/Cancelled | payment_status update | – | from/to | **Yes** | Payment funnel, ageing |
| `INVOICE_PAID` | FINANCIAL | Fully paid | `paid`/`payment_status=Paid` | – | amount_gbp, method | **Yes** | DSO, paid count |
| `PAYMENT_RECEIVED` | FINANCIAL | Payment (incl. partial) | `invoice_payments` insert | – | amount_gbp, method | **Yes** | Cash-in, partial-balance |
| `INVOICE_VOIDED`/`CANCELLED` | DECISION | Invoice cancelled | status=Cancelled | Management | reason | **Yes** | Void rate, revenue integrity |
| `TRANSACTION_POSTED` | FINANCIAL | Ledger entry | `account_transactions` insert | – | type (Debit/Credit/Adjustment), amount | **Yes** | Account ledger, balance |
| `ACCOUNT_STATUS_CHANGED` | STATUS_TRANSITION | Active→Frozen→Closed | `accounts.status` | Management | from/to, reason | **Yes** | Credit control |
| `CREDIT_LIMIT_CHANGED` | DECISION | Credit terms changed | account update | Management | from/to | **Yes** | Exposure audit |
| `PAYSLIP_GENERATED`/`VIEWED` | FINANCIAL/AUDIT | Payroll | `payslips`; payslip view | HR/Admin | period | **Yes** | Payroll runs, access audit |

### 4.9 Admin (owner: Admin)
| Event | Category | Purpose | Src | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `USER_CREATED` | LIFECYCLE | New employee/user | `/api/hr/employees` upsert | HR, Management | role, department | **Yes** | Headcount |
| `ROLE_CHANGED` | AUDIT_SECURITY | User role/permission changed | `users.role` update (currently UNLOGGED) | Management | from/to role | **Yes** | Access audit (gap fix) |
| `USER_DEACTIVATED` | LIFECYCLE | Soft delete | `is_active=false` | HR | reason | **Yes** | Leaver tracking |
| `RECORD_DELETED` | AUDIT_SECURITY | Any hard delete | delete helpers (mostly UNLOGGED) | owning dept | entity_type, entity_id | **Yes** | Destructive-action audit (gap fix) |
| `LOGIN_SUCCEEDED`/`LOGIN_FAILED` | AUDIT_SECURITY | Auth attempts | `audit_log`/`auth_login_attempts` | Security | ip, user_agent, failure_reason | **Yes** | Security reporting |
| `CONSENT_RECORDED`/`SAR_*`/`DATA_EXPORTED` | AUDIT_SECURITY | GDPR/compliance | `audit_log` (already logged) | Management | subject | **Yes** | Compliance register |
| `REPORT_VIEWED`/`REPORT_EXPORTED` | AUDIT_SECURITY | Reporting access | reporting API | Management | report_id, filter | **Yes** | Report-access audit |
| `CONFIG_CHANGED` | AUDIT_SECURITY | Settings/company config edit | `company_settings` update | Management | key, from/to | **Yes** | Config audit |

### 4.10 Management (owner: Management) — _consumes all; produces governance events only_
| Event | Category | Purpose | Src | Related | Key payload | Audit? | Reporting usage |
|---|---|---|---|---|---|---|---|
| `TARGET_SET`/`TARGET_CHANGED` | DECISION | KPI/SLA target defined | _target model (proposed)_ | all | kpi_id, target, period | **Yes** | Target attainment |
| `ESCALATION_RAISED`/`RESOLVED` | MILESTONE | Cross-dept escalation | notifications/managers dashboard | affected dept | reason, severity | – | Exception metrics |
| `SNAPSHOT_BUILT` | SYSTEM_AUTOMATED | KPI snapshot job ran | aggregation cron | – | day, kpi_count, version | – | Pipeline health, lineage |
| `AGGREGATION_REBUILT` | SYSTEM_AUTOMATED | Rollup recompute | recompute action | – | range, reason | **Yes** | Recompute audit |

### 4.11 System / Automated (owner: system)
`AUTO_CLOCKOUT` (existing `/api/cron/auto-clockout`), `OVERTIME_AUTO_LOGGED` (`overtime-recurring`), `DVLA_SYNCED` (vehicle MOT/tax pull), `NOTIFICATION_SENT` (status→notification), `INTEGRATION_SYNCED` (future portals). All `actor_kind='system'`/`integration` (§8.3).

---

## 5. Event Ownership Architecture

### 5.1 Ownership model
Every `report_event` has:
- **`owner_department`** — exactly one producing department (who *did* the action / whose process the event belongs to).
- **`related_departments[]`** — zero-or-more downstream/affected departments who may also report on it.

### 5.2 Producing vs consuming
- **Producer** = the department of the actor (or, for system events, the domain that owns the process).
- **Consumer** = any department whose KPIs legitimately include this event. Consumers get **read** access via `related_departments` + the permission scope (Phase 1 §14); they never "own" the event.

### 5.3 Shared-ownership rules
- An event has **one** `owner_department` (no co-ownership) to keep attribution unambiguous and sums non-double-counted.
- "Shared" interest is expressed by `related_departments`, not by multiplying owners.
- A report that wants "all events touching Parts" queries `owner_department='parts' OR 'parts' = ANY(related_departments)`.

### 5.4 Cross-department ownership flow (worked examples)
The VHC flow is the canonical hand-off chain — ownership moves with the actor:

```
VHC_CREATED        owner=Workshop   related=[Service]        (tech raises the item)
   │
VHC_ITEM_PRICED    owner=Service    related=[Parts]          (advisor prices it)
   │
VHC_SENT           owner=Service    related=[Workshop]       (advisor sends to customer)
   │
VHC_VIEWED         owner=Service    related=[]               (customer opens link)
   │
VHC_AUTHORISED     owner=Service*   related=[Workshop,Parts] (*actor=Customer; dept=Service desk that owns the relationship)
   │
PART_REQUESTED     owner=Parts      related=[Workshop]       (authorised work creates parts demand)
   │
PART_ORDERED       owner=Parts      related=[Accounts]
   │
PART_FITTED        owner=Workshop   related=[Parts]          (tech fits it back in workshop)
   │
JOB_COMPLETED      owner=Workshop   related=[Service,Accounts,Valet]
   │
INVOICE_CREATED    owner=Accounts   related=[Service,Workshop,Parts]
```

**Rule:** the producing department is *where the work happened*, even when the trigger is a customer (customer-authorised VHC is owned by the Service desk that owns the customer relationship, with `actor_kind='customer'`). This keeps department P&L/attribution coherent while preserving true actor identity.

### 5.5 Escalation ownership
- An escalation event (`ESCALATION_RAISED`) is **owned by Management** but carries `related_departments=[the department being escalated]` so both the escalator and the owning department can report on it.
- SLA breaches auto-generate `ESCALATION_RAISED` owned by Management, related to the breaching department.

### 5.6 Management visibility rules
- Management has **read visibility over every event** regardless of owner (Phase 1 permission level "Cross-department"/"Executive").
- Management **owns** only governance events (§4.10): targets, escalations, aggregation rebuilds.
- Management dashboards aggregate by `owner_department` for accountability and by `related_departments` for cross-flow analysis (e.g. how much Workshop-owned work drives Accounts revenue).

---

## 6. Status History Architecture

### 6.1 Generic pattern (the contract)
Every reportable entity with a meaningful lifecycle gets a `<entity>_status_history` table modelled on the proven `job_status_history`:

```
<entity>_status_history (proposed)
  history_id   bigserial PK
  entity_id    <type>          -- FK to the entity
  from_status  text            -- null on creation
  to_status    text
  changed_by   int             -- canonical user id (§8); not free text
  actor_kind   text            -- user|system|customer|integration
  reason       text
  department   text            -- denormalised owner department
  changed_at   timestamptz default now()
  meta         jsonb           -- entity-specific extras (e.g. amount, qty)
```
Each status change writes BOTH this row AND a `report_event` (`*_STATUS_CHANGED`) via one `emit*` helper. No DB triggers (ADR-3). A status mutation without an emit is a defect caught by the status-emit lint (§13.5).

### 6.2 Per-entity status models, ownership & usage

#### 6.2.1 Job (EXISTS — `job_status_history`)
- **Status model:** `booked → checked_in → in_progress → invoiced → released` (+ legacy map; `cancelled`/`completed` normalise to `released`).
- **Owner:** Workshop (Service for booked/checked_in). **Usage:** time-in-stage, throughput funnel. **Audit:** backward moves (`JOB_REOPENED`) audited.
- **Status:** already correct — the reference template.

#### 6.2.2 Parts (`parts_job_items_status_history` — proposed, **P4 priority 1**)
```
pending → waiting_authorisation → awaiting_stock → on_order → booked
        → allocated → pre_picked → picked → loaded → fitted
   ↘ cancelled    ↘ removed    ↘ unavailable    (terminal negatives)
   stock (in-stock shortcut)
```
- **Owner:** Parts (Workshop for fitted). **Usage:** dwell-time per status, ordered→ready→fitted cycle-time, backlog ageing, supplier fill. **Audit:** cancellations/removals carry reason.

#### 6.2.3 VHC item (`vhc_item_status_history` — proposed, **P4 priority 2**)
```
new → awaiting_customer → approved → in_progress → completed
   ↘ declined            ↘ (reopened → awaiting_customer)
```
- **Persist decision-level inputs, not the derived projection** (`vhcStatusEngine.js` computes the projection; history records the underlying approval/labour/parts facts).
- **Owner:** Workshop/Service per stage. **Usage:** per-item stage timing, re-authorisation audit, conversion latency. **Audit:** reopen/reverse audited.

#### 6.2.4 Invoice (`invoice_status_history` — proposed, **P4 priority 3**)
```
Draft → Sent → Paid
            ↘ Overdue → Paid
            ↘ Cancelled
```
- **Owner:** Accounts. **Usage:** Draft→Sent→Paid latency (DSO), AR ageing by transition. **Audit:** every transition audited (financial).

#### 6.2.5 Account (`account_status_history` — proposed)
```
Active ⇄ Frozen → Closed
```
- **Owner:** Accounts. **Usage:** credit-control events, freeze duration. **Audit:** all transitions audited (with reason).

#### 6.2.6 Appointment (`appointment_status_history` — proposed)
```
booked → confirmed → arrived → completed
      ↘ cancelled  ↘ no_show
```
- **Owner:** Service. **Usage:** booking funnel, no-show rate, lead time.

#### 6.2.7 Delivery (`delivery_status_history` — proposed; reconcile duplicate families first, debt D7)
```
planned → en_route → delivered
                  ↘ failed (reason)      (proposed terminal)
```
- **Owner:** Parts/Logistics. **Usage:** delivery SLA, on-time %, failed-attempt analysis.

#### 6.2.8 Warranty (`warranty_status_history` — proposed; **requires deploying `warranty_claims`**, debt)
```
draft → submitted → authorised → in_progress → ready → claimed → reimbursed
                 ↘ rejected (reason)
```
- **Owner:** Workshop (claim raising) / Accounts (reimbursement). **Usage:** claim cycle-time, approval rate, reimbursement tracking. **Audit:** financial transitions audited.

#### 6.2.9 MOT (`mot_test_status_history` — proposed; **requires `mot_tests`**)
```
booked → in_test → result_recorded(pass|fail) → [retest → ...] → certificate_issued
```
- **Owner:** MOT. **Usage:** first-time pass rate, per-tester pass rate, test duration. **Audit:** result recording audited.

#### 6.2.10 Paint (`paint_stage_history` — proposed; **requires paint stage model**)
```
identified → prep → spray → dry → buff → ready → completed
```
- **Owner:** Paint. **Usage:** stage cycle-time, bay utilisation, first-pass quality.

#### 6.2.11 Valeting (`wash_status_history` — proposed; **requires `wash_completed_at`**)
```
queued → started → completed
              ↘ skipped (no_wash)
```
- **Owner:** Valeting. **Usage:** wash duration/SLA, throughput, skip rate.

### 6.3 History storage strategy
- One table per entity (not a single polymorphic history table) — keeps FKs, types, and indexes clean; mirrors `job_status_history`.
- `report_event` is the *unifying* cross-entity view; the per-entity history tables are the *authoritative* lifecycle record.
- Backfill from existing data where possible (e.g. derive initial parts history from current status + `updated_at`; job history already exists).

---

## 7. Department Dimension Architecture

### 7.1 Canonical departments (`dim_department` — proposed)
The nine-plus from `departmentDashboards.js` become a constrained lookup:

| code | name | kind |
|---|---|---|
| `workshop` | Workshop | operational |
| `parts` | Parts | operational |
| `service` | Service Advisors | operational |
| `mot` | MOT | operational |
| `valeting` | Valeting | operational |
| `paint` | Paint / Bodyshop | operational |
| `accounts` | Accounts | commercial |
| `admin` | Admin | support |
| `management` | Management | oversight |
| `hr` | HR | support (sensitive) |
| _(future)_ `sales`, `stock`, `buying` | — | commercial (§15) |

### 7.2 Department hierarchy
```
Management (oversight; sees all)
├── Aftersales
│   ├── Workshop ── (Tech, Mobile Tech)
│   ├── Parts ──── (Parts Driver)
│   ├── Service Advisors
│   ├── MOT
│   ├── Valeting
│   └── Paint / Bodyshop
├── Accounts (commercial)
└── Admin / HR (support; HR = sensitive)
        └── (future) Sales / Stock / Buying
```
`dim_department.parent_code` _(proposed)_ enables rollups to the Aftersales tier and to company total.

### 7.3 Department ownership
- Each department **owns** its produced events + its status-history rows (via `owner_department`/`department`).
- Each department **owns** a defined set of source tables (the §16 Phase-1 ownership table).
- Ownership is **stamped at write time**, never inferred at read time (ADR-6).

### 7.4 Cross-department relationships
Expressed only through `related_departments[]` on events and through the hand-off chains (§5.4). The dimension itself is flat + hierarchical; relationships live on the events.

### 7.5 Attribution rules — how EVERY entity gets a department
Resolution order at write time (first match wins):
1. **Actor's department** — `users.department` of the acting user (once D3 fixed and constrained).
2. **Entity's intrinsic department** — derived from entity type + state (e.g. a `parts_job_items` row → `parts`; a `vhc_checks` row created by a tech → `workshop`).
3. **Event-name default** — each catalogue event has a default `owner_department` (the tables in §4).
4. **`system`** — for automated/cron/integration events with no human actor.

For historical/operational tables lacking a department column, attribution is derived via the above and **denormalised onto the event/history row** — the operational tables themselves are not retro-fitted with a department column unless a clear need arises (additive principle).

### 7.6 The department data-quality fix (prerequisite)
`users.department` is currently free-text and populated with the **wrong vocabulary** (`Retail/Sales/Mobile/Customers` from `roleCategories`) — debt D3. Before any department rollup: introduce `dim_department`, constrain `users.department` to its codes, and backfill using the `departmentDashboards.js` role→department map. This is a hard prerequisite for §5/§7 to be trustworthy.

---

## 8. Actor Architecture

### 8.1 Actor kinds (`actor_kind`)
| Kind | Meaning | id fields |
|---|---|---|
| `user` | A staff member performed the action | `actor_user_id` (canonical) + `actor_role` + department |
| `system` | Automated/background (cron, scheduler) | `actor_user_id=null`, `actor_role='system'` |
| `customer` | A customer (e.g. VHC share authorisation) | `actor_user_id=null`, link to `customers.id` in payload |
| `integration` | External system (DVLA, future portals/manufacturer) | `actor_role='integration:<name>'` |

### 8.2 User ownership
- Canonical staff identity = `users.user_id` (int). Every user event resolves to it.
- `actor_role` captured at event time (point-in-time role, so historical attribution survives later role changes).
- User events resolve `owner_department` from `users.department` (post-D3 fix).

### 8.3 System / automated / background / service accounts
- **System events** (`AUTO_CLOCKOUT`, `SNAPSHOT_BUILT`, `OVERTIME_AUTO_LOGGED`) carry `actor_kind='system'` and a `source` identifying the job (e.g. `cron:auto-clockout`).
- **Service accounts:** background jobs authenticate via the existing `CRON_SECRET` Bearer pattern; they never impersonate a user. Their events are clearly attributable to the job, not to a person — critical so automated clock-outs/overtime aren't misattributed in payroll reporting.
- **Integration events** name the external system; reused for DVLA today and future portals.

### 8.4 The canonical-id bridge (prerequisite — debt D4)
The system has **two user identities**: int `users.user_id` (most tables) and uuid `auth.users.id` (`parts_catalog`, `parts_job_items.allocated_by`, `parts_stock_movements.performed_by`). Reporting MUST resolve both to one canonical id.
- **Design:** a `dim_actor` _(proposed)_ mapping `{ canonical_user_id, users_user_id, auth_uuid, display_name, current_role, current_department }`, plus a resolver in the actor layer that accepts either id and returns the canonical one.
- Events store `actor_user_id` (canonical) and optionally `actor_auth_uuid` when that was the only id available at the source.
- **Free-text actor columns** (`job_status_history.changed_by`, `vhc_checks.approved_by`, `account_transactions.created_by` — which mix real users, `SYSTEM_*` tokens, `"customer"`, null) are normalised through the resolver into `actor_kind` + canonical id at bridge time.
- Per-user KPIs are **blocked until this bridge exists** (Risk R2).

### 8.5 Attribution rules
- Every event has an actor — no anonymous events (use `system` if no human).
- Point-in-time role/department stamped on the event (don't re-derive from current `users` row).
- Customer actions retain `actor_kind='customer'` for honesty, while `owner_department` reflects the owning desk (§5.4).

---

## 9. KPI Snapshot Architecture

### 9.1 Purpose
Make any KPI trendable over arbitrary ranges for **10+ years** without re-scanning mutable operational tables, and make historical numbers immutable + explainable.

### 9.2 Daily snapshot — `kpi_daily_snapshot` _(proposed)_
```
kpi_daily_snapshot (proposed)
  snapshot_id   bigserial PK
  kpi_id        text          -- catalog id (e.g. workshop.labour_recovery_rate)
  day           date
  department    text          -- dimension slice (or 'all')
  team          text          -- optional finer slice
  value         numeric       -- the headline value
  numerator     numeric       -- for ratio KPIs (store inputs, not just the ratio)
  denominator   numeric
  count         bigint        -- supporting count
  amount_gbp    numeric       -- for value KPIs
  formula_version text        -- which formula produced it
  source        text          -- 'event'|'history'|'base'|'live-fallback'
  built_at      timestamptz
  UNIQUE(kpi_id, day, department, team, formula_version)
```
- **One row per (kpi × day × department × team × formula_version).**
- **Immutable once written** except by explicit recompute (which writes a new `formula_version` or overwrites the same day idempotently — see §9.5).
- **Store inputs (numerator/denominator/count), not just the ratio** — so weekly/monthly rollups compute correct ratios (not averages-of-averages).

### 9.3 Weekly & monthly snapshots
Derived from daily, not recomputed from raw (unless rebuilding):
- `kpi_weekly_snapshot` _(proposed)_ — keyed `(kpi_id, iso_week, department)`; sums counts/amounts, recombines numerator/denominator for ratios.
- `kpi_monthly_snapshot` _(proposed)_ — keyed `(kpi_id, year_month, department)`.
- Entity-state snapshots (e.g. `open_parts_by_status` at day's end, `ar_ageing_buckets` month-end) captured where point-in-time *backlog* matters and cannot be reconstructed from flow events alone.

### 9.4 Aggregation rules
- **Flow KPIs** (events/day): sum daily.
- **Ratio KPIs** (recovery, pass rate, conversion): roll up numerator & denominator separately, then divide.
- **Stock/backlog KPIs** (open parts, AR): point-in-time snapshot, not summed (a backlog isn't additive across days).
- **Duration KPIs** (cycle-time): store sum + count of durations daily → roll up to a true mean/percentile.

### 9.5 Rebuild & recalculation
- **Idempotent rebuild:** re-running an aggregation day reads events/history for that day and UPSERTs — safe to repeat.
- **Backfill:** raw events + history allow rebuilding all snapshots from zero (the whole snapshot layer is reconstructable).
- **Recalculation on formula change:** bump `formula_version`, rebuild affected range under the new version; old-version rows retained so historical screens stay explainable (Principle 2.6).
- **Late data:** detected via `recorded_at` ≫ `occurred_at`; the job recomputes the affected day(s).

### 9.6 Historical preservation (10+ year horizon)
- Daily snapshots are compact (kpi×dept×day) and kept **indefinitely**.
- Raw `report_event` kept 24 months hot then archived cold (§12); snapshots survive even after raw events are archived because they are self-contained.
- `formula_version` + `dim_*` lookups versioned so a number from 2026 remains interpretable a decade later even if departments/formulas evolve.

---

## 10. Aggregation Architecture

### 10.1 Cadence & jobs (extend `/api/cron/*`, Bearer `CRON_SECRET`)
| Cadence | Job _(proposed)_ | Reads | Writes |
|---|---|---|---|
| **Daily** (off-peak) | `cron/aggregate-kpis-daily` | yesterday's events + history + EOD base state | `kpi_daily_snapshot`, entity-state snapshots |
| **Weekly** (Mon) | `cron/aggregate-kpis-weekly` | last week's daily snapshots | `kpi_weekly_snapshot` |
| **Monthly** (1st) | `cron/aggregate-kpis-monthly` | last month's daily snapshots | `kpi_monthly_snapshot`, month-end backlog snapshots |
| **Quarterly** | `cron/aggregate-kpis-quarterly` | monthly snapshots | `kpi_quarterly_snapshot` _(proposed)_ |
| **Yearly** | `cron/aggregate-kpis-yearly` | monthly/quarterly | `kpi_yearly_snapshot` _(proposed)_ |

Each emits a `SNAPSHOT_BUILT`/`AGGREGATION_REBUILT` event (lineage + pipeline-health reporting).

### 10.2 Storage strategy
- Snapshots and rollups are **narrow, append/upsert tables** indexed on `(kpi_id, period, department)`.
- Higher cadences derive from lower (weekly←daily, monthly←daily, quarterly←monthly, yearly←monthly) — never re-scan raw unless rebuilding.
- Keep numerator/denominator/count at every level so ratios stay correct.

### 10.3 Performance strategy
- Read path hits the **coarsest sufficient** rollup (a yearly trend reads `kpi_yearly_snapshot`, not 365 daily rows).
- Aggregation is incremental (one period at a time), off-peak, and bounded (O(rows-in-period)).
- Indexing per §3.1/§9.2; read cache (Phase 1 §9.10) absorbs dashboard refreshes.

### 10.4 Rebuild strategy
- Any level rebuildable from the level below; the whole pyramid rebuildable from raw events + history.
- Rebuild is range-scoped and idempotent; triggered by `AGGREGATION_REBUILT` (audited).
- A nightly **reconciliation check** compares a sampled live recompute vs the snapshot and flags drift (data-quality monitor, §13).

---

## 11. Audit Architecture

### 11.1 Four audit planes (one backbone)
All four reuse `audit_log` (hash-chained, redacting). They differ in *what* they cover and *who* may read them.

| Plane | Covers | Reader roles |
|---|---|---|
| **Operational audit** | status changes, edits, deletes, reopens, role changes | Department managers, Management |
| **Reporting audit** | `REPORT_VIEWED`/`REPORT_EXPORTED` + recompute/rebuild | Management, Admin |
| **Financial audit** | invoice create/issue/void, payments, transactions, credit/account changes, payroll | Accounts, Management |
| **Security audit** | logins, role/permission changes, deletes, consent/SAR/export | Admin, Management, (DPO) |

### 11.2 Audit-required event set (the "**Audit? = Yes**" rows in §4)
Mandatory `audit_log` write (with before/after in `diff`, reason):
- **Operational:** `JOB_REOPENED`, `CLOCKING_EDITED`, `VHC_REOPENED`, `RECORD_DELETED`, `CONFIG_CHANGED`.
- **Financial:** `INVOICE_CREATED/ISSUED/STATUS_CHANGED/PAID/VOIDED`, `PAYMENT_RECEIVED`, `TRANSACTION_POSTED`, `ACCOUNT_STATUS_CHANGED`, `CREDIT_LIMIT_CHANGED`, `PAYSLIP_*`.
- **Security:** `ROLE_CHANGED`, `USER_CREATED/DEACTIVATED`, `LOGIN_*`, `CONSENT/SAR/DATA_EXPORTED`, `MOT_RESULT_RECORDED`.
- **Reporting:** `REPORT_VIEWED/EXPORTED`, `AGGREGATION_REBUILT`.

### 11.3 Current gaps the audit found (to close)
- **Role/permission changes unlogged** (`/api/hr/employees` updates `users.role` silently) → `ROLE_CHANGED` must audit.
- **Clocking edits/overrides/deletes unlogged** (payroll integrity) → `CLOCKING_EDITED` must audit.
- **Invoice/payment create/edit/void unlogged** → financial events must audit.
- **Hard deletes almost universally unlogged** → `RECORD_DELETED` must audit.
- **Generic `.update()` edits** outside job-card/VHC/status paths → audit the high-value ones.

### 11.4 Audit ≠ event ≠ history
- **Event** (`report_event`) = analytics fact.
- **History** (`*_status_history`) = authoritative lifecycle.
- **Audit** (`audit_log`) = tamper-evident compliance record with before/after.
A single business action may write to all three (e.g. an invoice void writes a status-history row, a `report_event`, and an `audit_log` row). The `emit*` helper fans out; callers write one line.

---

## 12. Retention Architecture

| Data class | Hot retention | Then | Rationale |
|---|---|---|---|
| `report_event` (raw) | 24 months | Archive cold (cold table / object storage), 7+ yrs | YoY analysis hot; long-tail forensic cold |
| `*_status_history` | Indefinite | — | Small, high-value; needed for any historical cycle-time |
| `kpi_daily_snapshot` | Indefinite | — | Compact trend backbone (10+ yrs) |
| Weekly/monthly/quarterly/yearly rollups | Indefinite | — | Tiny |
| Entity-state snapshots (backlog/AR) | Indefinite | — | Point-in-time history not otherwise reconstructable |
| `audit_log` (all planes) | Per existing GDPR/audit policy | Per policy | Compliance-governed; do not shorten |
| Read cache | 30–60s TTL | Evict | Ephemeral |
| Export files | 7 days | Purge | Avoid stale sensitive exports |

**Long-term storage strategy:** snapshots/rollups are the permanent record (self-contained, versioned). Raw events age to cold storage but remain reconstructable into snapshots if a historical recompute is ever needed. PII in archived events follows the existing `audit_log` redaction/retention rules — no new PII retention surface is created.

---

## 13. Data Quality Architecture

### 13.1 Validation rules (enforced at emit time)
- **Event validation:** `event_name` ∈ catalogue; `event_category` ∈ §3.3; mandatory envelope fields present; `occurred_at` not in the future.
- **Status validation:** `to_status` ∈ the entity's status model; transition allowed by the lifecycle (§6) or flagged as an exception event.
- **Department validation:** `owner_department` ∈ `dim_department`; never null.
- **Actor validation:** `actor_kind` set; `actor_user_id` resolves via `dim_actor` (or kind=system/customer/integration).
- **Ownership validation:** exactly one `owner_department`; `related_departments` ⊆ `dim_department`.

### 13.2 Status normalisation layer
A status-map in the engine collapses known variants before storage/aggregation: `authorized`↔`authorised`, casing/whitespace, legacy→canonical (reuse the existing `LEGACY_TO_MAIN` map for jobs). Prevents fragmented GROUP BY (Risk R3).

### 13.3 Data-quality monitors (Admin dashboard, §4.9)
Nightly checks emitting alerts:
- Records missing department / unresolved actor.
- Status values outside the model (drift detection).
- Snapshot-vs-live reconciliation drift beyond threshold.
- Orphan events (entity_id not found).
- Late-arrival rate (`recorded_at` − `occurred_at`).

### 13.4 Current data-quality risks discovered in the audit
| Risk | Source | Handling |
|---|---|---|
| Free-text un-CHECK'd statuses (`jobs.status`, `payment_status`, HR, MOT `completion_status`; `authorized`/`authorised` both present) | audit | §13.2 normalisation now; CHECK constraints in P7 |
| `.limit(40)` truncated "totals", overlapping MOT `ILIKE`, Service RAG default-amber | audit/D8 | Replace with exact counted queries (P3) |
| Dual user identity (int vs uuid) | D4 | `dim_actor` bridge (§8.4) before per-user KPIs |
| Department field wrong vocabulary | D3 | `dim_department` + backfill before department rollups |
| Free-text actor columns (`changed_by`, `approved_by`, `created_by`) | audit | Normalise via resolver at bridge time |
| Denormalised totals without triggers (invoices' 7 totals, `accounts.balance`) | D12 | Prefer line-item recompute; flag denormalised source in provenance |
| Messaging collapsed into JSON; notifications `read` never updated | D10/D11 | Comms events at event-level; per-message analytics rows deferred (P7) |
| Schema drift (audit/HR tables absent from `schemaReference.sql`) | D2 | Reconcile + migrations (P9); treat live DB as truth meanwhile |
| Auth stub returns Admin | D9 | Exclude from reporting identity (use NextAuth session) |

### 13.5 Enforcement
A `check:report-events` script _(proposed)_ — mirroring the existing `check:borders` — scans DB helpers for status-mutating writes lacking a paired `emit*` call, and validates catalogue membership at build time.

---

## 14. Reporting Data Dictionary

### 14.1 Core (operational source) entities — EXIST
| Entity | Key | Owner dept | Notes |
|---|---|---|---|
| `jobs` | id / job_number | Workshop/Service | richest entity; ~20 milestone timestamps |
| `job_requests` | request_id | Workshop | sold hours source |
| `vhc_checks` | vhc_id | Workshop/Service | severity, decision, £ totals |
| `parts_job_items` | id | Parts | 14-status enum; operational core |
| `parts_stock_movements` | id | Parts | ledger |
| `invoices` / `invoice_payments` | invoice_id | Accounts | financial core |
| `accounts` / `account_transactions` | account_id | Accounts | ledger + balance |
| `job_clocking` / `time_records` | id | Workshop | labour (reconcile, D5) |
| `appointments` | id | Service | booking |
| `users` | user_id | Admin/HR | identity + employment + pay |
| `vehicles` / `customers` | vehicle_id / id | — | reference dims |

### 14.2 Event entities — PROPOSED
| Entity | Key | Role |
|---|---|---|
| `report_event` | event_id / event_uuid | the unified event spine (§3.1) |
| `<entity>_status_history` (×10) | history_id | authoritative lifecycle per entity (§6) |
| `audit_log` (EXISTS) | id | tamper-evident audit feed |
| `job_status_history` (EXISTS) | id | job lifecycle (template) |
| `job_activity_events` (EXISTS) | id | granular per-job actions (bridge source) |

### 14.3 Dimension entities — PROPOSED
| Entity | Key | Role |
|---|---|---|
| `dim_department` | code | canonical departments + hierarchy (§7) |
| `dim_actor` | canonical_user_id | int/uuid identity bridge (§8.4) |
| `dim_kpi` (= KPI catalog) | kpi_id | metric definitions + formula_version |
| `dim_date` _(optional)_ | date | calendar/working-day helper for trends |

### 14.4 Snapshot entities — PROPOSED
`kpi_daily_snapshot`, `kpi_weekly_snapshot`, `kpi_monthly_snapshot`, `kpi_quarterly_snapshot`, `kpi_yearly_snapshot`, plus entity-state snapshots (`open_parts_by_status_snapshot`, `ar_ageing_snapshot`).

### 14.5 Rollup entities — PROPOSED
The weekly→yearly KPI snapshots double as rollups (§10). Department/team rollups are slices of the same tables (the `department`/`team` columns).

### 14.6 Audit entities — EXIST/EXTEND
`audit_log` (extend usage), `auth_login_attempts` (EXISTS), report-access rows inside `audit_log`.

### 14.7 Relationships (dictionary graph)
```
report_event ──entity_id──> {jobs, vhc_checks, parts_job_items, invoices, accounts, ...}
report_event ──owner_department/related_departments──> dim_department
report_event ──actor_user_id──> dim_actor ──> users (user_id) / auth.users (uuid)
<entity>_status_history ──entity_id──> its entity ; ──department──> dim_department ; ──changed_by──> dim_actor
kpi_daily_snapshot ──kpi_id──> dim_kpi ; ──department──> dim_department
kpi_weekly/monthly/... ──derived from──> kpi_daily_snapshot
audit_log ──actor_user_id/entity──> dim_actor / core entities
```

---

## 15. Future Scalability

The architecture is **domain-agnostic by construction** — `report_event`, `*_status_history`, `dim_department`, `dim_actor`, and the snapshot pyramid carry no workshop-specific assumptions. New domains plug in by adding catalogue entries + emitters + a department code, never new infrastructure.

| Future domain | How it plugs in (no redesign) |
|---|---|
| **Sales** | Add `sales` to `dim_department`; catalogue `LEAD_CREATED`, `TEST_DRIVE_BOOKED`, `VEHICLE_SOLD`, `DEAL_STATUS_CHANGED`; reuse event spine + snapshots. |
| **Vehicle stock** | `stock` department; `STOCK_VEHICLE_ACQUIRED/PREPPED/LISTED/SOLD`; `vehicle_stock_status_history` follows the generic pattern. |
| **Buying cars** | `buying` department; `APPRAISAL_DONE`, `PURCHASE_OFFERED/AGREED`; financial events to Accounts via `related_departments`. |
| **Customer portal** | `actor_kind='customer'` already exists; portal actions emit `PORTAL_*` events; no new actor model needed. |
| **Supplier portal** | `actor_kind='integration'`/`supplier`; `SUPPLIER_ORDER_ACK`, `SUPPLIER_DISPATCHED`; needs `suppliers` master (already a P7 item). |
| **Warranty integrations** | Warranty status-history + claim tables (already designed §6.2.8); integration events from manufacturer systems via `actor_kind='integration'`. |
| **Manufacturer integrations** | `integration:<oem>` actor; ingest events (recalls, campaigns, MOT/warranty history) into the same spine. |

**Forward-compatibility rules baked in now:** text `entity_id` (supports int/uuid/composite future keys); `domain` is open-vocabulary; `dim_department` extensible; `actor_kind` includes `integration`; snapshots are keyed by generic `kpi_id`+`department`. A new domain is a configuration + emitter exercise, not an architecture change.

---

## 16. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Emit helpers missed on some write paths | Silent history/event gaps | `check:report-events` lint (§13.5); code-review gate; backfill |
| R2 | Dual user identity not bridged before per-user KPIs | Wrong attribution | `dim_actor` bridge (§8.4) is a hard prerequisite; block per-user KPIs until done |
| R3 | Status drift / un-normalised values | Fragmented aggregation | Normalisation layer (§13.2) + CHECK constraints (P7) |
| R4 | Department vocabulary mismatch (D3) | Mis-attributed reporting | `dim_department` + backfill before any department rollup |
| R5 | Event volume growth (storage/write cost) | Cost/perf at scale | Minimal payloads (anti-scope §2.2); 24-mo hot + archive; narrow indexes |
| R6 | Double-counting via multiple owners | Inflated totals | One `owner_department` per event (§5.3); related-depts are read-only |
| R7 | Late/out-of-order events | Wrong daily numbers | `recorded_at` detection + idempotent affected-day recompute |
| R8 | Backfill inaccuracy (deriving history from current state) | Imperfect early trends | Label backfilled rows (`source='backfill'`); prefer forward-only where fidelity matters |
| R9 | Denormalised totals disagree with line items | Financial mismatch | Recompute from line items; flag denormalised provenance (D12) |
| R10 | Emit adds latency/failure to operational writes | Operational risk | Emit is best-effort/non-blocking where safe; never fails the operational transaction (mirror `audit_log`'s swallow-on-failure), but reconciliation monitor catches gaps |

---

## 17. Architecture Decisions (ADRs)

- **ADR-11: Single unified event spine (`report_event`), not per-domain event tables.** _Why:_ one query surface, one ownership/actor/department model; domains are rows, not tables (enables §15).
- **ADR-12: Per-entity status-history tables, one polymorphic event spine.** _Why:_ history needs clean FKs/types per entity; events need cross-entity uniformity. Best of both.
- **ADR-13: Capture once, derive many; events immutable & append-only.** _Why:_ trustworthy history; corrections are new events.
- **ADR-14: One `owner_department` per event; cross-interest via `related_departments`.** _Why:_ unambiguous attribution, no double-counting (R6).
- **ADR-15: Canonical actor via `dim_actor`; point-in-time role on each event.** _Why:_ resolves int/uuid split (D4); historical attribution survives role changes.
- **ADR-16: Store ratio inputs (numerator/denominator), never just the ratio, in snapshots.** _Why:_ correct rollups (no average-of-averages).
- **ADR-17: Snapshots immutable + `formula_version`-tagged; recompute writes new version.** _Why:_ 10-year explainability.
- **ADR-18: Emit fan-out (history + event + audit) from one helper; emit is non-blocking to the operational write.** _Why:_ one call-site; operational safety (R10).
- **ADR-19: Department/actor stamped at write time, never inferred at read.** _Why:_ reliability (carried over from Phase-1 ADR-6).
- **ADR-20: Domain-agnostic shape for forward compatibility** (text entity_id, open `domain`, extensible dims, `integration` actor). _Why:_ future domains without redesign (§15).
- **ADR-21: No DB triggers; app-emitted via DB helpers** (carried from Phase-1 ADR-3). _Why:_ testability, version control, consistency with existing convention.

---

## 18. Technical Debt (carried + capture-specific)

Carried from Phase 1 (D1–D14) remain valid. Capture-phase additions/prerequisites:
- **TD-A: `dim_actor` identity bridge** is a prerequisite for per-user reporting (D4). _Must precede P4 emit work for trustworthy actors._
- **TD-B: `dim_department` + `users.department` backfill** prerequisite for department attribution (D3). _Must precede P5._
- **TD-C: Free-text actor columns** must be normalised at bridge time (`changed_by`/`approved_by`/`created_by`).
- **TD-D: Status normalisation map** must exist before aggregation (else fragmented metrics).
- **TD-E: Missing domain entities** (`mot_tests`(+advisories), paint stage model, `wash_completed_at`, deploy `warranty_claims`, `suppliers`) block their status-history + events (P7).
- **TD-F: Duplicate model reconciliation** (clocking D5, parts requests D6, deliveries D7) before their status-history is authoritative.
- **TD-G: Schema drift** — audit/HR tables absent from `schemaReference.sql` (D2); reconcile in P9.
- **TD-H: Emit-coverage lint** (`check:report-events`) does not exist yet (§13.5).

---

## 19. Recommended Build Order

> Capture-side build order. Aligns with Phase 1 §17 phases (P4–P9) and lists the prerequisites that gate each step.

1. **Prerequisites (gate everything downstream):**
   a. `dim_department` + constrain/backfill `users.department` (TD-B / D3).
   b. `dim_actor` identity bridge + actor resolver (TD-A / D4).
   c. Status normalisation map (TD-D).
2. **Event spine core:** create `report_event`; build the forward bridge from `audit_log`, `job_activity_events`, `job_status_history` (immediate coverage for already-logged truth).
3. **Emit fan-out helper:** one `emitReportEvent({ history?, event, audit? })` inside `src/lib/database/*` helpers; wire `check:report-events` lint (TD-H).
4. **Status-history rollout (by reporting value):** Parts → VHC item → Invoice → Account → Appointment → Delivery (each: table + `emit*` wiring + backfill).
5. **Audit gap closure:** route `ROLE_CHANGED`, `CLOCKING_EDITED`, invoice/payment events, `RECORD_DELETED` through `audit_log` (§11.3).
6. **Department stamping live** across events + history (depends on 1a).
7. **Snapshot layer:** `kpi_daily_snapshot` + daily aggregation cron; then weekly/monthly/quarterly/yearly rollups.
8. **Missing domain entities (P7):** `suppliers`, `mot_tests`(+advisories), paint stage model, `wash_completed_at`, deploy `warranty_claims` — then their events + status-history.
9. **Data-quality monitors + reconciliation** (Admin dashboard, §13.3).
10. **Retention & archival jobs** (§12); schema-ref reconciliation (TD-G).

**Critical path:** (1a,1b) → 2 → 3 → 4 → 7. Audit closure (5) and missing entities (8) parallelise after 3. Nothing per-user is trusted until 1b; nothing per-department until 1a.

---

## 20. Phase 2 Success Criteria

Phase 2 (this design) is complete when:

- [x] A single master data-collection document exists in the repo (`docs/reporting-data-collection-architecture.md`) and is the agreed capture blueprint.
- [x] A **complete data-collection philosophy** (capture / don't-capture / event / ownership / audit / history principles) is defined.
- [x] The **event spine** (`report_event`) is fully specified, with categories and a standard envelope.
- [x] **Every department** (Workshop, Parts, Service Advisors, MOT, Valeting, Paint, Accounts, Admin, Management) has a **complete event catalogue** with purpose, trigger, owner, related departments, required data, actor/timestamp/audit requirements, and reporting usage.
- [x] **Event ownership** (producing/consuming, shared rules, escalation, management visibility, cross-department flow) is defined with worked hand-off chains.
- [x] **Status-history models** for Parts, VHC, Invoice, Appointment, Delivery, Accounts, Warranty, MOT, Paint, Valeting are each defined with lifecycle diagrams, ownership, storage, reporting & audit usage.
- [x] The **department dimension** (canonical list, hierarchy, ownership, relationships, attribution rules for every entity) is defined.
- [x] The **actor model** (user/system/customer/integration, service accounts, canonical-id bridge) is defined.
- [x] **KPI snapshot + aggregation** (daily→weekly→monthly→quarterly→yearly, structure, rules, rebuild/recalc, 10-yr preservation) is defined.
- [x] **Audit architecture** (operational/reporting/financial/security planes, required-event set, current gaps) is defined.
- [x] **Retention, data-quality, data-dictionary, future-scalability, risks, ADRs, technical debt, build order** are all recorded.
- [x] **No code, migrations, or database changes were created** — design only.

**Definition of "ready for Phase 3 (implementation):** stakeholders ratify the event catalogue + the three hard prerequisites (`dim_department`, `dim_actor`, status normalisation); the build order (§19) is accepted; and the missing-entity list (TD-E) is scheduled so low-readiness departments are unblocked before their KPIs are promised.

---

*End of Phase 2 architecture. No code, migrations, or database changes have been created. The next phase begins implementation, starting with the §19 prerequisites.*
