import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The server-side Supabase client must forward the audit actor bound to the
// current API request on every write, and only on writes.

const calls = [];

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://audit-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-for-test");
  vi.stubGlobal("fetch", async (input, init = {}) => {
    calls.push({ url: String(input?.url || input), method: init.method || "GET", headers: new Headers(init.headers) });
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = async () => {
  const { supabaseService } = await import("@/lib/database/supabaseClient");
  const context = await import("@/lib/audit/requestAuditContext");
  return { supabaseService, ...context };
};

describe("server Supabase writes carry the audit actor", () => {
  it("adds the bound headers to writes inside a request", async () => {
    const { supabaseService, runWithAuditHeaders } = await load();
    await runWithAuditHeaders(
      { "x-audit-actor-type": "user", "x-audit-actor-user-id": "7" },
      async () => {
        await supabaseService.from("jobs").update({ status: "done" }).eq("id", 1);
        await supabaseService.rpc("some_function", {});
      }
    );
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers.get("x-audit-actor-type")).toBe("user");
      expect(call.headers.get("x-audit-actor-user-id")).toBe("7");
      // supabase-js's own auth headers are preserved.
      expect(call.headers.get("apikey")).toBe("service-key-for-test");
    }
  });

  it("leaves reads and writes outside a request untouched", async () => {
    const { supabaseService, runWithAuditHeaders } = await load();
    await runWithAuditHeaders({ "x-audit-actor-type": "user" }, () =>
      supabaseService.from("jobs").select("id")
    );
    await supabaseService.from("jobs").insert({ job_number: "J1" });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.headers.get("x-audit-actor-type") === null)).toBe(true);
  });
});
