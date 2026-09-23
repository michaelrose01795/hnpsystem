// file location: src/features/tracking/map/trackingMapModel.test.js
// Unit tests for the /tracking site map's section model: the central section
// config (labels, anchors, regions, capacities), grouping and counting, the
// selected-section state, search, and move destinations. The rendered view is
// exercised by e2e/workflows/tracking-map-view.spec.js.

import { describe, expect, it } from "vitest";
import {
  ALL_SECTIONS_ID,
  INITIAL_SECTION_SELECTION,
  buildSectionOccupancy,
  buildSectionStripItems,
  describeMove,
  filterEntriesForSection,
  getEntryKey,
  getEntrySection,
  getMarkerStatus,
  getMoveDestinations,
  groupEntriesBySection,
  isValidMoveDestination,
  searchVehicles,
  sectionSelectionReducer,
  summariseSectionOccupancy,
} from "@/features/tracking/map/trackingMapModel";
import {
  MAP_PLACEMENT_IDS,
  PARKING_AREAS,
  TRACKING_SECTIONS,
  TRACKING_SECTION_BY_ID,
  buildSectionGeometry,
} from "@/features/tracking/map/parkingAreas";
import { VEHICLE_LOCATION_LABELS } from "@/lib/tracking/vehicleLocations";

const NEW_SECTION_IDS = ["paint", "valet", "workshop", "showroom", "off-site"];

let nextId = 1;
const entry = (vehicleLocation, overrides = {}) => ({
  jobId: nextId++,
  reg: `AB${nextId} CDE`,
  jobNumber: `J${1000 + nextId}`,
  vehicleLocation,
  ...overrides,
});

describe("the central section config", () => {
  it("covers every canonical vehicle location, in display order", () => {
    expect(TRACKING_SECTIONS.map((s) => s.label)).toEqual(VEHICLE_LOCATION_LABELS);
  });

  it("puts Paint, Valet, Workshop, Showroom and Off Site on the map with a label and a region", () => {
    for (const id of NEW_SECTION_IDS) {
      const section = TRACKING_SECTION_BY_ID.get(id);
      expect(section.isOnMap, id).toBe(true);
      expect(section.labelAnchor, id).toBeTruthy();
      expect(section.region, id).toBeTruthy();
    }
  });

  it("keeps N/A, Sales 9 and Sales 10 off the plan", () => {
    for (const id of ["na", "sales-9", "sales-10"]) {
      expect(TRACKING_SECTION_BY_ID.get(id).isOnMap, id).toBe(false);
    }
    expect(PARKING_AREAS.some((area) => area.id === "na")).toBe(false);
  });

  it("only places sections that exist in the registry and are physical", () => {
    for (const id of MAP_PLACEMENT_IDS) {
      const section = TRACKING_SECTION_BY_ID.get(id);
      expect(section, id).toBeTruthy();
      expect(section.isPhysicalMapArea, id).toBe(true);
    }
  });

  it("keeps every anchor and region inside the image, with the label inside its region", () => {
    for (const area of PARKING_AREAS) {
      const { labelAnchor: a, region: r } = area;
      for (const value of [a.x, a.y, r.x0, r.y0, r.x1, r.y1]) {
        expect(value, area.id).toBeGreaterThanOrEqual(0);
        expect(value, area.id).toBeLessThanOrEqual(1);
      }
      expect(r.x0, area.id).toBeLessThan(r.x1);
      expect(r.y0, area.id).toBeLessThan(r.y1);
      expect(a.x >= r.x0 && a.x <= r.x1 && a.y >= r.y0 && a.y <= r.y1, area.id).toBe(true);
    }
  });

  it("has no two building regions overlapping", () => {
    const buildings = PARKING_AREAS.filter((area) => area.type === "building");
    for (let i = 0; i < buildings.length; i += 1) {
      for (let j = i + 1; j < buildings.length; j += 1) {
        const a = buildings[i].region;
        const b = buildings[j].region;
        const overlaps = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(overlaps, `${buildings[i].id} / ${buildings[j].id}`).toBe(false);
      }
    }
  });

  it("gives every section a capacity field", () => {
    for (const section of TRACKING_SECTIONS) {
      expect(Object.prototype.hasOwnProperty.call(section, "capacity"), section.id).toBe(true);
    }
  });
});

describe("label geometry", () => {
  const natural = { width: 1431, height: 1120 };
  const workshop = TRACKING_SECTION_BY_ID.get("workshop");

  it("scales anchors and regions into natural image pixels", () => {
    const geometry = buildSectionGeometry(workshop, natural, 0);
    expect(geometry.region.x).toBeCloseTo(workshop.region.x0 * natural.width);
    expect(geometry.region.width).toBeCloseTo((workshop.region.x1 - workshop.region.x0) * natural.width);
    // The pill is centred on the anchor.
    expect(geometry.pill.x + geometry.pill.width / 2).toBeCloseTo(workshop.labelAnchor.x * natural.width);
  });

  it("adds a count to the pill only when the section has vehicles", () => {
    expect(buildSectionGeometry(workshop, natural, 0).count).toBeNull();
    const withCount = buildSectionGeometry(workshop, natural, 7);
    expect(withCount.count.text).toBe("7");
    expect(withCount.pill.width).toBeGreaterThan(buildSectionGeometry(workshop, natural, 0).pill.width);
  });
});

describe("grouping and counting", () => {
  const entries = [
    entry("Paint"),
    entry("Valet"),
    entry("Wash bay"), // legacy -> Valet
    entry("Workshop"),
    entry("Workshop bay 1"), // legacy -> Workshop
    entry("Showroom"),
    entry("Off Site"),
    entry("N/A"),
    entry(""),
    entry("Behind the moon"), // unrecognised -> N/A
    entry("Sales 3"),
  ];

  it("groups by the new sections, including legacy spellings", () => {
    const { counts } = groupEntriesBySection(entries);
    expect(counts.paint).toBe(1);
    expect(counts.valet).toBe(2);
    expect(counts.workshop).toBe(2);
    expect(counts.showroom).toBe(1);
    expect(counts["off-site"]).toBe(1);
    expect(counts["sales-3"]).toBe(1);
  });

  it("keeps Off Site distinct from N/A", () => {
    const { counts, unrecognised } = groupEntriesBySection(entries);
    expect(counts.na).toBe(3);
    expect(counts["off-site"]).toBe(1);
    expect(unrecognised).toHaveLength(1);
    expect(getEntrySection(entry("Behind the moon")).isUnrecognised).toBe(true);
    expect(getEntrySection(entry("N/A")).isUnrecognised).toBe(false);
  });

  it("has a bucket for every section even when empty, and counts every entry once", () => {
    const { bySection, total } = groupEntriesBySection(entries);
    expect([...bySection.keys()]).toEqual(TRACKING_SECTIONS.map((s) => s.id));
    const sum = [...bySection.values()].reduce((n, list) => n + list.length, 0);
    expect(sum).toBe(total);
  });

  it("places a car by its VEHICLE location only, never its key location", () => {
    const car = entry("Service", { keyLocation: "Workshop" });
    expect(getEntrySection(car).section.id).toBe("service");
  });

  it("builds strip items: All first, then every section with its count", () => {
    const items = buildSectionStripItems(entries);
    expect(items[0]).toMatchObject({ id: ALL_SECTIONS_ID, label: "All", count: entries.length });
    expect(items.slice(1).map((i) => i.label)).toEqual(VEHICLE_LOCATION_LABELS);
    expect(items.find((i) => i.id === "valet").count).toBe(2);
  });

  it("derives capacity / occupied / available per section", () => {
    const { counts } = groupEntriesBySection(entries);
    const occupancy = buildSectionOccupancy(counts);
    const workshop = TRACKING_SECTION_BY_ID.get("workshop");
    expect(occupancy.workshop).toMatchObject({
      capacity: workshop.capacity,
      occupied: 2,
      available: workshop.capacity - 2,
    });
    expect(occupancy["off-site"].available).toBeNull();
  });

  it("summarises occupancy over bounded sections only", () => {
    const summary = summariseSectionOccupancy(entries);
    const bounded = TRACKING_SECTIONS.filter((s) => Number.isFinite(s.capacity));
    expect(summary.totalSpaces).toBe(bounded.reduce((n, s) => n + s.capacity, 0));
    // Paint, Valet x2, Workshop x2, Showroom, Sales 3 = 7. N/A and Off Site excluded.
    expect(summary.occupiedSpaces).toBe(7);
    expect(summary.unmapped).toBe(3);
    expect(summary.offSiteRecorded).toBe(1);
    expect(summary.mapped).toBe(7);
  });
});

describe("filtering and search", () => {
  const valetCar = entry("Valet", { reg: "VA11 ETT" });
  const paintCar = entry("Paint", { reg: "PA11 NTT" });
  const offSiteCar = entry("Off Site", { reg: "OF11 SIT" });
  const entries = [valetCar, paintCar, offSiteCar];

  it("filters to one section, or all", () => {
    expect(filterEntriesForSection(entries, "paint")).toEqual([paintCar]);
    expect(filterEntriesForSection(entries, ALL_SECTIONS_ID)).toHaveLength(3);
    expect(filterEntriesForSection(entries, "valet", "nothing")).toEqual([]);
  });

  it("finds a car by reg (spaces ignored) and reports its section", () => {
    const [result] = searchVehicles(entries, "va11ett");
    expect(result.entry).toBe(valetCar);
    expect(result.section.label).toBe("Valet");
    expect(searchVehicles(entries, "OF11")[0].section.id).toBe("off-site");
  });

  it("returns nothing for an empty query", () => {
    expect(searchVehicles(entries, "  ")).toEqual([]);
  });
});

describe("selected-section state", () => {
  const reduce = (actions, state = INITIAL_SECTION_SELECTION) => actions.reduce(sectionSelectionReducer, state);

  it("selecting a label opens that section, for every new section", () => {
    for (const id of NEW_SECTION_IDS) {
      expect(reduce([{ type: "select", id }]).selectedId).toBe(id);
    }
  });

  it("selecting a logical section (N/A) or an off-map one (Sales 9) works too", () => {
    expect(reduce([{ type: "select", id: "na" }]).selectedId).toBe("na");
    expect(reduce([{ type: "select", id: "sales-9" }]).selectedId).toBe("sales-9");
  });

  it("All, an unknown id and clear all return to the overview", () => {
    const selected = reduce([{ type: "select", id: "paint" }]);
    expect(reduce([{ type: "select", id: ALL_SECTIONS_ID }], selected).selectedId).toBeNull();
    expect(reduce([{ type: "select", id: "bay-17" }], selected).selectedId).toBeNull();
    expect(reduce([{ type: "clear" }], selected).selectedId).toBeNull();
  });

  it("choosing a search result opens the vehicle's section and highlights it", () => {
    const state = reduce([{ type: "find", query: "VA11" }, { type: "choose-result", sectionId: "valet", key: "job:9" }]);
    expect(state).toEqual({ selectedId: "valet", highlightKey: "job:9", findQuery: "" });
  });

  it("Escape closes the search first, then the selection", () => {
    let state = reduce([{ type: "select", id: "workshop" }, { type: "find", query: "AB" }]);
    state = sectionSelectionReducer(state, { type: "escape" });
    expect(state).toMatchObject({ selectedId: "workshop", findQuery: "" });
    state = sectionSelectionReducer(state, { type: "escape" });
    expect(state.selectedId).toBeNull();
    expect(sectionSelectionReducer(state, { type: "escape" })).toBe(state);
  });

  it("a new selection clears the previous highlight", () => {
    const state = reduce([{ type: "choose-result", sectionId: "valet", key: "job:1" }, { type: "select", id: "paint" }]);
    expect(state.highlightKey).toBeNull();
  });
});

describe("moving a vehicle", () => {
  it("offers every canonical section except the current one, including the new ones", () => {
    const car = entry("Service");
    const labels = getMoveDestinations(car).map((s) => s.label);
    expect(labels).not.toContain("Service");
    for (const label of ["N/A", "Paint", "Valet", "Workshop", "Showroom", "Off Site", "Sales 10"]) {
      expect(labels).toContain(label);
    }
    expect(labels).toHaveLength(VEHICLE_LOCATION_LABELS.length - 1);
  });

  it("validates destinations against the canonical list", () => {
    const car = entry("Workshop");
    expect(isValidMoveDestination(car, "Valet")).toBe(true);
    expect(isValidMoveDestination(car, "Workshop")).toBe(false);
    expect(isValidMoveDestination(car, "Workshop bay 2")).toBe(false);
    expect(isValidMoveDestination(car, "Front Row – Bay A")).toBe(false);
  });

  it("describes a move with canonical names on both sides", () => {
    const car = entry("Wash bay", { reg: "ab12 cde" });
    const move = describeMove({ entry: car, toSection: TRACKING_SECTION_BY_ID.get("off-site") });
    expect(move).toEqual({ reg: "AB12 CDE", from: "Valet", to: "Off Site", destinationLocation: "Off Site" });
  });
});

describe("helpers kept from the previous model", () => {
  it("keys entries by job first", () => {
    expect(getEntryKey({ jobId: 4, reg: "X" })).toBe("job:4");
    expect(getEntryKey({ reg: " ab1 " })).toBe("reg:AB1");
  });

  it("derives a marker status from the tracker flags", () => {
    expect(getMarkerStatus({ isOverdue: true }).id).toBe("attention");
    expect(getMarkerStatus({}).id).toBe("occupied");
  });
});
