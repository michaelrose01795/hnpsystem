// file location: src/lib/valuation/vehicleValuation.js
//
// The estimate engine behind /website/valuation.
//
// WHAT THIS IS - AND IS NOT
// -------------------------
// This is a transparent, deterministic desk estimate, not a trade book price.
// There is no CAP / Glass's feed wired into this project, so a real number
// cannot be produced from a registration alone. What CAN be done honestly is
// model the things that actually move a used vehicle's value - segment, age,
// mileage against expected, condition, history, declared faults - and show the
// customer a RANGE with the working behind it. Every screen that renders this
// must say it is an estimate and point at the in-person appraisal (see
// ValuationPage.js).
//
// Kept pure and dependency-free on purpose: no Supabase, no fetch, no React.
// The same function runs on the client while the customer is answering and
// could later run server-side against a lead record without change.
//
// DVLA gives us make, year, fuel, engine size, colour and MOT status - but NOT
// the model or trim. So the wizard asks for body type (and optionally the model
// name) and the segment base below is driven by that answer, which is why the
// engine works for any vehicle rather than only the ones we happen to know.

// ---------------------------------------------------------------------------
// Registration handling
// ---------------------------------------------------------------------------

/** Strip spaces/punctuation and upper-case - DVLA wants AB12CDE, not "ab12 cde". */
export function normaliseReg(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// Deliberately loose. UK plates span current (AB12CDE), prefix (A123BCD),
// suffix (ABC123A), dateless and personalised formats; rejecting anything DVLA
// would have accepted is worse than letting DVLA answer.
export function isPlausibleReg(value) {
  const reg = normaliseReg(value);
  return reg.length >= 2 && reg.length <= 8 && /[0-9]/.test(reg) && /[A-Z]/.test(reg);
}

/** Display form - "AB12 CDE" for the common 7-character plate. */
export function formatReg(value) {
  const reg = normaliseReg(value);
  if (reg.length === 7) return `${reg.slice(0, 4)} ${reg.slice(4)}`;
  return reg;
}

// ---------------------------------------------------------------------------
// Answer options - the wizard renders straight from these, so adding a choice
// here adds it to the form and to the maths in one edit.
// ---------------------------------------------------------------------------

// `base` is an indicative new list price for that segment wearing a mainstream
// badge. Tier, fuel and engine size scale it below.
export const BODY_TYPES = [
  { value: "city", label: "City car", hint: "Aygo, Picanto, 500", base: 15000 },
  { value: "hatch", label: "Hatchback", hint: "Swift, Golf, Fiesta, Corsa", base: 22000 },
  { value: "saloon", label: "Saloon", hint: "Passat, 3 Series, Insignia", base: 29000 },
  { value: "estate", label: "Estate", hint: "Octavia Estate, V60, Touring", base: 31000 },
  { value: "suvSmall", label: "Small SUV / crossover", hint: "Vitara, Juke, Captur", base: 25000 },
  { value: "suvLarge", label: "Large SUV / 4x4", hint: "Torres, Sportage, Discovery", base: 38000 },
  { value: "mpv", label: "MPV / people carrier", hint: "Zafira, Galaxy, Berlingo", base: 27000 },
  { value: "sports", label: "Coupe / convertible", hint: "TT, MX-5, Mustang", base: 35000 },
  { value: "van", label: "Van", hint: "Transit, Vivaro, Berlingo Van", base: 27000 },
  { value: "pickup", label: "Pickup", hint: "Musso, Hilux, Ranger", base: 34000 },
];

export const TRANSMISSIONS = [
  { value: "manual", label: "Manual", adjust: 0 },
  { value: "automatic", label: "Automatic", adjust: 0.025 },
  { value: "unsure", label: "Not sure", adjust: 0 },
];

export const CONDITIONS = [
  { value: "excellent", label: "Excellent", hint: "Looks like new, nothing to put right", adjust: 0.05 },
  { value: "good", label: "Good", hint: "Tidy, the odd stone chip or light scratch", adjust: 0 },
  { value: "fair", label: "Fair", hint: "Marks, scuffs or dents you would expect us to sort", adjust: -0.08 },
  { value: "poor", label: "Poor", hint: "Needs real work before it could be sold", adjust: -0.18 },
];

export const SERVICE_HISTORY = [
  { value: "fullDealer", label: "Full main-dealer history", adjust: 0.05 },
  { value: "full", label: "Full service history", adjust: 0.03 },
  { value: "part", label: "Part service history", adjust: -0.02 },
  { value: "none", label: "No service history", adjust: -0.08 },
];

export const OWNER_BANDS = [
  { value: "one", label: "Just me", adjust: 0.02 },
  { value: "twoThree", label: "2 to 3", adjust: 0 },
  { value: "fourPlus", label: "4 or more", adjust: -0.03 },
  { value: "unsure", label: "Not sure", adjust: 0 },
];

export const KEY_OPTIONS = [
  { value: "two", label: "Two or more keys", adjust: 0.01 },
  { value: "one", label: "One key only", adjust: -0.015 },
];

export const MOT_OPTIONS = [
  { value: "long", label: "More than 6 months left", adjust: 0.02 },
  { value: "short", label: "Less than 6 months left", adjust: 0 },
  { value: "expired", label: "Expired, or no MOT", adjust: -0.05 },
  { value: "exempt", label: "Too new to need one", adjust: 0 },
];

// Multi-select tick list. Everything here is something an appraiser would find
// in ten minutes, so declaring it up front keeps the estimate honest rather
// than collapsing it on the forecourt.
export const ISSUES = [
  { value: "warningLight", label: "A warning light is on", adjust: -0.04 },
  { value: "bodywork", label: "Dents, scrapes or rust", adjust: -0.05 },
  { value: "wheels", label: "Kerbed or damaged wheels", adjust: -0.015 },
  { value: "glass", label: "Chipped or cracked windscreen", adjust: -0.015 },
  { value: "tyres", label: "Tyres need replacing", adjust: -0.02 },
  { value: "interior", label: "Damaged or heavily worn interior", adjust: -0.02 },
  { value: "aircon", label: "Air conditioning not working", adjust: -0.015 },
  { value: "smoker", label: "Smoked in", adjust: -0.015 },
  { value: "imported", label: "Imported vehicle", adjust: -0.03 },
  // Priced as a step change below, not as another percentage in the stack.
  { value: "nonRunner", label: "Not currently driveable", adjust: 0 },
];

export const WRITE_OFF_OPTIONS = [
  { value: "none", label: "No, never written off", adjust: 0 },
  { value: "catN", label: "Yes - Category N or D", adjust: -0.2 },
  { value: "catS", label: "Yes - Category S or C", adjust: -0.3 },
  { value: "unsure", label: "Not sure", adjust: -0.05 },
];

export const FINANCE_OPTIONS = [
  { value: "no", label: "No outstanding finance" },
  { value: "yes", label: "Yes, there is finance to settle" },
  { value: "unsure", label: "Not sure" },
];

// ---------------------------------------------------------------------------
// Segment scaling
// ---------------------------------------------------------------------------

// Badge tiers. Anything unlisted falls to "mainstream", which is the right
// default for a volume brand and keeps the engine usable for any make DVLA
// returns rather than only the ones enumerated here.
const MAKE_TIERS = [
  {
    tier: "luxury",
    factor: 1.75,
    makes: [
      "PORSCHE", "BENTLEY", "MASERATI", "FERRARI", "LAMBORGHINI", "ASTON MARTIN",
      "MCLAREN", "ROLLS-ROYCE", "LAND ROVER", "RANGE ROVER", "JAGUAR",
    ],
  },
  {
    tier: "premium",
    factor: 1.35,
    makes: [
      "BMW", "MERCEDES-BENZ", "MERCEDES", "AUDI", "VOLVO", "MINI", "ALFA ROMEO",
      "DS", "CUPRA", "JEEP", "INFINITI", "SUBARU", "LOTUS", "ABARTH",
      // Tesla, Polestar and Lexus price like a premium badge, not a luxury one.
      // Putting Tesla in the luxury tier compounded with the electric fuel
      // factor below and produced estimates a long way over the real market.
      "TESLA", "LEXUS", "GENESIS", "POLESTAR",
    ],
  },
  {
    tier: "value",
    factor: 0.82,
    makes: [
      "DACIA", "MG", "FIAT", "SSANGYONG", "KGM", "PROTON", "PERODUA",
      "CHEVROLET", "CHRYSLER", "SMART", "GREAT WALL", "ISUZU",
    ],
  },
];

function makeTier(make) {
  const key = String(make || "").trim().toUpperCase();
  const hit = MAKE_TIERS.find((row) => row.makes.includes(key));
  return hit || { tier: "mainstream", factor: 1 };
}

// DVLA fuelType strings are free-ish text ("HEAVY OIL", "ELECTRIC DIESEL"), so
// match on substrings rather than an exact set. Order matters: the first hit
// wins, so the compound fuels are tested before the plain ones.
const FUEL_FACTORS = [
  { test: /HYBRID|ELECTRIC DIESEL|ELECTRIC PETROL/, factor: 1.12 },
  { test: /PLUG|PHEV/, factor: 1.2 },
  { test: /ELECTRIC|\bEV\b/, factor: 1.3 },
  { test: /DIESEL|HEAVY OIL/, factor: 1.05 },
  { test: /PETROL|GAS/, factor: 1 },
];

function fuelFactor(fuelType) {
  const key = String(fuelType || "").toUpperCase();
  const hit = FUEL_FACTORS.find((row) => row.test.test(key));
  return hit ? hit.factor : 1;
}

const isElectric = (fuelType) => /ELECTRIC|\bEV\b/.test(String(fuelType || "").toUpperCase())
  && !/HYBRID|PETROL|DIESEL/.test(String(fuelType || "").toUpperCase());

// Used EVs have fallen much harder than the retention curve below assumes -
// battery-health doubt, a fast-moving new-car market and the charging estate
// all price in. Applied from three years old, where the divergence starts.
function electricPenalty(fuelType, age) {
  if (!isElectric(fuelType) || age < 3) return 1;
  return 0.85;
}

// Engine size relative to a 1600cc baseline, gently applied and clamped so a
// big diesel cannot run away with the number. EVs report no capacity at all.
function engineFactor(engineCapacity) {
  const cc = Number(engineCapacity);
  if (!Number.isFinite(cc) || cc <= 0) return 1;
  const raw = 1 + ((cc - 1600) / 1600) * 0.18;
  return Math.min(1.3, Math.max(0.9, raw));
}

// ---------------------------------------------------------------------------
// Depreciation
// ---------------------------------------------------------------------------

// Retained share of new list price, at retail, by age in years. Interpolated
// between points; older than the last point holds the floor.
const RETENTION_CURVE = [
  [0, 0.88],
  [1, 0.76],
  [2, 0.67],
  [3, 0.58],
  [4, 0.51],
  [5, 0.44],
  [6, 0.38],
  [7, 0.33],
  [8, 0.28],
  [10, 0.21],
  [12, 0.15],
  [15, 0.1],
  [20, 0.07],
];

function retainedAt(age) {
  const years = Math.max(0, Number(age) || 0);
  const last = RETENTION_CURVE[RETENTION_CURVE.length - 1];
  if (years >= last[0]) return last[1];
  for (let i = 0; i < RETENTION_CURVE.length - 1; i += 1) {
    const [x0, y0] = RETENTION_CURVE[i];
    const [x1, y1] = RETENTION_CURVE[i + 1];
    if (years >= x0 && years <= x1) {
      const t = x1 === x0 ? 0 : (years - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}

// What a dealer can pay against retail once preparation, warranty and the
// margin the business runs on are taken out.
const TRADE_FACTOR = 0.85;

// Average UK annual mileage. Anything meaningfully over or under this moves the
// number, which is the single biggest lever after age.
const EXPECTED_ANNUAL_MILES = 9000;

function mileageAdjustment(mileage, age) {
  const miles = Number(mileage);
  if (!Number.isFinite(miles) || miles < 0) return 0;
  const expected = Math.max(3000, EXPECTED_ANNUAL_MILES * Math.max(0, age));
  const diff = miles - expected;
  const pct = -(diff / 10000) * 0.06;
  return Math.min(0.15, Math.max(-0.3, pct));
}

const pick = (options, value) => options.find((o) => o.value === value) || null;
const adjustOf = (options, value) => pick(options, value)?.adjust ?? 0;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const formatGbp = (value) => gbp.format(Math.max(0, Math.round(Number(value) || 0)));

// Round to a figure a person would say out loud. Precision here would be a lie
// about how exact the estimate is.
function roundMoney(value) {
  const v = Math.max(0, Number(value) || 0);
  const step = v >= 5000 ? 100 : 50;
  return Math.round(v / step) * step;
}

// "+4%" / "-8%", for the "what moved your estimate" list.
export const formatEffect = (effect) => {
  const pct = Math.round(effect * 1000) / 10;
  return `${pct > 0 ? "+" : ""}${pct}%`;
};

// ---------------------------------------------------------------------------
// The estimate
// ---------------------------------------------------------------------------

/**
 * @param {object} answers Everything the wizard has collected.
 * @param {object} [options]
 * @param {number} [options.now] Injectable "current year", for tests.
 * @returns {object} Either { ok: false, reason } or the full estimate.
 */
export function estimateValuation(answers = {}, options = {}) {
  const {
    make,
    year,
    fuelType,
    engineCapacity,
    bodyType,
    transmission,
    mileage,
    condition,
    serviceHistory,
    owners,
    keys,
    mot,
    issues = [],
    writeOff,
    finance,
    dvlaConfirmed = false,
  } = answers;

  const body = pick(BODY_TYPES, bodyType);
  const yearNum = Number(year);

  if (!body || !Number.isFinite(yearNum) || yearNum < 1900) {
    return { ok: false, reason: "Not enough detail yet to estimate a value." };
  }

  const currentYear = Number(options.now) || new Date().getFullYear();
  const age = Math.max(0, currentYear - yearNum);

  const tier = makeTier(make);
  const newPrice = body.base * tier.factor * fuelFactor(fuelType) * engineFactor(engineCapacity);
  const retailNow = newPrice * retainedAt(age) * electricPenalty(fuelType, age);
  const baseTrade = retailNow * TRADE_FACTOR;

  // Every lever is a percentage of the base, summed and applied once. Additive
  // rather than compounded, so no single answer can quietly dominate and the
  // "what moved your estimate" list on the result screen stays truthful.
  const factors = [];
  const addFactor = (label, effect, detail) => {
    if (!effect) return;
    factors.push({ label, effect, detail });
  };

  const milesAdj = mileageAdjustment(mileage, age);
  const expectedMileage = Math.round(Math.max(3000, EXPECTED_ANNUAL_MILES * age));
  addFactor(
    milesAdj >= 0 ? "Below average mileage" : "Above average mileage",
    milesAdj,
    `Around ${Math.round(expectedMileage / 1000)}k miles would be average at ${age} year${age === 1 ? "" : "s"} old.`,
  );

  const conditionAdj = adjustOf(CONDITIONS, condition);
  addFactor(`Condition: ${pick(CONDITIONS, condition)?.label || "Good"}`, conditionAdj);

  const historyAdj = adjustOf(SERVICE_HISTORY, serviceHistory);
  addFactor(pick(SERVICE_HISTORY, serviceHistory)?.label || "Service history", historyAdj);

  const ownersAdj = adjustOf(OWNER_BANDS, owners);
  addFactor(`Owners: ${pick(OWNER_BANDS, owners)?.label || "Not sure"}`, ownersAdj);

  const keysAdj = adjustOf(KEY_OPTIONS, keys);
  addFactor(pick(KEY_OPTIONS, keys)?.label || "Keys", keysAdj);

  const motAdj = adjustOf(MOT_OPTIONS, mot);
  addFactor(`MOT: ${pick(MOT_OPTIONS, mot)?.label || "Unknown"}`, motAdj);

  const transmissionAdj = adjustOf(TRANSMISSIONS, transmission);
  addFactor(pick(TRANSMISSIONS, transmission)?.label || "Transmission", transmissionAdj);

  const selectedIssues = Array.isArray(issues) ? issues : [];
  const nonRunner = selectedIssues.includes("nonRunner");
  const declaredCount = selectedIssues.filter((v) => v !== "nonRunner").length;
  let issuesAdj = 0;
  selectedIssues.forEach((value) => {
    issuesAdj += adjustOf(ISSUES, value);
  });
  addFactor(`${declaredCount} thing${declaredCount === 1 ? "" : "s"} declared`, issuesAdj);

  const writeOffAdj = adjustOf(WRITE_OFF_OPTIONS, writeOff);
  addFactor(pick(WRITE_OFF_OPTIONS, writeOff)?.label || "Write-off history", writeOffAdj);

  const totalAdj =
    milesAdj +
    conditionAdj +
    historyAdj +
    ownersAdj +
    keysAdj +
    motAdj +
    transmissionAdj +
    issuesAdj +
    writeOffAdj;

  // Floor the multiplier: a stack of bad answers should push the vehicle to the
  // bottom of the market, not through it.
  let multiplier = Math.max(0.15, 1 + totalAdj);

  // A vehicle that will not drive is a recovery job plus a set of unknowns, so
  // it is a step change rather than another percentage in the stack.
  if (nonRunner) multiplier *= 0.45;

  const mid = Math.max(120, baseTrade * multiplier);
  // A non-runner, or a vehicle DVLA could not confirm, deserves a wider band -
  // the spread IS the honesty.
  const spread = nonRunner || !dvlaConfirmed ? 0.12 : 0.075;

  const low = roundMoney(mid * (1 - spread));
  const high = roundMoney(mid * (1 + spread));
  const midRounded = roundMoney(mid);

  const notes = [];
  if (finance === "yes") {
    notes.push(
      "We settle outstanding finance directly with your lender and pay you the difference. Bring your settlement figure with you.",
    );
  } else if (finance === "unsure") {
    notes.push(
      "If there is finance on the vehicle we settle it directly with the lender. We can check the balance for you.",
    );
  }
  if (nonRunner) {
    notes.push(
      "Because the vehicle is not currently driveable this estimate is deliberately wide, and we would need to quote collection separately.",
    );
  }
  if (writeOff === "unsure") {
    notes.push("We run a full history check in person, which confirms whether the vehicle has ever been written off.");
  }
  if (!dvlaConfirmed) {
    notes.push("We could not confirm this vehicle with DVLA, so the estimate rests entirely on the details you entered.");
  }

  return {
    ok: true,
    low,
    mid: midRounded,
    high,
    lowLabel: formatGbp(low),
    midLabel: formatGbp(midRounded),
    highLabel: formatGbp(high),
    confidence: dvlaConfirmed && condition && serviceHistory ? "high" : "medium",
    age,
    expectedMileage,
    factors: factors.slice().sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)),
    notes,
  };
}
