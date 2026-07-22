import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getActiveRoleWorkspaceModule,
  getRoleDefaultWorkspaceModules,
  getRoleWorkspaceModules,
  getWorkspacePageCatalog,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";

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
  "Owner",
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

  it("keeps Communication first for role defaults but respects saved layouts", () => {
    for (const role of WORKSPACE_ROLE_DEFAULT_NAMES) {
      expect(getRoleDefaultWorkspaceModules(role)[0]?.key, role).toBe("communication");
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
    expect(getRoleDefaultWorkspaceModules("Service").map((module) => module.key)).not.toContain("management-overview");
    expect(getRoleDefaultWorkspaceModules("Service Manager").map((module) => module.key)).toContain("management-overview");
    expect(getRoleDefaultWorkspaceModules("Techs").map((module) => module.key)).toContain("my-work");
    expect(getRoleDefaultWorkspaceModules("Techs").flatMap((module) => module.items.map((item) => item.href))).not.toContain("/nextjobs");
  });

  it("opens the module that owns the active route, including pending routes", () => {
    expect(getActiveRoleWorkspaceModule("/jobs", ["service"])).toBe("customer-jobs");
    expect(getActiveRoleWorkspaceModule("/newsfeed", ["service"])).toBe("communication");
    expect(getActiveRoleWorkspaceModule("/newsfeed", ["service"], null, "/jobs")).toBe("customer-jobs");
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
