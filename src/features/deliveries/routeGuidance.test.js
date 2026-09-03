import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsRouteUrls,
  calculateRouteFinishTime,
  formatRouteDuration,
} from "./routeGuidance";

const delivery = (number) => ({
  addressLine: `${number} High Street`,
  postcodeValue: `ME1 ${number}AA`,
});

describe("delivery route guidance", () => {
  it("preserves stop order and requests motorway avoidance", () => {
    const [url] = buildGoogleMapsRouteUrls([delivery(1), delivery(2)], "ME20 6AA", true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("origin")).toBe("ME20 6AA");
    expect(parsed.searchParams.get("destination")).toBe("ME20 6AA");
    expect(parsed.searchParams.get("waypoints")).toBe(
      "1 High Street, ME1 1AA|2 High Street, ME1 2AA"
    );
    expect(parsed.searchParams.get("avoid")).toBe("highways");
  });

  it("splits routes that exceed the Google Maps waypoint limit", () => {
    expect(buildGoogleMapsRouteUrls(Array.from({ length: 12 }, (_, index) => delivery(index)), "ME20 6AA"))
      .toHaveLength(2);
  });

  it("calculates finish time from driving and stop time", () => {
    expect(calculateRouteFinishTime("08:30", 90, 4, 10)).toBe("10:40");
    expect(formatRouteDuration(90)).toBe("1h 30m");
  });
});
