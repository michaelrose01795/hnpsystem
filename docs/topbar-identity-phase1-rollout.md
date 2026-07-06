# Top Bar Identity — Phase 1 Rollout

**Status:** Phase 1 complete (1.1 → 1.5)
**Scope:** Staff top bar identity layer + sidebar Profile button + supporting
reusable modules. No change to the top bar's height, spacing, layout structure,
styling, colours, positioning or overall visual design.
**Date:** 2026-07-06
**Supersedes:** `topbar-identity-phase1-1.md` (folded into this master doc).

The identity layer of the staff top bar was redesigned so the chrome shows *who
you are and where you sit* — the user's primary role plus a live, department-
appropriate operational status — instead of a generic greeting and an internal
dealership "mode" toggle. The user's full name moved into the sidebar Profile
button. Search, help and all technician controls stayed exactly where they were.

This doc is updated after each sub-phase (implementation, verification,
limitations, recommendations) per the rollout ritual.

---

## Files

**New (reusable, pure where possible):**
- [src/lib/auth/rolePrecedence.js](../src/lib/auth/rolePrecedence.js) — centralised
  primary-role selection + label formatting (Phase 1.3).
- [src/config/topbar/departmentStatus.js](../src/config/topbar/departmentStatus.js)
  — the department status registry: fallbacks + per-department live builders
  (Phase 1.2).
- [src/hooks/useDepartmentStatus.js](../src/hooks/useDepartmentStatus.js) —
  gathers real signals (roster + user state) and calls the registry (Phase 1.2).
- [src/lib/auth/rolePrecedence.test.js](../src/lib/auth/rolePrecedence.test.js) /
  [src/config/topbar/departmentStatus.test.js](../src/config/topbar/departmentStatus.test.js)
  — unit tests (Phase 1.5).

**Edited:**
- [src/components/layout/StaffTopbar.js](../src/components/layout/StaffTopbar.js)
- [src/components/layout/StaffLayout.js](../src/components/layout/StaffLayout.js)
- [src/components/layout/StaffSidebar.js](../src/components/layout/StaffSidebar.js)

---

## Phase 1.1 — Identity swap (Welcome + mode → role + department status)

**Implementation**
- Removed the **"Welcome {firstName}"** greeting and the dealership **Mode:**
  selector from the top bar's left slot.
- The `<h1>` now renders the user's **current role**; the secondary line renders
  a **contextual department status message**. Both reuse the exact `<h1>` / label
  styling (1.15rem / 700 / `--accent`; 0.65rem / 600 / uppercase / `--mutedText`
  / 0.08em) so the bar's height and rhythm are unchanged.
- The user's **full name** moved into the sidebar Account **Profile** button
  (`user.username`), replacing the literal "Profile" text. The collapsed rail
  keeps the "Profile" icon (icon lookup still keys on the original label); the
  name surfaces as the hover/aria label. Hidden in presentation mode (unchanged),
  so no real name leaks into the demo shell.
- **Preserved untouched:** global search, Help & Diagnostics, the next-action
  prompt (right side, same order), and all technician controls (status dropdown,
  Open Job / No Current Job, Start Job) which still render only for `isTech`.
- **Layout wiring:** stopped passing the now-unused `firstName` / mode props into
  the top bar and removed the dead `firstName` / `fallbackName` locals and
  `handleModeSelect`. The mode **state machine** stayed intact (it still scopes
  `userRoles`); only the visible mode UI was removed.

**Verified:** eslint clean; `check:borders` passed; confirmed `user.username`
is the display name; guests fall back to `Staff` + `On shift` without crashing.

---

## Phase 1.2 — Reusable live department status

**Implementation**
- Replaced the temporary static strings with a **central registry**
  ([departmentStatus.js](../src/config/topbar/departmentStatus.js)):
  - `DEPARTMENT_STATUS_FALLBACKS` — always-safe static copy per department.
  - `DEPARTMENT_STATUS_BUILDERS` — per-department functions that turn a `signals`
    snapshot into a concise live summary (or return `null` to fall back).
  - `buildDepartmentStatus(code, signals)` → `{ text, isLive }`; never throws.
- A hook ([useDepartmentStatus.js](../src/hooks/useDepartmentStatus.js)) gathers
  **real, already-loaded application data** — staff roster headcounts
  (`RosterContext`) and the signed-in user's own state (`UserContext`) — and
  feeds the registry. It resolves the department via the canonical reporting
  `resolveDepartmentForRoles`, so status can never drift from the reporting
  taxonomy.
- Live summaries shipped: **Workshop** ("N technicians on the floor"), **MOT**
  ("N MOT testers on shift"), **Valeting** ("N valeters on shift"), **Parts**
  ("N people on the parts desk"), **Service** ("N advisors on duty"). Departments
  without a cheap live signal (paint / accounts / admin / hr / management) use
  their fallback copy.
- **Extensibility:** a new department's live summary is added by editing the
  registry only (a fallback + optional builder). The top bar component never
  changes — it renders whatever string it is handed.
- **Presentation shell:** live signals are suppressed upstream, so the demo
  always shows the clean static copy (no roster/self leakage).
- The top bar is now fully **presentational**: `primaryRoleLabel` and
  `departmentStatus` arrive as props from `StaffLayout`, which owns the hook call.

**Verified:** eslint clean; unit tests for the registry (live vs fallback,
pluralisation, presentation suppression, unknown-department default, missing
signals) — all green.

**Design decision / limitation:** the top bar renders on every page for every
role, so it must not fire heavy or role-guarded queries. Live status therefore
uses only data already in client context (roster + self). Richer signals
(open-job counts, appointments today, queue depth) need a dedicated lightweight
endpoint — see Phase 2.2.

---

## Phase 1.3 — Intelligent primary-role selection

**Implementation**
- New [rolePrecedence.js](../src/lib/auth/rolePrecedence.js): a single ordered
  `ROLE_PRECEDENCE` list (leadership → department managers → senior operational →
  operational → support) with an O(1) rank lookup.
- `getPrimaryRole(roles)` returns the **most significant** role regardless of
  array order (so a Workshop Manager who also holds "Techs" reads as *Workshop
  Manager*, not *Techs*). Unknown roles rank last and keep their original order,
  so the result is deterministic and never crashes.
- `formatRoleLabel` / `getPrimaryRoleLabel` centralise display formatting and
  preserve acronyms ("mot tester" → *MOT Tester*, "hr manager" → *HR Manager*).
- `StaffLayout` now derives the role label via `getPrimaryRoleLabel(userRoles)`
  instead of `userRoles[0]`.

**Verified:** eslint clean; unit tests (precedence over array order, leadership >
manager, case/trim handling, unknown-role fallback, acronym labels) — all green.

**Note:** department attribution deliberately still uses
`resolveDepartmentForRoles` (operational-preferred) — a Workshop Manager's role
label is "Workshop Manager" while their department status is workshop-floor
availability. The two concerns are intentionally separate and coherent.

---

## Phase 1.4 — Responsive behaviour

**Implementation / review**
- **Desktop (≥1025px):** identity block renders in the left grid column. Added
  `minWidth: 0` on the block + inner column and single-line ellipsis truncation
  on both the role line and the status line, so at tighter desktop widths long
  text degrades to an ellipsis instead of wrapping (which would grow the fixed
  75px bar) or pushing the centred action strip. `title` keeps the full text on
  hover.
- **Tablet / mobile (<1025px):** the identity block stays hidden — the same
  behaviour as the greeting it replaced. The mobile chrome is space-constrained
  and prioritises the action strip + search-below-tabs; identity is instead
  accessible via the **sidebar Profile button (full name)** in the drawer. This
  is a deliberate "accessible where appropriate" decision, not an omission.
- **Accessibility:** the identity block carries an `aria-label`
  ("Signed in as {role}. {status}.") so assistive tech announces the identity as
  one unit; truncated text remains reachable via `title`.

**Verified:** production `next build` succeeds (all routes compile); visual
language unchanged (no new tokens, colours, borders, or spacing).

**Limitation:** role/department status is not surfaced *visually* in the mobile
top bar. If product wants it there, a compact treatment in the mobile drawer is
the recommended route (Phase 2.2) — it needs a small layout addition and so was
kept out of a "no visual change" phase.

---

## Phase 1.5 — Polish, optimisation & cleanup

**Implementation**
- **Long names handled gracefully** — Profile button now truncates via a
  `truncate` option threaded through `renderNavContent` → `renderLinkLabel`
  (ellipsis + `title`), and the top-bar identity lines truncate as above.
- **Obsolete code removed:**
  - Dead `activeModeLabel` local + the `modeLabel` prop passed to both sidebar
    call sites, and the sidebar's legacy `_modeLabel` param + `void _modeLabel`.
  - Inline role/department helpers and the static status map that Phase 1.1 had
    put in the top-bar component (now centralised in the new modules).
- **Maintainability:** logic lives in three small, reusable, single-purpose
  modules (role precedence, status registry, signals hook) rather than inline in
  the chrome. The top bar is purely presentational.
- **Mode state machine kept:** it still scopes `userRoles` and is *not* obsolete,
  so it was intentionally left in place (see limitation below).

**Verified (full regression pass):**
- `npx eslint` on all six touched/new source files — **clean**.
- `npx vitest run` (both new suites) — **19 tests passing**.
- `npm run check:borders` — **passed**.
- `npx next build` — **succeeds**, all routes compile.
- Manual trace: technician controls, search, help and Create-User button paths
  are unchanged; Profile button behaviour/icon preserved; presentation shell
  shows static copy only.

**Remaining limitations**
1. **Mode switching was removed from the top bar.** Multi-mode (Retail/Sales)
   users fall back to their stored/default mode and can no longer switch from the
   chrome. The scoping logic still runs (still required for role correctness).
2. **Live status breadth.** Only roster-headcount + self signals are wired;
   workload / queue / appointments are still fallback copy for now.
3. **Mobile identity is drawer-only** (see Phase 1.4).

---

## Recommended work for Phase 2.2

1. **Lightweight operational-summary endpoint.** Add a single cheap, cache-
   friendly `/api/status/operational-summary` returning small per-department
   counts (open jobs, appointments today, queue depth, clocked-in headcount).
   Wire it into `useDepartmentStatus` as an additional signal source with the
   same fallback contract — enabling richer builders (workload/queue/appointments)
   with no top-bar change.
2. **Mode switching relocation (decision needed).** Relocate the Retail/Sales
   switcher (Profile/Settings or a chrome menu) or retire multi-mode; if retired,
   `MODE_ROLE_MAP` scoping in `StaffLayout` can be simplified/removed.
3. **Mobile identity treatment.** If role/department status should be visible on
   mobile, add a compact, design-consistent placement in the sidebar drawer.
4. **Clocked-in vs rostered headcount.** Current headcounts are *rostered* staff,
   not *clocked-in*. The summary endpoint (item 1) can switch these to live
   presence for a truer "who's on shift now".
5. **Role-aware phrasing.** Builders receive `role`; consider manager-vs-operative
   phrasing (e.g. a manager sees team availability, an operative sees their own
   next action) once the richer signals land.
