import { describe, expect, it } from "vitest";
import {
  SIDEBAR_ACCESS_VERSION,
  applySidebarGroupChange,
  applySidebarGroupUserSelection,
  applySidebarModuleLayout,
  createSidebarAccessFromRole,
  getRoleDefaultSidebarAccess,
  isSidebarGroupEnabled,
  materializeSidebarAccess,
  normalizeSidebarAccess,
} from "@/lib/sidebarAccess";
import {
  getDepartmentWorkspaceNav,
  getRoleWorkspaceModules,
  getWorkspaceGroups,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";

describe("sidebar access snapshots", () => {
  it("resolves staff role defaults into assigned users", () => {
    expect(isSidebarGroupEnabled("Admin Manager", null, "management")).toBe(true);
    expect(isSidebarGroupEnabled("Buying Director", null, "management")).toBe(true);
    expect(isSidebarGroupEnabled("Service", null, "management")).toBe(false);
  });

  it("builds complete v4 role defaults with modules", () => {
    const defaults = getRoleDefaultSidebarAccess("service");
    expect(defaults.version).toBe(SIDEBAR_ACCESS_VERSION);
    expect(defaults.groups).toContain("general");
    expect(defaults.groups).toContain("service");
    expect(defaults.items).toContain("/jobs");
    expect(defaults.modules.map((module) => module.key)).toContain("customer-jobs");
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
      ],
    });
    expect(snapshot.items).toEqual(["/messages"]);
    expect(snapshot.groups).toEqual(["general"]);
    expect(snapshot.itemOrder.general).toEqual(["/messages"]);
    expect(snapshot.modules).toEqual([{ key: "custom", label: "Custom", items: ["/messages"] }]);
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
    expect(getRoleWorkspaceModules(["service"], snapshot).map((module) => module.key)).toEqual(["custom"]);
    expect(resolveAccessiblePaths(["service"], snapshot).has("/messages")).toBe(true);
  });
});
