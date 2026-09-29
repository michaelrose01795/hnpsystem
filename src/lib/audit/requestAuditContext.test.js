import { describe, expect, it } from "vitest";
import {
  AUDIT_REQUEST_CONTEXT_KEY,
  buildCustomerAuditHeaders,
  buildStaffAuditHeaders,
  buildSystemAuditHeaders,
  getAuditHeaders,
  runWithAuditHeaders,
} from "@/lib/audit/requestAuditContext";

const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

const req = (overrides = {}) => ({
  url: "/api/jobs/update?id=1",
  headers: {
    "x-audit-session-id": SESSION_ID,
    "x-request-id": REQUEST_ID,
    "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    ...overrides,
  },
});

describe("buildStaffAuditHeaders", () => {
  it("carries identifiers only, from the verified session", () => {
    const headers = buildStaffAuditHeaders(req(), {
      user: { id: "7", email: "alice@hnp.test", name: "Alice", roles: ["admin"] },
    });
    expect(headers).toEqual({
      "x-audit-actor-type": "user",
      "x-audit-actor-user-id": "7",
      "x-audit-auth-subject": "7",
      "x-audit-actor-email": "alice@hnp.test",
      "x-audit-session-id": SESSION_ID,
      "x-request-id": REQUEST_ID,
      "x-audit-source": "api:/api/jobs/update",
      "x-audit-client-ip": "203.0.113.9",
    });
  });

  it("keeps a Keycloak subject without claiming it is a user id", () => {
    const headers = buildStaffAuditHeaders(req(), {
      user: { id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6", email: "k@hnp.test" },
    });
    expect(headers["x-audit-actor-user-id"]).toBeUndefined();
    expect(headers["x-audit-auth-subject"]).toBe("f81d4fae-7dec-11d0-a765-00a0c91e6bf6");
  });

  it("records a request with no signed-in user as anonymous", () => {
    const headers = buildStaffAuditHeaders(req(), null);
    expect(headers["x-audit-actor-type"]).toBe("anonymous");
    expect(headers["x-audit-actor-user-id"]).toBeUndefined();
  });

  it("marks dev-bypass sessions instead of inventing a user", () => {
    const headers = buildStaffAuditHeaders(req(), { user: { roles: [] }, devBypass: true });
    expect(headers["x-audit-actor-type"]).toBe("user");
    expect(headers["x-audit-auth-subject"]).toBe("dev-bypass");
    expect(headers["x-audit-actor-user-id"]).toBeUndefined();
  });

  it("mints a request id and drops malformed ids and non-ASCII values", () => {
    const headers = buildStaffAuditHeaders(
      req({ "x-request-id": "nope", "x-audit-session-id": "also-nope" }),
      { user: { id: "7", email: "zoë@hnp.test" } }
    );
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["x-request-id"]).not.toBe("nope");
    expect(headers["x-audit-session-id"]).toBeUndefined();
    expect(headers["x-audit-actor-email"]).toBeUndefined();
  });
});

describe("customer and system headers", () => {
  it("attributes a customer by id", () => {
    const headers = buildCustomerAuditHeaders(req({ "x-audit-session-id": undefined }), {
      customerId: "11111111-1111-4111-8111-111111111111",
    });
    expect(headers["x-audit-actor-type"]).toBe("customer");
    expect(headers["x-audit-customer-id"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(headers["x-audit-source"]).toBe("website:/api/jobs/update");
  });

  it("treats a missing customer session as anonymous", () => {
    expect(buildCustomerAuditHeaders(req(), null)["x-audit-actor-type"]).toBe("anonymous");
  });

  it("labels scheduled work as the system actor", () => {
    const headers = buildSystemAuditHeaders({ url: "/api/cron/auto-clockout", headers: {} });
    expect(headers["x-audit-actor-type"]).toBe("system");
    expect(headers["x-audit-source"]).toBe("system:/api/cron/auto-clockout");
  });
});

describe("runWithAuditHeaders", () => {
  it("is visible across awaits through the registered global symbol", async () => {
    const headers = { "x-audit-actor-type": "user" };
    const seen = await runWithAuditHeaders(headers, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return globalThis[AUDIT_REQUEST_CONTEXT_KEY].getStore()?.headers;
    });
    expect(seen).toBe(headers);
  });

  it("does not leak between concurrent requests or outside a request", async () => {
    const read = (id) =>
      runWithAuditHeaders({ id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, id === "a" ? 5 : 1));
        return getAuditHeaders().id;
      });
    await expect(Promise.all([read("a"), read("b")])).resolves.toEqual(["a", "b"]);
    expect(getAuditHeaders()).toBeNull();
  });
});
