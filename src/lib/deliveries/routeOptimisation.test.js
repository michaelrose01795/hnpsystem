import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRouteCostMatrix,
  optimiseDeliveryRoute,
  optimiseStopSequence,
  orderDeliveryIdsFromTrip,
  sequenceCost,
} from "./routeOptimisation";

/** Straight-line cost matrix over a list of [x, y] points. */
const euclideanMatrix = (points) =>
  points.map((a) => points.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])));

/**
 * The genuinely cheapest order, by exhaustive search.
 *
 * The whole point of this module is that it finds the best order rather than a
 * plausible one, so the tests check it against the real answer instead of
 * against a recorded output that could be wrong in the same way the code is.
 * Only used on stop counts small enough to enumerate.
 */
function bruteForceOrder(matrix, start, end, stops) {
  let best = null;
  let bestCost = Infinity;
  const walk = (chosen, remaining) => {
    if (remaining.length === 0) {
      const cost = sequenceCost(matrix, start, end, chosen);
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = chosen;
      }
      return;
    }
    remaining.forEach((node, index) => {
      walk([...chosen, node], [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    });
  };
  walk([], stops);
  return { order: best, cost: bestCost };
}

/** Points on a circle. Their cheapest closed tour is provably the perimeter. */
const ringPoints = (count) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [Math.cos(angle) * 50, Math.sin(angle) * 50];
  });

describe("delivery route optimisation", () => {
  it("maps OSRM waypoint positions back to delivery ids and appends unlocated stops", () => {
    const located = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const waypoints = [
      { waypoint_index: 0 },
      { waypoint_index: 2 },
      { waypoint_index: 3 },
      { waypoint_index: 1 },
      { waypoint_index: 4 },
    ];
    expect(orderDeliveryIdsFromTrip(located, waypoints, [{ id: "missing" }])).toEqual([
      "c",
      "a",
      "b",
      "missing",
    ]);
  });
});

describe("optimiseStopSequence", () => {
  it("pulls a stop that was driven past back into the leg it belongs to", () => {
    // Nine stops round a loop from the desk. The seed is the correct loop with
    // one stop lifted out and served last — the "missed one and went back for
    // it" shape. The only orders that match the perimeter cost are the loop
    // driven either way round, so the fix is unambiguous.
    const matrix = euclideanMatrix(ringPoints(10));
    const perimeter = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const droveStraightPast = [1, 2, 3, 5, 6, 7, 8, 9, 4];

    const order = optimiseStopSequence({
      matrix,
      start: 0,
      end: 0,
      stops: perimeter,
      seeds: [droveStraightPast],
    });

    expect(sequenceCost(matrix, 0, 0, order)).toBeLessThan(
      sequenceCost(matrix, 0, 0, droveStraightPast)
    );
    expect([perimeter, [...perimeter].reverse()]).toContainEqual(order);
  });

  it("finds the perimeter order for stops in convex position, however they are given", () => {
    const matrix = euclideanMatrix(ringPoints(10));
    const perimeter = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const shuffled = [4, 9, 1, 6, 2, 8, 3, 7, 5];

    const order = optimiseStopSequence({ matrix, start: 0, end: 0, stops: shuffled });

    expect(sequenceCost(matrix, 0, 0, order)).toBeCloseTo(
      sequenceCost(matrix, 0, 0, perimeter),
      6
    );
  });

  it("matches an exhaustive search on a scattered day", () => {
    const points = [[0, 0], [4, 1], [2, 7], [8, 3], [1, 2], [6, 6], [3, 9], [7, 8]];
    const matrix = euclideanMatrix(points);
    const stops = [1, 2, 3, 4, 5, 6, 7];

    const order = optimiseStopSequence({ matrix, start: 0, end: 0, stops });

    expect(sequenceCost(matrix, 0, 0, order)).toBeCloseTo(
      bruteForceOrder(matrix, 0, 0, stops).cost,
      6
    );
  });

  it("takes the shorter road when two orders take the same time", () => {
    // Every pair is fifteen minutes apart, so drive time cannot separate any of
    // these orders. Distance can: the points sit on a circle, where the
    // perimeter is the shortest closed tour. The tie-break must therefore pick
    // it out of nine stops that are otherwise indistinguishable.
    const ring = ringPoints(10);
    const durations = ring.map((_, from) => ring.map((__, to) => (from === to ? 0 : 900)));
    const distances = euclideanMatrix(ring).map((row) => row.map((value) => value * MILE));
    const perimeter = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    const order = optimiseStopSequence({
      matrix: buildRouteCostMatrix(durations, distances),
      start: 0,
      end: 0,
      stops: [4, 9, 1, 6, 2, 8, 3, 7, 5],
    });

    expect([perimeter, [...perimeter].reverse()]).toContainEqual(order);
  });

  it("never lets mileage overrule a genuinely quicker route", () => {
    // Leg 1 is five miles but one minute; leg 2 is one mile but eleven. A mile
    // of real road costs about two minutes, so the tie-break must be small
    // enough that the quick leg still ranks first by a wide margin.
    const durations = [
      [0, 60, 660],
      [60, 0, 0],
      [660, 0, 0],
    ];
    const distances = [
      [0, 5 * MILE, MILE],
      [5 * MILE, 0, 0],
      [MILE, 0, 0],
    ];
    const matrix = buildRouteCostMatrix(durations, distances);

    expect(matrix[0][1]).toBeLessThan(matrix[0][2]);
    // Three seconds a mile, and not a second more.
    expect(matrix[0][1] - durations[0][1]).toBeCloseTo(15, 6);
    // With no distances to work from the durations are used untouched.
    expect(buildRouteCostMatrix(durations, null)).toBe(durations);
  });

  it("never returns an order worse than the one already saved", () => {
    const matrix = euclideanMatrix([[0, 0], [1, 1], [9, 9], [1, 9], [9, 1]]);
    const stops = [1, 2, 3, 4];
    const saved = [1, 4, 2, 3];

    const order = optimiseStopSequence({ matrix, start: 0, end: 0, stops, seeds: [saved] });

    expect(sequenceCost(matrix, 0, 0, order)).toBeLessThanOrEqual(
      sequenceCost(matrix, 0, 0, saved) + 1e-9
    );
  });

  it("plans from where the van is, not always from the desk", () => {
    // The desk is at the origin and the van is already out at stop 1. Serving
    // the two remaining stops on the way back in beats driving out again.
    const matrix = euclideanMatrix([[0, 0], [9, 9], [3, 1], [6, 5]]);

    expect(optimiseStopSequence({ matrix, start: 1, end: 0, stops: [2, 3] })).toEqual([3, 2]);
    expect(optimiseStopSequence({ matrix, start: 0, end: 0, stops: [2, 3] })).toEqual([2, 3]);
  });

  it("is deterministic and safe on trivial input", () => {
    const matrix = euclideanMatrix([[0, 0], [4, 1], [2, 7], [8, 3], [1, 2], [6, 6], [3, 9], [7, 8], [5, 4]]);
    const stops = [1, 2, 3, 4, 5, 6, 7, 8];

    const first = optimiseStopSequence({ matrix, start: 0, end: 0, stops });
    expect(optimiseStopSequence({ matrix, start: 0, end: 0, stops })).toEqual(first);

    expect(optimiseStopSequence({ matrix, start: 0, end: 0, stops: [] })).toEqual([]);
    expect(optimiseStopSequence({ matrix, start: 0, end: 0, stops: [3] })).toEqual([3]);
  });
});

// ---------------------------------------------------------------------------
// optimiseDeliveryRoute — the network calls are stubbed so the ordering rules
// (settled stops pinned, unlocated stops last) can be asserted directly.
// ---------------------------------------------------------------------------

const DESK = "ME19 4NY";

// A scattered set, not a straight line: on collinear stops many different
// orders cost exactly the same and the assertions would be meaningless.
const GRID = {
  "ME19 4NY": [0, 0],
  "AA1 1AA": [1, 4],
  "BB1 1BB": [4, 5],
  "CC1 1CC": [6, 1],
  "DD1 1DD": [2, 1],
};

const MILE = 1609.344;

function stubOsrm() {
  vi.stubGlobal("fetch", async (url, init) => {
    const target = String(url);
    if (target.includes("postcodes.io")) {
      const { postcodes } = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          result: postcodes.map((postcode) => ({
            query: postcode,
            result: GRID[postcode]
              ? { postcode, longitude: GRID[postcode][0], latitude: GRID[postcode][1] }
              : null,
          })),
        }),
      };
    }
    if (target.includes("/table/v1/")) {
      const points = target
        .split("/table/v1/driving/")[1]
        .split("?")[0]
        .split(";")
        .map((pair) => pair.split(",").map(Number));
      // One grid unit = one mile at one mile a minute, so the assertions can be
      // written in the same units the planner reports.
      const matrix = euclideanMatrix(points);
      return {
        ok: true,
        json: async () => ({
          code: "Ok",
          durations: matrix.map((row) => row.map((value) => value * 60)),
          distances: matrix.map((row) => row.map((value) => value * MILE)),
        }),
      };
    }
    throw new Error(`unexpected fetch: ${target}`);
  });
}

const delivery = (id, postcodeValue, status = "planned") => ({ id, postcodeValue, status });

describe("optimiseDeliveryRoute", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("orders the day by road time and keeps unlocated stops at the end", async () => {
    stubOsrm();
    const rows = [
      delivery("d", "DD1 1DD"),
      delivery("a", "AA1 1AA"),
      delivery("nowhere", "ZZ9 9ZZ"),
      delivery("c", "CC1 1CC"),
      delivery("b", "BB1 1BB"),
    ];

    const plan = await optimiseDeliveryRoute({ deliveries: rows, originPostcode: DESK });

    // The located stops must come out in the exhaustively-checked best order,
    // and the stop with no usable postcode must not be planned into the middle
    // of the day.
    const matrix = euclideanMatrix([GRID[DESK], ...["d", "a", "c", "b"].map((id) => GRID[rows.find((row) => row.id === id).postcodeValue])]);
    const bestNodes = bruteForceOrder(matrix, 0, 0, [1, 2, 3, 4]).order;
    const nodeIds = ["d", "a", "c", "b"];

    expect(plan.orderedIds).toEqual([...bestNodes.map((node) => nodeIds[node - 1]), "nowhere"]);
    expect(plan.unlocatedStops).toBe(1);
    expect(plan.locatedStops).toBe(4);
    expect(plan.totalMiles).toBeCloseTo(
      Math.round((bruteForceOrder(matrix, 0, 0, [1, 2, 3, 4]).cost * 10)) / 10,
      1
    );
    expect(plan.savedMinutes).toBeGreaterThan(0);
  });

  it("leaves completed stops where they are and replans only the rest", async () => {
    stubOsrm();
    const plan = await optimiseDeliveryRoute({
      deliveries: [
        delivery("done-c", "CC1 1CC", "delivered"),
        delivery("done-a", "AA1 1AA", "failed"),
        delivery("open-b", "BB1 1BB"),
        delivery("open-d", "DD1 1DD"),
      ],
      originPostcode: DESK,
    });

    // The settled pair keeps its saved order even though CC before AA is the
    // wrong way round. The van is at AA1 1AA, so the rest is planned from
    // there: out to BB1 1BB, then DD1 1DD on the way back to the desk.
    expect(plan.orderedIds).toEqual(["done-c", "done-a", "open-b", "open-d"]);
    expect(plan.settledStops).toBe(2);
    expect(plan.pendingStops).toBe(2);
    expect(plan.notices.some((notice) => /completed stop/i.test(notice))).toBe(true);
  });

  it("fails clearly when the desk postcode cannot be located", async () => {
    stubOsrm();
    await expect(
      optimiseDeliveryRoute({
        deliveries: [delivery("a", "AA1 1AA"), delivery("b", "BB1 1BB")],
        originPostcode: "ZZ9 9ZZ",
      })
    ).rejects.toThrow(/parts desk postcode/i);
  });
});
