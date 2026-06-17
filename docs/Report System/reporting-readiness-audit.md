# HNPSystem — Reporting-Readiness Audit

**Purpose:** A structured technical audit of the entire H&P Dealer Management System, assessing what can be reported on today and what is missing for an enterprise-grade reporting platform. **Nothing has been implemented — this is analysis only.**

**Method:** Full-repo deep dive across the data layer, every department workflow, the API surface (230 routes), dashboards, hooks, audit logging and role/permission systems.

**Authoritative source of truth:** `src/lib/database/schema/schemaReference.sql` (~80 tables, 1701 lines). Note two structural facts that frame the whole audit:

1. **The Prisma schema (`prisma/schema.prisma`) is dead.** It defines 7 cuid-based models that do not match the live integer-PK Supabase schema. Ignore it.
2. **The schema reference is stale.** At least 8 live, code-referenced tables are missing from it — including the most important audit tables: `audit_log`, `activity_logs`, `job_activity_events`, `auth_login_attempts`, `website_activity`, `payslips`, `message_templates`, `tracking_loan_car_fuel_history`. Any reporting tool built only from the documented schema will silently miss audit data.

---

## PART A — EXECUTIVE SUMMARY

### What the system is good at (report-ready today)
- **Job lifecycle / throughput.** `jobs` carries ~20 milestone timestamps and paired actor columns, and `job_status_history` is a genuine from→to transition log. The job is the single well-instrumented entity.
- **Technician labour & efficiency.** `efficiency.js` already computes `efficiencyPct = allocated ÷ actual hours`, weighted team roll-ups, prorated targets. Raw data in `job_clocking`, `time_records`, `tech_efficiency_entries`.
- **Accounts / invoicing.** The most complete domain — full table set and an existing aggregation API (`/api/accounts`).
- **VHC RAG & conversion £.** `vhc_checks` stores severity, decision, authorised/declined totals; `getVhcSummary` already buckets counts.
- **Security / GDPR audit.** `audit_log` is a well-designed, hash-chained, tamper-evident table — but currently used almost exclusively for compliance/login events.

### The five structural blockers to enterprise reporting
1. **No status-history for anything except jobs.** Parts, VHC items, invoices, accounts, HR, appointments, deliveries all store **current state only**. You cannot measure dwell-time, ageing, time-in-stage or transition rates for them.
2. **No reporting layer in the database.** Zero views, zero materialised views, zero rollup/snapshot tables, zero DB functions/triggers (the one RPC `get_job_timeline` isn't even in the repo). Every metric is recomputed live in JS on each page load — several with `.limit()` truncation and overlap bugs that make the numbers wrong.
3. **Department is not a first-class dimension.** Only `users.department` exists (free-text, nullable, no FK) and it is populated with the *wrong vocabulary*. No operational table is tagged by department.
4. **No unified audit/event log.** Six uncoordinated logging mechanisms with inconsistent actor columns; high-value actions (role changes, clocking edits, invoices/payments, deletes) are **not logged at all**.
5. **Fragmented / duplicated models & identity.** Two clocking systems, two parts-request models, two+ delivery table families; and a dual user identity (int `users.user_id` vs uuid `auth.users.id`) that fractures "who did it" reporting.

### Reportability scorecard by domain
| Domain | Wired to DB? | Status history? | Readiness |
|---|---|---|---|
| Accounts / Invoicing | Yes (full) | No | **High** |
| Job cards (lifecycle) | Yes | **Yes** (`job_status_history`) | **High** |
| Technician efficiency / clocking | Yes | No | **Medium-High** |
| VHC | Yes | No (derived on read) | **Medium-High** |
| Parts | Yes (rich) | No | **Medium** |
| Deliveries / Loan cars | Yes (duplicated tables) | Partial | **Medium** |
| Payroll / HR | Yes (schema drift) | No | **Medium** |
| Valeting | Jobs columns + JSONB | Event log only | **Medium-Low** |
| MOT | **No entity** (job overlay) | No | **Low** |
| Warranty | Tables **absent from schema** | No | **Low** |
| Paint / Bodyshop | **No domain model** | No | **Lowest** |

---

## PART B — THE TEN REQUESTED FINDINGS

### 1. Current reporting capabilities
- **Nine role dashboards** (`src/pages/dashboard/*` → `src/lib/database/dashboard/*`). Eight are live Supabase queries; **Admin contains a hardcoded presentation/mock branch** and magic-number fallbacks.
- **Aggregation already in code:** `efficiency.js` (technician efficiency), `/api/accounts` (AR, exposure, time-windowed balances), `/api/parts/summary` (open-parts counts by status), `/api/hr/dashboard|attendance|operations`, `/api/customers/bookings/calendar` (capacity RAG), `nextjobs.js` (`estimateJobHours` per technician).
- **Live status/timeline UI:** `StatusSidebar` subscribes to 11 tables via Supabase realtime and ticks live clocked time; `SmartSummaryBlock` derives next-step/attention/blocking intelligence.
- **Two operational cron jobs** (`/api/cron/auto-clockout`, `overtime-recurring`) — operational only, no KPI snapshotting.
- **All reporting is live-recompute.** No persisted metrics, no date-range parameterisation (windows hardcoded to "today" / "7 days"), no CSV/PDF export.

### 2. Existing reportable data (the dimensions you already have)
- **Jobs:** status, type, division, service_mode, source, ~20 lifecycle timestamps + actors, VHC authorised/declined £ totals, prime/sub-job links, warranty links.
- **VHC:** per-item severity (R/A/G/grey), decision, labour hours, parts cost, authorised/declined £, send history, declinations.
- **Parts:** 14-value status enum, stock levels, costs/prices, ETA, stock movements ledger, pre-pick zones, goods-in.
- **Clocking:** clock in/out (two systems), hours worked, break minutes, work_type (initial/additional/mot), efficiency targets.
- **Accounts:** invoice totals (parts/labour/consumables/VAT/grand), payment_status, payments, account balances/credit limits, transaction ledger.
- **HR/Payroll:** full payslip breakdown + YTD, absences, training, reviews, disciplinary, overtime.
- **Messaging/Notifications:** thread membership + `last_read_at`, role-broadcast notifications with `job_number`/`target_role`/`created_at`.
- **Audit:** `job_status_history` (from→to), `job_activity_events` (granular per-job actions), `audit_log` (hash-chained, GDPR/login).

### 3. Existing department data ownership
Ownership is **always per-user FK, never per-department** (no department tag on any operational table). Producers:
- **Workshop/Tech →** `jobs` (`assigned_to`, `workshop_started_by`), `job_clocking`, `time_records`.
- **Parts →** `parts_requests` (`requested_by/approved_by/fulfilled_by`), `parts_job_items` (`allocated_by`), `parts_stock_movements`, deliveries, goods-in.
- **Service Advisors →** `jobs` bookings/check-in (`booked_by/checked_in_by`), VHC sends.
- **MOT →** MOT-as-job (`jobs.type='MOT'`), `job_clocking.work_type='mot'`.
- **Valeting →** `jobs.wash_started_at` / `wash_completed_by` + `valetChecklist` JSONB.
- **Paint →** bodyshop jobs (generic `jobs` filtered by type/category).
- **Accounts →** `invoices`, `invoice_payments`, `account_transactions` (notably **no staff-owner column**).
- **Admin/Management/HR →** `users`, HR tables, payroll, reviews (`manager_id`, `approved_by`, `processed_by`).

### 4. Missing tracking data
- Supplier master entity (supplier is free text everywhere) → no lead-time/fill-rate/price-variance.
- Per-line purchase-order timestamps (`parts_deliveries` has no `ordered_at`).
- MOT test record (no result, tester sign-off, advisories, mileage-at-test, certificate, expiry-issued).
- Wash completion timestamp (`wash_completed_at` absent → no valet duration/SLA), wash assignee.
- Paint stage data (prep/spray/dry/buff timestamps, painter, paint code/material, bay).
- Idle/non-productive time, break-reason granularity (single `break_minutes` int).
- Sold-vs-clocked hours join (both inputs exist; no report links them → no recovery/utilisation).
- SLA/target model (only `jobs.next_update_due` and `invoices.due_date` exist).

### 5. Missing status histories
True transition logs exist **only** for jobs (`job_status_history`). Current-state-only (no history) for: `parts_job_items.status`, `parts_order_cards.status`, VHC item workflow (derived on read, never persisted), `invoices.payment_status`, `accounts.status`, all `hr_*` statuses, `job_requests.status`, `appointments.status`, all delivery statuses. Consequences: cannot report how long a part sat `on_order`, when an invoice moved Draft→Paid, time-in-each-VHC-stage, or absence-approval latency.

### 6. Missing event logging
- **Messaging is un-analysable at the row level** — entire conversations are collapsed into a JSON array (`metadata._conversation`) on a single `messages` row per thread. No per-message volume/response-time SQL.
- **Notifications have no read/delivery analytics** — `notifications.read` is `DEFAULT false` and **never updated**; role-broadcast with no per-user recipient row, no `read_at`/`delivered_at`/`dismissed_at`.
- No general `analytics_events` table; events scattered across per-feature tables.

### 7. Missing audit logging
Six uncoordinated mechanisms (`audit_log`, `activity_logs`, `job_activity_events`, `job_status_history`, tracking tables, `website_activity`) with inconsistent actor columns (`actor_user_id` int / `user_id` / `performed_by` / `changed_by` text / `actor` text). **Not logged at all:**
- **Role/permission changes** (`/api/hr/employees` updates `users.role` with no audit).
- **Clocking edits/overrides/deletes** (payroll integrity unprovable).
- **Invoice create/edit/void & payments** (no trail on revenue handling).
- **Parts ordering** action who/when (only stock movement logged).
- **Record deletes — almost universally unlogged** (customers, jobs, payslips, invoices, vhc, notes, loan cars…).
- Generic `.update()` edits outside the job-card/VHC/status paths.

### 8. Missing workflow tracking
- No per-item VHC transition history; reopen/re-authorise overwrites prior decision with no trace.
- No parts cycle-time (ordered→ready→fitted) — status overwritten in place.
- No time-in-stage as a first-class queryable field (must diff scattered `*_at` columns + history rows; `from_status` is `null` for all sub-status events).
- No retest→original linkage for MOT (blocks first-time pass rate).
- No proof-of-delivery / failed-attempt reason codes for deliveries.

### 9. Missing KPI data
- **Recovery rate / labour sold vs cost** — sold hours (`job_requests.hours`) and clocked hours (`job_clocking`) live in separate subsystems, never joined.
- **Supplier KPIs** — no supplier entity.
- **MOT first-time pass rate / per-tester pass rate** — no test record, no reliable tester attribution, fuzzy `completion_status`.
- **Margin** — invoice snapshots store no COGS; `accounts.balance` denormalised, no triggers.
- **First-pass quality / rework** — no rework or defect flags in any department.

### 10. Missing management metrics
- No KPI aggregation/persistence layer (no rollup tables, no daily snapshots, no time-series store).
- No cross-domain reporting endpoint; aggregation siloed per role helper, hardcoded windows, no export.
- No department-level reporting (no department dimension, wrong-vocabulary `users.department`).
- No SLA/target framework, no exception/escalation metrics beyond a latest-5 notifications feed.
- Data-quality landmines that corrupt any naive report: free-text un-CHECK'd status fields (jobs.status, payment_status, HR statuses — note vhc_checks already carries both `authorized` AND `authorised`), `.limit(40)` truncated "totals", MOT pass/fail counted via overlapping `ILIKE`, Service RAG defaulting to amber.

---

## PART C — DEPARTMENT-BY-DEPARTMENT

### Workshop / Technicians
- **Data:** `jobs` (rich lifecycle), `job_clocking` (per-job labour ↔ technician ↔ job_request), `time_records`, `tech_efficiency_entries/targets`, `job_writeups`.
- **Statuses:** main `booked → checked_in → in_progress → invoiced → released`; tech completion `in_progress / tech_complete / authorised_items`; work_type `initial/additional/mot`.
- **Timestamps:** full milestone set on `jobs`; `job_status_history` transitions; clock in/out.
- **Reportable now:** throughput, stage cycle-time, technician productivity/efficiency, additional-work recovery, jobs-in-progress boards.
- **Missing:** sold-vs-clocked utilisation join, idle-time, manual `allocated_hours` reliability, clocking-edit audit, dwell-time per stage as a stored field.

### Parts
- **Data:** `parts_catalog`, `parts_job_items` (operational core, 14-status enum), `parts_requests` (legacy), `parts_deliveries`/items, `parts_stock_movements` (ledger), `parts_order_cards` (counter/trade), goods-in, consumables.
- **Reportable now:** parts spend, stock valuation & reorder, open pipeline by status, goods-in accuracy, rough supplier spend, pre-pick workload, VHC-to-parts conversion.
- **Missing:** supplier master, per-line PO timestamps, parts status history (dwell/aging), reconcile two request models, link counter orders to revenue, returns/credit reason codes, fitted-vs-ordered recovery.

### Service Advisors
- **Data:** `jobs` bookings/check-in, `appointments`, VHC send history, customer statuses, messaging.
- **Reportable now:** appointments/day, check-in throughput, VHC send→decision time, waiting/loan/collection mix, customer engagement.
- **Missing:** advisor-level attribution beyond `booked_by/checked_in_by`, communication responsiveness (blocked by JSON-collapsed messaging), upsell-per-advisor.

### MOT
- **Data:** **no MOT entity.** `vehicles.mot_due` (DVLA, expiry only), MOT-as-job, `job_clocking.work_type='mot'`, MOT Tester role.
- **Reportable now:** throughput (proxy: `checked_in_at`), pass/fail/retest counts (fuzzy `ILIKE`, overlapping), MOT-due pipeline, tester labour via clocking.
- **Missing:** test record/result entity, advisory/defect capture, real test date & expiry-issued, reliable tester sign-off, retest→original linkage (first-time pass rate), DVLA history ingestion.

### Valeting
- **Data:** `jobs.wash_started_at` / `wash_completed_by` + `valetChecklist` JSONB (`washState: complete/no_wash/blank`); ETA signals derived (not stored).
- **Reportable now:** wash queue depth, washes/day, who completed, wash sub-status timeline from `job_status_history`.
- **Missing:** **`wash_completed_at`** (no duration/SLA), wash assignee, per-valet productivity, checklist sub-items, rework/quality flags.

### Paint / Bodyshop
- **Data:** **no domain model.** Dashboard filters generic `jobs` by `type ILIKE '%paint%' OR job_categories @> {bodyshop}`. Stage UI (prep/spray/dry/buff) is aspirational with no backing columns.
- **Reportable now:** count of paint jobs, simple queue, rough days-in-queue, weekly completions.
- **Missing:** everything craft-specific — stage timestamps, painter assignment/clocking, paint codes/material usage, bay utilisation, first-pass quality/rework, paint SLA. **Least reportable domain.**

### Accounts
- **Data:** full table set — `invoices` (+items/requests/payments), `accounts`, `account_transactions`, `company_accounts`, `payment_links/plans`, `payslips`. Existing `/api/accounts` reporting view.
- **Statuses (from `src/config/accounts.js`):** invoice `Draft/Sent/Paid/Overdue/Cancelled`; account `Active/Frozen/Closed` × type `Retail/Warranty/Service/Parts/Sales/General`; transaction `Debit/Credit/Adjustment`.
- **Reportable now:** AR/overdue, revenue by month/account-type, payment-status distribution, credit exposure, proforma→invoice conversion, transaction audit.
- **Missing:** COGS/margin in snapshots, AR aging buckets, partial-payment balance-remaining, freeze/cancel reason+timestamp, GL mapping, dunning, **invoice/payment audit trail**, multi-currency / non-20% VAT.

### Admin / Management / HR
- **Data:** single `users` entity (identity + employment + pay), HR tables (absences/training/reviews/disciplinary/overtime/payroll), `payslips`.
- **Reportable now:** payroll/HR per employee, login/security (`audit_log` + `auth_login_attempts`), GDPR/compliance (fully audited), job throughput, technician productivity.
- **Missing:** department-level rollups (no real department dimension), unified audit trail, leave entitlements stored (currently computed 25/15/10), role-change & destructive-action audit, KPI snapshot layer for trend/management reporting.

---

## PART D — REPORTS THAT CAN BE GENERATED TODAY (with existing data)

> Caveat: many require de-duplicating parallel models, normalising free-text statuses, and avoiding the `.limit()`-truncated dashboard helpers. "Today" = data exists; a query/report surface still has to be built.

**Workshop / Technician**
1. Job throughput (created vs released) by period, division, source, type, service_mode.
2. Stage cycle-time (Booked→Checked-in→In-progress→Invoiced→Released) from milestone columns + `job_status_history`.
3. Technician efficiency (allocated ÷ actual) — already computed in `efficiency.js`.
4. Productivity vs monthly target (prorated, weighted team roll-up).
5. Jobs-in-progress / live workload board (`nextjobs` estimateJobHours).
6. Additional-work recovery (`tech_completion_status='authorised_items'`).

**VHC**
7. RAG inspection volumes (red/amber/green) by vehicle/section/technician.
8. VHC conversion funnel + authorisation rate (authorised ÷ authorised+declined).
9. Upsell £ (authorised vs declined totals).
10. VHC send→decision latency (`vhc_send_history` vs `approved_at`).

**Parts**
11. Parts spend by part/category; stock valuation & reorder list.
12. Open parts pipeline by status (`/api/parts/summary`).
13. Goods-in accuracy (ordered vs received, backorder rate, on-time vs `expected_date`).
14. Supplier spend & coarse lead time (free-text grouping).
15. Pre-pick zone workload; consumables spend & reorder forecast.

**Service / Customer**
16. Appointments/day & capacity RAG (`/api/customers/bookings/calendar`).
17. Waiting mix (Waiting/Loan/Collection); check-in trend.
18. Customer-communication backlog (threads with unread customer messages via `last_read_at`).

**MOT**
19. MOT throughput/day; pass/fail/retest counts (caveat: fuzzy); MOT-due reminder pipeline; tester labour time.

**Valeting**
20. Wash queue depth, washes/day, completer activity.

**Paint**
21. Paint/bodyshop job count & simple queue.

**Accounts**
22. AR / overdue / aging-ish; revenue by month & account type; payment-status distribution; credit exposure (≥80% usage); proforma→invoice conversion; transaction ledger audit.

**Deliveries / Fleet**
23. Deliveries completed/day, on-time (completed_at vs delivery_date), estimated fuel cost per route, unpaid-at-delivery; loan-car utilisation & fuel/mileage trend; insurance-on-file coverage.

**HR / Payroll / Security**
24. Payroll runs & payslip breakdown; absences/leave; training compliance; overtime spend.
25. Failed-login & access reporting (`audit_log` + `auth_login_attempts`); GDPR/consent/SAR register.

**Audit (limited)**
26. Job status-flow audit (from→to, when, by whom); per-job activity volume (`job_activity_events`).

---

## PART E — REPORTS THAT CANNOT YET BE GENERATED (and the data required)

| # | Desired report / KPI | Why it's blocked | Data required |
|---|---|---|---|
| 1 | **Labour recovery rate & utilisation** (sold vs clocked vs available) | Sold hours (`job_requests.hours`) and clocked hours (`job_clocking`) never joined; no available-hours model | A joining report + capacity/available-hours per technician; auto-pull allocated hours from sold |
| 2 | **Time-in-stage / dwell-time / ageing** (any entity except jobs) | Only current state stored for parts, VHC items, invoices, accounts, HR, appointments, deliveries | Per-entity status-history tables (from→to, actor, timestamp) |
| 3 | **Parts cycle-time** (ordered→ready→fitted) & SLA | `parts_job_items.status` overwritten in place; no PO timestamp | Parts status-history table + per-line `ordered_at`/`received_at` |
| 4 | **Supplier scorecard** (lead time, fill rate, on-time %, price variance) | Supplier is free text; no entity | `suppliers` master + supplier_id FKs + PO line dates + agreed price/terms |
| 5 | **MOT first-time pass rate & per-tester pass rate** | No test entity; fuzzy `completion_status`; no retest linkage; no signed tester | `mot_tests` table (result, tester_id, test_date, mileage, advisories, retest_of) |
| 6 | **MOT advisory / defect analytics** | No advisory capture | MOT defect/advisory rows with severity codes |
| 7 | **Valet duration & SLA, per-valet productivity** | No `wash_completed_at`, no wash assignee | Add wash-completed timestamp + wash assignee + checklist sub-items |
| 8 | **Paint/bodyshop stage analytics** (prep/spray/dry/buff, bay utilisation, painter productivity) | No paint domain model | Paint job stage table (stage timestamps, painter_id, bay, paint code/material) |
| 9 | **Gross margin / profitability** | Invoice snapshots store no COGS; totals denormalised without triggers | Cost capture on invoice lines; trigger-maintained totals or DB-computed margin |
| 10 | **Warranty claim reporting** (claims by status/value/outcome/reimbursement) | `warranty_claims`/`warranty_requests` **absent from schema** (helpers fail soft) | Deploy the warranty claim tables with enum statuses, outcomes, reimbursement, manufacturer ref |
| 11 | **Per-VHC-item stage timing & re-authorisation audit** | Workflow derived on read, never persisted; reopen overwrites | VHC item status-history table |
| 12 | **Messaging analytics** (volume, first-response time, throughput) | Conversations collapsed into JSON on one row per thread | Per-message rows (or a parallel analytics table) + delivered/read timestamps |
| 13 | **Notification read/delivery rates** | `notifications.read` never updated; role-broadcast, no recipient rows | Per-user notification recipient rows + `read_at`/`delivered_at`/`dismissed_at` |
| 14 | **Department-level reporting** (any KPI by department/team) | No department dimension; `users.department` free-text, nullable, wrong vocabulary | `departments` lookup + constrained `users.department` (backfilled) + department key on/derivable from operational tables |
| 15 | **Unified "who did what when" audit & compliance** | Six uncoordinated logs; role changes / clocking edits / invoices / payments / deletes unlogged | Route high-value writes through existing `audit_log` (actor, before/after, reason) |
| 16 | **Financial/payroll integrity audit** | Invoices, payments, clocking edits leave no trail | Audit hooks on invoice/payment/clocking create/edit/void/delete |
| 17 | **Holiday/leave balance (authoritative)** | Entitlements computed in code (25/15/10), not stored | Stored entitlement & accrual ledger per employee |
| 18 | **First-pass quality / rework rate** (any department) | No rework/defect flags anywhere | Rework/defect/comeback flag + reason on jobs/VHC/paint |
| 19 | **Historical KPI trends / management time-series** | No rollup/snapshot tables; live-recompute only | Daily KPI snapshot/rollup tables + scheduled aggregation |
| 20 | **SLA / target attainment** (any stage) | No SLA/target model beyond `next_update_due` / invoice `due_date` | SLA/target definitions per stage + breach tracking |

---

## PART F — DATA-MODEL HAZARDS TO RESOLVE BEFORE BUILDING REPORTS

1. **Schema drift** — reconcile `schemaReference.sql` with live audit/HR tables; add migrations. Delete or fix the dead Prisma schema.
2. **Free-text un-CHECK'd statuses** — `jobs.status`, `job_requests.status`, `invoices.payment_status`, HR statuses, MOT `completion_status`; note `authorized`/`authorised` both present. GROUP BY will fragment.
3. **Dual user identity** — int `users.user_id` vs uuid `auth.users.id` (`parts_catalog`, `parts_job_items.allocated_by`, `parts_stock_movements.performed_by`). Bridge before cross-domain "who" reporting.
4. **Free-text actor columns** — `job_status_history.changed_by`, `vhc_checks.approved_by`, `account_transactions.created_by` mix real users, `SYSTEM_*` tokens, `"customer"`, null. Not joinable to `users`.
5. **Duplicated/parallel models** — Parts (`parts_requests` vs `parts_job_items`); Clocking (`time_records` vs `job_clocking` vs `tech_efficiency_entries`, with differing duration formulas re: breaks); Deliveries (`deliveries`/`delivery_stops` vs `parts_delivery_jobs` vs `parts_deliveries`/runs). Pick canonical sources.
6. **Denormalised totals without triggers** — `invoices` (7 total columns), `accounts.balance` are app-maintained; reports may disagree with line items.
7. **Truncated / fuzzy dashboard helpers** — `.limit(40)` "totals", overlapping MOT `ILIKE` counts, Service RAG defaulting to amber, Admin mock branch. Do not build reports on these helpers as-is.
8. **Auth stub** — `getUserFromRequest.js` returns `{role:"Admin"}` unconditionally; dev role-bypass cookies exist. Attribution untrustworthy on affected endpoints / non-prod.

---

## PART G — RECOMMENDED FOUNDATIONS FOR A REPORTING PLATFORM (not yet implemented)

In rough priority order, the highest-leverage enablers:
1. **Generic append-only event/audit log** routed through the existing tamper-evident `audit_log` for all high-value writes (status, role, clocking, invoices/payments, deletes) — unlocks findings 7, 15, 16 and most "who/when" reports.
2. **Per-entity status-history tables** (parts, VHC item, invoice, account, appointment, delivery) — unlocks all dwell-time / cycle-time / SLA reporting (findings 2, 3, 11).
3. **Department dimension** — `departments` lookup + constrained `users.department` (backfilled), with a department key derivable on operational tables — unlocks all by-department management reporting (finding 14).
4. **KPI snapshot/rollup layer + scheduled aggregation** — stop live-recompute; enable historical trends and consistent numbers (finding 19).
5. **Missing domain entities** — `suppliers`, `mot_tests` (+advisories), deploy `warranty_claims`, paint stage model, valet completion timestamp.
6. **Normalise statuses & identity** — CHECK-constrained enums, single user identity, FK actor columns.
7. **A cross-domain reporting API** with date-range parameters and export (CSV/PDF), reading from rollups/views rather than ad-hoc helpers.

---

*End of audit. No code or schema has been changed.*
