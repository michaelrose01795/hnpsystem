// file location: src/lib/tracking/vehicleLocations.test.js
// The canonical vehicle-location registry: the list itself, how stored text
// resolves to it, how writes are validated, and that it stays separate from
// the key-location vocabulary.

import { describe, expect, it } from "vitest";
import {
  NA_VEHICLE_LOCATION_ID,
  OFF_SITE_VEHICLE_LOCATION_ID,
  VEHICLE_LOCATIONS,
  VEHICLE_LOCATION_LABELS,
  VEHICLE_LOCATION_OPTIONS,
  coerceVehicleLocationLabel,
  formatVehicleLocation,
  getSectionOccupancy,
  getVehicleLocationId,
  isCanonicalVehicleLocation,
  resolveVehicleLocation,
  toVehicleLocationFormValue,
  validateVehicleLocationWrite,
} from "@/lib/tracking/vehicleLocations";
import { CAR_LOCATIONS, CAR_LOCATION_OPTIONS, KEY_LOCATIONS } from "@/lib/jobCards/locations";

const EXPECTED_LABELS = [
  "N/A",
  "Service",
  "Sales 1",
  "Sales 2",
  "Sales 3",
  "Sales 4",
  "Sales 5",
  "Sales 6",
  "Sales 7",
  "Sales 8",
  "Sales 9",
  "Sales 10",
  "Staff",
  "Trade",
  "Paint",
  "Valet",
  "Workshop",
  "Showroom",
  "Off Site",
];

const NEW_SECTIONS = ["Paint", "Valet", "Workshop", "Showroom", "Off Site"];

describe("the canonical vehicle-location list", () => {
  it("is exactly the agreed set, in display order", () => {
    expect(VEHICLE_LOCATION_LABELS).toEqual(EXPECTED_LABELS);
  });

  it("has unique ids and labels", () => {
    expect(new Set(VEHICLE_LOCATIONS.map((s) => s.id)).size).toBe(VEHICLE_LOCATIONS.length);
    expect(new Set(VEHICLE_LOCATION_LABELS).size).toBe(VEHICLE_LOCATIONS.length);
  });

  it("gives every section the full config shape, including a capacity field", () => {
    for (const section of VEHICLE_LOCATIONS) {
      expect(section).toHaveProperty("id");
      expect(section).toHaveProperty("label");
      expect(section).toHaveProperty("type");
      expect(typeof section.isPhysicalMapArea).toBe("boolean");
      expect(typeof section.supportsAutoMovement).toBe("boolean");
      expect(typeof section.displayOrder).toBe("number");
      expect(Object.prototype.hasOwnProperty.call(section, "capacity")).toBe(true);
      expect(section.capacity === null || Number.isInteger(section.capacity)).toBe(true);
    }
  });

  it("feeds the legacy CAR_LOCATIONS / CAR_LOCATION_OPTIONS exports (one registry, not two)", () => {
    expect(CAR_LOCATIONS.map((l) => l.label)).toEqual(EXPECTED_LABELS);
    expect(CAR_LOCATION_OPTIONS).toBe(VEHICLE_LOCATION_OPTIONS);
    for (const label of NEW_SECTIONS) {
      expect(CAR_LOCATION_OPTIONS.some((option) => option.value === label && option.label === label)).toBe(true);
    }
  });

  it("does not merge vehicle and key locations", () => {
    // Overlapping words are fine; the lists themselves are different domains.
    expect(KEY_LOCATIONS.map((l) => l.label)).not.toEqual(VEHICLE_LOCATION_LABELS);
    expect(KEY_LOCATIONS.some((l) => l.label === "Workshop")).toBe(true);
    expect(KEY_LOCATIONS.some((l) => l.label === "Off Site")).toBe(false);
    expect(KEY_LOCATIONS.some((l) => l.label === "Showroom")).toBe(false);
  });
});

describe("N/A and Off Site are different sections", () => {
  it("are distinct ids and labels", () => {
    expect(NA_VEHICLE_LOCATION_ID).not.toBe(OFF_SITE_VEHICLE_LOCATION_ID);
    expect(resolveVehicleLocation("Off Site").id).toBe("off-site");
    expect(resolveVehicleLocation("N/A").id).toBe("na");
  });

  it("N/A is logical only; Off Site is a physical, selectable place", () => {
    const na = VEHICLE_LOCATIONS.find((s) => s.id === "na");
    const offSite = VEHICLE_LOCATIONS.find((s) => s.id === "off-site");
    expect(na.isPhysicalMapArea).toBe(false);
    expect(offSite.isPhysicalMapArea).toBe(true);
  });

  it("blank and placeholder text resolve to N/A, never to Off Site", () => {
    for (const value of ["", null, undefined, "N/A", "na", "unknown", "TBC"]) {
      expect(getVehicleLocationId(value)).toBe("na");
    }
    expect(getVehicleLocationId("offsite")).toBe("off-site");
  });
});

describe("resolving stored text", () => {
  it("resolves every canonical label and id to itself", () => {
    for (const section of VEHICLE_LOCATIONS) {
      expect(resolveVehicleLocation(section.label).id).toBe(section.id);
      expect(resolveVehicleLocation(section.id).id).toBe(section.id);
    }
  });

  it("maps historical free text onto the new sections", () => {
    expect(resolveVehicleLocation("Workshop bay 1").id).toBe("workshop");
    expect(resolveVehicleLocation("In Workshop").id).toBe("workshop");
    expect(resolveVehicleLocation("MOT bay").id).toBe("workshop");
    expect(resolveVehicleLocation("Wash bay").id).toBe("valet");
    expect(resolveVehicleLocation("Valet Lane").id).toBe("valet");
    expect(resolveVehicleLocation("Body shop").id).toBe("paint");
    expect(resolveVehicleLocation("Sales show room").id).toBe("showroom");
    expect(resolveVehicleLocation("Ready for Release").id).toBe("service");
    expect(resolveVehicleLocation("Service car park").id).toBe("service");
  });

  it("does not confuse Sales 1 with Sales 10", () => {
    expect(resolveVehicleLocation("Sales 10").id).toBe("sales-10");
    expect(resolveVehicleLocation("Sales 1").id).toBe("sales-1");
  });

  it("returns null for text that means nothing here", () => {
    expect(resolveVehicleLocation("Behind the moon")).toBeNull();
  });
});

describe("writes are canonical", () => {
  it("accepts every canonical label unchanged", () => {
    for (const label of EXPECTED_LABELS) {
      expect(validateVehicleLocationWrite(label)).toEqual({ ok: true, value: label });
      expect(isCanonicalVehicleLocation(label)).toBe(true);
    }
  });

  it("canonicalises a recognised legacy spelling", () => {
    expect(validateVehicleLocationWrite("Workshop bay 3")).toEqual({ ok: true, value: "Workshop" });
    expect(coerceVehicleLocationLabel("wash bay")).toBe("Valet");
  });

  it("rejects free text", () => {
    const result = validateVehicleLocationWrite("Car park behind the bins");
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_VEHICLE_LOCATION");
  });

  it("treats undefined as not addressed and blank as an explicit clear", () => {
    expect(validateVehicleLocationWrite(undefined)).toEqual({ ok: true, value: undefined });
    expect(validateVehicleLocationWrite("")).toEqual({ ok: true, value: null });
    expect(validateVehicleLocationWrite(null)).toEqual({ ok: true, value: null });
  });

  it("aliases are not canonical labels", () => {
    expect(isCanonicalVehicleLocation("Workshop bay 1")).toBe(false);
  });
});

describe("form values and display", () => {
  it("opens a dropdown on the resolved section, or the placeholder for unknown text", () => {
    expect(toVehicleLocationFormValue("Workshop bay 2")).toBe("Workshop");
    expect(toVehicleLocationFormValue("")).toBe("N/A");
    expect(toVehicleLocationFormValue("Mystery yard")).toBe("");
  });

  it("displays the canonical label, or the raw text when unrecognised", () => {
    expect(formatVehicleLocation("wash bay")).toBe("Valet");
    expect(formatVehicleLocation("Mystery yard")).toBe("Mystery yard");
    expect(formatVehicleLocation(null)).toBe("N/A");
  });
});

describe("capacity", () => {
  it("derives available from capacity and occupied", () => {
    const paint = VEHICLE_LOCATIONS.find((s) => s.id === "paint");
    expect(getSectionOccupancy(paint, 1)).toMatchObject({ capacity: paint.capacity, occupied: 1, available: paint.capacity - 1 });
  });

  it("flags over-capacity without going negative", () => {
    const paint = VEHICLE_LOCATIONS.find((s) => s.id === "paint");
    const over = getSectionOccupancy(paint, paint.capacity + 3);
    expect(over.available).toBe(0);
    expect(over.isOverCapacity).toBe(true);
  });

  it("reports no availability for unbounded sections (Off Site)", () => {
    const offSite = VEHICLE_LOCATIONS.find((s) => s.id === "off-site");
    expect(getSectionOccupancy(offSite, 5)).toMatchObject({ capacity: null, occupied: 5, available: null, isOverCapacity: false });
  });
});
