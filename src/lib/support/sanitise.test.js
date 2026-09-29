// file location: src/lib/support/sanitise.test.js
import { describe, expect, it } from "vitest";
import {
  scrubString,
  sanitiseValue,
  sanitiseDiagnostics,
  isWithinSizeCap,
  jsonByteSize,
  REDACTED,
  MAX_DIAGNOSTICS_BYTES,
} from "@/lib/support/sanitise";

describe("scrubString", () => {
  it("redacts JWT-shaped tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N";
    expect(scrubString(`token=${jwt} rest`)).not.toContain(jwt);
    expect(scrubString(`raw ${jwt}`)).toContain("[REDACTED:JWT]");
  });

  it("redacts bearer headers", () => {
    expect(scrubString("Authorization: Bearer abc.def-123")).toContain(
      "[REDACTED:BEARER]"
    );
  });

  it("redacts prefixed secret keys and service_role", () => {
    expect(scrubString("key sk_live_abcdef123456")).toContain("[REDACTED:KEY]");
    expect(scrubString("using service_role_key here")).toContain("[REDACTED:KEY]");
  });

  it("masks emails", () => {
    expect(scrubString("contact david@example.co.uk now")).toBe(
      "contact d***@example.co.uk now"
    );
  });

  it("redacts UK NI numbers", () => {
    // QQ is not a valid NINO prefix (Q is excluded by design); use a real-format one.
    expect(scrubString("NINO AB123456C")).toContain("[REDACTED:NINO]");
  });

  it("redacts card-number-like digit runs", () => {
    expect(scrubString("card 4111 1111 1111 1111")).toContain("[REDACTED:CARD]");
  });

  it("strips secret query-string params but keeps the URL shape", () => {
    const out = scrubString("/api/x?token=supersecret&tab=requests");
    expect(out).toContain(`token=${REDACTED}`);
    expect(out).toContain("tab=requests");
    expect(out).not.toContain("supersecret");
  });

  it("leaves benign strings untouched", () => {
    expect(scrubString("/job-cards/00076")).toBe("/job-cards/00076");
  });
});

describe("sanitiseValue", () => {
  it("redacts secret-named keys regardless of value", () => {
    const out = sanitiseValue({
      password: "hunter2",
      access_token: "abc",
      "x-api-key": "xyz",
      authorization: "Bearer foo",
      route: "/safe",
    });
    expect(out.password).toBe(REDACTED);
    expect(out.access_token).toBe(REDACTED);
    expect(out["x-api-key"]).toBe(REDACTED);
    expect(out.authorization).toBe(REDACTED);
    expect(out.route).toBe("/safe");
  });

  it("recurses into nested arrays and objects", () => {
    const jwt = "eyJa.eyJb.cccc";
    const out = sanitiseValue({
      console_errors: [{ msg: `failed ${jwt}`, level: "error" }],
    });
    expect(out.console_errors[0].msg).toContain("[REDACTED:JWT]");
    expect(out.console_errors[0].level).toBe("error");
  });

  it("drops functions / undefined", () => {
    const out = sanitiseValue({ fn: () => 1, keep: 2 });
    expect(out.fn).toBeUndefined();
    expect(out.keep).toBe(2);
  });
});

describe("sanitiseDiagnostics", () => {
  it("returns a JSON-serialisable object with all secrets scrubbed", () => {
    const dirty = {
      route: { asPath: "/job-cards/00076?token=leakme&tab=x" },
      session: { authorization: "Bearer xyz", roles: ["service manager"] },
      console_errors: [
        { msg: "boom eyJa.eyJb.cccc", stack: "at f (sk_live_aaaaaaaa)" },
      ],
      fn: () => {},
    };
    const clean = sanitiseDiagnostics(dirty);
    const json = JSON.stringify(clean);
    expect(json).not.toContain("leakme");
    expect(json).not.toContain("Bearer xyz");
    expect(json).not.toContain("eyJa.eyJb.cccc");
    expect(json).not.toContain("sk_live_aaaaaaaa");
    expect(clean.session.roles).toEqual(["service manager"]);
    expect("fn" in clean).toBe(false);
  });

  it("handles non-object input gracefully", () => {
    expect(sanitiseDiagnostics(null)).toEqual({});
    expect(sanitiseDiagnostics("nope")).toEqual({});
  });
});

describe("size cap", () => {
  it("accepts a small bundle", () => {
    expect(isWithinSizeCap({ a: 1 })).toBe(true);
  });

  it("rejects a bundle over the cap", () => {
    const big = { blob: "x".repeat(MAX_DIAGNOSTICS_BYTES + 10) };
    expect(jsonByteSize(big)).toBeGreaterThan(MAX_DIAGNOSTICS_BYTES);
    expect(isWithinSizeCap(big)).toBe(false);
  });
});

describe("credential redaction in free text", () => {
  it.each([
    ["my password is Hunter2!", "Hunter2!", "password is [REDACTED:CREDENTIAL]"],
    ["pwd: abc123", "abc123", "pwd: [REDACTED:CREDENTIAL]"],
    ["api key = AKX99xyz", "AKX99xyz", "api key = [REDACTED:CREDENTIAL]"],
    ["see https://admin:s3cret@db.example.com/x", "s3cret", "https://[REDACTED:CREDENTIALS]@db.example.com"],
    ["Cookie: next-auth.session-token=abcdef123; path=/", "abcdef123", "[REDACTED:COOKIE]"],
    ["Authorization: Basic YWRtaW46cGFzc3dvcmQ=", "YWRtaW46cGFzc3dvcmQ=", "[REDACTED:BASIC]"],
    ["token ghp_abcdefghijklmnopqrstuvwxyz123456", "ghp_abcdefghij", "[REDACTED:KEY]"],
  ])("redacts %s", (input, secret, expected) => {
    const out = scrubString(input);
    expect(out).not.toContain(secret);
    expect(out).toContain(expected);
  });

  it("leaves ordinary text and reference codes alone", () => {
    const text = "The Save button on job ERR-K3F9Q2 does nothing. Token of thanks!";
    expect(scrubString(text)).toBe(text);
  });

  it("does not double-redact an already-redacted value", () => {
    expect(scrubString("token: [REDACTED]")).toBe("token: [REDACTED]");
  });
});
