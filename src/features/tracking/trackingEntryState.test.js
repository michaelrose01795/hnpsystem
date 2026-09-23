// file location: src/features/tracking/trackingEntryState.test.js
// Regression tests for the Key/Parking summary. Each of these pins one of the
// three classification bugs that produced "384 active jobs / 384 cars off-site
// / 384 overdue movements / 64 customers waiting" from a 384-vehicle snapshot.

import { describe, expect, it } from "vitest";
import {
  getTrackerLocationFlags,
  getTrackerRiskScore,
  isCustomerWaiting,
  isDepartedEntry,
  summariseTrackerEntries,
} from "@/features/tracking/trackingEntryState";

const HOUR = 1000 * 60 * 60;
const hoursAgo = (n) => new Date(Date.now() - n * HOUR).toISOString();

const entry = (overrides = {}) => ({
  jobId: 1,
  reg: "AB12 CDE",
  status: "In Workshop",
  jobStatus: "In Progress",
  vehicleLocation: "Workshop bay 1",
  keyLocation: "Keys moved - Workshop board",
  updatedAt: hoursAgo(1),
  ...overrides,
});

describe("off-site classification", () => {
  // The old rule decided "on site" from an exact-match allow-list of location
  // strings: ["n/a","na","service","workshop","in workshop","ready for
  // release"]. The database stores "Service car park", "Workshop bay 1", "MOT
  // bay", "Wash bay" and "Collection row", so every on-site vehicle was
  // counted as off-site.
  const REAL_ON_SITE_LOCATIONS = [
    "Service car park",
    "Workshop bay 1",
    "MOT bay",
    "Wash bay",
    "Collection row",
  ];

  it("counts a vehicle at a real on-site location as on site", () => {
    for (const vehicleLocation of REAL_ON_SITE_LOCATIONS) {
      const flags = getTrackerLocationFlags(entry({ vehicleLocation }));
      expect(flags.isOnSite, vehicleLocation).toBe(true);
      expect(flags.isDeparted, vehicleLocation).toBe(false);
    }
    const summary = summariseTrackerEntries(
      REAL_ON_SITE_LOCATIONS.map((vehicleLocation, index) => entry({ jobId: index + 1, vehicleLocation }))
    );
    expect(summary.offSite).toBe(0);
    expect(summary.activeTracked).toBe(REAL_ON_SITE_LOCATIONS.length);
  });

  it("counts collected, invoiced and archived vehicles as off site", () => {
    expect(isDepartedEntry(entry({ status: "Customer Collected" }))).toBe(true);
    expect(isDepartedEntry(entry({ jobStatus: "Invoiced" }))).toBe(true);
    expect(isDepartedEntry(entry({ jobStatus: "Archived" }))).toBe(true);
    expect(isDepartedEntry(entry())).toBe(false);
  });
});

describe("overdue classification", () => {
  // The old rule was "newest event older than 4 hours", full stop. Completed
  // and collected vehicles never move again, so every historical record aged
  // into overdue and stayed there for ever.
  it("flags a live job whose vehicle has not moved", () => {
    expect(getTrackerLocationFlags(entry({ updatedAt: hoursAgo(9) })).isOverdue).toBe(true);
  });

  it("does not flag a finished job, however old its last movement", () => {
    for (const jobStatus of ["Complete", "Invoiced", "Archived", "Released"]) {
      const flags = getTrackerLocationFlags(entry({ jobStatus, updatedAt: hoursAgo(24 * 120) }));
      expect(flags.isOverdue, jobStatus).toBe(false);
    }
  });

  it("does not flag a collected vehicle", () => {
    const flags = getTrackerLocationFlags(
      entry({ status: "Customer Collected", jobStatus: "In Progress", updatedAt: hoursAgo(500) })
    );
    expect(flags.isOverdue).toBe(false);
  });

  it("does not flag a live job that moved recently", () => {
    expect(getTrackerLocationFlags(entry({ updatedAt: hoursAgo(1) })).isOverdue).toBe(false);
  });
});

describe("customer-waiting classification", () => {
  // The old rule was status.includes("waiting"). "Awaiting Workshop" contains
  // "waiting", which is where all 64 phantom waiters came from.
  it("does not treat 'Awaiting Workshop' as a customer waiting", () => {
    expect(isCustomerWaiting(entry({ status: "Awaiting Workshop" }))).toBe(false);
    expect(summariseTrackerEntries([entry({ status: "Awaiting Workshop" })]).customerWaiting).toBe(0);
  });

  it("does not treat 'Waiting For Collection' as a customer waiting", () => {
    expect(isCustomerWaiting(entry({ status: "Waiting For Collection" }))).toBe(false);
  });

  it("does treat a genuine waiter as one", () => {
    expect(isCustomerWaiting(entry({ status: "Customer Waiting" }))).toBe(true);
    expect(isCustomerWaiting(entry({ serviceType: "Waiter" }))).toBe(true);
    expect(isCustomerWaiting(entry({ customerWaiting: true }))).toBe(true);
  });
});

describe("summariseTrackerEntries", () => {
  it("reproduces the corrected figures for a mixed fleet", () => {
    const entries = [
      // on site, live, stale -> overdue
      entry({ jobId: 1, updatedAt: hoursAgo(30) }),
      // on site, live, fresh
      entry({ jobId: 2, updatedAt: hoursAgo(1) }),
      // on site, finished job -> not overdue
      entry({ jobId: 3, jobStatus: "Complete", updatedAt: hoursAgo(900) }),
      // gone
      entry({ jobId: 4, status: "Customer Collected" }),
      entry({ jobId: 5, jobStatus: "Archived" }),
      // phantom waiter under the old rule
      entry({ jobId: 6, status: "Awaiting Workshop" }),
    ];
    const summary = summariseTrackerEntries(entries, {
      mapped: 1,
      unmapped: 3,
      totalSpaces: 100,
      occupiedSpaces: 1,
    });
    expect(summary.activeTracked).toBe(4);
    expect(summary.offSite).toBe(2);
    expect(summary.overdue).toBe(1);
    expect(summary.customerWaiting).toBe(0);
    expect(summary.onSiteMapped).toBe(1);
    expect(summary.onSiteUnmapped).toBe(3);
    expect(summary.occupiedSpaces).toBe(1);
    expect(summary.availableSpaces).toBe(99);
  });

  it("never reports more off-site vehicles than it has records", () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      entry({ jobId: index + 1, vehicleLocation: "Service car park" })
    );
    const summary = summariseTrackerEntries(entries);
    expect(summary.activeTracked + summary.offSite).toBe(entries.length);
    expect(summary.overdue).toBeLessThanOrEqual(entries.length);
    expect(summary.customerWaiting).toBeLessThanOrEqual(entries.length);
  });
});

describe("getTrackerRiskScore", () => {
  it("never sorts a departed vehicle to the top of the list", () => {
    const gone = getTrackerRiskScore(entry({ status: "Customer Collected", updatedAt: hoursAgo(900) }));
    const live = getTrackerRiskScore(entry({ updatedAt: hoursAgo(9) }));
    expect(gone).toBeLessThan(live);
  });
});
