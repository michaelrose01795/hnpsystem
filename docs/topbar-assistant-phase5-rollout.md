# Top Bar Workspace — Phase 5 Rollout (Intelligent Operational Assistance)

**Status:** Complete — 5.1–5.8 shipped.
**Scope:** Complete the role-aware, collaborative top-bar workspace by adding an
**intelligent operational assistance** layer — predictive recommendations,
workload balancing, proactive alerts, smart reminders, configurable workflow
automation, a unifying operational assistant, and behaviour-based personalisation
— **with zero change to the top bar's height, spacing, styling, colours, borders
or visual design.** Every Phase 5 surface is overlay/keyboard-driven and mounted
*outside* the bar (through the single `WorkspaceCommandCenter` host, exactly like
Phases 3–4), so the chrome is untouched.
**Date:** 2026-07-06
**Builds on:**
- Phase 1 — identity + live status.
- Phase 2 — role-aware workspace: the lean `/api/status/operational-summary`
  metrics (`jobsInProgress`, `jobsWaiting`, `appointmentsToday`, `overdueJobs`,
  `waitingApprovals`, `techniciansAvailable/OnJobs/Total`, parts
  `partsOutstanding` / `pendingDeliveries`) + roster headcounts.
- Phase 3 — productivity system: command palette, workspace panel, shortcuts,
  contextual suggestions, personalisation, reminders and the
  `WorkspaceCommandCenter` single mount point.
- Phase 4 — collaborative operational workspace (`docs/topbar-collaboration-phase4-rollout.md`):
  team presence, availability, department activity, communication, escalations,
  manager tools and cross-department coordination.

This doc is updated after each sub-phase (implementation, verification, remaining
work, recommendations) per the rollout ritual, **before** progressing to the next.

---

## Architecture (how Phase 5 stays reusable, central & honest)

Phase 5 follows the exact seam Phases 2–4 established — **pure registry → thin
reactive hook → presentational overlay → single mount** — so nothing touches the
bar:

| Layer | Where | Rule |
|---|---|---|
| **Pure logic / registries** | `src/config/topbar/*` | No React/window/storage. Deterministic + unit-tested (`phase5.test.js`). |
| **Reactive hooks** | `src/hooks/*` | Derive live signals from data already flowing (metrics + presence + recent). No new polling. Trends/behaviour are on-device only. |
| **Presentational UI** | `src/components/topbar/AssistantPanel.js` | Reuses `PopupModal` (borderless) + `LayerTheme` surfaces; obeys the layer/border laws. Fully data-driven from `buildAssistant`. |
| **Single mount point** | `src/components/topbar/WorkspaceCommandCenter.js` | Hosts the Assistant panel alongside the Phase 3–4 surfaces. StaffLayout mounts it **once**; the bar is untouched. |

**The honest data boundary (important).** Phase 5 adds **no new tables and no new
polling.** It is a *reasoning layer* over signals that already flow:

- **Workload** = the Phase 2 operational metrics snapshot (already polled).
- **Department activity / trends** = movement between consecutive metric snapshots
  (the same source Phase 4.3 derives its feed from) — kept in a short in-memory
  rolling history, never a log.
- **User behaviour** = a per-user, **on-device** frequency model of the pages the
  user actually opens (built from the same route signal Phase 3.2 records) — it
  learns locally, is capped, decays, and is resettable. No server profiling.

Predictions are therefore **honest heuristics over real live data**, never a claim
of ML the app can't back. Every recommendation/alert carries a plain-English
**reason** so it is explainable, and every "remaining work" note points at the
single swap-point to upgrade a heuristic to a richer source with no consumer
change.

Adding a recommendation, a balancing move, an alert, a smart reminder, a workflow
flow or an assistant section is an edit to one registry — never the top bar.

---

## Phase 5.1 — Predictive operational recommendations

**Implementation**
- Shared trend engine [src/config/topbar/operationalTrends.js](../src/config/topbar/operationalTrends.js):
  `deriveTrends(history)` turns a rolling history of metric snapshots into a
  per-metric descriptor (`current` / `previous` / `first` / `delta` /
  `windowDelta` / `direction` / `rising` / `falling`). Absent samples (a poll
  where one metric errored) are skipped, so a gap never reads as "dropped to 0".
  `trendFor` / `isRising` / `isFalling` / `movementLabel` are safe accessors.
- Predictive engine [src/config/topbar/recommendations.js](../src/config/topbar/recommendations.js):
  `buildRecommendations({ metrics, trends, roles, department, pathname, behaviour })`
  runs a ranked rule set that weighs **which way a metric is heading** (a rising
  queue/overdue/approvals pile-up outranks a static one and gets high confidence),
  role-gates parts rules, then layers **personalised** behaviour recommendations
  (5.7's "you use this often") below the live-operational ones. Every item carries
  a plain-English `reason`, a `confidence` and a `source` — nothing is a black box.
  Ranked by weight × confidence, deduped by href, current page dropped.
- Hook [src/hooks/useOperationalTrends.js](../src/hooks/useOperationalTrends.js)
  holds the in-memory rolling history (cap `trendHistory`), pushing a new sample
  only when a tracked value actually changes — **no polling of its own**.
- Hook [src/hooks/useOperationalRecommendations.js](../src/hooks/useOperationalRecommendations.js)
  memoises the list against primitive metric/trend/behaviour keys.

**Verified**
- `phase5.test.js` — trends: direction/delta/window movement, empty-safe,
  absent-sample skipping; recommendations: rising-overdue ranked high-confidence
  with an explaining reason, parts role-gating, current-page drop, behaviour
  personalisation ranked below live work. **5 tests passing.**

**Remaining work / recommendations**
- Trends are session-lived movement, not a persisted series. A durable
  `metric_snapshots` table would let recommendations reason over day-parts ("the
  queue always builds after lunch") — `deriveTrends` output shape would be reused.
- Behaviour input is optional here; it is populated by the 5.7 model once wired.

## Phase 5.2 — Intelligent workload balancing

**Implementation**
- Pure engine [src/config/topbar/workloadBalancing.js](../src/config/topbar/workloadBalancing.js):
  `buildWorkloadBalancing({ presence, metrics, trends, department, myDepartment, roles })`
  produces, for managers **and controllers** (`canBalanceWorkload` widens the
  4.6 manager gate to any "controller" role):
  - a **utilisation headline** (`75% of the team utilised`, toned by pressure)
    from the live technician figures;
  - **assignment** suggestions when there's both work and free hands;
  - **cross-department help** — when local capacity is zero it scans presence for
    free hands elsewhere and proposes "Pull in help from MOT (2 free)", carrying
    that department's code for a one-click message;
  - a **predictive** "queue is climbing (3 → 6) — rebalance early" when the trend
    is rising before it becomes critical;
  - **spare-capacity offers** to the busiest zero-free department;
  - **overdue redistribution** (highest-priority move);
  - the **named free members** right now, each messageable.
  Suggestions are priority-ranked; a single `summary` gives the headline.

**Verified**
- `phase5.test.js` — manager/controller gating, utilisation maths (75%),
  assign-to-free + named free member, cross-department borrow when local capacity
  is zero, overdue-first priority ordering. **4 tests (9 total passing).**

**Remaining work / recommendations**
- Cross-department help uses presence **headcount** (who's free elsewhere), not
  their live queue — a manager multi-department metrics endpoint (deferred in 4.6)
  would let it weigh whether the other department can actually spare them.
- "Assign N to M" is a routing hint to `/nextjobs`; a future write-capable
  allocation action could let the manager assign directly from the suggestion.

## Phase 5.3 — Proactive operational alerts

**Implementation**
- Pure engine [src/config/topbar/operationalAlerts.js](../src/config/topbar/operationalAlerts.js):
  `resolveAlerts({ metrics, trends, roles, department })` runs a rule set that
  detects **current-state** problems (bottleneck = work waiting with nobody free,
  overdue pile-up, approvals blocking, parts/delivery backlog — role-gated) AND
  **predictive/emerging** ones the threshold-only escalations can't see: capacity
  draining, overdue climbing, approvals building, queue building fast — each fired
  from a rising/falling `trend` and carrying the `3 → 5` movement in its detail.
  Every alert has a `kind` taxonomy, a `severity` (shared palette), a `predictive`
  flag, a destination and an audience to notify. Ranked by severity, then live
  problems before forecasts of equal severity. `summariseAlerts` gives a compact
  count (critical/high/medium/predictive); `topAlert` the single headline.
- Hook [src/hooks/useOperationalAlerts.js](../src/hooks/useOperationalAlerts.js)
  memoises against primitive metric/trend/role keys — no polling of its own.
- **Relationship to 4.5 escalations:** escalations stay the current-state critical
  subset in the Team panel; alerts are the broader predictive superset for the
  assistant. Both reuse the same `SEVERITY` tokens, so nothing new is introduced.

**Verified**
- `phase5.test.js` — critical bottleneck leads and is non-predictive; predictive
  approvals alert fires below its threshold on a rising trend; a live critical
  problem outranks a same-severity forecast; parts role-gating; empty-safe
  `topAlert`; `summariseAlerts` counts. **4 tests (13 total passing).**

**Remaining work / recommendations**
- Alert thresholds/trend-deltas are fixed constants; they could move into
  `workspaceConfig` for per-site tuning (as 4.5 noted for escalations).
- Predictive quality scales with trend-history depth (`trendHistory`); a persisted
  metric series would let alerts learn each site's normal daily rhythm.

## Phase 5.4 — Smart reminders

**Implementation**
- Pure engine [src/config/topbar/smartReminders.js](../src/config/topbar/smartReminders.js):
  `buildSmartReminders({ metrics, roles, department, manualOutstanding })`
  automatically surfaces the work that shouldn't slip — **deadline** (overdue jobs
  to update), **incomplete** (approvals to follow up, jobs in progress to finish,
  parts to book — role-gated), **appointment** (today's diary) and **follow-up**
  (deliveries to chase). The user's own open **manual** reminders (Phase 3.6) are
  folded in as the lowest-priority "you have N open reminders" follow-up, so the
  two lists sit side by side: what YOU chose to remember vs what the OPERATION
  says needs remembering. Ranked by urgency, capped. `countSmartReminders` gives
  the auto-count (excluding the manual nudge) for a compact badge.

**Verified**
- `phase5.test.js` — deadline-first ordering, appointment + approval reminders,
  auto-count; parts role-gating; the manual nudge folded in last with no href and
  excluded from the auto-count. **2 tests (15 total passing).**

**Remaining work / recommendations**
- Reminders are derived from aggregate counts, not per-record deadlines. A future
  read of `jobs.next_update_due` / `appointments.scheduled_time` would let a
  reminder name the specific job/time ("Job 1234 due in 20 min") — the rule shape
  already carries an href to deep-link to it.

## Phase 5.5 — Configurable workflow automation

**Implementation**
- Pure engine + registry [src/config/topbar/workflowAutomation.js](../src/config/topbar/workflowAutomation.js):
  `resolveWorkflow({ pathname, roles, department, metrics })` picks the single
  best-matching flow from the declarative `WORKFLOW_FLOWS` registry and returns its
  ordered next-action steps. Page-contextual flows (progress-this-job,
  complete-this-VHC) outrank operational-state flows (clear-approvals,
  allocate-queue, process-parts), which outrank the always-on `day-start` default
  — so the surfaced steps always match the current context. Each step supports an
  `include(ctx)` predicate (skip when irrelevant — e.g. the "update overdue" step
  only shows when overdue > 0), a function `label` (interpolates live counts —
  "Open the 4-job queue"), and a `done(ctx)` predicate (mark complete from live
  signal). **Configurability is the design:** adding or resequencing a workflow is
  one edit to the registry, no chrome change.

**Verified**
- `phase5.test.js` — job-card page flow outranks state flows; the queue flow
  interpolates the count and conditionally includes the overdue step; a step's
  `done` evaluates from live metrics; the `day-start` fallback always applies.
  **3 tests (18 total passing).**

**Remaining work / recommendations**
- Steps route to the relevant workspace; several are the same destination
  (`/job-cards`) because per-step deep actions (e.g. "authorise THIS VHC") need a
  job/VHC id the top bar doesn't hold. On an entity page a future `entityId` in
  context would let steps deep-link to the specific record.
- Flows are global; a per-user "hide this flow" preference could ride the existing
  personalisation blob (3.7) if teams want to opt individual flows out.

## Phase 5.6 — Intelligent operational assistant

**Implementation**
- Pure assembler [src/config/topbar/assistant.js](../src/config/topbar/assistant.js):
  `buildAssistant({ alerts, recommendations, workflow, smartReminders, balancing,
  guidance, pathname, roles })` normalises every Phase 5 feature into one common
  section/item shape and orders them **alerts → recommendations → next steps →
  smart reminders → balancing → guidance**, dropping empty sections (guidance
  always shown). It returns a single `headline` (top alert, else top
  recommendation, else "all clear") and `counts` for a compact cue. Items carry
  `href`, `done`, `messageAudience`/`memberId` and `reason`, so the panel is fully
  data-driven. `contextualGuidance({ pathname, roles })` is the assistant's
  page-aware tip (VHC severities, capturing extra work, queue balancing, report
  trends, parts matching) plus an always-on "Ctrl/Cmd+I" discovery tip.
- Presentational drawer [src/components/topbar/AssistantPanel.js](../src/components/topbar/AssistantPanel.js):
  a right-hand `PopupModal` edge drawer (borderless), each section a `LayerTheme`
  surface, rows navigate / show a done tick / offer a "message the responsible
  team" shortcut (4.4). Obeys the layer/border laws (only `--separating-line` +
  allowed rings). Reachable via **Ctrl/Cmd+I** or the palette; **adds nothing to
  the bar**.
- Wiring [src/components/topbar/WorkspaceCommandCenter.js](../src/components/topbar/WorkspaceCommandCenter.js):
  the single mount host assembles the assistant from the Phase 5 hooks/builders
  (all reusing data already in hand) and renders `<AssistantPanel>` beside the
  Phase 3-4 surfaces. A new global shortcut + palette action are registered
  centrally; the bar chrome is untouched.

**Verified**
- `phase5.test.js` - guidance gives a page tip + the discovery tip; sections
  assemble in order, empties dropped, guidance kept, headline surfaces the top
  alert, message-audience carried; balancing shown only when eligible; idle ->
  "all clear". **3 tests.** eslint clean; `check:borders` / `check:layers` pass.

**Remaining work / recommendations**
- The assistant reads its inputs; it doesn't yet act on them (assign/authorise
  in place). Each item already carries an href/audience, so a future write-action
  layer can hang off the same item shape with no panel change.

## Phase 5.7 — Learning from user behaviour

**Implementation**
- Pure model [src/config/topbar/behaviourModel.js](../src/config/topbar/behaviourModel.js):
  `recordVisit` / `rankActions` / `scoreEntry` maintain a per-user frequency map
  with a **recency half-life** (a stale habit fades unless still used), a **cap**
  (weakest entry evicted), a `minCount` gate (a single visit isn't a habit) and
  `normaliseModel` hardening against corrupt blobs. `rankActions` returns the
  recency-weighted "you use this often" top actions.
- Hook [src/hooks/useBehaviourModel.js](../src/hooks/useBehaviourModel.js) records
  the current route once per navigation (reusing the same signal Phase 3.2 reads),
  per-user **on-device** (workspaceStorage), reactive across tabs, demo-disabled,
  labelled from the navigation items - and exposes `topActions`, `tracked` and a
  `reset`. It feeds the 5.1 recommendations (personalised "you use this often"
  items, ranked below live operational work) and powers the assistant's
  "Personalisation" block (what it's learned + a Reset), so it stays **under the
  user's control**.

**Verified**
- `phase5.test.js` - visit counting + frequency ranking (min-2-visits gate),
  recency decay (fresh use beats stale frequency), cap eviction, corrupt-blob
  normalisation. **3 tests.** Personalisation surfaced through 5.1 (see its test)
  and the assistant panel.

**Remaining work / recommendations**
- Learning is on-device per browser (no server profile), honestly scoped. A
  future opt-in `PATCH /api/status/behaviour` would let personalisation follow a
  user across devices - `rankActions` output is already the only consumer contract.
- Time-of-day personalisation ("you open the diary each morning") is a natural
  next step: the model already stores `last`/`first` timestamps to build it from.

## Phase 5.8 — Optimisation, accessibility, responsiveness, config, docs, extensibility

**Optimisation / performance**
- **No new network polling.** Trends reuse the existing metrics poll; alerts,
  recommendations, smart reminders, workflow, balancing and the assistant are all
  pure over data already in hand, memoised against primitive keys. The trend ring
  and behaviour model are tiny, capped, in-memory/on-device. Nothing is added to
  the bar's render path - every surface is overlay-mounted through the single
  `WorkspaceCommandCenter`.

**Accessibility**
- The Assistant panel closes on Escape (`useEscapeKey`), uses `PopupModal`'s
  `role="dialog"`/`aria-modal`/`aria-label`; every message/close/reset control has
  an `aria-label`/`title`; tone dots and step ticks are `aria-hidden` with text
  labels alongside; buttons are real `<button>`s with visible focus via the
  allowed `--focus-ring`.

**Responsiveness**
- The panel is a full-height edge drawer at `min(100%, 460px)` / `100dvh`, fluid to
  mobile, content scrolling internally - identical to the Team/Workspace panels.

**Centrally configurable**
- New tunables in [workspaceConfig.js](../src/config/topbar/workspaceConfig.js):
  `trendHistory`, `recommendations`, `workloadSuggestions`, `alerts`,
  `smartReminders`, `workflowSteps`, `assistantGuidance`, `behaviourTracked`,
  `behaviourTopActions`, `behaviourHalfLifeMs`. The barrel
  [config/topbar/index.js](../src/config/topbar/index.js) re-exports every Phase 5
  registry as one import surface.

**Extensibility (all central, none touch the bar)**
- Add a recommendation rule -> `recommendations.js`; a balancing move ->
  `workloadBalancing.js`; an alert -> `operationalAlerts.js`; a smart reminder ->
  `smartReminders.js`; a workflow flow/step -> `workflowAutomation.js` (declarative
  registry); an assistant section or guidance tip -> `assistant.js`; a metric to
  trend -> `TRENDED_METRICS`. The panel is fully data-driven, so a new section
  renders with no component change.

**Keyboard**
- New global shortcut **Ctrl/Cmd+I** ("Open operational assistant") in the central
  registry, dispatched by the single Phase 3.5 handler; it appears automatically in
  the `?` shortcut-hints overlay.

**Tests**
- [src/config/topbar/phase5.test.js](../src/config/topbar/phase5.test.js) - **24
  tests** across all eight pure modules.

**Verified (full pass)**
- `npx vitest run src/config/topbar/` - **82 tests passing** (Phase 2-4's 58 +
  Phase 5's 24) - no regressions.
- `npx eslint` on all new/changed Phase 5 files - **clean**.
- `npm run check:borders` - **passes** (Assistant panel uses only
  `--separating-line` / ring tokens; all surfaces `LayerTheme`, borderless).
- `npm run check:layers` - **passes**.
- `npm run uk:check` - no new violations in Phase 5 files (pre-existing unrelated
  `.agents/skills` docs aside).
- **Top bar unchanged:** no `StaffTopbar`/`StaffLayout`/`theme.css`/`globals.css`
  edits; `WorkspaceCommandCenter` (the existing single host) now also assembles and
  mounts `<AssistantPanel>`. Height, spacing, styling, colours and borders are
  untouched.

---

## Summary — what Phase 5 delivered

| Sub-phase | Feature | Entry points |
|---|---|---|
| 5.1 | Predictive recommendations | "Recommended for you" (Ctrl/Cmd+I); explained by reason + confidence |
| 5.2 | Intelligent workload balancing | "Workload balancing" (managers/controllers); cross-department help |
| 5.3 | Proactive operational alerts | "Needs attention" (current + predictive/emerging) |
| 5.4 | Smart reminders | "Don't let these slip" (auto-surfaced + manual nudge) |
| 5.5 | Configurable workflow automation | "Next steps" (context-driven registry) |
| 5.6 | Intelligent operational assistant | Assistant panel (Ctrl/Cmd+I) + palette action + guidance |
| 5.7 | Behaviour learning | Personalises 5.1; "Personalisation" block + Reset (on-device) |
| 5.8 | Optimise / a11y / responsive / config / tests / docs | Ctrl/Cmd+I shortcut, `workspaceConfig`, barrel, `phase5.test.js` |

**How to extend (all central, none touch the bar):** add a recommendation in
`recommendations`; a balancing move in `workloadBalancing`; an alert in
`operationalAlerts`; a smart reminder in `smartReminders`; a workflow in
`workflowAutomation`; an assistant section/tip in `assistant`; a trended metric in
`operationalTrends`; a behaviour signal in `behaviourModel`; a limit in
`workspaceConfig`.

**Deferred / future (all with a single documented swap-point):** a persisted
metric series for day-part trend learning; a manager multi-department metrics
endpoint to weigh cross-department help; per-record deadlines for named smart
reminders; per-step deep actions for workflows on entity pages; write-capable
assistant actions (assign/authorise in place); a cross-device behaviour store and
time-of-day personalisation.
