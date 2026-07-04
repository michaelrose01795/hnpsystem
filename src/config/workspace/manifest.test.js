// file location: src/config/workspace/manifest.test.js
//
// Workspace Navigation — Phase 0 validation.
//
// The whole promise of Phase 0 is: "introduce the manifest, change NOTHING that
// users see or that the permission layer decides." These tests lock that:
//
//   1. BYTE-IDENTICAL SIDEBAR — toSidebarSections() deep-equals the previous
//      inline `sidebarSections`. The golden reference below is an INDEPENDENT
//      re-implementation of the exact pre-refactor algorithm from
//      src/config/navigation.js (baseSidebarSections + reporting insert), so a
//      drift in the manifest fails here rather than shipping a changed sidebar.
//   2. PERMISSION PARITY — the nav-derived accessible-path set is identical, per
//      role, whether computed the legacy way (walk the golden sidebar) or via the
//      manifest selector getAccessibleNavPaths().
//   3. The forward-looking department-first selectors behave sanely.

import { describe, it, expect } from "vitest";
import {
  toSidebarSections,
  getAccessibleNavPaths,
  getContextNav,
  getActiveDepartment,
  getDepartmentsForRoles,
  getBreadcrumbTrail,
  getSearchItems,
  resolveHome,
  isWorkspaceNavEnabled,
} from "@/config/workspace/manifest";
import { sidebarSections } from "@/config/navigation";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { EXECUTIVE_ROLES } from "@/lib/reporting/permissionScope";
import { getReportingFlag } from "@/lib/reporting/config/flags";

// ---------------------------------------------------------------------------
// GOLDEN REFERENCE — an independent copy of the ORIGINAL src/config/navigation.js
// logic (verbatim), so this test does not derive its expectation from the code
// under test.
// ---------------------------------------------------------------------------
function buildGoldenSidebarSections() {
  const rolesForDepts = (depts) =>
    Object.entries(ROLE_DEPARTMENT_MAP)
      .filter(([, dept]) => depts.has(dept))
      .map(([role]) => role);

  const WORKSHOP_REPORT_ROLES = rolesForDepts(new Set(["workshop", "service", "management", "admin"]));
  const PARTS_REPORT_ROLES = rolesForDepts(new Set(["parts", "management", "admin"]));
  const SERVICE_REPORT_ROLES = rolesForDepts(new Set(["service", "management", "admin"]));
  const MOT_REPORT_ROLES = rolesForDepts(new Set(["mot", "service", "workshop", "management", "admin"]));
  const PAINT_REPORT_ROLES = rolesForDepts(new Set(["paint", "service", "workshop", "management", "admin"]));
  const VALETING_REPORT_ROLES = rolesForDepts(new Set(["valeting", "service", "workshop", "management", "admin"]));
  const ADMIN_REPORT_ROLES = Array.from(
    new Set([...rolesForDepts(new Set(["management"])), "admin", ...EXECUTIVE_ROLES])
  );
  const EXECUTIVE_REPORT_ROLES = Array.from(new Set(EXECUTIVE_ROLES));
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
          roles: ["techs", "service", "service manager", "workshop manager", "valet service", "admin"],
        },
        { label: "Archive Job", href: "/archive", roles: [] },
      ],
    },
    {
      label: "Admin Manager",
      category: "departments",
      items: [
        { label: "Next Jobs", href: "/nextjobs", roles: ["admin manager"] },
        { label: "Job Cards", href: "/jobs", roles: ["admin manager"] },
        { label: "User Admin", href: "/admin/users", roles: ["admin manager"] },
        { label: "Compliance", href: "/admin/compliance", roles: ["admin manager"] },
      ],
    },
    {
      label: "Owner",
      category: "departments",
      items: [
        { label: "HR Manager", href: "/hr/manager", roles: ["owner"] },
        { label: "User Admin", href: "/admin/users", roles: ["owner"] },
        { label: "Compliance", href: "/admin/compliance", roles: ["owner"] },
        {
          label: "Website Manager",
          href: "/website-manager",
          roles: ["owner", "admin", "admin manager", "general manager", "sales"],
        },
        {
          label: "Website Preview",
          href: "/website-manager?tab=preview",
          roles: ["owner", "admin", "admin manager", "general manager", "sales"],
        },
        {
          label: "Website Shop",
          href: "/website-manager?tab=shop",
          roles: ["owner", "admin", "admin manager", "general manager", "sales"],
        },
        {
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
        { label: "Job Cards", href: "/jobs", roles: ["service"] },
        { label: "Goods In", href: "/goods-in", roles: ["service"] },
        { label: "New Job", href: "/new-job", roles: ["service"] },
      ],
    },
    {
      label: "Service Manager",
      category: "departments",
      items: [
        { label: "Next Jobs", href: "/nextjobs", roles: ["service manager"] },
        { label: "Job Cards", href: "/jobs", roles: ["service manager"] },
        { label: "Goods In", href: "/goods-in", roles: ["service manager"] },
        { label: "Mobile Appointments", href: "/appointments", roles: ["service manager"] },
        { label: "New Job", href: "/new-job", roles: ["service manager"] },
      ],
    },
    {
      label: "Workshop Manager",
      category: "departments",
      items: [
        { label: "Next Jobs", href: "/nextjobs", roles: ["workshop manager"] },
        { label: "Job Cards", href: "/jobs", roles: ["workshop manager"] },
        { label: "Clocking", href: "/clocking", roles: ["workshop manager"] },
        { label: "Consumables Tracker", href: "/consumables-tracker", roles: ["workshop manager"] },
        { label: "Goods In", href: "/goods-in", roles: ["workshop manager"] },
      ],
    },
    {
      label: "Aftersales Manager",
      category: "departments",
      items: [
        { label: "Next Jobs", href: "/nextjobs", roles: ["aftersales manager"] },
        { label: "Job Cards", href: "/jobs", roles: ["aftersales manager"] },
        { label: "Goods In", href: "/goods-in", roles: ["aftersales manager"] },
      ],
    },
    {
      label: "Techs",
      category: "departments",
      items: [
        { label: "My Jobs", href: "/tech", roles: ["techs"] },
        { label: "Request Consumables", href: "/consumables-request", roles: ["techs"] },
        { label: "Efficiency", href: "/tech/efficiency", roles: ["techs"] },
      ],
    },
    {
      label: "Mobile Technician",
      category: "departments",
      items: [
        { label: "My Jobs", href: "/tech", roles: ["mobile technician"] },
        { label: "Mobile Appointments", href: "/appointments", roles: ["mobile technician"] },
        { label: "Request Parts", href: "/consumables-request", roles: ["mobile technician"] },
        { label: "New Mobile Job", href: "/new-job", roles: ["mobile technician"] },
      ],
    },
    {
      label: "MOT Tester",
      category: "departments",
      items: [
        { label: "My Jobs", href: "/tech", roles: ["mot tester"] },
        { label: "Efficiency", href: "/tech/efficiency", roles: ["mot tester"] },
      ],
    },
    {
      label: "Parts",
      category: "departments",
      items: [
        { label: "Job Cards", href: "/jobs", roles: ["parts"] },
        { label: "Stock Catalogue", href: "/stock-catalogue", roles: ["parts"] },
        { label: "Goods In", href: "/goods-in", roles: ["parts"] },
        { label: "Deliveries", href: "/deliveries", roles: ["parts"] },
      ],
    },
    {
      label: "Parts Manager",
      category: "departments",
      items: [
        { label: "Job Cards", href: "/jobs", roles: ["parts manager"] },
        { label: "Stock Catalogue", href: "/stock-catalogue", roles: ["parts manager"] },
        { label: "Goods In", href: "/goods-in", roles: ["parts manager"] },
        { label: "Deliveries", href: "/deliveries", roles: ["parts manager"] },
      ],
    },
    {
      label: "Valet Service",
      category: "departments",
      items: [{ label: "Valet Jobs", href: "/valet", roles: ["valet service"] }],
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
      label: "Developer",
      category: "departments",
      items: [{ label: "Developer Platform", href: "/dev", roles: ["dev"] }],
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

  const accountIndex = baseSidebarSections.findIndex((s) => s.category === "account");
  return reportingSections.length && accountIndex >= 0
    ? [
        ...baseSidebarSections.slice(0, accountIndex),
        ...reportingSections,
        ...baseSidebarSections.slice(accountIndex),
      ]
    : [...baseSidebarSections, ...reportingSections];
}

// Legacy sidebar walk (a copy of the pre-refactor pageAccess.js item loop) so the
// permission-parity test does not depend on the manifest selector it verifies.
function legacyAccessiblePaths(golden, roles) {
  const roleSet = new Set((roles || []).map((r) => String(r).toLowerCase().trim()));
  const accessible = new Set();
  for (const section of golden) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      const open = !item.roles || item.roles.length === 0;
      if (open || item.roles.some((r) => roleSet.has(String(r).toLowerCase()))) {
        accessible.add(item.href);
      }
    }
  }
  return accessible;
}

const REPRESENTATIVE_ROLES = [
  [],
  ["service"],
  ["service manager"],
  ["workshop manager"],
  ["aftersales manager"],
  ["techs"],
  ["mobile technician"],
  ["mot tester"],
  ["parts"],
  ["parts manager"],
  ["valet service"],
  ["accounts manager"],
  ["admin manager"],
  ["owner"],
  ["admin"],
  ["general manager"],
  ["dev"],
  ["service", "parts"], // multi-role user
  ["SERVICE MANAGER"], // upper-case (client/ProtectedRoute convention)
];

describe("workspace manifest — byte-identical sidebar reproduction", () => {
  it("toSidebarSections() deep-equals the original inline sidebarSections", () => {
    expect(toSidebarSections()).toEqual(buildGoldenSidebarSections());
  });

  it("the derived navigation.js export equals toSidebarSections()", () => {
    expect(sidebarSections).toEqual(toSidebarSections());
  });

  it("preserves the exact section order (incl. Reports just before Account)", () => {
    const labels = toSidebarSections().map((s) => s.label);
    expect(labels).toEqual(buildGoldenSidebarSections().map((s) => s.label));
    // The reporting insert position is load-bearing: Reports must sit immediately
    // before Account when the flag is on.
    if (getReportingFlag("reporting_nav_enabled")) {
      expect(labels.indexOf("Reports")).toBe(labels.indexOf("Account") - 1);
    }
  });
});

describe("workspace manifest — permission parity (nav == access)", () => {
  const golden = buildGoldenSidebarSections();
  for (const roles of REPRESENTATIVE_ROLES) {
    it(`accessible-path set is identical for roles: [${roles.join(", ") || "none"}]`, () => {
      const legacy = legacyAccessiblePaths(golden, roles);
      const manifest = getAccessibleNavPaths(roles);
      expect([...manifest].sort()).toEqual([...legacy].sort());
    });
  }

  it("every navigable href in the sidebar is landable for the roles that see it", () => {
    // No href in the rendered sidebar should be missing from the accessible set —
    // guards against a page becoming un-landable (PageAccessGuard → /newsfeed).
    for (const roles of REPRESENTATIVE_ROLES) {
      const roleSet = new Set(roles.map((r) => r.toLowerCase()));
      const accessible = getAccessibleNavPaths(roles);
      for (const section of golden) {
        for (const item of section.items || []) {
          if (!item.href) continue;
          const open = !item.roles || item.roles.length === 0;
          const canSee = open || item.roles.some((r) => roleSet.has(r.toLowerCase()));
          if (canSee) expect(accessible.has(item.href)).toBe(true);
        }
      }
    }
  });
});

describe("workspace manifest — dev platform gating stays strict", () => {
  it("/dev is landable ONLY for the dev role", () => {
    expect(getAccessibleNavPaths(["dev"]).has("/dev")).toBe(true);
    for (const staff of ["service", "workshop manager", "admin manager", "owner", "parts", "techs"]) {
      expect(getAccessibleNavPaths([staff]).has("/dev")).toBe(false);
    }
    expect(getAccessibleNavPaths([]).has("/dev")).toBe(false);
  });
});

describe("workspace manifest — department-first selectors", () => {
  it("getActiveDepartment maps flat routes to their owning department", () => {
    expect(getActiveDepartment("/deliveries")).toBe("parts");
    expect(getActiveDepartment("/clocking")).toBe("workshop");
    expect(getActiveDepartment("/valet")).toBe("valeting");
    expect(getActiveDepartment("/reports/workshop")).toBe("reports");
    expect(getActiveDepartment("/dev")).toBe("developer");
    // Detail route resolves via longest-prefix to its list page's department.
    expect(getActiveDepartment("/clocking/a-tech")).toBe("workshop");
    // Query/hash are ignored.
    expect(getActiveDepartment("/website-manager?tab=shop")).toBe("management");
  });

  it("getContextNav deduplicates a department's pages by href", () => {
    // Parts declares Job Cards / Goods In / Deliveries in BOTH the Parts and
    // Parts Manager sections; the context nav shows each once.
    const partsManager = getContextNav("parts", ["parts manager"]);
    const hrefs = partsManager.items.map((i) => i.href);
    expect(hrefs).toContain("/jobs");
    expect(hrefs).toContain("/deliveries");
    expect(new Set(hrefs).size).toBe(hrefs.length); // no duplicates
  });

  it("getDepartmentsForRoles returns only departments a role can see, in order", () => {
    const serviceDepts = getDepartmentsForRoles(["service"]).map((d) => d.key);
    // A service advisor sees General, Service and Account — not Parts or Workshop.
    expect(serviceDepts).toContain("service");
    expect(serviceDepts).toContain("general");
    expect(serviceDepts).toContain("account");
    expect(serviceDepts).not.toContain("parts");
    expect(serviceDepts).not.toContain("workshop");
    // Ordered by department order (general first, account last).
    expect(serviceDepts[0]).toBe("general");
    expect(serviceDepts[serviceDepts.length - 1]).toBe("account");
  });

  it("resolveHome lands a role on its department home, roleless on /newsfeed", () => {
    expect(resolveHome(["workshop manager"])).toBe("/dashboard/workshop");
    expect(resolveHome(["parts"])).toBe("/dashboard/parts");
    expect(resolveHome([])).toBe("/newsfeed");
  });

  it("getBreadcrumbTrail builds a Department › Page trail", () => {
    const trail = getBreadcrumbTrail("/deliveries", ["parts"]);
    expect(trail.map((t) => t.label)).toEqual(["Parts", "Deliveries"]);
  });

  it("getSearchItems returns a deduplicated, role-filtered page list", () => {
    const items = getSearchItems(["parts manager"]);
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/deliveries");
    expect(hrefs).not.toContain("/valet"); // belongs to valeting, not visible
  });
});

describe("workspace manifest — feature flag", () => {
  it("workspace_nav_enabled is OFF by default (Phase 0 is invisible)", () => {
    expect(isWorkspaceNavEnabled()).toBe(false);
  });
});
