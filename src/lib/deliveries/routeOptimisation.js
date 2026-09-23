// Route-order optimisation for the parts delivery diary.
//
// This module owns external postcode/routing calls; database reads and writes
// remain in src/lib/database/deliveries.js.
//
// How the order is chosen
// -----------------------
// OSRM's /trip service was doing this job, and it is the reason the calculated
// runs still doubled back: /trip is a farthest-insertion construction heuristic
// with no local search, so it routinely drives past a stop and comes back for
// it later. Typical results sit 10-25% above the best possible order, and the
// waste is exactly the "long way round" shape a driver notices.
//
// So /trip is no longer what picks the order. Instead:
//
//   1. /table gives the real road drive time AND distance between every pair of
//      points in one call - the parts desk and every located stop.
//   2. That matrix is solved here: multi-start nearest-neighbour construction
//      (plus the order already saved, so a hand-tuned run is never thrown away
//      for something worse), then 2-opt and Or-opt local search run to
//      convergence. 2-opt removes crossings; Or-opt is what pulls a stranded
//      stop back into the leg it belongs to, which is the specific complaint
//      /trip's output causes.
//
// The search optimises drive TIME first, because that is what "the long way
// round" means to a driver - a fast A-road detour beats a shorter crawl through
// town. Mileage is a tie-break on top of it: each mile carries a small time
// penalty, far less than the time a mile actually takes to drive, so two orders
// that take the same time are separated by the shorter one while a genuinely
// quicker order still wins. Fuel and van wear are real, but not at the cost of
// getting home late.
//
// /trip is kept only as a fallback for when /table cannot be reached, so the
// feature degrades to its old behaviour rather than to nothing.
//
// Stops that are already delivered, failed or returned are not reshuffled. They
// keep their existing numbers at the front of the day, and the optimiser plans
// the remaining stops from wherever the last completed stop was. Recalculating
// halfway through a run therefore fixes the rest of the day instead of
// renumbering work that has already happened.

import { isOpenDeliveryStatus } from "@/features/deliveries/deliveryStatus";

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OSRM_BASE_URL = (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(
  /\/+$/,
  ""
);
const OSRM_TIMEOUT_MS = 10_000;
const MAX_WAYPOINTS = 60;
const METRES_PER_MILE = 1609.344;

// A pair OSRM cannot route (an island, a bad geocode) comes back as null. It
// still has to have a number so the search can compare orders; this is large
// enough that any routable alternative wins, without being Infinity, which
// would make every candidate order equally unrankable.
const UNREACHABLE_COST = 1e9;

// Mileage tie-break, in seconds of notional cost per mile driven. A mile of
// real road costs roughly two minutes, so at three seconds this can only decide
// between orders that are already within a few seconds of each other - it can
// never talk the planner into a slower run to save a mile.
const MILEAGE_TIE_BREAK_SECONDS_PER_MILE = 3;

// Or-opt moves runs of up to three consecutive stops. Longer segments buy
// almost nothing on a van run of this size and cost a pass each.
const MAX_OR_OPT_SEGMENT = 3;
// A descent only ever accepts a strictly cheaper order, so it terminates on its
// own. The cap is a guard against a pathological matrix, not a tuning knob.
const MAX_IMPROVEMENT_PASSES = 60;
// 2-opt and Or-opt stop at the first order neither can improve, which is not
// necessarily the best one. Shaking that order and descending again escapes it.
// A day's van run descends in a few milliseconds, so this is affordable; the
// time budget is what stops a 50-stop day from thinking for a minute.
const MAX_DESCENT_STARTS = 6;
const RESTART_ATTEMPTS = 40;
const RESTART_TIME_BUDGET_MS = 1200;

const postcodeKey = (value) => String(value || "").toUpperCase().replace(/\s+/g, "");
const roundTenth = (value) => Math.round(value * 10) / 10;

async function geocodePostcodes(postcodes) {
  if (postcodes.length === 0) return new Map();
  const response = await fetch("https://api.postcodes.io/postcodes", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ postcodes }),
  });
  if (!response.ok) throw new Error("Postcode lookup is unavailable right now.");
  const payload = await response.json().catch(() => null);
  const locations = new Map();
  for (const entry of payload?.result || []) {
    if (typeof entry?.result?.latitude !== "number") continue;
    locations.set(postcodeKey(entry.query), {
      latitude: entry.result.latitude,
      longitude: entry.result.longitude,
      postcode: entry.result.postcode,
    });
  }
  return locations;
}

const coordinateList = (points) =>
  points.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(";");

/**
 * Road drive time and distance between every pair of points, in one call.
 *
 * @returns {Promise<null | {durations:number[][], distances:number[][]|null}>}
 */
async function requestTable(points, avoidMotorways) {
  const query = new URLSearchParams({ annotations: "duration,distance" });
  if (avoidMotorways) query.set("exclude", "motorway");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/table/v1/driving/${coordinateList(points)}?${query}`,
      { headers: { accept: "application/json" }, signal: controller.signal }
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    if (payload?.code !== "Ok") return null;
    const durations = payload?.durations;
    // A square matrix covering every point is the whole contract here. Anything
    // short of that cannot be solved, so it is treated as no answer at all.
    if (!Array.isArray(durations) || durations.length !== points.length) return null;
    if (durations.some((row) => !Array.isArray(row) || row.length !== points.length)) return null;
    const distances = Array.isArray(payload?.distances) ? payload.distances : null;
    return { durations, distances };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function requestTrip(points, avoidMotorways) {
  const query = new URLSearchParams({
    source: "first",
    destination: "last",
    roundtrip: "false",
    overview: "false",
    steps: "false",
  });
  if (avoidMotorways) query.set("exclude", "motorway");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/trip/v1/driving/${coordinateList(points)}?${query}`,
      { headers: { accept: "application/json" }, signal: controller.signal }
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.code === "Ok" ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// The solver. Pure functions over a cost matrix - no network, no delivery
// shapes - so the ordering logic is testable on its own.
// ---------------------------------------------------------------------------

const cellCost = (matrix, from, to) => {
  const value = matrix?.[from]?.[to];
  return typeof value === "number" && Number.isFinite(value) ? value : UNREACHABLE_COST;
};

/**
 * The matrix the search actually minimises: drive time plus a small per-mile
 * penalty.
 *
 * Kept separate from the duration and distance matrices because those two are
 * still what gets reported - the planner must quote real minutes and real
 * miles, not the blended number it ranked orders by.
 *
 * A pair either matrix cannot route stays unroutable in the blend, so the
 * search penalises it exactly as before.
 *
 * @param {number[][]} durations seconds between each pair
 * @param {number[][]|null} distances metres between each pair, when available
 * @returns {number[][]}
 */
export function buildRouteCostMatrix(durations, distances) {
  if (!Array.isArray(distances)) return durations;
  return durations.map((row, from) =>
    row.map((seconds, to) => {
      const metres = distances?.[from]?.[to];
      if (typeof seconds !== "number" || !Number.isFinite(seconds)) return seconds;
      if (typeof metres !== "number" || !Number.isFinite(metres)) return seconds;
      return seconds + (metres / METRES_PER_MILE) * MILEAGE_TIE_BREAK_SECONDS_PER_MILE;
    })
  );
}

/**
 * Cost of driving `start` -> every node in `order` -> `end`.
 *
 * @param {number[][]} matrix square cost matrix indexed by node
 * @param {number} start node the van sets off from
 * @param {number} end node the van finishes at
 * @param {number[]} order node indices to visit, in order
 * @returns {number}
 */
export function sequenceCost(matrix, start, end, order) {
  let total = 0;
  let previous = start;
  for (const node of order) {
    total += cellCost(matrix, previous, node);
    previous = node;
  }
  return total + cellCost(matrix, previous, end);
}

/** Greedy "always drive to the closest stop left", from a fixed first stop. */
function nearestNeighbour(matrix, start, nodes, firstNode) {
  const remaining = new Set(nodes);
  const order = [];
  let current = start;
  if (firstNode !== undefined && remaining.has(firstNode)) {
    order.push(firstNode);
    remaining.delete(firstNode);
    current = firstNode;
  }
  while (remaining.size > 0) {
    let best = null;
    let bestCost = Infinity;
    for (const node of remaining) {
      const cost = cellCost(matrix, current, node);
      if (cost < bestCost) {
        bestCost = cost;
        best = node;
      }
    }
    order.push(best);
    remaining.delete(best);
    current = best;
  }
  return order;
}

/**
 * The cheapest visiting order the local search can find.
 *
 * Construction is multi-start nearest-neighbour (once per possible first stop,
 * plus one from the start node itself) seeded with any orders the caller
 * already has - normally the order currently saved on the day, so a route staff
 * have tuned by hand is a candidate rather than something to beat.
 *
 * Improvement alternates 2-opt (reverse a run: removes crossings) and Or-opt
 * (lift a run of 1-3 stops and drop it elsewhere, either way round: pulls a
 * stop that was driven past back into the leg it belongs to). Both are run to
 * convergence, and every move is scored by full re-costing so an asymmetric
 * matrix - one-way systems, dual carriageways - is handled correctly rather
 * than assumed symmetric.
 *
 * @param {{matrix:number[][], start:number, end:number, stops:number[], seeds?:number[][]}} input
 * @returns {number[]} the stop nodes in the order they should be driven
 */
export function optimiseStopSequence({ matrix, start, end, stops, seeds = [] }) {
  if (!Array.isArray(stops) || stops.length <= 1) return [...(stops || [])];

  const stopSet = new Set(stops);
  const seeded = seeds
    // A seed is only usable if it is a permutation of exactly these stops.
    .filter(
      (seed) =>
        Array.isArray(seed) &&
        seed.length === stops.length &&
        new Set(seed).size === seed.length &&
        seed.every((node) => stopSet.has(node))
    )
    .map((seed) => [...seed]);

  const candidates = [nearestNeighbour(matrix, start, stops)];
  for (const first of stops) candidates.push(nearestNeighbour(matrix, start, stops, first));

  const descend = (order) => {
    let current = order;
    let currentCost = sequenceCost(matrix, start, end, current);
    const length = current.length;

    for (let pass = 0; pass < MAX_IMPROVEMENT_PASSES; pass += 1) {
      let improved = false;

      // 2-opt: reverse every possible run and keep the reversal if it is cheaper.
      for (let i = 0; i < length - 1; i += 1) {
        for (let j = i + 1; j < length; j += 1) {
          const candidate = [
            ...current.slice(0, i),
            ...current.slice(i, j + 1).reverse(),
            ...current.slice(j + 1),
          ];
          const cost = sequenceCost(matrix, start, end, candidate);
          if (cost < currentCost - 1e-9) {
            current = candidate;
            currentCost = cost;
            improved = true;
          }
        }
      }

      // Or-opt: move a short run of stops to a different point in the day.
      for (let size = 1; size <= Math.min(MAX_OR_OPT_SEGMENT, length - 1); size += 1) {
        for (let from = 0; from + size <= length; from += 1) {
          const segment = current.slice(from, from + size);
          const rest = [...current.slice(0, from), ...current.slice(from + size)];
          for (let to = 0; to <= rest.length; to += 1) {
            if (to === from) continue; // puts it straight back where it was
            for (const run of size > 1 ? [segment, [...segment].reverse()] : [segment]) {
              const candidate = [...rest.slice(0, to), ...run, ...rest.slice(to)];
              const cost = sequenceCost(matrix, start, end, candidate);
              if (cost < currentCost - 1e-9) {
                current = candidate;
                currentCost = cost;
                improved = true;
              }
            }
          }
        }
      }

      if (!improved) break;
    }

    return { order: current, cost: currentCost };
  };

  // Every construction is cheap; descending one is not, so only the most
  // promising handful are improved. The seeded orders are always among them —
  // that is what guarantees the answer is never worse than the order already on
  // the board.
  const ranked = candidates
    .map((order) => ({ order, cost: sequenceCost(matrix, start, end, order) }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, MAX_DESCENT_STARTS)
    .map((entry) => entry.order);
  const starts = [...seeded, ...ranked];

  let best = descend(starts[0]);
  for (const candidate of starts.slice(1)) {
    const result = descend(candidate);
    if (result.cost < best.cost) best = result;
  }

  // Escape the local optimum: shake the best order with a double bridge - the
  // standard TSP kick, because it is the one move 2-opt cannot undo in a single
  // step - and descend again, keeping anything better. The generator is seeded,
  // so the same day always calculates to the same route.
  const random = seededRandom(best.order.length * 2654435761 + Math.round(best.cost));
  const deadline = Date.now() + RESTART_TIME_BUDGET_MS;
  if (best.order.length >= 8) {
    for (let attempt = 0; attempt < RESTART_ATTEMPTS; attempt += 1) {
      if (Date.now() > deadline) break;
      const result = descend(doubleBridge(best.order, random));
      if (result.cost < best.cost - 1e-9) best = result;
    }
  }

  return best.order;
}

/**
 * Small deterministic PRNG (mulberry32).
 *
 * Deterministic on purpose: recalculating the same day twice must produce the
 * same route, or staff cannot tell a real improvement from a reshuffle.
 */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cut the order into four and reassemble as A-C-B-D. */
function doubleBridge(order, random) {
  const length = order.length;
  const [a, b, c] = [
    1 + Math.floor(random() * (length - 1)),
    1 + Math.floor(random() * (length - 1)),
    1 + Math.floor(random() * (length - 1)),
  ].sort((x, y) => x - y);
  return [
    ...order.slice(0, a),
    ...order.slice(b, c),
    ...order.slice(a, b),
    ...order.slice(c),
  ];
}

/**
 * Map an OSRM /trip answer back onto delivery ids.
 *
 * Only used on the fallback path now that /table drives the ordering, but kept
 * because that path still has to produce a usable order.
 */
export function orderDeliveryIdsFromTrip(locatedStops, tripWaypoints, unlocatedStops = []) {
  if (!Array.isArray(tripWaypoints) || tripWaypoints.length < locatedStops.length + 2) {
    return null;
  }
  const orderedLocated = locatedStops
    .map((stop, index) => ({ stop, position: tripWaypoints[index + 1]?.waypoint_index }))
    .filter((entry) => Number.isInteger(entry.position))
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.stop.id);
  if (orderedLocated.length !== locatedStops.length) return null;
  return [...orderedLocated, ...unlocatedStops.map((stop) => stop.id)];
}

export async function optimiseDeliveryRoute({ deliveries, originPostcode, avoidMotorways = false }) {
  const uniquePostcodes = [originPostcode, ...deliveries.map((row) => row.postcodeValue)]
    .filter((postcode) => UK_POSTCODE_RE.test(String(postcode || "")))
    .filter((postcode, index, values) => values.findIndex((value) => postcodeKey(value) === postcodeKey(postcode)) === index);
  const locations = await geocodePostcodes(uniquePostcodes);
  const origin = locations.get(postcodeKey(originPostcode));
  if (!origin) throw new Error("The parts desk postcode could not be located.");

  const locatedStops = deliveries.filter((row) => locations.has(postcodeKey(row.postcodeValue)));
  const unlocatedStops = deliveries.filter((row) => !locations.has(postcodeKey(row.postcodeValue)));
  if (locatedStops.length < 2) {
    throw new Error("At least two delivery postcodes are needed to calculate a route.");
  }
  if (locatedStops.length + 1 > MAX_WAYPOINTS) {
    throw new Error(`Routes are limited to ${MAX_WAYPOINTS - 1} located delivery stops.`);
  }

  // Node 0 is the parts desk; stop i is node i + 1. The van finishes back at
  // node 0, so the desk is both ends of the day without being duplicated.
  const points = [origin, ...locatedStops.map((row) => locations.get(postcodeKey(row.postcodeValue)))];

  let motorwayAvoidanceApplied = avoidMotorways;
  let table = await requestTable(points, avoidMotorways);
  if (!table && avoidMotorways) {
    motorwayAvoidanceApplied = false;
    table = await requestTable(points, false);
  }

  if (!table) {
    // The trip fallback gets the caller's original preference, not the state
    // the table attempts left behind: a motorway-free table failing says
    // nothing about whether a motorway-free trip can be routed.
    return optimiseFromTrip({ points, locatedStops, unlocatedStops, avoidMotorways });
  }

  // Work already done keeps its place. The remaining stops are planned from
  // wherever the van finished its last completed drop, not from the desk.
  const settled = [];
  const pending = [];
  locatedStops.forEach((row, index) => {
    const node = index + 1;
    (isOpenDeliveryStatus(row.status) ? pending : settled).push({ row, node });
  });

  const startNode = settled.length > 0 ? settled[settled.length - 1].node : 0;
  const plannedNodes = optimiseStopSequence({
    matrix: buildRouteCostMatrix(table.durations, table.distances),
    start: startNode,
    end: 0,
    stops: pending.map((entry) => entry.node),
    // The order already on the board is a candidate in its own right, so a run
    // staff have arranged by hand is only replaced by something genuinely
    // cheaper.
    seeds: [pending.map((entry) => entry.node)],
  });

  const nodeToRow = new Map(pending.map((entry) => [entry.node, entry.row]));
  const fullSequence = [...settled.map((entry) => entry.node), ...plannedNodes];
  const orderedIds = [
    ...settled.map((entry) => entry.row.id),
    ...plannedNodes.map((node) => nodeToRow.get(node).id),
    ...unlocatedStops.map((row) => row.id),
  ];

  // Totals cover the whole day - the settled prefix included - so the mileage
  // shown in the planner is comparable with the mileage on the route map.
  const totalSeconds = sequenceCost(table.durations, 0, 0, fullSequence);
  const totalMetres = table.distances
    ? sequenceCost(table.distances, 0, 0, fullSequence)
    : null;
  const previousSeconds = sequenceCost(
    table.durations,
    0,
    0,
    locatedStops.map((_row, index) => index + 1)
  );
  const savedMinutes = Math.round((previousSeconds - totalSeconds) / 60);

  return {
    orderedIds,
    totalMiles: totalMetres === null ? null : roundTenth(totalMetres / METRES_PER_MILE),
    totalMinutes: Math.round(totalSeconds / 60),
    locatedStops: locatedStops.length,
    unlocatedStops: unlocatedStops.length,
    pendingStops: pending.length,
    settledStops: settled.length,
    savedMinutes,
    motorwayAvoidanceApplied,
    notices: [
      "Live traffic is checked by Google Maps when route guidance opens; it is not included in this saved estimate.",
      ...(settled.length
        ? [
            `${settled.length} completed stop(s) kept their existing position; the remaining ${pending.length} were planned from the last drop.`,
          ]
        : []),
      ...(savedMinutes > 0
        ? [`The new order is about ${savedMinutes} minute(s) shorter than the previous one.`]
        : savedMinutes < 0
        ? [
            // Only reachable when completed stops were scattered through the
            // old order: pinning them to the front is worth a little mileage.
            `The new order is about ${Math.abs(savedMinutes)} minute(s) longer, because completed stops were kept in the position they were delivered in.`,
          ]
        : ["The order already on the board was the best one found, so nothing moved."]),
      ...(unlocatedStops.length
        ? [`${unlocatedStops.length} stop(s) could not be located and were kept at the end of the route.`]
        : []),
      ...(avoidMotorways && !motorwayAvoidanceApplied
        ? ["The routing provider could not calculate a motorway-free order, so it used the standard road profile."]
        : []),
    ],
  };
}

/**
 * Fallback ordering for when the drive-time matrix cannot be fetched.
 *
 * This is the previous behaviour — OSRM's own /trip heuristic — kept so a
 * matrix outage degrades the quality of the answer rather than removing the
 * feature. /trip needs the desk as two waypoints (first and last) because it
 * solves an open path, which is why the point list is rebuilt here.
 */
async function optimiseFromTrip({ points, locatedStops, unlocatedStops, avoidMotorways }) {
  const tripPoints = [...points, points[0]];
  let applied = avoidMotorways;
  let trip = await requestTrip(tripPoints, applied);
  if (!trip && applied) {
    applied = false;
    trip = await requestTrip(tripPoints, false);
  }
  if (!trip) throw new Error("The route optimiser is unavailable right now.");

  const orderedIds = orderDeliveryIdsFromTrip(locatedStops, trip.waypoints, unlocatedStops);
  if (!orderedIds) throw new Error("The route optimiser returned an incomplete stop order.");
  const route = trip.trips?.[0] || {};

  return {
    orderedIds,
    totalMiles: roundTenth(Number(route.distance || 0) / METRES_PER_MILE),
    totalMinutes: Math.round(Number(route.duration || 0) / 60),
    locatedStops: locatedStops.length,
    unlocatedStops: unlocatedStops.length,
    pendingStops: locatedStops.length,
    settledStops: 0,
    savedMinutes: null,
    motorwayAvoidanceApplied: applied,
    notices: [
      "Live traffic is checked by Google Maps when route guidance opens; it is not included in this saved estimate.",
      "Road drive times were unavailable, so a simpler ordering was used. Calculating again later may tighten the run.",
      ...(unlocatedStops.length
        ? [`${unlocatedStops.length} stop(s) could not be located and were kept at the end of the route.`]
        : []),
      ...(avoidMotorways && !applied
        ? ["The routing provider could not calculate a motorway-free order, so it used the standard road profile."]
        : []),
    ],
  };
}
