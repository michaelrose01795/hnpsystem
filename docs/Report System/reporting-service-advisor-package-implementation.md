# HNPSystem — Service Advisor Reporting Package Implementation (Phase 9)

> **Status:** Implemented. Phase 9 = the **fourth report package** built on the shared reporting
> foundation (Phase 4), activation/hardening (Phase 5), and the Workshop (Phase 6), Parts (Phase 7) and
> Accounts (Phase 8) packages. This phase builds **Service Advisor reporting only** — no Management, MOT,
> Valeting or Paint screens were built (deliberately out of scope). Workshop, Parts and Accounts
> reporting were **not modified**; no shared-infrastructure extension was even required (see §1.2).
> **Source of truth:** the four architecture docs in `docs/Report System/`
> (`reporting-readiness-audit.md`, `reporting-platform-architecture.md`,
> `reporting-data-collection-architecture.md`, `reporting-kpi-catalogue-architecture.md`) + the Phase-4
> (`reporting-foundation-implementation.md`), Phase-5 (`reporting-activation-readiness.md`), Phase-6
> (`reporting-workshop-package-implementation.md`), Phase-7 (`reporting-parts-package-implementation.md`)
> and Phase-8 (`reporting-accounts-package-implementation.md`) summaries.
> **Rule honoured:** every figure, formula, trend, drill-down and permission decision comes from the
> existing engine/APIs. **No KPI is calculated in the UI; no formula was invented** — all calculations
> originate from KPI Catalogue §7 (`svc.*`) and the cross-listed §8 (`vhc.*`) entries. No separate
> reporting system was created — the package consumes the existing reporting platform end-to-end.

---

## 0. Executive Summary

Phase 9 ships the **Service Advisor report package** end-to-end on the shared platform, making Service
Advisors the **fourth fully integrated reporting package** after Workshop, Parts and Accounts. It is
built **entirely from thin clients of `/api/reports/*`** and reuses the Phase-6/7/8 shared components
(`src/components/reporting/*`), hooks (`src/hooks/reporting/useReporting.js`) and the engine
**unchanged**. It does three things:

1. **Promotes the Service Advisor KPI catalogue.** The full Phase-3 §7 `svc.*` catalogue (13 metrics) is
   registered. **Three R1 metrics have working resolvers**; **ten R2/R3 metrics are *declared***
   (catalogue entry, no resolver) so they surface honestly with their exact blocker rather than being
   silently omitted. Every resolver routes through the sanctioned `queryBuilder` (exact counts,
   distribution via `groupCount`) — no `.limit()` totals, no invented maths.
2. **Builds the Service Advisor UI** — summary scorecards, KPI panels, daily/weekly/monthly trends,
   drill-down tables, filtering, audited CSV exports and saved views — using the **same reusable
   reporting components** the earlier packages introduced. No duplicate UI, no duplicate KPI cards, no
   duplicate drill-down implementation. Layout grouping lives in `serviceReportConfig.js`; the engine
   remains the single source of every value and formula. **Department-level VHC value/rate are surfaced
   through the existing R1 `vhc.*` catalogue entries (referenced by id, not re-implemented)** so there is
   exactly one definition per metric and Workshop/VHC reporting is untouched.
3. **Wires the Service Advisor report into the existing `/reports` area** (no new system): a third link in
   the already-signed-off, flag-gated **Reports** sidebar section, reachable for Service/Management/Admin
   roles, with the API enforcing per-KPI permission, department scope and audit server-side.

**Net result:** Service Advisor department-level reporting is **operational and trustworthy today**
(live-correct, exact, provenance-labelled): booking/appointment volume, VHC send rate, waiting/loan/
collection mix, plus department-level VHC authorisation rate, authorised value, completion rate and red
items — with booking-volume and authorised-value trends across day/week/month and advisor-level
drill-down on bookings (the appointment's booking advisor). The per-advisor conversion, customer-contact,
customer-response, VHC-view, appointment-conversion, follow-up and CSAT tiers remain blocked on the
documented R2/R3 prerequisites (customer-communication event capture, appointment status-history, the VHC
view event, the send-advisor actor stamp, and a follow-up/CSAT entity).

---

## 1. What Was Built

### 1.1 KPI definitions (catalogue promotion — `src/lib/reporting/kpiDefinitions/service.js`)

| Change | Detail |
|---|---|
| Registered the full §7 `svc.*` catalogue (13 KPIs) | 3 R1 resolvers + 10 declared R2/R3. |
| Every definition states the **verbatim catalogue formula** (KPI Catalogue §7) | sources, tier, readiness, unit, target type and (where applicable) a `drilldown`. Resolvers route through `queryBuilder` only. |
| Permission left open (operational) | `svc.*` KPIs are operational (not financial/PII), so `permission = []` (any authenticated reporting user the page admits) — exactly as the Workshop / Parts / VHC seed KPIs. Navigation is gated to Service/Management/Admin; the engine still applies `permissionScope` server-side. |

### 1.2 Shared reporting infrastructure — **no extension required**

Like Phase 8 (and unlike Phase 7's `sumProduct`), **Service Advisors needed no new shared helper**. Every
Service figure is an exact `countRows` (booking volume, VHC send numerator/denominator) or a distribution
via the existing `groupCount` (waiting/loan/collection mix). Drill-downs use the existing `fetchRows`.
**No shared component, hook, API or the engine was modified. Workshop, Parts and Accounts — their KPIs and
UI — are completely untouched.** The department-level VHC value/rate cards reference the **existing**
`vhc.upsell_revenue` / `vhc.authorisation_rate` / `vhc.completion_rate` / `vhc.red_items` resolvers, so no
new `vhc.*` resolver was added either.

### 1.3 Shared reporting UI — reused unchanged (no duplication)

The Service Advisor package consumes the existing components verbatim: `ReportFilterBar`, `KpiValueCard` /
`KpiScorecardStrip`, `KpiTrendChart`, `KpiPanel`, `ReportDrilldownTable`, `SavedViewsBar`,
`ProvenanceFooter`, `ReportSection`, and all of `useReporting.js`
(`useReportFilter`/`useKpiValues`/`useKpiTrend`/`useDrilldown`/`useSavedViews`/`buildExportUrl`).
**No Supabase, no KPI maths, no duplicated reporting logic in the Service Advisor client.**

### 1.4 Service Advisor pages (`src/pages/reports/service.js` + `src/components/reporting/service/`)

| Section (tab) | Contents | KPIs |
|---|---|---|
| **Service Overview** | Department scorecard + daily/weekly/monthly performance summary (advisor activity trends) | svc.booking_volume, svc.vhc_send_rate, svc.waiting_mix, vhc.authorisation_rate, vhc.upsell_revenue, vhc.completion_rate, vhc.red_items |
| **Customer Communications** | VHC send rate (live customer-comms signal + trend); customer contact activity, customer responses, follow-up activity (declared readiness indicators) | svc.vhc_send_rate; declared svc.contact_rate / svc.response_time / svc.followup_completion |
| **Appointment & Booking** | Appointment & booking volume (drill lists each appointment + booking advisor), customer-engagement mix; booking performance (conversion, declared) | svc.booking_volume, svc.waiting_mix; declared svc.appointment_conversion |
| **VHC Performance** | VHC sent (send rate), authorised (auth rate), authorised value, completion; VHC viewed, per-advisor authorised/declined value, advisor conversion (declared) | svc.vhc_send_rate, vhc.authorisation_rate, vhc.upsell_revenue, vhc.completion_rate; declared svc.vhc_view_rate / svc.declined_value / svc.vhc_conversion / svc.authorised_value |
| **Reporting Utilities** | Saved views, exports, filters, drill-down explorer | every drillable Service Advisor KPI |

`serviceReportConfig.js` holds the **layout grouping only** (which KPI ids appear where); the engine
remains the single source of every value and formula. Filtering lives in the always-visible
`ReportFilterBar` (date-range preset, granularity, search) at the top of the page.

### 1.5 Navigation, access & permissions (reused wiring)

| File | Change |
|---|---|
| `src/config/navigation.js` | Added a **Service Advisor Reports** link (`/reports/service`) to the existing flag-gated Reports section, between Parts and Accounts. Visible roles are *derived from the canonical `ROLE_DEPARTMENT_MAP`* (service + management + admin) — never hardcoded. Workshop/Parts/Accounts links unchanged. |
| `src/config/routeAccess.js` | **No change** — `/reports` is already a `PROTECTED_PREFIXES` entry (Phase 6); `/reports/service` inherits it. |
| `src/pages/reports/service.js` | Wraps in `ProtectedRoute` with the same service/management/admin role-derived set. |

The `reporting_nav_enabled` flag was already ON (Phase 6) — Phase 9 added no flag changes. **All data
permissions remain server-side**: `withReportingAuth` → `permissionScope` (department/scope) + per-KPI
permission gate.

### 1.6 Audit

Report **view** and **export** are audited by the existing framework with **zero new code**:
`auditReportAccess` (gated by `reporting_access_audit_enabled`, **ON**) writes a hash-chained `audit_log`
row (`report.view` / `report.export`) and mirrors a `REPORT_VIEWED` / `REPORT_EXPORTED` event on every
`/api/reports/{kpi,drilldown,export}` call the Service Advisor UI makes — the "who viewed/exported what"
control the architecture (§9.12/§9.13) requires.

---

## 2. Service Advisor KPIs Implemented (operational now)

"Operational" = has a resolver, computes trust-correctly today (live), and is wired into the UI with
drill-down (where defined) and provenance.

| KPI | Tier | Formula (from KPI Catalogue §7) | Notes |
|---|---|---|---|
| `svc.booking_volume` | operational | COUNT(appointments booked) | Exact count of `appointments` in period; `breakdown.booking_requests` carries the `job_booking_requests` count. Drill lists appointments **with their booking advisor** (`created_by`). |
| `svc.vhc_send_rate` | tactical | COUNT(VHC sent) ÷ COUNT(jobs requiring VHC) × 100 | Numerator = jobs with `vhc_sent_at` in period; denominator = `vhc_required` jobs created in period. Drill lists the sent jobs. |
| `svc.waiting_mix` | operational | distribution of `job_customer_statuses.customer_status` | Exact distribution via `groupCount`; `breakdown` carries the per-status mix, `value` the total. Drill lists the status records. |

**3 Service Advisor KPIs operational** with their own `svc.*` resolvers. In addition, the package surfaces
**4 existing R1 `vhc.*` KPIs** (one definition per metric — **referenced, not duplicated**) to provide the
department-level VHC numbers the brief requires:

| Brief concept | Catalogue KPI(s) |
|---|---|
| Appointment volume | `svc.booking_volume` (`value`/`count` = appointments) |
| Booking volume | `svc.booking_volume` (`breakdown.booking_requests`) |
| VHC send rate | `svc.vhc_send_rate` |
| VHC authorisation rate | `vhc.authorisation_rate` (R1, existing) |
| Authorised value | `vhc.upsell_revenue` (R1, existing) |
| Declined value (department) | `vhc.authorisation_rate` denominator − numerator (identified − authorised) |
| Customer communication activity | `svc.vhc_send_rate` (VHC = the primary customer communication) |
| Customer engagement | `svc.waiting_mix` |
| VHC completion / inspection quality | `vhc.completion_rate`, `vhc.red_items` (R1, existing) |
| Advisor activity trends | `svc.booking_volume` + `vhc.upsell_revenue` daily/weekly/monthly trends |

> **"Appointment volume", "Booking volume" and "Customer communication activity" are not separate
> catalogue KPIs** — per the discipline (use only catalogue definitions, invent nothing), they are
> presented through the count/breakdown facets of existing catalogue KPIs, exactly as the Accounts
> package mapped "invoice volume" onto `acc.outstanding_invoices` and the Parts package mapped "parts
> pipeline" onto `prt.open_by_status`.

---

## 3. Service Advisor KPIs Still Blocked (declared, no resolver yet)

Registered in the catalogue (so they appear in the UI / `/api/reports/catalog` with their exact blocker)
but intentionally **no resolver** — the engine reports them as "declared, readiness Rn". They light up in
a later phase once the prerequisite lands.

| KPI | Tier | Readiness | Blocker |
|---|---|---|---|
| `svc.appointment_conversion` | tactical | R2 | Booked→arrived/job-created transition needs `appointment_status_history` (appointment is P4 priority 5). |
| `svc.contact_rate` | tactical | R2 | Needs a per-job `CUSTOMER_CONTACTED` event captured (no customer-contact log today; D11 JSON-collapsed messaging). |
| `svc.response_time` | tactical | R2 | Message-level precision blocked by JSON-collapsed message storage (D11); event-level proxy needs `vhc_item_status_history`. |
| `svc.vhc_view_rate` | tactical | R2 | Needs the `VHC_VIEWED` event (customer share-link `viewed_at`) captured; the send side is R1. |
| `svc.vhc_conversion` | tactical | R2 | Per-advisor conversion needs the sending advisor stamped on `VHC_SENT` (D4). Department-level is live via `vhc.authorisation_rate`. |
| `svc.authorised_value` | tactical | R2 | Per-advisor split needs the send-advisor actor stamp (D4). Department-level is live via `vhc.upsell_revenue`. |
| `svc.declined_value` | tactical | R2 | Per-advisor split needs the send-advisor actor stamp (D4). Department-level is visible via `vhc.authorisation_rate` (identified − authorised). |
| `svc.followup_completion` | tactical | R3 | No follow-up / recall task entity to record that a declined item was chased. |
| `svc.csat` | strategic | R3 | No CSAT/NPS capture (needs a survey integration). |

> **`svc.capacity_rag` (Booking Capacity RAG, §7 R1) was deliberately not migrated** into a resolver. The
> catalogue's own definition is "reuse the existing `/api/customers/bookings/calendar` endpoint, which
> already computes the RAG." Re-implementing it in a reporting resolver would either **duplicate** that
> operational endpoint or **invent** capacity thresholds — both forbidden by the brief. It remains served
> by the existing operational endpoint and is intentionally out of this package's resolver set; booking
> volume (`svc.booking_volume`) provides the underlying demand signal on the reporting platform.

---

## 4. Remaining R2 / R3 Blockers

### 4.1 R2 — need applied SQL + accrued history/events + actor attribution
- **Customer-communication event capture** (`CUSTOMER_CONTACTED`, `VHC_VIEWED`) — flip
  `reporting_emit_enabled` ON and wire the emits in the messaging / share-link write paths → unblocks
  `svc.contact_rate`, `svc.response_time`, `svc.vhc_view_rate`.
- **Appointment status-history accrual** (apply `003_status_history.sql`, schedule crons) → unblocks
  `svc.appointment_conversion`. `appointment` is **P4 priority 5** in the status-history rollout
  (`entities.js`), after parts, VHC item, invoice and account.
- **Send-advisor actor attribution** (D4 — stamp the sending advisor on `VHC_SENT`; the canonical-id
  bridge resolves the actor) → unblocks the per-advisor `svc.vhc_conversion`, `svc.authorised_value`,
  `svc.declined_value`. The department-level equivalents are already live via `vhc.*`.
- **No snapshots yet** (aggregation cron unscheduled) → point values and trends are served by labelled
  **live fallback**, not snapshots. Correct, but recomputed per request. Once `004_kpi_snapshots.sql` is
  applied and the daily cron runs, point values and trends switch to the snapshot fast-path automatically
  — **no UI change**.

### 4.2 R3 — need a new entity / external capture
- **Follow-up / recall task entity** → `svc.followup_completion`. Requires a new entity to record that a
  declined VHC item was chased.
- **CSAT/NPS survey integration** → `svc.csat`. Slots into the event spine as an
  `actor_kind='integration'` feed with no architecture change.

---

## 5. Data-Quality Observations

- **Trust-by-construction holds.** No `.limit()` total, no overlapping `ILIKE`, no fuzzy inference
  anywhere in the package. Counts are `head:true,count:'exact'`; the waiting-mix distribution uses the
  paginated `groupCount`, so it is a true distribution, never a truncated page.
- **`svc.booking_volume` counts the booking action (`appointments.created_at`).** "Appointments booked"
  is when the appointment row was created; `breakdown.booking_requests` counts `job_booking_requests`
  submitted in the period. The two are distinct entities (mobile `appointments` vs the service
  booking-request funnel) presented as facets of one KPI, not summed into a misleading total.
- **`svc.waiting_mix` is a distribution of status records set in the period** (date-filtered on
  `created_at`). Because `job_customer_statuses` can hold more than one row per job over time, this is the
  mix of statuses *set* in the window, not a precise latest-per-job snapshot — a precise current mix
  arrives with appointment/customer status-history (R2). Flagged in `futureNotes`, not silent.
- **Department-level VHC value/rate are deliberately the existing `vhc.*` KPIs, not new formulas.**
  `vhc.upsell_revenue` (authorised £), `vhc.authorisation_rate` (authorised ÷ identified) and
  `vhc.completion_rate` are referenced by id — one definition per metric. The advisor-attributed `svc.*`
  equivalents are declared until the send-advisor stamp lands.
- **Department attribution rides on role (D3).** As Phases 5–8 — the free-text `users.department` column
  is not yet constrained to `dim_department`; Service attribution is resolved from role.

---

## 6. Reporting Performance Observations

- **One round-trip per scorecard.** The scorecard strip requests all its KPIs in a single
  `/api/reports/kpi?ids=…` call; the engine resolves them concurrently. Trend and drill-down are lazy
  (only the open panel/section fetches).
- **Live-fallback cost.** With no snapshots applied yet, every value is a **live recompute** against
  operational tables (labelled `live` in provenance). The Service resolvers are cheap: two exact counts
  (`svc.vhc_send_rate`), one exact count + one (`svc.booking_volume`), or one paginated `groupCount`
  (`svc.waiting_mix`). The short-TTL reporting cache (`withReportingCache`, keyed by kpi+filter+scope)
  absorbs repeat views. Once `004_kpi_snapshots.sql` is applied and the daily cron runs, point values and
  trends switch to the snapshot fast-path automatically — **no UI change**.
- **Trend rendering is scoped to flow KPIs** (`svc.booking_volume`, `vhc.upsell_revenue`) where the
  engine's per-bucket recompute is correct. `svc.waiting_mix` is shown as a card value + distribution +
  drill, not a mis-scaled line.

---

## 7. Attribution Observations

- **Booking advisor attribution is available now and surfaced in the drill-down.** `appointments.created_by`
  and `jobs.booked_by` are real FKs to `users.user_id`; the `svc.booking_volume` and `svc.vhc_send_rate`
  drill-downs include them, so a manager can inspect bookings/sends **per advisor today** — the
  "advisor-level drill-down wherever supported by existing attribution data" the brief asks for.
- **Per-advisor KPI *aggregation* is blocked by the VHC send-advisor gap (D4).** `vhc_send_history.sent_by`
  is a free-text name, not a canonical user id, and `VHC_SENT` does not yet stamp the resolved sending
  advisor. Until the canonical-id bridge stamps it, the per-advisor conversion / authorised / declined
  KPIs (`svc.vhc_conversion`, `svc.authorised_value`, `svc.declined_value`) stay declared — the
  department-level figures are live via `vhc.*`.
- **Identity is the NextAuth session** (ADR-8) — the `getUserFromRequest` stub is excluded from reporting
  attribution.

---

## 8. Recommended Next Phase

**Phase 10 — Capture go-live for Service Advisors, then the next package.** In order:

1. **Apply the SQL** (`000_all_reporting.sql`), run `seedDepartments()`, flip `reporting_emit_enabled`
   ON, and **schedule the aggregation crons** — this turns on snapshots (fast-path + trends) and starts
   `appointment_status_history` accruing (P4 priority 5), and lets the messaging/share-link write paths
   emit `CUSTOMER_CONTACTED` / `VHC_VIEWED`, unblocking the R2 communication and view tiers with no UI
   change.
2. **Stamp the sending advisor on `VHC_SENT` (D4 actor remediation)** → unblocks per-advisor
   `svc.vhc_conversion`, `svc.authorised_value`, `svc.declined_value`.
3. **Add the follow-up/recall task entity** → `svc.followup_completion`; and a **CSAT/NPS integration** →
   `svc.csat`.
4. **Build the next department package** on the now four-times-proven shared components — **MOT**,
   **Valeting** or **Paint** are the remaining operational departments (each gated more by R3 entity gaps),
   or the **Management / executive** dashboard (`mgt.*`) which composes once the per-department
   revenue/profit feeds and the department dimension are live.

After the SQL/crons/actor-stamp land, the declared Service R2 metrics become computable by adding
resolvers to the existing catalogue entries — **no UI or architectural change required**, exactly as the
foundation intended.

---

## 9. Status at Completion — operational now vs dependent on future phases

**Operational now (live, trustworthy, in the Service Advisor UI):**
`svc.booking_volume`, `svc.vhc_send_rate`, `svc.waiting_mix` (own resolvers) + the cross-listed
department-level `vhc.upsell_revenue`, `vhc.authorisation_rate`, `vhc.completion_rate`, `vhc.red_items`.

**Which Service Advisor KPIs are operational now:** booking/appointment volume, VHC send rate, waiting/
loan/collection mix, and (via the shared VHC catalogue) VHC authorisation rate, authorised value, VHC
completion and red items — with booking-volume and authorised-value trends across daily/weekly/monthly and
advisor-level drill-down on bookings and VHC sends.

**Which Service Advisor KPIs are dependent on future reporting phases:**

| Requirement | Service Advisor KPIs waiting on it |
|---|---|
| **Customer-communication modelling** (`CUSTOMER_CONTACTED` / `VHC_VIEWED` event capture, un-collapse messaging — D11) | `svc.contact_rate`, `svc.response_time`, `svc.vhc_view_rate` (R2). |
| **Status-history accrual** (`appointment_status_history`, P4 priority 5) | `svc.appointment_conversion` (R2). |
| **Actor-attribution remediation** (send-advisor stamped on `VHC_SENT`, D4) | `svc.vhc_conversion`, `svc.authorised_value`, `svc.declined_value` (R2). |
| **New entity / external capture** (follow-up task entity; CSAT/NPS integration) | `svc.followup_completion`, `svc.csat` (R3). |

**Which Service Advisor KPIs require status-history accrual:** `svc.appointment_conversion` (needs
`appointment_status_history` for the booked→arrived/job-created transition; the current
`appointments.status` snapshot loses the path). `svc.response_time` also depends on `vhc_item_status_history`
for its event-level proxy.

**Which Service Advisor KPIs require actor-attribution remediation:** `svc.vhc_conversion`,
`svc.authorised_value`, `svc.declined_value` — all need the sending advisor stamped on `VHC_SENT` (the
canonical-id bridge, D4). Department-level equivalents are already live via `vhc.*`.

**Which Service Advisor KPIs require customer-communication modelling improvements:** `svc.contact_rate`
(needs a per-job `CUSTOMER_CONTACTED` event), `svc.response_time` (blocked by D11 JSON-collapsed message
storage; needs message-level analytics rows), and `svc.vhc_view_rate` (needs the `VHC_VIEWED` event from
the customer share-link). `svc.followup_completion` further needs a follow-up entity (R3).

---

## 10. How to Re-run the Validation

```bash
npm run validate:reporting     # 36 runtime contract checks (green; every R1 KPI — now incl. Service — has a resolver)
npm run check:report-events    # emit-name validity + emit-coverage advisories
npm run check:borders          # layer/border law (pre-existing staffglobal.css debt aside)
```

The Service Advisor package added **no** new failing checks: `validate:reporting` is **36/36** (every
Service R1 KPI has a resolver; every `sourceEvent` is a real catalogue event — `APPOINTMENT_BOOKED`,
`VHC_SENT`, `CUSTOMER_STATUS_SET`, `APPOINTMENT_STATUS_CHANGED`, `JOB_CREATED`, `CUSTOMER_CONTACTED`,
`VHC_VIEWED`, `VHC_AUTHORISED`, `VHC_DECLINED`; every declared `sourceHistory` —
`appointment_status_history`, `vhc_item_status_history` — is a real registered entity history table).
`check:report-events` still passes with the single pre-existing `jobClocking.js` advisory, and the new UI
introduces **no** border-law violations (surfaces use `LayerSurface`/`LayerTheme`; the only borders are
ghost-button rings via `--ghostbutton-ring` — the reported `check:borders` failures are all the
pre-existing `staffglobal.css` debt). ESLint over all new files: **0 errors, 0 warnings**.

---

*End of Phase 9. The Service Advisor report package is live on the shared reporting platform — the fourth
fully integrated package after Workshop, Parts and Accounts. No Management, MOT, Valeting or Paint reports
were built; Workshop, Parts and Accounts reporting were unchanged, and no shared-infrastructure extension
was required. 3 Service Advisor `svc.*` KPIs are operational (plus 4 cross-listed department-level `vhc.*`
KPIs); 10 remain declared and dependent on the documented R2/R3 prerequisites (customer-communication
event capture, appointment status-history, the VHC view event, send-advisor attribution, and a follow-up/
CSAT entity).*
