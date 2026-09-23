# Workspace role defaults

Workspace Navigation is role-first. Each staff role receives a default sidebar
made from centrally defined modules in `src/config/workspace/roleDefaults.js`.
Modules are presentation only: they organise existing staff routes, but page and
API permissions remain enforced by the route access layer.

## The module library is the only layout (2026-09 sweep)

`SIDEBAR_MODULE_LIBRARY` in `src/config/workspace/departments.js` — the module
set rendered by the Developer Platform's **Module page map** popup — is the
single source of truth for sidebar layout. A role default may only name a module
that exists in that library, and only list pages that library module owns.

`mod()` in `roleDefaults.js` enforces this at import time:

- an unknown module key throws
- a page that belongs to a different library module throws
- the module's label always comes from the library, never from the role entry
- pages are re-sorted into library order, so button order inside a module is
  identical for every role and cannot be authored per-role

Before this sweep there were 38 hand-authored modules whose keys existed nowhere
in the library. 16 of them mixed pages from two or three different library
modules (for example "Workshop Control" = Workshop pages + Reception pages, and
"Fulfilment" = Reception `/jobs` + Parts `/deliveries`), and 6 meant different
page sets depending on the role (`management-overview` had five variants).
**Roles kept exactly the pages they had — only the grouping changed.**

Developer tooling lives at `/dev/sidebar-access` and supports:

- previewing each role default
- copying a role default to an individual user
- adding and removing whole standard modules from a user's layout
- **removing a page from a module for an individual user** — the only per-user
  page-level edit
- restoring a user's inherited role default
- distinguishing inherited defaults from saved user overrides

It deliberately does NOT support renaming a module, reordering modules,
reordering pages inside a module, or adding an arbitrary page to a module. Those
controls were removed with the sweep because each produced a layout that existed
in no library module.

Legacy `sidebar_access.items/groups` JSON remains valid. v4 layouts add
`sourceRole` and `modules`, and old data is preserved during migration.

## Role reference

Generated from `getRoleDefaultWorkspaceModules()` — module labels and page order
are the library's.

### Retail

- General: `/newsfeed`, `/messages`
- Admin: `/archive`

### Service

- General: `/newsfeed`, `/messages`, `/tracking`
- Admin: `/archive`
- Reception: `/dashboard/service`, `/new-job`, `/jobs`

### Service Manager

- General: `/newsfeed`, `/messages`, `/tracking`
- Admin: `/dashboard/managers`, `/archive`
- Reception: `/dashboard/service`, `/new-job`, `/appointments`, `/jobs`
- Workshop: `/nextjobs`
- Reports: `/reports/workshop`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/valeting`

### Workshop Manager

- General: `/newsfeed`, `/messages`, `/tracking`
- Admin: `/dashboard/managers`, `/archive`
- Reception: `/new-job`, `/appointments`, `/jobs`
- Workshop: `/dashboard/workshop`, `/clocking`, `/consumables-tracker`, `/nextjobs`
- Reports: `/reports/workshop`, `/reports/mot`, `/reports/paint`, `/reports/valeting`

### After Sales Director

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Reports: `/reports/workshop`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/accounts`, `/reports/valeting`, `/reports/admin`, `/reports/overview`

### Techs

- General: `/newsfeed`, `/messages`, `/tracking`
- Workshop: `/dashboard/workshop`
- Tech: `/tech/dashboard`, `/tech`, `/tech/efficiency`, `/consumables-request`

### Mobile Technician

- General: `/newsfeed`, `/messages`
- Reception: `/new-job`, `/appointments`
- Workshop: `/mobile/dashboard`
- Tech: `/tech`, `/consumables-request`

### Parts

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Parts: `/dashboard/parts`, `/stock-catalogue`, `/deliveries`, `/goods-in`

### Parts Manager

- General: `/newsfeed`, `/messages`
- Admin: `/dashboard/managers`, `/archive`
- Parts: `/dashboard/parts`, `/parts-manager`, `/stock-catalogue`, `/deliveries`, `/goods-in`
- Reports: `/reports/parts`

### Parts Driver

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Parts: `/deliveries`

### MOT Tester

- General: `/newsfeed`, `/messages`
- MOT: `/dashboard/mot`, `/tech`, `/tech/efficiency`
- Reports: `/reports/mot`

### Valet Service

- General: `/newsfeed`, `/messages`, `/tracking`
- Valeting: `/dashboard/valeting`, `/valet`
- Reports: `/reports/valeting`

### Sales / Administration

- General: `/newsfeed`, `/messages`
- Admin: `/archive`

### Sales Director

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Reports: `/reports/workshop`, `/reports/parts`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/accounts`, `/reports/valeting`, `/reports/admin`, `/reports/overview`

### Sales

- General: `/newsfeed`, `/messages`
- Admin: `/website-manager`, `/archive`

### Admin

- General: `/newsfeed`, `/messages`, `/tracking`
- Admin: `/dashboard/admin`, `/website-manager`, `/archive`
- Accounts: `/accounts/payslips`
- Reports: `/reports/admin`

### Admin Manager

- General: `/newsfeed`, `/messages`
- Admin: `/dashboard/managers`, `/dashboard/admin`, `/admin/compliance`, `/hr/manager`, `/website-manager`, `/archive`
- Accounts: `/accounts/payslips`
- Reports: `/reports/workshop`, `/reports/parts`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/accounts`, `/reports/valeting`, `/reports/admin`, `/reports/overview`

### Accounts

- General: `/newsfeed`, `/messages`
- Accounts: `/dashboard/accounts`, `/accounts/payslips`, `/accounts`, `/company-accounts`, `/accounts/invoices`, `/accounts/reports`
- Reports: `/reports/accounts`

### Accounts Manager

- General: `/newsfeed`, `/messages`
- Admin: `/dashboard/managers`
- Accounts: `/dashboard/accounts`, `/accounts/payslips`, `/accounts`, `/company-accounts`, `/accounts/invoices`, `/accounts/reports`
- Reports: `/reports/accounts`

### General Manager

- General: `/newsfeed`, `/messages`
- Admin: `/dashboard/managers`, `/website-manager`, `/archive`
- Reports: `/reports/workshop`, `/reports/parts`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/accounts`, `/reports/valeting`, `/reports/admin`, `/reports/overview`

### Valet Sales

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Reports: `/reports/valeting`

### Buying Director

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Reports: `/reports/workshop`, `/reports/parts`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/accounts`, `/reports/valeting`, `/reports/admin`, `/reports/overview`

### Second Hand Buying

- General: `/newsfeed`, `/messages`
- Admin: `/archive`

### Vehicle Processor & Photographer

- General: `/newsfeed`, `/messages`
- Admin: `/archive`

### Receptionist

- General: `/newsfeed`, `/messages`
- Admin: `/archive`

### Painters

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
- Reports: `/reports/paint`

### Contractors

- General: `/newsfeed`, `/messages`
- Admin: `/archive`
