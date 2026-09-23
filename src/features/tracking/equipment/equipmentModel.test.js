// file location: src/features/tracking/equipment/equipmentModel.test.js
// Pins the Equipment/Tools rules the page, the API and the reminder sweep share.

import { describe, expect, it } from "vitest";
import {
  computeNextDue,
  decorateEquipment,
  deriveEquipmentStatus,
  describeInterval,
  dueSoonDaysForInterval,
  evaluateChecklist,
  filterEquipmentEntries,
  getDueSoonDays,
  getIntervalKey,
  getOverdueBand,
  groupEquipmentEntries,
  matchesEquipmentSearch,
  normaliseAssetCode,
  normaliseChecklistItems,
  resolveChecklistForAsset,
  sortEquipmentEntries,
  summariseEquipment,
} from "@/features/tracking/equipment/equipmentModel";
import { resolveEquipmentCapabilities } from "@/features/tracking/equipment/equipmentPermissions";

const NOW = new Date(2026, 8, 22, 10, 0, 0); // 22 Sep 2026, 10:00 local
const daysFromNow = (days) => new Date(2026, 8, 22 + days, 9, 0, 0).toISOString();

const asset = (overrides = {}) => ({
  id: overrides.id || "a1",
  assetCode: "EQ-0001",
  name: "2-post lift",
  category: "lifts",
  location: "workshop-bay-3",
  operationalStatus: "in_service",
  intervalMonths: 6,
  intervalDays: 183,
  lastChecked: daysFromNow(-10),
  nextDue: daysFromNow(170),
  openFaults: [],
  ...overrides,
});

describe("Due Soon follows the check interval", () => {
  it("scales the warning window with how often equipment is checked", () => {
    expect(dueSoonDaysForInterval(1)).toBe(0);
    expect(dueSoonDaysForInterval(7)).toBe(1);
    expect(dueSoonDaysForInterval(30)).toBe(3);
    expect(dueSoonDaysForInterval(91)).toBe(7);
    expect(dueSoonDaysForInterval(183)).toBe(14);
    expect(dueSoonDaysForInterval(365)).toBe(30);
  });

  it("lets an asset override the window, including to zero", () => {
    expect(getDueSoonDays(asset({ dueSoonDays: 45 }))).toBe(45);
    expect(getDueSoonDays(asset({ dueSoonDays: 0 }))).toBe(0);
    expect(getDueSoonDays(asset({ dueSoonDays: null }))).toBe(14);
  });

  it("marks a six-monthly check due soon two weeks out, not three", () => {
    expect(deriveEquipmentStatus(asset({ nextDue: daysFromNow(14) }), NOW).key).toBe("due-soon");
    expect(deriveEquipmentStatus(asset({ nextDue: daysFromNow(21) }), NOW).key).toBe("ok");
  });

  it("treats a daily check due today as due soon, and yesterday's as overdue", () => {
    const daily = { intervalMonths: null, intervalDays: 1 };
    expect(deriveEquipmentStatus(asset({ ...daily, nextDue: daysFromNow(0) }), NOW).detail).toBe("Due today");
    expect(deriveEquipmentStatus(asset({ ...daily, nextDue: daysFromNow(1) }), NOW).key).toBe("ok");
    const overdue = deriveEquipmentStatus(asset({ ...daily, nextDue: daysFromNow(-1) }), NOW);
    expect(overdue.key).toBe("overdue");
    expect(overdue.daysOverdue).toBe(1);
  });
});

describe("status precedence", () => {
  it("puts stored states ahead of dates", () => {
    const overdueDate = { nextDue: daysFromNow(-30) };
    expect(deriveEquipmentStatus(asset({ ...overdueDate, operationalStatus: "retired" }), NOW).key).toBe("retired");
    expect(deriveEquipmentStatus(asset({ ...overdueDate, operationalStatus: "out_of_service" }), NOW).key).toBe("out-of-service");
    expect(deriveEquipmentStatus(asset({ ...overdueDate, operationalStatus: "under_repair" }), NOW).key).toBe("under-repair");
  });

  it("shows overdue ahead of an open fault, and the fault ahead of due soon", () => {
    const fault = { id: "f1", description: "Worn pad", severity: "low", usability: "usable", status: "open" };
    expect(deriveEquipmentStatus(asset({ nextDue: daysFromNow(-2), openFaults: [fault] }), NOW).key).toBe("overdue");
    expect(deriveEquipmentStatus(asset({ nextDue: daysFromNow(3), openFaults: [fault] }), NOW).key).toBe("fault-reported");
  });

  it("ignores faults that are already resolved", () => {
    const resolved = { id: "f1", description: "x", severity: "high", status: "resolved" };
    expect(deriveEquipmentStatus(asset({ openFaults: [resolved] }), NOW).key).toBe("ok");
  });

  it("treats equipment with no schedule as awaiting inspection", () => {
    expect(deriveEquipmentStatus(asset({ nextDue: null }), NOW).key).toBe("awaiting-inspection");
  });

  it("counts calibration expiry as overdue for calibrated equipment only", () => {
    const expired = { calibrationDue: daysFromNow(-5), calibrationIntervalMonths: 12 };
    const status = deriveEquipmentStatus(asset({ ...expired, requiresCalibration: true }), NOW);
    expect(status.key).toBe("overdue");
    expect(status.dueKind).toBe("calibration");
    expect(status.detail).toBe("Calibration overdue 5 days");
    expect(deriveEquipmentStatus(asset({ ...expired, requiresCalibration: false }), NOW).key).toBe("ok");
  });
});

describe("intervals", () => {
  it("recognises presets, including legacy month intervals stored as days", () => {
    expect(getIntervalKey({ intervalMonths: 6 })).toBe("m6");
    expect(getIntervalKey({ intervalDays: 7 })).toBe("d7");
    expect(getIntervalKey({ intervalDays: 365 })).toBe("m12");
    expect(describeInterval({ intervalDays: 10 })).toBe("10 days");
  });

  it("adds calendar months, clamping to the end of a short month", () => {
    const next = computeNextDue(new Date(2026, 0, 31), { intervalMonths: 1 });
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2026, 1, 28]);
    const weekly = computeNextDue(new Date(2026, 8, 22), { intervalDays: 7 });
    expect(weekly.getDate()).toBe(29);
  });
});

describe("summary tiles and filters", () => {
  const assets = [
    asset({ id: "ok" }),
    asset({ id: "soon", nextDue: daysFromNow(5) }),
    asset({ id: "late", nextDue: daysFromNow(-40), lastChecked: NOW.toISOString() }),
    asset({ id: "oos", operationalStatus: "out_of_service", openFaults: [{ id: "f", description: "x", severity: "critical", usability: "unsafe", status: "open" }] }),
    asset({ id: "gone", operationalStatus: "retired" }),
  ];

  it("counts only active equipment, with faults and out-of-service counted as facts", () => {
    expect(summariseEquipment(assets, NOW)).toEqual({
      total: 4,
      dueSoon: 1,
      overdue: 1,
      checkedToday: 1,
      faultReported: 1,
      outOfService: 1,
      retired: 1,
    });
  });

  it("filters with the same rules the tiles count with", () => {
    const entries = decorateEquipment(assets, NOW);
    const ids = (quickFilter) => filterEquipmentEntries(entries, { quickFilter }, NOW).map((entry) => entry.asset.id);
    expect(ids("active")).toEqual(["ok", "soon", "late", "oos"]);
    expect(ids("overdue")).toEqual(["late"]);
    expect(ids("fault-reported")).toEqual(["oos"]);
    expect(ids("retired")).toEqual(["gone"]);
    expect(ids("all")).toHaveLength(5);
  });
});

describe("search", () => {
  const lift = asset({ serialNumber: "SN-4471", manufacturer: "Bradbury", model: "H4" });
  it("matches every word across name, ID, location, serial, maker and model", () => {
    expect(matchesEquipmentSearch(lift, "lift bay 3")).toBe(true);
    expect(matchesEquipmentSearch(lift, "eq-0001")).toBe(true);
    expect(matchesEquipmentSearch(lift, "4471 bradbury")).toBe(true);
    expect(matchesEquipmentSearch(lift, "lift reception")).toBe(false);
  });
});

describe("sorting and backlog grouping", () => {
  const backlog = [
    asset({ id: "a", name: "Alpha", nextDue: daysFromNow(-3) }),
    asset({ id: "b", name: "Bravo", nextDue: daysFromNow(-120) }),
    asset({ id: "c", name: "Charlie", nextDue: daysFromNow(-45) }),
    asset({ id: "d", name: "Delta", nextDue: daysFromNow(4) }),
    asset({ id: "e", name: "Echo", nextDue: daysFromNow(-12) }),
  ];

  it("bands overdue work by age instead of one long list", () => {
    expect(getOverdueBand(0).key).toBe("overdue-recent");
    expect(getOverdueBand(8).key).toBe("overdue-7");
    expect(getOverdueBand(31).key).toBe("overdue-30");
    expect(getOverdueBand(91).key).toBe("overdue-90");
    const groups = groupEquipmentEntries(sortEquipmentEntries(decorateEquipment(backlog, NOW), "urgency"), "urgency");
    expect(groups.map((group) => [group.key, group.entries.map((entry) => entry.asset.id)])).toEqual([
      ["overdue-90", ["b"]],
      ["overdue-30", ["c"]],
      ["overdue-7", ["e"]],
      ["overdue-recent", ["a"]],
      ["due-soon", ["d"]],
    ]);
  });

  it("returns one flat list for the other sorts", () => {
    const sorted = sortEquipmentEntries(decorateEquipment(backlog, NOW), "due-soonest");
    expect(sorted.map((entry) => entry.asset.id)).toEqual(["b", "c", "e", "a", "d"]);
    expect(groupEquipmentEntries(sorted, "due-soonest")).toHaveLength(1);
    expect(sortEquipmentEntries(decorateEquipment(backlog, NOW), "name")[0].asset.name).toBe("Alpha");
  });
});

describe("checklists", () => {
  const items = normaliseChecklistItems([
    { id: "arms", label: "Arms lock", kind: "check" },
    { id: "arms", label: "Duplicate id", kind: "check", required: false },
    { label: "Pressure", kind: "reading", unit: "bar", min: 5, max: 8 },
    { label: "   " },
  ]);

  it("normalises items: unique ids, blank labels dropped", () => {
    expect(items.map((item) => item.id)).toEqual(["arms", "arms-2", "item-3"]);
    expect(items[2]).toMatchObject({ kind: "reading", unit: "bar", min: 5, max: 8 });
  });

  it("suggests fail for a failed item and advisory for an out-of-range reading", () => {
    expect(evaluateChecklist(items, { arms: { outcome: "fail" } }).suggestedResult).toBe("fail");
    const advisory = evaluateChecklist(items, { arms: { outcome: "pass" }, "item-3": { reading: "9.5" } });
    expect(advisory.suggestedResult).toBe("advisory");
    expect(advisory.outOfRange).toEqual(["Pressure"]);
    expect(evaluateChecklist(items, {}).missing).toEqual(["Arms lock", "Pressure"]);
  });

  it("picks the asset's own checklist, then its category's, then the general one", () => {
    const lists = [
      { id: "general", category: "", isActive: true },
      { id: "lifts", category: "lifts", isActive: true },
      { id: "custom", category: "tyre", isActive: true },
      { id: "off", category: "mot", isActive: false },
    ];
    expect(resolveChecklistForAsset(asset({ checklistId: "custom" }), lists).id).toBe("custom");
    expect(resolveChecklistForAsset(asset(), lists).id).toBe("lifts");
    expect(resolveChecklistForAsset(asset({ category: "mot" }), lists).id).toBe("general");
  });
});

describe("asset codes and permissions", () => {
  it("normalises scanned or typed asset IDs", () => {
    expect(normaliseAssetCode(" eq 0001 ")).toBe("EQ-0001");
    expect(normaliseAssetCode("eq-0001<script>")).toBe("EQ-0001SCRIPT");
  });

  it("gives technicians checks and faults, and managers the register", () => {
    const tech = resolveEquipmentCapabilities(["Techs"]);
    expect(tech).toMatchObject({ view: true, check: true, reportFault: true, manage: false, bulkCheck: false });
    const manager = resolveEquipmentCapabilities(["Workshop Manager"]);
    expect(manager).toMatchObject({ manage: true, bulkCheck: true, retire: true, manageChecklists: true });
    expect(resolveEquipmentCapabilities(["Admin"]).manage).toBe(true);
    expect(resolveEquipmentCapabilities(["Accounts"]).view).toBe(false);
  });
});
