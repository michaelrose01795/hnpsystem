// file location: src/lib/stock/vehicleStock.test.js
// The stock-number guard is the one piece of this feature that fails silently
// if it regresses: a reused number does not crash, it just serves one car's
// history under another car's advert. These tests pin it down.

import { describe, it, expect } from "vitest";

import { createStockNumberIssuer, parseStockNumber, isStockNumber } from "./stockNumber";
import {
  stockVehicles,
  retiredStockVehicles,
  listStock,
  getStockByReg,
  wasPreviouslyInStock,
  filterStock,
  sortStock,
  regToSlug,
  stockHref,
  stockFacets,
  stockBadges,
  isElectrified,
} from "./vehicleStock";

describe("customer search filters", () => {
  const stock = listStock();

  it("filters by manufacturer and narrows the model facet to it", () => {
    expect(filterStock(stock, { make: "Suzuki" })).toHaveLength(stock.length);
    expect(filterStock(stock, { make: "Nobody" })).toHaveLength(0);
    expect(stockFacets(stock, { make: "Nobody" }).models).toEqual([]);
  });

  it("filters by monthly payment band", () => {
    const cheap = filterStock(stock, { monthlyBand: "0-200" });
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((v) => v.monthly <= 200)).toBe(true);
  });

  it("applies the electric / hybrid, automatic and photos-only toggles", () => {
    expect(filterStock(stock, { electrified: true }).every(isElectrified)).toBe(true);
    expect(filterStock(stock, { electrified: true }).some((v) => v.fuel === "Petrol")).toBe(false);
    expect(filterStock(stock, { automatic: true }).every((v) => v.transmission === "Automatic")).toBe(true);
    expect(filterStock([{ ...stock[0], images: [] }], { photosOnly: true })).toHaveLength(0);
  });

  it("sorts by monthly payment, lowest first", () => {
    const sorted = sortStock(stock, "monthly-asc");
    expect(sorted[0].monthly).toBe(Math.min(...stock.map((v) => v.monthly)));
  });
});

describe("listing badges", () => {
  const base = { condition: "used", mileage: 40000, fuel: "Petrol", stockedAt: "2026-01-01", badge: null };
  const now = Date.parse("2026-09-14");

  it("derives Electric, New arrival and Low mileage", () => {
    expect(stockBadges({ ...base, fuel: "Electric" }, { now })).toEqual(["Electric"]);
    expect(stockBadges({ ...base, stockedAt: "2026-09-10" }, { now })).toEqual(["New arrival"]);
    expect(stockBadges({ ...base, mileage: 9000 }, { now })).toEqual(["Low mileage"]);
  });

  it("leads with the sales badge, de-duplicates and caps the list", () => {
    const car = { ...base, badge: "Low mileage", mileage: 9000, fuel: "Electric", stockedAt: "2026-09-10" };
    expect(stockBadges(car, { now })).toEqual(["Low mileage", "Electric"]);
    expect(stockBadges({ ...base, badge: "Ex-demonstrator" }, { now })).toEqual(["Ex-demonstrator"]);
  });
});

describe("stock number issuing", () => {
  it("never reuses a number that retired stock still holds", () => {
    const issuer = createStockNumberIssuer(["U-24-0087", "N-22-0044"]);
    const issued = Array.from({ length: 20 }, () =>
      issuer.issue({ condition: "used", stockedAt: "2026-01-01" }),
    );
    expect(issued).not.toContain("U-24-0087");
    expect(issued).not.toContain("N-22-0044");
    expect(new Set(issued).size).toBe(issued.length);
  });

  it("carries on past the highest number ever spent, not the highest live one", () => {
    const issuer = createStockNumberIssuer(["U-24-0087"]);
    expect(parseStockNumber(issuer.issue({ condition: "used", stockedAt: "2026-01-01" })).sequence).toBe(88);
  });

  it("gives the same registration a fresh number each time it re-enters stock", () => {
    const issuer = createStockNumberIssuer([]);
    const firstVisit = issuer.issue({ condition: "new", stockedAt: "2022-03-04" });
    const secondVisit = issuer.issue({ condition: "used", stockedAt: "2026-06-30" });
    expect(firstVisit).not.toBe(secondVisit);
    expect(parseStockNumber(firstVisit).condition).toBe("new");
    expect(parseStockNumber(secondVisit).condition).toBe("used");
  });

  it("stamps the condition and the year the car was taken into stock", () => {
    const issuer = createStockNumberIssuer([]);
    expect(issuer.issue({ condition: "new", stockedAt: "2026-08-14" })).toBe("N-26-0001");
    expect(issuer.issue({ condition: "used", stockedAt: "2025-01-02" })).toBe("U-25-0002");
  });

  it("rejects anything that is not a stock number", () => {
    expect(isStockNumber("N-26-0001")).toBe(true);
    expect(isStockNumber("SF23 XKD")).toBe(false);
    expect(parseStockNumber("nonsense")).toBeNull();
  });
});

describe("live stock", () => {
  it("gives every car a unique stock number, retired stock included", () => {
    const all = [...stockVehicles, ...retiredStockVehicles].map((v) => v.stockNumber);
    expect(new Set(all).size).toBe(all.length);
  });

  it("resolves a reg that has been through the forecourt twice to the current listing only", () => {
    // Both plates appear in retired stock as well — see RETIRED_STOCK.
    const repeated = retiredStockVehicles.map((v) => v.reg);
    expect(repeated.length).toBeGreaterThan(0);
    repeated.forEach((reg) => {
      const current = getStockByReg(reg);
      expect(current).not.toBeNull();
      const retiredNumbers = retiredStockVehicles
        .filter((v) => v.reg === reg)
        .map((v) => v.stockNumber);
      expect(retiredNumbers).not.toContain(current.stockNumber);
    });
  });

  it("matches a reg regardless of spacing or case", () => {
    const target = listStock()[0];
    expect(getStockByReg(target.reg.toLowerCase().replace(/\s/g, ""))?.stockNumber).toBe(
      target.stockNumber,
    );
  });

  it("returns nothing for an unknown reg, and does not claim it was ours", () => {
    expect(getStockByReg("ZZ99 ZZZ")).toBeNull();
    expect(wasPreviouslyInStock("ZZ99 ZZZ")).toBe(false);
  });

  it("builds a stock URL from the reg slug", () => {
    expect(regToSlug("SF23 XKD")).toBe("sf23xkd");
    expect(stockHref({ reg: "SF23 XKD" })).toBe("/website/stock/sf23xkd");
  });
});

describe("search", () => {
  it("treats an empty or 'all' condition as no condition filter", () => {
    const all = listStock();
    expect(filterStock(all, { condition: "all" })).toHaveLength(all.length);
    expect(filterStock(all, {})).toHaveLength(all.length);
  });

  it("filters by condition, price band and free text together", () => {
    const used = filterStock(listStock(), { condition: "used", priceBand: "0-15000" });
    expect(used.length).toBeGreaterThan(0);
    used.forEach((v) => {
      expect(v.condition).toBe("used");
      expect(v.price).toBeLessThanOrEqual(15000);
    });
  });

  it("matches free text across model, colour and registration", () => {
    const target = listStock()[0];
    expect(filterStock(listStock(), { query: target.reg }).map((v) => v.stockNumber)).toContain(
      target.stockNumber,
    );
    expect(filterStock(listStock(), { query: "definitelynotacar" })).toHaveLength(0);
  });

  it("sorts by price in both directions without mutating the source list", () => {
    const source = listStock();
    const snapshot = source.map((v) => v.stockNumber);
    const asc = sortStock(source, "price-asc").map((v) => v.price);
    const desc = sortStock(source, "price-desc").map((v) => v.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(source.map((v) => v.stockNumber)).toEqual(snapshot);
  });
});
