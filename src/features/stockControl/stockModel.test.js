// file location: src/features/stockControl/stockModel.test.js
import { describe, expect, it } from "vitest";
import {
  bandFromFraction,
  buildStockQrUrl,
  describeRunOut,
  filterRows,
  findByScan,
  findSiblingRows,
  indexSiblingRows,
  formatQuantity,
  getPrimaryAction,
  getThresholds,
  isAlertWorthy,
  isSignificantAdjustment,
  normaliseCalibration,
  parseStockScan,
  quantityFromBand,
  resolveCheckReading,
  resolveLevelState,
  resolveRows,
  resolveStockStatus,
  sortRows,
  suggestReplenishment,
  summariseUsage,
  summaryCounts,
  volumeFromDipstick,
} from "@/features/stockControl/stockModel";
import { resolveStockCapabilities } from "@/features/stockControl/stockAccess";

const NOW = new Date("2026-09-22T12:00:00Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString();

describe("levels and status", () => {
  it("defaults critical to half the minimum", () => {
    expect(getThresholds({ minLevel: 20 }).critical).toBe(10);
    expect(getThresholds({ minLevel: 20, criticalLevel: 30 }).critical).toBe(20);
  });

  it("resolves level states from quantity and thresholds", () => {
    const item = { minLevel: 20 };
    expect(resolveLevelState({ ...item, currentQuantity: 0 })).toBe("out_of_stock");
    expect(resolveLevelState({ ...item, currentQuantity: 8 })).toBe("critical");
    expect(resolveLevelState({ ...item, currentQuantity: 15 })).toBe("low");
    expect(resolveLevelState({ ...item, currentQuantity: 40 })).toBe("normal");
    expect(resolveLevelState({})).toBe("unmeasured");
    expect(resolveLevelState({ levelBand: "low" })).toBe("low");
    expect(resolveLevelState({ levelBand: "empty" })).toBe("out_of_stock");
  });

  it("shows the order state while stock is on its way, and archived above all", () => {
    const item = { id: "a", minLevel: 20, currentQuantity: 5 };
    expect(resolveStockStatus(item, { status: "awaiting_delivery" }).key).toBe("awaiting_delivery");
    expect(resolveStockStatus(item, { status: "order_required" }).key).toBe("critical");
    expect(resolveStockStatus({ ...item, currentQuantity: 15 }, { status: "order_required" }).key).toBe("order_required");
    expect(resolveStockStatus({ ...item, archivedAt: NOW.toISOString() }, null).key).toBe("archived");
  });

  it("only alerts when stock gets worse", () => {
    expect(isAlertWorthy("normal", "low")).toBe(true);
    expect(isAlertWorthy("low", "critical")).toBe(true);
    expect(isAlertWorthy("critical", "low")).toBe(false);
    expect(isAlertWorthy("low", "low")).toBe(false);
    expect(isAlertWorthy("low", "normal")).toBe(false);
  });
});

describe("tank levels and calibration", () => {
  it("maps fractions to bands and bands to quantities", () => {
    expect(bandFromFraction(1)).toBe("full");
    expect(bandFromFraction(0.7)).toBe("three_quarters");
    expect(bandFromFraction(0.5)).toBe("half");
    expect(bandFromFraction(0.2)).toBe("quarter");
    expect(bandFromFraction(0.05)).toBe("low");
    expect(bandFromFraction(0)).toBe("empty");
    expect(quantityFromBand("half", 1000)).toBe(500);
    expect(quantityFromBand("half", null)).toBeNull();
  });

  it("cleans calibration tables", () => {
    expect(normaliseCalibration([{ reading: 10, volume: 100 }, { reading: "5", volume: "40" }, { reading: 20, volume: 90 }, { reading: "x", volume: 1 }])).toEqual([
      { reading: 5, volume: 40 },
      { reading: 10, volume: 100 },
    ]);
  });

  it("interpolates a dipstick reading and clamps outside the chart", () => {
    const calibration = [{ reading: 0, volume: 0 }, { reading: 50, volume: 400 }, { reading: 100, volume: 1000 }];
    expect(volumeFromDipstick(25, { calibration })).toEqual({ volume: 200, method: "calibration", clamped: false });
    expect(volumeFromDipstick(75, { calibration }).volume).toBe(700);
    expect(volumeFromDipstick(120, { calibration })).toEqual({ volume: 1000, method: "calibration", clamped: true });
  });

  it("scales a percentage gauge by capacity without a chart", () => {
    expect(volumeFromDipstick(40, { capacity: 500, dipstickUnit: "percent" })).toEqual({ volume: 200, method: "percent", clamped: false });
    expect(volumeFromDipstick(40, { capacity: 500, dipstickUnit: "cm" }).volume).toBeNull();
  });

  it("resolves a check reading by measurement mode", () => {
    const tank = { measurementMode: "tank", maxCapacity: 1000, calibration: [{ reading: 0, volume: 0 }, { reading: 100, volume: 1000 }], dipstickUnit: "cm" };
    const reading = resolveCheckReading(tank, { quantity: null, levelBand: null, dipstickReading: 60 });
    expect(reading.quantity).toBe(600);
    expect(reading.levelBand).toBe("half");
    expect(resolveCheckReading({ measurementMode: "tank", dipstickUnit: "cm" }, { quantity: null, levelBand: null, dipstickReading: 5 }).error).toBeTruthy();
    expect(resolveCheckReading({ measurementMode: "level", maxCapacity: 200 }, { quantity: null, levelBand: "quarter", dipstickReading: null }).quantity).toBe(50);
    expect(resolveCheckReading({ measurementMode: "count" }, { quantity: 12, levelBand: null, dipstickReading: null }).quantity).toBe(12);
  });
});

describe("replenishment", () => {
  it("fills to target less stock on hand and on order, rounded up to packs", () => {
    expect(suggestReplenishment({ currentQuantity: 30, targetLevel: 200, reorderQuantity: 60 }).quantity).toBe(180);
    expect(suggestReplenishment({ currentQuantity: 30, targetLevel: 200 }, { incoming: 100 }).quantity).toBe(70);
    expect(suggestReplenishment({ currentQuantity: 250, targetLevel: 200 }).quantity).toBe(0);
    expect(suggestReplenishment({ currentQuantity: 3, reorderQuantity: 12 }).quantity).toBe(12);
    expect(suggestReplenishment({ currentQuantity: 3 }).quantity).toBe(0);
  });

  it("flags significant adjustments relative to the item's scale", () => {
    expect(isSignificantAdjustment({ targetLevel: 100 }, -25)).toBe(true);
    expect(isSignificantAdjustment({ targetLevel: 100 }, -5)).toBe(false);
    expect(isSignificantAdjustment({}, 0.5)).toBe(false);
  });
});

describe("usage trends", () => {
  it("needs enough history before estimating", () => {
    const sparse = [{ movementType: "stock_out", quantityDelta: -5, createdAt: daysAgo(2) }];
    const usage = summariseUsage(sparse, { currentQuantity: 50 }, NOW);
    expect(usage.reliable).toBe(false);
    expect(usage.runOutDate).toBeNull();
    expect(describeRunOut(usage)).toBeNull();
  });

  it("estimates daily usage and run-out from consumption, ignoring deliveries and corrections", () => {
    const movements = [
      { movementType: "receipt", quantityDelta: 200, createdAt: daysAgo(30) },
      { movementType: "stock_out", quantityDelta: -10, createdAt: daysAgo(28) },
      { movementType: "check", quantityDelta: -20, createdAt: daysAgo(20) },
      { movementType: "stock_out", quantityDelta: -30, createdAt: daysAgo(10) },
      { movementType: "adjustment", quantityDelta: -50, createdAt: daysAgo(5) },
    ];
    const usage = summariseUsage(movements, { currentQuantity: 60 }, NOW);
    expect(usage.reliable).toBe(true);
    expect(usage.totalUsed).toBe(60);
    expect(usage.dailyUsage).toBeCloseTo(2, 1);
    expect(usage.daysRemaining).toBe(30);
    expect(describeRunOut(usage)).toMatch(/^about /);
  });
});

describe("rows: actions, filters, sorting", () => {
  const categories = [{ id: "c-oil", name: "Oils" }];
  const locations = [{ id: "l-ws", name: "Workshop" }, { id: "l-st", name: "Stores" }];
  const items = [
    { id: "1", title: "5W-30 bulk", oilGrade: "5W-30", categoryId: "c-oil", locationId: "l-ws", currentQuantity: 5, minLevel: 50, lastCheck: daysAgo(1), nextCheck: daysAgo(-5), barcode: "501234" },
    { id: "2", title: "Screenwash", locationId: "l-ws", currentQuantity: 100, minLevel: 20, lastCheck: daysAgo(40), nextCheck: daysAgo(10), preferredSupplier: "Acme" },
    { id: "3", title: "5W-30 bulk", categoryId: "c-oil", locationId: "l-st", currentQuantity: 80, minLevel: 50, lastCheck: daysAgo(3), nextCheck: daysAgo(-3) },
    { id: "4", title: "Old coolant", archivedAt: daysAgo(2), currentQuantity: 0 },
  ];
  const orders = [{ id: "o1", itemId: "3", status: "awaiting_delivery", quantityOrdered: 100, quantityReceived: 40, supplier: "OilCo", createdAt: daysAgo(2) }];
  const rows = resolveRows(items, orders, { now: NOW, categories, locations });

  it("offers context-sensitive actions per capability", () => {
    const all = resolveStockCapabilities(["admin"]);
    const floor = resolveStockCapabilities(["techs"]);
    expect(getPrimaryAction(rows[0].status, all)).toEqual({ id: "order", label: "Order Stock" });
    expect(getPrimaryAction(rows[0].status, floor)).toEqual({ id: "request-order", label: "Request Order" });
    expect(getPrimaryAction(rows[1].status, floor)).toEqual({ id: "check", label: "Check Level" });
    expect(getPrimaryAction(rows[2].status, all)).toEqual({ id: "receive", label: "Mark Received" });
    expect(getPrimaryAction(rows[2].status, floor)).toEqual({ id: "order-info", label: "Order Info" });
    expect(getPrimaryAction(rows[3].status, all)).toEqual({ id: "restore", label: "Restore" });
    expect(rows[2].incoming).toBe(60);
  });

  it("searches across grade, barcode, supplier and location", () => {
    expect(filterRows(rows, { search: "5w-30 stores" }).map((row) => row.item.id)).toEqual(["3"]);
    expect(filterRows(rows, { search: "acme" }).map((row) => row.item.id)).toEqual(["2"]);
    expect(filterRows(rows, { search: "oilco" }).map((row) => row.item.id)).toEqual(["3"]);
    expect(findByScan(rows.map((row) => row.item), "501234")?.id).toBe("1");
  });

  it("hides archived items unless asked, and filters by summary tile", () => {
    expect(filterRows(rows).length).toBe(3);
    expect(filterRows(rows, { status: "archived" }).map((row) => row.item.id)).toEqual(["4"]);
    expect(filterRows(rows, { summary: "incoming" }).map((row) => row.item.id)).toEqual(["3"]);
    expect(filterRows(rows, { summary: "check-due" }).map((row) => row.item.id)).toEqual(["2"]);
    const counts = Object.fromEntries(summaryCounts(rows).map((count) => [count.key, count.value]));
    expect(counts.critical).toBe(1);
    expect(counts.total).toBe(3);
  });

  it("sorts by action required, oldest check and lowest stock", () => {
    const active = filterRows(rows);
    expect(sortRows(active, "action")[0].item.id).toBe("1");
    expect(sortRows(active, "oldest-check")[0].item.id).toBe("2");
    expect(sortRows(active, "name").map((row) => row.item.title)).toEqual(["5W-30 bulk", "5W-30 bulk", "Screenwash"]);
  });
});

describe("QR links and formatting", () => {
  it("round-trips a stock QR URL", () => {
    const url = buildStockQrUrl("https://dms.example/", "abc-123", "use");
    expect(url).toBe("https://dms.example/tracking/Oil-Stock?stock=abc-123&stockAction=use");
    expect(parseStockScan(url)).toEqual({ itemId: "abc-123", action: "use" });
    // Labels printed before the tracker split still scan.
    expect(parseStockScan("https://dms.example/tracking?tab=oil-stock&stock=abc-123&stockAction=use"))
      .toEqual({ itemId: "abc-123", action: "use" });
    expect(parseStockScan("501234")).toBeNull();
  });

  it("formats quantities with their unit", () => {
    expect(formatQuantity(12.5, { unit: "litres" })).toBe("12.5 L");
    expect(formatQuantity(3, { unit: "boxes" })).toBe("3 boxes");
    expect(formatQuantity(4, { unit: "custom", customUnitLabel: "drums" })).toBe("4 drums");
    expect(formatQuantity(null, { unit: "litres" })).toBe("—");
  });
});

describe("capabilities", () => {
  it("gives each department suitable rights from the shared role lists", () => {
    const floor = resolveStockCapabilities(["Techs"]);
    expect(floor).toMatchObject({ view: true, check: true, use: true, requestOrder: true, order: false, adjust: false, viewCosts: false });
    const parts = resolveStockCapabilities(["Parts"]);
    expect(parts).toMatchObject({ order: true, receive: true, adjust: true, stocktake: true, manage: true, archive: false, configure: false });
    const manager = resolveStockCapabilities(["Workshop Manager"]);
    expect(manager.archive && manager.configure).toBe(true);
    expect(resolveStockCapabilities(["Sales"]).view).toBe(false);
    expect(resolveStockCapabilities([], true).configure).toBe(true);
  });
});

describe("sibling rows", () => {
  it("indexes the same siblings findSiblingRows finds per row", () => {
    const row = (id, title, locationId, archived = false) => ({ item: { id, title, locationId }, archived });
    const rows = [
      row("a", "5W-30 Oil", "bay"),
      row("b", " 5w-30 oil ", "store"),
      row("c", "5W-30 Oil", "store", true),
      row("d", "5W-30 Oil", "bay"),
      row("e", "Screenwash", "bay"),
      row("f", "", "store"),
    ];
    const index = indexSiblingRows(rows);
    rows.forEach((entry) => {
      expect(index.get(entry) || []).toEqual(findSiblingRows(rows, entry));
    });
  });
});
