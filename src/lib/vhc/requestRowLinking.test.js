import { describe, expect, it } from "vitest";
import { buildVhcRequestLinkRows } from "@/lib/vhc/requestRowLinking";

describe("buildVhcRequestLinkRows authorisation boundary", () => {
  it("does not treat a completion flag as customer authorisation", () => {
    const rows = buildVhcRequestLinkRows({
      vhcChecks: [{
        vhc_id: 1804,
        section: "Wheels & Tyres",
        issue_title: "NSF Wheel",
        approval_status: "n/a",
        authorization_state: "n/a",
        Complete: true,
      }],
    });

    expect(rows).toEqual([]);
  });

  it("includes an explicitly authorised VHC row", () => {
    const rows = buildVhcRequestLinkRows({
      vhcChecks: [{
        vhc_id: 2001,
        section: "Brakes & Hubs",
        issue_title: "Rear pads",
        approval_status: "authorized",
        authorization_state: "authorized",
        Complete: false,
      }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      vhcItemId: 2001,
      approvalStatus: "authorized",
    });
  });
});
