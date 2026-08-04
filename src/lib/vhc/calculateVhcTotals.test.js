import { describe, expect, it } from "vitest";
import { calculateVhcFinancialTotals } from "@/lib/vhc/calculateVhcTotals";

const buildChecks = (totalOverride) => {
  const vhcData = {
    externalInspection: {
      numberPlateLight: {
        vhc_id: 101,
        status: "Red",
        heading: "Number plate light inoperative",
        concerns: [{ status: "Red", text: "Number plate light inoperative" }],
      },
    },
  };

  return [
    {
      vhc_id: 100,
      section: "VHC_CHECKSHEET",
      issue_description: JSON.stringify(vhcData),
      authorized_total_gbp: 0,
      declined_total_gbp: 0,
    },
    {
      vhc_id: 101,
      section: "External",
      issue_title: "Number plate light inoperative",
      severity: "red",
      display_status: "authorized",
      approval_status: "authorized",
      authorization_state: "authorized",
      parts_cost: 100,
      labour_hours: 1,
      total_override: totalOverride,
    },
  ];
};

describe("calculateVhcFinancialTotals", () => {
  it("calculates parts plus labour when the override is cleared", () => {
    expect(calculateVhcFinancialTotals(buildChecks(null), [], { forceRecalculate: true })).toEqual({
      authorized: 185,
      declined: 0,
    });
  });

  it("uses the manual total while an override is present", () => {
    expect(calculateVhcFinancialTotals(buildChecks(50), [], { forceRecalculate: true })).toEqual({
      authorized: 50,
      declined: 0,
    });
  });
});
