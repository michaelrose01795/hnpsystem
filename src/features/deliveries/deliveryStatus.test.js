import { describe, expect, it } from "vitest";
import {
  DELIVERY_STATUS,
  canApplyDeliveryAction,
  deliveryStatusLabel,
  getDeliveryActions,
  isOpenDeliveryStatus,
  normaliseDeliveryStatus,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";

describe("legacy delivery status values", () => {
  // /delivery-planner still writes these, and existing rows carry them. They
  // are mapped at read time and never rewritten, so this is the contract that
  // stops the old data from disappearing off the board.
  it("maps the three legacy values onto the canonical workflow", () => {
    expect(normaliseDeliveryStatus("scheduled")).toBe(DELIVERY_STATUS.PLANNED);
    expect(normaliseDeliveryStatus("en_route")).toBe(DELIVERY_STATUS.OUT_FOR_DELIVERY);
    expect(normaliseDeliveryStatus("completed")).toBe(DELIVERY_STATUS.DELIVERED);
  });

  it("labels a legacy row with its canonical label", () => {
    expect(deliveryStatusLabel("completed")).toBe("Delivered");
    expect(deliveryStatusLabel("scheduled")).toBe("Planned");
  });

  it("falls back to planned rather than hiding an unknown value", () => {
    expect(normaliseDeliveryStatus("something-else")).toBe(DELIVERY_STATUS.PLANNED);
    expect(normaliseDeliveryStatus(null)).toBe(DELIVERY_STATUS.PLANNED);
  });

  it("treats delivered, failed and returned as closed", () => {
    expect(isOpenDeliveryStatus("completed")).toBe(false);
    expect(isOpenDeliveryStatus(DELIVERY_STATUS.FAILED)).toBe(false);
    expect(isOpenDeliveryStatus(DELIVERY_STATUS.RETURNED)).toBe(false);
    expect(isOpenDeliveryStatus(DELIVERY_STATUS.LOADED)).toBe(true);
  });
});

describe("delivery capabilities by role", () => {
  it("gives a parts manager everything", () => {
    const capabilities = resolveDeliveryCapabilities(["parts manager"]);
    expect(capabilities).toMatchObject({
      view: true,
      pick: true,
      load: true,
      drive: true,
      assign: true,
      reorder: true,
      manage: true,
    });
  });

  it("lets parts staff run the desk but not reopen a closed stop", () => {
    const capabilities = resolveDeliveryCapabilities(["parts"]);
    expect(capabilities.assign).toBe(true);
    expect(capabilities.manage).toBe(false);
  });

  it("lets a driver run the van but not assign work", () => {
    const capabilities = resolveDeliveryCapabilities(["parts driver"]);
    expect(capabilities).toMatchObject({
      view: true,
      pick: false,
      load: true,
      drive: true,
      assign: false,
      reorder: true,
      manage: false,
    });
  });

  it("gives an unrelated role nothing", () => {
    expect(resolveDeliveryCapabilities(["valet service"]).view).toBe(false);
  });

  it("treats the All Access demo session as a manager", () => {
    expect(resolveDeliveryCapabilities([], true).manage).toBe(true);
  });
});

describe("available actions", () => {
  const partsStaff = resolveDeliveryCapabilities(["parts"]);
  const driver = resolveDeliveryCapabilities(["parts driver"]);

  it("offers picking and ready from planned, for the stores side only", () => {
    const keys = getDeliveryActions({ status: "planned" }, partsStaff).map((a) => a.key);
    expect(keys).toEqual(["start_picking", "mark_ready"]);
    expect(getDeliveryActions({ status: "planned" }, driver)).toEqual([]);
  });

  it("offers a driver load, dispatch, deliver and fail at the right points", () => {
    // Nothing can be failed from Ready — it has not left the shelf yet.
    expect(getDeliveryActions({ status: "ready" }, driver).map((a) => a.key)).toEqual([
      "mark_loaded",
      "dispatch",
    ]);
    expect(getDeliveryActions({ status: "loaded" }, driver).map((a) => a.key)).toEqual([
      "dispatch",
      "mark_delivered",
      "mark_failed",
    ]);
    expect(getDeliveryActions({ status: "out_for_delivery" }, driver).map((a) => a.key)).toEqual([
      "mark_delivered",
      "mark_failed",
    ]);
  });

  it("offers nothing on a delivered stop unless the role can reopen it", () => {
    expect(getDeliveryActions({ status: "delivered" }, partsStaff)).toEqual([]);
    const manager = resolveDeliveryCapabilities(["parts manager"]);
    expect(getDeliveryActions({ status: "delivered" }, manager).map((a) => a.key)).toEqual([
      "reopen",
    ]);
  });

  it("reads legacy statuses through the same rules", () => {
    expect(getDeliveryActions({ status: "en_route" }, driver).map((a) => a.key)).toEqual([
      "mark_delivered",
      "mark_failed",
    ]);
  });
});

describe("server-side transition guard", () => {
  const driver = resolveDeliveryCapabilities(["parts driver"]);

  it("accepts a legal transition", () => {
    expect(canApplyDeliveryAction({ status: "loaded" }, "dispatch", driver)).toEqual({ ok: true });
  });

  it("refuses an action the role does not hold", () => {
    const verdict = canApplyDeliveryAction({ status: "planned" }, "mark_ready", driver);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/^Your role cannot/);
  });

  it("refuses a legal action from an illegal state", () => {
    const verdict = canApplyDeliveryAction({ status: "planned" }, "mark_delivered", driver);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("Planned");
  });

  it("refuses an unknown action outright", () => {
    expect(canApplyDeliveryAction({ status: "planned" }, "drop_it", driver).ok).toBe(false);
  });
});
