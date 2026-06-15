// file location: src/lib/database/globalSearch.test.js
import { describe, expect, it } from "vitest";

describe("getGlobalSearchMatchScore", () => {
  it("ranks customer name matches above weak job description matches", async () => {
    process.env.PLAYWRIGHT_TEST_AUTH = "1";
    const { getGlobalSearchMatchScore } = await import("@/lib/database/globalSearch");

    const customerScore = getGlobalSearchMatchScore(
      {
        type: "customer",
        firstName: "Benjamin",
        lastName: "Clarke",
        title: "Benjamin Clarke",
      },
      "Ben"
    );
    const jobScore = getGlobalSearchMatchScore(
      {
        type: "job",
        jobNumber: "ENR01673",
        customerName: "Leo Harding",
        vehicleReg: "KM21OTB",
        description: "Customer says it has been making a noise.",
      },
      "Ben"
    );

    expect(customerScore).toBeGreaterThan(0);
    expect(jobScore).toBe(0);
    expect(customerScore).toBeGreaterThan(jobScore);
  });

  it("keeps strong job number and registration matches searchable", async () => {
    process.env.PLAYWRIGHT_TEST_AUTH = "1";
    const { getGlobalSearchMatchScore } = await import("@/lib/database/globalSearch");

    expect(
      getGlobalSearchMatchScore(
        {
          type: "job",
          jobNumber: "ENR01673",
          customerName: "Leo Harding",
          vehicleReg: "KM21OTB",
        },
        "ENR016"
      )
    ).toBeGreaterThan(100);

    expect(
      getGlobalSearchMatchScore(
        {
          type: "job",
          jobNumber: "ENR01673",
          customerName: "Leo Harding",
          vehicleReg: "KM21OTB",
        },
        "KM21"
      )
    ).toBeGreaterThan(100);
  });
});
