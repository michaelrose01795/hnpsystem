# ITS Page & Access View

The goal of this document is to give IT/support an authoritative catalogue of every user-facing route under `src/pages`, the role(s) that can reach it, and where those rules live in the codebase. Use this as the source of truth when onboarding new roles, debugging access, or planning navigation tweaks.

---

## 1. Role Vocabulary

The platform normalises role names to uppercase in the UI but stores them lowercase internally. The current role groupings live in `src/config/users.js:5-25`.

| Category | Roles (case-insensitive) |
| --- | --- |
| Retail | Service, Service Manager, Workshop Manager, After Sales Director, Techs, Parts, Parts Manager, Parts Driver, MOT Tester, Valet Service |
| Sales | Sales Director, Sales, Admin, Admin Manager, Accounts, Accounts Manager, Owner, General Manager, Valet Sales, Buying Director, Second Hand Buying, Vehicle Processor & Photographer, Receptionist, Painters, Contractors |
| Customers | Customer |

> **Tip:** Any new role you add needs to be listed here if you want it to appear in the developer login picker or mode selection logic in `src/components/Layout.js`.

---

## 2. Global Access Rules

- **Auth shell** – Every page is wrapped by the providers declared in `src/pages/_app.js`. Call `useUser()` to check roles and `useSession()` for the Keycloak session.
- **HR/Admin middleware** – `middleware.js` intercepts `/hr/*` and `/admin/*` routes. Only `hr manager`, `admin manager`, `owner`, or `admin` can open HR, with `/hr/employees` and `/hr/leave` also available to manager-scoped roles (`manager`, `service manager`, `workshop manager`, `general manager`). `/admin/users` requires `admin manager` or `owner` (`middleware.js:1-83`).
- **ProtectedRoute component** – Pages that import `@/components/ProtectedRoute` enforce their own `allowedRoles` arrays before rendering (see every file in `src/pages/accounts`).
- **Developer mode override** – When `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`, middleware and API guards return early; otherwise cookies named `hnp-dev-roles` can emulate roles for local dev (also defined in `middleware.js` and `src/context/UserContext.js`).
- **Customer portal layout** – All `/customer/*` pages render through `CustomerLayout`, which hard-gates usage to the `CUSTOMER` role (`src/customers/components/CustomerLayout.js:6-90`).
- **Technician my job pages** – `/job-cards/myjobs/*` ensures the signed-in user either belongs to the “Techs” or “MOT Tester” roster buckets or their role string contains `tech`/`mot` before allowing database calls (`src/pages/job-cards/myjobs/index.js:70-97` and `src/pages/job-cards/myjobs/[jobNumber].js:1404-1430`).

---

## 3. Page Catalogue by Module

Each table below lists every route under `src/pages`, describes its purpose, and explains who can see it. “All authenticated roles” means there is no explicit guard beyond needing to be signed in.

### 3.1 Core Shell & General Workspace

| Path | Purpose | Access / Notes |
| --- | --- | --- |
| `/` | Redirect landing page that immediately sends users to `/login` (`src/pages/index.js`). | Public – no auth required. |
| `/login` | Keycloak/dev login experience. | Public. |
| `/newsfeed` | General news/announcements feed shown on landing (`src/pages/newsfeed.js`). | Visible to all roles via sidebar (`src/config/navigation.js:5-10`). |
| `/dashboard` | Retail dashboard shell that swaps widgets based on role (`src/pages/dashboard.js`). | Linked for Service Manager, Workshop Manager, After Sales Director via sidebar (`src/config/navigation.js:11-18`). |
| `/messages` | Internal messaging hub (`src/pages/messages/index.js`). | Visible to all roles via sidebar (`src/config/navigation.js:19-23`). |
| `/tracking` | Tracker workspace (Equipment, Oil/Stock, live tracker) (`src/pages/tracking/index.js`). | Sidebar exposes it to Techs, Service, Service Manager, Workshop Manager, Valet Service, Admin (`src/config/navigation.js:24-36`). |
| `/profile` | Personal profile/preferences page (`src/pages/profile/index.js`). | Account section available to every role (`src/config/navigation.js:157-167`). |
| `/unauthorized` | Fallback shown when guards fail (`src/pages/unauthorized.js`). | Public, linked via middleware/guards. |

### 3.2 Dashboard Workspaces

Role mapping for dashboard shortcuts is centralised in `src/config/departmentDashboards.js`.

| Path | Description | Linked Roles |
| --- | --- | --- |
| `/dashboard/workshop` | Workshop dashboard – assignments, consumables, throughput. | Workshop Manager, Techs, Technician (`src/config/departmentDashboards.js:5-14`). |
| `/dashboard/service` | Service dashboard – advisor capacity/daily targets. | Service, Service Manager (`src/config/departmentDashboards.js:23-28`). |
| `/dashboard/after-sales` | After-sales throughput/escalations. | After Sales Director, After Sales Manager, Aftersales Manager (`src/config/departmentDashboards.js:29-36`). |
| `/dashboard/managers` | Executive overview for department leaders. | Service Manager, Workshop Manager, Parts Manager, Admin Manager, Accounts Manager, General Manager, Owner (`src/config/departmentDashboards.js:37-48`). |
| `/dashboard/parts` | Parts-specific KPIs. | Parts, Parts Manager (`src/config/departmentDashboards.js:49-54`). |
| `/dashboard/mot` | MOT bookings/re-tests/compliance view. | MOT Tester (`src/config/departmentDashboards.js:55-60`). |
| `/dashboard/valeting` | Wash bay priorities & staff load. | Valet Service (`src/config/departmentDashboards.js:61-66`). |
| `/dashboard/painting` | Bodyshop/paint workflow dashboard. | Painters (`src/config/departmentDashboards.js:67-72`). |
| `/dashboard/accounts` | Financial KPIs/invoices/cash-flow signals. | Accounts, Accounts Manager (`src/config/departmentDashboards.js:73-78`). |
| `/dashboard/admin` | Admin alerts/approvals/escalations. | Admin, Admin Manager (`src/config/departmentDashboards.js:79-84`). |

### 3.3 Quick Navigation & Status Controls (Layout level)

Layout contributes global buttons whose visibility depends on role (`src/components/Layout.js:29-215`).

| Feature | Path(s) | Roles |
| --- | --- | --- |
| Workshop shortcuts | `/clocking` | Workshop Manager, Aftersales Manager (`WORKSHOP_SHORTCUT_ROLES`). |
| Service actions | `/job-cards/create`, `/job-cards/appointments` | Service, Service Dept, Service Manager, Workshop Manager, After Sales Director/Manager (`SERVICE_ACTION_ROLES`). |
| Parts quick actions | `/parts/delivery-planner`, `/parts/create-order` | Parts, Parts Manager (`PARTS_NAV_ROLES`). |
| Status sidebar & job timeline | Drawer in Layout | Admin Manager, Service, Service Manager, Workshop Manager, After Sales Director, Techs, Parts, Parts Manager, MOT Tester, Valet Service (`statusSidebarRoles`). |

### 3.4 Accounts & Finance Module (`src/pages/accounts/*`)

Every account-related page wraps `ProtectedRoute` with explicit uppercase role lists. Roles include both Ops leadership and finance users.

| Path | Purpose | Allowed Roles (exact strings) |
| --- | --- | --- |
| `/accounts` | Account ledger overview (`src/pages/accounts/index.js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER, GENERAL MANAGER, SERVICE MANAGER, WORKSHOP MANAGER, SALES. |
| `/accounts/create` | Create new customer account (`src/pages/accounts/create.js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER. |
| `/accounts/edit/[accountId]` | Edit account details (`src/pages/accounts/edit/[accountId].js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER, GENERAL MANAGER, SERVICE MANAGER. |
| `/accounts/view/[accountId]` | Account detail view, invoices, transactions (`src/pages/accounts/view/[accountId].js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER, GENERAL MANAGER, SERVICE MANAGER, WORKSHOP MANAGER, SALES. |
| `/accounts/transactions/[accountId]` | Transaction drill-down (`src/pages/accounts/transactions/[accountId].js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER, GENERAL MANAGER, SERVICE MANAGER, SALES. |
| `/accounts/invoices` | Invoice list (filterable) (`src/pages/accounts/invoices/index.js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER, SALES, WORKSHOP, WORKSHOP MANAGER, PARTS, PARTS MANAGER. |
| `/accounts/invoices/[invoiceId]` | Individual invoice detail (`src/pages/accounts/invoices/[invoiceId].js`). | Same as invoices plus WORKSHOP. |
| `/accounts/reports` | Financial reporting workspace (`src/pages/accounts/reports/index.js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER, GENERAL MANAGER. |
| `/accounts/settings` | Account module configuration (`src/pages/accounts/settings.js`). | ADMIN, OWNER, ADMIN MANAGER, ACCOUNTS, ACCOUNTS MANAGER. |

### 3.5 Admin & HR Routes

| Path | Purpose | Access |
| --- | --- | --- |
| `/admin/users` | User administration console (`src/pages/admin/users/index.js`). | Middleware restricts to Admin Manager or Owner (`middleware.js:43-66`). |
| `/admin/profiles/[user]` | Preview another user’s profile (`src/pages/admin/profiles/[user].js`). | Same middleware as `/admin/*`. |
| `/hr/index` | HR overview hub. | HR core roles only (`middleware.js:33-82`). |
| `/hr/employees` | Employee directory. | HR core roles + manager-scoped roles (per `HR_ALLOWED_PATHS_FOR_MANAGERS`). |
| `/hr/attendance`, `/hr/payroll`, `/hr/performance`, `/hr/training`, `/hr/disciplinary`, `/hr/recruitment`, `/hr/reports`, `/hr/settings` | HR functional tabs. | HR core roles only. |
| `/hr/leave` | Leave management. | HR core + manager-scoped roles. |
| `/hr/manager` | HR manager console. | Owner (via `owner` exception in middleware) plus HR core. |

### 3.6 Job Cards, Scheduling & Workflow

| Path | Purpose | Access |
| --- | --- | --- |
| `/job-cards/view` | Primary job board (`src/pages/job-cards/view/index.js`). | Linked for Admin Manager, Service, Service Manager, Workshop Manager, Aftersales Manager, Parts, Parts Manager via sidebar. |
| `/job-cards/waiting/nextjobs` | Next jobs queue. | Linked for Admin Manager, Service Manager, Workshop Manager, Aftersales Manager. |
| `/job-cards/archive` | Archived job search. | All roles that can reach Job Cards; no extra guard. |
| `/job-cards/create` | Create job card flow. | Visible through service quick actions for SERVICE_ACTION_ROLES. |
| `/job-cards/appointments` | Job booking calendar embedded in job-cards section. | SERVICE_ACTION_ROLES. |
| `/appointments` | Standalone appointments planner (`src/pages/appointments/index.js`). | Same audience as above; typically linked from service workspace. |
| `/job-cards/[jobNumber]` | Full job detail workspace (tabs, VHC, invoices). | Anyone who can open job cards. |
| `/job-cards/[jobNumber]/car-details`, `/dealer-car-details`, `/add-checksheet`, `/check-box`, `/upload-checksheet`, `/upload-dealer-file`, `/write-up` | Supporting tabs & popups for the same job. | Same as parent job detail. |
| `/job-cards/myjobs` | Technician queue (“My Jobs”). | Enforced to Techs & MOT Testers through roster/role checks as noted above. |
| `/job-cards/myjobs/[jobNumber]` | Technician detail view mirroring write-up & VHC (`src/pages/job-cards/myjobs/[jobNumber].js`). | Same tech gating. |

### 3.7 Clocking, Workshop & Technician Tools

| Path | Purpose | Access |
| --- | --- | --- |
| `/clocking` | Unified clocking workspace for workshop leadership (`src/pages/clocking/index.js`). | Linked via workshop shortcuts for Workshop/Aftersales Managers (no extra guard). |
| `/clocking/[technicianSlug]` | Technician-specific clocking timeline. | Same as above, typically opened from roster. |
| `/clocking/admin` | Admin view of clocking list. | Same as above; not separately guarded. |
| `/tech/dashboard` | Technician personal dashboard (`src/pages/tech/dashboard.js`). | Linked through dashboard shortcuts for `techs`. |
| `/tech/consumables-request` | Tech consumable request portal (`src/pages/tech/consumables-request.js`). | Sidebar entry for Techs only (`src/config/navigation.js:90-110`). |
| `/workshop/consumables-tracker` | Workshop consumables planner (`src/pages/workshop/consumables-tracker.js`). | Sidebar entry for Workshop Manager (`src/config/navigation.js:70-84`). |
| `/valet` | Valet jobs board (`src/pages/valet/index.js`). | Sidebar entry for Valet Service (`src/config/navigation.js:138-146`). |

### 3.8 Parts & Logistics

| Path | Purpose | Access |
| --- | --- | --- |
| `/parts` | Parts workspace hub (`src/pages/parts/index.js`). | Sidebar entry for Parts & Parts Manager. |
| `/parts/manager` | Manager-specific dashboard (`src/pages/parts/manager.js`). | Sidebar entry for Parts Manager only. |
| `/parts/deliveries` | Delivery list for parts runs (`src/pages/parts/deliveries.js`). | Sidebar entry for Parts & Parts Manager. |
| `/parts/deliveries/[deliveryId]` | Delivery detail view. | Same as deliveries list. |
| `/parts/delivery-planner` | Planner for delivery/collection stops (`src/pages/parts/delivery-planner.js`). | Appears in parts quick actions for Parts roles. |
| `/parts/create-order` | Create supplier orders (`src/pages/parts/create-order/index.js`). | Parts action shortcut for Parts roles. |
| `/parts/create-order/[orderNumber]` | Existing order detail view. | Same as above. |
| `/parts/goods-in` | Goods-in intake workspace for supplier invoices & stock receipt (`src/pages/parts/goods-in.js`). | Sidebar entry for Parts, Parts Manager, Service, Service Manager, Workshop Manager, Aftersales Manager (plus parts quick action). |

### 3.9 Customer & CRM (internal staff)

| Path | Purpose | Access |
| --- | --- | --- |
| `/customers/[customerSlug]` | Staff customer 360 view with Vehicles & History tabs (`src/pages/customers/[customerSlug].js`). | Reached from global search; no additional guard beyond general auth. |
| `/customer` | Redirect entry into the customer portal shell for real customers (see next section). | Customers only. |

### 3.10 Customer Portal (Customer role)

Every `/customer/*` page renders via `CustomerLayout`, which ensures the signed-in user carries the `CUSTOMER` role and shows a friendly block otherwise (`src/customers/components/CustomerLayout.js`).

| Path | Purpose |
| --- | --- |
| `/customer/index` | Customer dashboard (hero, bookings, VHC summaries) (`src/customers/pages/DashboardPage.js`). |
| `/customer/vehicles` | Garage overview (`src/customers/pages/VehiclesPage` via route). |
| `/customer/vhc` | Customer view of VHC media/status. |
| `/customer/parts` | Parts approvals/payments summary. |
| `/customer/messages` | Customer-facing messaging hub. |
| `/customer/payments` | Saved payment methods & transactions. |

### 3.11 VHC & Share Links

| Path | Purpose | Access |
| --- | --- | --- |
| `/vhc/customer-view/[jobNumber]` | Shareable VHC customer view embedded inside Layout (`src/pages/vhc/customer-view/[jobNumber].js`). | Customers see a customer-facing view; staff opening it get a “Back to workshop” link. No additional guard beyond needing a login; typically accessed via buttons in job cards. |

### 3.12 Messaging, Documents & Misc.

| Path | Purpose | Access |
| --- | --- | --- |
| `/messages` | Internal comms suite, including group chats and job links. | All roles (General section of sidebar). |
| `/customer/messages` | See Customer Portal section – customer-only messaging. | Customer role. |
| `/job-cards/[jobNumber]/documents/upload` (handled via modals) | Document upload popups triggered from the job detail page. | Same as job detail – documented here so IT knows uploads stay inside the job workspace. |
| `/vhc/customer-view/[jobNumber]` | (Already above) – emphasises customer vs workshop view toggles. |  |

### 3.13 Tracking & Statuses

(Already partly covered in sections above, but called out for clarity.)

| Path | Purpose | Access |
| --- | --- | --- |
| `/tracking` | Workshop tracker consolidating equipment, oil/stock, and live jobs. | Techs, Service, Service Manager, Workshop Manager, Valet Service, Admin (sidebar general section). |

---

## 4. Coverage Checklist

Below is the raw list from `find src/pages -type f` at the time of writing. Every path listed here maps to one of the tables above:

```
accounts/create
accounts/edit/[accountId]
accounts/index
accounts/invoices/[invoiceId]
accounts/invoices
accounts/reports
accounts/settings
accounts/transactions/[accountId]
accounts/view/[accountId]
admin/profiles/[user]
admin/users
appointments
clocking
clocking/[technicianSlug]
clocking/admin
customer (portal)
customer/messages
customer/parts
customer/payments
customer/vehicles
customer/vhc
customers/[customerSlug]
dashboard (+ /accounts, /admin, /after-sales, /managers, /mot, /painting, /parts, /service, /valeting, /workshop)
hr/(attendance, disciplinary, employees, index, leave, manager, payroll, performance, recruitment, reports, settings, training)
index
job-cards/[jobNumber] (+ add-checksheet, car-details, check-box, dealer-car-details, upload-checksheet, upload-dealer-file, write-up)
job-cards/appointments
job-cards/archive
job-cards/create
job-cards/myjobs
job-cards/myjobs/[jobNumber]
job-cards/view
job-cards/waiting/nextjobs
login
messages
newsfeed
parts/create-order (+ /[orderNumber])
parts/deliveries (+ /[deliveryId])
parts/delivery-planner
parts/index
parts/manager
profile
tech/consumables-request
tech/dashboard
tracking
unauthorized
valet
vhc/customer-view/[jobNumber]
workshop/consumables-tracker
```

If you add or rename any page component, update this document so the ITS view stays accurate.
