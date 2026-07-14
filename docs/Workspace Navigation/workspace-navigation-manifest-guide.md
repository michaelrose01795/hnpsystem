# Workspace Navigation Manifest - Authoring Guide

**Status:** Complete (Phase 8 shipped — the **Workspace Group Sidebar** is the primary navigation model). Workspace Navigation is the primary staff UI, with `workspace_nav_enabled` retained as the rollback switch until sign-off. Turning the flag off restores the classic role-organised sidebar/topbar presentation while route permissions continue to come from the manifest-derived landable-path selector.

This guide is the practical contract for changing navigation. The full architecture of the current model lives in [`workspace-navigation-groups.md`](./workspace-navigation-groups.md) (the Workspace Group Sidebar source of truth); the original design spec explains the earlier rationale. The authoritative per-group **permission inventory** (every group, its assigned roles, every page, and inherit-vs-override for each page) lives in [`workspace-group-permissions.md`](./workspace-group-permissions.md) — update it whenever you add or re-scope a page.

**Default permission model — group inheritance.** Assigning a group to a role grants every _group-wide_ page in that group (a page with no `roles`). Add new group pages **un-roled** so they inherit; use per-page `roles` only for intentional exceptions (restriction or cross-group grant). Pages in `WORKSPACE_NAV_SECTIONS` keep explicit `roles` because they also render the byte-identical classic sidebar — those arrays are load-bearing for rollback, not redundant.

---

## 1. Finished Architecture

| File | Responsibility |
|---|---|
| [`src/config/workspace/departments.js`](../../src/config/workspace/departments.js) | All navigation data: departments, classic-compatible sections, workspace-only context sections, dashboard shortcuts, quick actions, and page tabs. |
| [`src/config/workspace/manifest.js`](../../src/config/workspace/manifest.js) | Pure selectors for every navigation surface plus the **group permission model** (`GROUP_ROLE_INDEX` / `getWorkspaceGroupRoles`): classic fallback, landable route access, group list, flat per-group page list, breadcrumbs, workspace header data, search, shortcuts, quick actions, role home, and page tabs. |
| [`src/config/workspace/flags.js`](../../src/config/workspace/flags.js) | `workspace_nav_enabled`, on by default. Set `NEXT_PUBLIC_WORKSPACE_WORKSPACE_NAV_ENABLED=false` to roll the presentation back. |
| [`src/components/layout/StaffSidebar.js`](../../src/components/layout/StaffSidebar.js) | Primary department-first sidebar when the flag is on; classic role-organised sidebar when the flag is off. |
| [`src/components/layout/ContextSidebar.js`](../../src/components/layout/ContextSidebar.js) | The **Group view** renderer: replaces the entire sidebar body with a Back to Groups control, the group name, an optional **Dashboards** sub-section (the group's role-visible dashboards), then a flat list of the group's pages with active states + keyboard Escape. "Dashboards" is the only sub-heading; no hover previews / fly-outs, no collapsible sections, no mixed General nav. |
| [`src/components/layout/WorkspaceHeader.js`](../../src/components/layout/WorkspaceHeader.js) | Active department header (breadcrumbs, quick actions, favourites, recents). **No longer rendered** — removed from `StaffLayout` so no in-page header block appears on workspace pages. The component + `getWorkspaceHeader()` selector remain for potential reuse. |
| [`src/components/layout/WorkspaceBreadcrumbs.js`](../../src/components/layout/WorkspaceBreadcrumbs.js) | Breadcrumb trail rendered from `getBreadcrumbTrail()`. |
| [`src/hooks/useWorkspaceShortcuts.js`](../../src/hooks/useWorkspaceShortcuts.js) | Reusable favourites/recently-used storage adapter, currently backed by localStorage and ready for future persistence. |
| [`src/components/layout/StaffLayout.js`](../../src/components/layout/StaffLayout.js) | Mounts workspace header/breadcrumbs, workspace search data, and workspace quick actions only when the flag is on. |
| [`src/components/layout/StaffTopbar.js`](../../src/components/layout/StaffTopbar.js) | Uses manifest quick actions when supplied; keeps legacy actions for flag-off fallback. |
| [`src/components/HR/HrTabsBar.js`](../../src/components/HR/HrTabsBar.js), [`src/components/Workshop/WorkshopTabsBar.js`](../../src/components/Workshop/WorkshopTabsBar.js), [`src/components/page-ui/parts/PartsWorkspaceTabs.js`](../../src/components/page-ui/parts/PartsWorkspaceTabs.js) | Thin wrappers over manifest-owned `getPageTabs()` data. |
| [`src/pages/login.js`](../../src/pages/login.js) | Uses `resolveHome()` for staff post-login landing when workspace navigation is enabled. |
| [`src/lib/auth/pageAccess.js`](../../src/lib/auth/pageAccess.js) | Consumes `getAccessibleNavPaths()` directly, then applies always-allowed and dynamic-detail inheritance from `routeAccess.js`. |
| [`src/config/routeAccess.js`](../../src/config/routeAccess.js) | Edge/public/protected route lists and dynamic-detail inheritance only. Temporary topbar/accounts nav mirrors have been retired. |
| [`src/config/workspace/manifest.test.js`](../../src/config/workspace/manifest.test.js) | Locks classic output, landable-path parity, route access, the group list + flat per-group nav, the group permission model, active states, page tabs, headers, shortcuts, and flag default. |

Back-compat facade: [`src/config/navigation.js`](../../src/config/navigation.js) still exports `sidebarSections = toSidebarSections()` for the classic fallback.

---

## 2. Golden Rules

1. **Every navigation surface is manifest-driven.** Do not create page, sidebar, tab, quick-action, search, breadcrumb, favourite, or recent lists outside `src/config/workspace/`.
2. **Classic fallback must stay stable.** `toSidebarSections()` uses `WORKSPACE_NAV_SECTIONS` only and must remain byte-identical unless a task explicitly changes classic navigation.
3. **Route access follows navigation.** `pageAccess.js` reads `getAccessibleNavPaths()` directly. Dynamic detail routes inherit from list pages in `routeAccess.js`.
4. **Department ownership is explicit.** Use `getActiveWorkspaceDepartment()` for shared flat routes such as `/jobs`, `/goods-in`, `/deliveries`, and `/clocking`.
5. **Manifest modules are edge-safe.** Keep them to plain data and pure functions. No React, browser APIs, Supabase, filesystem, or Node-only imports.
6. **Rollback is presentation-only.** With `workspace_nav_enabled=false`, routes, permissions, mobile behaviour, and page content stay intact while the classic sidebar/topbar returns.
7. **No design drift.** Keep `.app-btn`, `is-active`, collapsed rail, mobile drawer, existing tokens, borderless surfaces, and validation checks.

---

## 3. Selector Contract

| Selector | Primary consumer | Behaviour |
|---|---|---|
| `toSidebarSections()` | `src/config/navigation.js` | Classic role-organised sidebar fallback. |
| `getAccessibleNavPaths(roles)` | `pageAccess.js` | Landable paths from classic sections plus manifest-owned quick/context additions. |
| `getWorkspaceRail(roles)` | `StaffSidebar` | Role-filtered department list (all categories incl. Account). |
| `getWorkspaceGroups(roles)` | `StaffSidebar` (Groups view) | The Group Sidebar's top-level group list: General + accessible departments in manifest order. Excludes the Account bucket (rendered as the sidebar's persistent bottom controls, not a group). |
| `getWorkspaceGroupRoles(departmentKey)` | Permission model / tests | The roles ASSIGNED to a group. `"*"` = every authenticated user (General, Account); otherwise a sorted role array (explicit, or derived from `ROLE_DEPARTMENT_MAP`). |
| `getDepartmentWorkspaceNav(departmentKey, roles)` | `ContextSidebar` (Group view) | One group's role-visible `dashboards` (rendered under a **Dashboards** heading) + **flat, deduped page list** (`items`). No "Overview" entry; no collapsibles. |
| `getActiveWorkspaceDepartment(pathname, roles)` | Sidebar/header/topbar | Resolves the active department through role-visible workspace items. |
| `getBreadcrumbTrail(pathname, roles)` | `WorkspaceBreadcrumbs` | Department/page breadcrumbs from manifest data. |
| `getWorkspaceHeader(pathname, roles)` | `WorkspaceHeader` | Active department label, breadcrumbs, quick actions, and item count. |
| `getWorkspaceShortcutItems(roles)` | `useWorkspaceShortcuts()` consumers | Candidate pages/actions for favourites and recents. |
| `getSearchItems(roles)` | Workspace-enabled `GlobalSearch` | Deduped, role-filtered page list including workspace-only context links. |
| `getQuickActions(roles, activeDepartment)` | `StaffTopbar`, `WorkspaceHeader` | Role-filtered and department-filtered quick actions. |
| `resolveHome(roles)` | Login landing | First accessible department home, falling back to `/newsfeed`. |
| `getPageTabs(pathname, roles, options)` | HR/Workshop/Parts wrappers | Manifest-owned tab groups and role-filtered tab items. |
| `isContextNavItemActive()` / `isPageTabActive()` | Sidebar/tabs | Shared exact, prefix, and pending navigation active-state rules. |

---

## 4. Runtime Behaviour — the Workspace Group Sidebar

When `workspace_nav_enabled` is on, each Workspace Group behaves like **its own dedicated sidebar**. There are exactly **two states**, and clicking a group **fully replaces** the sidebar body — no always-visible General section, no hover preview / fly-out, no collapsible sections (the one permitted sub-heading is the group's **Dashboards** block):

1. **Groups view** — a clean list of the user's top-level groups from `getWorkspaceGroups()`: **General** first, then every group the user's roles can access (Reception, Workshop, Parts, MOT, Valeting, Accounts, Reports, Admin, Developer …) in manifest order. General is itself a selectable group. The group whose department owns the current route is highlighted.
2. **Group view** — clicking a group swaps the entire body for that group's `ContextSidebar`: a **‹ Back to Groups** control at the top, the group name, an optional **Dashboards** sub-section (the group's role-visible dashboards), then a **flat list** of the group's pages (from `getDepartmentWorkspaceNav()`) with active states. There is no "Overview" entry — the department home is reached through its Dashboards block.

### Permission model (group assignment grants pages)

A page's **group** is its section's `department`. Assigning a group to a role automatically grants that role every **group-wide page** in the group — a page that declares no `roles` of its own. Individual pages may still carry `roles` as a restriction/grant, honoured independently of the group. Concretely (`itemVisibleTo` / `GROUP_ROLE_INDEX`):

- **Group assignment** lives on the department: `roles: []` ⇒ assigned to every authenticated user (General, Account); `roles: ["dev"]` ⇒ explicit; `roles: undefined` ⇒ derived from `ROLE_DEPARTMENT_MAP` for that department key.
- **A page with no `roles`** is visible to whoever the group is assigned to (add a page to a group → the group's roles see it, no per-page list needed).
- **A page with `roles`** is gated by exactly those roles, regardless of group assignment — so cross-group grants keep working (e.g. Sales sees the Admin group's Website Manager because that page lists `sales`, even though Sales is not assigned the Admin group).
- Existing permissions are unchanged: every current department page carries explicit `roles`, so the group layer is additive and net access is identical (locked by the landable-path parity tests).

### Additional rules

- **Which state shows:** an explicit group selection wins; **Back to Groups** forces the Groups view; otherwise the current route drives the group, so feature pages (`/jobs`, `/clocking`, `/deliveries` …) open directly in their group with the active link highlighted, while hub pages that belong to no group fall back to the clean Groups view. **Navigating between a group's own pages keeps that group open** — the explicit selection only clears when the destination route leaves the open group (checked against the group's home + dashboards + pages), so moving News Feed → Tracker inside General does not drop back to the Groups list.
- **No in-page workspace header:** `WorkspaceHeader` is no longer rendered, so pages (including dashboards) show no title/breadcrumb/quick-action block above their content. Quick actions live in the topbar only.
- The **Account controls** (clock in/out, Profile, Logout, Vision, dev tools) remain the sidebar's persistent bottom section in both states — they are not a navigable group.
- `resolveHome()` sends staff to their highest-priority workspace home after login.
- **Styling, animations, active states, the collapsed rail and the mobile drawer** are unchanged — the group view reuses the shared `.app-btn` nav primitives (icons in place of labels when collapsed; Back to Groups as an icon button).
- Topbar quick actions (`getQuickActions` → `WorkspaceHeader`/`StaffTopbar`) and favourites/recents are unchanged and remain outside the sidebar group list.

When `workspace_nav_enabled` is off:

- `StaffSidebar` renders the classic role-organised sidebar.
- `StaffLayout` and `StaffTopbar` use legacy fallback presentation paths.
- Dashboard shortcuts continue through the compatibility facade in `departmentDashboards.js`.
- Search uses the old imperative construction path.
- `pageAccess.js` still uses the manifest landable-path selector, so permissions do not drift during rollback.

---

## 5. Recipes

### Add a classic-visible page

Add it to `WORKSPACE_NAV_SECTIONS` with the existing legacy item shape:

```js
{ label: "Returns", href: "/deliveries/returns", roles: ["parts", "parts manager"] }
```

Then update the golden reference in `manifest.test.js`. If the page has detail routes, add inheritance in `DYNAMIC_DETAIL_EXTENDS`.

### Add a workspace-only context item

Add it to `WORKSPACE_CONTEXT_NAV_SECTIONS`. This makes it available to workspace context/search/permissions without changing the classic sidebar. Because these sections never feed the classic sidebar, they are the primary home for **group-inherited** pages — add them **without** a `roles` key so they inherit the group's assigned roles (this is how the Accounts Workspace pages are defined):

```js
{
  department: "accounts",
  order: 132,
  label: "Accounts Workspace",
  category: "departments",
  flag: null,
  items: [
    // No `roles` — inherits the Accounts group ({accounts, accounts manager}).
    { label: "Accounts", href: "/accounts" },
  ],
}
```

Add per-page `roles` here only for a genuine restriction or a cross-group grant. Test inclusion in `getDepartmentWorkspaceNav()` / `getSearchItems()` and exclusion from `toSidebarSections()`, and record the page in [`workspace-group-permissions.md`](./workspace-group-permissions.md).

### Add a quick action

Add it to `WORKSPACE_QUICK_ACTIONS`:

```js
{
  label: "Create Order",
  href: "/new-order",
  roles: ["parts", "parts manager"],
  departments: ["parts"],
}
```

`getQuickActions()` feeds both topbar and workspace header. Do not mirror it in `routeAccess.js`.

### Assign a Workspace Group to a role (grant a whole group)

Set the group's `roles` on its `WORKSPACE_DEPARTMENTS` entry:

- `roles: undefined` — derive the assigned roles from `ROLE_DEPARTMENT_MAP` for the department key (the default; keeps nav and reporting in lockstep).
- `roles: ["dev"]` — assign explicitly.
- `roles: []` — assign to every authenticated user (General, Account).

Every **group-wide page** in that group (a page with no `roles`) is then visible to the assigned roles automatically. Confirm with `getWorkspaceGroupRoles(departmentKey)`.

### Add a page that the whole group can see

Add it to the group's section in `WORKSPACE_CONTEXT_NAV_SECTIONS` **without a `roles` key** — it inherits the group's assigned roles:

```js
{ label: "Returns", href: "/deliveries/returns" } // visible to everyone assigned the Parts group
```

Put group-inherited pages in a **context** section, not `WORKSPACE_NAV_SECTIONS`: an un-roled item in `WORKSPACE_NAV_SECTIONS` would render in the byte-identical **classic** sidebar as visible to everyone (empty roles = all) and break the golden lock. If the page must also appear in the classic sidebar, it belongs in `WORKSPACE_NAV_SECTIONS` **with** explicit `roles` (classic contract) — update the golden reference in `manifest.test.js`.

To restrict a single page below its group, add `roles` to just that item (individual restriction). To grant a page to a role outside its group, list that role in the page's `roles` (individual cross-group grant). Record the page and its mode in [`workspace-group-permissions.md`](./workspace-group-permissions.md).

### Add or change page tabs

Edit `WORKSPACE_PAGE_TABS` only. Feature wrappers should stay thin and call `getPageTabs()` plus `isPageTabActive()`.

### Extend favourites or recents persistence

Keep consumers on `useWorkspaceShortcuts()`. Replace or augment its storage adapter rather than threading persistence logic into `StaffSidebar`, `WorkspaceHeader`, or pages.

---

## 6. Validation Contract

Run before handoff:

```bash
npm run test:unit -- src/config/navigation.test.js src/config/workspace/manifest.test.js
npm run check:borders
npm run check:encoding
npm run check:layers
npx eslint src/config/workspace/departments.js src/config/workspace/manifest.js src/config/workspace/manifest.test.js src/config/departmentDashboards.js src/config/routeAccess.js src/lib/auth/pageAccess.js src/hooks/useWorkspaceShortcuts.js src/components/layout/ContextSidebar.js src/components/layout/WorkspaceBreadcrumbs.js src/components/layout/WorkspaceHeader.js src/components/layout/StaffSidebar.js src/components/layout/StaffLayout.js src/components/layout/StaffTopbar.js src/components/HR/HrTabsBar.js src/components/Workshop/WorkshopTabsBar.js src/components/page-ui/parts/PartsWorkspaceTabs.js src/pages/login.js
```

Full `npm run lint` may still surface unrelated repo-wide lint debt. Report unrelated failures separately.

---

## 7. Rollout

1. **Phase 1 - Manifest foundation:** complete. Classic sidebar is manifest-derived and byte-identical.
2. **Phase 2 - Flagged department-first rail/context:** complete. Workspace rail/context/search path exists behind `workspace_nav_enabled`.
3. **Phase 3 - Selector consolidation:** complete. Dashboard shortcuts and topbar quick actions are manifest-backed.
4. **Phase 4 - Permission and route access consolidation:** complete. `pageAccess.js` reads the manifest selector directly, and landable-path parity is tested across configured role combinations.
5. **Phase 5 - ContextSidebar and tabs:** complete. Context rendering is reusable, and HR / Workshop / Parts tabs use manifest-owned `getPageTabs()` data.
6. **Phase 6 - Breadcrumbs, role-home and polish:** complete. Workspace Navigation is the primary UI with breadcrumbs, `resolveHome()`, Workspace Header, grouped context nav, favourites/recents, keyboard polish, and rollback support.
7. **Phase 7 - Group Sidebar Flow:** superseded by Phase 8. Introduced the two-state Groups view ⇄ Group view and removed the always-visible General section and all hover-preview/fly-out code.
8. **Phase 8 - Workspace Group Sidebar:** complete and the primary model (see §4). Each group is its own dedicated sidebar: the Group view is a **simple flat page list** with **‹ Back to Groups** — sub-group headings, collapsible sections, and in-sidebar quick actions are removed. Permissions are now group-based (`GROUP_ROLE_INDEX` / `getWorkspaceGroupRoles`): assigning a group to a role grants every group-wide page, with per-page `roles` as individual restrictions/grants. Routes, existing permissions, classic fallback, and mobile drawer behaviour are unchanged.

---

## 8. Absolute Don'ts

- Do not create navigation lists outside `src/config/workspace/`.
- Do not infer departments from URL prefixes.
- Do not add workspace-only links to `WORKSPACE_NAV_SECTIONS`.
- Do not hand-maintain topbar/accounts nav mirrors in `routeAccess.js`.
- Do not add tab arrays inside feature components.
- Do not change routes or permissions as part of UI polish.
- Do not introduce borders, hardcoded colours, or new design tokens.
- Do not reintroduce an always-visible General section alongside a selected group, hover-preview / fly-out behaviour, or collapsible sections — each Workspace Group replaces the whole sidebar and, apart from its **Dashboards** sub-section, is a flat page list (see §4).
- Do not gate a page by copying its group's role list onto the item. Leave group-wide pages un-roled (they inherit the group) and use per-page `roles` only for genuine restrictions or cross-group grants.
