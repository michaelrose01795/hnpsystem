# HNPSystem — Accounts Reporting Package Implementation (Phase 8)

> **Status:** Implemented. Phase 8 = the **third report package** built on the shared reporting
> foundation (Phase 4), activation/hardening (Phase 5), the Workshop package (Phase 6) and the Parts
> package (Phase 7). This phase builds **Accounts reporting only** — no Management, MOT, Valeting or
> Paint screens were built (deliberately out of scope). Workshop and Parts reporting were **not
> modified**; no shared-infrastructure extension was even required (see §1.2).
> **Source of truth:** the four architecture docs in `docs/Report System/`
> (`reporting-readiness-audit.md`, `reporting-platform-architecture.md`,
> `reporting-data-collection-architecture.md`, `reporting-kpi-catalogue-architecture.md`) + the Phase-4
> (`reporting-foundation-implementation.md`), Phase-5 (`reporting-activation-readiness.md`), Phase-6
> (`reporting-workshop-package-implementation.md`) and Phase-7
> (`reporting-parts-package-implementation.md`) summaries.
> **Rule honoured:** every figure, formula, trend, drill-down and permission decision comes from the
> existing engine/APIs. **No KPI is calculated in the UI; no formula was invented** — all calculations
> originate from KPI Catalogue §12 (`acc.*`). No separate financial reporting system was created — the
> package consumes the existing reporting platform end-to-end.

---

## 0. Executive Summary

Phase 8 ships the **Accounts report package** end-to-end on the shared platform, making Accounts the
**third fully integrated reporting package** after Workshop and Parts. It is built **entirely from thin
clients of `/api/reports/*`** and reuses the Phase-6/7 shared components (`src/components/reporting/*`),
hooks (`src/hooks/reporting/useReporting.js`) and the engine **unchanged**. It does three things:

1. **Promotes the Accounts KPI catalogue.** The seed set (2 Accounts KPIs) is expanded to the full
   Phase-3 §12 Accounts catalogue. **Eight R1 metrics now have working resolvers**; **six R2/R3 metrics
   are *declared*** (catalogue entry, no resolver) so they surface honestly with their exact blocker
   rather than being silently omitted. Every resolver routes through the sanctioned `queryBuilder`
   (exact counts, paginated column sums) — no `.limit()` totals, no invented maths.
2. **Builds the Accounts UI** — summary scorecards, KPI panels, daily/weekly/monthly trends, drill-down
   tables, filtering, audited CSV exports and saved views — using the **same reusable reporting
   components** the Workshop and Parts packages introduced. No duplicate UI, no duplicate KPI cards, no
   duplicate drill-down implementation. Layout grouping lives in `accountsReportConfig.js`; the engine
   remains the single source of every value and formula.
3. **Wires the Accounts report into the existing `/reports` area** (no new system): a third link in the
   already-signed-off, flag-gated **Reports** sidebar section, reachable for Accounts/Management/Executive
   roles, with the API enforcing the per-KPI **financial gate**, department scope and audit server-side.

**Net result:** Accounts department-level reporting is **operational and trustworthy today**
(live-correct, exact, provenance-labelled, financial-gated): total/labour/parts revenue, outstanding
invoices, accounts receivable, payments received, account balances and credit exposure — with revenue
and payment trends across day/week/month. The DSO, invoice-ageing, payment-conversion, profitability and
gross/net-profit tiers remain blocked on the documented R2/R3 prerequisites (invoice status-history
accrual, the department dimension on revenue events, COGS on invoice lines, an opex model).

---

## 1. What Was Built

### 1.1 KPI definitions (catalogue promotion — `src/lib/reporting/kpiDefinitions/accounts.js`)

| Change | Detail |
|---|---|
| Expanded 2 → 14 Accounts KPIs | 8 R1 resolvers (incl. the 2 seed KPIs `acc.revenue` / `acc.outstanding_invoices`, retained & enriched) + 6 declared R2/R3. |
| Every definition states the **verbatim catalogue formula** (KPI Catalogue §12) | sources, tier, readiness, unit, target type and (where applicable) a `drilldown`. Resolvers route through `queryBuilder` only. |
| **Every** Accounts KPI is **financial-gated** | `permission = FINANCIAL_SENSITIVE_ROLES` (Accounts + executives) — the highest permission tier in the framework (§9). |

### 1.2 Shared reporting infrastructure — **no extension required**

Unlike Phase 7 (which added `queryBuilder.sumProduct` for parts value sums), **Accounts needed no new
shared helper**. Every Accounts figure is a direct column sum (`Σ grand_total`, `Σ labour_total`,
`Σ parts_total`, `Σ invoice_payments.amount`, `Σ accounts.balance`) or an exact count, both already
provided by `sumColumn` / `countRows`. The net receivable nets two `sumColumn` totals in the resolver;
the credit-exposure at-risk count iterates the small active-accounts set via `fetchRows` (the same
approach the existing `/api/accounts` reporting view uses). **No shared component, hook, API or the
engine was modified. Workshop and Parts — their KPIs and UI — are completely untouched.**

### 1.3 Shared reporting UI — reused unchanged (no duplication)

The Accounts package consumes the existing components verbatim: `ReportFilterBar`, `KpiValueCard` /
`KpiScorecardStrip`, `KpiTrendChart`, `KpiPanel`, `ReportDrilldownTable`, `SavedViewsBar`,
`ProvenanceFooter`, `ReportSection`, and all of `useReporting.js`
(`useReportFilter`/`useKpiValues`/`useKpiTrend`/`useDrilldown`/`useSavedViews`/`buildExportUrl`).
**No Supabase, no KPI maths, no duplicated reporting logic in the Accounts client.**

### 1.4 Accounts pages (`src/pages/reports/accounts.js` + `src/components/reporting/accounts/`)

| Section (tab) | Contents | KPIs |
|---|---|---|
| **Overview** | Department scorecard + daily/weekly/monthly performance summary | revenue, labour/parts revenue, payments received, outstanding invoices, AR, credit exposure, account balances |
| **Revenue & Invoicing** | Revenue (total/labour/parts) panels + trend + drill, invoice-volume / outstanding-invoice pipeline drill, revenue monitoring | acc.revenue, acc.labour_revenue, acc.parts_revenue, acc.outstanding_invoices |
| **Payments & Receivables** | Payments received (trended), account balances, accounts receivable, credit exposure (point-in-time + drill) | acc.payments_received, acc.ar, acc.account_balances, acc.credit_exposure |
| **Financial Operations** | Financial activity scorecard, revenue & payment trends, invoice-processing & financial readiness indicators | acc.payments_received, acc.outstanding_invoices, acc.account_balances, acc.credit_exposure; declared acc.dso / acc.invoice_ageing / acc.payment_conversion / acc.profitability / acc.gross_profit / acc.net_profit |
| **Reporting Utilities** | Saved views, exports, filters, drill-down explorer | every drillable Accounts KPI |

`accountsReportConfig.js` holds the **layout grouping only** (which KPI ids appear where); the engine
remains the single source of every value and formula. Filtering lives in the always-visible
`ReportFilterBar` (date-range preset, granularity, search) at the top of the page.

### 1.5 Navigation, access & permissions (reused wiring)

| File | Change |
|---|---|
| `src/config/navigation.js` | Added an **Accounts Reports** link (`/reports/accounts`) to the existing flag-gated Reports section, beside Workshop and Parts. Visible roles are *derived from the canonical `ROLE_DEPARTMENT_MAP`* (accounts + management) **unioned with `EXECUTIVE_ROLES`** — never hardcoded. Workshop/Parts links unchanged. |
| `src/config/routeAccess.js` | **No change** — `/reports` is already a `PROTECTED_PREFIXES` entry (Phase 6); `/reports/accounts` inherits it. |
| `src/pages/reports/accounts.js` | Wraps in `ProtectedRoute` with the same accounts/management/executive role-derived set. |

The `reporting_nav_enabled` flag was already ON (Phase 6) — Phase 8 added no flag changes. **All data
permissions remain server-side**: `withReportingAuth` → `permissionScope` (department/scope) + per-KPI
permission gate.

**Financial tightening vs the operational packages:** the page/nav visible set is **Accounts +
Management + Executive only** — it deliberately **excludes the general `admin` department** (reception/
admin) that the Workshop and Parts pages include, because financial reporting is the highest-sensitivity
tier and should not even be *navigable* by non-financial roles. The API per-KPI `FINANCIAL_SENSITIVE_ROLES`
gate is the true guarantee regardless; the page gate is defence-in-depth.

### 1.6 Audit

Report **view** and **export** are audited by the existing framework with **zero new code**:
`auditReportAccess` (gated by `reporting_access_audit_enabled`, **ON**) writes a hash-chained
`audit_log` row (`report.view` / `report.export`) and mirrors a `REPORT_VIEWED` / `REPORT_EXPORTED`
event on every `/api/reports/{kpi,drilldown,export}` call the Accounts UI makes. Because every Accounts
KPI is financial, **every Accounts report access and CSV export of financial data is logged** — the
exact "who viewed/exported what" control the architecture (§9.12/§9.13) requires for sensitive data.

---

## 2. Accounts KPIs Implemented (operational now)

"Operational" = has a resolver, computes trust-correctly today (live), and is wired into the UI with the
financial permission gate, drill-down (where defined) and provenance.

| KPI | Tier | Formula (from KPI Catalogue §12) | Notes |
|---|---|---|---|
| `acc.revenue` | executive | Σ invoices.grand_total (invoiced in period) | Exact paginated sum; `count` carries invoice volume. Drill-down (invoices in period). |
| `acc.labour_revenue` | tactical | Σ invoices.labour_total | Paginated sum. Cross-checks `wsh.labour_sales`. Drill-down. |
| `acc.parts_revenue` | tactical | Σ invoices.parts_total | Paginated sum. Cross-checks `prt.revenue`. Drill-down. |
| `acc.outstanding_invoices` | operational | COUNT/Σ(invoices where payment_status in {Sent, Overdue}) | Point-in-time; count **and** value (`amountGbp`). Drill-down. |
| `acc.ar` | tactical | Σ unpaid invoice balances = Σ issued grand_total − Σ invoice_payments.amount | Net receivable; partial payments netted via `invoice_payments`. Point-in-time. Drill-down (unpaid invoices). |
| `acc.payments_received` | operational | Σ invoice_payments.amount in period | Paginated sum + payment count. Drill-down (payments). |
| `acc.account_balances` | operational | accounts.balance (point-in-time) | Σ active-account balance; informational. Drill-down (accounts with balance). |
| `acc.credit_exposure` | tactical | Σ(account balance); COUNT(accounts ≥80% of credit_limit) | Σ exposure (exact); at-risk count over the small active-accounts set. Drill-down. |

**8 Accounts KPIs operational.** Every brief concept maps onto a catalogue KPI (no invented metric):

| Brief concept | Catalogue KPI(s) |
|---|---|
| Revenue | `acc.revenue` |
| Labour revenue | `acc.labour_revenue` |
| Parts revenue | `acc.parts_revenue` |
| Outstanding invoices | `acc.outstanding_invoices` |
| Invoice volume | `acc.outstanding_invoices` (open pipeline) + `acc.revenue` `count` (invoices raised in period) |
| Revenue monitoring / Revenue trends | `acc.revenue` (daily/weekly/monthly trend) |
| Accounts receivable | `acc.ar` |
| Payments received / Payment trends | `acc.payments_received` (value + daily/weekly/monthly trend) |
| Account balances | `acc.account_balances` |
| Credit exposure | `acc.credit_exposure` |
| Financial activity | `acc.payments_received` + `acc.outstanding_invoices` + `acc.account_balances` + `acc.credit_exposure` (the financial-operations group) |
| Invoice processing | `acc.outstanding_invoices` (live) + declared `acc.dso` / `acc.invoice_ageing` / `acc.payment_conversion` |

> **"Invoice volume" and "Financial activity" are not separate catalogue KPIs** — per the discipline
> (use only catalogue definitions, invent nothing), they are presented through the count/value facets of
> existing catalogue KPIs, exactly as the Parts package mapped "Parts pipeline" onto `prt.open_by_status`.

---

## 3. Accounts KPIs Still Blocked (declared, no resolver yet)

Registered in the catalogue (so they appear in the UI / `/api/reports/catalog` with their exact blocker)
but intentionally **no resolver** — the engine reports them as "declared, readiness Rn". They light up in
a later phase once the prerequisite lands. **All remain financial-gated.**

| KPI | Tier | Readiness | Blocker |
|---|---|---|---|
| `acc.dso` | strategic | R2 | No `paid_at` today (only a `paid` bool + current `payment_status`); issue→payment latency needs `invoice_status_history`. |
| `acc.invoice_ageing` | tactical | R2 | Trustworthy ageing-by-transition (+ `ar_ageing_snapshot`) needs `invoice_status_history`. |
| `acc.payment_conversion` | tactical | R2 | Sent→Paid transition numerator/denominator needs `invoice_status_history`. |
| `acc.profitability` | strategic | R2 | Per-department revenue − cost needs the department dimension stamped on revenue events + cost inputs. |
| `acc.gross_profit` | executive | R3 | No COGS on invoice snapshots — needs cost on invoice lines (profitability modelling). |
| `acc.net_profit` | executive | R3 | Depends on GP (R3) + an operating-cost (opex) model — likely an accounting-system integration (additional financial entities). |

---

## 4. Remaining R2 / R3 Blockers

### 4.1 R2 — need applied SQL + accrued history + the department dimension
- **Invoice status-history accrual** (apply `003_status_history.sql`, flip `reporting_emit_enabled`,
  schedule crons) → unblocks `acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion`. `invoice` is
  **P4 priority 3** in the status-history rollout (`entities.js`), after parts and VHC item.
- **Department dimension on revenue events** (D3 — `users.department` constrained to `dim_department`,
  department stamped on invoice/revenue events) → unblocks `acc.profitability` (per-department revenue −
  cost). Labour/parts gross profit is available department-side; full GP needs COGS (R3).
- **No snapshots yet** (aggregation cron unscheduled) → point values and trends are served by labelled
  **live fallback**, not snapshots. Correct, but recomputed per request. Once `004_kpi_snapshots.sql` is
  applied and the daily cron runs, point values and trends switch to the snapshot fast-path
  automatically — **no UI change**. An `ar_ageing_snapshot` would then back `acc.invoice_ageing`.

### 4.2 R3 — need missing financial inputs / new modelling
- **COGS on invoice lines** (cost on `invoice_items`) → `acc.gross_profit` (and the executive
  `mgt.company_profitability`). Requires **profitability modelling**.
- **Operating-cost (opex) model / accounting-system integration** → `acc.net_profit`. Requires
  **additional financial entities** — slots into the event spine as an `actor_kind='integration'` feed
  (Catalogue §15.4) with no architecture change.

---

## 5. Data-Quality Observations

- **Trust-by-construction holds.** No `.limit()` total, no overlapping `ILIKE`, no fuzzy inference
  anywhere in the package. Counts are `head:true,count:'exact'`; value sums use the paginated
  `sumColumn`; the outstanding-invoice count/value is exact and full.
- **`acc.ar` nets payments across the book (D12 caveat).** Net receivable = `Σ issued (non-Draft)
  grand_total − Σ invoice_payments.amount`. This nets partial payments via the payment ledger (the
  catalogue's stated R1 path). Two risks are flagged, not silent: (a) the 7 denormalised invoice totals
  can disagree with line items (D12) — recompute-from-lines is the future refinement; (b) any invoice
  marked paid **without** a corresponding `invoice_payments` row would overstate AR. A precise
  per-invoice, as-of-date balance arrives with `invoice_status_history` (R2).
- **`acc.outstanding_invoices`, `acc.ar`, `acc.account_balances`, `acc.credit_exposure` are
  point-in-time** — they intentionally **ignore the date-range filter** (they are "as of now"), the
  exact analogue of the Parts package's `prt.stock_value`. They are shown as card values + drill-downs,
  never trended (a trend would be a flat line). Flow KPIs (`acc.revenue`, labour/parts revenue,
  `acc.payments_received`) honour the date range and are trended daily/weekly/monthly.
- **`accounts.balance` is denormalised (D12).** `acc.account_balances` reads it directly; reconciliation
  against `account_transactions` is the documented future refinement.
- **Free-text `payment_status` (R3 data-quality).** `Sent`/`Overdue` are matched case-insensitively via
  an explicit value list (both spellings), pending the CHECK-constraint normalisation in a later phase.
- **Revenue cross-checks are deliberate, not duplicate formulas.** `acc.labour_revenue` /
  `acc.parts_revenue` are the *invoiced* money; `wsh.labour_sales` / `prt.revenue` are the
  Workshop/Parts estimates. Divergence is a data-quality signal surfaced via `relatedReports`, not a
  second calculation.
- **Department attribution rides on role (D3).** As Phases 5–7 — the free-text `users.department` column
  is not yet constrained to `dim_department`; Accounts attribution is resolved from role.

---

## 6. Reporting Performance Observations

- **One round-trip per scorecard.** The scorecard strip requests all its KPIs in a single
  `/api/reports/kpi?ids=…` call; the engine resolves them concurrently. Trend and drill-down are lazy
  (only the open panel/section fetches).
- **Live-fallback cost.** With no snapshots applied yet, every value is a **live recompute** against
  operational tables (labelled `live` in provenance). Counts are exact (cheap); value sums paginate
  `invoices` / `invoice_payments` / `accounts` in 1,000-row pages with the `MAX_SUM_ROWS` guard, so a
  large invoice book is summed in full, never truncated, and warns rather than silently capping. Once
  `004_kpi_snapshots.sql` is applied and the daily cron runs, point values and trends switch to the
  snapshot fast-path automatically — **no UI change**.
- **`acc.credit_exposure` at-risk count** iterates the active-accounts set (a small dimension table)
  bounded at 1,000 rows to compute the balance-vs-credit_limit comparison PostgREST cannot express as a
  single count; the £ exposure itself is an exact paginated `sumColumn`. The bound is documented in the
  KPI's `futureNotes`.
- **Trend rendering is scoped to flow/currency KPIs** (`acc.revenue`, `acc.payments_received`) where the
  engine's per-bucket recompute is correct. Point-in-time balances are shown as card values /
  distributions, not mis-scaled lines — a UI choice, not a data change. The short-TTL reporting cache
  (`withReportingCache`, keyed by kpi+filter+scope) absorbs repeat views.

---

## 7. Permission & Security Observations

- **Highest permission tier applied throughout.** Every `acc.*` KPI carries
  `permission = FINANCIAL_SENSITIVE_ROLES` (Accounts + Accounts Manager + executives: Owner, Admin
  Manager, General Manager, After Sales/Sales/Buying Directors). The engine's per-KPI gate refuses these
  KPIs to any other role — a technician, parts operator or general admin gets `null` + a "not permitted"
  warning, never a figure. Confirmed by the activation test (a tech is refused `acc.revenue`; Accounts
  is allowed).
- **Defence-in-depth at the page.** The `/reports/accounts` page and its sidebar link are gated to
  Accounts + Management + Executive roles only — the general `admin` department (included by the
  Workshop/Parts pages) is **deliberately excluded** so financial reports are not even navigable by
  non-financial roles. Server-side enforcement remains the source of truth (the page gate cannot leak
  data the API would refuse).
- **Scope still applies.** `permissionScope` confines an operational Accounts user to the accounts
  department; executives see all. Financial sensitivity is **orthogonal** to department level — it gates
  the £ columns regardless of scope, exactly as the architecture (§14.1) specifies.
- **Every access and export is audited.** Because all Accounts KPIs are financial, every report view and
  CSV export of financial data writes a hash-chained `audit_log` row and a `REPORT_VIEWED` /
  `REPORT_EXPORTED` event — the complete sensitive-data access trail.
- **Identity is the NextAuth session** (ADR-8) — the `getUserFromRequest` stub is excluded from
  reporting attribution.

---

## 8. Recommended Next Phase

**Phase 9 — Capture go-live for Accounts, then the next package.** In order:

1. **Apply the SQL** (`000_all_reporting.sql`), run `seedDepartments()`, flip `reporting_emit_enabled`
   ON, and **schedule the aggregation crons** — this starts `invoice_status_history` accruing (P4
   priority 3) and turns on snapshots (fast-path + trends), unblocking the R2 Accounts tiers
   (`acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion`) with no UI change.
2. **Constrain `users.department` to `dim_department` (D3)** and stamp the department on invoice/revenue
   events → unblocks `acc.profitability` (per-department revenue − cost).
3. **Model COGS on invoice lines** (cost on `invoice_items`) → `acc.gross_profit` and the executive
   `mgt.company_profitability`; then an **opex model / accounting integration** → `acc.net_profit`.
4. **Build the next department package** on the now thrice-proven shared components — **Service
   Advisors** is the natural follow-on (R1 appointment/VHC-conversion metrics), reusing
   `src/components/reporting/*`, `src/hooks/reporting/*` and the engine unchanged. The **Management /
   executive** dashboard (cross-department revenue/margin, `mgt.*`) composes once Accounts +
   Workshop + Parts revenue/profit feeds and the department dimension are live.

After the SQL/crons land, the declared Accounts R2 metrics become computable by adding resolvers to the
existing catalogue entries — **no UI or architectural change required**, exactly as the foundation
intended.

---

## 9. Status at Completion — operational now vs dependent on future phases

**Operational now (live, trustworthy, financial-gated, in the Accounts UI):**
`acc.revenue`, `acc.labour_revenue`, `acc.parts_revenue`, `acc.outstanding_invoices`, `acc.ar`
*(net-of-payments, D12 caveat)*, `acc.payments_received`, `acc.account_balances`, `acc.credit_exposure`.

**Which Accounts KPIs are operational now:** the 8 R1 metrics above — revenue (total/labour/parts),
outstanding invoices, accounts receivable, payments received, account balances and credit exposure, with
revenue and payment trends across daily/weekly/monthly.

**Which Accounts KPIs are dependent on future reporting phases:**

| Requirement | Accounts KPIs waiting on it |
|---|---|
| **Status-history accrual** (`invoice_status_history`, P4 priority 3) | `acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion` (R2). |
| **Profitability modelling** (department dimension on revenue + cost inputs; COGS on invoice lines) | `acc.profitability` (R2, labour/parts GP), `acc.gross_profit` (R3, needs COGS). |
| **Additional financial entities** (opex model / accounting-system integration) | `acc.net_profit` (R3). |

**Which Accounts KPIs require status-history accrual:** `acc.dso`, `acc.invoice_ageing`,
`acc.payment_conversion` (all need `invoice_status_history` for issue→payment / Sent→Paid transitions —
there is no `paid_at` today, only a `paid` bool + current `payment_status`).

**Which Accounts KPIs require profitability modelling:** `acc.profitability` (per-department revenue −
cost) and `acc.gross_profit` (revenue − COGS, needs cost on invoice lines).

**Which Accounts KPIs require additional financial entities:** `acc.net_profit` (needs an operating-cost
model, likely an accounting-system integration) — and, transitively, the executive
`mgt.company_profitability` / `mgt.cost_to_serve` that compose Accounts profitability.

---

## 10. How to Re-run the Validation

```bash
npm run validate:reporting     # 36 runtime contract checks (green; every R1 KPI — now incl. Accounts — has a resolver)
npm run check:report-events    # emit-name validity + emit-coverage advisories
npm run check:borders          # layer/border law (pre-existing staffglobal.css debt aside)
```

The Accounts package added **no** new failing checks: `validate:reporting` is **36/36** (every Accounts
R1 KPI has a resolver; every `sourceEvent` is a real catalogue event — `INVOICE_CREATED`,
`INVOICE_ISSUED`, `INVOICE_STATUS_CHANGED`, `PAYMENT_RECEIVED`, `INVOICE_PAID`, `TRANSACTION_POSTED`,
`CREDIT_LIMIT_CHANGED`; every declared `sourceHistory` — `invoice_status_history` — is a real registered
entity history table; the financial gate refuses a technician and admits Accounts).
`check:report-events` still passes with the single pre-existing `jobClocking.js` advisory, and the new UI
introduces **no** border-law violations (surfaces use `LayerSurface`/`LayerTheme`; the only borders are
ghost-button rings via `--ghostbutton-ring`). ESLint over all new files: **0 errors, 0 warnings**.

---

*End of Phase 8. The Accounts report package is live on the shared reporting platform — the third fully
integrated package after Workshop and Parts, and the first financial one. No Management, MOT, Valeting or
Paint reports were built; Workshop and Parts reporting were unchanged, and no shared-infrastructure
extension was required. 8 Accounts KPIs are operational; 6 remain declared and dependent on the
documented R2/R3 prerequisites (invoice status-history, profitability modelling, additional financial
entities).*
