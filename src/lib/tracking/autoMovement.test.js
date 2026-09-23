// file location: src/lib/tracking/autoMovement.test.js
// The automatic movement rule table: which statuses move a car, where to, and
// that every vehicle destination is a canonical section.

import { describe, expect, it } from "vitest";
import {
  AUTO_MOVEMENT_RULES,
  PAINT_STATUS_KEYS,
  getAutoMovementRule,
  normaliseAutoMovementStatus,
} from "@/lib/tracking/autoMovement";
import { VEHICLE_LOCATION_BY_ID, isCanonicalVehicleLocation } from "@/lib/tracking/vehicleLocations";

describe("auto-movement rules", () => {
  it("only ever writes canonical vehicle locations", () => {
    for (const [key, rule] of Object.entries(AUTO_MOVEMENT_RULES)) {
      if (rule.vehicleLocation === undefined) continue;
      expect(isCanonicalVehicleLocation(rule.vehicleLocation), key).toBe(true);
      expect(VEHICLE_LOCATION_BY_ID.get(rule.vehicleSection).supportsAutoMovement, key).toBe(true);
    }
  });

  it("moves an In Progress job's car to Workshop, whatever the spelling", () => {
    for (const status of ["In Progress", "in_progress", "IN-PROGRESS"]) {
      expect(getAutoMovementRule(status)?.vehicleLocation).toBe("Workshop");
    }
  });

  it("the new In Progress rule is vehicle-only and never moves the keys", () => {
    expect(getAutoMovementRule("In Progress").keyLocation).toBeUndefined();
  });

  it("keeps the existing workshop rule, now canonical", () => {
    const rule = getAutoMovementRule("workshop in progress");
    expect(rule.vehicleLocation).toBe("Workshop");
    expect(rule.keyLocation).toBe("Workshop Cupboard – Jobs in Progress");
  });

  it("moves washing / valeting cars to Valet and keeps the key half", () => {
    for (const status of ["wash", "being washed", "being_valeted"]) {
      const rule = getAutoMovementRule(status);
      expect(rule.vehicleLocation, status).toBe("Valet");
      expect(rule.keyLocation, status).toBe("Workshop Cupboard – Wash");
    }
  });

  it("the complete rule writes Service instead of the old free text", () => {
    const rule = getAutoMovementRule("complete");
    expect(rule.vehicleLocation).toBe("Service");
    expect(rule.vehicleLocation).not.toBe("Ready for Release");
    expect(rule.vehicleStatus).toBe("Ready for Release");
  });

  it("does not automate Paint until a status is confirmed", () => {
    expect(PAINT_STATUS_KEYS).toEqual([]);
    expect(Object.values(AUTO_MOVEMENT_RULES).some((rule) => rule.vehicleSection === "paint")).toBe(false);
  });

  it("leaves Showroom and Off Site manual, and does not map released to Off Site", () => {
    const targets = Object.values(AUTO_MOVEMENT_RULES).map((rule) => rule.vehicleSection);
    expect(targets).not.toContain("showroom");
    expect(targets).not.toContain("off-site");
    expect(getAutoMovementRule("Released")).toBeNull();
  });

  it("ignores statuses with no rule", () => {
    expect(getAutoMovementRule("Booked")).toBeNull();
    expect(getAutoMovementRule("")).toBeNull();
    expect(getAutoMovementRule(null)).toBeNull();
  });

  it("normalises status text", () => {
    expect(normaliseAutoMovementStatus("  Being_Washed ")).toBe("being washed");
  });
});
