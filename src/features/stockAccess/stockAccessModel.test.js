// file location: src/features/stockAccess/stockAccessModel.test.js
import { describe, expect, it } from "vitest";
import {
  availableActions,
  availableQuantity,
  deriveItemStatus,
  formatQuantity,
  matchScan,
  planTransaction,
  quickQuantities,
  rankByUse,
  recentItemIds,
  stockLevel,
  suggestRestockQuantity,
} from "./stockAccessModel";

const NOW = new Date("2026-09-28T10:00:00Z");

const tool = (overrides = {}) => ({
  id: "tool-1",
  name: "Torque wrench",
  category: "tools",
  unitType: "each",
  currentQuantity: 1,
  checkedOutQuantity: 0,
  minQuantity: null,
  quantityStep: 1,
  returnRequired: true,
  loanPeriodHours: 24,
  isActive: true,
  ...overrides,
});

const gloves = (overrides = {}) => ({
  id: "gloves-1",
  name: "Nitrile gloves (L)",
  category: "consumables",
  unitType: "box",
  currentQuantity: 10,
  checkedOutQuantity: 0,
  minQuantity: 3,
  reorderQuantity: 20,
  quantityStep: 1,
  returnRequired: false,
  isActive: true,
  ...overrides,
});

const oil = (overrides = {}) => ({
  id: "oil-1",
  name: "5W-30",
  category: "oils",
  unitType: "litre",
  currentQuantity: 20,
  checkedOutQuantity: 0,
  minQuantity: 5,
  quantityStep: 0.5,
  returnRequired: false,
  isActive: true,
  ...overrides,
});

const checkout = (overrides = {}) => ({
  id: "co-1",
  itemId: "tool-1",
  holderUserId: 7,
  holderName: "Sam Price",
  quantity: 1,
  quantityReturned: 0,
  status: "out",
  dueAt: "2026-09-29T10:00:00Z",
  ...overrides,
});

describe("stock state", () => {
  it("available is current minus checked out", () => {
    expect(availableQuantity(tool({ currentQuantity: 3, checkedOutQuantity: 2 }))).toBe(1);
  });

  it("levels: out, low at or below minimum, ok", () => {
    expect(stockLevel(gloves({ currentQuantity: 0 }))).toBe("out");
    expect(stockLevel(gloves({ currentQuantity: 3 }))).toBe("low");
    expect(stockLevel(gloves({ currentQuantity: 4 }))).toBe("ok");
  });

  it("formats units", () => {
    expect(formatQuantity(2.5, oil())).toBe("2.5 L");
    expect(formatQuantity(1, gloves())).toBe("1 box");
    expect(formatQuantity(3, gloves())).toBe("3 boxes");
    expect(formatQuantity(4, tool())).toBe("4");
  });
});

describe("deriveItemStatus", () => {
  it("names the holder of a single reusable item", () => {
    const status = deriveItemStatus(tool({ checkedOutQuantity: 1 }), [checkout()], NOW);
    expect(status.key).toBe("held");
    expect(status.label).toBe("SAM PRICE HAS THIS ITEM");
  });

  it("shows overdue once the loan period has passed", () => {
    const status = deriveItemStatus(tool({ checkedOutQuantity: 1 }), [checkout({ dueAt: "2026-09-28T09:00:00Z" })], NOW);
    expect(status.key).toBe("overdue");
  });

  it("shows missing when the only open record is missing", () => {
    const status = deriveItemStatus(tool({ checkedOutQuantity: 1 }), [checkout({ status: "missing" })], NOW);
    expect(status.key).toBe("missing");
  });

  it("stays available while some units are on the shelf", () => {
    const status = deriveItemStatus(tool({ currentQuantity: 3, checkedOutQuantity: 1 }), [checkout()], NOW);
    expect(status.key).toBe("available");
    expect(status.holders).toEqual(["Sam Price"]);
  });

  it("consumables warn on low stock", () => {
    expect(deriveItemStatus(gloves({ currentQuantity: 2 }), [], NOW).key).toBe("low");
    expect(deriveItemStatus(gloves({ currentQuantity: 0 }), [], NOW).key).toBe("out_of_stock");
    expect(deriveItemStatus(gloves(), [], NOW).key).toBe("in_stock");
  });

  it("inactive beats everything", () => {
    expect(deriveItemStatus(gloves({ isActive: false }), [], NOW).key).toBe("inactive");
  });
});

describe("planTransaction", () => {
  const holder = { userId: 7, name: "Sam Price" };

  it("taking out a tool checks it out without changing the total", () => {
    const plan = planTransaction({ action: "take_out", item: tool(), quantity: 1, holder, now: NOW });
    expect(plan.errors).toEqual([]);
    expect(plan.quantityDelta).toBe(0);
    expect(plan.checkedOutDelta).toBe(1);
    expect(plan.checkoutOp).toMatchObject({ op: "open", holder_user_id: 7, holder_name: "Sam Price", due_at: "2026-09-29T10:00:00.000Z" });
    expect(plan.preview.availableAfter).toBe(0);
  });

  it("refuses a tool that is already all out, unless overridden", () => {
    const item = tool({ checkedOutQuantity: 1 });
    expect(planTransaction({ action: "take_out", item, quantity: 1, holder }).errors[0]).toMatch(/all checked out/);
    const override = planTransaction({ action: "take_out", item, quantity: 1, holder, allowNegative: true });
    expect(override.errors).toEqual([]);
    expect(override.warnings[0]).toMatch(/authorised override/);
  });

  it("taking out a consumable is using it", () => {
    const plan = planTransaction({ action: "take_out", item: gloves(), quantity: 2, holder });
    expect(plan.action).toBe("consume");
    expect(plan.quantityDelta).toBe(-2);
    expect(plan.entry.quantity_consumed).toBe(2);
    expect(plan.checkoutOp).toBeNull();
  });

  it("oil accepts fractional litres; gloves do not", () => {
    expect(planTransaction({ action: "consume", item: oil(), quantity: 4.5 }).errors).toEqual([]);
    expect(planTransaction({ action: "consume", item: gloves(), quantity: 1.5 }).errors[0]).toMatch(/whole/);
  });

  it("blocks negative consumable stock", () => {
    expect(planTransaction({ action: "consume", item: gloves({ currentQuantity: 1 }), quantity: 2 }).errors[0]).toMatch(/Only 1 box/);
  });

  it("warns when a movement crosses into low stock", () => {
    expect(planTransaction({ action: "consume", item: gloves({ currentQuantity: 5 }), quantity: 2 }).warnings).toContain("This takes the item into low stock.");
  });

  it("a tool cannot be consumed", () => {
    expect(planTransaction({ action: "consume", item: tool(), quantity: 1 }).errors[0]).toMatch(/returned, not used up/);
  });

  it("returning a tool closes the checkout", () => {
    const plan = planTransaction({ action: "return", item: tool({ checkedOutQuantity: 1 }), quantity: 1, checkout: checkout() });
    expect(plan.errors).toEqual([]);
    expect(plan.checkedOutDelta).toBe(-1);
    expect(plan.checkoutOp).toEqual({ op: "return", checkout_id: "co-1", quantity: 1 });
  });

  it("cannot return more than is out on the record", () => {
    const plan = planTransaction({ action: "return", item: tool({ currentQuantity: 3, checkedOutQuantity: 1 }), quantity: 2, checkout: checkout() });
    expect(plan.errors[0]).toMatch(/Only 1 is still out/);
  });

  it("a tool return needs a checkout", () => {
    expect(planTransaction({ action: "return", item: tool(), quantity: 1 }).errors[0]).toMatch(/whose item/);
  });

  it("returning unused consumables adds stock", () => {
    const plan = planTransaction({ action: "return", item: gloves(), quantity: 1 });
    expect(plan.quantityDelta).toBe(1);
    expect(plan.entry.quantity_returned).toBe(1);
  });

  it("adjustments need a reason and can set an exact level", () => {
    expect(planTransaction({ action: "adjustment", item: gloves(), quantity: -2 }).errors).toContain("Every adjustment needs a reason.");
    const set = planTransaction({ action: "adjustment", item: gloves(), quantity: 4, mode: "set", reason: "Stock count correction" });
    expect(set.errors).toEqual([]);
    expect(set.quantityDelta).toBe(-6);
    expect(set.entry.quantity).toBe(6);
  });

  it("writing off a missing tool removes it from the total and the checked-out count", () => {
    const plan = planTransaction({
      action: "write_off",
      item: tool({ checkedOutQuantity: 1 }),
      checkout: checkout({ status: "missing" }),
      reason: "Lost",
    });
    expect(plan.errors).toEqual([]);
    expect(plan.quantityDelta).toBe(-1);
    expect(plan.checkedOutDelta).toBe(-1);
    expect(plan.preview).toEqual({ currentAfter: 0, checkedOutAfter: 0, availableAfter: 0 });
  });

  it("custody transitions are guarded", () => {
    expect(planTransaction({ action: "found", item: tool(), checkout: checkout() }).errors[0]).toMatch(/Only a missing item/);
    expect(planTransaction({ action: "mark_missing", item: tool(), checkout: checkout({ status: "missing" }) }).errors[0]).toMatch(/Only an item that is out/);
  });
});

describe("availableActions", () => {
  const caps = { transact: true, requestRestock: true, storeWarranty: true };

  it("puts Return first when the user holds the tool", () => {
    const actions = availableActions(tool({ checkedOutQuantity: 1 }), { capabilities: caps, openCheckouts: [checkout()], userId: 7 });
    expect(actions[0]).toMatchObject({ action: "return", primary: true });
  });

  it("offers Return for someone when another person holds it", () => {
    const actions = availableActions(tool({ checkedOutQuantity: 1 }), { capabilities: caps, openCheckouts: [checkout()], userId: 9 });
    expect(actions.map((a) => a.action)).toEqual(["take_out", "return", "restock_request"]);
  });

  it("consumables lead with Use; parts can go to warranty", () => {
    expect(availableActions(gloves(), { capabilities: caps })[0].action).toBe("consume");
    expect(availableActions({ ...gloves(), category: "parts" }, { capabilities: caps }).map((a) => a.action)).toContain("warranty_store");
  });
});

describe("helpers", () => {
  it("matches a scan on barcode or SKU, case-insensitively", () => {
    const items = [gloves({ barcode: "501234", sku: "GLV-L" })];
    expect(matchScan(items, "501234")?.id).toBe("gloves-1");
    expect(matchScan(items, "glv-l")?.id).toBe("gloves-1");
    expect(matchScan(items, "nope")).toBeNull();
  });

  it("suggests the reorder quantity, else tops up to twice the minimum", () => {
    expect(suggestRestockQuantity(gloves())).toBe(20);
    expect(suggestRestockQuantity(oil({ currentQuantity: 2 }))).toBe(8);
  });

  it("quick quantities follow the unit", () => {
    expect(quickQuantities(oil())).toEqual([0.5, 1, 2, 5]);
    expect(quickQuantities(gloves())).toEqual([1, 2, 5, 10]);
  });

  it("ranks common items and recent items", () => {
    const txs = [
      { itemId: "a", action: "consume" },
      { itemId: "b", action: "consume" },
      { itemId: "a", action: "take_out" },
      { itemId: "c", action: "edited" },
    ];
    expect(rankByUse(txs)).toEqual(["a", "b"]);
    expect(recentItemIds(txs)).toEqual(["a", "b", "c"]);
  });
});
