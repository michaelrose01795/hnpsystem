# HNPSystem Architecture Cleanup — Pass 1 Notes

_Generated 2026-06-01. Companion to `docs/project-structure-reference-pack.md` (the audit)._

This pass deliberately favours **behaviour-preserving** changes (relocations + re-export
shims + additive components) over risky rewrites, per the task instruction "Do not make
massive risky changes in one go." Pages Router routes, API paths, Supabase queries, and
NextAuth login are untouched.

---

## 1. What changed in this pass

### Access control — centralised
- **New:** `src/config/routeAccess.js` is now the single source of truth for route-level
  access: public paths/prefixes, protected prefixes, HR manager-friendly paths, topbar
  links, accounts nav links, always-allowed paths, and dynamic-detail inheritance.
- `src/proxy.js` and `src/lib/auth/pageAccess.js` now **import** their lists from it
  instead of each defining their own copy. The edge guard and the client guard can no
  longer drift apart. No rule values were changed — direct-URL blocking still works for
  every role.
- `src/components/ProtectedRoute.js` is unchanged (still role-prop based) but documented
  in `routeAccess.js` as a consumer; page-level role checks remain in force.

### Layout — split + relocated (behaviour preserved)
- `src/components/Layout.js` (1519 lines) → **moved** to
  `src/components/layout/StaffLayout.js`. The old path is now a 6-line re-export shim, so
  all 10 importers + `_app.js` keep working unchanged.
- The desktop **topbar** JSX was extracted into `src/components/layout/StaffTopbar.js`
  (presentational, props-driven). StaffLayout dropped ~280 lines and the now-unused
  `Link` / `NextActionPrompt` / `DropdownField` imports.
- `src/components/Sidebar.js` (734 lines) → **moved** to
  `src/components/layout/StaffSidebar.js`; old path is a re-export shim (its only importer
  was Layout).

### New layout entry points
- `src/components/layout/CustomerWebsiteLayout.js` — chrome-free shell for `/website`.
  `src/pages/website.js` now uses it (behaviour-identical to the previous `(page) => page`).
- `src/components/layout/PublicLayout.js` — minimal chrome-free shell for public staff
  pages. **Not yet adopted** by `/login` / `/unauthorized` (they still flow through
  StaffLayout's `hideSidebar` branch); migrating them is a safe follow-up.

### New staff UI components (`src/components/ui`, in the barrel `index.js`)
- `StaffPageHeader`, `StaffCard`, `StaffCardGrid`, `StaffButton`, `StaffTabs`.
- `StaffCard` auto-alternates layer colour by `index` (0 = theme, 1 = surface, …) or via
  an explicit `variant`. It renders the canonical `LayerSurface` / `LayerTheme` primitives,
  so it obeys the Layer Sweep + Border Sweep laws (borderless, token-driven).
- `StaffCardGrid` injects `index` into its children and spaces them with **CSS grid only**
  — no invisible placeholder/spacer cards.
- `StaffButton` reuses the `.app-btn` system (renders `<button>` or a `<Link>` via `href`).

### CSS (scoping kept strict)
- New classes appended to `src/styles/staffglobal.css`, all scoped under `html.staff-scope`:
  `.app-public-shell`, `.app-page-header(+__text/__title/__subtitle/__actions)`,
  `.app-card-grid`, `.app-staff-card__header/__title/__subtitle`, `.app-staff-tabs`.
- No `border:` declarations added (surfaces stay borderless). `custglobal.css`
  (`html.website-scope`) was not touched, so website styles cannot reach staff pages and
  vice-versa.

---

## 2. Documented, intentionally NOT moved

### `src/components/page-ui/**` — keep as-is
- These are **route-specific UI wrappers**: one folder per page area (dashboard/*, hr/*,
  accounts/*, etc.) plus single-file wrappers (`home-redirect-ui.js`,
  `mobile/mobile-dashboard-ui.js`, `tech/tech-dashboard-ui.js`). They are imported by **78
  page files** under `src/pages`. They exist to keep page files thin (a page imports its
  `*-ui.js` and renders it).
- **Why not moved:** the mapping is 1:1 with routes and heavily referenced; moving them
  into `features/*` would require editing all 78 importers with no functional gain and real
  breakage risk. Recommend leaving them until/unless a feature-by-feature migration is done
  with its imports in the same change.

### `src/singlescroll/**` — orphaned duplicate, safe to archive later
- `grep` finds **zero imports of `singlescroll` from anywhere outside the folder**. The live
  `/website` route renders `@/features/website/WebsitePage`, **not** `singlescroll`.
- `singlescroll` is a near-complete duplicate of `src/features/website` (same `WebsitePage`,
  `components/*`, `data/*`, `hooks/*`, `shop/*`, `models`, `state`). It appears to be an
  earlier build of the single-scroll site that was superseded by `features/website`.
- **Status: ACTIVE? No. Duplicated? Yes. Safe to delete now? Not in this pass** — archive
  candidate. Recommended next step: confirm nothing references it dynamically, then move it
  to `archive/` or delete in a dedicated commit so it can be reverted easily.

### Website code spread (features/website vs features/websiteManager vs singlescroll)
- `src/features/website` = the public customer site (live at `/website`). **Keep.**
- `src/features/websiteManager` = staff content/analytics tools (`/staff/website-manager`).
  **Keep.**
- `src/singlescroll` = orphaned duplicate of `features/website` (see above).
- No consolidation done this pass to avoid touching the live customer site.

### Pages folder
- Already matches the target tree (`pages/website`, `staff`, `dashboard`, `job-cards`,
  `vhc`, `parts`, `accounts`, `hr`, `workshop`). **Page files were not moved** — under the
  Pages Router, moving a page file changes its URL, which the task forbids.

---

## 3. Remaining risks / things to watch

1. **StaffTopbar extraction** is a faithful 1:1 move, but it is the highest-behaviour-risk
   change here (the topbar reads ~18 layout values, now passed as props). Worth a visual
   smoke test of: tech status dropdown + "Start Job" modal, service quick-action links,
   parts quick-action links, mode dropdown, and the admin-manager "Create User" button.
2. `routeAccess.js` is imported by `src/proxy.js`, which runs in the **edge runtime**. It is
   plain data + pure helpers (edge-safe). Keep it that way — no Node/React/Supabase imports.
3. The old duplicated-list comments in `pageAccess.js` pointed at `src/components/Layout.js`;
   those topbar/accounts lists now live in `routeAccess.js` and are referenced from
   `StaffTopbar.js`. If topbar links change, update `TOPBAR_LINKS` in `routeAccess.js`.

---

## 4. Recommended next cleanup tasks (in priority order)

1. **Migrate `/login`, `/unauthorized`, `/loginPresentation` onto `PublicLayout`** and strip
   their special-casing (`hideSidebar`, `showLoginShellLoading`) out of `StaffLayout`. This
   removes the biggest remaining branch from the shell.
2. **Extract the mobile sidebar drawer + status-sidebar drawer** from `StaffLayout` into
   their own components (`StaffMobileNavDrawer`, `StaffStatusDrawer`) to continue shrinking it.
3. **Archive/delete `src/singlescroll`** in a dedicated commit.
4. **Inline-style reduction sweep** across pages (audit counted ~8234 `style={...}`). Start
   with the dashboards now that `StaffCard`/`StaffCardGrid`/`StaffPageHeader` exist.
5. **Adopt the new staff UI components** in a few representative pages (e.g. a dashboard) to
   validate ergonomics before a wider rollout.
6. **Move `ACCOUNTS_NAV_LINKS` rendering** in `StaffLayout` to read from
   `routeAccess.ACCOUNTS_NAV_LINKS` so the rendered accounts sidebar and the access check
   share one list (currently the access list mirrors the rendered one).
