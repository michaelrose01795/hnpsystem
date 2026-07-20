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
  getAllSidebarItems,
  getKnownSidebarHrefs,
  resolveAccessiblePaths,
  getActiveWorkspaceDepartment,
  getContextNav,
  getDepartmentWorkspaceNav,
  getActiveDepartment,
  getDepartmentsForRoles,
  getDashboardShortcutsForRoles,
  getWorkspaceRail,
  getWorkspaceGroups,
  getWorkspaceGroupRoles,
  getBreadcrumbTrail,
  getQuickActions,
  getSearchItems,
  getPageTabs,
  getWorkspaceHeader,
  getWorkspaceShortcutItems,
  getWorkspaceModules,
  getActiveWorkspaceModule,
  getRoleWorkspaceModules,
  getManualGrantPlacementDetails,
  getSidebarModuleCatalog,
  isContextNavItemActive,
  isPageTabActive,
  resolveHome,
  isWorkspaceNavEnabled,
  WORKSPACE_CONTEXT_NAV_SECTIONS,
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
  DEVELOPER_GROUP_LOCK,
} from "@/config/workspace/manifest";
import { getAccessibleNavPaths as getPageAccessNavPaths } from "@/lib/auth/pageAccess";
import { sidebarSections } from "@/config/navigation";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import { roleCategories } from "@/config/users";
import { SERVICE_ACTION_ROLES } from "@/lib/auth/serviceActionRoles";
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
        // Goods In intentionally removed from the Workshop group (moved to Parts).
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

function legacyFullLandablePaths(golden, roles) {
  const roleSet = new Set((roles || []).map((r) => String(r).toLowerCase().trim()));
  const accessible = legacyAccessiblePaths(golden, roles);
  const matches = (allowedRoles = []) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.some((role) => roleSet.has(String(role).toLowerCase()));
  };

  const legacyPartsTopbarRoles = new Set(["parts", "parts manager"]);
  const legacyAccountsRoles = new Set(
    (roleCategories.Sales || [])
      .filter((role) => role.toLowerCase().includes("accounts"))
      .map((role) => role.toLowerCase())
  );
  const legacyTopbarLinks = [
    { href: "/new-job", roles: SERVICE_ACTION_ROLES },
    { href: "/job-cards/appointments", roles: SERVICE_ACTION_ROLES },
    { href: "/delivery-planner", roles: legacyPartsTopbarRoles },
    { href: "/new-order", roles: legacyPartsTopbarRoles },
    { href: "/goods-in", roles: legacyPartsTopbarRoles },
  ];
  const legacyAccountsLinks = [
    { href: "/accounts", roles: legacyAccountsRoles },
    { href: "/company-accounts", roles: legacyAccountsRoles },
    { href: "/accounts/invoices", roles: legacyAccountsRoles },
    { href: "/accounts/reports", roles: legacyAccountsRoles },
  ];

  for (const link of [...legacyTopbarLinks, ...legacyAccountsLinks]) {
    if (matches(Array.from(link.roles))) accessible.add(link.href);
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

const ALL_CONFIGURED_ROLES = Array.from(
  new Set([
    ...Object.values(roleCategories).flat(),
    ...SERVICE_ACTION_ROLES,
    "dev",
  ].map((role) => String(role).toLowerCase().trim()).filter(Boolean))
).sort();

const ALL_EXISTING_ROLE_COMBINATIONS = Array.from(
  new Map(
    [
      [],
      ...ALL_CONFIGURED_ROLES.map((role) => [role]),
      ...Object.values(roleCategories).map((roles) =>
        roles.map((role) => String(role).toLowerCase().trim()).filter(Boolean)
      ),
      ...REPRESENTATIVE_ROLES,
      ["service", "parts"],
      ["accounts", "accounts manager"],
      ["admin manager", "owner", "general manager"],
      ["SERVICE MANAGER"],
    ].map((roles) => [roles.join("|"), roles])
  ).values()
);

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

describe("workspace manifest — Phase 9 modules", () => {
  it("keeps every role's visible group Pages represented by exactly one visible module", () => {
    for (const roles of ALL_EXISTING_ROLE_COMBINATIONS) {
      for (const group of getWorkspaceGroups(roles)) {
        const nav = getDepartmentWorkspaceNav(group.key, roles);
        const moduleHrefs = getWorkspaceModules(group.key, roles)
          .flatMap((navigationModule) => navigationModule.items.map((item) => item.href));
        expect(new Set(moduleHrefs)).toEqual(new Set(nav.items.map((item) => item.href)));
        expect(new Set(moduleHrefs).size).toBe(moduleHrefs.length);
      }
    }
  });

  it("projects authorised group pages into visible modules without changing access", () => {
    const modules = getWorkspaceModules("parts", ["parts"]);
    expect(modules.map((module) => module.key)).toEqual(["stock", "fulfilment"]);
    expect(modules.flatMap((module) => module.items.map((item) => item.href))).toContain("/deliveries");
    expect(getAccessibleNavPaths(["parts"]).has("/deliveries")).toBe(true);
  });

  it("resolves the active module from current and pending routes", () => {
    expect(getActiveWorkspaceModule("parts", "/deliveries/123", ["parts"])).toBe("fulfilment");
    expect(getActiveWorkspaceModule("parts", "/stock-catalogue", ["parts"], null, "/deliveries")).toBe("fulfilment");
  });

  it("keeps unmatched legacy pages visible in a migration-safe Pages module", () => {
    const modules = getWorkspaceModules("developer", ["dev"]);
    expect(modules.flatMap((module) => module.items.map((item) => item.href))).toContain("/dev");
  });
});

describe("workspace manifest - module bundle placement", () => {
  it("exposes only the fixed sidebar-access module library", () => {
    expect(getSidebarModuleCatalog().map((module) => module.label)).toEqual([
      "General",
      "Admin",
      "Reception",
      "Workshop",
      "MOT",
      "Parts",
      "Valeting",
      "Accounts",
      "Reports",
      "Account",
      "Pages",
    ]);
  });

  it("exposes Parts as a standard assignable module bundle", () => {
    const parts = getSidebarModuleCatalog().find((module) => module.key === "department-parts");
    expect(parts.label).toBe("Parts");
    expect(parts.items.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/dashboard/parts",
      "/stock-catalogue",
      "/goods-in",
      "/jobs",
      "/deliveries",
    ]));
  });

  it("places a legacy manual grant into its department module", () => {
    const modules = getRoleWorkspaceModules(["service"], {
      items: ["/newsfeed", "/messages", "/appointments"],
    });
    const service = modules.find((navigationModule) => navigationModule.key === "department-service");
    expect(service.label).toBe("Reception");
    expect(service.items.map((item) => item.href)).toContain("/appointments");
  });

  it("uses the owning department heading for cross-department grants", () => {
    const modules = getRoleWorkspaceModules(["service"], {
      items: ["/newsfeed", "/messages", "/website-manager"],
    });
    const admin = modules.find((navigationModule) => navigationModule.key === "department-management");
    expect(admin.label).toBe("Admin");
    expect(admin.items.map((item) => item.href)).toEqual(["/website-manager"]);
  });

  it("honours a saved compatible placement and removes cross-module duplicates", () => {
    const modules = getRoleWorkspaceModules(["service"], {
      items: ["/appointments"],
      pagePlacements: { "/appointments": "service-control" },
      modules: [
        { key: "customer-jobs", label: "Customer & Job Intake", items: ["/appointments"] },
        { key: "service-control", label: "Service Control", items: ["/appointments"] },
      ],
    });
    expect(modules.find((navigationModule) => navigationModule.key === "service-control").items)
      .toEqual([expect.objectContaining({ href: "/appointments" })]);
    expect(modules.flatMap((navigationModule) => navigationModule.items).filter((item) => item.href === "/appointments"))
      .toHaveLength(1);
  });

  it("reports the same predicted placement shown by the runtime selector", () => {
    const snapshot = { items: ["/appointments", "/website-manager"] };
    const details = getManualGrantPlacementDetails(["service"], snapshot);
    expect(details.find((item) => item.href === "/appointments")).toMatchObject({
      currentModuleKey: "department-service",
      fallback: false,
    });
    expect(details.find((item) => item.href === "/website-manager")).toMatchObject({
      currentModuleKey: "department-management",
      fallback: false,
    });
  });
});

describe("workspace manifest — permission parity (nav == access)", () => {
  const golden = buildGoldenSidebarSections();
  for (const roles of ALL_EXISTING_ROLE_COMBINATIONS) {
    it(`landable-path set is identical for roles: [${roles.join(", ") || "none"}]`, () => {
      const legacy = legacyFullLandablePaths(golden, roles);
      const manifest = getAccessibleNavPaths(roles);
      expect([...manifest].sort()).toEqual([...legacy].sort());
      expect([...getPageAccessNavPaths(roles)].sort()).toEqual([...legacy].sort());
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

describe("workspace manifest — per-user sidebar access override", () => {
  it("resolveAccessiblePaths with no snapshot === getAccessibleNavPaths (byte-for-byte)", () => {
    for (const roles of ALL_EXISTING_ROLE_COMBINATIONS) {
      const base = getAccessibleNavPaths(roles);
      for (const empty of [null, undefined, {}, { items: null }]) {
        const resolved = resolveAccessiblePaths(roles, empty);
        expect([...resolved].sort()).toEqual([...base].sort());
      }
    }
  });

  it("an explicit snapshot is presentation-only and does not change landable access", () => {
    const snapshot = { items: ["/messages"], groups: ["general"] };
    const resolved = resolveAccessiblePaths(["service"], snapshot);
    const roleDefaults = getAccessibleNavPaths(["service"]);
    expect([...resolved].sort()).toEqual([...roleDefaults].sort());
  });

  it("unknown hrefs in a snapshot are ignored", () => {
    const resolved = resolveAccessiblePaths(["service"], {
      items: ["/messages", "/not-a-real-page"],
    });
    expect(resolved.has("/messages")).toBe(true);
    expect(resolved.has("/not-a-real-page")).toBe(false);
  });

  it("legacy item-only snapshots keep newer workspace routes role-derived", () => {
    const nav = getDepartmentWorkspaceNav("service", ["service"], { items: ["/messages"] });
    expect(nav.dashboards.map((item) => item.href)).toContain("/dashboard/service");
  });

  it("getAllSidebarItems covers the toggleable universe and excludes the dev group", () => {
    const groups = getAllSidebarItems();
    const listed = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));
    expect([...listed].sort()).toEqual([...getKnownSidebarHrefs()].sort());
    expect(groups.some((g) => g.department === DEVELOPER_GROUP_LOCK.key)).toBe(false);
  });

  it("the dev developer-platform route stays landable for dev even under a snapshot", () => {
    const resolved = resolveAccessiblePaths(["dev"], { items: [] });
    expect(resolved.has(DEVELOPER_GROUP_LOCK.navItem.href)).toBe(true);
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

// 🔒 DEVELOPER SIDEBAR LOCK — this suite is the enforcement half of the lock.
// It fails CI if the Developer group / its sidebar button is ever removed or
// re-gated. If you changed the developer entry and landed here: revert it.
describe("🔒 developer sidebar entry is LOCKED (must never change)", () => {
  it("the lock constant declares the permanent invariant", () => {
    expect(DEVELOPER_GROUP_LOCK.key).toBe("developer");
    expect(DEVELOPER_GROUP_LOCK.category).toBe("departments");
    expect(DEVELOPER_GROUP_LOCK.home).toBe("/dev");
    expect(DEVELOPER_GROUP_LOCK.roles).toEqual(["dev"]);
    expect(DEVELOPER_GROUP_LOCK.navItem).toEqual({ label: "Developer Platform", href: "/dev", roles: ["dev"] });
  });

  it("the developer department in the manifest matches the lock (key, category, home, roles)", () => {
    const dept = WORKSPACE_DEPARTMENTS.find((d) => d.key === "developer");
    expect(dept).toBeTruthy();
    expect(dept.category).toBe(DEVELOPER_GROUP_LOCK.category);
    expect(dept.home).toBe(DEVELOPER_GROUP_LOCK.home);
    expect(dept.roles).toEqual(DEVELOPER_GROUP_LOCK.roles);
  });

  it("the Developer nav section still carries the locked /dev button gated to dev", () => {
    const section = WORKSPACE_NAV_SECTIONS.find((s) => s.department === "developer");
    expect(section).toBeTruthy();
    const item = (section.items || []).find((i) => i.href === "/dev");
    expect(item).toEqual({ label: "Developer Platform", href: "/dev", roles: ["dev"] });
  });

  it("the dev role ALWAYS sees the Developer group + button, and it stays landable", () => {
    expect(getWorkspaceGroups(["dev"]).map((g) => g.key)).toContain("developer");
    const nav = getDepartmentWorkspaceNav("developer", ["dev"]);
    expect(nav.items.map((i) => i.href)).toContain("/dev");
    expect(getAccessibleNavPaths(["dev"]).has("/dev")).toBe(true);
    expect(
      getRoleWorkspaceModules(["dev"]).flatMap((module) =>
        module.items.map((item) => item.href)
      )
    ).toContain("/dev");
    // Upper-case role convention (ProtectedRoute / client) must resolve too.
    expect(getWorkspaceGroups(["DEV"]).map((g) => g.key)).toContain("developer");
  });

  it("keeps /dev in the role-first sidebar even under an empty customised layout", () => {
    const modules = getRoleWorkspaceModules(["DEV"], {
      items: [],
      groups: [],
      modules: [],
    });
    expect(modules.flatMap((module) => module.items.map((item) => item.href))).toContain("/dev");
  });

  it("the lock never leaks the Developer group/button to non-dev roles", () => {
    for (const staff of ["service", "workshop manager", "admin manager", "owner", "parts", "techs", "accounts manager"]) {
      expect(getWorkspaceGroups([staff]).map((g) => g.key)).not.toContain("developer");
      expect(getAccessibleNavPaths([staff]).has("/dev")).toBe(false);
    }
    expect(getWorkspaceGroups([]).map((g) => g.key)).not.toContain("developer");
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

  it("resolveHome lands every staff role on /newsfeed", () => {
    expect(resolveHome(["workshop manager"])).toBe("/newsfeed");
    expect(resolveHome(["parts"])).toBe("/newsfeed");
    expect(resolveHome([])).toBe("/newsfeed");
  });

  it("getBreadcrumbTrail builds a Module › Page trail", () => {
    const trail = getBreadcrumbTrail("/deliveries", ["parts"]);
    expect(trail.map((t) => t.label)).toEqual(["Fulfilment", "Deliveries"]);
  });

  it("getSearchItems returns a deduplicated, role-filtered page list", () => {
    const items = getSearchItems(["parts manager"]);
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/deliveries");
    expect(hrefs).not.toContain("/valet"); // belongs to valeting, not visible
  });

  it("getSearchItems includes workspace-only accounts links only for accounts roles", () => {
    const accountsItems = getSearchItems(["accounts manager"]);
    const accountsHrefs = accountsItems.map((item) => item.href);
    expect(accountsHrefs).toContain("/company-accounts");
    expect(accountsHrefs).toContain("/accounts/invoices");
    expect(accountsHrefs).toContain("/accounts/reports");

    const serviceItems = getSearchItems(["service"]);
    const serviceHrefs = serviceItems.map((item) => item.href);
    expect(serviceHrefs).not.toContain("/company-accounts");
    expect(serviceHrefs).not.toContain("/accounts/invoices");
    expect(serviceHrefs).not.toContain("/accounts/reports");
  });

  it("dashboard shortcut facade is derived from the workspace manifest", () => {
    const allDashboardShortcuts = getDashboardShortcutsForRoles([
      "service",
      "service manager",
      "workshop manager",
      "techs",
      "technician",
      "mobile technician",
      "parts",
      "parts manager",
      "mot tester",
      "valet service",
      "painters",
      "accounts",
      "accounts manager",
      "admin",
      "admin manager",
      "general manager",
      "owner",
    ]);
    expect(departmentDashboardShortcuts).toEqual(allDashboardShortcuts);
    expect(getDashboardShortcutsForRoles(["parts"]).map((item) => item.href)).toContain("/dashboard/parts");
    expect(getDashboardShortcutsForRoles(["parts"]).map((item) => item.href)).not.toContain("/dashboard/service");
  });

  it("getQuickActions filters topbar actions by role and active workspace", () => {
    expect(getQuickActions(["service"], "service").map((item) => item.href)).toEqual([
      "/new-job",
      "/job-cards/appointments",
    ]);
    expect(getQuickActions(["parts manager"], "parts").map((item) => item.href)).toEqual([
      "/delivery-planner",
      "/new-order",
      "/goods-in",
    ]);
    expect(getQuickActions(["service"], "parts")).toEqual([]);
  });

  it("getWorkspaceRail exposes department-first labels for visible workspaces", () => {
    const serviceRail = getWorkspaceRail(["service"]).map((d) => d.label);
    expect(serviceRail).toContain("Reception");
    expect(serviceRail).not.toContain("Parts");

    const adminRail = getWorkspaceRail(["admin manager"]).map((d) => d.label);
    expect(adminRail).toContain("Admin");
  });

  it("getWorkspaceGroups (Group Sidebar Flow) lists General + departments, excludes Account", () => {
    // The Tier-1 group picker the user first sees: General is a selectable group,
    // every accessible department follows in manifest order, and the Account
    // bucket (profile/logout) is NOT a group — it stays as the sidebar's bottom
    // controls. Roleless users still see the General group.
    const rolelessGroups = getWorkspaceGroups([]);
    expect(rolelessGroups.map((g) => g.key)).toContain("general");
    expect(rolelessGroups.map((g) => g.category)).not.toContain("account");

    const serviceGroups = getWorkspaceGroups(["service"]);
    const serviceKeys = serviceGroups.map((g) => g.key);
    // General first, then the department(s) the role can reach; no Account group.
    expect(serviceKeys[0]).toBe("general");
    expect(serviceKeys).toContain("service");
    expect(serviceKeys).not.toContain("parts");
    expect(serviceKeys).not.toContain("account");
    // Every group carries a selectable key + label (drives the group buttons).
    for (const group of serviceGroups) {
      expect(typeof group.key).toBe("string");
      expect(typeof group.label).toBe("string");
    }

    // dev-only Developer group appears only for the dev role.
    expect(getWorkspaceGroups(["dev"]).map((g) => g.key)).toContain("developer");
    expect(getWorkspaceGroups(["service"]).map((g) => g.key)).not.toContain("developer");
  });

  it("each workspace group resolves to a non-empty context nav (full sidebar replacement)", () => {
    // Selecting a group replaces the whole sidebar with getDepartmentWorkspaceNav
    // for that group — so every listed group must have at least one landable item,
    // otherwise the group view would render empty.
    for (const roles of [["service"], ["parts manager"], ["workshop manager"], ["admin manager"], []]) {
      for (const group of getWorkspaceGroups(roles)) {
        const nav = getDepartmentWorkspaceNav(group.key, roles);
        expect(nav.items.length + nav.dashboards.length).toBeGreaterThan(0);
      }
    }
  });

  it("getDepartmentWorkspaceNav includes workspace-only accounts links without changing classic sidebar", () => {
    const accountsNav = getDepartmentWorkspaceNav("accounts", ["accounts manager"]);
    const hrefs = accountsNav.items.map((item) => item.href);
    expect(hrefs).toContain("/accounts");
    expect(hrefs).toContain("/company-accounts");
    expect(hrefs).toContain("/accounts/invoices");
    expect(hrefs).toContain("/accounts/reports");
    expect(toSidebarSections().some((section) =>
      (section.items || []).some((item) => item.href === "/company-accounts")
    )).toBe(false);
  });

  it("getDepartmentWorkspaceNav returns a Dashboards section + flat deduped pages (no Overview)", () => {
    const workshopNav = getDepartmentWorkspaceNav("workshop", ["workshop manager"]);
    // Group Sidebar: no grouped/collapsible sub-sections; the only sub-heading is
    // the Dashboards block, which replaces the old single "Overview" entry.
    expect(workshopNav.groups).toBeUndefined();
    expect(workshopNav.items.some((item) => item.label === "Overview")).toBe(false);
    // The department dashboard(s) live in `dashboards`, not `items`.
    expect(workshopNav.dashboards.map((d) => d.href)).toContain("/dashboard/workshop");
    const hrefs = workshopNav.items.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length); // deduplicated
    expect(hrefs).not.toContain("/dashboard/workshop"); // dashboard is not a page item
    expect(hrefs).toContain("/clocking");
    expect(hrefs).toContain("/jobs");
  });

  it("dashboards are role-filtered per group (Tech Dashboard only for techs)", () => {
    const techNav = getDepartmentWorkspaceNav("workshop", ["techs"]);
    expect(techNav.dashboards.map((d) => d.href)).toContain("/tech/dashboard");
    const managerNav = getDepartmentWorkspaceNav("workshop", ["workshop manager"]);
    expect(managerNav.dashboards.map((d) => d.href)).not.toContain("/tech/dashboard");
    // A group with no dashboards (e.g. Developer) simply has an empty list.
    expect(getDepartmentWorkspaceNav("developer", ["dev"]).dashboards).toEqual([]);
  });

  it("landing on a department dashboard still resolves to its group", () => {
    // The home is resolvable even though the Workshop Dashboard shortcut is gated
    // to narrower roles — so /dashboard/workshop opens the Workshop group.
    expect(getActiveWorkspaceDepartment("/dashboard/workshop", ["workshop manager"])).toBe("workshop");
    expect(getActiveWorkspaceDepartment("/dashboard/parts", ["parts manager"])).toBe("parts");
    expect(getActiveWorkspaceDepartment("/dashboard/managers", ["admin manager"])).toBe("management");
  });

  it("getActiveWorkspaceDepartment resolves shared routes through role-visible workspaces", () => {
    expect(getActiveWorkspaceDepartment("/jobs", ["service"])).toBe("service");
    expect(getActiveWorkspaceDepartment("/jobs", ["parts manager"])).toBe("parts");
    expect(getActiveWorkspaceDepartment("/jobs", ["admin manager"])).toBe("management");
  });

  it("context nav active state matches exact, child routes, and pending hrefs", () => {
    const item = { href: "/clocking", label: "Clocking" };
    expect(isContextNavItemActive(item, "/clocking")).toBe(true);
    expect(isContextNavItemActive(item, "/clocking/a-tech")).toBe(true);
    expect(isContextNavItemActive(item, "/jobs")).toBe(false);
    expect(isContextNavItemActive(item, "/jobs", "/clocking")).toBe(true);
    expect(isContextNavItemActive(item, "/clocking", "/jobs")).toBe(false);
  });

  it("getPageTabs returns HR module tabs and preserves User Admin exact active matching", () => {
    const tabs = getPageTabs("/hr/employees", [], { groupKey: "hr-modules" });
    expect(tabs.ariaLabel).toBe("HR modules");
    expect(tabs.items.map((tab) => tab.href)).toContain("/admin/users");
    expect(isPageTabActive(tabs.items.find((tab) => tab.href === "/hr/employees"), "/hr/employees/123")).toBe(true);
    expect(isPageTabActive(tabs.items.find((tab) => tab.href === "/admin/users"), "/admin/users/create")).toBe(false);
  });

  it("getPageTabs returns workshop navigation and quick-action tab groups", () => {
    const tabs = getPageTabs("/clocking", [], { groupKey: "workshop-navigation" });
    const quickActions = getPageTabs("/new-job", [], { groupKey: "workshop-quick-actions" });
    expect(tabs.items.map((tab) => tab.href)).toEqual([
      "/workshop",
      "/nextjobs",
      "/jobs",
      "/consumables-tracker",
      "/clocking",
    ]);
    expect(quickActions.items.map((tab) => tab.href)).toEqual([
      "/new-job",
      "/job-cards/appointments",
      "/appointments",
    ]);
    expect(isPageTabActive(tabs.items.find((tab) => tab.href === "/clocking"), "/clocking/a-tech")).toBe(true);
  });

  it("getPageTabs role-filters Parts manager tab without changing base parts tabs", () => {
    const partsTabs = getPageTabs("/goods-in", ["parts"], { groupKey: "parts-workspace" });
    const managerTabs = getPageTabs("/goods-in", ["parts manager"], { groupKey: "parts-workspace" });
    expect(partsTabs.items.map((tab) => tab.href)).toEqual([
      "/goods-in",
      "/deliveries",
      "/delivery-planner",
    ]);
    expect(managerTabs.items.map((tab) => tab.href)).toEqual([
      "/goods-in",
      "/deliveries",
      "/delivery-planner",
      "/parts-manager",
    ]);
    expect(isPageTabActive(managerTabs.items.find((tab) => tab.href === "/parts-manager"), "/parts-manager")).toBe(true);
  });

  it("getWorkspaceHeader and shortcut selectors are manifest-derived", () => {
    const header = getWorkspaceHeader("/deliveries", ["parts"]);
    expect(header.label).toBe("Parts");
    expect(header.breadcrumbs.map((crumb) => crumb.label)).toEqual(["Fulfilment", "Deliveries"]);
    expect(header.quickActions.map((action) => action.href)).toContain("/new-order");

    const shortcuts = getWorkspaceShortcutItems(["parts"]);
    expect(shortcuts.map((item) => item.href)).toContain("/deliveries");
    expect(shortcuts.map((item) => item.href)).toContain("/new-order");
  });
});

describe("workspace group permission model", () => {
  it("getWorkspaceGroupRoles exposes group assignments ('*' for all-access groups)", () => {
    // General and Account are open to every authenticated user.
    expect(getWorkspaceGroupRoles("general")).toBe("*");
    expect(getWorkspaceGroupRoles("account")).toBe("*");
    // Developer is explicitly assigned to the synthetic dev role only.
    expect(getWorkspaceGroupRoles("developer")).toEqual(["dev"]);
    // A real department derives its assigned roles from ROLE_DEPARTMENT_MAP.
    const workshopRoles = getWorkspaceGroupRoles("workshop");
    expect(Array.isArray(workshopRoles)).toBe(true);
    expect(workshopRoles).toContain("workshop manager");
    expect(workshopRoles).toContain("techs");
    expect(workshopRoles).not.toContain("parts");
  });

  it("group assignment grants group-wide pages; explicit page roles still restrict", () => {
    // General is assigned to every authenticated user, so its group-wide pages
    // (no per-page roles) are visible even to a roleless user...
    const generalRoleless = getContextNav("general", []).items.map((i) => i.href);
    expect(generalRoleless).toContain("/newsfeed");
    expect(generalRoleless).toContain("/messages");
    expect(generalRoleless).toContain("/archive");
    // ...but a page carrying its own roles (Tracker) stays restricted.
    expect(generalRoleless).not.toContain("/tracking");
    expect(getContextNav("general", ["techs"]).items.map((i) => i.href)).toContain("/tracking");
  });

  it("individual page grants work across groups (Sales sees the Admin group's Website Manager)", () => {
    // Sales is NOT assigned the Admin (management) group...
    expect(getWorkspaceGroupRoles("management")).not.toContain("sales");
    // ...but the Website Manager page grants Sales explicitly, so it is visible.
    const salesAdmin = getContextNav("management", ["sales"]).items.map((i) => i.href);
    expect(salesAdmin).toContain("/website-manager");
  });
});

describe("workspace group inheritance (Phase 8 — default permission model)", () => {
  it("accounts workspace pages carry NO per-page roles (they inherit the group)", () => {
    // De-duplication: the Accounts Workspace context pages must rely on group
    // inheritance, not a duplicated per-page role array. If a future edit
    // reintroduces `roles` on a group-wide page, this fails and forces a review.
    const accountsSection = WORKSPACE_CONTEXT_NAV_SECTIONS.find(
      (section) => section.department === "accounts"
    );
    expect(accountsSection).toBeTruthy();
    for (const item of accountsSection.items) {
      expect(item.roles).toBeUndefined();
    }
  });

  it("un-roled group pages resolve to EXACTLY the group's assigned roles", () => {
    // The Accounts group is assigned {accounts, accounts manager} (derived from
    // ROLE_DEPARTMENT_MAP). Inheritance must reproduce precisely that reach —
    // no wider, no narrower — for every un-roled accounts page.
    const groupRoles = getWorkspaceGroupRoles("accounts");
    expect(groupRoles).toEqual(["accounts", "accounts manager"]);

    const workspaceOnlyHrefs = ["/accounts", "/company-accounts", "/accounts/invoices", "/accounts/reports"];
    for (const role of groupRoles) {
      const hrefs = getDepartmentWorkspaceNav("accounts", [role]).items.map((i) => i.href);
      for (const href of workspaceOnlyHrefs) expect(hrefs).toContain(href);
    }
    // Roles outside the group inherit nothing (the pages are group-wide only).
    for (const role of ["service", "workshop manager", "parts manager", "admin manager", "owner"]) {
      const hrefs = getDepartmentWorkspaceNav("accounts", [role]).items.map((i) => i.href);
      for (const href of workspaceOnlyHrefs) expect(hrefs).not.toContain(href);
    }
    // ...and a roleless user sees none of them.
    const rolelessHrefs = getDepartmentWorkspaceNav("accounts", []).items.map((i) => i.href);
    for (const href of workspaceOnlyHrefs) expect(rolelessHrefs).not.toContain(href);
  });

  it("landable access to inherited accounts pages equals the pre-de-duplication explicit set", () => {
    // Parity proof for the de-duplicated pages specifically: the accessible set
    // computed via inheritance must match the legacy explicit ["accounts",
    // "accounts manager"] gate, for every configured role.
    const inheritedHrefs = ["/accounts", "/company-accounts", "/accounts/invoices", "/accounts/reports"];
    const legacyRoleSet = new Set(["accounts", "accounts manager"]);
    for (const roles of ALL_EXISTING_ROLE_COMBINATIONS) {
      const accessible = getAccessibleNavPaths(roles);
      const roleSet = new Set(roles.map((r) => String(r).toLowerCase().trim()));
      const legacyGranted = [...legacyRoleSet].some((r) => roleSet.has(r));
      for (const href of inheritedHrefs) {
        expect(accessible.has(href)).toBe(legacyGranted);
      }
    }
  });

  it("intentional overrides keep their own gate regardless of group assignment", () => {
    // Financial cross-grant: Payslips is granted to admin/admin manager/owner as
    // well as the accounts group — inheritance must NOT narrow it to the group.
    const payslipRoles = ["accounts", "accounts manager", "admin", "admin manager", "owner"];
    for (const role of payslipRoles) {
      expect(getAccessibleNavPaths([role]).has("/accounts/payslips")).toBe(true);
    }
    // Cross-group grant: Sales reaches the Admin group's Website Manager even
    // though Sales is not assigned the Admin (management) group.
    expect(getWorkspaceGroupRoles("management")).not.toContain("sales");
    expect(getAccessibleNavPaths(["sales"]).has("/website-manager")).toBe(true);
    // Developer boundary: /dev stays dev-only (explicit override on a dev page).
    expect(getAccessibleNavPaths(["dev"]).has("/dev")).toBe(true);
    for (const staff of ["service", "workshop manager", "admin manager", "owner", "accounts manager"]) {
      expect(getAccessibleNavPaths([staff]).has("/dev")).toBe(false);
    }
    // Reports group derives no roles (not in ROLE_DEPARTMENT_MAP), so its pages
    // are gated purely by their explicit report-role arrays — inheritance grants
    // nothing there.
    expect(getWorkspaceGroupRoles("reports")).toEqual([]);
  });
});

describe("workspace manifest — feature flag", () => {
  it("workspace_nav_enabled is ON by default and remains env-roll-backable", () => {
    expect(isWorkspaceNavEnabled()).toBe(true);
  });
});
