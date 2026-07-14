# Workspace role defaults

Workspace Navigation is now role-first. Each staff role receives a default sidebar made from centrally defined modules in `src/config/workspace/roleDefaults.js`. Modules are presentation only: they organise existing staff routes, but page and API permissions remain enforced by the route access layer.

Developer tooling lives at `/dev/sidebar-access` and supports:

- previewing each role default
- copying a role default to an individual user
- adding, removing, and reordering modules
- adding, removing, and reordering pages inside modules
- restoring a user's inherited role default
- distinguishing inherited defaults from saved user overrides

Legacy `sidebar_access.items/groups` JSON remains valid. v4 layouts add `sourceRole` and `modules`, and old data is preserved during migration.

## Role reference

### Retail

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Service

- Daily Overview: `/dashboard/service`
- Customer & Job Intake: `/jobs`, `/new-job`
- Shared Operations: `/goods-in`, `/tracking`, `/archive`
- Communication: `/newsfeed`, `/messages`

### Service Manager

- Management Overview: `/dashboard/managers`, `/dashboard/service`
- Service Control: `/nextjobs`, `/jobs`, `/appointments`, `/new-job`
- Shared Operations: `/goods-in`, `/tracking`, `/archive`
- Operational Reports: `/reports/service`, `/reports/workshop`, `/reports/mot`, `/reports/valeting`, `/reports/paint`
- Communication: `/newsfeed`, `/messages`

### Workshop Manager

- Management Overview: `/dashboard/managers`, `/dashboard/workshop`
- Workshop Control: `/nextjobs`, `/jobs`, `/clocking`, `/consumables-tracker`
- Operational Visibility: `/tracking`, `/archive`
- Operational Reports: `/reports/workshop`, `/reports/service`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`

### After Sales Director

- Leadership: `/dashboard/managers`
- Business Insight: `/reports/overview`, `/reports/accounts`, `/reports/admin`, `/reports/workshop`, `/reports/service`, `/reports/parts`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Techs

- My Day: `/tech/dashboard`, `/dashboard/workshop`
- My Work: `/tech`, `/tech/efficiency`, `/consumables-request`
- Workshop Information: `/tracking`
- Communication: `/newsfeed`, `/messages`

### Mobile Technician

- My Day: `/mobile/dashboard`
- Mobile Work: `/tech`, `/appointments`, `/new-job`, `/consumables-request`
- Communication: `/newsfeed`, `/messages`

### Parts

- Parts Overview: `/dashboard/parts`
- Stock & Receiving: `/stock-catalogue`, `/goods-in`
- Fulfilment: `/jobs`, `/deliveries`, `/delivery-planner`
- Ordering: `/new-order`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Parts Manager

- Management Overview: `/dashboard/managers`, `/parts-manager`, `/dashboard/parts`
- Stock & Receiving: `/stock-catalogue`, `/goods-in`
- Fulfilment: `/jobs`, `/deliveries`, `/delivery-planner`
- Ordering: `/new-order`
- Parts Reports: `/reports/parts`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Parts Driver

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### MOT Tester

- MOT Overview: `/dashboard/mot`
- My Work: `/tech`, `/tech/efficiency`
- MOT Reports: `/reports/mot`
- Communication: `/newsfeed`, `/messages`

### Valet Service

- Valeting Overview: `/dashboard/valeting`
- Work Queue: `/valet`, `/tracking`
- Valeting Reports: `/reports/valeting`
- Communication: `/newsfeed`, `/messages`

### Sales / Administration

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Sales Director

- Business Insight: `/reports/overview`, `/reports/accounts`, `/reports/admin`, `/reports/workshop`, `/reports/service`, `/reports/parts`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Sales

- Website Operations: `/website-manager`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Admin

- Admin Overview: `/dashboard/admin`
- People Operations: `/hr`, `/hr/employees`, `/hr/attendance`, `/hr/leave`, `/hr/payroll`, `/hr/performance`, `/hr/training`, `/hr/disciplinary`, `/hr/recruitment`, `/hr/reports`, `/hr/settings`
- Website Operations: `/website-manager`
- Staff Finance: `/accounts/payslips`
- Operational Visibility: `/tracking`, `/reports/admin`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Admin Manager

- Management Overview: `/dashboard/managers`, `/dashboard/admin`
- Operational Control: `/nextjobs`, `/jobs`
- People & HR: `/hr/manager`, `/hr`, `/hr/employees`, `/hr/attendance`, `/hr/leave`, `/hr/payroll`, `/hr/performance`, `/hr/training`, `/hr/disciplinary`, `/hr/recruitment`, `/hr/reports`, `/hr/settings`, `/admin/users`
- Governance: `/admin/compliance`
- Website Operations: `/website-manager`
- Staff Finance: `/accounts/payslips`
- Business Insight: `/reports/overview`, `/reports/accounts`, `/reports/admin`, `/reports/workshop`, `/reports/service`, `/reports/parts`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Accounts

- Accounts Overview: `/dashboard/accounts`
- Accounts: `/accounts`, `/company-accounts`
- Billing: `/accounts/invoices`, `/accounts/reports`, `/accounts/payslips`
- Financial Reports: `/reports/accounts`
- Communication: `/newsfeed`, `/messages`

### Accounts Manager

- Management Overview: `/dashboard/managers`, `/dashboard/accounts`
- Accounts: `/accounts`, `/company-accounts`
- Billing: `/accounts/invoices`, `/accounts/reports`, `/accounts/payslips`
- Financial Reports: `/reports/accounts`
- Communication: `/newsfeed`, `/messages`

### Owner

- Leadership: `/dashboard/managers`
- People & HR: `/hr/manager`, `/hr`, `/hr/employees`, `/hr/attendance`, `/hr/leave`, `/hr/payroll`, `/hr/performance`, `/hr/training`, `/hr/disciplinary`, `/hr/recruitment`, `/hr/reports`, `/hr/settings`, `/admin/users`
- Governance: `/admin/compliance`
- Website Operations: `/website-manager`
- Staff Finance: `/accounts/payslips`
- Business Insight: `/reports/overview`, `/reports/accounts`, `/reports/admin`, `/reports/workshop`, `/reports/service`, `/reports/parts`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### General Manager

- Leadership: `/dashboard/managers`
- People Management: `/hr/employees`, `/hr/leave`
- Website Operations: `/website-manager`
- Business Insight: `/reports/overview`, `/reports/accounts`, `/reports/admin`, `/reports/workshop`, `/reports/service`, `/reports/parts`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Valet Sales

- Valeting Insight: `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Buying Director

- Business Insight: `/reports/overview`, `/reports/accounts`, `/reports/admin`, `/reports/workshop`, `/reports/service`, `/reports/parts`, `/reports/mot`, `/reports/paint`, `/reports/valeting`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Second Hand Buying

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Vehicle Processor & Photographer

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Receptionist

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Painters

- Paint Overview: `/dashboard/painting`
- Paint Reports: `/reports/paint`
- Communication: `/newsfeed`, `/messages`
- Records: `/archive`

### Contractors

- Communication: `/newsfeed`, `/messages`
- Records: `/archive`
