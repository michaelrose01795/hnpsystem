# Workspace Navigation Manifest — Authoring Guide

**Status:** Live (Phase 0 shipped). This is the practical "how do I change navigation now?" companion to the [design specification](./workspace-navigation-design-spec.md). Read the spec for the *why*; read this for the *how*.

---

## 1. What Phase 0 delivered

A single, **department-first** navigation manifest that is now the source of truth for the sidebar and the nav-derived permission layer, with **zero change to what any user sees**.

| File | Role |
|---|---|
| [`src/config/workspace/departments.js`](../../src/config/workspace/departments.js) | **The manifest.** Department metadata (`WORKSPACE_DEPARTMENTS`) + the nav sections that render (`WORKSPACE_NAV_SECTIONS`). Edit this to change navigation. |
| [`src/config/workspace/manifest.js`](../../src/config/workspace/manifest.js) | **The selectors.** One pure function per consumer (`toSidebarSections`, `getAccessibleNavPaths`, `getContextNav`, `getDepartmentsForRoles`, `resolveHome`, `getActiveDepartment`, `getBreadcrumbTrail`, `getSearchItems`, …). Surfaces derive from these — they never keep their own list. |
| [`src/config/workspace/flags.js`](../../src/config/workspace/flags.js) | **The feature flag.** `workspace_nav_enabled` (OFF by default) gates the *future* department-first surfaces (rail, context sidebar, breadcrumbs). Phase 0 output is identical regardless of the flag. |
| [`src/config/workspace/manifest.test.js`](../../src/config/workspace/manifest.test.js) | **The safety net.** Locks byte-identical sidebar reproduction + per-role permission parity. |

**Back-compat façade:** [`src/config/navigation.js`](../../src/config/navigation.js) still exports `sidebarSections`, now derived via `toSidebarSections()`. Every existing consumer (`StaffSidebar`, `pageAccess.js`, `buildAppKnowledge.js`, `navigation.test.js`) keeps working unchanged.

### The golden rule (nav == permissions)

`src/lib/auth/pageAccess.js` decides "which pages may this user land on?" by walking `sidebarSections` (now manifest-derived). **A page must appear in the manifest — for the roles that should reach it — or `PageAccessGuard` redirects those users to `/newsfeed`.** Navigation config *is* the route-authorisation config. Never treat the manifest as "just menus".

---

## 2. Mental model

```
WORKSPACE_DEPARTMENTS  ─┐
   (department metadata) │
                         ├──►  manifest.js selectors  ──►  every nav surface
WORKSPACE_NAV_SECTIONS  ─┘        (pure projections)         + the permission layer
   (the pages that render,
    tagged by department + order)
```

- The **department** is the top-level unit (keyed on the canonical taxonomy in [`src/lib/reporting/config/departments.js`](../../src/lib/reporting/config/departments.js) — `ROLE_DEPARTMENT_MAP`). We do **not** invent a new taxonomy.
- **Roles are an attribute**, used only for per-item visibility. Empty/absent `roles` on an item ⇒ visible to every authenticated user.
- Each nav section is tagged with its `department` and a global `order`. `order` reproduces today's exact sidebar sequence; the `department` powers the forward-looking selectors.

---

## 3. Recipes

### 3.1 Add a page to an existing department

1. Open [`departments.js`](../../src/config/workspace/departments.js) → `WORKSPACE_NAV_SECTIONS`.
2. Find the section for the owning department (e.g. the `parts` sections).
3. Add an item — **only the legacy keys** `{ label, href, roles }`:
   ```js
   { label: "Returns", href: "/deliveries/returns", roles: ["parts", "parts manager"] },
   ```
4. If the page is a dynamic-detail route with no direct nav link (e.g. `/deliveries/[id]`), grant it via `DYNAMIC_DETAIL_EXTENDS` in [`routeAccess.js`](../../src/config/routeAccess.js) instead — exactly as today.
5. Run `npx vitest run src/config/`. The byte-identical test will fail (expected — you changed the sidebar); update the golden reference in `manifest.test.js` to match, then confirm the permission-parity tests pass.

That single edit makes the page appear in the sidebar, become landable (permissions), and — once later phases ship — appear in the Department Rail, Context Sidebar, breadcrumbs and Workspace Search.

> **⚠️ Item shape is frozen.** Do **not** add forward-looking keys (`icon`, `keywords`, `description`) to items in `WORKSPACE_NAV_SECTIONS` — that breaks the byte-identical `toSidebarSections()` lock. Put per-department metadata on `WORKSPACE_DEPARTMENTS` instead.

### 3.2 Add a whole new department

1. Add a metadata entry to `WORKSPACE_DEPARTMENTS`:
   ```js
   {
     key: "hr",                 // MUST match a ROLE_DEPARTMENT_MAP department code
     label: "HR",
     category: "departments",   // general | departments | account
     icon: "hr",                // resolved later via getSidebarNavIcon
     home: "/hr",               // role→home landing route
     order: 45,                 // rail + sidebar ordering (leave gaps)
     roles: undefined,          // undefined ⇒ derived from ROLE_DEPARTMENT_MAP
     sensitive: "pii",          // "financial" | "pii" | null (reuse permissionScope)
     flag: null,                // optional feature-flag gate, e.g. "reporting_nav_enabled"
   },
   ```
2. Add one or more sections to `WORKSPACE_NAV_SECTIONS` tagged with `department: "hr"` and a fitting `order`.
3. Update the golden reference + run the tests (§3.1 step 5).

Departments without a nav presence today (`hr`, `admin`, `paint`) are intentionally **not** in the manifest yet — add them here when their pages join.

### 3.3 Gate an area behind a feature flag

Set `flag: "<flag_key>"` on the section (and, if the whole department is gated, on the department). Section flags currently resolve through the reporting flag namespace (`reporting_nav_enabled` is the only one in use). When the flag is off the section is dropped entirely — matching how the Reports section behaves today.

### 3.4 Change who can see an item

Edit the item's `roles` array (lowercase role strings). Derive role sets from `ROLE_DEPARTMENT_MAP` where possible (see the reporting-report role derivations at the top of `departments.js`) rather than hand-listing — that keeps nav and departments from drifting. The manifest normalises to lowercase internally, so both the lowercase role constants and the UPPER-CASE client/`ProtectedRoute` convention match.

---

## 4. The validation contract (run before every nav change)

```bash
npx vitest run src/config/          # manifest + navigation tests (35 tests)
npm run check:borders               # no forbidden borders (design system)
npm run check:encoding              # file-encoding guard
npx eslint src/config/workspace/    # lint
```

`manifest.test.js` guarantees:

1. **Byte-identical sidebar** — `toSidebarSections()` deep-equals an independent copy of the pre-refactor `sidebarSections` (built from the original algorithm, not from the code under test).
2. **Permission parity** — the accessible-path set is identical, per role, computed the legacy way vs. via `getAccessibleNavPaths()`, across 19 representative role combinations (incl. roleless, multi-role, and UPPER-CASE).
3. **Dev gating** — `/dev` remains landable **only** for the `dev` role.
4. **Department-first selectors** behave (active-department resolution, context-nav dedup, role→home, breadcrumbs, search).

If you intentionally change the sidebar, tests **1–2 will fail** — that is the safety net doing its job. Update the golden reference in `manifest.test.js` to the new intended output and re-run.

---

## 5. What comes next (and why nothing else needs a refactor)

The selectors in `manifest.js` are already implemented, so future phases are additive *consumers*, not rewrites:

| Phase | Surface | Selector it consumes |
|---|---|---|
| 1 | Point `pageAccess.js` straight at the manifest | `getAccessibleNavPaths` |
| 2 | Fold in stray sources (dashboards, topbar actions, search) | `getSearchItems`, `getQuickActions` |
| 3 | Department Rail (grouped single-rail), behind `workspace_nav_enabled` | `getDepartmentsForRoles`, `getContextNav` |
| 4 | Context Sidebar (replaces HrTabsBar / WorkshopTabsBar / PartsWorkspaceTabs) | `getContextNav`, `getActiveDepartment` |
| 5 | Role→home resolver on `/` | `resolveHome` |
| 6 | Breadcrumbs | `getBreadcrumbTrail` |
| 7 | Quick Preview fly-outs | (new components; manifest supplies the nav data) |

**Rollback** at any user-visible phase = flip `workspace_nav_enabled` off; the manifest still feeds the classic role-organised sidebar via `toSidebarSections()`.

---

## 6. Hard rules (from CLAUDE.md + the design spec)

- **Never** define a navigation list anywhere except `src/config/workspace/`.
- **Never** infer a department from the URL path — flat routes don't encode it. Use `getActiveDepartment()` (backed by the explicit route→department index).
- **Keep the manifest edge-safe** — plain data + pure functions only (it is reachable from `src/proxy.js`). No React, Node-only APIs, or Supabase imports.
- **Never** do a big-bang cutover — migrate department-by-department behind the flag.
- **Always** run the validation contract (§4) before committing a nav change.
