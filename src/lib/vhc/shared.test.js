import { describe, expect, it } from "vitest";
import {
  parseVhcTotalOverrideInput,
  resolveVhcTotal,
} from "@/lib/vhc/shared";

describe("VHC total override helpers", () => {
  it("treats a cleared value as an explicit database null", () => {
    expect(parseVhcTotalOverrideInput(null)).toEqual({
      provided: true,
      valid: true,
      value: null,
    });
    expect(parseVhcTotalOverrideInput("")).toEqual({
      provided: true,
      valid: true,
      value: null,
    });
  });

  it("falls back to parts plus labour without an override", () => {
    expect(resolveVhcTotal({ partsCost: 109.98, labourCost: 170, totalOverride: null })).toEqual({
      calculatedTotal: 279.98,
      hasManualOverride: false,
      manualOverride: null,
      total: 279.98,
    });
  });

  it("uses and identifies a manual override, including zero", () => {
    expect(resolveVhcTotal({ partsCost: 109.98, labourCost: 170, totalOverride: 170 })).toMatchObject({
      hasManualOverride: true,
      manualOverride: 170,
      total: 170,
    });
    expect(resolveVhcTotal({ partsCost: 109.98, labourCost: 170, totalOverride: 0 })).toMatchObject({
      hasManualOverride: true,
      manualOverride: 0,
      total: 0,
    });
  });
});
