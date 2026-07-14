// file location: src/config/workspace/roleDefaults.js
//
// Central role -> Module -> Page defaults for Workspace Navigation. Pages are
// href references into the canonical workspace manifest; this file never
// creates routes or permissions. Selectors in manifest.js resolve labels and
// discard references that are unavailable for the active role/feature flags.

const page = (href) => href;
const navModule = (key, label, hrefs) => Object.freeze({
  key,
  label,
  hrefs: Object.freeze(hrefs.map(page)),
});
const layout = (...modules) => Object.freeze(modules);

const COMMUNICATION = navModule("communication", "Communication", ["/newsfeed", "/messages"]);
const RECORDS = navModule("records", "Records", ["/archive"]);
const REPORTS_ALL = navModule("business-insight", "Business Insight", [
  "/reports/overview",
  "/reports/accounts",
  "/reports/admin",
  "/reports/workshop",
  "/reports/service",
  "/reports/parts",
  "/reports/mot",
  "/reports/paint",
  "/reports/valeting",
]);

export const WORKSPACE_ROLE_DEFAULT_NAMES = Object.freeze([
  "Retail",
  "Service",
  "Service Manager",
  "Workshop Manager",
  "After Sales Director",
  "Techs",
  "Mobile Technician",
  "Parts",
  "Parts Manager",
  "Parts Driver",
  "MOT Tester",
  "Valet Service",
  "Sales / Administration",
  "Sales Director",
  "Sales",
  "Admin",
  "Admin Manager",
  "Accounts",
  "Accounts Manager",
  "Owner",
  "General Manager",
  "Valet Sales",
  "Buying Director",
  "Second Hand Buying",
  "Vehicle Processor & Photographer",
  "Receptionist",
  "Painters",
  "Contractors",
]);

export const ROLE_WORKSPACE_DEFAULTS = Object.freeze({
  retail: layout(COMMUNICATION, RECORDS),
  service: layout(
    navModule("daily-overview", "Daily Overview", ["/dashboard/service"]),
    navModule("customer-jobs", "Customer & Job Intake", ["/jobs", "/new-job"]),
    navModule("shared-operations", "Shared Operations", ["/goods-in", "/tracking", "/archive"]),
    COMMUNICATION
  ),
  "service manager": layout(
    navModule("management-overview", "Management Overview", ["/dashboard/managers", "/dashboard/service"]),
    navModule("service-control", "Service Control", ["/nextjobs", "/jobs", "/appointments", "/new-job"]),
    navModule("shared-operations", "Shared Operations", ["/goods-in", "/tracking", "/archive"]),
    navModule("operational-reports", "Operational Reports", [
      "/reports/service", "/reports/workshop", "/reports/mot", "/reports/valeting", "/reports/paint",
    ]),
    COMMUNICATION
  ),
  "workshop manager": layout(
    navModule("management-overview", "Management Overview", ["/dashboard/managers", "/dashboard/workshop"]),
    navModule("workshop-control", "Workshop Control", ["/nextjobs", "/jobs", "/clocking", "/consumables-tracker"]),
    navModule("operational-visibility", "Operational Visibility", ["/tracking", "/archive"]),
    navModule("operational-reports", "Operational Reports", [
      "/reports/workshop", "/reports/service", "/reports/mot", "/reports/paint", "/reports/valeting",
    ]),
    COMMUNICATION
  ),
  "after sales director": layout(
    navModule("leadership", "Leadership", ["/dashboard/managers"]),
    REPORTS_ALL,
    COMMUNICATION,
    RECORDS
  ),
  techs: layout(
    navModule("my-day", "My Day", ["/tech/dashboard", "/dashboard/workshop"]),
    navModule("my-work", "My Work", ["/tech", "/tech/efficiency", "/consumables-request"]),
    navModule("workshop-information", "Workshop Information", ["/tracking"]),
    COMMUNICATION
  ),
  technician: layout(
    navModule("my-day", "My Day", ["/dashboard/workshop"]),
    COMMUNICATION
  ),
  tech: layout(COMMUNICATION, RECORDS),
  "mobile technician": layout(
    navModule("my-day", "My Day", ["/mobile/dashboard"]),
    navModule("mobile-work", "Mobile Work", ["/tech", "/appointments", "/new-job", "/consumables-request"]),
    COMMUNICATION
  ),
  parts: layout(
    navModule("parts-overview", "Parts Overview", ["/dashboard/parts"]),
    navModule("stock-receiving", "Stock & Receiving", ["/stock-catalogue", "/goods-in"]),
    navModule("fulfilment", "Fulfilment", ["/jobs", "/deliveries", "/delivery-planner"]),
    navModule("ordering", "Ordering", ["/new-order"]),
    COMMUNICATION,
    RECORDS
  ),
  "parts manager": layout(
    navModule("management-overview", "Management Overview", ["/dashboard/managers", "/parts-manager", "/dashboard/parts"]),
    navModule("stock-receiving", "Stock & Receiving", ["/stock-catalogue", "/goods-in"]),
    navModule("fulfilment", "Fulfilment", ["/jobs", "/deliveries", "/delivery-planner"]),
    navModule("ordering", "Ordering", ["/new-order"]),
    navModule("parts-reports", "Parts Reports", ["/reports/parts"]),
    COMMUNICATION,
    RECORDS
  ),
  "parts driver": layout(COMMUNICATION, RECORDS),
  "mot tester": layout(
    navModule("mot-overview", "MOT Overview", ["/dashboard/mot"]),
    navModule("my-work", "My Work", ["/tech", "/tech/efficiency"]),
    navModule("mot-reports", "MOT Reports", ["/reports/mot"]),
    COMMUNICATION
  ),
  "valet service": layout(
    navModule("valeting-overview", "Valeting Overview", ["/dashboard/valeting"]),
    navModule("work-queue", "Work Queue", ["/valet", "/tracking"]),
    navModule("valeting-reports", "Valeting Reports", ["/reports/valeting"]),
    COMMUNICATION
  ),
  "sales / administration": layout(COMMUNICATION, RECORDS),
  "sales director": layout(REPORTS_ALL, COMMUNICATION, RECORDS),
  sales: layout(
    navModule("website-operations", "Website Operations", ["/website-manager"]),
    COMMUNICATION,
    RECORDS
  ),
  admin: layout(
    navModule("admin-overview", "Admin Overview", ["/dashboard/admin"]),
    navModule("people-operations", "People Operations", [
      "/hr", "/hr/employees", "/hr/attendance", "/hr/leave", "/hr/payroll", "/hr/performance",
      "/hr/training", "/hr/disciplinary", "/hr/recruitment", "/hr/reports", "/hr/settings",
    ]),
    navModule("website-operations", "Website Operations", ["/website-manager"]),
    navModule("staff-finance", "Staff Finance", ["/accounts/payslips"]),
    navModule("operational-visibility", "Operational Visibility", ["/tracking", "/reports/admin"]),
    COMMUNICATION,
    RECORDS
  ),
  "admin manager": layout(
    navModule("management-overview", "Management Overview", ["/dashboard/managers", "/dashboard/admin"]),
    navModule("operational-control", "Operational Control", ["/nextjobs", "/jobs"]),
    navModule("people-hr", "People & HR", [
      "/hr/manager", "/hr", "/hr/employees", "/hr/attendance", "/hr/leave", "/hr/payroll",
      "/hr/performance", "/hr/training", "/hr/disciplinary", "/hr/recruitment", "/hr/reports",
      "/hr/settings", "/admin/users",
    ]),
    navModule("governance", "Governance", ["/admin/compliance"]),
    navModule("website-operations", "Website Operations", ["/website-manager"]),
    navModule("staff-finance", "Staff Finance", ["/accounts/payslips"]),
    REPORTS_ALL,
    COMMUNICATION,
    RECORDS
  ),
  accounts: layout(
    navModule("accounts-overview", "Accounts Overview", ["/dashboard/accounts"]),
    navModule("accounts", "Accounts", ["/accounts", "/company-accounts"]),
    navModule("billing", "Billing", ["/accounts/invoices", "/accounts/reports", "/accounts/payslips"]),
    navModule("financial-reports", "Financial Reports", ["/reports/accounts"]),
    COMMUNICATION
  ),
  "accounts manager": layout(
    navModule("management-overview", "Management Overview", ["/dashboard/managers", "/dashboard/accounts"]),
    navModule("accounts", "Accounts", ["/accounts", "/company-accounts"]),
    navModule("billing", "Billing", ["/accounts/invoices", "/accounts/reports", "/accounts/payslips"]),
    navModule("financial-reports", "Financial Reports", ["/reports/accounts"]),
    COMMUNICATION
  ),
  owner: layout(
    navModule("leadership", "Leadership", ["/dashboard/managers"]),
    navModule("people-hr", "People & HR", [
      "/hr/manager", "/hr", "/hr/employees", "/hr/attendance", "/hr/leave", "/hr/payroll",
      "/hr/performance", "/hr/training", "/hr/disciplinary", "/hr/recruitment", "/hr/reports",
      "/hr/settings", "/admin/users",
    ]),
    navModule("governance", "Governance", ["/admin/compliance"]),
    navModule("website-operations", "Website Operations", ["/website-manager"]),
    navModule("staff-finance", "Staff Finance", ["/accounts/payslips"]),
    REPORTS_ALL,
    COMMUNICATION,
    RECORDS
  ),
  "general manager": layout(
    navModule("leadership", "Leadership", ["/dashboard/managers"]),
    navModule("people-management", "People Management", ["/hr/employees", "/hr/leave"]),
    navModule("website-operations", "Website Operations", ["/website-manager"]),
    REPORTS_ALL,
    COMMUNICATION,
    RECORDS
  ),
  "valet sales": layout(
    navModule("valeting-insight", "Valeting Insight", ["/reports/valeting"]),
    COMMUNICATION,
    RECORDS
  ),
  "buying director": layout(REPORTS_ALL, COMMUNICATION, RECORDS),
  "second hand buying": layout(COMMUNICATION, RECORDS),
  "vehicle processor & photographer": layout(COMMUNICATION, RECORDS),
  receptionist: layout(COMMUNICATION, RECORDS),
  painters: layout(
    navModule("paint-overview", "Paint Overview", ["/dashboard/painting"]),
    navModule("paint-reports", "Paint Reports", ["/reports/paint"]),
    COMMUNICATION,
    RECORDS
  ),
  painter: layout(
    navModule("paint-reports", "Paint Reports", ["/reports/paint"]),
    COMMUNICATION,
    RECORDS
  ),
  contractors: layout(COMMUNICATION, RECORDS),

  // Supported legacy spellings/roles remain complete even though they are not
  // offered as new role defaults in the developer picker.
  "aftersales manager": layout(
    navModule("service-control", "Service Control", ["/nextjobs", "/jobs", "/goods-in"]),
    navModule("operational-reports", "Operational Reports", ["/reports/service"]),
    COMMUNICATION,
    RECORDS
  ),
  "after sales manager": layout(
    navModule("operational-reports", "Operational Reports", ["/reports/service"]),
    COMMUNICATION,
    RECORDS
  ),
  "workshop controller": layout(
    navModule("workshop-reports", "Workshop Reports", ["/reports/workshop"]),
    COMMUNICATION,
    RECORDS
  ),
  manager: layout(REPORTS_ALL, COMMUNICATION, RECORDS),
});

export function normalizeWorkspaceRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function getConfiguredRoleDefault(role) {
  return ROLE_WORKSPACE_DEFAULTS[normalizeWorkspaceRole(role)] || layout(COMMUNICATION, RECORDS);
}
