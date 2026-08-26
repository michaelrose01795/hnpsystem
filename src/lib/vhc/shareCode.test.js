// file location: src/lib/vhc/shareCode.test.js
import { describe, expect, it } from "vitest";
import {
  generateShareCode,
  normaliseShareCode,
  buildCustomerReportUrl,
  SHARE_CODE_LENGTH,
} from "./shareCode";

const UNAMBIGUOUS = /^[0-9A-HJ-NP-TV-Z]+$/;

describe("generateShareCode", () => {
  it("produces a code of the expected length", () => {
    expect(generateShareCode()).toHaveLength(SHARE_CODE_LENGTH);
    expect(generateShareCode(12)).toHaveLength(12);
  });

  it("never emits a confusable character", () => {
    // The whole point of the alphabet: a code has to survive being read out
    // over the phone and typed back in.
    for (let i = 0; i < 200; i += 1) {
      const code = generateShareCode();
      expect(code).toMatch(UNAMBIGUOUS);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it("does not collide across a realistic batch", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateShareCode()));
    expect(codes.size).toBe(500);
  });
});

describe("normaliseShareCode", () => {
  it("passes a well-formed code through untouched", () => {
    const code = generateShareCode();
    expect(normaliseShareCode(code)).toBe(code);
  });

  it("folds the characters a customer is likely to mistype", () => {
    // Typed lowercase, with O for 0 and I/l for 1, and a stray space.
    expect(normaliseShareCode("k7rm 4xq0")).toBe("K7RM4XQ0");
    expect(normaliseShareCode("KIRM4XQO")).toBe("K1RM4XQ0");
    expect(normaliseShareCode("klrm4xqo")).toBe("K1RM4XQ0");
  });

  it("leaves a legacy base64url link code alone", () => {
    // These are case- and character-sensitive, and 12 chars rather than 8, so
    // they must not be folded — links already in customers' hands still resolve.
    const legacy = "Rdpgb1i-2Q0O";
    expect(normaliseShareCode(legacy)).toBe(legacy);
  });

  it("returns an empty string for nothing", () => {
    expect(normaliseShareCode("")).toBe("");
    expect(normaliseShareCode(null)).toBe("");
    expect(normaliseShareCode(undefined)).toBe("");
  });
});

describe("buildCustomerReportUrl", () => {
  it("builds a two-segment relative path", () => {
    expect(buildCustomerReportUrl("K7RM4XQP")).toBe("/report/K7RM4XQP");
  });

  it("joins onto an origin without doubling the slash", () => {
    expect(buildCustomerReportUrl("K7RM4XQP", "https://example.com/")).toBe(
      "https://example.com/report/K7RM4XQP"
    );
  });
});
