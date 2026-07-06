# Workspace Group Permissions — Source of Truth

**Status:** Active (Phase 8 — Workspace Group Inheritance is the default permission model).

This document is the long-term source of truth for **Workspace Groups**, the **roles assigned** to each group, the **pages** contained in each group, and — for every page — whether it **inherits** the group's permissions or **intentionally overrides** them (and why).

It is a companion to:

- [`workspace-navigation-groups.md`](./workspace-navigation-groups.md) — the Group Sidebar architecture.
- [`workspace-navigation-manifest-guide.md`](./workspace-navigation-manifest-guide.md) — the authoring contract (recipes, selectors, validation).

The data below is a projection of the manifest in
[`src/config/workspace/departments.js`](../../src/config/workspace/departments.js) resolved through the group permission model in
[`src/config/workspace/manifest.js`](../../src/config/workspace/manifest.js). If the two ever disagree, the code wins — update this document to match and add a locking test.

---

## 1. The Model in One Paragraph

A page's **Workspace Group** is its section's `department`. **Assigning a group to a role automatically grants that role every _group-wide_ page in the group** — a page that declares **no** `roles` of its own. This is the default: new group pages should be added **without** a `roles` key so they inherit the group. A page **may** still carry its own `roles` as an **intentional exception**:

- an **individual restriction** (a page only some of the group should see — e.g. management/financial/developer pages), or
- a **cross-group grant** (a role outside the group needs the page — e.g. Sales reaching the Admin group's Website Manager).

Per-page `roles` are honoured **independently of** group assignment, so both kinds of exception keep working. The selectors that resolve this are `itemVisibleTo`, `groupGrantsRole`, `GROUP_ROLE_INDEX` and `getWorkspaceGroupRoles(departmentKey)`.

### How a group's roles are assigned

The group assignment lives on the department entry in `WORKSPACE_DEPARTMENTS`:

| `roles` value on the department | Assigned to |
|---|---|
| `[]` | **Every authenticated user** (`getWorkspaceGroupRoles` returns `"*"`). Used by **General** and **Account**. |
| `["dev"]` (explicit non-empty array) | Exactly those roles. Used by **Developer**. |
| `undefined` | **Derived** from `ROLE_DEPARTMENT_MAP` for that department key — so navigation and reporting never drift. Used by every real department. |

A department key that is not present in `ROLE_DEPARTMENT_MAP` (e.g. `reports`) derives an **empty** role set — its pages are then gated purely by their own explicit `roles`. This is intentional: report visibility is a per-report, cross-department audience, not a single group.

### Why NAV_SECTIONS pages still carry explicit roles

Pages declared in `WORKSPACE_NAV_SECTIONS` do **double duty**: they also render the **byte-identical classic sidebar** (`toSidebarSections()` → `StaffSidebar` when `workspace_nav_enabled` is off). The classic sidebar filters by each item's own `roles` and treats an empty/absent list as "everyone". Removing a page's `roles` there would change classic-fallback behaviour and break the byte-identical lock. **Those role arrays are therefore load-bearing for rollback, not redundant**, and are kept.

De-duplication via inheritance is applied to:

- **workspace-only** sections (`WORKSPACE_CONTEXT_NAV_SECTIONS`), which never appear in the classic sidebar, and
- **every future group page** — add it un-roled and it inherits the group.

Legend used below:

- **Inherit** — page has no `roles`; visible to the group's assigned roles.
- **Override (restriction)** — page's `roles` narrow it to a subset of the group.
- **Override (cross-grant)** — page's `roles` include roles from outside the group.
- **Classic-locked** — role array is retained because the page also feeds the byte-identical classic sidebar; its audience is unchanged from legacy.

---

## 2. Workspace Groups

Groups are listed in manifest order. "Assigned roles" is the output of `getWorkspaceGroupRoles(key)`.

### General — `general`
**Assigned roles:** `*` (every authenticated user) · **Category:** general · **Home:** `/newsfeed`

| Page | Route | Mode | Notes |
|---|---|---|---|
| News Feed | `/newsfeed` | Inherit (group-wide) | `roles: []` retained for classic byte-identical fallback; empty = all = the General group. |
| Messages | `/messages` | Inherit (group-wide) | As above. |
| Archive Job | `/archive` | Inherit (group-wide) | As above. |
| Tracker | `/tracking` | Override (restriction) | Limited to `techs, service, service manager, workshop manager, valet service, admin`. Operational tracker — not for all staff. |

### Admin — `management`
**Assigned roles:** `admin manager, buying director, general manager, manager, owner, sales director` · **Category:** departments · **Home:** `/dashboard/managers`

| Page | Route | Mode | Notes |
|---|---|---|---|
| Next Jobs | `/nextjobs` | Override (restriction) · Classic-locked | `admin manager` only within the group (legacy per-role curation). |
| Job Cards | `/jobs` | Override (restriction) · Classic-locked | `admin manager` only. |
| User Admin | `/admin/users` | Override (restriction) · Classic-locked | `admin manager, owner`. Sensitive user administration. |
| Compliance | `/admin/compliance` | Override (restriction) · Classic-locked | `admin manager, owner`. |
| HR Manager | `/hr/manager` | Override (restriction) · Classic-locked | `owner` only. |
| Website Manager | `/website-manager` | Override (cross-grant) | `owner, admin, admin manager, general manager, sales`. Shared content/analytics area — grants **admin** and **sales** (outside the group). Keep in sync with `WEBSITE_MANAGER_ROLES` in `src/pages/staff/website-manager.js`. |
| Website Preview | `/website-manager?tab=preview` | Override (cross-grant) | Same audience as Website Manager. |
| Website Shop | `/website-manager?tab=shop` | Override (cross-grant) | Same audience. |
| Public Shop (live) | `/website#shop` | Override (cross-grant) | Same audience. |

### Reception — `service`
**Assigned roles:** `after sales director, after sales manager, aftersales manager, service, service manager` · **Category:** departments · **Home:** `/dashboard/service`

| Page | Route | Mode | Notes |
|---|---|---|---|
| Job Cards | `/jobs` | Override (restriction) · Classic-locked | `service, service manager, aftersales manager`. |
| Goods In | `/goods-in` | Override (restriction) · Classic-locked | `service, service manager, aftersales manager`. |
| New Job | `/new-job` | Override (restriction) · Classic-locked | `service, service manager`. |
| Next Jobs | `/nextjobs` | Override (restriction) · Classic-locked | `service manager`. |
| Mobile Appointments | `/appointments` | Override (restriction) · Classic-locked | `service manager`. |

> The assigned roles `after sales director` / `after sales manager` currently match no page in this group (legacy sections key on `aftersales manager`). Access is preserved exactly as legacy — do not "fix" this by broadening pages without a deliberate access decision.

### Workshop — `workshop`
**Assigned roles:** `mobile technician, tech, technician, techs, workshop controller, workshop manager` · **Category:** departments · **Home:** `/dashboard/workshop`

| Page | Route | Mode | Notes |
|---|---|---|---|
| Next Jobs | `/nextjobs` | Override (restriction) · Classic-locked | `workshop manager`. |
| Job Cards | `/jobs` | Override (restriction) · Classic-locked | `workshop manager`. |
| Clocking | `/clocking` | Override (restriction) · Classic-locked | `workshop manager`. |
| Consumables Tracker | `/consumables-tracker` | Override (restriction) · Classic-locked | `workshop manager`. |
| Goods In | `/goods-in` | Override (restriction) · Classic-locked | `workshop manager`. |
| My Jobs | `/tech` | Override (restriction) · Classic-locked | `techs, mobile technician`. |
| Request Consumables / Parts | `/consumables-request` | Override (restriction) · Classic-locked | `techs, mobile technician`. |
| Efficiency | `/tech/efficiency` | Override (restriction) · Classic-locked | `techs`. |
| Mobile Appointments | `/appointments` | Override (restriction) · Classic-locked | `mobile technician`. |
| New Mobile Job | `/new-job` | Override (restriction) · Classic-locked | `mobile technician`. |

### MOT — `mot`
**Assigned roles:** `mot tester` · **Category:** departments · **Home:** `/dashboard/mot`

| Page | Route | Mode | Notes |
|---|---|---|---|
| My Jobs | `/tech` | Classic-locked (equals group) | `mot tester` == the group's only role. Retained explicit for the classic sidebar; a future workspace-only MOT page should be added un-roled to inherit. |
| Efficiency | `/tech/efficiency` | Classic-locked (equals group) | As above. |

### Parts — `parts`
**Assigned roles:** `parts, parts driver, parts manager` · **Category:** departments · **Home:** `/dashboard/parts`

| Page | Route | Mode | Notes |
|---|---|---|---|
| Job Cards | `/jobs` | Override (restriction) · Classic-locked | `parts, parts manager` (excludes `parts driver`). |
| Stock Catalogue | `/stock-catalogue` | Override (restriction) · Classic-locked | `parts, parts manager`. |
| Goods In | `/goods-in` | Override (restriction) · Classic-locked | `parts, parts manager`. |
| Deliveries | `/deliveries` | Override (restriction) · Classic-locked | `parts, parts manager`. |

### Valeting — `valeting`
**Assigned roles:** `valet sales, valet service` · **Category:** departments · **Home:** `/dashboard/valeting`

| Page | Route | Mode | Notes |
|---|---|---|---|
| Valet Jobs | `/valet` | Override (restriction) · Classic-locked | `valet service` only — `valet sales` is a sales-side role without workshop valet-job access. |

### Accounts — `accounts`
**Assigned roles:** `accounts, accounts manager` · **Category:** departments · **Home:** `/dashboard/accounts` · **Sensitivity:** financial

| Page | Route | Mode | Notes |
|---|---|---|---|
| Payslips | `/accounts/payslips` | Override (cross-grant) · Classic-locked | `accounts, accounts manager, admin, admin manager, owner`. Payroll oversight extends to admin/management beyond the group. |
| Accounts | `/accounts` | **Inherit (group-wide)** | Workspace-only (`WORKSPACE_CONTEXT_NAV_SECTIONS`). De-duplicated in Phase 8 — no per-page `roles`; inherits `{accounts, accounts manager}`. |
| Company Accounts | `/company-accounts` | **Inherit (group-wide)** | As above. |
| Invoices | `/accounts/invoices` | **Inherit (group-wide)** | As above. |
| Reports | `/accounts/reports` | **Inherit (group-wide)** | As above. Distinct from the Reports group's `/reports/accounts`. |

### Reports — `reports`
**Assigned roles:** _(none derived — see below)_ · **Category:** departments · **Home:** `/reports/overview` · **Flag:** `reporting_nav_enabled`

`reports` is not a `ROLE_DEPARTMENT_MAP` department, so the group grants **no** roles. Every report is intentionally gated by its own **cross-department audience** — this is the model for reports, not an accident.

| Page | Route | Mode | Audience source |
|---|---|---|---|
| Workshop Reports | `/reports/workshop` | Override (explicit audience) | `WORKSHOP_REPORT_ROLES` |
| Parts Reports | `/reports/parts` | Override (explicit audience) | `PARTS_REPORT_ROLES` |
| Service Advisor Reports | `/reports/service` | Override (explicit audience) | `SERVICE_REPORT_ROLES` |
| MOT Reports | `/reports/mot` | Override (explicit audience) | `MOT_REPORT_ROLES` |
| Paint Reports | `/reports/paint` | Override (explicit audience) | `PAINT_REPORT_ROLES` |
| Accounts Reports | `/reports/accounts` | Override (explicit audience) | `ACCOUNTS_REPORT_ROLES` (financial + executive union; no general `admin`) |
| Valeting Reports | `/reports/valeting` | Override (explicit audience) | `VALETING_REPORT_ROLES` |
| Admin Reports | `/reports/admin` | Override (explicit audience) | `ADMIN_REPORT_ROLES` |
| Executive Reports | `/reports/overview` | Override (explicit audience) | `EXECUTIVE_REPORT_ROLES` |

### Developer — `developer`
**Assigned roles:** `dev` (explicit) · **Category:** departments · **Home:** `/dev`

| Page | Route | Mode | Notes |
|---|---|---|---|
| Developer Platform | `/dev` | Override (hard boundary) · Classic-locked | `dev` only. Kept explicit as a security boundary — the dev platform must never depend on group derivation. `dev` is synthetic (dev-login mint) and never held by a staff session. |

### Account — `account`
**Assigned roles:** `*` (every authenticated user) · **Category:** account · **Home:** `/profile`

Account is **not** a navigable group in the Group Sidebar — it renders as the sidebar's persistent bottom controls (clock in/out, Profile, Logout). Permission-wise it is open to all.

| Page | Route | Mode | Notes |
|---|---|---|---|
| Profile | `/profile` | Inherit (group-wide) | `roles: []` retained for classic byte-identical fallback; empty = all = the Account group. |
| Logout | _(action, no route)_ | — | `action: "logout"`. |

---

## 3. Roles Without a Derived Operational Group

Some roles map to no navigable workspace group (they are absent from `ROLE_DEPARTMENT_MAP` or map to a department with no nav presence). They rely on the all-access **General**/**Account** groups plus **cross-group grants**:

| Role | Group derivation | Reaches operational pages via |
|---|---|---|
| `admin` | maps to `admin` dept (no workspace group) | cross-grants: Website Manager, Payslips, Tracker, Admin Reports. |
| `sales` | not in `ROLE_DEPARTMENT_MAP` | cross-grant: Website Manager family. |
| `receptionist` | maps to `admin` dept (no group) | General/Account only. |
| `painters` | maps to `paint` dept (no group) | General/Account only; Paint Reports via explicit audience. |

When adding a page these roles should see, add the role to the page's `roles` (a cross-grant) — do **not** invent a group for them unless a real department nav surface is being introduced.

---

## 4. Adding or Changing Pages (the forward contract)

1. **A page the whole group should see** → add it to the group's section **without** a `roles` key. It inherits the group automatically. Prefer `WORKSPACE_CONTEXT_NAV_SECTIONS` for workspace-only pages so the classic sidebar is untouched.
2. **A page only some of the group should see** → add `roles` with the narrower list (Override — restriction). Record the reason in this document.
3. **A page a role outside the group needs** → add that role to the page's `roles` (Override — cross-grant). Record it here.
4. **A classic-visible page** → it goes in `WORKSPACE_NAV_SECTIONS` and **must** keep explicit `roles` (classic byte-identical contract). Update the golden reference in `manifest.test.js`.
5. **Assigning a whole group to a role** → set the department's `roles` (`undefined` to derive from `ROLE_DEPARTMENT_MAP`, an explicit array, or `[]` for all-access). Confirm with `getWorkspaceGroupRoles(key)`.

Always re-run the validation contract (below) and update this document so it stays authoritative.

---

## 5. Validation

The model and its parity are locked by [`src/config/workspace/manifest.test.js`](../../src/config/workspace/manifest.test.js):

- `workspace group permission model` — group assignments, group-wide grants, cross-group grants.
- `workspace group inheritance (Phase 8 — default permission model)` — accounts pages carry no per-page roles; un-roled pages resolve to exactly the group's roles; landable access equals the pre-de-duplication explicit set for every configured role; intentional overrides keep their gate.
- `permission parity (nav == access)` — the landable-path set is identical, per role, to the legacy walk (and to `pageAccess.js`), across all configured role combinations.
- `byte-identical sidebar reproduction` — `toSidebarSections()` is unchanged (classic fallback preserved).

Run before handoff:

```bash
npm run test:unit -- src/config/navigation.test.js src/config/workspace/manifest.test.js
npm run check:borders
npm run check:encoding
npm run check:layers
```
