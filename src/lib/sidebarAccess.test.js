import { describe, expect, it } from "vitest";
import {
  applySidebarGroupChange,
  applySidebarGroupUserSelection,
  getRoleDefaultSidebarAccess,
  isSidebarGroupEnabled,
  normalizeSidebarAccess,
} from "@/lib/sidebarAccess";
import {
  getDepartmentWorkspaceNav,
  getWorkspaceGroups,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";

describe("sidebar access snapshots", () => {
  it("resolves staff role defaults into assigned users", () => {
    expect(isSidebarGroupEnabled("Admin Manager", null, "management")).toBe(true);
    expect(isSidebarGroupEnabled("Buying Director", null, "management")).toBe(true);
    expect(isSidebarGroupEnabled("Service", null, "management")).toBe(false);
  });

  it("keeps role defaults when no custom snapshot exists", () => {
    const defaults = getRoleDefaultSidebarAccess("service");
    expect(defaults.groups).toContain("general");
    expect(defaults.groups).toContain("service");
    expect(defaults.items).toContain("/jobs");
  });

  it("can grant a complete group to a user whose role does not receive it", () => {
    const snapshot = applySidebarGroupChange({
      role: "service",
      currentValue: null,
      groupKey: "parts",
      enabled: true,
      itemOrder: ["/deliveries", "/goods-in", "/jobs", "/stock-catalogue"],
    });

    expect(getWorkspaceGroups(["service"], snapshot).map((group) => group.key)).toContain("parts");
    expect(resolveAccessiblePaths(["service"], snapshot).has("/deliveries")).toBe(true);
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

  it("filters unknown groups, hrefs, and order entries", () => {
    const snapshot = normalizeSidebarAccess({
      items: ["/messages", "/unknown"],
      groups: ["general", "developer", "unknown"],
      itemOrder: { general: ["/messages", "/unknown"] },
    });
    expect(snapshot.items).toEqual(["/messages"]);
    expect(snapshot.groups).toEqual(["general"]);
    expect(snapshot.itemOrder.general).toEqual(["/messages"]);
  });

  it("upgrades v2 snapshots with derived module metadata without changing access", () => {
    const snapshot = normalizeSidebarAccess({
      version: 2,
      items: ["/messages"],
      groups: ["general"],
      itemOrder: {},
    });
    expect(snapshot.version).toBe(3);
    expect(snapshot.items).toEqual(["/messages"]);
    expect(snapshot.groups).toEqual(["general"]);
    expect(snapshot.moduleOrder).toEqual({});
  });
});
