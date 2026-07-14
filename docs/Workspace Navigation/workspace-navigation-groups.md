# Workspace Group Sidebar - Architecture

**Status:** Primary navigation model (shipped). This is the source-of-truth description of how staff navigation works today. For step-by-step "how do I change navigation" recipes and the full selector list, see the companion [authoring guide](./workspace-navigation-manifest-guide.md).

---

## 1. The model in one line

Navigation is organised into **Workspace Groups**. The sidebar first shows the groups a user can access; clicking a group turns the whole sidebar into that group's own dedicated page list. Assigning a group to a role grants every page in the group.

---

## 2. Interaction — two states

Everything is driven by the manifest in [`src/config/workspace/`](../../src/config/workspace/) and gated by the `workspace_nav_enabled` flag. When the flag is on the sidebar has exactly two states:

### State 1 — Groups view

- A flat list of the user's top-level **Workspace Groups** from `getWorkspaceGroups(roles)`: **General** first, then every accessible department group (Reception, Workshop, Parts, MOT, Valeting, Accounts, Reports, Admin, Developer …) in manifest order.
- General is itself a selectable group — there is **no** always-visible General block.
- The group that owns the current route is highlighted.
- The **Account controls** (clock in/out, Profile, Logout, Vision, dev tools) sit at the bottom in both states; they are persistent app controls, not a group.

### State 2 — Group view

- Clicking a group replaces the **entire** sidebar body with that group's `ContextSidebar`:
  1. a **‹ Back to Groups** control at the top,
  2. the group name,
  3. an optional **Dashboards** sub-section — the group's role-visible dashboards (`getDepartmentWorkspaceNav(groupKey, roles).dashboards`, sourced from `WORKSPACE_DASHBOARD_SHORTCUTS`),
  4. a **flat list** of the group's pages (`.items`), with active states.
- Each group therefore behaves like its own dedicated sidebar.

**"Dashboards" is the only sub-heading.** The pages below it stay a flat list. There is no separate "Overview" entry — the department home is reached through its Dashboards block.

**Explicitly removed:** hover previews / fly-outs, collapsible sections, in-sidebar quick actions, and mixed General navigation.

### State selection

`activeGroupKey` = explicit selection (a clicked group) → the *Back to Groups* sentinel forces the Groups view → otherwise the route's owning department (`getActiveWorkspaceDepartment`).

**Navigating within a group keeps the group open.** When the destination route still belongs to the currently-open group (its home, a dashboard, or one of its pages), `StaffSidebar` preserves the selection — so moving from News Feed to Tracker inside General stays in the General group instead of dropping back to the Groups list. Only when the destination leaves the open group does the explicit selection clear and the route's owning department take over. Feature pages opened cold resolve directly to their group with the active link highlighted; hub pages that belong to no group show the clean Groups view.

### Preserved

Sidebar styling, expand/collapse animations, active states, the collapsed icon rail, the mobile drawer, and the manifest-driven architecture are all unchanged — the group view reuses the shared `.app-btn` nav primitives supplied by `StaffSidebar`.

---

## 3. Permission model — groups grant pages

> **Source of truth:** the full per-group inventory — every group, its assigned roles, every page, and inherit-vs-override (with the reason for each override) — lives in [`workspace-group-permissions.md`](./workspace-group-permissions.md). Update it whenever a page is added or re-scoped.

A page's **group** is its section's `department`. Assigning a Workspace Group to a role automatically grants that role every **group-wide page** in the group, while individual pages may still be restricted.

Implemented in [`manifest.js`](../../src/config/workspace/manifest.js) via `GROUP_ROLE_INDEX` + `itemVisibleTo(item, roleSet, departmentKey)`:

| Concept | Where it lives | Rule |
|---|---|---|
| **Group assignment** | `WORKSPACE_DEPARTMENTS[].roles` | `[]` ⇒ every authenticated user (General, Account); `["dev"]` ⇒ explicit; `undefined` ⇒ derived from `ROLE_DEPARTMENT_MAP` for the department key. |
| **Group-wide page** | a nav item with **no** `roles` | Visible to whoever the group is assigned to. Adding such a page grants it to the group with no per-page list. |
| **Restricted / cross-group page** | a nav item **with** `roles` | Gated by exactly those roles, independent of group assignment. Enables restricting one page below its group, or granting a page to a role outside its group (e.g. Sales → the Admin group's Website Manager). |

`getWorkspaceGroupRoles(departmentKey)` exposes the resolved assignment (`"*"` for all-access groups, otherwise a sorted role array).

### Why existing permissions are preserved

Every current department page already carries explicit `roles`, so the group layer is **additive** — net landable access is byte-identical to before (locked by the landable-path parity tests in `manifest.test.js`, which `pageAccess.js` also flows through). The group model changes the **authoring** default going forward: to expose a new page to a whole group, leave it un-roled.

> Note: `reports` and other groups whose key is not a `ROLE_DEPARTMENT_MAP` code derive an empty assignment, so their pages must (and do) carry explicit `roles`.

---

## 4. Key pieces

| Piece | Role |
|---|---|
| `WORKSPACE_DEPARTMENTS` | Group metadata + **group→role assignment** (`roles`). |
| `WORKSPACE_NAV_SECTIONS` / `WORKSPACE_CONTEXT_NAV_SECTIONS` | The pages, tagged by `department` (= group) and `order`. |
| `getWorkspaceGroups(roles)` | Groups view list (General + accessible departments; excludes Account). |
| `getDepartmentWorkspaceNav(key, roles)` | Group view — one group's role-visible `dashboards` + flat, deduped `items` page list. |
| `getWorkspaceGroupRoles(key)` | The roles assigned to a group. |
| `getAccessibleNavPaths(roles)` | Landable paths (nav == permissions), consumed by `pageAccess.js`. |
| `StaffSidebar` / `ContextSidebar` | Render the two states; classic role-organised sidebar when the flag is off. |

---

## 5. Rollback

Set `NEXT_PUBLIC_WORKSPACE_WORKSPACE_NAV_ENABLED=false`. The classic role-organised sidebar/topbar returns; routes, permissions (still manifest-derived), mobile behaviour, and page content are unchanged.

---

## 6. Rules when changing this model

- Keep all navigation data + permission logic in `src/config/workspace/`.
- Leave group-wide pages un-roled; use per-page `roles` only for real restrictions or cross-group grants. Put un-roled group pages in `WORKSPACE_CONTEXT_NAV_SECTIONS` — an un-roled item in `WORKSPACE_NAV_SECTIONS` would show to everyone in the byte-identical classic sidebar.
- Do not reintroduce sub-group headings, collapsible sections, hover previews, or an always-visible General block.
- Keep the classic fallback (`toSidebarSections()`) byte-identical unless a task explicitly changes classic navigation.
- Run the validation contract in the [authoring guide](./workspace-navigation-manifest-guide.md#6-validation-contract) before handoff.
