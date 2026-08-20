import { describe, expect, it } from "vitest";
import {
  findConsumableForRequest,
  groupConsumableRequests,
  normalizeConsumableRequestStatus,
} from "@/lib/consumableRequests";

describe("consumable request data", () => {
  it("normalizes deployed legacy lifecycle statuses", () => {
    expect(normalizeConsumableRequestStatus("approved")).toBe("ordered");
    expect(normalizeConsumableRequestStatus("received")).toBe("arrived");
    expect(normalizeConsumableRequestStatus("completed")).toBe("arrived");
  });

  it("prefers the relational tracker link over a copied request name", () => {
    const consumables = [{ id: "tracker-1", name: "Canonical gloves" }];
    expect(findConsumableForRequest({ consumableId: "tracker-1", itemName: "Old gloves" }, consumables))
      .toEqual(consumables[0]);
  });

  it("does not guess when a legacy copied name matches duplicate tracker rows", () => {
    const consumables = [
      { id: "tracker-1", name: "Seat covers" },
      { id: "tracker-2", name: "Seat   covers" },
    ];
    expect(findConsumableForRequest({ itemName: "seat covers" }, consumables)).toBeNull();
  });

  it("groups linked requests by tracker id and counts received quantities as fulfilled", () => {
    const consumables = [{ id: "tracker-1", name: "Tyre valves" }];
    const groups = groupConsumableRequests([
      { id: "one", consumableId: "tracker-1", itemName: "Tyre valve", quantity: 3, status: "approved" },
      { id: "two", consumableId: "tracker-1", itemName: "Valves", quantity: 2, status: "received" },
    ], consumables);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      itemName: "Tyre valves",
      totalQuantity: 5,
      activeQuantity: 3,
      fulfilledQuantity: 2,
    });
  });
});
