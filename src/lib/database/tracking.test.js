// file location: src/lib/database/tracking.test.js
//
// Regression cover for the two tracking data-integrity rules:
//
//   1. `updateTrackingLocations` APPENDS a movement. It must never issue an
//      UPDATE against these tables — the previous implementation ran
//      `update(payload).eq("job_id", jobId)`, which PostgREST applies to every
//      matching row and which therefore rewrote a job's entire movement history
//      on each manual location change.
//   2. `fetchTrackingSnapshot` reports each job's NEWEST event as its current
//      location. `mergeEntry` is last-write-wins, so feeding it the raw
//      occurred_at-DESC result made the oldest event win.
//
// The Supabase client is faked at the `@/lib/database/client` seam so the tests
// assert on the exact query verbs and payloads the module issues.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  calls: [],
  tables: {},
};

const makeBuilder = (table) => {
  const call = { table, verb: null, payload: null, filters: [], order: null, limit: null };
  state.calls.push(call);

  const rowsFor = () => {
    const rows = state.tables[table] || [];
    return call.filters.length
      ? rows.filter((row) => call.filters.every(([column, value]) => row[column] === value))
      : rows;
  };

  const resolve = () => {
    if (call.verb === "insert") {
      const idField = table === "key_tracking_events" ? "key_event_id" : "event_id";
      const inserted = { ...call.payload, [idField]: state.calls.length };
      state.tables[table] = [...(state.tables[table] || []), inserted];
      return { data: [inserted], error: null };
    }
    let rows = rowsFor();
    if (call.order) {
      const [column, ascending] = call.order;
      rows = [...rows].sort((a, b) => {
        const diff = new Date(a?.[column] || 0).getTime() - new Date(b?.[column] || 0).getTime();
        return ascending ? diff : -diff;
      });
    }
    if (call.limit !== null) rows = rows.slice(0, call.limit);
    return { data: rows, error: null };
  };

  const builder = {
    select(...args) {
      call.select = args[0] ?? "*";
      return builder;
    },
    insert(payload) {
      call.verb = "insert";
      call.payload = payload;
      return builder;
    },
    update(payload) {
      call.verb = "update";
      call.payload = payload;
      return builder;
    },
    delete() {
      call.verb = "delete";
      return builder;
    },
    eq(column, value) {
      call.filters.push([column, value]);
      return builder;
    },
    gte() {
      return builder;
    },
    order(column, options) {
      call.order = [column, options?.ascending !== false];
      return builder;
    },
    limit(count) {
      call.limit = count;
      return builder;
    },
    async single() {
      const { data, error } = resolve();
      return { data: data?.[0] ?? null, error };
    },
    async maybeSingle() {
      const { data, error } = resolve();
      return { data: data?.[0] ?? null, error };
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };
  return builder;
};

vi.mock("@/lib/database/client", () => ({
  getDatabaseClient: () => ({ from: (table) => makeBuilder(table) }),
}));

const { fetchTrackingSnapshot, updateTrackingLocations } = await import("@/lib/database/tracking");

const resetState = (tables = {}) => {
  state.calls = [];
  state.tables = tables;
};

describe("updateTrackingLocations", () => {
  beforeEach(() => resetState());

  it("never issues an UPDATE against the tracking event tables", async () => {
    resetState({
      key_tracking_events: [
        {
          key_event_id: 1,
          job_id: 7,
          action: "Keys received - Reception",
          occurred_at: "2026-08-01T09:00:00.000Z",
          performed_by: 3,
        },
      ],
      vehicle_tracking_events: [
        {
          event_id: 1,
          job_id: 7,
          status: "Awaiting Workshop",
          location: "Front car park",
          occurred_at: "2026-08-01T09:00:00.000Z",
          created_by: 3,
        },
      ],
    });

    await updateTrackingLocations({
      actionType: "location_update",
      jobId: 7,
      jobNumber: "J1234",
      vehicleReg: "AB12CDE",
      keyLocation: "Workshop board",
      vehicleLocation: "Workshop bay 3",
      performedBy: 9,
    });

    const mutations = state.calls.filter(
      (call) => ["key_tracking_events", "vehicle_tracking_events"].includes(call.table) && call.verb
    );
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every((call) => call.verb === "insert")).toBe(true);
    expect(mutations.some((call) => call.verb === "update")).toBe(false);
  });

  it("leaves every pre-existing row byte-for-byte unchanged", async () => {
    const originalKey = {
      key_event_id: 1,
      job_id: 7,
      action: "Keys received - Reception",
      occurred_at: "2026-08-01T09:00:00.000Z",
      performed_by: 3,
    };
    const originalVehicle = {
      event_id: 1,
      job_id: 7,
      status: "Awaiting Workshop",
      location: "Front car park",
      occurred_at: "2026-08-01T09:00:00.000Z",
      created_by: 3,
    };
    resetState({ key_tracking_events: [originalKey], vehicle_tracking_events: [originalVehicle] });

    await updateTrackingLocations({
      actionType: "location_update",
      jobId: 7,
      keyLocation: "Workshop board",
      vehicleLocation: "Workshop bay 3",
      performedBy: 9,
    });

    expect(state.tables.key_tracking_events[0]).toEqual(originalKey);
    expect(state.tables.vehicle_tracking_events[0]).toEqual(originalVehicle);
    expect(state.tables.key_tracking_events).toHaveLength(2);
    expect(state.tables.vehicle_tracking_events).toHaveLength(2);
  });

  it("carries the current vehicle status forward when the caller sends none", async () => {
    resetState({
      vehicle_tracking_events: [
        {
          event_id: 1,
          job_id: 7,
          status: "Awaiting Workshop",
          location: "Front car park",
          occurred_at: "2026-08-01T09:00:00.000Z",
        },
        {
          event_id: 2,
          job_id: 7,
          status: "In Progress",
          location: "Workshop bay 1",
          occurred_at: "2026-08-02T09:00:00.000Z",
        },
      ],
    });

    const result = await updateTrackingLocations({
      actionType: "location_update",
      jobId: 7,
      vehicleLocation: "Workshop bay 3",
    });

    // Not "Ready For Collection" — moving a car is not completing the job.
    expect(result.success).toBe(true);
    expect(result.data.vehicleEvent.status).toBe("In Progress");
    expect(result.data.vehicleEvent.location).toBe("Workshop bay 3");
  });

  it("uses an explicit vehicleStatus when the caller supplies one", async () => {
    resetState({
      vehicle_tracking_events: [
        { event_id: 1, job_id: 7, status: "In Progress", occurred_at: "2026-08-02T09:00:00.000Z" },
      ],
    });

    const result = await updateTrackingLocations({
      actionType: "location_update",
      jobId: 7,
      vehicleLocation: "Collection bay",
      vehicleStatus: "Ready For Collection",
    });

    expect(result.data.vehicleEvent.status).toBe("Ready For Collection");
  });

  it("writes only the side the caller addressed", async () => {
    resetState();

    const result = await updateTrackingLocations({
      actionType: "location_update",
      jobId: 7,
      keyLocation: "Workshop board",
    });

    expect(result.data.keyEvent).not.toBeNull();
    expect(result.data.vehicleEvent).toBeNull();
    expect(state.tables.vehicle_tracking_events).toBeUndefined();
  });

  it("rejects a call with neither jobId nor vehicleId instead of writing", async () => {
    resetState();
    const result = await updateTrackingLocations({
      actionType: "location_update",
      keyLocation: "Workshop board",
    });
    expect(result.success).toBe(false);
    expect(state.calls).toHaveLength(0);
  });
});

describe("fetchTrackingSnapshot", () => {
  it("reports each job's newest event, not its oldest", async () => {
    resetState({
      key_tracking_events: [
        {
          key_event_id: 1,
          job_id: 7,
          action: "Keys received - Reception",
          occurred_at: "2026-08-01T09:00:00.000Z",
          jobs: { job_number: "J1234", status: "In Progress" },
        },
        {
          key_event_id: 2,
          job_id: 7,
          action: "Keys updated - Workshop board",
          occurred_at: "2026-08-03T09:00:00.000Z",
          jobs: { job_number: "J1234", status: "In Progress" },
        },
      ],
      vehicle_tracking_events: [
        {
          event_id: 1,
          job_id: 7,
          status: "Awaiting Workshop",
          location: "Front car park",
          occurred_at: "2026-08-01T09:00:00.000Z",
          jobs: { job_number: "J1234", status: "In Progress" },
        },
        {
          event_id: 2,
          job_id: 7,
          status: "In Progress",
          location: "Workshop bay 3",
          occurred_at: "2026-08-03T09:00:00.000Z",
          jobs: { job_number: "J1234", status: "In Progress" },
        },
      ],
    });

    const snapshot = await fetchTrackingSnapshot();

    expect(snapshot.success).toBe(true);
    expect(snapshot.data).toHaveLength(1);
    const [entry] = snapshot.data;
    expect(entry.vehicleLocation).toBe("Workshop bay 3");
    expect(entry.keyLocation).toBe("Keys updated - Workshop board");
    expect(entry.updatedAt).toBe("2026-08-03T09:00:00.000Z");
  });

  it("does not let a key event overwrite the vehicle status", async () => {
    resetState({
      key_tracking_events: [
        {
          key_event_id: 1,
          job_id: 7,
          action: "Keys updated - Workshop board",
          occurred_at: "2026-08-03T09:00:00.000Z",
          jobs: { job_number: "J1234", status: "In Progress" },
        },
      ],
      vehicle_tracking_events: [
        {
          event_id: 1,
          job_id: 7,
          status: "Awaiting Workshop",
          location: "Front car park",
          occurred_at: "2026-08-03T09:00:00.000Z",
          jobs: { job_number: "J1234", status: "In Progress" },
        },
      ],
    });

    const snapshot = await fetchTrackingSnapshot();

    // Previously the key loop asserted the constant "Ready For Collection",
    // which won the merge and mislabelled every job that had a key event.
    expect(snapshot.data[0].status).toBe("Awaiting Workshop");
  });

  it("keeps jobs separate", async () => {
    resetState({
      key_tracking_events: [],
      vehicle_tracking_events: [
        {
          event_id: 1,
          job_id: 7,
          status: "In Progress",
          location: "Workshop bay 3",
          occurred_at: "2026-08-03T09:00:00.000Z",
          jobs: { job_number: "J1234" },
        },
        {
          event_id: 2,
          job_id: 8,
          status: "Awaiting Workshop",
          location: "Front car park",
          occurred_at: "2026-08-02T09:00:00.000Z",
          jobs: { job_number: "J5678" },
        },
      ],
    });

    const snapshot = await fetchTrackingSnapshot();

    expect(snapshot.data.map((entry) => entry.jobNumber)).toEqual(["J1234", "J5678"]);
    expect(snapshot.data.map((entry) => entry.vehicleLocation)).toEqual([
      "Workshop bay 3",
      "Front car park",
    ]);
  });
});
