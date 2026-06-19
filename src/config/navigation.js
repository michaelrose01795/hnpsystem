// file location: src/config/navigation.js

import { getReportingFlag } from "@/lib/reporting/config/flags";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";

// Phase 6: the Reports section is gated by the `reporting_nav_enabled` flag.
// Roles that may see the Workshop report are derived from the canonical
// role→department map (workshop + service + management/admin oversight) so the
// nav and the dimension never drift. The PageAccessGuard reads sidebarSections,
// so adding this section is what makes /reports/workshop reachable for them.
const WORKSHOP_REPORT_DEPTS = new Set(["workshop", "service", "management", "admin"]);
const WORKSHOP_REPORT_ROLES = Object.entries(ROLE_DEPARTMENT_MAP)
  .filter(([, dept]) => WORKSHOP_REPORT_DEPTS.has(dept))
  .map(([role]) => role);

const reportingSections = getReportingFlag("reporting_nav_enabled")
  ? [
      {
        label: "Reports",
        category: "departments",
        items: [{ label: "Workshop Reports", href: "/reports/workshop", roles: WORKSHOP_REPORT_ROLES }],
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
