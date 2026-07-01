// file location: src/config/navigation.js

import { getReportingFlag } from "@/lib/reporting/config/flags";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { EXECUTIVE_ROLES } from "@/lib/reporting/permissionScope";

// Phase 6/7: the Reports section is gated by the `reporting_nav_enabled` flag.
// Roles that may see each department report are derived from the canonical
// role→department map so the nav and the dimension never drift. The
// PageAccessGuard reads sidebarSections, so adding these links is what makes
// /reports/{workshop,parts} reachable for the permitted roles. (Phase 7 added the
// Parts link; Workshop unchanged.)
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

const reportingSections = getReportingFlag("reporting_nav_enabled")
  ? [
      {
        label: "Reports",
        category: "departments",
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
    ]
  : [];

const baseSidebarSections = [
  {
    label: "General",
    category: "general",
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
    label: "Admin Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/nextjobs",
        roles: ["admin manager"],
      },
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["admin manager"],
      },
      {
        label: "User Admin",
        href: "/admin/users",
        roles: ["admin manager"],
      },
      {
        label: "Compliance",
        href: "/admin/compliance",
        roles: ["admin manager"],
      },
    ],
  },
  {
    label: "Owner",
    category: "departments",
    items: [
      {
        label: "HR Manager",
        href: "/hr/manager",
        roles: ["owner"],
      },
      {
        label: "User Admin",
        href: "/admin/users",
        roles: ["owner"],
      },
      {
        label: "Compliance",
        href: "/admin/compliance",
        roles: ["owner"],
      },
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
    label: "Service",
    category: "departments",
    items: [
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["service"],
      },
      {
        label: "Goods In",
        href: "/goods-in",
        roles: ["service"],
      },
      {
        label: "New Job",
        href: "/new-job",
        roles: ["service"],
      },
    ],
  },
  {
    label: "Service Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/nextjobs",
        roles: ["service manager"],
      },
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["service manager"],
      },
      {
        label: "Goods In",
        href: "/goods-in",
        roles: ["service manager"],
      },
      {
        label: "Mobile Appointments",
        href: "/appointments",
        roles: ["service manager"],
      },
      {
        label: "New Job",
        href: "/new-job",
        roles: ["service manager"],
      },
    ],
  },
  {
    label: "Workshop Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/nextjobs",
        roles: ["workshop manager"],
      },
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["workshop manager"],
      },
      {
        label: "Clocking",
        href: "/clocking",
        roles: ["workshop manager"],
      },
      {
        label: "Consumables Tracker", // Workshop consumable planning workspace
        href: "/consumables-tracker",
        roles: ["workshop manager"],
      },
      {
        label: "Goods In",
        href: "/goods-in",
        roles: ["workshop manager"],
      },
    ],
  },
  {
    label: "Aftersales Manager",
    category: "departments",
    items: [
      {
        label: "Next Jobs",
        href: "/nextjobs",
        roles: ["aftersales manager"],
      },
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["aftersales manager"],
      },
      {
        label: "Goods In",
        href: "/goods-in",
        roles: ["aftersales manager"],
      },
    ],
  },
  {
    label: "Techs",
    category: "departments",
    items: [
      {
        label: "My Jobs",
        href: "/tech",
        roles: ["techs"],
      },
      {
        label: "Request Consumables", // Technician consumable request portal
        href: "/consumables-request",
        roles: ["techs"],
      },
      {
        label: "Efficiency",
        href: "/tech/efficiency",
        roles: ["techs"],
      },
    ],
  },
  {
    label: "Mobile Technician",
    category: "departments",
    items: [
      {
        label: "My Jobs",
        href: "/tech",
        roles: ["mobile technician"],
      },
      {
        label: "Mobile Appointments",
        href: "/appointments",
        roles: ["mobile technician"],
      },
      {
        label: "Request Parts",
        href: "/consumables-request",
        roles: ["mobile technician"],
      },
      {
        label: "New Mobile Job",
        href: "/new-job",
        roles: ["mobile technician"],
      },
    ],
  },
  {
    label: "MOT Tester",
    category: "departments",
    items: [
      {
        label: "My Jobs",
        href: "/tech",
        roles: ["mot tester"],
      },
      {
        label: "Efficiency",
        href: "/tech/efficiency",
        roles: ["mot tester"],
      },
    ],
  },
  {
    label: "Parts",
    category: "departments",
    items: [
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["parts"],
      },
      {
        label: "Stock Catalogue",
        href: "/stock-catalogue",
        roles: ["parts"],
      },
      {
        label: "Goods In",
        href: "/goods-in",
        roles: ["parts"],
      },
      {
        label: "Deliveries",
        href: "/deliveries",
        roles: ["parts"],
      },
    ],
  },
  {
    label: "Parts Manager",
    category: "departments",
    items: [
      {
        label: "Job Cards",
        href: "/jobs",
        roles: ["parts manager"],
      },
      {
        label: "Stock Catalogue",
        href: "/stock-catalogue",
        roles: ["parts manager"],
      },
      {
        label: "Goods In",
        href: "/goods-in",
        roles: ["parts manager"],
      },
      {
        label: "Deliveries",
        href: "/deliveries",
        roles: ["parts manager"],
      },
    ],
  },
  {
    label: "Valet Service",
    category: "departments",
    items: [
      {
        label: "Valet Jobs",
        href: "/valet",
        roles: ["valet service"],
      },
    ],
  },
  {
    label: "Accounts Manager",
    category: "departments",
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
    label: "Developer",
    category: "departments",
    items: [
      { label: "Developer Platform", href: "/dev", roles: ["dev"] },
    ],
  },
  {
    label: "Account",
    category: "account",
    items: [
      { label: "Profile", href: "/profile", roles: [] },
      { label: "Logout", href: null, roles: [], action: "logout" },
    ],
  },
];

// Insert the (flag-gated) Reports section just before the Account section so it
// reads as a department area, not after the account/logout controls.
const accountIndex = baseSidebarSections.findIndex((s) => s.category === "account");
export const sidebarSections =
  reportingSections.length && accountIndex >= 0
    ? [
        ...baseSidebarSections.slice(0, accountIndex),
        ...reportingSections,
        ...baseSidebarSections.slice(accountIndex),
      ]
    : [...baseSidebarSections, ...reportingSections];
