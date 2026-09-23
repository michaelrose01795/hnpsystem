// Tests for buildErrorEventRow — the pure row builder behind automatic error
// capture. The Supabase-touching helpers are not exercised here (no client in
// the node test environment); what matters and is testable is that an untrusted
// client payload is scrubbed, clamped and shaped correctly before insert.

import { describe, it, expect } from "vitest";
import { buildErrorEventRow } from "@/lib/database/supportErrorEvents";


describe("buildErrorEventRow", () => {
  it("defaults an unknown kind to runtime rather than failing the CHECK constraint", () => {
    expect(buildErrorEventRow({ kind: "not-a-kind" }).kind).toBe("runtime");
    expect(buildErrorEventRow({}).kind).toBe("runtime");
  });

  it("keeps a valid kind", () => {
    expect(buildErrorEventRow({ kind: "render" }).kind).toBe("render");
  });

  it("clamps an oversized message to the column cap", () => {
    const row = buildErrorEventRow({ message: "x".repeat(5000) });
    expect(row.message).toHaveLength(2000);
  });

  it("clamps an oversized stack to the column cap", () => {
    const row = buildErrorEventRow({ stack: "y".repeat(20000) });
    expect(row.stack).toHaveLength(8000);
  });

  it("scrubs secrets out of the message before it is ever stored", () => {
    const row = buildErrorEventRow({
      message: "failed with token=service_role_abcdef1234567890",
    });
    expect(row.message).not.toContain("service_role_abcdef1234567890");
    // scrubString tags the kind of secret it found, e.g. "[REDACTED:KEY]".
    expect(row.message).toContain("REDACTED");
  });

  it("normalises empty strings to null so the column stays clean", () => {
    const row = buildErrorEventRow({ referenceCode: "", route: "", component: "" });
    expect(row.reference_code).toBeNull();
    expect(row.route).toBeNull();
    expect(row.component).toBeNull();
  });

  it("only accepts an integer user id and status code", () => {
    const row = buildErrorEventRow({ userId: "17", statusCode: "500" });
    expect(row.user_id).toBeNull();
    expect(row.status_code).toBeNull();

    const ok = buildErrorEventRow({ userId: 17, statusCode: 500 });
    expect(ok.user_id).toBe(17);
    expect(ok.status_code).toBe(500);
  });

  it("stores roles as an array, or null when there are none", () => {
    expect(buildErrorEventRow({ roles: ["admin", "dev"] }).roles).toEqual(["admin", "dev"]);
    expect(buildErrorEventRow({ roles: [] }).roles).toBeNull();
    expect(buildErrorEventRow({ roles: "admin" }).roles).toBeNull();
  });

  it("always produces jsonb-safe objects for device and context", () => {
    const row = buildErrorEventRow({});
    expect(row.device).toEqual({});
    expect(row.context).toEqual({});
  });

  it("sanitises nested context values, not just top-level strings", () => {
    const row = buildErrorEventRow({
      context: { nested: { authorization: "Bearer abcdef1234567890abcdef" } },
    });
    expect(JSON.stringify(row.context)).not.toContain("abcdef1234567890abcdef");
  });
});
