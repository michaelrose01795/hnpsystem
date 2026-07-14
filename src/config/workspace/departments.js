// file location: src/config/workspace/departments.js
//
// THE WORKSPACE NAVIGATION MANIFEST.
//
// This is the single, department-first source of truth for staff navigation.
// The classic role-organised sidebar is still reproduced byte-for-byte through
// toSidebarSections() for rollback, while the workspace-enabled sidebar,
// search, dashboards and topbar quick actions consume the newer selectors.
//
// -------------------------------------------------------------------------
// EDGE-SAFE. This module is reachable from src/proxy.js (edge middleware) via
// the nav config → src/lib/auth/pageAccess.js. Keep it to PLAIN DATA + pure
// helpers only: no React, no Node-only APIs, no Supabase. The only imports are
// other plain-data config modules already trusted by the edge chain.
// -------------------------------------------------------------------------
//
// DEPARTMENT-FIRST, not role-first. The top-level unit here is the DEPARTMENT
// (keyed on the canonical taxonomy in src/lib/reporting/config/departments.js —
// ROLE_DEPARTMENT_MAP). Roles remain an attribute used only for per-item
// visibility. The legacy sidebar was one section PER ROLE with the same hrefs
// repeated ~7×; here each of those sections is bucketed under the department it
// belongs to. The department grouping powers the forward-looking selectors
// (getDepartmentsForRoles / getContextNav) while the per-section `order` lets
// toSidebarSections() re-emit the exact legacy ordering for backwards compat.
//
// HOW TO ADD A DEPARTMENT OR PAGE: see
// docs/Workspace Navigation/workspace-navigation-manifest-guide.md — it is a
// single edit here and every surface + the permission layer pick it up.

import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { EXECUTIVE_ROLES } from "@/lib/reporting/permissionScope";
import { SERVICE_ACTION_ROLES } from "@/lib/auth/serviceActionRoles";

// ---------------------------------------------------------------------------
// Reporting role derivations (moved here from src/config/navigation.js so the
// manifest owns them). Roles that may see each department report are DERIVED
// from the canonical role→department map so nav and reporting can never drift.
// ---------------------------------------------------------------------------
const rolesForDepts = (depts) =>
  Object.entries(ROLE_DEPARTMENT_MAP)
    .filter(([, dept]) => depts.has(dept))
    .map(([role]) => role);

// Workshop report: workshop + service (VHC is cross-cutting) + management/admin.
const WORKSHOP_REPORT_ROLES = rolesForDepts(new Set(["workshop", "service", "management", "admin"]));
// Parts report: parts (operational + manager) + management/admin oversight.
const PARTS_REPORT_ROLES = rolesForDepts(new Set(["parts", "management", "admin"]));
// Service Advisor report (Phase 9 — operational): service (operational + manager)
// + management/admin oversight. The API enforces scope server-side regardless.
const SERVICE_REPORT_ROLES = rolesForDepts(new Set(["service", "management", "admin"]));
// MOT report (Phase 10): MOT testers + service/workshop hand-off roles +
// management/admin oversight. The API enforces scope server-side regardless.
const MOT_REPORT_ROLES = rolesForDepts(new Set(["mot", "service", "workshop", "management", "admin"]));
const PAINT_REPORT_ROLES = rolesForDepts(new Set(["paint", "service", "workshop", "management", "admin"]));
const VALETING_REPORT_ROLES = rolesForDepts(new Set(["valeting", "service", "workshop", "management", "admin"]));
const ADMIN_REPORT_ROLES = Array.from(
  new Set([...rolesForDepts(new Set(["management"])), "admin", ...EXECUTIVE_ROLES])
);
const EXECUTIVE_REPORT_ROLES = Array.from(new Set(EXECUTIVE_ROLES));
// Accounts report (Phase 8 — financial): Accounts + Management departments,
// unioned with the executive role set so directors outside those departments can
// reach it. Deliberately NO general "admin" department — financial reporting is
// the highest-sensitivity tier; the API enforces the per-KPI £ gate regardless.
const ACCOUNTS_REPORT_ROLES = Array.from(
  new Set([...rolesForDepts(new Set(["accounts", "management"])), ...EXECUTIVE_ROLES])
);
const ACCOUNT_WORKSPACE_ROLES = ["accounts", "accounts manager"];
const PARTS_WORKSPACE_ROLES = ["parts", "parts manager"];

// ---------------------------------------------------------------------------
// 1. DEPARTMENT METADATA (the department-first backbone).
//
// One entry per department that has a presence in staff navigation today. The
// `category` mirrors the legacy three-bucket model (general / departments /
// account) so the classic rail keeps rendering unchanged. `home`, `icon`,
// `order`, `sensitive` and `roles` feed the forward-looking selectors (the
// Department Rail, role→home resolver, sensitivity gates) without affecting
// Phase-0 output. Departments without a nav presence today (hr, admin, paint)
// are intentionally omitted here and added when their pages join the manifest —
// see the authoring guide.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 🔒 DEVELOPER SIDEBAR LOCK — DO NOT CHANGE.
//
// The Developer group and its "Developer Platform" sidebar button are a
// PERMANENT INVARIANT: the `dev` role must ALWAYS see them, and they must never
// be re-gated to another role. This frozen constant is the single source of the
// invariant. It is enforced two ways so it can never silently break:
//   1. Runtime self-heal — getWorkspaceGroups() / getDepartmentWorkspaceNav()
//      re-inject the group + button from this lock if a manifest edit ever drops
//      or alters them (see src/config/workspace/manifest.js).
//   2. Test lock — a dedicated invariant suite in manifest.test.js fails CI if
//      the developer department, its roles, or its nav item ever change.
// If you believe this needs to change, it does not. Leave it alone.
// ---------------------------------------------------------------------------
export const DEVELOPER_GROUP_LOCK = Object.freeze({
  key: "developer",
  label: "Developer",
  category: "departments",
  icon: "developer",
  home: "/dev",
  roles: Object.freeze(["dev"]),
  navItem: Object.freeze({ label: "Developer Platform", href: "/dev", roles: Object.freeze(["dev"]) }),
});

export const WORKSPACE_DEPARTMENTS = Object.freeze([
  {
    key: "general",
    label: "General",
    category: "general",
    icon: "general",
    // Cross-cutting app-wide items (News Feed, Messages, …); not a real
    // department — no single "home", falls back to the news feed.
    home: "/newsfeed",
    order: 0,
    roles: [], // visible to all authenticated staff
    sensitive: null,
    flag: null,
  },
  {
    key: "management",
    label: "Admin",
    category: "departments",
    icon: "management",
    home: "/dashboard/managers",
    order: 10,
    // Derived from ROLE_DEPARTMENT_MAP (admin manager / owner / general manager /
    // manager / directors → management). Left explicit-null so selectors derive.
    roles: undefined,
    sensitive: null,
    flag: null,
  },
  {
    key: "service",
    label: "Reception",
    category: "departments",
    icon: "service",
    home: "/dashboard/service",
    order: 20,
    roles: undefined,
    sensitive: null,
    flag: null,
  },
  {
    key: "workshop",
    label: "Workshop",
    category: "departments",
    icon: "workshop",
    home: "/dashboard/workshop",
    order: 30,
    roles: undefined,
    sensitive: null,
    flag: null,
  },
  {
    key: "mot",
    label: "MOT",
    category: "departments",
    icon: "mot",
    home: "/dashboard/mot",
    order: 40,
    roles: undefined,
    sensitive: null,
    flag: null,
  },
  {
    key: "parts",
    label: "Parts",
    category: "departments",
    icon: "parts",
    home: "/dashboard/parts",
    order: 50,
    roles: undefined,
    sensitive: null,
    flag: null,
  },
  {
    key: "valeting",
    label: "Valeting",
    category: "departments",
    icon: "valeting",
    home: "/dashboard/valeting",
    order: 60,
    roles: undefined,
    sensitive: null,
    flag: null,
  },
  {
    key: "accounts",
    label: "Accounts",
    category: "departments",
    icon: "accounts",
    home: "/dashboard/accounts",
    order: 70,
    roles: undefined,
    sensitive: "financial",
    flag: null,
  },
  {
    key: "reports",
    label: "Reports",
    category: "departments",
    icon: "reports",
    home: "/reports/overview",
    order: 80,
    roles: undefined,
    sensitive: null,
    // The whole Reports area stays gated by the existing reporting flag.
    flag: "reporting_nav_enabled",
  },
  {
    // 🔒 LOCKED — see DEVELOPER_GROUP_LOCK above. Must stay key "developer",
    // category "departments", home "/dev", roles ["dev"]. Do not change/remove.
    key: "developer",
    label: "Developer",
    category: "departments",
    icon: "developer",
    home: "/dev",
    order: 90,
    // Synthetic dev-login role only; never derived from ROLE_DEPARTMENT_MAP.
    roles: ["dev"],
    sensitive: null,
    flag: null,
  },
  {
    key: "account",
    label: "Account",
    category: "account",
    icon: "account",
    home: "/profile",
    order: 100,
    roles: [], // profile/logout are available to every authenticated user
    sensitive: null,
    flag: null,
  },
]);

export const WORKSPACE_DASHBOARD_SHORTCUTS = Object.freeze([
  {
    label: "Workshop Dashboard",
    href: "/dashboard/workshop",
    roles: ["workshop manager", "techs", "technician"],
    description: "Technician assignments, consumables, and throughput",
    department: "workshop",
  },
  {
    label: "Tech Dashboard",
    href: "/tech/dashboard",
    roles: ["techs"],
    description: "Technician personal dashboard with job assignments and clocking",
    department: "workshop",
  },
  {
    label: "Mobile Tech Dashboard",
    href: "/mobile/dashboard",
    roles: ["mobile technician"],
    description: "Today's on-site jobs, appointment windows, and parts status for mobile visits",
    department: "workshop",
  },
  {
    label: "Service Dashboard",
    href: "/dashboard/service",
    roles: ["service", "service manager"],
    description: "Advisor capacity, arrivals, and daily targets",
    department: "service",
  },
  {
    label: "Managers Dashboard",
    href: "/dashboard/managers",
    roles: [
      "service manager",
      "workshop manager",
      "parts manager",
      "admin manager",
      "accounts manager",
      "general manager",
      "owner",
    ],
    description: "Executive view for service, workshop, and support leaders",
    department: "management",
  },
  {
    label: "Parts Dashboard",
    href: "/dashboard/parts",
    roles: PARTS_WORKSPACE_ROLES,
    description: "Parts queue, inbound deliveries, and critical items",
    department: "parts",
  },
  {
    label: "Parts Manager Dashboard",
    href: "/parts-manager",
    roles: ["parts manager"],
    description: "View stock, spending, and income KPIs",
    department: "parts",
  },
  {
    label: "MOT Dashboard",
    href: "/dashboard/mot",
    roles: ["mot tester"],
    description: "Upcoming MOT bookings, re-tests, and compliance notes",
    department: "mot",
  },
  {
    label: "Valeting Dashboard",
    href: "/dashboard/valeting",
    roles: ["valet service"],
    description: "Wash bay priorities, handovers, and staff load",
    department: "valeting",
  },
  {
    label: "Painting Dashboard",
    href: "/dashboard/painting",
    roles: ["painters"],
    description: "Bodyshop priorities, colour matching, and cycle times",
    department: "paint",
  },
  {
    label: "Accounts Dashboard",
    href: "/dashboard/accounts",
    roles: ACCOUNT_WORKSPACE_ROLES,
    description: "Financial KPIs, invoices, and cash-flow signals",
    department: "accounts",
  },
  {
    label: "Admin Dashboard",
    href: "/dashboard/admin",
    roles: ["admin", "admin manager"],
    description: "Admin alerts, approvals, and escalation flags",
    department: "management",
  },
]);

export const WORKSPACE_QUICK_ACTIONS = Object.freeze([
  {
    label: "Create Job Card",
    href: "/new-job",
    roles: SERVICE_ACTION_ROLES,
    departments: ["service", "workshop"],
  },
  {
    label: "Appointments",
    href: "/job-cards/appointments",
    roles: SERVICE_ACTION_ROLES,
    departments: ["service", "workshop"],
  },
  {
    label: "Delivery/Collection Planner",
    href: "/delivery-planner",
    roles: PARTS_WORKSPACE_ROLES,
    departments: ["parts"],
  },
  {
    label: "Create Order",
    href: "/new-order",
    roles: PARTS_WORKSPACE_ROLES,
    departments: ["parts"],
  },
  {
    label: "Goods In",
    href: "/goods-in",
    roles: PARTS_WORKSPACE_ROLES,
    departments: ["parts"],
  },
]);

export const WORKSPACE_PAGE_TABS = Object.freeze([
  {
    key: "hr-modules",
    ariaLabel: "HR modules",
    matchers: [
      { href: "/hr", match: "exact" },
      { href: "/hr/employees", match: "prefix" },
      { href: "/hr/attendance", match: "prefix" },
      { href: "/hr/payroll", match: "prefix" },
      { href: "/hr/leave", match: "prefix" },
      { href: "/hr/performance", match: "prefix" },
      { href: "/hr/training", match: "prefix" },
      { href: "/hr/disciplinary", match: "prefix" },
      { href: "/hr/recruitment", match: "prefix" },
      { href: "/hr/reports", match: "prefix" },
      { href: "/hr/settings", match: "prefix" },
      { href: "/admin/users", match: "prefix" },
    ],
    items: [
      { href: "/hr/employees", label: "Employee Records", match: "prefix" },
      { href: "/hr/attendance", label: "Attendance", match: "prefix" },
      { href: "/hr/payroll", label: "Payroll", match: "prefix" },
      { href: "/hr/leave", label: "Leave", match: "prefix" },
      { href: "/hr/performance", label: "Performance", match: "prefix" },
      { href: "/hr/training", label: "Training", match: "prefix" },
      { href: "/hr/disciplinary", label: "Incidents", match: "prefix" },
      { href: "/hr/recruitment", label: "Recruitment", match: "prefix" },
      { href: "/hr/reports", label: "HR Reports", match: "prefix" },
      { href: "/hr/settings", label: "HR Settings", match: "prefix" },
      { href: "/admin/users", label: "User Admin", match: "exact" },
    ],
  },
  {
    key: "workshop-navigation",
    ariaLabel: "Workshop navigation",
    matchers: [
      { href: "/workshop", match: "prefix" },
      { href: "/nextjobs", match: "prefix" },
      { href: "/jobs", match: "prefix" },
      { href: "/consumables-tracker", match: "prefix" },
      { href: "/clocking", match: "prefix" },
    ],
    items: [
      { href: "/workshop", label: "Dashboard", match: "prefix" },
      { href: "/nextjobs", label: "Next Jobs", match: "prefix" },
      { href: "/jobs", label: "Job Cards", match: "prefix" },
      { href: "/consumables-tracker", label: "Consumables", match: "prefix" },
      { href: "/clocking", label: "Clocking", match: "prefix" },
    ],
  },
  {
    key: "workshop-quick-actions",
    ariaLabel: "Workshop quick actions",
    matchers: [
      { href: "/workshop", match: "prefix" },
      { href: "/nextjobs", match: "prefix" },
      { href: "/jobs", match: "prefix" },
      { href: "/consumables-tracker", match: "prefix" },
      { href: "/clocking", match: "prefix" },
      { href: "/new-job", match: "prefix" },
      { href: "/job-cards/appointments", match: "prefix" },
      { href: "/appointments", match: "prefix" },
    ],
    items: [
      { href: "/new-job", label: "Create Job Card", match: "prefix" },
      { href: "/job-cards/appointments", label: "Appointments", match: "prefix" },
      { href: "/appointments", label: "Check In", match: "prefix" },
    ],
  },
  {
    key: "parts-workspace",
    ariaLabel: "Parts workspace pages",
    matchers: [
      { href: "/goods-in", match: "prefix" },
      { href: "/deliveries", match: "prefix" },
      { href: "/delivery-planner", match: "prefix" },
      { href: "/parts-manager", match: "prefix" },
    ],
    items: [
      { href: "/goods-in", label: "Goods In", match: "prefix" },
      { href: "/deliveries", label: "Deliveries", match: "prefix" },
      {
        href: "/delivery-planner",
        label: "Delivery/Collection Planner",
        match: "prefix",
      },
      {
        href: "/parts-manager",
        label: "Manager",
        match: "prefix",
        roles: ["parts manager"],
      },
    ],
  },
]);

// ---------------------------------------------------------------------------
// 2. NAV SECTIONS (the single source the rail + permission layer walk).
//
// These are the EXACT sidebar sections that render today, each tagged with the
// `department` it belongs to and a global `order` so toSidebarSections() can
// re-emit them in the current order for byte-identical backwards compatibility.
//
// ⚠️ ITEM SHAPE IS FROZEN. Each item must carry ONLY the legacy keys
// `{ label, href, roles }` (plus `action` for the logout control). Do NOT add
// forward-looking keys (icon, keywords, description) to items here — that would
// break the byte-identical toSidebarSections() lock in manifest.test.js. Put
// per-department metadata on WORKSPACE_DEPARTMENTS above instead.
//
// The `order` values leave gaps so future sections can slot in without a
// renumber. Current global order (do not change without updating the test):
//   General 0 · Admin Manager 10 · Owner 20 · Service 30 · Service Manager 40 ·
//   Workshop Manager 50 · Aftersales Manager 60 · Techs 70 · Mobile Technician 80 ·
//   MOT Tester 90 · Parts 100 · Parts Manager 110 · Valet Service 120 ·
//   Accounts Manager 130 · Developer 150 · Reports 155 · Account 160
// (Reports sits just before Account, exactly as the legacy insert did.)
// ---------------------------------------------------------------------------
export const WORKSPACE_NAV_SECTIONS = Object.freeze([
  {
    department: "general",
    order: 0,
    label: "General",
    category: "general",
    flag: null,
    items: [
      { label: "News Feed", href: "/newsfeed", roles: [] },
      { label: "Messages", href: "/messages", roles: [] },
      {
        label: "Tracker",
        href: "/tracking",
        roles: [
          "techs",
          "service",
          "service manager",
          "workshop manager",
          "valet service",
          "admin",
        ],
      },
      {
        label: "Archive Job",
        href: "/archive",
        roles: [],
      },
    ],
  },
  {
    department: "management",
    order: 10,
    label: "Admin Manager",
    category: "departments",
    flag: null,
    items: [
      { label: "Next Jobs", href: "/nextjobs", roles: ["admin manager"] },
      { label: "Job Cards", href: "/jobs", roles: ["admin manager"] },
      { label: "User Admin", href: "/admin/users", roles: ["admin manager"] },
      { label: "Compliance", href: "/admin/compliance", roles: ["admin manager"] },
    ],
  },
  {
    department: "management",
    order: 20,
    label: "Owner",
    category: "departments",
    flag: null,
    items: [
      { label: "HR Manager", href: "/hr/manager", roles: ["owner"] },
      { label: "User Admin", href: "/admin/users", roles: ["owner"] },
      { label: "Compliance", href: "/admin/compliance", roles: ["owner"] },
      {
        // Staff-side Website Management area (content + analytics).
        // Access: Admin, Managers and Sales — keep this list in sync with
        // WEBSITE_MANAGER_ROLES in src/pages/staff/website-manager.js.
        label: "Website Manager",
        href: "/website-manager",
        roles: ["owner", "admin", "admin manager", "general manager", "sales"],
      },
      {
        // Deep-link into the Live Preview tab inside the Website Manager
        // (sidebar reads ?tab=preview on first render — see WebsiteManager.js).
        label: "Website Preview",
        href: "/website-manager?tab=preview",
        roles: ["owner", "admin", "admin manager", "general manager", "sales"],
      },
      {
        // Deep-link into the Shop tab (products / categories / orders).
        label: "Website Shop",
        href: "/website-manager?tab=shop",
        roles: ["owner", "admin", "admin manager", "general manager", "sales"],
      },
      {
        // Quick jump to the public-facing shop section as customers see it.
        label: "Public Shop (live)",
        href: "/website#shop",
        roles: ["owner", "admin", "admin manager", "general manager", "sales"],
      },
    ],
  },
  {
    department: "service",
    order: 30,
    label: "Service",
    category: "departments",
    flag: null,
    items: [
      { label: "Job Cards", href: "/jobs", roles: ["service"] },
      { label: "Goods In", href: "/goods-in", roles: ["service"] },
      { label: "New Job", href: "/new-job", roles: ["service"] },
    ],
  },
  {
    department: "service",
    order: 40,
    label: "Service Manager",
    category: "departments",
    flag: null,
    items: [
      { label: "Next Jobs", href: "/nextjobs", roles: ["service manager"] },
      { label: "Job Cards", href: "/jobs", roles: ["service manager"] },
      { label: "Goods In", href: "/goods-in", roles: ["service manager"] },
      { label: "Mobile Appointments", href: "/appointments", roles: ["service manager"] },
      { label: "New Job", href: "/new-job", roles: ["service manager"] },
    ],
  },
  {
    department: "workshop",
    order: 50,
    label: "Workshop Manager",
    category: "departments",
    flag: null,
    items: [
      { label: "Next Jobs", href: "/nextjobs", roles: ["workshop manager"] },
      { label: "Job Cards", href: "/jobs", roles: ["workshop manager"] },
      { label: "Clocking", href: "/clocking", roles: ["workshop manager"] },
      {
        label: "Consumables Tracker", // Workshop consumable planning workspace
        href: "/consumables-tracker",
        roles: ["workshop manager"],
      },
      // Goods In moved OUT of the Workshop group and into the Parts group
      // (it already lists under Parts / Parts Manager). A Workshop Manager now
      // only reaches Goods In if they are granted the Parts group — access is
      // group-based, per the Sidebar Access model.
    ],
  },
  {
    department: "service",
    order: 60,
    label: "Aftersales Manager",
    category: "departments",
    flag: null,
    items: [
      { label: "Next Jobs", href: "/nextjobs", roles: ["aftersales manager"] },
      { label: "Job Cards", href: "/jobs", roles: ["aftersales manager"] },
      { label: "Goods In", href: "/goods-in", roles: ["aftersales manager"] },
    ],
  },
  {
    department: "workshop",
    order: 70,
    label: "Techs",
    category: "departments",
    flag: null,
    items: [
      { label: "My Jobs", href: "/tech", roles: ["techs"] },
      {
        label: "Request Consumables", // Technician consumable request portal
        href: "/consumables-request",
        roles: ["techs"],
      },
      { label: "Efficiency", href: "/tech/efficiency", roles: ["techs"] },
    ],
  },
  {
    department: "workshop",
    order: 80,
    label: "Mobile Technician",
    category: "departments",
    flag: null,
    items: [
      { label: "My Jobs", href: "/tech", roles: ["mobile technician"] },
      { label: "Mobile Appointments", href: "/appointments", roles: ["mobile technician"] },
      { label: "Request Parts", href: "/consumables-request", roles: ["mobile technician"] },
      { label: "New Mobile Job", href: "/new-job", roles: ["mobile technician"] },
    ],
  },
  {
    department: "mot",
    order: 90,
    label: "MOT Tester",
    category: "departments",
    flag: null,
    items: [
      { label: "My Jobs", href: "/tech", roles: ["mot tester"] },
      { label: "Efficiency", href: "/tech/efficiency", roles: ["mot tester"] },
    ],
  },
  {
    department: "parts",
    order: 100,
    label: "Parts",
    category: "departments",
    flag: null,
    items: [
      { label: "Job Cards", href: "/jobs", roles: ["parts"] },
      { label: "Stock Catalogue", href: "/stock-catalogue", roles: ["parts"] },
      { label: "Goods In", href: "/goods-in", roles: ["parts"] },
      { label: "Deliveries", href: "/deliveries", roles: ["parts"] },
    ],
  },
  {
    department: "parts",
    order: 110,
    label: "Parts Manager",
    category: "departments",
    flag: null,
    items: [
      { label: "Job Cards", href: "/jobs", roles: ["parts manager"] },
      { label: "Stock Catalogue", href: "/stock-catalogue", roles: ["parts manager"] },
      { label: "Goods In", href: "/goods-in", roles: ["parts manager"] },
      { label: "Deliveries", href: "/deliveries", roles: ["parts manager"] },
    ],
  },
  {
    department: "valeting",
    order: 120,
    label: "Valet Service",
    category: "departments",
    flag: null,
    items: [
      { label: "Valet Jobs", href: "/valet", roles: ["valet service"] },
    ],
  },
  {
    department: "accounts",
    order: 130,
    label: "Accounts Manager",
    category: "departments",
    flag: null,
    items: [
      {
        label: "Payslips",
        href: "/accounts/payslips",
        roles: ["accounts", "accounts manager", "admin", "admin manager", "owner"],
      },
    ],
  },
  {
    // Developer Platform entry — visible ONLY to the synthetic `dev` role
    // (Dev-Login mint). It never appears for staff: `dev` is not in
    // roleCategories and is excluded from DEV_FULL_ACCESS_ROLES, so no staff
    // session carries it. Routes to the platform home; /dev is already in the
    // route allow-list for dev sessions.
    // 🔒 LOCKED — see DEVELOPER_GROUP_LOCK above. The Developer Platform button
    // is guaranteed for the dev role and can never be removed or re-gated.
    department: "developer",
    order: 150,
    label: "Developer",
    category: "departments",
    flag: null,
    items: [
      { label: "Developer Platform", href: "/dev", roles: ["dev"] },
    ],
  },
  {
    // Phase 6/7: the Reports section is gated by the `reporting_nav_enabled`
    // flag. Sits just before Account, exactly where the legacy code inserted it.
    // The PageAccessGuard reads these links (via sidebarSections), so listing
    // them here is what makes /reports/{…} reachable for the permitted roles.
    department: "reports",
    order: 155,
    label: "Reports",
    category: "departments",
    flag: "reporting_nav_enabled",
    items: [
      { label: "Workshop Reports", href: "/reports/workshop", roles: WORKSHOP_REPORT_ROLES },
      { label: "Parts Reports", href: "/reports/parts", roles: PARTS_REPORT_ROLES },
      { label: "Service Advisor Reports", href: "/reports/service", roles: SERVICE_REPORT_ROLES },
      { label: "MOT Reports", href: "/reports/mot", roles: MOT_REPORT_ROLES },
      { label: "Paint Reports", href: "/reports/paint", roles: PAINT_REPORT_ROLES },
      { label: "Accounts Reports", href: "/reports/accounts", roles: ACCOUNTS_REPORT_ROLES },
      { label: "Valeting Reports", href: "/reports/valeting", roles: VALETING_REPORT_ROLES },
      { label: "Admin Reports", href: "/reports/admin", roles: ADMIN_REPORT_ROLES },
      { label: "Executive Reports", href: "/reports/overview", roles: EXECUTIVE_REPORT_ROLES },
    ],
  },
  {
    department: "account",
    order: 160,
    label: "Account",
    category: "account",
    flag: null,
    items: [
      { label: "Profile", href: "/profile", roles: [] },
      { label: "Logout", href: null, roles: [], action: "logout" },
    ],
  },
]);

// Workspace-only navigation additions. These deliberately stay outside
// WORKSPACE_NAV_SECTIONS so the classic role-organised sidebar remains
// byte-identical while the new department-first rail can still be fully
// manifest-driven.
//
// GROUP INHERITANCE (Phase 8 — default permission model).
// These are GROUP-WIDE pages: they carry NO per-page `roles`, so they inherit
// the Accounts group's assigned roles automatically (getWorkspaceGroupRoles
// ("accounts") ⇒ {accounts, accounts manager}, derived from ROLE_DEPARTMENT_MAP).
// This is the canonical shape for any page the whole group should see — add the
// page to its group's section WITHOUT a `roles` key. Because these context items
// never appear in the classic sidebar (they are outside WORKSPACE_NAV_SECTIONS),
// dropping their duplicated role arrays does not touch the byte-identical classic
// fallback and preserves the exact accounts-role access (locked by the parity
// tests). Add per-page `roles` here ONLY for a genuine restriction or a
// cross-group grant — see docs/Workspace Navigation/workspace-group-permissions.md.
export const WORKSPACE_CONTEXT_NAV_SECTIONS = Object.freeze([
  {
    department: "accounts",
    order: 132,
    label: "Accounts Workspace",
    category: "departments",
    flag: null,
    items: [
      { label: "Accounts", href: "/accounts" },
      { label: "Company Accounts", href: "/company-accounts" },
      { label: "Invoices", href: "/accounts/invoices" },
      { label: "Reports", href: "/accounts/reports" },
    ],
  },
]);

// Phase 9: presentation-only grouping for the Workspace Group Sidebar. Pages
// continue to be declared once in the nav/context sections above; hrefs here
// assign their primary Module and never grant access by themselves.
export const WORKSPACE_MODULES = Object.freeze({
  general: [{ key: "communication", label: "Communication", hrefs: ["/newsfeed", "/messages"] }, { key: "operations", label: "Operations", hrefs: ["/tracking", "/archive"] }],
  management: [{ key: "people", label: "People & HR", hrefs: ["/hr/manager", "/admin/users"] }, { key: "governance", label: "Governance", hrefs: ["/admin/compliance"] }, { key: "website", label: "Website Operations", hrefs: ["/website-manager"] }, { key: "operations", label: "Operations", hrefs: ["/nextjobs", "/jobs"] }],
  service: [{ key: "job-intake", label: "Job Intake", hrefs: ["/jobs", "/new-job", "/appointments", "/nextjobs"] }, { key: "shared-operations", label: "Shared Operations", hrefs: ["/goods-in"] }],
  workshop: [{ key: "control", label: "Workshop Control", hrefs: ["/nextjobs", "/jobs", "/clocking", "/consumables-tracker"] }, { key: "my-work", label: "My Work", hrefs: ["/tech", "/tech/efficiency", "/consumables-request", "/appointments", "/new-job"] }],
  mot: [{ key: "my-work", label: "My Work", hrefs: ["/tech", "/tech/efficiency"] }],
  parts: [{ key: "stock", label: "Stock & Receiving", hrefs: ["/stock-catalogue", "/goods-in"] }, { key: "fulfilment", label: "Fulfilment", hrefs: ["/jobs", "/deliveries", "/delivery-planner"] }, { key: "ordering", label: "Ordering", hrefs: ["/new-order"] }],
  valeting: [{ key: "work-queue", label: "Work Queue", hrefs: ["/valet"] }],
  accounts: [{ key: "accounts", label: "Accounts", hrefs: ["/accounts", "/company-accounts"] }, { key: "billing", label: "Billing", hrefs: ["/accounts/invoices", "/accounts/reports", "/accounts/payslips"] }],
  reports: [{ key: "operational", label: "Operational Reports", hrefs: ["/reports/workshop", "/reports/service", "/reports/parts", "/reports/mot", "/reports/paint", "/reports/valeting"] }, { key: "business", label: "Business Reports", hrefs: ["/reports/accounts", "/reports/admin", "/reports/overview"] }],
  developer: [{ key: "home", label: "Home", hrefs: ["/dev"] }],
});

export default WORKSPACE_NAV_SECTIONS;
