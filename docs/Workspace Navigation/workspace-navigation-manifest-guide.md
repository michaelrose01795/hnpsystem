# Workspace Navigation Manifest - Authoring Guide

**Status:** Complete. Workspace Navigation is now the primary staff UI, with `workspace_nav_enabled` retained as the rollback switch until sign-off. Turning the flag off restores the classic role-organised sidebar/topbar presentation while route permissions continue to come from the manifest-derived landable-path selector.

This guide is the practical contract for changing navigation. The companion design specification explains the original rationale.

---

## 1. Finished Architecture

| File | Responsibility |
|---|---|
| [`src/config/workspace/departments.js`](../../src/config/workspace/departments.js) | All navigation data: departments, classic-compatible sections, workspace-only context sections, dashboard shortcuts, quick actions, and page tabs. |
| [`src/config/workspace/manifest.js`](../../src/config/workspace/manifest.js) | Pure selectors for every navigation surface: classic fallback, landable route access, department rail, grouped context nav, breadcrumbs, workspace header data, search, shortcuts, quick actions, role home, and page tabs. |
| [`src/config/workspace/flags.js`](../../src/config/workspace/flags.js) | `workspace_nav_enabled`, on by default. Set `NEXT_PUBLIC_WORKSPACE_WORKSPACE_NAV_ENABLED=false` to roll the presentation back. |
| [`src/components/layout/StaffSidebar.js`](../../src/components/layout/StaffSidebar.js) | Primary department-first sidebar when the flag is on; classic role-organised sidebar when the flag is off. |
| [`src/components/layout/ContextSidebar.js`](../../src/components/layout/ContextSidebar.js) | Reusable grouped workspace context renderer with active states, collapsible groups, Back to Departments, keyboard Escape handling, and preview fly-outs. |
| [`src/components/layout/WorkspaceHeader.js`](../../src/components/layout/WorkspaceHeader.js) | Active department header, quick actions, favourites, and recently used workspace shortcuts. |
| [`src/components/layout/WorkspaceBreadcrumbs.js`](../../src/components/layout/WorkspaceBreadcrumbs.js) | Breadcrumb trail rendered from `getBreadcrumbTrail()`. |
| [`src/hooks/useWorkspaceShortcuts.js`](../../src/hooks/useWorkspaceShortcuts.js) | Reusable favourites/recently-used storage adapter, currently backed by localStorage and ready for future persistence. |
| [`src/components/layout/StaffLayout.js`](../../src/components/layout/StaffLayout.js) | Mounts workspace header/breadcrumbs, workspace search data, and workspace quick actions only when the flag is on. |
| [`src/components/layout/StaffTopbar.js`](../../src/components/layout/StaffTopbar.js) | Uses manifest quick actions when supplied; keeps legacy actions for flag-off fallback. |
| [`src/components/HR/HrTabsBar.js`](../../src/components/HR/HrTabsBar.js), [`src/components/Workshop/WorkshopTabsBar.js`](../../src/components/Workshop/WorkshopTabsBar.js), [`src/components/page-ui/parts/PartsWorkspaceTabs.js`](../../src/components/page-ui/parts/PartsWorkspaceTabs.js) | Thin wrappers over manifest-owned `getPageTabs()` data. |
| [`src/pages/login.js`](../../src/pages/login.js) | Uses `resolveHome()` for staff post-login landing when workspace navigation is enabled. |
| [`src/lib/auth/pageAccess.js`](../../src/lib/auth/pageAccess.js) | Consumes `getAccessibleNavPaths()` directly, then applies always-allowed and dynamic-detail inheritance from `routeAccess.js`. |
| [`src/config/routeAccess.js`](../../src/config/routeAccess.js) | Edge/public/protected route lists and dynamic-detail inheritance only. Temporary topbar/accounts nav mirrors have been retired. |
| [`src/config/workspace/manifest.test.js`](../../src/config/workspace/manifest.test.js) | Locks classic output, landable-path parity, route access, grouped context nav, active states, page tabs, headers, shortcuts, and flag default. |

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
| `getWorkspaceRail(roles)` | `StaffSidebar` | Role-filtered department list. |
| `getDepartmentWorkspaceNav(departmentKey, roles)` | `ContextSidebar` | Overview plus grouped, deduped context sections. Preserves flat `items`. |
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

## 4. Runtime Behaviour

When `workspace_nav_enabled` is on:

- Users enter a department workspace with a department-first rail, grouped ContextSidebar, Workspace Header, breadcrumbs, quick actions, favourites, and recently used shortcuts.
- The sidebar Back to Departments action returns to the department list without navigating away.
- Context groups can collapse for larger workspaces and automatically reopen when their active route is inside the group.
- Workspace navigation items expose hover/focus previews, including the collapsed rail.
- `resolveHome()` sends staff to their highest-priority workspace home after login.
- Mobile still uses the existing drawer shell and the same manifest selectors.

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

Add it to `WORKSPACE_CONTEXT_NAV_SECTIONS`. This makes it available to workspace context/search/permissions without changing the classic sidebar:

```js
{
  department: "accounts",
  order: 132,
  label: "Accounts Workspace",
  category: "departments",
  flag: null,
  items: [
    { label: "Accounts", href: "/accounts", roles: ["accounts", "accounts manager"] },
  ],
}
```

Test inclusion in `getDepartmentWorkspaceNav()` / `getSearchItems()` and exclusion from `toSidebarSections()`.

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

## 7. Six-Phase Rollout

1. **Phase 1 - Manifest foundation:** complete. Classic sidebar is manifest-derived and byte-identical.
2. **Phase 2 - Flagged department-first rail/context:** complete. Workspace rail/context/search path exists behind `workspace_nav_enabled`.
3. **Phase 3 - Selector consolidation:** complete. Dashboard shortcuts and topbar quick actions are manifest-backed.
4. **Phase 4 - Permission and route access consolidation:** complete. `pageAccess.js` reads the manifest selector directly, and landable-path parity is tested across configured role combinations.
5. **Phase 5 - ContextSidebar and tabs:** complete. Context rendering is reusable, and HR / Workshop / Parts tabs use manifest-owned `getPageTabs()` data.
6. **Phase 6 - Breadcrumbs, role-home and polish:** complete. Workspace Navigation is the primary UI with breadcrumbs, `resolveHome()`, Workspace Header, grouped context nav, previews, favourites/recents, keyboard polish, and rollback support.

---

## 8. Absolute Don'ts

- Do not create navigation lists outside `src/config/workspace/`.
- Do not infer departments from URL prefixes.
- Do not add workspace-only links to `WORKSPACE_NAV_SECTIONS`.
- Do not hand-maintain topbar/accounts nav mirrors in `routeAccess.js`.
- Do not add tab arrays inside feature components.
- Do not change routes or permissions as part of UI polish.
- Do not introduce borders, hardcoded colours, or new design tokens.
