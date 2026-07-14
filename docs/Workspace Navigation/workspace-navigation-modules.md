# Workspace Navigation Modules — Proposed Phase 9 Source of Truth

**Status:** Shipped Phase 9 architecture. This document is the decision record and implementation inventory for the **Group → Modules → Pages** Workspace Navigation model. Modules organise already-authorised Pages and do not change permissions.

## 1. Target interaction

The current sidebar has Groups view and a Group view containing Dashboards plus a flat page list. Phase 9 keeps the Groups view and replaces only the Group view:

```text
Workspace Groups → select one Group
Group → collapsed Module rows
Module → expand one Module to reveal its indented Page links
Page → navigate; the active page's Module is the only expanded Module
```

- A group has zero or more **dashboard links** followed by Modules.
- Modules are disclosure controls, not routes and not permission boundaries.
- All modules start collapsed. Opening one closes every sibling; route activation opens only its owning module.
- Pages retain their current routes, role gates, active-state rules, mobile drawer, collapsed rail, and optimistic `pendingHref` behaviour.
- Detail routes, redirects, tab states, public pages, and actions are not sidebar Pages unless this document expressly says otherwise.

The manifest remains the sole source for navigation and landable-path permissions. A page is assigned to exactly one **primary Group and Module**. A page may be a shared route, but it must not be duplicated into multiple sidebar locations.

## 2. Access model

`/dev/sidebar-access` is the developer-only management projection of this same manifest: it shows Group → Module → Page, manages Group assignment, and exposes per-Page exceptions inside each Module. Modules are derived display metadata only and are never independently assigned or persisted as access grants.

### Group inheritance

Roles receive Groups. A group grants all of its un-roled Modules and Pages. Page `roles` is retained only for a real exception:

- **Restriction:** a smaller subset of the Group may see the Page.
- **Cross-grant:** a role outside the Group may see a Page. It does not automatically receive the whole Group.
- **Compatibility lock:** an explicit role array remains temporarily because the classic fallback still consumes the legacy section.

Modules add no independent ACL. A module is visible when it contains at least one visible Page or dashboard. A Group is visible when it contains at least one visible module/page/dashboard. The editable per-user snapshot must evolve from `{ groups, items, itemOrder }` to include module order/visibility only if a future product requirement needs it; Phase 9 must preserve the existing item-level snapshot semantics.

### Group-role assignments

| Group | Normal assigned roles | Notes |
|---|---|---|
| General | all authenticated users | pseudo-group |
| Admin | management roles derived from `ROLE_DEPARTMENT_MAP` | page exceptions remain explicit |
| Reception | service / aftersales roles | derived |
| Workshop | workshop, technician and mobile-tech roles | derived |
| MOT | mot tester | derived |
| Parts | parts, parts manager, parts driver | derived |
| Valeting | valet service, valet sales | derived; valet-sales has no current work page |
| Accounts | accounts, accounts manager | financial |
| Reports | no blanket assignment | each report has its own explicit audience |
| Developer | `dev` only | immutable developer lock |

Paint and HR are real domain areas but are not requested as Workspace Groups. In Phase 9, Paint remains a role-specific dashboard/report exception and HR belongs under Admin → People & HR. Do not silently create extra top-level groups.

## 3. Canonical Group → Module → Page inventory

Legend: **P** sidebar Page; **D** dashboard shortcut; **T** tab-only/in-page state; **Detail** reachable from a parent Page; **Redirect** compatibility route; **Hidden** reachable by workflow/search/link but intentionally absent from sidebar.

### General

Assigned: all authenticated users.

- **Communication**
  - **P** News Feed — `/newsfeed` — inherited.
  - **P** Messages — `/messages` — inherited; message/thread state remains in-page.
- **Operations**
  - **P** Tracker — `/tracking` — exception: `techs`, service/service-manager, workshop-manager, valet-service, admin. Its Equipment, Oil Stock and Loan Cars views are **T**, not sidebar pages.
  - **P** Archive Jobs — `/archive` — inherited.
- **Customers**
  - **Hidden** Customer directory/detail — `/customers`, `/customers/[customerSlug]`. Keep link/search-only; current `/customers` redirects to the customer portal, while staff detail is reached from jobs/search and has its own tab workspace.

### Reception

Assigned: service, service-manager, aftersales-manager, after-sales-manager/director where configured.

- **Dashboard**
  - **D** Service Dashboard — `/dashboard/service` — service/service-manager restriction.
- **Job Intake**
  - **P** Job Cards — `/jobs` — shared primary route; service/service-manager/aftersales-manager restriction. Its Today, Carry Over, Orders, filters and status tabs are **T**.
  - **P** Create Job Card — `/new-job` — service/service-manager; multi-job creation tabs are **T**.
  - **P** Appointments — `/appointments` — service-manager exception; check-in is in-page.
  - **P** Next Jobs — `/nextjobs` — service-manager/aftersales-manager exception; shared queue.
- **Shared operations**
  - **P** Goods In — `/goods-in` — retained shared operational Page for current service roles; detail `/goods-in/[goodsInNumber]` is **Detail**.
  - **Detail** Job Card workspace — `/job-cards/[jobNumber]` — reached from Job Cards/queue/create/tech; never sidebar. Customer requests, scheduling, tracker, VHC, parts, documents, notes, messages, write-up and invoice are **T** inside it.
  - **Redirect** `/job-cards` → `/jobs`; `/job-cards/appointments` → `/appointments`.

### Workshop

Assigned: workshop-manager/controller, tech/technician/techs and mobile-technician.

- **Dashboards**
  - **D** Workshop Dashboard — `/dashboard/workshop` — workshop-manager, techs, technician.
  - **D** My Work Dashboard — `/tech/dashboard` — techs.
  - **D** Mobile Dashboard — `/mobile/dashboard` — mobile-technician; mobile-specific layout, still a workshop module page.
- **Workshop Control**
  - **P** Next Jobs — `/nextjobs` — workshop-manager exception; shared queue.
  - **P** Job Cards — `/jobs` — workshop-manager exception; shared primary route.
  - **P** Clocking — `/clocking` — workshop-manager exception; `/clocking/[technicianSlug]` is **Detail**.
  - **P** Consumables Tracker — `/consumables-tracker` — workshop-manager exception.
- **My Work**
  - **P** My Jobs — `/tech` — techs/mobile-technician; `/tech/[jobNumber]` is **Detail**, with Overview, Parts, VHC, Documents and work tabs kept **T**.
  - **P** Efficiency — `/tech/efficiency` — techs/mot-tester restriction; individual technician views are **T**.
  - **P** Request Consumables / Parts — `/consumables-request` — techs/mobile-technician.
  - **P** Mobile Appointments — `/appointments` — mobile-technician exception; shared route.
  - **Detail** Mobile delivery — `/mobile/delivery/[jobNumber]`; reached from Mobile Dashboard/My Work only.
- **Hidden compatibility**
  - **Redirect** `/workshop` → `/consumables-tracker`.

### MOT

Assigned: mot-tester.

- **Dashboard**
  - **D** MOT Dashboard — `/dashboard/mot`.
- **My Work**
  - **P** My Jobs — `/tech` — shared route, restricted to mot-tester in this Group.
  - **P** Efficiency — `/tech/efficiency`.
- **Reporting**
  - Relevant report remains in Reports, not duplicated here: `/reports/mot`.

### Parts

Assigned: parts, parts-manager, parts-driver. Parts-driver currently receives the Group but no visible operational Page; this is a documented permission gap to resolve before enabling inherited Pages.

- **Dashboards**
  - **D** Parts Dashboard — `/dashboard/parts` — parts/parts-manager.
  - **D** Parts Manager Dashboard — `/parts-manager` — parts-manager; this should be a dashboard link, not a separate module page.
- **Stock & Receiving**
  - **P** Stock Catalogue — `/stock-catalogue` — parts/parts-manager.
  - **P** Goods In — `/goods-in` — parts/parts-manager; detail is **Detail**.
- **Fulfilment**
  - **P** Job Cards — `/jobs` — shared route for parts/parts-manager.
  - **P** Deliveries — `/deliveries` — parts/parts-manager; `/deliveries/[deliveryId]` is **Detail**.
  - **P** Delivery / Collection Planner — `/delivery-planner` — parts/parts-manager; currently quick-action/tab-only visibility, promote to a Page in Phase 9.
- **Ordering**
  - **P** Create Order — `/new-order` — parts/parts-manager; `/new-order/[orderNumber]` is **Detail**.
- **Hidden compatibility**
  - **Redirect** `/parts` → `/stock-catalogue`.

### Valeting

Assigned: valet-service and valet-sales. Valet-sales receives the Group but no current visible work Page; retain the group only if a sales valet page is supplied, otherwise hide empty groups.

- **Dashboard**
  - **D** Valeting Dashboard — `/dashboard/valeting` — valet-service.
- **Work Queue**
  - **P** Valet Jobs — `/valet` — valet-service.
  - **Detail** `/valet/[jobNumber]` opens the shared job-card experience in valet mode; never sidebar.
- **Reporting**
  - Relevant report stays in Reports: `/reports/valeting`.

### Accounts

Assigned: accounts and accounts-manager. Financial sensitivity remains server-enforced; navigation is not authorisation.

- **Dashboard**
  - **D** Accounts Dashboard — `/dashboard/accounts`.
- **Accounts**
  - **P** Accounts — `/accounts` — inherited.
  - **P** Company Accounts — `/company-accounts` — inherited; companies and ledger views are **T**; `/company-accounts/[accountNumber]` is **Detail**.
  - **Detail/redirect states** `/accounts/create`, `/accounts/edit/[accountId]`, `/accounts/view/[accountId]`, `/accounts/transactions/[accountId]`, `/accounts/settings` all belong to Accounts and must stay out of the sidebar.
- **Billing**
  - **P** Invoices — `/accounts/invoices` — inherited.
  - **Detail** `/accounts/invoices/[invoiceId]`.
  - **P** Accounts Reports — `/accounts/reports` — inherited; distinct from enterprise `/reports/accounts`.
  - **P** Payslips — `/accounts/payslips` — cross-grant to admin/admin-manager/owner; sensitive exception.

### Reports

Reports has no inherited Group audience. The Group appears only when at least one report is allowed and `reporting_nav_enabled` is on.

- **Operational Reports**
  - **P** Workshop — `/reports/workshop` — workshop/service/management/admin derived audience.
  - **P** Reception — `/reports/service` — service/management/admin derived audience.
  - **P** Parts — `/reports/parts` — parts/management/admin derived audience.
  - **P** MOT — `/reports/mot` — mot/service/workshop/management/admin derived audience.
  - **P** Valeting — `/reports/valeting` — valeting/service/workshop/management/admin derived audience.
  - **P** Paint — `/reports/paint` — paint/service/workshop/management/admin derived audience; Paint has no requested Workspace Group.
- **Business Reports**
  - **P** Accounts — `/reports/accounts` — accounts/management/executive audience; deliberately not all admin.
  - **P** Admin — `/reports/admin` — management/admin/executive audience.
  - **P** Executive Overview — `/reports/overview` — executive audience.
  - Every report's filters, charts, drilldowns, saved views and report tabs are **T**.

### Admin

Assigned: derived management roles. Admin is the requested display name for current `management`; it should not be confused with the distinct `admin` role.

- **Dashboards**
  - **D** Managers Dashboard — `/dashboard/managers` — manager/leadership audience.
  - **D** Admin Dashboard — `/dashboard/admin` — admin/admin-manager exception.
  - **D** Paint Dashboard — `/dashboard/painting` — painters only; retain as an exception until Paint gets a real workspace.
- **People & HR**
  - **P** HR Manager — `/hr/manager` — owner only today; dashboard tabs are **T**.
  - **P** Employee Records — `/hr/employees` — HR-core plus scoped-manager edge policy; keep role/proxy rules aligned.
  - **P** Attendance, Leave, Payroll, Performance, Training, Incidents, Recruitment, HR Reports, HR Settings — `/hr/*` — HR-core restrictions; these are Pages in this module, not a separate top-level HR Group.
  - **P** User Administration — `/admin/users` — admin/admin-manager/owner exception.
- **Governance**
  - **P** Compliance — `/admin/compliance` — admin-manager/owner exception.
  - **Detail/tab-only** breaches, DPIAs, retention, ROPA and SARs — `/admin/compliance/*`; retain inside Compliance, not sidebar pages.
- **Website Operations**
  - **P** Website Manager — `/website-manager` — cross-grant to owner, admin, admin-manager, general-manager and sales.
  - Content, Preview, Shop, Media, SEO, Analytics and Activity are **T** (`?tab=`). Remove legacy sidebar duplicates `/website-manager?tab=preview`, `/website-manager?tab=shop`, and `/website#shop`; public shop remains external/customer navigation.
  - **Hidden** `/newpage` is a legacy content-management tool; retain only if Website Manager links to it, otherwise retire after migration.

### Developer

Assigned: `dev` only. The Developer Group and `/dev` route remain immutable and excluded from ordinary HR assignment/per-user sidebar editing.

- **Home**: **D** `/dev`.
- **Operations**: **P** `/dev/live-ops`, `/dev/health`, `/dev/feedback-diagnostics`, `/dev/performance`.
- **Intelligence**: **P** `/dev/intelligence`, `/dev/ownership`, `/dev/knowledge`.
- **Releases**: **P** `/dev/releases`, `/dev/readiness`, `/dev/productivity`.
- **Support**: **P** `/dev/support`, `/dev/saved-views`, `/dev/activity`; `/dev/support-reports/[id]` is **Detail**.
- **Settings**: **P** `/dev/plugins`, `/dev/notifications`, `/dev/preferences`.
- **Access**: **P** `/dev/sidebar-access`.
- **Hidden diagnostics/legacy**: `/dev/user-diagnostic`, `/dev/staff-ui-showcase`, `/dev/status-snapshot`, `/dev/dms-ui-pattern-audit`, `/dev/ui`, `/dev/ui/[uiKey]`. Keep reachable only from developer tools/deep links; do not expand the shipped Developer sidebar with showcase or compatibility routes.

## 4. Non-sidebar route inventory

| Class | Routes | Rule |
|---|---|---|
| Detail workspaces | job cards, tech jobs, valet jobs, deliveries, goods-in, accounts, invoices, company accounts, clocking users, mobile delivery | inherit access from their owning/list Page through `DYNAMIC_DETAIL_EXTENDS`; breadcrumb adds entity label; never a module Page |
| Redirects | `/`, `/parts`, `/workshop`, `/vhc`, `/job-cards`, `/job-cards/appointments`, `/customers`, legacy `/dev/ui*`, `/presentation`, `/slideshow` | preserve temporarily; do not expose as Pages |
| In-page tabs | job cards, jobs, tracker, profile, HR manager, company accounts, website manager, reports, VHC, customer detail, efficiency, new job | stay inside their parent Page; URL query state where already supported |
| Persistent account controls | profile, privacy, security, clock, logout | remain at sidebar bottom; Account is not a selectable Workspace Group |
| Public/customer/demo | `/website*`, `/vhc/customer*`, `/vhc/share*`, `/vision*`, `/presentation*`, `/3Dwebsite`, login/auth/password-reset | outside staff navigation and staff manifest |

## 5. Duplicates and permission conflicts requiring explicit migration decisions

1. `/jobs`, `/goods-in`, `/nextjobs`, `/appointments`, `/tech` and `/new-job` appear in more than one legacy role section. Phase 9 assigns one primary Group/Module and uses page-level cross-grants; it must not show duplicated links.
2. Current role-derived Group membership can produce empty Groups: parts-driver, valet-sales, painters, admin/receptionist and some aftersales role spellings. Hide empty Groups and decide whether each role needs an inherited page before adopting the model.
3. HR is governed by three layers that are not identical: manifest/detail inheritance, edge proxy HR rules, and page `ProtectedRoute`/component checks. Phase 9 must codify the stricter effective rule and add route/role tests before moving HR Pages into Admin.
4. The Accounts details permit broader roles than the Accounts Group in several page-level guards. Retain those guards until a reviewed cross-grant matrix is implemented; do not infer financial access from sidebar membership.
5. `/customers` is documented as staff-linkable in `DYNAMIC_DETAIL_EXTENDS`, but its index currently redirects to the customer portal. Treat it as a routing defect/decision, not a sidebar candidate.
6. Developer APIs have dev-only guards while the profile sidebar snapshot permits no Developer editing. Preserve this hard separation.

## 6. Phase 9 implementation contract

1. Extend manifest data with `modules: [{ key, label, order, items }]`; keep existing legacy sections and their explicit roles untouched for classic fallback.
2. Add pure selectors for visible modules, module-aware group nav, route-to-primary-module, breadcrumbs, search and shortcuts. They must remain edge-safe.
3. Replace `ContextSidebar` flat-page rendering with one-open-module disclosure behaviour. Reuse nav buttons, `pendingHref`, collapsed icon rail and existing mobile drawer; no global CSS/token change.
4. Route activation resolves Group then Module. Direct details resolve to the parent Page's Group/Module. Group selection is preserved until navigation leaves the Group.
5. Update `getAccessibleNavPaths`, `resolveAccessiblePaths`, sidebar snapshots, search, favourites/recents and active-route tests to consume Pages flattened from Modules. Modules never grant routes independently.
6. Keep dashboards visually separate and do not make dashboard shortcuts duplicated module Pages.
7. Keep `workspace_nav_enabled` as rollback until the module model has parity tests for every configured role, per-user override, mobile drawer, collapsed rail, direct deep link and classic fallback.

## 7. Evidence reviewed

This proposal is based on the Pages Router inventory in `src/pages` (excluding APIs), current Workspace Navigation documentation, `departments.js`, `manifest.js`, `routeAccess.js`, `pageAccess.js`, `proxy.js`, `StaffSidebar`, `ContextSidebar`, `StaffLayout`, `GlobalSearch`, workspace shortcuts, role configuration, page tab wrappers, the developer platform, and the `users.sidebar_access` schema/helper path.
