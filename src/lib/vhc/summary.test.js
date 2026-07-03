// file location: src/lib/vhc/summary.test.js
import { describe, expect, it } from "vitest";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";

describe("summariseTechnicianVhc", () => {
  it("keeps brake measurements separate from concern rows", () => {
    const summary = summariseTechnicianVhc({
      brakesHubs: {
        frontPads: {
          measurement: "4",
          status: "Amber",
          concerns: [
            {
              text: "Number plate light inoperative",
              status: "Amber",
            },
          ],
        },
      },
    });

    const brakes = summary.sections.find((section) => section.key === "brakesHubs");

    expect(brakes?.items).toHaveLength(2);
    expect(brakes.items[0]).toMatchObject({
      heading: "Front Pads",
      measurement: "4mm",
      concerns: [],
    });
    expect(brakes.items[1]).toMatchObject({
      heading: "Number plate light inoperative",
    });
    expect(brakes.items[1]).not.toHaveProperty("measurement");
    expect(brakes.items[1].concerns).toEqual([
      { status: "Amber", text: "Number plate light inoperative" },
    ]);
  });

  it("shortens repeated service reminder choice labels", () => {
    const summary = summariseTechnicianVhc({
      serviceIndicator: {
        serviceChoice: "not_required",
      },
    });

    const serviceSection = summary.sections.find((section) => section.key === "serviceIndicator");

    expect(serviceSection?.items[0]?.heading).toBe("Service Reminder - Not Required");
  });

  it("shows spare or repair kit choice details", () => {
    const summary = summariseTechnicianVhc({
      wheelsTyres: {
        Spare: {
          type: "repair_kit",
          month: "7",
          year: "2026",
        },
      },
    });

    const wheels = summary.sections.find((section) => section.key === "wheelsTyres");
    const spare = wheels?.items.find((item) => item.heading === "Spare / Repair Kit");

    expect(spare?.rows).toEqual(["Type: Tyre Repair Kit", "Manufactured: 07/2026"]);
  });

  it("shows not checked spare choice even without extra notes", () => {
    const summary = summariseTechnicianVhc({
      wheelsTyres: {
        Spare: {
          type: "not_checked",
        },
      },
    });

    const wheels = summary.sections.find((section) => section.key === "wheelsTyres");
    const spare = wheels?.items.find((item) => item.heading === "Spare / Repair Kit");

    expect(spare?.rows).toEqual(["Type: Not Checked"]);
  });
});
