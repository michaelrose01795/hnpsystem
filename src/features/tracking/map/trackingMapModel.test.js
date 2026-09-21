// file location: src/features/tracking/map/trackingMapModel.test.js
// Unit tests for the /tracking site map's vehicle-to-space logic. The map view
// itself is exercised by e2e/workflows/tracking-map-view.spec.js; everything
// that decides WHERE a car is drawn, whether it is drawn at all, and whether a
// space is in conflict lives in these pure functions and is tested here.

import { describe, expect, it } from "vitest";
import {
  buildMapAssignments,
  describeMove,
  findAreaForLocation,
  getEntryKey,
  getMarkerStatus,
  getMoveTargets,
  parseLocation,
} from "@/features/tracking/map/trackingMapModel";
import {
  TRACKING_MAP_AREAS,
  TRACKING_MAP_SPACE_COUNT,
  TRACKING_MAP_SPACES,
} from "@/features/tracking/map/trackingMapSpaces";
import { MAP_AREAS } from "@/features/tracking/map/trackingMapSite";

// The location vocabulary actually observed in vehicle_tracking_events.
const OBSERVED_LOCATIONS = [
  "Service car park",
  "Workshop bay 1",
  "MOT bay",
  "Wash bay",
  "Collection row",
  "Sales 1",
  "Sales 7",
  "Staff",
  "Trade",
  "Valet Lane",
  "Handover Suite",
  "Overflow - West Fence",
];

const entry = (overrides) => ({
  jobId: 1,
  reg: "AB12 CDE",
  colour: "Blue",
  vehicleLocation: "Showroom",
  ...overrides,
});

const spaceAt = (index) => TRACKING_MAP_SPACES[index];

describe("the calibrated space registry", () => {
  it("expands every row into a space and reports a computed total", () => {
    const expected = MAP_AREAS.reduce(
      (total, area) => total + area.rows.reduce((sum, row) => sum + row.count, 0),
      0
    );
    expect(TRACKING_MAP_SPACES).toHaveLength(expected);
    expect(TRACKING_MAP_SPACE_COUNT).toBe(expected);
  });

  it("gives every space a unique, stable id and a persistable location value", () => {
    const ids = new Set(TRACKING_MAP_SPACES.map((space) => space.id));
    expect(ids.size).toBe(TRACKING_MAP_SPACES.length);
    for (const space of TRACKING_MAP_SPACES) {
      expect(space.locationValue).toContain(space.id);
      expect(space.locationValue).toContain(space.location);
    }
  });

  it("uses the agreed area prefixes", () => {
    const codes = Object.fromEntries(MAP_AREAS.map((area) => [area.id, area.code]));
    expect(codes["stock-compound"]).toBe("SC");
    expect(codes["front-forecourt"]).toBe("FF");
    expect(codes["workshop-bays"]).toBe("WB");
    expect(codes.showroom).toBe("SD");
    expect(codes["rear-car-park-a"]).toBe("RA");
    expect(codes["rear-car-park-b"]).toBe("RB");
    expect(codes["container-storage"]).toBe("CS");
    expect(codes["collection-row"]).toBe("CR");
  });

  it("keeps every space inside the map stage", () => {
    for (const space of TRACKING_MAP_SPACES) {
      expect(space.x).toBeGreaterThanOrEqual(0);
      expect(space.y).toBeGreaterThanOrEqual(0);
      expect(space.x + space.width).toBeLessThanOrEqual(100);
      expect(space.y + space.height).toBeLessThanOrEqual(100);
    }
  });

  it("recognises every location the live data actually contains", () => {
    for (const location of OBSERVED_LOCATIONS) {
      expect(findAreaForLocation(location), location).not.toBeNull();
    }
  });
});

describe("parseLocation", () => {
  it("resolves an exact bay only from the canonical Area space-id form", () => {
    const space = spaceAt(30);
    const parsed = parseLocation(space.locationValue);
    expect(parsed.area.id).toBe(space.areaId);
    expect(parsed.space.id).toBe(space.id);
  });

  it("treats an area name as an area, never as a bay", () => {
    // This is the rule that stopped 77 "Workshop bay 1" records becoming 12
    // invented positions plus a numbered cluster of 65.
    for (const value of ["Workshop bay 1", "Service car park", "MOT bay", "Sales 3"]) {
      const parsed = parseLocation(value);
      expect(parsed.area, value).not.toBeNull();
      expect(parsed.space, value).toBeNull();
    }
  });

  it("refuses placeholders and unknown text", () => {
    for (const value of ["N/A", "", "Round the back"]) {
      expect(parseLocation(value).area, value).toBeNull();
    }
  });

  it("ignores a bay id that does not belong to the named area", () => {
    const parsed = parseLocation("Rear car park A · FF-A01");
    expect(parsed.area.id).toBe("rear-car-park-a");
    expect(parsed.space).toBeNull();
  });
});

describe("getEntryKey", () => {
  it("prefers the stable database identity over the registration", () => {
    expect(getEntryKey({ jobId: 7, id: 3, reg: "AB12 CDE" })).toBe("job:7");
    expect(getEntryKey({ vehicleId: 9, id: 3, reg: "AB12 CDE" })).toBe("vehicle:9");
    expect(getEntryKey({ reg: "ab12 cde" })).toBe("reg:AB12 CDE");
  });
});

describe("buildMapAssignments", () => {
  it("draws a vehicle only in the bay its own record names", () => {
    const space = spaceAt(12);
    const result = buildMapAssignments([entry({ vehicleLocation: space.locationValue })]);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].space.id).toBe(space.id);
    expect(result.counts.occupiedSpaces).toBe(1);
    expect(result.counts.availableSpaces).toBe(TRACKING_MAP_SPACE_COUNT - 1);
  });

  it("never invents a position for a vehicle that names only an area", () => {
    const entries = Array.from({ length: 40 }, (_, index) =>
      entry({ jobId: index + 1, vehicleLocation: "Workshop bay 1" })
    );
    const result = buildMapAssignments(entries);
    expect(result.markers).toHaveLength(0);
    expect(result.unmapped).toHaveLength(40);
    expect(result.counts.occupiedSpaces).toBe(0);
    // The correction list still knows which area each car is said to be in.
    expect(result.unmapped[0].area.id).toBe("workshop-bays");
  });

  it("excludes departed vehicles entirely - they cannot occupy a space", () => {
    const space = spaceAt(5);
    const result = buildMapAssignments(
      [
        entry({ jobId: 1, vehicleLocation: space.locationValue, status: "Customer Collected" }),
        entry({ jobId: 2, vehicleLocation: space.locationValue, status: "In Workshop" }),
      ],
      { isDeparted: (item) => item.status === "Customer Collected" }
    );
    expect(result.departed).toHaveLength(1);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].entry.jobId).toBe(2);
    expect(result.unmapped).toHaveLength(0);
  });

  it("puts ONE conflict marker on a contested bay, never a stack", () => {
    const space = spaceAt(0);
    const entries = Array.from({ length: 6 }, (_, index) =>
      entry({ jobId: index + 1, vehicleLocation: space.locationValue })
    );
    const result = buildMapAssignments(entries);
    expect(result.markers).toHaveLength(1);
    expect(result.bySpaceId.size).toBe(1);
    const marker = result.bySpaceId.get(space.id);
    expect(marker.conflicts).toHaveLength(5);
    expect(marker.status.id).toBe("conflict");
    expect(result.counts.conflicts).toBe(5);
  });

  it("is deterministic - the same data always gives the same bay to the same car", () => {
    const space = spaceAt(3);
    const entries = [3, 1, 2].map((jobId) => entry({ jobId, vehicleLocation: space.locationValue }));
    const first = buildMapAssignments(entries);
    const second = buildMapAssignments([...entries].reverse());
    expect(first.markers[0].entry.jobId).toBe(second.markers[0].entry.jobId);
  });

  it("counts occupancy, unmapped and departed separately", () => {
    const space = spaceAt(20);
    const result = buildMapAssignments(
      [
        entry({ jobId: 1, vehicleLocation: space.locationValue }),
        entry({ jobId: 2, vehicleLocation: "Stock compound" }),
        entry({ jobId: 3, vehicleLocation: "N/A" }),
        entry({ jobId: 4, vehicleLocation: space.locationValue, status: "Customer Collected" }),
      ],
      { isDeparted: (item) => item.status === "Customer Collected" }
    );
    expect(result.counts.mapped).toBe(1);
    expect(result.counts.unmapped).toBe(2);
    expect(result.counts.departed).toBe(1);
  });
});

describe("getMarkerStatus", () => {
  it("ranks overdue first and always supplies a non-colour cue", () => {
    expect(getMarkerStatus({ isOverdue: true, isCollection: true }).id).toBe("attention");
    expect(getMarkerStatus({ isCustomerWaiting: true }).id).toBe("waiting");
    expect(getMarkerStatus({ isCollection: true }).id).toBe("collection");
    expect(getMarkerStatus({ isWorkshop: true }).id).toBe("workshop");
    expect(getMarkerStatus({}).glyph).toBeTruthy();
  });
});

describe("getMoveTargets", () => {
  it("offers only empty registry bays, so a car cannot land on a building or road", () => {
    const space = spaceAt(0);
    const result = buildMapAssignments([entry({ vehicleLocation: space.locationValue })]);
    const targets = getMoveTargets({ bySpaceId: result.bySpaceId, currentSpaceId: space.id });
    expect(targets.has(space.id)).toBe(false);
    expect(targets.size).toBe(TRACKING_MAP_SPACE_COUNT - 1);
    for (const id of targets) {
      expect(TRACKING_MAP_SPACES.some((candidate) => candidate.id === id)).toBe(true);
    }
  });

  it("never offers a space another vehicle already holds", () => {
    const [a, b] = [spaceAt(0), spaceAt(1)];
    const result = buildMapAssignments([
      entry({ jobId: 1, vehicleLocation: a.locationValue }),
      entry({ jobId: 2, vehicleLocation: b.locationValue }),
    ]);
    const targets = getMoveTargets({ bySpaceId: result.bySpaceId, currentSpaceId: a.id });
    expect(targets.has(b.id)).toBe(false);
  });

  it("can be limited to one area", () => {
    const area = TRACKING_MAP_AREAS[0];
    const targets = getMoveTargets({ areaId: area.id });
    expect(targets.size).toBe(area.capacity);
  });
});

describe("describeMove", () => {
  it("writes back the exact bay, so a placement round-trips", () => {
    const space = spaceAt(40);
    const described = describeMove({ entry: entry({ reg: "ab12 cde" }), toSpace: space });
    expect(described.reg).toBe("AB12 CDE");
    expect(described.destinationLocation).toBe(space.locationValue);

    const result = buildMapAssignments([entry({ jobId: 99, vehicleLocation: described.destinationLocation })]);
    expect(result.markers[0].space.id).toBe(space.id);
  });
});
