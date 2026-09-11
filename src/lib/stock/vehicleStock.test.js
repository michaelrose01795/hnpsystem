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
} from "./vehicleStock";

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
