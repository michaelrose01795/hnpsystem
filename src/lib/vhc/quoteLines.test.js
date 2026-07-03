// file location: src/lib/vhc/quoteLines.test.js
import { describe, expect, it } from "vitest";
import { buildVhcQuoteLinesModel } from "@/lib/vhc/quoteLines";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";

describe("buildVhcQuoteLinesModel", () => {
  it("does not render non-brake issue rows with inherited brake measurements", () => {
    const vhcData = {
      brakesHubs: {
        frontPads: {
          measurement: "4",
          status: "Amber",
        },
      },
    };
    const sections = summariseTechnicianVhc(vhcData).sections;

    const model = buildVhcQuoteLinesModel({
      sections,
      vhcChecksData: [
        {
          vhc_id: 101,
          section: "Brakes & Hubs",
          issue_title: "Number plate light inoperative",
          issue_description: "Number plate light inoperative",
          customer_description: "Number plate light inoperative",
          measurement: "4mm",
          severity: "amber",
          approval_status: "pending",
        },
      ],
      mode: "withPlaceholders",
    });

    const amberLabels = model.severityLists.amber.map((item) => item.label);
    const brakeMeasurement = model.severityLists.amber.find((item) => item.label === "Front Pads");
    const numberPlateIssue = model.severityLists.amber.find(
      (item) => item.label === "Number plate light inoperative"
    );

    expect(amberLabels).toEqual(["Front Pads", "Number plate light inoperative"]);
    expect(brakeMeasurement).toMatchObject({
      categoryLabel: "Brakes & Hubs",
      measurement: "4mm",
    });
    expect(numberPlateIssue).toMatchObject({
      categoryLabel: "External",
      concernText: "Number plate light inoperative",
      measurement: "",
    });
  });

  it("keeps full tyre detail on wheel rows for customer-facing lists", () => {
    const vhcData = {
      wheelsTyres: {
        NSR: {
          manufacturer: "Michelin",
          model: "Primacy 4",
          size: "205/55 R16",
          load: "91",
          speed: "V",
          runFlat: false,
          tread: { outer: "4", middle: "5", inner: "4" },
          concerns: [{ status: "Amber", text: "NSR tyre tread low" }],
        },
      },
    };
    const sections = summariseTechnicianVhc(vhcData).sections;

    const model = buildVhcQuoteLinesModel({
      job: { checksheet: vhcData },
      sections,
      mode: "withPlaceholders",
    });

    const nsrWheel = model.severityLists.amber.find((item) => item.label === "NSR Wheel");

    expect(nsrWheel).toMatchObject({
      tyreWheelKey: "NSR",
      tyreMake: "Michelin",
      tyreModel: "Primacy 4",
      tyreSize: "205/55 R16 / Load 91 / Speed V",
      tyreMeasurement: "Outer 4mm / Middle 5mm / Inner 4mm",
    });
    expect(nsrWheel.tyreDetailRows).toEqual([
      "Make: Michelin",
      "Model: Primacy 4",
      "Size: 205/55 R16 / Load 91 / Speed V",
      "Measurements: Outer 4mm / Middle 5mm / Inner 4mm",
      "Run Flat: No",
    ]);
  });

  it("does not duplicate an authorised row in its original red or amber bucket when the stored section is inferred differently", () => {
    const vhcData = {
      externalInspection: {
        numberPlateLight: {
          status: "Red",
          heading: "Number plate light inoperative",
          concerns: [{ status: "Red", text: "Number plate light inoperative" }],
        },
      },
    };
    const sections = summariseTechnicianVhc(vhcData).sections;

    const model = buildVhcQuoteLinesModel({
      sections,
      vhcChecksData: [
        {
          vhc_id: 308,
          section: "Brakes & Hubs",
          issue_title: "Number plate light inoperative",
          issue_description: "Number plate light inoperative",
          customer_description: "Number plate light inoperative",
          severity: "red",
          approval_status: "authorized",
          authorization_state: "authorized",
          display_status: "authorized",
          parts_cost: 113,
          labour_hours: 0.7,
          slot_code: 42,
          line_key: "legacy-number-plate-light",
        },
      ],
      authorizedViewRows: [{ vhc_item_id: 308 }],
      labourRate: 85,
      mode: "withPlaceholders",
    });

    expect(model.severityLists.red.map((item) => item.label)).toEqual([]);
    expect(model.severityLists.authorized.map((item) => item.label)).toEqual([
      "Number plate light inoperative",
    ]);
    expect(model.items.filter((item) => item.label === "Number plate light inoperative")).toHaveLength(1);
    expect(model.severityLists.authorized[0]).toMatchObject({
      id: "308",
      categoryLabel: "External",
      parts_gbp: 113,
      labour_hours: 0.7,
      total_gbp: 172.5,
    });
  });

  it("collapses a pending row and its authorised duplicate into a single authorised item", () => {
    // Mirrors job 00076: an enrichment/seed script inserted a second vhc_checks row
    // for an already-reported concern. The rows share section/title/description but
    // carry different slot_code + line_key, so the primary dedupe cannot merge them.
    // The pending original must not linger in "Red Repairs" once the duplicate is authorised.
    const vhcData = {
      externalInspection: {
        numberPlateLight: {
          status: "Red",
          heading: "Number plate light inoperative",
          concerns: [{ status: "Red", text: "Number plate light inoperative" }],
        },
      },
    };
    const sections = summariseTechnicianVhc(vhcData).sections;

    const sharedFields = {
      section: "Brakes",
      issue_title: "Number plate light inoperative",
      issue_description: "Recommendation recorded during vehicle health check.",
      customer_description: "Number plate light inoperative",
      severity: "red",
      parts_cost: 113,
      labour_hours: 0.7,
      total_override: 308,
    };

    const model = buildVhcQuoteLinesModel({
      sections,
      vhcChecksData: [
        {
          ...sharedFields,
          vhc_id: 306,
          approval_status: "pending",
          authorization_state: "n/a",
          display_status: "red",
          display_id: "VHC-00016",
          slot_code: 15,
          line_key: "76-15-red",
        },
        {
          ...sharedFields,
          vhc_id: 1304,
          approval_status: "authorized",
          authorization_state: "authorized",
          display_status: "authorized",
          display_id: "VHC-01066",
          slot_code: 65,
          line_key: "hnp_enrichment_20260609-76-1065-red",
        },
      ],
      authorizedViewRows: [{ vhc_item_id: 1304 }],
      labourRate: 85,
      mode: "withPlaceholders",
    });

    expect(model.severityLists.red.map((item) => item.label)).toEqual([]);
    expect(model.severityLists.authorized.map((item) => item.label)).toEqual([
      "Number plate light inoperative",
    ]);
    expect(
      model.items.filter((item) => item.label === "Number plate light inoperative")
    ).toHaveLength(1);
    expect(model.severityLists.authorized[0]).toMatchObject({
      id: "1304",
      categoryLabel: "External",
      parts_gbp: 113,
      labour_hours: 0.7,
      total_gbp: 308,
    });
    expect(model.totals.red).toBe(308);
  });
});
