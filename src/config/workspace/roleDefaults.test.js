import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getActiveRoleWorkspaceModule,
  getRoleDefaultWorkspaceModules,
  getRoleWorkspaceModules,
  getWorkspacePageCatalog,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";
import { ALL_ACCESS_ROLE } from "@/lib/auth/roles";

const REQUIRED_ROLES = [
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
  "General Manager",
  "Valet Sales",
  "Buying Director",
  "Second Hand Buying",
  "Vehicle Processor & Photographer",
  "Receptionist",
  "Painters",
  "Contractors",
];

describe("role workspace defaults", () => {
  it("defines every requested staff role exactly once", () => {
    expect(WORKSPACE_ROLE_DEFAULT_NAMES).toEqual(REQUIRED_ROLES);
    expect(new Set(WORKSPACE_ROLE_DEFAULT_NAMES).size).toBe(WORKSPACE_ROLE_DEFAULT_NAMES.length);
  });

  it("puts Create Order in the Parts module for Parts staff and managers", () => {
    for (const role of ["Parts", "Parts Manager"]) {
      const partsModule = getRoleDefaultWorkspaceModules(role).find(
        (module) => module.key === "department-parts"
      );
      expect(partsModule?.items.map((item) => item.href), role).toContain("/new-order");
    }
  });

  it("each role resolves to complete modules backed by catalog pages", () => {
    const catalogHrefs = new Set(getWorkspacePageCatalog().map((item) => item.href));
    for (const role of WORKSPACE_ROLE_DEFAULT_NAMES) {
      const modules = getRoleDefaultWorkspaceModules(role);
      expect(modules.length, role).toBeGreaterThan(0);
      const moduleKeys = modules.map((module) => module.key);
      expect(new Set(moduleKeys).size, role).toBe(moduleKeys.length);
      const hrefs = modules.flatMap((module) => module.items.map((item) => item.href));
      expect(hrefs.length, role).toBeGreaterThan(0);
      expect(new Set(hrefs).size, role).toBe(hrefs.length);
      for (const href of hrefs) {
        expect(catalogHrefs.has(href), `${role}: ${href}`).toBe(true);
      }
    }
  });

  it("renders every rail in the fixed module order, skipping absent modules", () => {
    // The agreed sidebar order. A role that has no pages in a module simply
    // skips it and the next module moves up — that is what this asserts, by
    // checking each role's rail is a subsequence of the canonical order.
    const RAIL_ORDER = [
      "General",
      "Reception",
      "Workshop",
      "Tech",
      "Parts",
      "Admin",
      "Accounts",
      "MOT",
      "Valeting",
      "Reports",
    ];

    const isSubsequence = (labels) => {
      let cursor = -1;
      return labels.every((label) => {
        const next = RAIL_ORDER.indexOf(label, cursor + 1);
        if (next === -1) return false;
        cursor = next;
        return true;
      });
    };

    for (const role of WORKSPACE_ROLE_DEFAULT_NAMES) {
      const labels = getRoleDefaultWorkspaceModules(role).map((module) => module.label);
      expect(isSubsequence(labels), `${role}: ${labels.join(" > ")}`).toBe(true);
    }

    // The All Access rail is built by bucketing the whole page catalogue and
    // must land in the same order as everyone else's.
    const allAccessLabels = getRoleWorkspaceModules([ALL_ACCESS_ROLE]).map((module) => module.label);
    expect(isSubsequence(allAccessLabels), allAccessLabels.join(" > ")).toBe(true);
    expect(allAccessLabels[0]).toBe("General");
  });

  it("keeps General first for role defaults but respects saved layouts", () => {
    // Post module-library sweep: /newsfeed and /messages live in the library's
    // General module, which every role default lists first. The old synthetic
    // "communication" module existed in no library module and is gone.
    for (const role of WORKSPACE_ROLE_DEFAULT_NAMES) {
      expect(getRoleDefaultWorkspaceModules(role)[0]?.key, role).toBe("department-general");
    }

    const savedLayout = {
      items: ["/jobs"],
      modules: [{ key: "customer-jobs", label: "Customer Jobs", items: ["/jobs"] }],
    };
    const modules = getRoleWorkspaceModules(["service"], savedLayout);
    expect(modules.map((module) => module.key)).toEqual(["customer-jobs"]);
  });

  it("allows Communication pages to live in a saved General module", () => {
    const savedLayout = {
      items: ["/newsfeed", "/messages", "/jobs"],
      modules: [
        { key: "department-general", label: "General", items: ["/newsfeed", "/messages"] },
        { key: "customer-jobs", label: "Customer Jobs", items: ["/jobs"] },
      ],
    };

    const modules = getRoleWorkspaceModules(["service"], savedLayout);
    expect(modules.map((module) => module.key)).toEqual([
      "department-general",
      "customer-jobs",
    ]);
    expect(modules[0].items.map((item) => item.href)).toEqual(["/newsfeed", "/messages"]);
  });

  it("keeps manager controls separate from employee task modules", () => {
    // The manager dashboard is what separates a manager from their team; after
    // the sweep it lives in the library's Admin module rather than a bespoke
    // "management-overview" bundle, so assert on the PAGE, not the module name.
    const serviceHrefs = getRoleDefaultWorkspaceModules("Service")
      .flatMap((module) => module.items.map((item) => item.href));
    const serviceManagerHrefs = getRoleDefaultWorkspaceModules("Service Manager")
      .flatMap((module) => module.items.map((item) => item.href));
    expect(serviceHrefs).not.toContain("/dashboard/managers");
    expect(serviceManagerHrefs).toContain("/dashboard/managers");

    const techHrefs = getRoleDefaultWorkspaceModules("Techs")
      .flatMap((module) => module.items.map((item) => item.href));
    expect(getRoleDefaultWorkspaceModules("Techs").map((module) => module.key)).toContain("department-tech");
    expect(techHrefs).toContain("/tech");
    expect(techHrefs).not.toContain("/nextjobs");
  });

  it("opens the module that owns the active route, including pending routes", () => {
    expect(getActiveRoleWorkspaceModule("/jobs", ["service"])).toBe("department-service");
    expect(getActiveRoleWorkspaceModule("/newsfeed", ["service"])).toBe("department-general");
    expect(getActiveRoleWorkspaceModule("/newsfeed", ["service"], null, "/jobs")).toBe("department-service");
  });

  it("custom user modules grant access to every page they render", () => {
    const snapshot = {
      modules: [
        { key: "borrowed", label: "Borrowed", items: ["/deliveries", "/messages"] },
      ],
    };
    expect(getRoleWorkspaceModules(["service"], snapshot).flatMap((module) => module.items.map((item) => item.href))).toEqual([
      "/deliveries",
      "/messages",
    ]);
    expect(resolveAccessiblePaths(["service"], snapshot).has("/deliveries")).toBe(true);
  });
});
