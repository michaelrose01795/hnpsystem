# HNPSystem — KPI Catalogue & Metric Definition Architecture (Phase 3 Design)

> **Status:** Design only. No code, migrations, report pages, or database changes have been created.
> **Document type:** The **KPI bible** — the master, unambiguous definition of every KPI, metric, calculation, target, benchmark, scorecard, trend and management measurement in the H&P DMS.
> **Audience:** Future implementation phases and future AI/engineering sessions. When any phase builds a metric, it implements the definition here verbatim — no metric is invented or recalculated elsewhere.
> **Mandatory inputs (companion documents, same folder):**
> - [`reporting-readiness-audit.md`](reporting-readiness-audit.md) — what data exists.
> - [`reporting-platform-architecture.md`](reporting-platform-architecture.md) — Phase 1 read-side platform (engine, KPI catalog concept, permission model).
> - [`reporting-data-collection-architecture.md`](reporting-data-collection-architecture.md) — Phase 2 capture-side (event spine, status-history, dimensions, snapshots).

---

## 0. How to use this document — the KPI Definition Standard

Every KPI in §5–§14 is one catalog entry. To keep the document exhaustive yet readable, the **22 required fields default as below**; each KPI block states only the fields that are distinctive or that override a default.

### 0.1 Required fields (per Phase-3 brief) and their defaults
| Field | Default (unless the KPI overrides) |
|---|---|
| **KPI name** | (stated per KPI) |
| **KPI ID** | `<dept>.<snake_name>` — dept prefixes: `wsh, prt, svc, vhc, mot, val, pnt, acc, adm, mgt` |
| **Department owner** | the section's department |
| **Related departments** | none unless stated |
| **Description** | (stated per KPI) |
| **Business purpose** | (stated per KPI) |
| **Formula** | (stated per KPI) |
| **Numerator / Denominator** | stated for ratio KPIs; count/value KPIs have no denominator |
| **Source tables** | (stated) — names verified against the audit |
| **Source events** | the `report_event` names from Phase 2 §4 that produce/feed the metric |
| **Source status histories** | the `*_status_history` table(s) from Phase 2 §6, where the metric needs transitions |
| **Snapshot source** | `kpi_daily_snapshot` (then weekly/monthly/quarterly/yearly rollups) unless point-in-time, where the entity-state snapshot is named |
| **Calculation frequency** | **Daily** snapshot at off-peak cron; live-fallback for "today" panels |
| **Aggregation method** | per Phase 2 §9.4: flow=sum; ratio=Σnum÷Σden; backlog=point-in-time; duration=Σdur÷count |
| **Trend method** | daily→weekly→monthly→quarterly→yearly rollup; default viz = line (count/value), gauge (ratio vs target) |
| **Target type** | one of: *Higher-is-better*, *Lower-is-better*, *Band* (target range), *Informational* (no target) |
| **Example calculation** | (stated per KPI) |
| **Required permissions** | owner-department managers + Management (Phase 1 §14). Financial/PII KPIs add the sensitive gate. Operational staff see own-scope only. |
| **Drill-down source** | the contributing records query (`/api/reports/drilldown`) returning the rows that sum to the value, linked to the source entity. Default drill = "the records behind the number." |
| **Related reports** | (stated where notable) |
| **Future expansion notes** | (stated where relevant) |

### 0.2 Classification (every KPI is tagged)
- **OPERATIONAL** — today/now, single team, drives immediate action (e.g. jobs in progress).
- **TACTICAL** — this week/month, department manager steering (e.g. labour recovery, fill rate).
- **STRATEGIC** — quarter/year, cross-department direction (e.g. department profitability).
- **EXECUTIVE** — company-wide board view (e.g. revenue/margin by department, capacity utilisation).

### 0.3 Readiness (every KPI is tagged) — drives §16
- **R1 — Implementable now:** all sources exist today (operational tables / existing `job_status_history` / `audit_log`).
- **R2 — Blocked by missing history/events:** needs the Phase 2 event spine + a `*_status_history` table (data exists but transitions aren't captured yet).
- **R3 — Blocked by missing entities/integrations:** needs a net-new entity (`mot_tests`, paint stage model, `wash_completed_at`, `warranty_claims`, `suppliers`) or an external feed.

### 0.4 Reading a KPI block
```
KPI — <name>  ·  ID `dept.x`  ·  CLASS  ·  READINESS
Formula: …  (Num / Den where ratio)
Sources: tables=… ; events=… ; history=… ; snapshot=…
Target: <type> ; Example: … ; Drill: … ; Notes: …
```
Fields not shown take the §0.1 defaults.

---

## 1. Executive Summary

This catalogue defines **~110 KPIs across ten domains** (Workshop, Parts, Service Advisors, VHC, MOT, Valeting, Paint, Accounts, Admin, Management) so that no metric is ever ambiguous at implementation time. Each KPI has a single canonical formula, explicit numerator/denominator, named sources (tables, events, status-histories, snapshots), an aggregation rule, a target type, a worked example, a permission set, a drill-down, and a readiness tag.

Three facts shape the catalogue:
1. **Trust first.** ~38 KPIs are **R1** — buildable now from existing data — but several existing dashboard numbers are *wrong today* (`.limit(40)` truncation, overlapping MOT `ILIKE`, Service RAG default-amber). R1 work is as much "fix the number" as "add the metric."
2. **History unlocks the majority.** ~45 KPIs are **R2** — they become possible only once the Phase 2 event spine + per-entity `*_status_history` tables exist (cycle-time, dwell-time, SLA, conversion-latency, recovery rate). These are the highest-value management metrics.
3. **A minority need new entities.** ~27 KPIs are **R3** — blocked on `mot_tests`, a paint stage model, `wash_completed_at`, deployed `warranty_claims`, or a `suppliers` master. These are scheduled so a department's headline KPI is never promised before its data exists.

The catalogue also fixes the standards every metric obeys: dashboard card layout, trend rendering, benchmark/target/traffic-light/ranking rules, scorecard composition, and forecasting readiness. A KPI hierarchy (§4) shows which metrics are **source** (captured directly) and which are **derived** (computed from others), so the build order respects dependencies — you cannot show "labour recovery" before both "sold hours" and "clocked hours" exist.

**Phase 3 produces definitions only. Implementation begins after the Phase 2 prerequisites (`dim_department`, `dim_actor`, status normalisation) land.**

---

## 2. KPI Classification Framework

| Tier | Horizon | Audience | Cadence shown | Examples |
|---|---|---|---|---|
| **Operational** | Now / today | Team + team lead | Live / short-TTL | Jobs in progress, cars waiting wash, open parts by status |
| **Tactical** | Week / month | Department manager | Daily snapshot + WoW/MoM | Technician efficiency, fill rate, VHC conversion, DSO |
| **Strategic** | Quarter / year | Senior management | Monthly/quarterly rollup | Department profitability, capacity utilisation, stock turn |
| **Executive** | Year / multi-year | Owner / directors | Quarterly/yearly + forecast | Revenue & margin by department, growth, cost-to-serve |

A KPI's tier governs default permission breadth, default trend granularity, and which scorecard (§3.1) it appears on. Some KPIs appear at two tiers (e.g. "jobs completed" is operational daily and tactical as a weekly trend) — the catalogue tags the **primary** tier; secondary appearances are noted.

---

## 3. KPI Standards

### 3.1 Scorecard standard
A **scorecard** = a fixed-layout set of KPIs for one audience, composed from the catalog (never hand-coded).
- **Operational scorecard** (per department): 4–8 operational KPIs as live `SummaryCard`s + 1–2 queues.
- **Management scorecard** (per department): 6–10 tactical KPIs with target gauges + trend sparklines + a ranking table.
- **Executive scorecard** (Management): one strategic/executive KPI per department + 3–5 company composites + period-over-period.
- Each scorecard card carries: value, delta vs compare period, target/traffic-light, sparkline, and a drill affordance. Scorecards are saveable views (Phase 1 §10).

### 3.2 Dashboard card standard (`SummaryCard`)
Every KPI card renders the same anatomy (on `LayerSurface`/`LayerTheme`, existing tokens only):
```
┌───────────────────────────────┐
│ LABEL                    ⓘ prov│   ⓘ = provenance tooltip (source, as-of, formula_version)
│ 1,234        ▲ 12% vs LW       │   headline value + delta vs compare period
│ ▁▂▃▅▆▇  (sparkline)            │   inline trend
│ ● on target   ⇲ drill          │   traffic-light + drill affordance
└───────────────────────────────┘
```
- Value formatting from the KPI's `format` (£, %, count, h:mm).
- Delta colouring follows **target direction**, not raw sign (a fall in a lower-is-better KPI is green).
- No card invents a number — it reads exactly one `kpi_id`.

### 3.3 Trend standard
- Default granularity by tier: operational=daily(14d), tactical=weekly(13w), strategic=monthly(12m), executive=monthly/quarterly(8q).
- **Ratio KPIs trend the recombined ratio** (Σnum÷Σden per bucket), never an average of daily ratios.
- **Backlog KPIs trend point-in-time** snapshots (not summed).
- Compare-to overlay (prev period / prev year) optional per card.
- Trend reads the **coarsest sufficient rollup** (Phase 2 §10.3).

### 3.4 Benchmark standard
Each KPI may carry up to three benchmarks: **internal historical** (trailing-12-month median), **internal peer** (best/median performer in the same role/department), and **external/industry** (manually configured, e.g. franchise-standard MOT pass rate, target labour recovery %). Benchmarks are *informational reference lines* on trends; they never override the configured target.

### 3.5 Target standard
- Targets live in a `dim_kpi`/target model (`TARGET_SET`/`TARGET_CHANGED` events, audited — Phase 2 §4.10).
- Target scope: company / department / team / individual (most specific wins).
- Target types per §0.1; targets are **versioned** (period-stamped) so attainment history is explainable.
- Default targets seeded from existing config where present: `tech_efficiency_targets.monthly_target_hours` (160 default, weight 0.75), `users.contracted_hours`.

### 3.6 Traffic-light standard
Three states from target + thresholds:
- **Green** — at/above target (higher-is-better) or at/below (lower-is-better) within tolerance.
- **Amber** — within a configurable warning band (default ±10% of target).
- **Red** — beyond the warning band on the wrong side.
- *Band* targets: green inside the band, amber within ±1 band-width, red outside.
- *Informational* KPIs render neutral (no light). Thresholds are per-KPI overridable; defaults documented in `dim_kpi`.

### 3.7 Ranking standard
- Rankings (technician, advisor, tester, painter, valeter, supplier) use a **single declared KPI** as the sort key + a small fixed set of context columns.
- Fairness rules: normalise by exposure (per-available-hour, per-job) where raw counts would mislead; require a minimum sample (e.g. ≥5 jobs) before ranking; show "insufficient data" otherwise.
- Rankings are drill-downs of a department KPI, never a standalone unaudited leaderboard; per-person detail is permission-gated.

### 3.8 Forecasting readiness standard
A KPI is **forecast-ready** when it has ≥13 months of daily snapshots (captures weekly + seasonal cycles), a stable `formula_version`, and a clean trend (no large unexplained gaps). Forecasting is **out of scope to compute** in this phase, but the snapshot design (Phase 2 §9) guarantees the *inputs* exist. Each KPI is tagged forecast-ready=Yes/No-yet in its notes; backlog/flow KPIs with daily history are the first candidates.

---

## 4. KPI Hierarchy (source vs derived)

### 4.1 Source metrics (captured directly from events/history/base)
These are measured, not computed from other KPIs:
- **Hours:** sold hours (`job_requests.hours`), clocked hours (`job_clocking`/`time_records`), available hours (capacity model — R3).
- **Counts:** jobs created/completed/released, parts requested/ordered/received/fitted, VHC items by RAG, appointments booked, MOTs done, washes done, invoices raised/paid, logins.
- **Values:** authorised £, declined £, parts cost/price, invoice totals, payments.
- **Durations:** per-status dwell times (from `*_status_history`), cycle-times (milestone deltas).

### 4.2 Derived metrics (computed from source/other KPIs)
```
sold_hours ─┐
clocked_hours ─┼─> labour_recovery (=sold÷clocked)
available_hours ─┴─> utilisation (=clocked÷available) ─┐
clocked_hours / sold_hours ─> efficiency (=sold÷clocked, target-weighted) ─┤
labour_revenue = sold_hours × labour_rate ────────────────────────────────┤
parts_revenue, parts_cost ─> parts_margin ────────────────────────────────┼─> department_profitability
labour_revenue, labour_cost(=clocked×rate) ─> labour_gross_profit ─────────┘            │
VHC: authorised£ / (authorised£+declined£) ─> vhc_conversion_value ───────> upsell_contribution_to_revenue
appointments, jobs_created ─> appointment_conversion                                    │
all department_profitability ─────────────────────────────────────────────> company_gross_profit (EXECUTIVE)
throughput + cycle_time + capacity ───────────────────────────────────────> bottleneck_detection (MGT)
```
**Build rule:** a derived KPI cannot be implemented before all its source KPIs exist. §16's order respects this graph (e.g. recovery after both hour sources; profitability after revenue + cost; executive composites last).

### 4.3 Feed table (selected — full graph in each KPI's "Sources")
| Derived KPI | Fed by |
|---|---|
| `wsh.labour_recovery` | `wsh.sold_hours`, `wsh.clocked_hours` |
| `wsh.utilisation` | `wsh.clocked_hours`, `wsh.available_hours` (R3) |
| `wsh.workshop_profitability` | `acc.labour_revenue`, labour cost, `prt.parts_margin` |
| `vhc.upsell_revenue` | `vhc.authorised_value`, `vhc.conversion_rate` |
| `acc.gross_profit` | `acc.revenue`, COGS (R3) |
| `mgt.company_revenue` | `acc.revenue` by department |
| `mgt.bottleneck` | per-stage `*.cycle_time` + backlog snapshots |

---

## 5. Workshop KPI Catalogue (`wsh.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| wsh.sold_hours | Sold Hours | TACTICAL | R1 |
| wsh.clocked_hours | Clocked Hours | OPERATIONAL | R1 |
| wsh.tech_efficiency | Technician Efficiency | TACTICAL | R1* |
| wsh.tech_productivity | Technician Productivity | TACTICAL | R2 |
| wsh.utilisation | Technician/Ramp Utilisation | TACTICAL | R3 |
| wsh.labour_recovery | Labour Recovery Rate | TACTICAL | R2 |
| wsh.labour_sales | Labour Sales (£) | TACTICAL | R1 |
| wsh.jobs_completed | Jobs Completed | OPERATIONAL | R1 |
| wsh.jobs_per_tech | Jobs per Technician | TACTICAL | R1 |
| wsh.jobs_per_day | Jobs per Day | OPERATIONAL | R1 |
| wsh.throughput | Workshop Throughput | TACTICAL | R1 |
| wsh.cycle_time | Workshop Cycle Time | TACTICAL | R2 |
| wsh.stage_dwell | Time-in-Stage | TACTICAL | R2 |
| wsh.rework_rate | Rework / Comeback Rate | STRATEGIC | R3 |
| wsh.wait_parts | Waiting-for-Parts Time | TACTICAL | R2 |
| wsh.wait_customer | Waiting-for-Customer Time | TACTICAL | R2 |
| wsh.wait_auth | Waiting-for-Authorisation Time | TACTICAL | R2 |
| wsh.capacity | Capacity (available hours) | STRATEGIC | R3 |
| wsh.ramp_utilisation | Ramp/Bay Utilisation | TACTICAL | R3 |
| wsh.mobile_activity | Mobile Technician Activity | TACTICAL | R1 |
| wsh.tech_ranking | Technician Ranking | TACTICAL | R1* |
| wsh.team_performance | Team Performance | STRATEGIC | R2 |
| wsh.profitability | Workshop Profitability | STRATEGIC | R2 |
| wsh.additional_work_recovery | Additional-Work Recovery | TACTICAL | R2 |

*\*R1 today using `tech_efficiency_entries`/`job_clocking`, but allocated-hours reliability improves at R2 (auto-pull sold hours).*

**Definitions**

**KPI — Sold Hours · `wsh.sold_hours` · TACTICAL · R1**
Description: total labour hours sold (estimated/authorised) over the period. Purpose: the revenue/productivity denominator; the basis of recovery & profitability.
Formula: `Σ job_requests.hours (+ Σ authorised vhc_checks.labour_hours)`. No denominator (source metric).
Sources: tables=`job_requests`,`vhc_checks`,`jobs`; events=`JOB_CREATED`,`VHC_AUTHORISED`; history=–; snapshot=`kpi_daily_snapshot`.
Target: Higher-is-better. Example: 12 jobs × avg 2.1h + 8 authorised VHC items × 0.6h = 25.2 + 4.8 = **30.0 sold h/day**. Drill: jobs/requests contributing. Notes: feeds `wsh.labour_recovery`, `wsh.labour_sales`, `wsh.profitability`. (`nextjobs.estimateJobHours` already computes this shape.)

**KPI — Clocked Hours · `wsh.clocked_hours` · OPERATIONAL · R1**
Description: actual labour hours clocked by technicians. Purpose: real labour cost & utilisation base.
Formula: `Σ (clock_out − clock_in − breaks)` over `job_clocking`/`time_records`. Aggregation: duration-sum.
Sources: tables=`job_clocking`,`time_records`; events=`CLOCK_ON`,`CLOCK_OFF`; history=–; snapshot=daily.
Target: Informational (compared against sold/available). Example: 6 techs × ~7.5 clocked h = **45 h/day**. Notes: reconcile clocking sources (debt D5) before trusting; breaks handled inconsistently today.

**KPI — Technician Efficiency · `wsh.tech_efficiency` · TACTICAL · R1\***
Description: sold (allocated) hours ÷ actual clocked hours, per technician and team. Purpose: core workshop productivity measure.
Formula: `Σ allocated_hours ÷ Σ actual_hours × 100`. Num=allocated/sold h; Den=clocked h.
Sources: tables=`tech_efficiency_entries`,`tech_efficiency_targets`,`job_clocking`,`overtime_sessions`; events=`CLOCK_OFF`,`JOB_COMPLETED`; snapshot=daily per `actor_user_id`.
Target: Band (target ~100%+, e.g. 110% stretch). Example: allocated 33h ÷ actual 30h = **110%**. Permissions: per-tech detail = Workshop Manager+; tech sees own. Drill: tech→jobs→clock entries. Notes: `efficiency.js` already implements this (`efficiencyPct`); R2 upgrade auto-pulls allocated from `job_requests.hours` instead of manual entry.

**KPI — Technician Productivity · `wsh.tech_productivity` · TACTICAL · R2**
Description: clocked (productive) hours ÷ attended hours. Purpose: distinguishes "busy on jobs" from "present."
Formula: `Σ job_clocking hours ÷ Σ time_records attended hours × 100`. Num=job-clocked h; Den=attended h.
Sources: tables=`job_clocking`,`time_records`; events=`CLOCK_ON/OFF`; snapshot=daily. Target: Higher-is-better. Example: 38 productive ÷ 45 attended = **84%**. Notes: requires the two clocking systems reconciled (D5); the gap = idle/non-productive time (`wsh` future idle KPI).

**KPI — Technician/Ramp Utilisation · `wsh.utilisation` · TACTICAL · R3**
Description: clocked hours ÷ available capacity hours. Purpose: how full the workshop is.
Formula: `Σ clocked_hours ÷ Σ available_hours × 100`. Den=`wsh.capacity`.
Sources: needs a **capacity/available-hours model** (R3). Target: Band (~85–95%). Example: 45 ÷ 52.5 = **86%**. Blocker: no capacity model exists (no ramp/bay/shift entity).

**KPI — Labour Recovery Rate · `wsh.labour_recovery` · TACTICAL · R2**
Description: sold hours recovered against hours worked. Purpose: the headline "are we charging for the time we spend" metric.
Formula: `Σ sold_hours ÷ Σ clocked_hours × 100`. Num=`wsh.sold_hours`; Den=`wsh.clocked_hours`.
Sources: tables=`job_requests`,`job_clocking`; events=`JOB_COMPLETED`,`CLOCK_OFF`; snapshot=daily. Target: Band (≥100%). Example: 30 sold ÷ 45 clocked = **67%**. Notes: both inputs exist today but are never joined (audit finding); R2 = build the join + snapshot. Feeds `wsh.profitability` & executive recovery.

**KPI — Labour Sales / Labour Sales £ · `wsh.labour_sales` · TACTICAL · R1**
Description: £ value of labour sold. Formula: `Σ sold_hours × labour_rate` (`company_settings.default_labour_rate`). Sources: tables=`job_requests`,`company_settings`,`invoices.labour_total`; events=`INVOICE_CREATED`. Target: Higher-is-better. Example: 30h × £95 = **£2,850/day**. Related: `acc.labour_revenue` (same money, Accounts-owned). Notes: cross-check sold-hours estimate vs invoiced `labour_total`.

**KPI — Jobs Completed · `wsh.jobs_completed` · OPERATIONAL · R1**
Formula: `COUNT(jobs where completed_at in period)`. Sources: tables=`jobs`; events=`JOB_COMPLETED`; history=`job_status_history`. Target: Higher-is-better. Example: **18 today**. Drill: the completed jobs. (Replaces the `.limit()`-truncated dashboard count.)

**KPI — Jobs per Technician · `wsh.jobs_per_tech` · TACTICAL · R1**
Formula: `COUNT(jobs completed) ÷ COUNT(active technicians)`. Num=completed jobs; Den=techs with ≥1 clock that day. Sources: `jobs`,`job_clocking`. Target: Higher-is-better. Example: 18 ÷ 6 = **3.0**. Ranking input (`wsh.tech_ranking`).

**KPI — Jobs per Day · `wsh.jobs_per_day` · OPERATIONAL · R1**
Formula: `COUNT(jobs completed) per day`, trended. Target: Higher-is-better. Example: 14-day mean **16.4/day**. Forecast-ready once 13m history accrues.

**KPI — Workshop Throughput · `wsh.throughput` · TACTICAL · R1**
Description: jobs released vs jobs created (flow balance). Formula: `COUNT(JOB released) vs COUNT(JOB created)`; net WIP change = created − released. Sources: `jobs`,`job_status_history`; events=`JOB_CREATED`,`JOB_STATUS_CHANGED(→released)`. Target: Band (released ≈ created). Example: 17 released vs 19 created → **WIP +2**. Feeds bottleneck detection.

**KPI — Workshop Cycle Time · `wsh.cycle_time` · TACTICAL · R2**
Description: elapsed time check-in→release. Formula: `mean/median(released_at − checked_in_at)`; aggregation=duration. Sources: tables=`jobs` milestones; history=`job_status_history`; events=`JOB_CHECKED_IN`,`JOB_STATUS_CHANGED`. Target: Lower-is-better. Example: median **1.8 days**. Notes: derivable today from milestones but robust time-in-stage needs the event spine; percentiles preferred over mean.

**KPI — Time-in-Stage · `wsh.stage_dwell` · TACTICAL · R2**
Description: dwell time in each main status. Formula: per transition, `next_changed_at − changed_at`, summed/averaged per status. Sources: history=`job_status_history`; events=`JOB_STATUS_CHANGED`. Target: Lower-is-better per stage. Example: avg in `in_progress` = **6.2h**. Drill: jobs breaching a stage target.

**KPI — Rework / Comeback Rate · `wsh.rework_rate` · STRATEGIC · R3**
Description: % jobs returning for the same fault / reopened for quality. Formula: `COUNT(rework jobs) ÷ COUNT(completed) × 100`. Blocker: **no rework/comeback flag** anywhere (R3 — needs a flag + reason on jobs). Interim proxy: `JOB_REOPENED` count (under-counts true comebacks). Target: Lower-is-better.

**KPI — Waiting-for-Parts Time · `wsh.wait_parts` · TACTICAL · R2**
Formula: dwell while job in a parts-waiting sub-state (`waiting_for_parts`→`parts_ready`). Sources: history=`job_status_history`+`parts_job_items_status_history`; events=`JOB_STATUS_CHANGED`,`PART_*`. Target: Lower-is-better. Example: avg **9.4h/affected job**. Notes: needs parts status-history (P4 priority 1).

**KPI — Waiting-for-Customer Time · `wsh.wait_customer` · TACTICAL · R2**
Formula: dwell between `VHC_SENT` and `VHC_AUTHORISED|DECLINED`. Sources: events=`VHC_SENT`,`VHC_AUTHORISED`,`VHC_DECLINED`; history=`vhc_item_status_history`. Target: Lower-is-better. Example: median **4.1h to decision**. Shared with Service (`svc.response_time`).

**KPI — Waiting-for-Authorisation Time · `wsh.wait_auth` · TACTICAL · R2**
Formula: dwell in `waiting_authorisation` (job or part). Sources: history=`job_status_history`,`parts_job_items_status_history`. Target: Lower-is-better.

**KPI — Capacity · `wsh.capacity` · STRATEGIC · R3**
Description: available productive hours (techs × shift × working days, less leave). Formula: `Σ technician available_hours`. Blocker: needs capacity model (shift/roster). Sources(planned): `users.contracted_hours`,`hr_absences`,roster(R3). Feeds utilisation & bottleneck.

**KPI — Ramp/Bay Utilisation · `wsh.ramp_utilisation` · TACTICAL · R3**
Description: ramp/bay occupied time ÷ available. Blocker: **no ramp/bay entity** (R3). Target: Band.

**KPI — Mobile Technician Activity · `wsh.mobile_activity` · TACTICAL · R1**
Description: mobile job volume + outcome split. Formula: `COUNT(jobs service_mode='mobile')` by `mobile_outcome`. Sources: `jobs` (`service_mode`,`mobile_outcome`,`mobile_completed_at`,`redirected_from_mobile_at`); events=`JOB_REDIRECTED_FROM_MOBILE`. Target: Informational + Lower-is-better on redirect rate. Example: 22 mobile, 3 redirected = **86% completed onsite**.

**KPI — Technician Ranking · `wsh.tech_ranking` · TACTICAL · R1\***
Description: technicians ranked by a chosen KPI (default efficiency). Standard: §3.7 (normalise per available hour, min 5 jobs). Sources: `tech_efficiency_*`,`job_clocking`,`jobs`. Permissions: manager+. Drill: per-tech detail.

**KPI — Team Performance · `wsh.team_performance` · STRATEGIC · R2**
Description: weighted team efficiency + throughput + cycle-time composite. Formula: weighted blend (`calculateOverallTotals` pattern). Target: Band. Notes: composite — define weights in `dim_kpi`.

**KPI — Workshop Profitability · `wsh.profitability` · STRATEGIC · R2**
Description: labour gross profit. Formula: `labour_revenue − labour_cost` where cost = `clocked_hours × loaded_rate`. Sources: `acc.labour_revenue`,`wsh.clocked_hours`,`users.hourly_rate`. Target: Higher-is-better. Example: £2,850 − (45h×£28) = **£1,590/day GP**. Feeds executive department profitability.

**KPI — Additional-Work Recovery · `wsh.additional_work_recovery` · TACTICAL · R2**
Description: % jobs where authorised VHC work was actually done. Formula: `COUNT(jobs with additional_work_started) ÷ COUNT(jobs with authorised VHC) × 100`. Sources: `jobs` (`additional_work_authorized_at`,`additional_work_started_at`,`tech_completion_status='authorised_items'`); events=`VHC_AUTHORISED`. Target: Higher-is-better.

---

## 6. Parts KPI Catalogue (`prt.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| prt.requests | Parts Requests | OPERATIONAL | R1 |
| prt.approved | Parts Approved | OPERATIONAL | R2 |
| prt.ordered | Parts Ordered | OPERATIONAL | R1 |
| prt.received | Parts Received | OPERATIONAL | R1 |
| prt.fitted | Parts Fitted | TACTICAL | R1 |
| prt.cancelled | Parts Cancelled | TACTICAL | R2 |
| prt.unavailable | Parts Unavailable | TACTICAL | R2 |
| prt.lead_time | Parts Lead Time | TACTICAL | R2 |
| prt.ageing | Parts Ageing / Dwell | TACTICAL | R2 |
| prt.stock_turn | Stock Turnover | STRATEGIC | R1 |
| prt.stock_value | Stock Value | STRATEGIC | R1 |
| prt.supplier_performance | Supplier Performance | STRATEGIC | R3 |
| prt.fill_rate | Fill Rate | TACTICAL | R3 |
| prt.pick_rate | Pick Rate | TACTICAL | R2 |
| prt.margin | Parts Margin | STRATEGIC | R1 |
| prt.revenue | Parts Revenue | TACTICAL | R1 |
| prt.profitability | Parts Profitability | STRATEGIC | R1 |
| prt.vhc_conversion | VHC→Parts Conversion | TACTICAL | R1 |
| prt.backorder_rate | Backorder Rate | TACTICAL | R2 |

**Definitions**

**KPI — Parts Requests · `prt.requests` · OPERATIONAL · R1**
Formula: `COUNT(part lines created)`. Sources: `parts_job_items`,`parts_requests`; events=`PART_REQUESTED`. Related: Workshop, VHC. Target: Informational. Example: **42/day**. Feeds `prt.vhc_conversion`.

**KPI — Parts Approved · `prt.approved` · OPERATIONAL · R2**
Formula: `COUNT(PART_APPROVED)`; ratio `approved ÷ requested`. Sources: events=`PART_APPROVED`; history=`parts_job_items_status_history`. Target: Informational. Notes: approval *latency* needs history (R2).

**KPI — Parts Ordered · `prt.ordered` · OPERATIONAL · R1**
Formula: `COUNT(status→on_order)` / Σ on-order value. Sources: `parts_job_items`,`parts_deliveries`; events=`PART_ORDERED`. Target: Informational. Example: 17 lines, **£1,240 on order**.

**KPI — Parts Received · `prt.received` · OPERATIONAL · R1**
Formula: `COUNT/Σqty received`. Sources: `parts_deliveries`,`parts_delivery_items`,`parts_stock_movements`; events=`PART_RECEIVED`,`STOCK_RECEIVED`. Target: Informational.

**KPI — Parts Fitted · `prt.fitted` · TACTICAL · R1**
Formula: `COUNT(status→fitted)` / Σ `quantity_fitted`. Sources: `parts_job_items`; events=`PART_FITTED`. Related: Workshop. Target: Higher-is-better. Drill: fitted lines→job.

**KPI — Parts Cancelled · `prt.cancelled` · TACTICAL · R2**
Formula: `COUNT(→cancelled|removed) ÷ COUNT(requested) × 100`. Sources: events=`PART_CANCELLED/REMOVED`; history=`parts_job_items_status_history`. Target: Lower-is-better. Notes: reason codes desirable (future).

**KPI — Parts Unavailable · `prt.unavailable` · TACTICAL · R2**
Formula: `COUNT(→unavailable) ÷ requested × 100`. Sources: events=`PART_UNAVAILABLE`; history. Target: Lower-is-better. Supplier fill signal.

**KPI — Parts Lead Time · `prt.lead_time` · TACTICAL · R2**
Description: ordered→received elapsed. Formula: `mean(received_at − ordered_at)` per line. Sources: history=`parts_job_items_status_history`; events=`PART_ORDERED`,`PART_RECEIVED`. Target: Lower-is-better. Example: median **1.4 days**. Notes: coarse today (no per-line `ordered_at`); precise at R2 via status-history; supplier-level precision needs `suppliers` (R3).

**KPI — Parts Ageing / Dwell · `prt.ageing` · TACTICAL · R2**
Description: how long open lines sit per status. Formula: `now − status_entered_at`, bucketed. Sources: history=`parts_job_items_status_history`; snapshot=`open_parts_by_status_snapshot`. Target: Lower-is-better. Drill: ageing lines.

**KPI — Stock Turnover · `prt.stock_turn` · STRATEGIC · R1**
Formula: `COGS over period ÷ average stock value`. Num=Σ cost of fitted/sold parts; Den=avg `Σ qty_in_stock × unit_cost`. Sources: `parts_stock_movements`,`parts_catalog`. Target: Higher-is-better. Example: £18k ÷ £30k = **0.6 (×7.2 annualised)**.

**KPI — Stock Value · `prt.stock_value` · STRATEGIC · R1**
Formula: `Σ qty_in_stock × unit_cost` (point-in-time). Sources: `parts_catalog`; snapshot=entity-state. Target: Band (avoid over/under-stock). Drill: by category, below-reorder lines.

**KPI — Supplier Performance · `prt.supplier_performance` · STRATEGIC · R3**
Description: per-supplier lead time, fill rate, on-time %, price variance. Blocker: **no `suppliers` master** (free-text supplier) → R3. Sources(planned): `suppliers`,`parts_deliveries`,`parts_delivery_items`. Target: Higher-is-better. Notes: the single biggest Parts R3 unlock.

**KPI — Fill Rate · `prt.fill_rate` · TACTICAL · R3**
Formula: `Σ qty_received ÷ Σ qty_ordered × 100` per supplier/period. Sources: `parts_delivery_items`; needs supplier entity for supplier-level. Target: Higher-is-better. Aggregate (all-supplier) fill rate is R2; per-supplier is R3.

**KPI — Pick Rate · `prt.pick_rate` · TACTICAL · R2**
Description: pre-pick→picked throughput / pick workload by zone. Formula: `COUNT(→picked)` per period; by `pre_pick_location`. Sources: events=`PART_PRE_PICKED/PICKED`; history. Target: Informational/Higher. Drill: by zone.

**KPI — Parts Margin · `prt.margin` · STRATEGIC · R1**
Formula: `(Σ unit_price − Σ unit_cost) ÷ Σ unit_price × 100` on fitted/sold lines. Num=price−cost; Den=price. Sources: `parts_job_items`,`parts_stock_movements`. Target: Band (target margin %). Example: (£1,000−£640)÷£1,000 = **36%**.

**KPI — Parts Revenue · `prt.revenue` · TACTICAL · R1**
Formula: `Σ unit_price × qty_fitted` (+ counter sales). Sources: `parts_job_items`,`invoices.parts_total`,`parts_order_cards`. Related: Accounts. Target: Higher-is-better. Notes: counter orders not yet linked to revenue (improvement).

**KPI — Parts Profitability · `prt.profitability` · STRATEGIC · R1**
Formula: `parts_revenue − parts_cost`. Sources: as margin. Target: Higher-is-better. Feeds department/executive profitability.

**KPI — VHC→Parts Conversion · `prt.vhc_conversion` · TACTICAL · R1**
Formula: `COUNT(part lines from authorised VHC) ÷ COUNT(authorised VHC items needing parts) × 100`. Sources: `parts_job_items.vhc_item_id`,`vhc_checks`. Related: VHC, Workshop. Target: Higher-is-better.

**KPI — Backorder Rate · `prt.backorder_rate` · TACTICAL · R2**
Formula: `COUNT(delivery items status=backorder) ÷ ordered × 100`. Sources: `parts_delivery_items`; events=`PART_ORDERED`. Target: Lower-is-better.

---

## 7. Service Advisor KPI Catalogue (`svc.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| svc.booking_volume | Booking Volume | OPERATIONAL | R1 |
| svc.appointment_conversion | Appointment Conversion | TACTICAL | R2 |
| svc.response_time | Customer Response Time | TACTICAL | R2 |
| svc.contact_rate | Customer Contact Rate | TACTICAL | R2 |
| svc.vhc_send_rate | VHC Send Rate | TACTICAL | R1 |
| svc.vhc_view_rate | VHC View Rate | TACTICAL | R2 |
| svc.vhc_conversion | VHC Conversion (advisor) | TACTICAL | R2 |
| svc.authorised_value | Authorised Value per Advisor | TACTICAL | R2 |
| svc.declined_value | Declined Value per Advisor | TACTICAL | R2 |
| svc.followup_completion | Follow-up Completion | TACTICAL | R3 |
| svc.csat | Customer Satisfaction | STRATEGIC | R3 |
| svc.waiting_mix | Waiting/Loan/Collection Mix | OPERATIONAL | R1 |
| svc.capacity_rag | Booking Capacity RAG | OPERATIONAL | R1 |

**Definitions**

**KPI — Booking Volume · `svc.booking_volume` · OPERATIONAL · R1**
Formula: `COUNT(appointments booked)`. Sources: `appointments`,`job_booking_requests`; events=`APPOINTMENT_BOOKED`. Target: Higher-is-better. Example: **24/day**.

**KPI — Appointment Conversion · `svc.appointment_conversion` · TACTICAL · R2**
Formula: `COUNT(appointments → arrived/job created) ÷ COUNT(booked) × 100`. Num=appointments that became jobs; Den=booked. Sources: `appointments`,`jobs`; history=`appointment_status_history`; events=`APPOINTMENT_STATUS_CHANGED`,`JOB_CREATED`. Target: Higher-is-better. Notes: needs appointment status-history (R2).

**KPI — Customer Response Time · `svc.response_time` · TACTICAL · R2**
Formula: `mean(first staff reply − customer message)` / `mean(VHC decision − VHC sent)`. Sources: events=`CUSTOMER_CONTACTED`,`VHC_SENT`,`VHC_AUTHORISED/DECLINED`; `message_thread_members.last_read_at`. Target: Lower-is-better. Notes: message-level precision blocked by JSON-collapsed storage (D11) — event-level proxy at R2; full at R3.

**KPI — Customer Contact Rate · `svc.contact_rate` · TACTICAL · R2**
Formula: `COUNT(jobs with ≥1 logged customer contact) ÷ COUNT(jobs) × 100`. Sources: events=`CUSTOMER_CONTACTED`. Target: Higher-is-better.

**KPI — VHC Send Rate · `svc.vhc_send_rate` · TACTICAL · R1**
Formula: `COUNT(VHC sent) ÷ COUNT(jobs requiring VHC) × 100`. Sources: `vhc_send_history`,`jobs.vhc_required`/`vhc_sent_at`; events=`VHC_SENT`. Target: Higher-is-better. Example: 30 sent ÷ 34 required = **88%**.

**KPI — VHC View Rate · `svc.vhc_view_rate` · TACTICAL · R2**
Formula: `COUNT(VHC viewed) ÷ COUNT(VHC sent) × 100`. Sources: events=`VHC_VIEWED`(`job_share_links.viewed_at`),`VHC_SENT`. Target: Higher-is-better. Notes: needs view event captured (R2).

**KPI — VHC Conversion (advisor) · `svc.vhc_conversion` · TACTICAL · R2**
Formula: `authorised_value ÷ (authorised_value + declined_value) × 100`, by advisor. Sources: `vhc_checks`; events=`VHC_AUTHORISED/DECLINED`. Target: Higher-is-better. Ranking input. Notes: advisor attribution needs the sending advisor captured on `VHC_SENT` (R2).

**KPI — Authorised Value per Advisor · `svc.authorised_value` · TACTICAL · R2**
Formula: `Σ vhc_checks.authorized_total_gbp` by advisor. Target: Higher-is-better. Drill: authorised items.

**KPI — Declined Value per Advisor · `svc.declined_value` · TACTICAL · R2**
Formula: `Σ declined_total_gbp` by advisor. Target: Lower-is-better (lost £). Pairs with authorised for conversion.

**KPI — Follow-up Completion · `svc.followup_completion` · TACTICAL · R3**
Description: % declined VHC items followed up later. Blocker: **no follow-up/recall task entity** (R3). Target: Higher-is-better.

**KPI — Customer Satisfaction · `svc.csat` · STRATEGIC · R3**
Blocker: **no CSAT/NPS capture** (R3 — needs survey integration). Interim proxy: response-time + conversion composite. Target: Higher-is-better.

**KPI — Waiting/Loan/Collection Mix · `svc.waiting_mix` · OPERATIONAL · R1**
Formula: distribution of `job_customer_statuses.customer_status`. Sources: `job_customer_statuses`; events=`CUSTOMER_STATUS_SET`. Target: Informational.

**KPI — Booking Capacity RAG · `svc.capacity_rag` · OPERATIONAL · R1**
Formula: bookings/day vs capacity thresholds (RAG). Sources: `/api/customers/bookings/calendar` (already computes this). Target: Band. Reuse existing endpoint.

---

## 8. VHC KPI Catalogue (`vhc.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| vhc.completion_rate | VHC Completion Rate | TACTICAL | R1 |
| vhc.red_items | Red Items Found | OPERATIONAL | R1 |
| vhc.amber_items | Amber Items Found | OPERATIONAL | R1 |
| vhc.green_items | Green Items Found | OPERATIONAL | R1 |
| vhc.avg_value | Average VHC Value | TACTICAL | R1 |
| vhc.authorisation_rate | Authorisation Rate | TACTICAL | R1 |
| vhc.decline_rate | Decline Rate | TACTICAL | R1 |
| vhc.lost_revenue | Lost Revenue (declined) | TACTICAL | R1 |
| vhc.upsell_revenue | Upsell Revenue (authorised) | TACTICAL | R1 |
| vhc.view_to_auth | View→Authorisation Conversion | TACTICAL | R2 |
| vhc.send_to_auth | Send→Authorisation Conversion | TACTICAL | R1 |
| vhc.decision_latency | Send→Decision Latency | TACTICAL | R2 |
| vhc.tech_performance | Technician VHC Performance | TACTICAL | R2 |
| vhc.item_cycle_time | Per-Item Stage Cycle Time | TACTICAL | R2 |

**Definitions**

**KPI — VHC Completion Rate · `vhc.completion_rate` · TACTICAL · R1**
Formula: `COUNT(jobs with VHC completed) ÷ COUNT(jobs vhc_required) × 100`. Sources: `jobs.vhc_completed_at`/`vhc_required`,`vhc_checks`; events=`VHC_COMPLETED`. Owner: Workshop/Service (VHC cross-cutting). Target: Higher-is-better. Example: 31 ÷ 34 = **91%**.

**KPI — Red/Amber/Green Items Found · `vhc.red_items` / `vhc.amber_items` / `vhc.green_items` · OPERATIONAL · R1**
Formula: `COUNT(vhc_checks where severity = red|amber|green)`. Sources: `vhc_checks.severity`; events=`VHC_CREATED`. Target: Informational. Notes: replaces the Service-dashboard default-amber bug — use real `severity`, not text inference. Drill: items by section/technician.

**KPI — Average VHC Value · `vhc.avg_value` · TACTICAL · R1**
Formula: `Σ (authorized_total_gbp + declined_total_gbp) ÷ COUNT(VHCs)`. Sources: `vhc_checks`,`jobs`. Target: Higher-is-better. Example: £6,200 identified ÷ 31 = **£200/VHC**.

**KPI — Authorisation Rate · `vhc.authorisation_rate` · TACTICAL · R1**
Formula: `authorised_value ÷ (authorised_value + declined_value) × 100`. Num=Σ authorized_total_gbp; Den=Σ(authorized+declined). Sources: `vhc_checks`; events=`VHC_AUTHORISED/DECLINED`. Target: Higher-is-better. Example: £2,400 ÷ £6,200 = **39%**. Can also compute by item count.

**KPI — Decline Rate · `vhc.decline_rate` · TACTICAL · R1**
Formula: `declined_value ÷ identified_value × 100`. Target: Lower-is-better. Complement of authorisation.

**KPI — Lost Revenue · `vhc.lost_revenue` · TACTICAL · R1**
Formula: `Σ declined_total_gbp`. Sources: `vhc_checks`,`vhc_declinations`; events=`VHC_DECLINED`. Target: Lower-is-better. Drill: declined items (follow-up candidates).

**KPI — Upsell Revenue · `vhc.upsell_revenue` · TACTICAL · R1**
Formula: `Σ authorized_total_gbp` (= `jobs.vhc_authorized_total`). Sources: `vhc_checks`,`jobs`; events=`VHC_AUTHORISED`. Target: Higher-is-better. Feeds executive `mgt.upsell_contribution`.

**KPI — View→Authorisation Conversion · `vhc.view_to_auth` · TACTICAL · R2**
Formula: `COUNT(VHC authorised after view) ÷ COUNT(VHC viewed) × 100`. Sources: events=`VHC_VIEWED`,`VHC_AUTHORISED`. Target: Higher-is-better. Needs view event (R2).

**KPI — Send→Authorisation Conversion · `vhc.send_to_auth` · TACTICAL · R1**
Formula: `COUNT(VHC with any authorisation) ÷ COUNT(VHC sent) × 100`. Sources: `vhc_send_history`,`vhc_checks`; events=`VHC_SENT`,`VHC_AUTHORISED`. Target: Higher-is-better.

**KPI — Send→Decision Latency · `vhc.decision_latency` · TACTICAL · R2**
Formula: `mean(first decision − sent)`. Sources: events=`VHC_SENT`,`VHC_AUTHORISED/DECLINED`; history=`vhc_item_status_history`. Target: Lower-is-better.

**KPI — Technician VHC Performance · `vhc.tech_performance` · TACTICAL · R2**
Description: per-tech VHC quality/value (items raised, avg value, downstream authorisation). Formula: by `vhc_checks` creator: items, identified £, eventual authorised £. Target: Higher-is-better. Ranking. Notes: needs reliable creator attribution (R2 actor bridge).

**KPI — Per-Item Stage Cycle Time · `vhc.item_cycle_time` · TACTICAL · R2**
Formula: dwell per VHC workflow state (`new→awaiting_customer→approved→in_progress→completed`). Sources: history=`vhc_item_status_history`. Target: Lower-is-better. Notes: the VHC workflow is derived-on-read today; needs decision-level history (P4 priority 2).

---

## 9. MOT KPI Catalogue (`mot.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| mot.volume | MOT Volume | OPERATIONAL | R1 |
| mot.pass_rate | Pass Rate | TACTICAL | R1* |
| mot.first_time_pass | First-Time Pass Rate | TACTICAL | R3 |
| mot.retest_rate | Retest Rate | TACTICAL | R3 |
| mot.tester_productivity | Tester Productivity | TACTICAL | R2 |
| mot.revenue | MOT Revenue | TACTICAL | R1 |
| mot.repair_conversion | MOT→Repair Conversion | STRATEGIC | R2 |
| mot.advisory_conversion | Advisory Conversion | STRATEGIC | R3 |
| mot.throughput | MOT Throughput | OPERATIONAL | R1 |
| mot.due_pipeline | MOT-Due Pipeline | OPERATIONAL | R1 |

**Definitions**

**KPI — MOT Volume · `mot.volume` · OPERATIONAL · R1**
Formula: `COUNT(jobs type='MOT' in period)`. Sources: `jobs`; events=`MOT_BOOKED`. Target: Higher-is-better. Example: **9/day** (use `checked_in_at` as proxy date — flag imprecision).

**KPI — Pass Rate · `mot.pass_rate` · TACTICAL · R1\***
Formula: `COUNT(pass) ÷ COUNT(results) × 100`. Sources: `jobs.completion_status` (today, fuzzy) → `mot_tests.result` (R3). Target: Higher-is-better. Example: 7 ÷ 9 = **78%**. *\*R1 but UNRELIABLE today — overlapping `ILIKE` counts double-count; replace with mutually-exclusive result; trustworthy only at R3.*

**KPI — First-Time Pass Rate · `mot.first_time_pass` · TACTICAL · R3**
Formula: `COUNT(passed first attempt) ÷ COUNT(tests) × 100`. Blocker: **no retest→original linkage** → needs `mot_tests.retest_of` (R3). Target: Higher-is-better (key VTS KPI).

**KPI — Retest Rate · `mot.retest_rate` · TACTICAL · R3**
Formula: `COUNT(retests) ÷ COUNT(initial tests) × 100`. Blocker: retest linkage (R3). Target: Lower-is-better.

**KPI — Tester Productivity · `mot.tester_productivity` · TACTICAL · R2**
Formula: tests per tester per period; mean test duration. Sources: `job_clocking.work_type='mot'`; events=`MOT_STARTED`,`MOT_RESULT_RECORDED`. Target: Higher-is-better. Notes: reliable tester attribution improves with `mot_tests.tester_id` (R3); clocking-based interim at R2.

**KPI — MOT Revenue · `mot.revenue` · TACTICAL · R1**
Formula: `Σ MOT line value` on invoices. Sources: `invoices`/`invoice_items` (MOT line),`jobs`. Target: Higher-is-better.

**KPI — MOT→Repair Conversion · `mot.repair_conversion` · STRATEGIC · R2**
Formula: `COUNT(MOT jobs generating repair work) ÷ COUNT(MOT jobs) × 100`. Sources: `jobs`,`job_requests`,`vhc_checks`; events=`VHC_AUTHORISED`. Target: Higher-is-better.

**KPI — Advisory Conversion · `mot.advisory_conversion` · STRATEGIC · R3**
Formula: `COUNT(advisories converted to booked work) ÷ COUNT(advisories) × 100`. Blocker: **no advisory capture** (R3 — `mot_advisories`). Target: Higher-is-better.

**KPI — MOT Throughput · `mot.throughput` · OPERATIONAL · R1**
Formula: tests/day trend (existing dashboard). Target: Higher-is-better. Notes: existing MOT dashboard already trends this (fix the date proxy).

**KPI — MOT-Due Pipeline · `mot.due_pipeline` · OPERATIONAL · R1**
Formula: `COUNT(vehicles mot_due within N days)`. Sources: `vehicles.mot_due`. Target: Informational (reminder driver). Drill: vehicles→customers.

---

## 10. Valeting KPI Catalogue (`val.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| val.cars_washed | Cars Washed | OPERATIONAL | R1 |
| val.avg_wash_time | Average Wash Time | TACTICAL | R3 |
| val.completion_rate | Wash Completion Rate | TACTICAL | R1 |
| val.sla | Wash SLA Attainment | TACTICAL | R3 |
| val.queue_time | Queue Time | TACTICAL | R2 |
| val.valeter_productivity | Valeter Productivity | TACTICAL | R3 |
| val.skip_rate | No-Wash / Skip Rate | TACTICAL | R1 |

**Definitions**

**KPI — Cars Washed · `val.cars_washed` · OPERATIONAL · R1**
Formula: `COUNT(washState=complete)`. Sources: `jobs.wash_completed_by`/`valetChecklist`; events=`WASH_COMPLETED`. Target: Higher-is-better. Example: **15/day**.

**KPI — Average Wash Time · `val.avg_wash_time` · TACTICAL · R3**
Formula: `mean(wash_completed_at − wash_started_at)`. Blocker: **no `wash_completed_at`** (only `wash_started_at` exists) → R3 (single highest-value valet fix). Target: Lower-is-better.

**KPI — Wash Completion Rate · `val.completion_rate` · TACTICAL · R1**
Formula: `COUNT(complete) ÷ COUNT(complete + no_wash) × 100`. Sources: `valetChecklist.washState`; events=`WASH_COMPLETED`,`WASH_SKIPPED`. Target: Higher-is-better.

**KPI — Wash SLA Attainment · `val.sla` · TACTICAL · R3**
Formula: `COUNT(washes within SLA minutes) ÷ COUNT(washes) × 100`. Blocker: needs `wash_completed_at` + SLA target (R3). Target: Higher-is-better.

**KPI — Queue Time · `val.queue_time` · TACTICAL · R2**
Formula: `mean(wash_started − queued)`. Sources: events=`WASH_QUEUED`,`WASH_STARTED`; history=`wash_status_history`. Target: Lower-is-better.

**KPI — Valeter Productivity · `val.valeter_productivity` · TACTICAL · R3**
Formula: washes per valeter per shift. Blocker: **no wash assignee** captured (only completer) → R3. Target: Higher-is-better.

**KPI — No-Wash / Skip Rate · `val.skip_rate` · TACTICAL · R1**
Formula: `COUNT(no_wash) ÷ COUNT(complete + no_wash) × 100`. Sources: `valetChecklist`; events=`WASH_SKIPPED`. Target: Lower-is-better.

---

## 11. Paint / Bodyshop KPI Catalogue (`pnt.*`)

> Lowest-readiness department — almost everything needs a **paint stage model** (R3).

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| pnt.jobs_completed | Paint Jobs Completed | OPERATIONAL | R1 |
| pnt.cycle_time | Paint Cycle Time | TACTICAL | R2 |
| pnt.stage_duration | Paint Stage Duration | TACTICAL | R3 |
| pnt.bay_utilisation | Bay Utilisation | TACTICAL | R3 |
| pnt.painter_productivity | Painter Productivity | TACTICAL | R3 |
| pnt.rework_rate | Paint Rework Rate | STRATEGIC | R3 |
| pnt.material_usage | Material Usage / Cost | TACTICAL | R3 |
| pnt.queue | Paint Queue | OPERATIONAL | R1 |

**Definitions**

**KPI — Paint Jobs Completed · `pnt.jobs_completed` · OPERATIONAL · R1**
Formula: `COUNT(jobs type~paint / category bodyshop, completed)`. Sources: `jobs` (type/`job_categories`); events=`PAINT_COMPLETED`. Target: Higher-is-better. Notes: coarse (no paint entity).

**KPI — Paint Cycle Time · `pnt.cycle_time` · TACTICAL · R2**
Formula: `mean(completed_at − workshop_started_at)` for paint jobs. Sources: `jobs` milestones; history=`job_status_history`. Target: Lower-is-better. Notes: whole-job only until stage model exists.

**KPI — Paint Stage Duration · `pnt.stage_duration` · TACTICAL · R3**
Formula: dwell per stage (prep/spray/dry/buff/ready). Blocker: **no paint stage model** (R3). Sources(planned): `paint_stage_history`; events=`PAINT_STAGE_CHANGED`. Target: Lower-is-better.

**KPI — Bay Utilisation · `pnt.bay_utilisation` · TACTICAL · R3**
Blocker: no bay entity (R3). Formula: bay occupied ÷ available. Target: Band.

**KPI — Painter Productivity · `pnt.painter_productivity` · TACTICAL · R3**
Blocker: no painter assignment/clocking (R3). Formula: jobs/hours per painter. Target: Higher-is-better.

**KPI — Paint Rework Rate · `pnt.rework_rate` · STRATEGIC · R3**
Blocker: no rework flag (R3). Formula: rework ÷ completed. Target: Lower-is-better.

**KPI — Material Usage / Cost · `pnt.material_usage` · TACTICAL · R3**
Blocker: no paint code/material capture (R3). Formula: Σ material cost per job. Target: Lower-is-better. Related: Parts, Accounts.

**KPI — Paint Queue · `pnt.queue` · OPERATIONAL · R1**
Formula: `COUNT(paint jobs not completed)`. Sources: `jobs`. Target: Informational. (Fix the current `.limit()` truncation.)

---

## 12. Accounts KPI Catalogue (`acc.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| acc.revenue | Total Revenue | EXECUTIVE | R1 |
| acc.labour_revenue | Labour Revenue | TACTICAL | R1 |
| acc.parts_revenue | Parts Revenue | TACTICAL | R1 |
| acc.outstanding_invoices | Outstanding Invoices | OPERATIONAL | R1 |
| acc.ar | Accounts Receivable | TACTICAL | R1 |
| acc.dso | Days Sales Outstanding | STRATEGIC | R2 |
| acc.payments_received | Payments Received | OPERATIONAL | R1 |
| acc.credit_exposure | Credit Exposure | TACTICAL | R1 |
| acc.account_balances | Account Balances | OPERATIONAL | R1 |
| acc.gross_profit | Gross Profit | EXECUTIVE | R3 |
| acc.net_profit | Net Profit | EXECUTIVE | R3 |
| acc.profitability | Profitability by Dept | STRATEGIC | R2 |
| acc.invoice_ageing | Invoice Ageing | TACTICAL | R2 |
| acc.payment_conversion | Payment Conversion | TACTICAL | R2 |

**Definitions**

**KPI — Total Revenue · `acc.revenue` · EXECUTIVE · R1**
Formula: `Σ invoices.grand_total (issued in period)`. Sources: `invoices`; events=`INVOICE_CREATED`,`INVOICE_ISSUED`. Target: Higher-is-better. Permissions: financial-gated. Example: **£X/month**. Notes: prefer recompute from line items where the 7 denormalised totals disagree (D12).

**KPI — Labour Revenue · `acc.labour_revenue` · TACTICAL · R1**
Formula: `Σ invoices.labour_total`. Related: Workshop (`wsh.labour_sales`). Target: Higher-is-better.

**KPI — Parts Revenue · `acc.parts_revenue` · TACTICAL · R1**
Formula: `Σ invoices.parts_total`. Related: Parts (`prt.revenue`). Target: Higher-is-better.

**KPI — Outstanding Invoices · `acc.outstanding_invoices` · OPERATIONAL · R1**
Formula: `COUNT/Σ(payment_status in Sent/Overdue)`. Sources: `invoices`; events=`INVOICE_STATUS_CHANGED`. Target: Lower-is-better. (Existing `/api/accounts` computes this.)

**KPI — Accounts Receivable · `acc.ar` · TACTICAL · R1**
Formula: `Σ unpaid invoice balances`. Sources: `invoices`,`invoice_payments`. Target: Lower-is-better. Notes: partial-payment balance needs payment sum (R1 if computed from `invoice_payments`).

**KPI — Days Sales Outstanding · `acc.dso` · STRATEGIC · R2**
Formula: `mean(paid_at − issued_at)` weighted by value. Sources: history=`invoice_status_history`; events=`INVOICE_ISSUED`,`INVOICE_PAID`. Target: Lower-is-better. Notes: needs invoice status-history (no `paid_at` today, only `paid` bool) → R2.

**KPI — Payments Received · `acc.payments_received` · OPERATIONAL · R1**
Formula: `Σ invoice_payments.amount in period`. Events=`PAYMENT_RECEIVED`. Target: Higher-is-better.

**KPI — Credit Exposure · `acc.credit_exposure` · TACTICAL · R1**
Formula: `Σ(account balance) ; COUNT(accounts ≥80% of credit_limit)`. Sources: `accounts`. Target: Lower-is-better. (Existing reporting view.)

**KPI — Account Balances · `acc.account_balances` · OPERATIONAL · R1**
Formula: `accounts.balance` (point-in-time). Target: Informational. Notes: `balance` denormalised — reconcile vs `account_transactions` (D12).

**KPI — Gross Profit · `acc.gross_profit` · EXECUTIVE · R3**
Formula: `revenue − COGS`. Blocker: **no COGS in invoice snapshots** (R3 — needs cost on invoice lines). Target: Higher-is-better. Until then, GP approximated from `prt.margin` + labour GP (`wsh.profitability`).

**KPI — Net Profit · `acc.net_profit` · EXECUTIVE · R3**
Formula: `gross_profit − operating costs`. Blocker: GP (R3) + no opex model. Target: Higher-is-better. Notes: likely needs accounting-system integration.

**KPI — Profitability by Department · `acc.profitability` · STRATEGIC · R2**
Formula: per-department `revenue − cost`. Sources: department-tagged events + cost inputs. Target: Higher-is-better. Notes: needs department dimension (R2) + cost inputs; labour/parts GP available, full GP at R3.

**KPI — Invoice Ageing · `acc.invoice_ageing` · TACTICAL · R2**
Formula: AR bucketed 0-30/31-60/61-90/90+ days. Sources: `invoices`,`invoice_status_history`; snapshot=`ar_ageing_snapshot`. Target: Lower-is-better (shift left). Notes: ageing-by-transition needs status-history (R2).

**KPI — Payment Conversion · `acc.payment_conversion` · TACTICAL · R2**
Formula: `COUNT(Sent invoices → Paid) ÷ COUNT(Sent) × 100`. Sources: history=`invoice_status_history`; events=`INVOICE_PAID`. Target: Higher-is-better.

---

## 13. Admin KPI Catalogue (`adm.*`)

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| adm.user_activity | User Activity | TACTICAL | R2 |
| adm.login_success_rate | Login Success Rate | OPERATIONAL | R1 |
| adm.login_failures | Login Failures | OPERATIONAL | R1 |
| adm.role_changes | Role Changes | TACTICAL | R2 |
| adm.report_usage | Report Usage | TACTICAL | R2 |
| adm.audit_activity | Audit Activity Volume | TACTICAL | R1 |
| adm.compliance | Compliance Metrics | STRATEGIC | R1 |
| adm.data_quality | Data-Quality Health | TACTICAL | R2 |

**Definitions**

**KPI — User Activity · `adm.user_activity` · TACTICAL · R2**
Formula: active users per period (distinct actors emitting events). Sources: `report_event`(distinct `actor_user_id`),`audit_log`. Target: Informational. Notes: needs event spine (R2).

**KPI — Login Success Rate · `adm.login_success_rate` · OPERATIONAL · R1**
Formula: `COUNT(login success) ÷ COUNT(attempts) × 100`. Sources: `auth_login_attempts`,`audit_log`; events=`LOGIN_SUCCEEDED/FAILED`. Target: Higher-is-better (with security context).

**KPI — Login Failures · `adm.login_failures` · OPERATIONAL · R1**
Formula: `COUNT(login failures)` by reason/user/IP. Sources: `auth_login_attempts`. Target: Lower-is-better. Security drill.

**KPI — Role Changes · `adm.role_changes` · TACTICAL · R2**
Formula: `COUNT(ROLE_CHANGED)`. Sources: events=`ROLE_CHANGED`; `audit_log`. Target: Informational (audit). Blocker: role changes currently UNLOGGED (R2 — audit-gap closure).

**KPI — Report Usage · `adm.report_usage` · TACTICAL · R2**
Formula: `COUNT(REPORT_VIEWED/EXPORTED)` by report/user. Sources: events=`REPORT_VIEWED/EXPORTED`; `audit_log`. Target: Informational. Drives adoption analysis.

**KPI — Audit Activity Volume · `adm.audit_activity` · TACTICAL · R1**
Formula: `COUNT(audit_log rows)` by plane/action. Sources: `audit_log`,`job_activity_events`. Target: Informational.

**KPI — Compliance Metrics · `adm.compliance` · STRATEGIC · R1**
Formula: consent coverage, SAR turnaround, retention adherence. Sources: `audit_log` (GDPR events — already logged). Target: Higher-is-better. (The one fully-audited domain today.)

**KPI — Data-Quality Health · `adm.data_quality` · TACTICAL · R2**
Formula: counts of records missing department / unresolved actor / out-of-model status / snapshot drift (Phase 2 §13.3). Sources: data-quality monitors. Target: Lower-is-better (defects). Notes: meta-KPI guarding all others.

---

## 14. Management KPI Catalogue (`mgt.*`) — Executive tier

> Management owns no operational events; these compose department KPIs (§4).

**Summary**
| ID | Name | Class | Readiness |
|---|---|---|---|
| mgt.department_performance | Department Performance Index | EXECUTIVE | R2 |
| mgt.company_revenue | Company Revenue (by dept) | EXECUTIVE | R1 |
| mgt.company_profitability | Company Profitability | EXECUTIVE | R3 |
| mgt.capacity_utilisation | Capacity Utilisation | EXECUTIVE | R3 |
| mgt.site_recovery | Site Labour Recovery | EXECUTIVE | R2 |
| mgt.upsell_contribution | VHC Upsell Contribution | STRATEGIC | R1 |
| mgt.customer_satisfaction | Customer Satisfaction | STRATEGIC | R3 |
| mgt.growth | Growth (YoY) | EXECUTIVE | R2 |
| mgt.bottleneck | Bottleneck Detection | STRATEGIC | R2 |
| mgt.sla_attainment | SLA Attainment | STRATEGIC | R2 |
| mgt.forecast_inputs | Forecasting Inputs | STRATEGIC | R2 |
| mgt.cost_to_serve | Cost to Serve | EXECUTIVE | R3 |

**Definitions**

**KPI — Department Performance Index · `mgt.department_performance` · EXECUTIVE · R2**
Description: normalised composite per department (efficiency + throughput + conversion + profitability), for cross-department comparison. Formula: weighted, normalised blend of each department's tactical KPIs (weights in `dim_kpi`). Sources: department snapshots. Target: Band. Drill: department→its KPIs→records.

**KPI — Company Revenue (by department) · `mgt.company_revenue` · EXECUTIVE · R1**
Formula: `Σ acc.revenue grouped by owner_department`. Sources: `invoices` + department dimension. Target: Higher-is-better. Notes: department split needs the dimension (full split R2; total R1).

**KPI — Company Profitability · `mgt.company_profitability` · EXECUTIVE · R3**
Formula: `Σ department gross_profit`. Blocker: COGS (R3) for full GP. Interim: labour + parts GP only. Target: Higher-is-better.

**KPI — Capacity Utilisation · `mgt.capacity_utilisation` · EXECUTIVE · R3**
Formula: `site clocked_hours ÷ site available_hours`. Blocker: capacity model (R3). Target: Band.

**KPI — Site Labour Recovery · `mgt.site_recovery` · EXECUTIVE · R2**
Formula: `Σ sold_hours ÷ Σ clocked_hours` site-wide. Sources: `wsh.sold_hours`,`wsh.clocked_hours`. Target: Band (≥100%). The whole-site version of `wsh.labour_recovery`.

**KPI — VHC Upsell Contribution · `mgt.upsell_contribution` · STRATEGIC · R1**
Formula: `vhc.upsell_revenue ÷ acc.revenue × 100`. Sources: `vhc_checks`,`invoices`. Target: Higher-is-better. Example: £45k ÷ £300k = **15%**.

**KPI — Customer Satisfaction · `mgt.customer_satisfaction` · STRATEGIC · R3**
Blocker: no CSAT/NPS capture (R3). Composite proxy from response-time + conversion until then.

**KPI — Growth (YoY) · `mgt.growth` · EXECUTIVE · R2**
Formula: `(this_period − same_period_last_year) ÷ last_year × 100` for revenue/throughput. Sources: yearly snapshots. Target: Higher-is-better. Needs ≥13m history (R2 + time).

**KPI — Bottleneck Detection · `mgt.bottleneck` · STRATEGIC · R2**
Description: identifies the stage with the largest dwell/backlog growth. Formula: rank stages by `stage_dwell` + backlog trend across job/parts/VHC/paint. Sources: all `*_status_history` + backlog snapshots. Target: Informational/diagnostic. Drill: the bottleneck stage→affected entities.

**KPI — SLA Attainment · `mgt.sla_attainment` · STRATEGIC · R2**
Formula: `COUNT(stages within SLA) ÷ COUNT(stages) × 100`. Sources: `*_status_history` + SLA targets. Target: Higher-is-better. Needs SLA/target model.

**KPI — Forecasting Inputs · `mgt.forecast_inputs` · STRATEGIC · R2**
Description: curated time-series (revenue, throughput, bookings, recovery) ready for forecasting. Not a forecast — the inputs. Sources: snapshots. Target: Informational. Forecast-ready per §3.8.

**KPI — Cost to Serve · `mgt.cost_to_serve` · EXECUTIVE · R3**
Formula: `total cost ÷ jobs completed`. Blocker: full cost model (R3). Target: Lower-is-better.

---

## 15. Cross-Cutting Blockers (why an R2/R3 KPI isn't R1)

### 15.1 KPIs blocked by missing entities (R3)
| Missing entity | KPIs unblocked when built |
|---|---|
| `mot_tests` (+ `retest_of`, `tester_id`, `mileage`) | `mot.first_time_pass`, `mot.retest_rate`, reliable `mot.pass_rate`, `mot.tester_productivity` |
| `mot_advisories` | `mot.advisory_conversion` |
| Paint stage model (`paint_stage_history`, painter, bay, material) | `pnt.stage_duration`, `pnt.bay_utilisation`, `pnt.painter_productivity`, `pnt.material_usage` |
| `wash_completed_at` + wash assignee | `val.avg_wash_time`, `val.sla`, `val.valeter_productivity` |
| `warranty_claims`/`warranty_requests` (deploy) | all warranty KPIs (cycle-time, approval rate, reimbursement) |
| `suppliers` master | `prt.supplier_performance`, per-supplier `prt.fill_rate`, precise `prt.lead_time` |
| Capacity / ramp / bay / roster model | `wsh.capacity`, `wsh.utilisation`, `wsh.ramp_utilisation`, `mgt.capacity_utilisation` |
| Rework/comeback flag | `wsh.rework_rate`, `pnt.rework_rate`, first-pass quality |
| COGS on invoice lines | `acc.gross_profit`, `acc.net_profit`, `mgt.company_profitability`, `mgt.cost_to_serve` |
| CSAT/NPS capture | `svc.csat`, `mgt.customer_satisfaction` |
| Follow-up/recall task entity | `svc.followup_completion` |

### 15.2 KPIs blocked by missing status history (R2)
Need a `*_status_history` table (Phase 2 §6): `prt.lead_time`, `prt.ageing`, `prt.cancelled`, `prt.unavailable`, `prt.backorder_rate`, `vhc.item_cycle_time`, `vhc.decision_latency`, `wsh.cycle_time`, `wsh.stage_dwell`, `wsh.wait_parts/customer/auth`, `acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion`, `svc.appointment_conversion`, `val.queue_time`, `mgt.bottleneck`, `mgt.sla_attainment`.

### 15.3 KPIs blocked by missing events (R2)
Need a `report_event` emitter not present today: `svc.vhc_view_rate`/`vhc.view_to_auth` (VHC_VIEWED), `svc.response_time`/`svc.contact_rate` (CUSTOMER_CONTACTED), `adm.role_changes` (ROLE_CHANGED), `adm.report_usage` (REPORT_VIEWED/EXPORTED), `adm.user_activity`.

### 15.4 KPIs blocked by missing integrations
External feeds: `svc.csat`/`mgt.customer_satisfaction` (survey/NPS), `acc.net_profit`/`mgt.cost_to_serve` (accounting/opex system), DVLA MOT-history (richer `mot.*`), manufacturer warranty (warranty integrations). All slot into the event spine as `actor_kind='integration'` (Phase 2 §15) — no architecture change.

### 15.5 KPIs blocked by data-quality prerequisites (gate even R1 trust)
- **Department dimension (D3):** any `*by department` slice and all `mgt.*` department splits.
- **Actor bridge (D4):** any per-user KPI (`wsh.tech_*`, `svc.*` per advisor, `mot.tester_*`, `vhc.tech_performance`).
- **Status normalisation:** `mot.pass_rate`, anything grouping `jobs.status`/`payment_status`.
- **Counted-query fixes (D8):** `wsh.jobs_completed`, `prt.*` totals, `pnt.queue`, `val.cars_washed`, MOT counts — *the numbers are wrong today until fixed.*

---

## 16. Implementation Readiness & Order

### 16.1 Priority bands
- **KPI Priority 1 (build first — R1, high value, trust-fixing):** the metrics that are buildable now AND either already shown (but wrong) or headline. ~ the R1 set across Workshop, VHC, Accounts, Service, Parts, MOT(volume), Valeting, Admin(security/compliance).
- **KPI Priority 2 (build after the event/history spine — R2):** cycle-time, dwell, conversion-latency, recovery, DSO, ageing, bottleneck — the management tier. Highest analytical value; gated on Phase 2 capture.
- **KPI Priority 3 (build after missing entities/integrations — R3):** MOT test-level, paint stage, valet duration, warranty, supplier, profitability/margin-full, CSAT, capacity.

### 16.2 Priority 1 — recommended exact order
*(Prerequisites first: `dim_department`, `dim_actor`, status normalisation, counted-query fixes — none of P1 is trustworthy without them.)*
1. `vhc.red/amber/green_items`, `vhc.completion_rate`, `vhc.authorisation_rate`, `vhc.upsell_revenue`, `vhc.lost_revenue` — fix the default-amber bug; highest commercial visibility.
2. `wsh.jobs_completed`, `wsh.jobs_per_day`, `wsh.throughput`, `wsh.sold_hours`, `wsh.clocked_hours`, `wsh.labour_sales` — workshop core (fix truncation).
3. `wsh.tech_efficiency`, `wsh.tech_ranking`, `wsh.mobile_activity` — reuse `efficiency.js`.
4. `acc.revenue`, `acc.labour_revenue`, `acc.parts_revenue`, `acc.outstanding_invoices`, `acc.ar`, `acc.payments_received`, `acc.credit_exposure` — reuse `/api/accounts`.
5. `svc.booking_volume`, `svc.vhc_send_rate`, `svc.waiting_mix`, `svc.capacity_rag` — reuse bookings calendar.
6. `prt.requests/ordered/received/fitted`, `prt.stock_value`, `prt.stock_turn`, `prt.margin`, `prt.revenue`, `prt.vhc_conversion`.
7. `mot.volume`, `mot.throughput`, `mot.due_pipeline`, `mot.revenue` (pass_rate flagged unreliable until R3).
8. `val.cars_washed`, `val.completion_rate`, `val.skip_rate`; `pnt.jobs_completed`, `pnt.queue`.
9. `adm.login_success_rate`, `adm.login_failures`, `adm.audit_activity`, `adm.compliance`.
10. `mgt.company_revenue`, `mgt.upsell_contribution` — first executive composites from P1 data.

### 16.3 Priority 2 — recommended order (after Phase 2 spine, by dependency)
1. Status-history rollout drives this: **Parts** (`prt.lead_time`,`prt.ageing`,`prt.cancelled`,`prt.unavailable`,`prt.backorder_rate`,`prt.pick_rate`).
2. **VHC** (`vhc.item_cycle_time`,`vhc.decision_latency`,`vhc.view_to_auth`,`vhc.tech_performance`).
3. **Workshop** (`wsh.cycle_time`,`wsh.stage_dwell`,`wsh.wait_parts/customer/auth`,`wsh.labour_recovery`,`wsh.tech_productivity`,`wsh.additional_work_recovery`,`wsh.profitability`,`wsh.team_performance`).
4. **Accounts** (`acc.dso`,`acc.invoice_ageing`,`acc.payment_conversion`,`acc.profitability`).
5. **Service** (`svc.appointment_conversion`,`svc.response_time`,`svc.contact_rate`,`svc.vhc_conversion`,`svc.authorised/declined_value`).
6. **Admin** (`adm.role_changes`,`adm.report_usage`,`adm.user_activity`,`adm.data_quality`).
7. **Management** (`mgt.site_recovery`,`mgt.bottleneck`,`mgt.sla_attainment`,`mgt.department_performance`,`mgt.growth`,`mgt.forecast_inputs`).

### 16.4 Priority 3 — recommended order (after missing entities)
1. `mot_tests`(+advisories) → all `mot.*` test-level KPIs.
2. `wash_completed_at`+assignee → `val.avg_wash_time`,`val.sla`,`val.valeter_productivity`.
3. `suppliers` → `prt.supplier_performance`,`prt.fill_rate`(per-supplier),precise `prt.lead_time`.
4. Paint stage model → all `pnt.*` stage KPIs.
5. Deploy `warranty_claims` → warranty KPIs.
6. COGS on invoices → `acc.gross_profit`,`acc.net_profit`,`mgt.company_profitability`,`mgt.cost_to_serve`.
7. Capacity model → `wsh.capacity/utilisation/ramp`,`mgt.capacity_utilisation`.
8. Rework flag → `wsh.rework_rate`,`pnt.rework_rate`.
9. CSAT integration → `svc.csat`,`mgt.customer_satisfaction`.

### 16.5 Readiness tally
- **R1 (Priority 1):** ~38 KPIs — buildable now (with the prerequisite fixes).
- **R2 (Priority 2):** ~45 KPIs — after the event/history spine.
- **R3 (Priority 3):** ~27 KPIs — after missing entities/integrations.

---

## 17. Phase 3 Success Criteria

Phase 3 (this design) is complete when:

- [x] A single master KPI document exists in `docs/Report System/` and is the agreed KPI bible.
- [x] A **KPI Definition Standard** (22 fields + defaults + classification + readiness) is established so every metric is defined unambiguously.
- [x] **Every requested department** (Workshop, Parts, Service Advisors, VHC, MOT, Valeting, Paint, Accounts, Admin, Management) has a complete KPI catalogue covering all listed metrics **plus** repository-identified additions.
- [x] Every KPI carries: name, ID, owner, related departments, description, purpose, formula, numerator/denominator, source tables/events/status-histories/snapshot, calc frequency, aggregation, trend, target type, example, permissions, drill-down, related reports, future notes (via explicit value or documented default).
- [x] Every KPI is **classified** (Operational/Tactical/Strategic/Executive) and **readiness-tagged** (R1/R2/R3).
- [x] **KPI hierarchy** (source vs derived, feed graph) is defined so build order respects dependencies.
- [x] **Standards** for scorecards, dashboard cards, trends, benchmarks, targets, traffic-lights, rankings, and forecasting readiness are defined.
- [x] KPIs blocked by **missing entities / history / events / integrations** are explicitly identified.
- [x] An **implementation readiness** section gives Priority 1/2/3 with an exact recommended build order.
- [x] **No code, migrations, or report pages were created** — design only.

**Definition of "ready for Phase 4 (implementation):** stakeholders ratify the KPI catalogue (especially formulas + targets), accept the §16 priority order, and confirm the Phase 2 prerequisites (`dim_department`, `dim_actor`, status normalisation, counted-query fixes) are scheduled ahead of any Priority 1 build — because no number here is trustworthy until those land.

---

*End of Phase 3 KPI catalogue. No code, migrations, or report pages have been created. This document is the definitive KPI reference for the H&P DMS reporting platform; implementation follows the §16 order once the Phase 2 prerequisites are in place.*
