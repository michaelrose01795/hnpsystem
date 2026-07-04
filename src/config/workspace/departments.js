// file location: src/config/workspace/departments.js
//
// THE WORKSPACE NAVIGATION MANIFEST — Phase 0 (foundation).
//
// This is the single, department-first source of truth for every navigation
// surface in the staff app. Today it feeds exactly one consumer — the classic
// role-organised sidebar, reproduced BYTE-FOR-BYTE by manifest.js →
// toSidebarSections() so nothing changes for users. Future phases add the
// Department Rail, Context Sidebar, Quick Preview, Workspace Header, Workspace
// Search, Breadcrumbs, Favourites and Recently Used as further *consumers* of
// this same manifest — no second navigation system, no further refactor.
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
    label: "Management",
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
    label: "Service",
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
      { label: "Goods In", href: "/goods-in", roles: ["workshop manager"] },
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

export default WORKSPACE_NAV_SECTIONS;
