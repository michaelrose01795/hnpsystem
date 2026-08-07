import { describe, expect, it } from "vitest";
import { resolveStaffStyleReviewRoute } from "@/lib/staff-style-review/routeNavigation";

describe("resolveStaffStyleReviewRoute", () => {
  it("uses the first concrete audited route", () => {
    expect(resolveStaffStyleReviewRoute("/appointments and /jobs")).toBe("/appointments");
  });

  it("falls dynamic detail routes back to a valid parent route", () => {
    expect(resolveStaffStyleReviewRoute("/job-cards/[jobNumber] → VHC")).toBe("/job-cards");
    expect(resolveStaffStyleReviewRoute("/accounts/invoices/[invoiceId]")).toBe("/accounts/invoices");
    expect(resolveStaffStyleReviewRoute("/mobile/delivery/[jobNumber]")).toBe("/mobile/dashboard");
  });

  it("maps descriptive audit scopes to valid staff routes", () => {
    expect(resolveStaffStyleReviewRoute("Any staff route with the AI guide")).toBe("/newsfeed");
    expect(resolveStaffStyleReviewRoute("Shared topbar and confirmation flows")).toBe("/newsfeed");
    expect(resolveStaffStyleReviewRoute("Developer platform routes")).toBe("/dev");
    expect(resolveStaffStyleReviewRoute("Invoice consumers")).toBe("/accounts/invoices");
  });

  it("does not invent a route for dormant findings", () => {
    expect(resolveStaffStyleReviewRoute("Not currently mounted by a page")).toBeNull();
  });
});

