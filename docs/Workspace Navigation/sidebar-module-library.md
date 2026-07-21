# Dev Sidebar Module Library

Current standard module and page inventory shown by **Select standard modules** on `/dev/sidebar-access`.

## Reference

- UI section key: `dev-sidebar-module-library`
- Parent section key: `dev-sidebar-selected-user`
- UI component: `src/components/dev-platform/sections/DevSidebarAccess.js`
- Source of truth: `getSidebarModuleCatalog()` in `src/config/workspace/manifest.js`
- Module/page definitions: `src/config/workspace/departments.js`
- Last checked: 21 July 2026

> The developer overlay may report `src/components/Workshop/QueuePlanner/WorkshopQueuePlanner.js:190 (dynamic pattern)`, but that file does not define this library. The workspace manifest above is authoritative.

## How to use this document

- Move an entire `## Module name` block to propose a different module order.
- Move a page bullet between module blocks to propose a different page assignment.
- Keep the route beside every page name so similarly named pages remain unambiguous.
- Tell Codex to apply the revised order or assignments after editing this file.
- A page route can appear in more than one standard module below. In a saved user layout, the editor prevents the same route from being assigned to two modules at once.

## Current module order

1. General
2. Admin
3. Reception
4. Workshop
5. MOT
6. Parts
7. Valeting
8. Accounts
9. Reports
10. Account
11. Pages (Paint)
12. Tech

---

## General

Module key: `department-general`  
Department: `general`  
Current page count: **4**

- News Feed - `/newsfeed`
- Messages - `/messages`
- Tracker - `/tracking`

---

## Admin

Module key: `department-management`  
Department: `management`  
Current page count: **21**

- Managers Dashboard - `/dashboard/managers`
- Admin Dashboard - `/dashboard/admin`
- User Admin - `/admin/users`
- Compliance - `/admin/compliance`
- HR Manager - `/hr/manager`
- Website Manager - `/website-manager`
- Website Preview - `/website-manager?tab=preview`
- Website Shop - `/website-manager?tab=shop`
- Public Shop (live) - `/website#shop`
- HR Overview - `/hr`
- Employee Records - `/hr/employees`
- Attendance - `/hr/attendance`
- Leave - `/hr/leave`
- Payroll - `/hr/payroll`
- Performance - `/hr/performance`
- Training - `/hr/training`
- Incidents - `/hr/disciplinary`
- Recruitment - `/hr/recruitment`
- HR Reports - `/hr/reports`
- HR Settings - `/hr/settings`

---

## Reception

Module key: `department-service`  
Department: `service`  
Current page count: **4**

- Service Dashboard - `/dashboard/service`
- Create Job Card - `/new-job`
- Appointments - `/appointments`
- Job Cards - `/jobs`

---

## Workshop

Module key: `department-workshop`  
Department: `workshop`  
Current page count: **12**

- Workshop Dashboard - `/dashboard/workshop`
- Tech Dashboard - `/tech/dashboard`
- Mobile Tech Dashboard - `/mobile/dashboard`
- Clocking - `/clocking`
- Consumables Tracker - `/consumables-tracker`
- Request Consumables - `/consumables-request`
- Efficiency - `/tech/efficiency`
- Next Jobs - `/nextjobs`
- Job Cards - `/jobs`
- Appointments - `/appointments`
- Create Job Card - `/new-job`
- Archive Job - `/archive`

---

## TECH

Module key: `department-tech`  
Department: `Tech`  
Current page count: **3**

- Tech Dashboard - `/tech/dashboard`
- My Jobs - `/tech`
- Efficiency - `/tech/efficiency`

---

## MOT

Module key: `department-mot`  
Department: `mot`  
Current page count: **3**

- MOT Dashboard - `/dashboard/mot`
- My Jobs - `/tech`
- Efficiency - `/tech/efficiency`

---

## Parts

Module key: `department-parts`  
Department: `parts`  
Current page count: **6**

- Parts Dashboard - `/dashboard/parts`
- Parts Manager Dashboard - `/parts-manager`
- Stock Catalogue - `/stock-catalogue`
- Deliveries - `/deliveries`
- Goods In - `/goods-in`
- Job Cards - `/jobs`

---

## Valeting

Module key: `department-valeting`  
Department: `valeting`  
Current page count: **2**

- Valeting Dashboard - `/dashboard/valeting`
- Valet Jobs - `/valet`

---

## Accounts

Module key: `department-accounts`  
Department: `accounts`  
Current page count: **6**

- Accounts Dashboard - `/dashboard/accounts`
- Payslips - `/accounts/payslips`
- Accounts - `/accounts`
- Company Accounts - `/company-accounts`
- Invoices - `/accounts/invoices`
- Reports - `/accounts/reports`

---

## Reports

Module key: `department-reports`  
Department: `reports`  
Current page count: **9**

- Workshop Reports - `/reports/workshop`
- Parts Reports - `/reports/parts`
- Service Advisor Reports - `/reports/service`
- MOT Reports - `/reports/mot`
- Paint Reports - `/reports/paint`
- Accounts Reports - `/reports/accounts`
- Valeting Reports - `/reports/valeting`
- Admin Reports - `/reports/admin`
- Executive Reports - `/reports/overview`

---

## Account (CHANGE NAME TO PROFILE NOT ACCOUNT)

Module key: `department-account`  
Department: `account`  
Current page count: **1**

- Profile - `/profile`

> Logout is an action rather than a page route, so it is not included in the standard module catalogue.

---

## Pages (Paint) (CHANGE NAME TO PAINT NOT PAGES)

Module key: `department-paint`  
Department: `paint`  
Current page count: **1**

- Painting Dashboard - `/dashboard/painting`

> The UI currently labels this module `Pages` because the `paint` dashboard exists but there is no matching `paint` entry in `WORKSPACE_DEPARTMENTS`. "Paint" is included in this heading only to make the module's purpose clear.

---

## Notes about the counts shown in the UI

The number beside an unassigned standard module is the number of its pages not already used by the selected user's other modules. For an assigned module, the UI shows `Selected` or `Add N missing`. Those values can therefore be lower than the complete catalogue counts documented above.
