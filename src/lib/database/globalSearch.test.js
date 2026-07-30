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

  it("expands a customer-name match into linked job-card results without duplicates", async () => {
    process.env.PLAYWRIGHT_TEST_AUTH = "1";
    const { getCustomerLinkedJobResults, getGlobalSearchMatchScore } = await import(
      "@/lib/database/globalSearch"
    );

    const linkedResults = getCustomerLinkedJobResults({
      term: "Darcy Vine",
      customers: [
        {
          id: "customer-1",
          firstname: "Darcy",
          lastname: "Vine",
        },
      ],
      jobs: [
        {
          id: 3969,
          customer_id: "customer-1",
          job_number: "03969",
          vehicle_reg: "YE10RUO",
          status: "New",
          created_at: "2026-07-30T10:00:00.000Z",
        },
        {
          id: 3970,
          customer_id: "customer-1",
          job_number: "03970",
          vehicle_reg: "YE10RUO",
          status: "New",
          created_at: "2026-07-29T10:00:00.000Z",
        },
      ],
      existingJobs: [
        {
          type: "job",
          id: 3970,
          jobNumber: "03970",
        },
      ],
    });

    expect(linkedResults).toHaveLength(1);
    expect(linkedResults[0]).toMatchObject({
      type: "job",
      jobNumber: "03969",
      title: "Job #03969",
      subtitle: "Darcy Vine - YE10RUO",
      customerName: "Darcy Vine",
    });
    expect(getGlobalSearchMatchScore(linkedResults[0], "Darcy Vine")).toBeGreaterThan(100);
  });
});
