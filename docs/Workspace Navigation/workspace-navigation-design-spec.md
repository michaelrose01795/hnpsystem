# Workspace Navigation — Design Specification

**Status:** Design proposal — no code changed. This document is the single source of truth for the Workspace Navigation programme and is written so each phase in §12 can be lifted directly into an implementation prompt.

**Author context:** Produced from a full read-only audit of routing, the sidebar/layout shell, the auth/role system, the CSS/token architecture, and every existing navigation abstraction in the codebase (see §2 for the evidence base).

**Prime directive (from CLAUDE.md §7):** the sidebar, `Layout`, and the nav config are protected global surfaces. Every change here is a flagged, staged, reversible change requiring sign-off. Nothing in this document is "just do it" — it is a plan to be executed phase-by-phase behind a feature flag.

---

## 1. Executive summary

### 1.1 What we have today
HNPSystem already has a **config-driven navigation system**. The sidebar is rendered from `src/config/navigation.js` (`sidebarSections`), role-filtered case-insensitively, and — critically — the **same config is the permission model**: `src/lib/auth/pageAccess.js` derives "which pages may this user land on" by walking `sidebarSections`. This is a genuine strength and must be preserved.

### 1.2 The two core problems
1. **The sidebar is organised by _role_, not by _department_.** There is one section per role (`Service`, `Service Manager`, `Workshop Manager`, `Techs`, `Parts`, `Parts Manager`, …), each repeating the same hrefs. `Job Cards → /jobs` is declared in ~7 separate role sections. A multi-role user sees several headings that overlap. This does not scale and does not match how the business thinks (by department).
2. **Navigation data is fragmented across 6+ sources.** Adding "department nav + context sidebars + fly-outs" naively would create a 7th, 8th, 9th source. The programme's #1 requirement — *no duplicate navigation systems* — can only be met by **consolidating first**, then building every new surface as a *consumer* of one manifest.

### 1.3 The proposal in one paragraph
Introduce a single **Navigation Manifest** — one declarative, department-first module that every navigation surface and the permission layer derive from. Keep the existing, battle-tested shell (`StaffLayout` / `StaffSidebar`) and re-point it at the manifest. Then layer on, behind a flag and in order: (Tier 1) a **department-organised primary rail**, (Tier 2) a **per-department Context Sidebar** replacing the ad-hoc `HrTabsBar`/`WorkshopTabsBar`/`PartsWorkspaceTabs`, (Tier 3) the **existing in-page tab primitives** standardised on `TabGroup`, plus **Quick Preview fly-outs**, **breadcrumbs**, and a **role→home resolver** — all reading from the manifest. Adding a future department or page becomes a *single manifest edit* that updates the rail, context nav, breadcrumbs, search, and access rules simultaneously.

---

## 2. Evidence base (files audited)

| Concern | Key files |
|---|---|
| Shell & layout | `src/components/layout/StaffLayout.js`, `StaffSidebar.js`, `StaffTopbar.js`, `sidebarNavIcons.js`; shims `src/components/Layout.js`, `Sidebar.js`; `src/pages/_app.js` (`getLayout`, `PageAccessGuard`) |
| Nav config (source of truth) | `src/config/navigation.js` (`sidebarSections`), `src/config/departmentDashboards.js` (`departmentDashboardShortcuts`) |
| Route access / permissions | `src/config/routeAccess.js`, `src/lib/auth/pageAccess.js`, `src/proxy.js` (edge), `src/components/ProtectedRoute.js` |
| Roles | `src/lib/auth/roles.js`, `src/lib/auth/roleGuard.js`, `src/config/users.js`, `src/context/UserContext.js`, `src/pages/api/auth/[...nextauth].js` |
| **Canonical department taxonomy** | `src/lib/reporting/config/departments.js` (`ROLE_DEPARTMENT_MAP`), `src/lib/reporting/permissionScope.js`, `src/lib/reporting/config/navigation.js` |
| Tab primitives | `src/components/ui/tabAPI/TabGroup.js` (`TabGroup`, `TabLinkGroup`), `src/components/ui/StaffTabs.js` |
| Department tab bars (to be unified) | `src/components/HR/HrTabsBar.js`, `src/components/Workshop/WorkshopTabsBar.js`, `src/components/page-ui/parts/PartsWorkspaceTabs.js`, `src/components/reporting/ReportFilterBar.js` |
| Fly-out primitives | `src/components/popups/ModalPortal.js`, `src/components/ui/GlobalTooltip.js`, `src/components/GlobalSearch.js`, `src/lib/swr/prefetch.js` |
| Surface / layout primitives | `src/components/ui/LayerSurface.js`, `LayerTheme.js`, `src/components/Section.js`, `src/components/ui/Card.js`, `src/components/ui/layout-system/*` |
| CSS / tokens | `src/styles/theme.css`, `src/styles/staffglobal.css`, `src/styles/families/{buttons,tabs,toolbars,cards}.css` |
| Responsive | `src/hooks/useIsMobile.js`, viewport logic in `StaffLayout.js` |
| Config-driven page template | `src/components/reporting/workshop/workshopReportConfig.js` + `src/pages/reports/workshop.js` |

---

## 3. Current-state analysis

### 3.1 Routing
- Next.js **Pages Router**. ~158 user-facing route files under `src/pages` (excluding `api/`). Top-level areas: `accounts`, `admin`, `appointments`, `archive`, `clocking`, `company-accounts`, `customers`, `dashboard`, `deliveries`, `dev`, `goods-in`, `hr`, `job-cards`, `jobs`, `messages`, `mobile`, `new-job`, `new-order`, `parts`, `reports`, `tech`, `tracking`, `valet`, `vhc`, `vision`, `website`, plus root files.
- **Flat routing:** most operational routes are single-segment (`/jobs`, `/deliveries`, `/goods-in`, `/nextjobs`, `/clocking`). Route nesting does **not** encode department — e.g. parts pages live at `/deliveries`, `/goods-in`, `/stock-catalogue`, `/parts-manager`, not under `/parts/*` (they were deliberately moved out; see the `// moved from …` comments in `routeAccess.js`). **Department is a logical grouping, not a URL prefix.** This is important: the manifest must map routes→departments explicitly; it cannot infer department from the path.
- Redirect shims exist at section roots (`/parts`, `/workshop`, `/vhc`, `/job-cards`, `/customers`) that bounce to a real destination.

### 3.2 The navigation shell (persistent)
- `_app.js` mounts one persistent `<Layout>` via the `getLayout` pattern; only page children swap on navigation, so the sidebar/topbar stay mounted. Pages override `Component.getLayout` for custom shell props.
- `StaffLayout` owns viewport state and renders: desktop sidebar rail **or** mobile drawer, `StaffTopbar`, and the page card (`app-page-shell → app-page-content → app-page-card → app-page-stack`).
- **Active-state highlighting is optimistic:** `StaffLayout` sets `pendingHref` on `routeChangeStart` (Pages Router doesn't update `asPath` until completion) so the clicked item lights up instantly. Any new nav surface must plug into this same mechanism.
- **Responsive triad (measured in `StaffLayout`, not the hook):** `isTablet = width ≤ 1024`, `isMobile = width ≤ 640`, `isVerticalPhone`. Desktop = sticky rail collapsible 260px↔48px icon rail; ≤1024px = full-screen modal drawer (`role="dialog" aria-modal`). `useIsMobile(bp=640)` exists for lightweight component checks.

### 3.3 The nav config (the good part)
`sidebarSections` item shape:
```js
{ label, category: "general" | "departments" | "account",
  items: [{ label, href, roles: string[], action?, keywords?, description? }] }
```
- `roles: []` → visible to all authenticated users. `href: null` + `action: "logout"` → the logout control.
- `hasAccess(item)` in `StaffSidebar` does a case-insensitive `.some()` match of `item.roles` against the user's roles.
- The Reports section is **feature-flag gated** (`getReportingFlag("reporting_nav_enabled")`) and its role sets are **derived** from `ROLE_DEPARTMENT_MAP` via `rolesForDepts()` — proof the codebase already prefers *derived* role sets over hardcoded ones, and already has a flag-gated nav-section pattern to copy.

### 3.4 The permission coupling (must preserve)
`pageAccess.js` walks `sidebarSections` (+ `TOPBAR_LINKS` + `ACCOUNTS_NAV_LINKS`) to build the set of landable paths; `PageAccessGuard` in `_app.js` redirects anything outside that set to `/newsfeed`. **Rule: "you can only land on a page that appears in your nav."** Therefore *any page we want reachable must be represented in the manifest* (or in `routeAccess.js` always-allowed lists). This is the single most important constraint on the whole design: **navigation config == route authorisation.**

### 3.5 The fragmentation problem (the thing to fix)
Navigation-relevant data currently lives in **at least six** places:

| # | Source | What it declares |
|---|---|---|
| 1 | `src/config/navigation.js` `sidebarSections` | Primary sidebar, role-organised (+ flag-gated reports) |
| 2 | `src/config/departmentDashboards.js` `departmentDashboardShortcuts` | The "Dashboard" shortcut group at the top of the rail |
| 3 | `src/config/routeAccess.js` `TOPBAR_LINKS`, `ACCOUNTS_NAV_LINKS`, `DYNAMIC_DETAIL_EXTENDS` | Topbar quick-actions, runtime Accounts section mirror, detail-page inheritance |
| 4 | `StaffLayout.js` | Imperative `addNavItem(...)` calls building `navigationItems` for `GlobalSearch`; **and** the dynamically-built `accountsSidebarSections` passed via `extraSections` |
| 5 | `StaffTopbar.js` | `SERVICE_ACTION_LINKS`, `PARTS_ACTION_LINKS` |
| 6 | `src/lib/reporting/config/navigation.js` | `getReportingNavSection()` — a **second, "ready-to-plug, NOT wired in"** reporting nav (duplicates the reports block already in `navigation.js`) |

Plus three hand-maintained department tab bars (`HrTabsBar`, `WorkshopTabsBar`, `PartsWorkspaceTabs`) and two tab primitives (`TabGroup` vs `StaffTabs`). Every one of these must be kept in sync by hand today. **This is the duplication the programme must eliminate — and the reason we consolidate before we build.**

### 3.6 Roles & departments
- Role constants and groups live in `src/lib/auth/roles.js` (all **lowercase**; matched via `hasAnyRole` which lowercases). But `ProtectedRoute.allowedRoles` compares **UPPER-CASE**, and `UserContext`/NextAuth expose client roles **upper-cased**. **Two case conventions coexist** — the manifest layer must normalise at its boundary (lowercase internally, as the sidebar already does).
- **`ROLE_DEPARTMENT_MAP`** (`src/lib/reporting/config/departments.js`) is the canonical role→department taxonomy and is *already* the nav's role-derivation source for reports. Departments: `workshop, parts, service, mot, valeting, paint, accounts, admin, hr, management`. **This is the taxonomy the whole Workspace Navigation system is built on — we do not invent a new one.**
- `permissionScope.js` adds scope levels (`self / department / cross-department / executive`) and sensitivity flags (`financial`, `pii`) used by reporting. The manifest can reuse these for high-sensitivity areas (Accounts, HR, Admin).

### 3.7 UI / CSS substrate (everything we need already exists)
- **Surfaces:** `LayerSurface` (`--surface`) / `LayerTheme` (`--theme`) are the only two surface primitives; strict `Surface→Theme→Surface` alternation as you nest; **borderless** (Border Sweep — state is shown by tint + `--primary` active fill, never borders). `Section`/`Card` route through `LayerSurface`.
- **Layout system:** `PageShell → ContentWidth → SectionShell`, plus `TabRow`, `FilterToolbarRow`, `StatCard` — all auto-register in the Dev Layout Overlay via `DevLayoutSection`.
- **Nav tokens already exist** in `theme.css`: `--nav-shell-bg`, `--nav-link-bg`, `--nav-link-bg-hover`, `--nav-link-bg-active (=--primary)`, `--tab-container-bg`, `--tab-item-*`, `--tab-button-*`. **No new colours needed.**
- **Canonical nav-link shape:** `.app-btn app-btn--secondary app-btn--nav` + `.is-active`.
- **Z-index scale:** `--z-sticky 200`, `--z-overlay 500`, `--z-popover 1500` — for pinned context rails, drawer scrims, and fly-outs respectively.
- **Scope caveat:** all `.app-*` rules are prefixed `html.staff-scope`; new nav markup must render under that root (it will, inside the existing shell). Note CLAUDE.md refers to `globals.css` for these classes but they actually live in **`staffglobal.css`**.

### 3.8 Confirmed gaps (net-new work)
- **No breadcrumbs** anywhere (only "proposed" in the dev showcase). Intended home: `src/components/ui/`.
- **No generic Popover/Flyout/Drawer** component — must be composed from `ModalPortal` + `GlobalTooltip` positioning.
- **No Context Sidebar abstraction** — department context is provided by three separate hand-built tab bars, only one of which (`HrTabsBar`) is auto-mounted by the layout.
- **No role→home resolver** — `/` just bounces to `/login`; nothing computes "this role's landing page" even though the data (`ROLE_DEPARTMENT_MAP` + `departmentDashboardShortcuts`) exists.

---

## 4. Design principles

1. **One manifest, many consumers.** Every nav surface (rail, context sidebar, tabs, breadcrumbs, search, quick-actions) and the nav-derived permission set are *derived* from a single declarative Navigation Manifest. No surface owns its own list.
2. **Department-first.** The manifest's top-level unit is the **department** (from `ROLE_DEPARTMENT_MAP`), not the role. Roles are an attribute used for *visibility*, computed per department/page — ideally derived, not hand-listed.
3. **Preserve the permission coupling.** The manifest is a superset of today's `sidebarSections`; `pageAccess.js` derives from the manifest. Navigation and authorisation stay one and the same.
4. **Evolve the shell, don't rewrite it.** Keep `StaffLayout`/`StaffSidebar` and their hard-won behaviours (optimistic highlight, collapse animation, mobile drawer, presentation mode). Change the *data* they consume and *add* surfaces; do not replace the shell.
5. **Everything behind a flag.** Ship each tier behind `workspace_nav_enabled` (mirroring `reporting_nav_enabled`) so the old rail remains the fallback until each phase is signed off.
6. **Reuse the design system verbatim.** `LayerSurface`/`LayerTheme`, `TabGroup`, existing `--nav-*`/`--tab-*` tokens, `.app-btn--nav`. No new colours, no borders, no one-off CSS.
7. **Adding a department or page is one edit.** The acceptance test for the whole programme: a new department/page added to the manifest appears — correctly role-gated — in the rail, context nav, breadcrumbs, search, and becomes landable, with no other file touched.

---

## 5. The Navigation Manifest (the heart of the design)

### 5.1 Where it lives
A new folder `src/config/workspace/` (edge-safe: plain data + pure helpers only, like `routeAccess.js`, because `pageAccess.js`/`proxy.js` import it):
```
src/config/workspace/
  departments.js      // department definitions (the manifest)
  manifest.js         // assembly + derivation helpers (selectors)
  manifest.test.js    // locks role-gating & derivations (mirror navigation.test.js)
```
`src/config/navigation.js` is **retained** and becomes a thin derived export (`sidebarSections = toSidebarSections(manifest)`) so nothing that imports it breaks during transition.

### 5.2 Schema
```js
// A department = one Tier-1 entry in the primary rail.
{
  key: "workshop",                 // matches ROLE_DEPARTMENT_MAP dept codes
  label: "Workshop",
  icon: "workshop",                // resolved via sidebarNavIcons.getSidebarNavIcon
  home: "/dashboard/workshop",     // where the department switcher lands you
  order: 20,                       // rail ordering
  // roles: DERIVED from ROLE_DEPARTMENT_MAP by default; override only for
  // cross-cutting areas. Empty/undefined => derived. [] on a page => all staff.
  roles: undefined,
  sensitive: null,                 // "financial" | "pii" | null (reuse permissionScope)
  flag: null,                      // optional feature flag gate, e.g. "reporting_nav_enabled"

  // Tier-2 context nav: the pages/tools shown when inside this department.
  // Grouped so the context sidebar can render subheadings and stay scalable.
  groups: [
    {
      label: "Operations",         // context-sidebar subheading (optional)
      items: [
        { label: "Next Jobs",     href: "/nextjobs",             roles: ["workshop manager","service manager","admin manager"] },
        { label: "Job Cards",     href: "/jobs",                 roles: [] /* all in-dept */ },
        { label: "Clocking",      href: "/clocking",             roles: ["workshop manager"] },
        { label: "Consumables",   href: "/consumables-tracker",  roles: ["workshop manager"] },
      ],
    },
  ],

  // Tier-3 in-page tabs (optional) for a page that hosts sub-views.
  // Mirrors WORKSHOP_TABS today; consumed by TabGroup/TabLinkGroup.
  pageTabs: {
    "/reports/workshop": [ { value: "overview", label: "Overview" }, ... ],
  },

  // Quick-actions surfaced in the topbar for this department (replaces
  // SERVICE_ACTION_LINKS / PARTS_ACTION_LINKS).
  quickActions: [ { label: "Create Job Card", href: "/new-job", roles: SERVICE_ACTION_ROLE_SET } ],
}
```
Cross-cutting items that don't belong to one department (News Feed, Messages, Tracker, Profile, Logout) live in reserved pseudo-departments `general` and `account`, preserving today's three-category model (`general` / `departments` / `account`).

### 5.3 Derivations (selectors in `manifest.js`)
One function per consumer, so every surface is a pure projection of the manifest:

| Selector | Replaces / feeds | Output |
|---|---|---|
| `getDepartmentsForRoles(roles)` | new Tier-1 rail | ordered, role-filtered department list |
| `getContextNav(departmentKey, roles)` | new Tier-2 context sidebar; `HrTabsBar`/`WorkshopTabsBar`/`PartsWorkspaceTabs` | grouped, role-filtered items |
| `getPageTabs(pathname)` | reporting/job-card tabs | `TabGroup` items |
| `getQuickActions(roles, activeDept)` | `StaffTopbar` action links | topbar buttons |
| `getBreadcrumbTrail(pathname, roles)` | new breadcrumbs | `[{label, href}]` Department → Page |
| `getAccessibleNavPaths(roles)` | **`pageAccess.js`** | `Set<href>` (superset of today's) |
| `getSearchItems(roles)` | `GlobalSearch` `navigationItems` | replaces imperative `addNavItem` |
| `resolveHome(roles)` | new role→home resolver at `/` | best landing route |
| `toSidebarSections(...)` | back-compat `navigation.js` export | today's `sidebarSections` shape |
| `getActiveDepartment(pathname)` | context sidebar + breadcrumbs | department key for current route |

`resolveScope`/`canSeeDepartment`/sensitivity checks from `permissionScope.js` are reused inside `getContextNav`/`getDepartmentsForRoles` for Accounts/HR/Admin/Reports.

### 5.4 Why this eliminates duplication
Sources #1–#6 in §3.5 all become **derived outputs** of the manifest. `pageAccess.js` derives from the manifest, so nav and access can never drift. Adding a page = adding one `item` under its department; it instantly appears in rail/context/search/breadcrumbs and becomes landable. The "ready-to-plug, not wired in" reporting nav (#6) is deleted in favour of a `reports` department entry with `flag: "reporting_nav_enabled"`.

---

## 6. The three-tier navigation model

```
┌──────────┬───────────────────────────┬─────────────────────────────┐
│ Tier 1   │ Tier 2                     │  Content                     │
│ Dept     │ Context Sidebar            │  ┌── Tier 3: in-page tabs ─┐ │
│ Rail     │ (pages/tools of the        │  │ Overview | Ops | ...     │ │
│ (switch  │  active department,        │  └──────────────────────────┘ │
│  dept)   │  grouped, role-filtered)   │  page body                    │
│ + General│                            │                               │
│ + Account│                            │                               │
└──────────┴───────────────────────────┴─────────────────────────────┘
        Breadcrumbs: Workshop  ›  Clocking  ›  A. Technician
```

### 6.1 Tier 1 — Department Rail (global)
The primary left rail becomes a **department switcher**: Workshop, Parts, Service, MOT, Paint, Valeting, Accounts, HR, Reports, Admin, Developer — filtered by the user's departments (`getDepartmentsForRoles`) — plus the **General** group (News Feed, Messages, Tracker, Archive) and the **Account** group (Profile, Clock, Logout, Vision) exactly as today.

Two presentation options (pick per phase, see §8):
- **6.1a Grouped single-rail (transition form).** Department = a section header; its context items render beneath it, exactly like today's rail but grouped by *department* instead of *role*, with de-duplication (Job Cards appears once). Lowest disruption — the current `StaffSidebar` renders it with almost no structural change. **Recommended first visible step.**
- **6.1b Dual-rail (target form).** A slim icon rail of departments (Tier 1) + a Context Sidebar panel (Tier 2). VS Code / Linear style. Best long-term scalability and the literal realisation of "Department Navigation + Context Sidebars". Higher effort; ship behind the flag after 6.1a proves the manifest.

### 6.2 Tier 2 — Context Sidebar (per-department)
A single, config-driven `ContextSidebar` component (`getContextNav(activeDept, roles)`) replaces the three bespoke tab bars (`HrTabsBar`, `WorkshopTabsBar`, `PartsWorkspaceTabs`) and the reporting side-nav. It renders grouped, role-filtered links using the canonical `.app-btn--nav` shape (or `TabLinkGroup` on a horizontal breakpoint). `getActiveDepartment(pathname)` decides which department's context to show. In grouped single-rail mode (6.1a) Tier 2 *is* the expanded section; in dual-rail mode (6.1b) it's the second panel. On mobile it collapses into the existing full-screen drawer.

### 6.3 Tier 3 — In-page tabs
Keep the existing primitives. **Standardise on `TabGroup`/`TabLinkGroup`; deprecate `StaffTabs`.** Drive tab lists from `getPageTabs(pathname)` where a page has sub-views (reporting already does this via `WORKSHOP_TABS`; job-card `?tab=` is the reference deep-linkable pattern). **Recommendation:** adopt the job-card **URL-synced `?tab=`** approach for deep-linkability, sourced from the manifest.

### 6.4 Quick Preview fly-outs
A new `NavFlyout` composed from **`ModalPortal`** (portal + scroll-lock) + the **`GlobalTooltip`** positioning approach (fixed, viewport-clamped, non-clipped, delay/edge-gap already solved) + **`prefetchJob`/SWR prefetch** for preview data. Two uses:
1. **Collapsed-rail department fly-out:** hovering a department in the 48px icon rail (6.1b) pops its Context Sidebar as a fly-out — so a collapsed rail stays fully usable.
2. **Entity Quick Preview:** hovering a job/customer/part link pops a small preview card (status, key fields) with a prefetch, reusing `GlobalSearch`'s existing "search → preview → navigate" behaviour.
Fly-outs render at `--z-popover (1500)`; they are hover/focus-triggered, keyboard-dismissible, and suppressed on touch (open on tap-and-hold or a caret button instead — respecting 44px targets).

### 6.5 Breadcrumbs (net-new)
A `Breadcrumbs` primitive in `src/components/ui/` fed by `getBreadcrumbTrail(pathname, roles)`: `Department › Page › [entity]`. Rendered at the top of the page card (where `HrTabsBar` mounts today). Entity segment (e.g. job number, customer name) is supplied by the page via a light context or `getLayout` prop, since it isn't in the manifest.

### 6.6 Role-based visibility
No new permission model. Visibility everywhere = existing `hasAccess`/`normalizeRoles`/`hasAnyRole` against manifest `roles`, with department-level roles **derived** from `ROLE_DEPARTMENT_MAP` and sensitivity gates from `permissionScope.js`. The manifest normalises to lowercase internally (as the sidebar already does) and exposes upper-case where `ProtectedRoute` needs it — one place to reconcile the two case conventions.

### 6.7 Role → home resolver
`resolveHome(roles)` picks the user's landing route: first department's `home` (by `order`), falling back to `/newsfeed`. Wire into `/` (`index.js`) for authenticated users and reuse for the post-login redirect. Uses only manifest data.

---

## 7. Component & file inventory

### 7.1 New
| File | Role |
|---|---|
| `src/config/workspace/departments.js` | The manifest data |
| `src/config/workspace/manifest.js` | Assembly + all selectors (§5.3) |
| `src/config/workspace/manifest.test.js` | Locks derivations & role-gating |
| `src/components/layout/DepartmentRail.js` | Tier-1 rail (dual-rail mode) |
| `src/components/layout/ContextSidebar.js` | Tier-2 context nav (replaces 3 tab bars) |
| `src/components/ui/Breadcrumbs.js` | Breadcrumb primitive |
| `src/components/ui/NavFlyout.js` | Fly-out shell (ModalPortal + tooltip positioning) |
| `src/components/nav/EntityPreviewCard.js` | Quick-preview content for jobs/customers/parts |
| `src/lib/nav/resolveHome.js` (or in manifest) | Role→home |

### 7.2 Modified
| File | Change |
|---|---|
| `src/components/layout/StaffSidebar.js` | Render department-grouped structure from manifest selectors; keep collapse/mobile/presentation behaviour |
| `src/components/layout/StaffLayout.js` | Mount `ContextSidebar`/`Breadcrumbs`; drop imperative `addNavItem` (use `getSearchItems`); remove runtime `accountsSidebarSections` (now in manifest) |
| `src/components/layout/StaffTopbar.js` | Quick-actions from `getQuickActions` |
| `src/config/navigation.js` | Becomes `sidebarSections = toSidebarSections(manifest)` (back-compat) |
| `src/lib/auth/pageAccess.js` | Derive from `getAccessibleNavPaths(manifest)` |
| `src/config/routeAccess.js` | `TOPBAR_LINKS`/`ACCOUNTS_NAV_LINKS` become derived from manifest (or kept as edge-safe mirror generated from it) |

### 7.3 Retired
- `src/components/HR/HrTabsBar.js`, `src/components/Workshop/WorkshopTabsBar.js`, `src/components/page-ui/parts/PartsWorkspaceTabs.js` → replaced by `ContextSidebar` (keep as thin wrappers during transition).
- `src/lib/reporting/config/navigation.js` (`getReportingNavSection`) → replaced by a `reports` department entry.
- `src/config/departmentDashboards.js` → folded into manifest `home`/dashboard items (keep export as derived during transition).
- `src/components/ui/StaffTabs.js` → deprecate in favour of `TabGroup`.

---

## 8. Department → page map (the manifest's initial content)

Departments keyed on `ROLE_DEPARTMENT_MAP`. Cross-cutting routes appear under their primary department with a note; `general`/`account` hold app-wide items. Role columns are **indicative** — the manifest derives them from `ROLE_DEPARTMENT_MAP` + existing per-page `allowedRoles`.

### General (pseudo-department, category `general`)
`/newsfeed`, `/messages`, `/tracking` (Service/Workshop/Parts), `/archive`.

### Workshop — home `/dashboard/workshop`
`/dashboard/workshop`, `/nextjobs`, `/jobs`, `/appointments`, `/clocking` (+`/clocking/[technicianSlug]`), `/consumables-tracker`, `/consumables-request`, `/archive`, `/tech`* , `/tech/dashboard`*, `/tech/efficiency`*, `/tech/[jobNumber]`* (*technician sub-area — may be its own department, see §11 Q1). Cross: `/job-cards/[jobNumber]`, `/reports/workshop`.

### Parts — home `/dashboard/parts`
`/dashboard/parts`, `/parts-manager`, `/stock-catalogue`, `/goods-in` (+`/[goodsInNumber]`), `/deliveries` (+`/[deliveryId]`), `/delivery-planner`, `/new-order` (+`/[orderNumber]`). Cross: `/jobs`, `/parts` (redirect), `/reports/parts`, `/accounts/invoices`.

### Service — home `/dashboard/service`
`/dashboard/service`, `/jobs`, `/new-job`, `/goods-in`, `/appointments`, `/nextjobs`. Cross: `/job-cards/[jobNumber]`, `/tracking`, `/reports/service`.

### MOT — home `/dashboard/mot`
`/dashboard/mot`, `/tech`, `/tech/efficiency`. Cross: `/clocking`, `/reports/mot`.

### Paint / Smart Repair — home `/dashboard/painting`
`/dashboard/painting`. Cross: `/reports/paint`, `/job-cards/[jobNumber]`.

### Valeting — home `/dashboard/valeting`
`/dashboard/valeting`, `/valet` (+`/[jobNumber]`). Cross: `/job-cards/[jobNumber]` (valet mode), `/reports/valeting`.

### VHC (cross-cutting group under Workshop/Service; public share links separate)
`/vhc` (redirect), staff `/vhc/customer-preview/[jobNumber]`, `/vhc/customer-view/[jobNumber]`. Public (not in staff nav; in `routeAccess` public prefixes): `/vhc/customer/[jobNumber]/[linkCode]`, `/vhc/share/[jobNumber]/[linkCode]`.

### Accounts — home `/dashboard/accounts` (sensitive: financial)
`/dashboard/accounts`, `/accounts` (+ `create`, `settings`, `edit/[accountId]`, `view/[accountId]`, `transactions/[accountId]`), `/accounts/invoices` (+`/[invoiceId]`), `/accounts/reports`, `/accounts/payslips`, `/company-accounts` (+`/[accountNumber]`). Cross: `/reports/accounts`.

### HR — home `/hr` (sensitive: pii)
`/hr`, `/hr/manager`, `/hr/employees`, `/hr/attendance`, `/hr/leave`, `/hr/payroll`, `/hr/performance`, `/hr/recruitment`, `/hr/training`, `/hr/disciplinary`, `/hr/reports`, `/hr/settings`. (These are already a de-facto context group via `HrTabsBar` — the cleanest first Context Sidebar target.) Cross: `/reports/hr`.

### Reports — home `/reports/overview` (flag `reporting_nav_enabled`)
`/reports/{overview,workshop,parts,service,mot,paint,valeting,accounts,admin}` — visibility already derived from `ROLE_DEPARTMENT_MAP` + `permissionScope`. Each report page also owns Tier-3 tabs (e.g. `WORKSHOP_TABS`).

### Admin — home `/dashboard/admin`
`/dashboard/admin`, `/dashboard/managers`, `/admin/users`, `/admin/compliance` (+ `sars`, `breaches`, `dpias`, `ropa`, `retention`), `/website-manager`, `/newpage`.

### Mobile (cross-cutting; own auth path)
`/mobile/dashboard`, `/mobile/delivery/[jobNumber]` — likely a role-scoped view of Workshop/Parts rather than a top-level department (see §11 Q2).

### Customers (cross-cutting, no current sidebar presence)
`/customers`, `/customers/[customerSlug]` — reached via search/links; currently granted via `DYNAMIC_DETAIL_EXTENDS`. Model as a cross-cutting entity area, not a department.

### Developer — home `/dev` (role `dev` only)
All `/dev/*` (25 pages). Isolated `dev` role; keep as its own department, unaffected by staff manifest.

### Account (pseudo-department, category `account`)
`/profile`, `/profile/privacy`, `/security`, clock control, Vision, Logout.

### Excluded from staff manifest
`/website/*` (public/customer scope — own `CustomerWebsiteLayout`), `/vision/*` and `/presentation/*` (public showcase/demo shells), auth pages (`/login`, `/loginPresentation`, `/password-reset/*`, `/unauthorized`).

---

## 9. Transition strategy (current → target, non-breaking)

The transition is an **adapter-then-migrate** sequence; at every step both the old and new representations exist and are equal.

1. **Build the manifest to *reproduce* today exactly.** Author `departments.js` so `toSidebarSections(manifest)` deep-equals the current `sidebarSections` (lock with `manifest.test.js` + the existing `navigation.test.js`). At this point `navigation.js` re-exports from the manifest and **nothing renders differently** — pure refactor, zero UX change.
2. **Point `pageAccess.js` at the manifest** (`getAccessibleNavPaths`). Because the manifest reproduces the sidebar, the accessible set is identical. Verify with a role-by-role snapshot test that the landable-path set is unchanged.
3. **Fold in the strays** (sources #2–#6): `departmentDashboardShortcuts`, `accountsSidebarSections`, `TOPBAR_LINKS`, `SERVICE/PARTS_ACTION_LINKS`, `navigationItems`, reporting nav — one at a time, each verified to leave rendered output identical, until the manifest is the *only* nav source.
4. **Re-organise the manifest from role-first to department-first** *without changing what any user sees* — same items, same roles, regrouped. Dedupe (Job Cards once). Ship the **grouped single-rail (6.1a)** behind `workspace_nav_enabled`; QA per role; flip the flag.
5. **Add Tier-2 Context Sidebar** for one department (HR — it already has `HrTabsBar`), validate, then Workshop/Parts, then the rest. Retire each bespoke tab bar as its department is migrated.
6. **Add breadcrumbs, role→home, fly-outs** (independent, additive).
7. **Optionally graduate to dual-rail (6.1b)** behind the same flag once Context Sidebar is proven.

Rollback at any phase = flip `workspace_nav_enabled` off; the manifest still feeds the old-shaped `sidebarSections`, so the classic rail returns instantly.

---

## 10. Technical challenges & risks

| # | Challenge | Mitigation |
|---|---|---|
| 1 | **Nav == permissions.** A manifest bug can silently expose or lock out pages. | Reproduce-exactly refactor (§9.1–9.2); role-by-role snapshot test of `getAccessibleNavPaths` vs today's set as a CI gate; keep `routeAccess.js` edge guard independent. |
| 2 | **Edge-runtime safety.** `pageAccess.js`/`proxy.js` import nav config; manifest must stay plain-data (no React/Node/Supabase). | Put manifest in `src/config/workspace/` with the same constraints `routeAccess.js` already follows; lint/guard imports. |
| 3 | **Two role case conventions** (lowercase groups vs UPPER `ProtectedRoute`/client). | Normalise to lowercase inside the manifest boundary (as `StaffSidebar` already does); expose an upper-case selector only where `ProtectedRoute` consumes it. |
| 4 | **Department is not in the URL** (flat routes; parts pages at `/deliveries` etc.). | `getActiveDepartment(pathname)` uses an explicit route→department index built from the manifest, not path parsing. Handle multi-department routes (`/jobs`, `/job-cards/[jobNumber]`) by a `primaryDepartment` + membership list. |
| 5 | **Shared/duplicated routes** (`/jobs` in many depts; `/job-cards/[jobNumber]` spans 5). | Model routes as *belonging to* one primary department but *appearing in* several context navs; dedupe in Tier-1, allow repeats in Tier-2. |
| 6 | **Optimistic active-state & presentation mode** are subtle and load-bearing. | New surfaces reuse `pendingHref` and the `allowedRoutes`/`buildPresentationHref` machinery already in `StaffSidebar`; do not reimplement. |
| 7 | **Fixed-card scroll model & auto-hide topbar** interact with any new pinned rail. | Context Sidebar participates in the same `lockViewport` layout; add it as a sibling column in `StaffLayout`, not a floating element, on desktop. |
| 8 | **Mobile.** A second rail can't coexist with the phone drawer. | On ≤1024px, Tier-1+Tier-2 collapse into the existing full-screen drawer as a two-level list (department → its items); reuse `isCondensed`. |
| 9 | **Fly-outs vs `overflow:hidden`/modal lock/z-index.** | Reuse `GlobalTooltip`'s proven fixed/portal/viewport-clamp approach and the `_app.js` modal-lock rules; render at `--z-popover`. |
| 10 | **Dev Layout Overlay coverage.** New surfaces must register or they break the overlay's completeness. | Build all new surfaces from `LayerSurface`/`SectionShell`/layout-system wrappers with `sectionKey`/`parentKey` (they auto-register via `DevLayoutSection`). |
| 11 | **`border` ban / borderless surfaces.** | State via `--theme`/`--secondary` tint + `--primary` active fill only; run `npm run check:borders` in CI for the phase. |
| 12 | **Scope creep across 158 routes.** | Migrate department-by-department behind the flag; never a big-bang cutover. |

---

## 11. Open questions (resolve before/inside Phase 4)

1. **Technician workspace** (`/tech*`): its own Tier-1 department, or a role-scoped view *inside* Workshop? (Techs/MOT testers currently get a slim role section.) — *Recommend: a "My Work" pseudo-department for hands-on roles, distinct from the managerial Workshop department.*
2. **Mobile Technician**: top-level department or a Workshop/Parts sub-view? — *Recommend: role-scoped view, home `/mobile/dashboard`.*
3. **Reports**: a standalone Tier-1 department (as now) or a cross-cutting item pinned inside each operational department's context nav? — *Recommend: keep standalone for executives; also surface the single relevant report inside each department's context nav.*
4. **Tier-1 form for launch**: grouped single-rail (6.1a) as the destination, or a stepping stone to dual-rail (6.1b)? — *Recommend: 6.1a is the shippable default; 6.1b is opt-in/flagged.*
5. **Breadcrumb entity labels**: light context vs `getLayout` prop vs per-page hook? — decide in Phase 6.

---

## 12. Phased rollout plan

Each phase is independently shippable, flag-guarded where user-visible, and written to become one implementation prompt. "Done when" lines are the acceptance criteria.

### Phase 0 — Manifest scaffold (invisible, pure refactor)
- **Goal:** stand up `src/config/workspace/` and reproduce `sidebarSections` exactly.
- **Build:** `departments.js` (initial content = §8, but organised to *reproduce* today's role sections first), `manifest.js` with `toSidebarSections` + `getAccessibleNavPaths`, `manifest.test.js`.
- **Wire:** `navigation.js` re-exports `sidebarSections` from the manifest.
- **Done when:** `toSidebarSections(manifest)` deep-equals the previous `sidebarSections`; `navigation.test.js` passes unchanged; no visual/behavioural change; `npm run check:borders` clean.

### Phase 1 — Permission consolidation
- **Goal:** make the manifest the sole nav-derived permission source.
- **Build/Wire:** `pageAccess.js` → `getAccessibleNavPaths(manifest)`; add a role-by-role snapshot test comparing landable-path sets before/after.
- **Done when:** landable-path set is byte-identical for every role; `PageAccessGuard` behaviour unchanged.

### Phase 2 — Absorb the stray nav sources
- **Goal:** eliminate sources #2–#6 and the imperative `addNavItem`.
- **Build/Wire:** fold `departmentDashboardShortcuts`, `accountsSidebarSections`, `TOPBAR_LINKS`, `ACCOUNTS_NAV_LINKS`, `SERVICE/PARTS_ACTION_LINKS`, `GlobalSearch` items, and the reporting nav into the manifest via selectors (`getQuickActions`, `getSearchItems`, dashboards). Delete `lib/reporting/config/navigation.js`.
- **Done when:** grep confirms no nav list is defined outside `src/config/workspace/`; rail, topbar actions, search, dashboards render identically; all snapshots green.

### Phase 3 — Department-first reorganisation (grouped single-rail, flagged)
- **Goal:** ship the department-organised rail (6.1a) behind `workspace_nav_enabled`, same items/roles, deduped.
- **Build:** update `StaffSidebar` to render department groups from `getDepartmentsForRoles`/`getContextNav`; add flag (mirror `reporting_nav_enabled`).
- **Done when:** with flag on, each role sees its departments with no duplicate hrefs; flag off = classic rail; QA sign-off per role; mobile drawer works.

### Phase 4 — Context Sidebar (Tier 2), department by department
- **Goal:** replace bespoke tab bars with one `ContextSidebar`.
- **Build:** `ContextSidebar.js` + `getActiveDepartment`/`getContextNav`; migrate **HR first** (retire `HrTabsBar`), then Workshop (`WorkshopTabsBar`), Parts (`PartsWorkspaceTabs`), then remaining departments. Standardise Tier-3 on `TabGroup`; deprecate `StaffTabs`.
- **Done when:** each migrated department shows its grouped context nav; retired tab bars are thin wrappers or removed; active-state correct on every route; `check:borders` clean.

### Phase 5 — Role→home resolver
- **Goal:** authenticated `/` (and post-login) lands users on their department home.
- **Build:** `resolveHome(roles)`; wire into `index.js`/login redirect.
- **Done when:** each role lands on the expected home; fallback `/newsfeed` for roleless; no redirect loops.

### Phase 6 — Breadcrumbs
- **Goal:** `Department › Page › [entity]` trail on staff pages.
- **Build:** `Breadcrumbs.js` + `getBreadcrumbTrail`; mount where `HrTabsBar` mounted; resolve the entity-label question (§11 Q5).
- **Done when:** correct trail on representative routes incl. dynamic detail pages; hidden on login/customer/presentation shells; responsive.

### Phase 7 — Quick Preview fly-outs
- **Goal:** `NavFlyout` + entity preview.
- **Build:** `NavFlyout.js` (ModalPortal + GlobalTooltip positioning), `EntityPreviewCard.js`, prefetch on hover; collapsed-rail department fly-out.
- **Done when:** hover/focus opens a viewport-clamped, keyboard-dismissible fly-out at `--z-popover`; touch fallback (caret/long-press); prefetch fires once; no modal-lock/z-index regressions.

### Phase 8 — (Optional) Dual-rail target form
- **Goal:** graduate Tier-1 to a slim icon rail + persistent Context Sidebar panel (6.1b), behind the flag.
- **Build:** `DepartmentRail.js`; integrate as a `StaffLayout` column participating in the locked-viewport model; collapsed-rail uses Phase-7 fly-outs.
- **Done when:** dual-rail renders per role on desktop; collapses to the two-level drawer ≤1024px; parity with 6.1a for access/active-state; sign-off to make it default.

### Phase 9 — Cleanup & guardrails
- **Goal:** lock the "one manifest" invariant.
- **Build:** remove deprecated `StaffTabs`/bespoke tab bars/`departmentDashboards.js` residue; add a CI lint/test asserting no nav lists exist outside `src/config/workspace/`; document "how to add a department/page" (one-edit guide).
- **Done when:** the §4.7 acceptance test passes — a new manifest page appears, role-gated, in rail + context + breadcrumbs + search and is landable, with no other file changed.

---

## 13. Recommended implementation order (summary)
**0 → 1 → 2** (invisible consolidation; highest value, lowest risk — do these regardless of whether later tiers ship) → **3** (department rail, flagged) → **4** (context sidebar) → **5, 6, 7** (additive, parallelisable) → **8** (optional target form) → **9** (lock-in). Phases 0–2 are worth doing on their own merits: they collapse six drifting nav sources into one and make navigation and permissions provably consistent, which is the foundation everything else stands on.

---

## 14. Appendix — quick reference

- **Canonical taxonomy:** `ROLE_DEPARTMENT_MAP` — `workshop, parts, service, mot, valeting, paint, accounts, admin, hr, management` (`src/lib/reporting/config/departments.js`).
- **Reuse, don't rebuild:** `TabGroup`/`TabLinkGroup`, `LayerSurface`/`LayerTheme`, `ModalPortal`, `GlobalTooltip`, `prefetchJob`, `useIsMobile`, `getSidebarNavIcon`, existing `--nav-*`/`--tab-*` tokens, the `pendingHref` optimistic-highlight mechanism, and the `reporting_nav_enabled` flag pattern.
- **Never:** raw `<select>`, `border` on surfaces/nav, hardcoded hex, new colours, nav lists outside `src/config/workspace/`, path-based department inference, or a big-bang cutover.
- **Always:** flag-guard user-visible changes, derive roles from `ROLE_DEPARTMENT_MAP`, keep nav-config == permission-config, render under `html.staff-scope`, run `npm run check:borders`.
