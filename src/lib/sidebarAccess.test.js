import { describe, expect, it } from "vitest";
import {
  SIDEBAR_ACCESS_VERSION,
  applySidebarGroupChange,
  applySidebarGroupUserSelection,
  applySidebarModuleLayout,
  applySidebarPagePlacements,
  syncAssignedStandardModules,
  createSidebarAccessFromRole,
  createSidebarLayoutCopy,
  getRoleDefaultSidebarAccess,
  isSidebarGroupEnabled,
  materializeSidebarAccess,
  normalizeSidebarAccess,
} from "@/lib/sidebarAccess";
import {
  getDepartmentWorkspaceNav,
  getRoleWorkspaceModules,
  getSidebarModuleCatalog,
  getWorkspaceGroups,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";

describe("sidebar access snapshots", () => {
  it("refreshes assigned standard modules without changing custom modules", () => {
    const synced = syncAssignedStandardModules([
      {
        key: "department-general",
        label: "General",
        items: ["/newsfeed", "/messages", "/tracking", "/archive"],
      },
      {
        key: "department-workshop",
        label: "Workshop",
        items: ["/dashboard/workshop", "/tech"],
      },
      { key: "department-account", label: "Account", items: ["/profile"] },
      { key: "department-paint", label: "Pages", items: ["/dashboard/painting"] },
      { key: "custom-finance", label: "My Finance", items: ["/accounts"] },
    ]);

    expect(synced.find((module) => module.key === "department-general")?.items)
      .toEqual(["/newsfeed", "/messages", "/tracking"]);
    expect(syncAssignedStandardModules([
      { key: "department-management", label: "Admin", items: ["/dashboard/admin"] },
    ])[0].items).toContain("/archive");
    expect(synced.find((module) => module.key === "department-workshop")?.items)
      .toEqual([
        "/dashboard/workshop",
        "/clocking",
        "/consumables-tracker",
        "/tech/efficiency",
        "/nextjobs",
      ]);
    expect(synced.find((module) => module.key === "department-workshop")?.items)
      .not.toContain("/tech");
    expect(synced.find((module) => module.key === "department-account")?.label)
      .toBe("Profile");
    expect(synced.find((module) => module.key === "department-paint")?.label)
      .toBe("Paint");
    expect(synced.find((module) => module.key === "custom-finance"))
      .toEqual({ key: "custom-finance", label: "My Finance", items: ["/accounts"] });
  });

  it("keeps duplicated standard pages in the first assigned module only", () => {
    const synced = syncAssignedStandardModules([
      { key: "department-service", label: "Reception", items: ["/jobs"] },
      { key: "department-workshop", label: "Workshop", items: ["/jobs"] },
    ]);

    expect(synced[0].items).toContain("/jobs");
    expect(synced[1].items).not.toContain("/jobs");
  });

  it("resolves staff role defaults into assigned users", () => {
    expect(isSidebarGroupEnabled("Admin Manager", null, "management")).toBe(true);
    expect(isSidebarGroupEnabled("Buying Director", null, "management")).toBe(true);
    expect(isSidebarGroupEnabled("Service", null, "management")).toBe(false);
  });

  it("builds complete role defaults with modules and placement metadata", () => {
    const defaults = getRoleDefaultSidebarAccess("service");
    expect(defaults.version).toBe(SIDEBAR_ACCESS_VERSION);
    expect(defaults.groups).toContain("general");
    expect(defaults.groups).toContain("service");
    expect(defaults.items).toContain("/jobs");
    expect(defaults.modules.map((module) => module.key)).toContain("customer-jobs");
    expect(defaults.pagePlacements).toEqual({});
  });

  it("copies a role default into a user override", () => {
    const copy = createSidebarAccessFromRole("parts manager");
    expect(copy.sourceRole).toBe("parts manager");
    expect(copy.modules.flatMap((module) => module.items)).toContain("/parts-manager");
  });

  it("legacy group grants still change navigation layout but not direct-route access", () => {
    const snapshot = applySidebarGroupChange({
      role: "service",
      currentValue: null,
      groupKey: "parts",
      enabled: true,
      itemOrder: ["/deliveries", "/goods-in", "/jobs", "/stock-catalogue"],
    });

    expect(getWorkspaceGroups(["service"], snapshot).map((group) => group.key)).toContain("parts");
    expect(resolveAccessiblePaths(["service"], snapshot).has("/deliveries")).toBe(false);
    expect(
      getDepartmentWorkspaceNav("parts", ["service"], snapshot).items.map((item) => item.href)
    ).toEqual(["/deliveries", "/goods-in", "/jobs", "/stock-catalogue"]);
  });

  it("removes a role-default group without changing unrelated groups", () => {
    const snapshot = applySidebarGroupChange({
      role: "service",
      currentValue: null,
      groupKey: "service",
      enabled: false,
      itemOrder: [],
    });

    const groups = getWorkspaceGroups(["service"], snapshot).map((group) => group.key);
    expect(groups).not.toContain("service");
    expect(groups).toContain("general");
  });

  it("stores a different button subset for an individual group member", () => {
    const snapshot = applySidebarGroupUserSelection({
      role: "service",
      currentValue: null,
      groupKey: "parts",
      enabled: true,
      selectedItemHrefs: ["/goods-in", "/deliveries"],
      itemOrder: ["/deliveries", "/goods-in", "/jobs", "/stock-catalogue"],
    });
    const nav = getDepartmentWorkspaceNav("parts", ["service"], snapshot);
    expect(nav.items.map((item) => item.href)).toEqual(["/deliveries", "/goods-in"]);
  });

  it("filters unknown groups, hrefs, order entries, and module pages", () => {
    const snapshot = normalizeSidebarAccess({
      items: ["/messages", "/unknown"],
      groups: ["general", "developer", "unknown"],
      itemOrder: { general: ["/messages", "/unknown"] },
      modules: [
        { key: "custom", label: "Custom", items: ["/messages", "/unknown"] },
        { key: "duplicate", label: "Duplicate", items: ["/messages", "/jobs"] },
      ],
      pagePlacements: { "/messages": "Communication", "/unknown": "custom" },
    });
    expect(snapshot.items).toEqual(["/messages"]);
    expect(snapshot.groups).toEqual(["general"]);
    expect(snapshot.itemOrder.general).toEqual(["/messages"]);
    expect(snapshot.modules).toEqual([
      { key: "custom", label: "Custom", items: ["/messages"] },
      { key: "duplicate", label: "Duplicate", items: ["/jobs"] },
    ]);
    expect(snapshot.pagePlacements).toEqual({ "/messages": "communication" });
  });

  it("upgrades legacy snapshots with derived module metadata", () => {
    const snapshot = materializeSidebarAccess("service", {
      version: 2,
      items: ["/messages"],
      groups: ["general"],
      itemOrder: {},
    });
    expect(snapshot.version).toBe(SIDEBAR_ACCESS_VERSION);
    expect(snapshot.items).toContain("/messages");
    expect(snapshot.groups).toEqual(["general"]);
    expect(snapshot.modules.length).toBeGreaterThan(0);
  });

  it("saves custom module layouts and keeps route permissions independent", () => {
    const snapshot = applySidebarModuleLayout({
      role: "service",
      currentValue: null,
      sourceRole: "Service",
      modules: [
        { key: "custom", label: "Custom", items: ["/messages", "/jobs"] },
      ],
    });
    expect(snapshot.sourceRole).toBe("service");
    expect(snapshot.modules).toEqual([{ key: "custom", label: "Custom", items: ["/messages", "/jobs"] }]);
    expect(getRoleWorkspaceModules(["service"], snapshot).map((module) => module.key)).toEqual([
      "communication",
      "custom",
    ]);
    expect(resolveAccessiblePaths(["service"], snapshot).has("/messages")).toBe(true);
  });

  it("adds the standard Parts bundle to a Workshop Manager and keeps page guards independent", () => {
    const role = "workshop manager";
    const defaults = getRoleDefaultSidebarAccess(role).modules;
    const used = new Set(defaults.flatMap((module) => module.items));
    const parts = getSidebarModuleCatalog().find((module) => module.key === "department-parts");
    const snapshot = applySidebarModuleLayout({
      role,
      currentValue: null,
      sourceRole: role,
      modules: [
        ...defaults,
        {
          key: parts.key,
          label: parts.label,
          items: parts.items.map((item) => item.href).filter((href) => !used.has(href)),
        },
      ],
    });
    const assignedParts = getRoleWorkspaceModules([role], snapshot).find(
      (module) => module.key === "department-parts"
    );
    expect(assignedParts.label).toBe("Parts");
    expect(assignedParts.items.map((item) => item.href)).toContain("/dashboard/parts");
    expect(resolveAccessiblePaths([role], snapshot).has("/dashboard/parts")).toBe(false);
  });

  it("saves page placements without discarding existing override metadata", () => {
    const current = applySidebarModuleLayout({
      role: "service",
      currentValue: null,
      sourceRole: "service",
      modules: [
        { key: "customer-jobs", label: "Customer & Job Intake", items: ["/appointments"] },
        { key: "service-control", label: "Service Control", items: ["/messages"] },
      ],
    });
    const updated = applySidebarPagePlacements({
      role: "service",
      currentValue: current,
      pagePlacements: { "/appointments": "service-control" },
    });
    expect(updated.modules).toEqual(current.modules);
    expect(updated.pagePlacements).toEqual({ "/appointments": "service-control" });
    expect(updated.sourceRole).toBe(current.sourceRole);
  });

  it("creates one exact source snapshot when copying a layout to other users", () => {
    const source = applySidebarPagePlacements({
      role: "service",
      currentValue: null,
      pagePlacements: { "/appointments": "service-control" },
    });
    const copied = createSidebarLayoutCopy({
      role: "service",
      currentValue: source,
      sourceRole: "service",
      modules: [
        { key: "customer-jobs", label: "Customer & Job Intake", items: ["/messages"] },
        { key: "service-control", label: "Service Control", items: ["/appointments"] },
      ],
    });

    expect(copied.modules).toEqual([
      { key: "customer-jobs", label: "Customer & Job Intake", items: ["/messages"] },
      { key: "service-control", label: "Service Control", items: ["/appointments"] },
    ]);
    expect(copied.items).toEqual(["/messages", "/appointments"]);
    expect(copied.pagePlacements).toEqual({ "/appointments": "service-control" });
  });
});
