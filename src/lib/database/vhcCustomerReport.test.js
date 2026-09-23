import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ tables: {}, fail: null, calls: [] }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  from(table) {
    let filters = [], inserted = null;
    const query = {
      select(columns) { state.calls.push({ table, columns }); return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      order() { return query; }, limit() { return query; },
      update(values) { state.calls.push({ table, update: values }); return query; },
      insert(row) { inserted = row; return query; },
      result(single = false) {
        if (state.fail === table) return { data: null, error: { message: "Unavailable" } };
        const rows = inserted ? [inserted] : (state.tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value));
        return { data: single ? rows[0] || null : rows, error: null };
      },
      maybeSingle() { return Promise.resolve(query.result(true)); },
      single() { return Promise.resolve(query.result(true)); },
      then(resolve, reject) { return Promise.resolve(query.result()).then(resolve, reject); },
    };
    return query;
  },
}) }));
vi.mock("@/lib/jobs/jobIdentity", () => ({ resolveJobIdentity: async ({ identifier }) =>
  state.tables.jobs.find(row => row.job_number === identifier) || null,
}));
vi.mock("@/features/vhc/vhcStatusEngine", async (importOriginal) => ({
  ...await importOriginal(), applyVhcDecision: vi.fn(),
}));
vi.mock("@/lib/database/jobActivity", () => ({ logJobActivity: vi.fn() }));

import { getOrCreateCustomerVhcLink, resolveSharedVhcReport, validateCustomerVhcLink } from "./vhcCustomerReport";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  state.fail = null;
  state.calls = [];
  state.tables = {
    jobs: [{ id: 1, job_number: "03967", customer: { firstname: "Test", lastname: "Customer" }, vehicle: { reg_number: "AB12CDE" } }, { id: 2, job_number: "03968" }],
    job_share_links: [{ id: "link", job_id: 1, job_number: "03967", link_code: "K7RM4XQP", created_at: "2020-01-01T00:00:00Z", viewed_at: "2020-01-01T00:00:00Z" }],
    vhc_checks: [{ vhc_id: 3, job_id: 1, severity: "red", display_id: "brakes-1" }],
    parts_job_items: [],
    job_files: [{ job_id: 1, file_id: 4, visible_to_customer: true }, { job_id: 1, file_id: 5, visible_to_customer: false }],
  };
});

describe("permanent customer VHC reports", () => {
  it("accepts a years-old link and preserves severity and item identities", async () => {
    const result = await resolveSharedVhcReport({ linkCode: "K7RM4XQP" });
    expect(result.status).toBe(200);
    expect(result.body.expiresAt).toBeNull();
    expect(result.body.jobData.vhc_checks[0]).toMatchObject({ severity: "red", display_id: "brakes-1" });
    expect(result.body.jobData.job_files.map(file => file.file_id)).toEqual([4]);
    expect(state.calls.find(call => call.table === "jobs").columns).not.toContain("*");
    expect(state.calls.find(call => call.table === "vhc_checks").columns).toContain("severity");
  });
  it("never selects internal-only cost or stock-location columns", async () => {
    await resolveSharedVhcReport({ linkCode: "K7RM4XQP" });
    // Trade cost and pre-pick stock location are staff-only. Nothing in the
    // customer render path reads them, so they must not reach the browser --
    // getServerSideProps serialises this payload straight into the page source.
    const checks = state.calls.find((call) => call.table === "vhc_checks").columns;
    const parts = state.calls.find((call) => call.table === "parts_job_items").columns;
    expect(checks).not.toContain("pre_pick_location");
    expect(parts).not.toContain("unit_cost");
    // ...while the columns the customer quote is actually built from stay.
    expect(parts).toContain("unit_price");
    expect(checks).toContain("parts_cost");
  });

  it("rejects a valid code paired with another job", async () => {
    expect((await validateCustomerVhcLink({ jobNumber: "03968", linkCode: "K7RM4XQP" })).status).toBe(404);
  });
  it("rejects missing and unknown codes", async () => {
    expect((await validateCustomerVhcLink({})).status).toBe(400);
    expect((await validateCustomerVhcLink({ linkCode: "unknown" })).status).toBe(404);
  });
  it("reuses an old link when opening, copying or sending again", async () => {
    expect(await getOrCreateCustomerVhcLink("03967")).toMatchObject({ link_code: "K7RM4XQP", isNew: false });
  });
  it("fails the report instead of presenting incomplete quote totals", async () => {
    state.fail = "parts_job_items";
    expect((await resolveSharedVhcReport({ linkCode: "K7RM4XQP" })).status).toBe(503);
  });
  it("allows decisions through an old link but never accepts customer price edits", async () => {
    const { updateCustomerVhcDecision } = await import("./vhcCustomerDecision");
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await updateCustomerVhcDecision({ method: "PATCH", body: {
      jobNumber: "03967", linkCode: "K7RM4XQP", vhcItemId: 3,
      approvalStatus: "authorized", labour_hours: 0, parts_cost: 0,
    } }, response);
    expect(response.status).toHaveBeenCalledWith(200);
    const changes = state.calls.find(call => call.table === "vhc_checks" && call.update).update;
    expect(changes).toMatchObject({ approval_status: "authorized", approved_by: "customer" });
    expect(changes).not.toHaveProperty("labour_hours");
    expect(changes).not.toHaveProperty("parts_cost");
  });
  it("rejects decisions on another job's item without writing", async () => {
    const { updateCustomerVhcDecision } = await import("./vhcCustomerDecision");
    state.tables.vhc_checks.push({ vhc_id: 8, job_id: 2 });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await updateCustomerVhcDecision({ method: "PATCH", body: {
      jobNumber: "03967", linkCode: "K7RM4XQP", vhcItemId: 8, approvalStatus: "declined",
    } }, response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(state.calls.some(call => call.update)).toBe(false);
  });
});
