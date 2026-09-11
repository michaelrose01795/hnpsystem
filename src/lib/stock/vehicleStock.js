// file location: src/lib/stock/vehicleStock.js
// Vehicle sales stock — the DMS-side source of truth for every car the
// dealership has for sale.
//
// WHAT THIS IS
// ------------
// The forecourt/sales stock list. It is deliberately NOT public.vehicles (that
// table is customer-owned cars coming through the workshop) and NOT the
// website_vehicles marketing collection (a hand-written advert list that drifts
// from what is actually on site). Everything customer-facing — the Cars block
// on /website, the /website/available-stock search, and every
// /website/stock/<reg> detail page — reads this module, so a car that is not in
// stock here cannot appear on the website.
//
// The records below are MOCK data standing in for the stock table until it
// exists. The query surface (listStock / getStockByReg / filterStock /
// stockFacets / sortStock) is the contract the eventual DB helper in
// src/lib/database/ must satisfy, so swapping the array for a Supabase read is
// a change to this file alone.
//
// IDENTITY — read stockNumber.js before touching `stockNumber`
// ------------------------------------------------------------
// A stock record is keyed by its stock number, never by its registration. The
// same plate can pass through the forecourt more than once; RETIRED_STOCK below
// carries two such records on purpose. getStockByReg only ever resolves a reg
// to the CURRENT listing, so a new advert can never inherit an old one's price,
// photos or history.

import { createStockNumberIssuer } from "./stockNumber";

export const STOCK_STATUS = {
  AVAILABLE: "available",
  RESERVED: "reserved",
  SOLD: "sold",
};

const IMG = {
  swift:
    "https://images.67degreescdn.co.uk/TFK7QKvuB5vSgQ8a4JwwCH48hzA=/459x/144/6/0e11e749a4f9f7b8c0d0_q2-2026-uk-swift_web_banner_1920x873px_v2.jpg",
  vitara:
    "https://images.67degreescdn.co.uk/gyEfuN1I3-fOixzTQvMqg37i_HU=/459x/144/6/a0d5bf05ac46154454fe_q2-2026-uk-vitara_facelift-web_1920x873px.jpg",
  scross:
    "https://images.67degreescdn.co.uk/hBhV9Gbp44dEsw52VTga7T9Pjrw=/459x/144/6/9c10a56552d3b2795a73_q2-2026-uk-s-cross_web-1920x873px_v2.jpg",
  evitara:
    "https://images.67degreescdn.co.uk/afZfv58mznDRosA8FiLaIkM49fY=/459x/144/6/c8c7152a46ab73307016_q2-2026-uk-e-vitara_web-banner_1920x873px.jpg",
  swace:
    "https://images.67degreescdn.co.uk/AgkFogLUkLm05PFEzDGsnldjx9w=/479x479/smart/144/6/1719341738667b12aac180e_overview.jpg",
  forecourt:
    "https://images.67degreescdn.co.uk/8frG0OWBndXZg4XkXeCTxoZDnqQ=/479x479/smart/144/6/17041871276593d4f70761f_h-p-homepage-second-image.jpeg",
  showroom:
    "https://images.67degreescdn.co.uk/kWdMmJColsQoohYLdV5U2GoGoA0=/479x479/smart/144/6/1719341105667b10312bd98_waiting.jpg",
  detail:
    "https://images.67degreescdn.co.uk/OxvrVgI7NLjSg9hGumadDgUC4eM=/459x500/smart/144/6/1738080472679900d86a1f5_p1123308-edit.jpg",
};

// Records as the sales team enters them — no stock number yet. Numbers are
// issued below so the mock data exercises the same guard live stock will.
const STOCK_INTAKE = [
  /* ------------------------------- NEW ------------------------------- */
  {
    reg: "AB26 SWV",
    condition: "new",
    make: "Suzuki",
    model: "Swift",
    derivative: "1.2 Hybrid Ultra 5dr",
    year: 2026,
    price: 21699,
    monthly: 249,
    mileage: 12,
    fuel: "Hybrid",
    transmission: "Manual",
    bodyStyle: "Hatchback",
    colour: "Frontier Blue Metallic",
    doors: 5,
    seats: 5,
    engineSize: "1.2",
    co2: 99,
    mpg: 64.2,
    owners: 0,
    motDue: null,
    serviceHistory: "Brand new — first service due at 12 months",
    badge: "0% APR",
    highlights: ["0% APR available", "3 year warranty", "Adaptive cruise control"],
    features: [
      "9-inch touchscreen with Apple CarPlay",
      "Adaptive cruise control",
      "Dual sensor brake support",
      "Heated front seats",
      "Rear parking camera",
    ],
    description:
      "The latest Swift Ultra in Frontier Blue, delivery mileage only. Hybrid assistance makes it genuinely cheap to run around Kent, and the Ultra trim adds the heated seats and adaptive cruise most owners want.",
    images: [IMG.swift, IMG.showroom, IMG.forecourt],
    stockedAt: "2026-08-14",
    location: "West Malling showroom",
  },
  {
    reg: "AB26 VTR",
    condition: "new",
    make: "Suzuki",
    model: "Vitara",
    derivative: "1.5 Full Hybrid Ultra ALLGRIP",
    year: 2026,
    price: 29499,
    monthly: 329,
    mileage: 8,
    fuel: "Hybrid",
    transmission: "Automatic",
    bodyStyle: "SUV",
    colour: "Cool White Pearl",
    doors: 5,
    seats: 5,
    engineSize: "1.5",
    co2: 118,
    mpg: 55.4,
    owners: 0,
    motDue: null,
    serviceHistory: "Brand new — first service due at 12 months",
    badge: "0% PCP",
    highlights: ["ALLGRIP four-wheel drive", "0% PCP available", "Panoramic sunroof"],
    features: [
      "ALLGRIP SELECT four-wheel drive",
      "Panoramic sliding sunroof",
      "Suzuki Connect services",
      "360 degree camera",
      "Leather upholstery",
    ],
    description:
      "Full Hybrid Vitara with ALLGRIP, the version to have if you use the lanes in winter. Ultra specification throughout, including the panoramic roof and 360 degree camera.",
    images: [IMG.vitara, IMG.forecourt, IMG.showroom],
    stockedAt: "2026-08-02",
    location: "West Malling showroom",
  },
  {
    reg: "AB26 SCR",
    condition: "new",
    make: "Suzuki",
    model: "S-Cross",
    derivative: "1.5 Full Hybrid Motion",
    year: 2026,
    price: 27450,
    monthly: 309,
    mileage: 22,
    fuel: "Hybrid",
    transmission: "Automatic",
    bodyStyle: "SUV",
    colour: "Titan Dark Grey",
    doors: 5,
    seats: 5,
    engineSize: "1.5",
    co2: 121,
    mpg: 53.3,
    owners: 0,
    motDue: null,
    serviceHistory: "Brand new — first service due at 12 months",
    badge: "£3,050 saving",
    highlights: ["£3,050 customer saving", "Full hybrid automatic", "Wireless charging"],
    features: [
      "Wireless smartphone charging",
      "Blind spot monitor",
      "Rear cross traffic alert",
      "Keyless entry and start",
      "Polished 17-inch alloys",
    ],
    description:
      "Registered this month and discounted by £3,050 against list. The full hybrid drivetrain runs on electric power at town speeds, so it suits short local journeys far better than the old mild hybrid.",
    images: [IMG.scross, IMG.showroom, IMG.forecourt],
    stockedAt: "2026-09-01",
    location: "West Malling showroom",
  },
  {
    reg: "AB26 EVT",
    condition: "new",
    make: "Suzuki",
    model: "e-Vitara",
    derivative: "61kWh Ultra",
    year: 2026,
    price: 33999,
    monthly: 379,
    mileage: 5,
    fuel: "Electric",
    transmission: "Automatic",
    bodyStyle: "SUV",
    colour: "Land Breeze Green",
    doors: 5,
    seats: 5,
    engineSize: null,
    co2: 0,
    mpg: null,
    rangeMiles: 265,
    owners: 0,
    motDue: null,
    serviceHistory: "Brand new — first service due at 24 months",
    badge: "All-electric",
    highlights: ["265 mile range", "150kW rapid charging", "Heat pump fitted"],
    features: [
      "150kW DC rapid charging",
      "Heat pump",
      "Vehicle-to-load power take-off",
      "Heated steering wheel",
      "Two-tone roof",
    ],
    description:
      "Suzuki's first bespoke electric car, with the larger 61kWh battery and a real-world range comfortably past 240 miles. Personal Contract Hire quotes available the same day.",
    images: [IMG.evitara, IMG.forecourt, IMG.detail],
    stockedAt: "2026-08-28",
    location: "West Malling showroom",
  },
  {
    reg: "AB26 IGN",
    condition: "new",
    make: "Suzuki",
    model: "Ignis",
    derivative: "1.2 Dualjet Hybrid SZ5",
    year: 2026,
    price: 19245,
    monthly: 219,
    mileage: 16,
    fuel: "Hybrid",
    transmission: "Manual",
    bodyStyle: "Hatchback",
    colour: "Flame Orange",
    doors: 5,
    seats: 4,
    engineSize: "1.2",
    co2: 104,
    mpg: 60.1,
    owners: 0,
    motDue: null,
    serviceHistory: "Brand new — first service due at 12 months",
    badge: null,
    highlights: ["Sliding rear seats", "Under 3.7m long", "Top SZ5 trim"],
    features: [
      "Sliding and reclining rear seats",
      "Satellite navigation",
      "Climate control",
      "Rear privacy glass",
      "16-inch polished alloys",
    ],
    description:
      "The easiest car we sell to park, and the SZ5 gets the sliding rear bench that makes the boot usable. Flame Orange with the black roof.",
    images: [IMG.showroom, IMG.forecourt],
    stockedAt: "2026-07-19",
    location: "West Malling showroom",
  },

  /* ------------------------------- USED ------------------------------ */
  {
    reg: "SF23 XKD",
    condition: "used",
    make: "Suzuki",
    model: "Swift",
    derivative: "1.2 Dualjet Hybrid SZ-T 5dr",
    year: 2023,
    price: 13995,
    monthly: 189,
    mileage: 18420,
    fuel: "Hybrid",
    transmission: "Manual",
    bodyStyle: "Hatchback",
    colour: "Speedy Blue Metallic",
    doors: 5,
    seats: 5,
    engineSize: "1.2",
    co2: 106,
    mpg: 58.9,
    owners: 1,
    motDue: "2027-03-11",
    serviceHistory: "Full Suzuki service history",
    badge: "Sold here new",
    highlights: ["One owner", "Full Suzuki history", "Supplied new by us"],
    features: [
      "Apple CarPlay and Android Auto",
      "Rear parking camera",
      "Cruise control",
      "DAB radio",
      "Air conditioning",
    ],
    description:
      "We supplied this Swift new in 2023 and have serviced it ever since, so we know exactly what it has had done. One owner from new and just over 18,000 miles.",
    images: [IMG.swift, IMG.detail, IMG.forecourt],
    stockedAt: "2026-08-20",
    location: "West Malling forecourt",
  },
  {
    reg: "GK72 VTA",
    condition: "used",
    make: "Suzuki",
    model: "Vitara",
    derivative: "1.4 Boosterjet Hybrid SZ5 ALLGRIP",
    year: 2022,
    price: 18749,
    monthly: 249,
    mileage: 27310,
    fuel: "Petrol",
    transmission: "Manual",
    bodyStyle: "SUV",
    colour: "Bright Red 5",
    doors: 5,
    seats: 5,
    engineSize: "1.4",
    co2: 132,
    mpg: 48.7,
    owners: 2,
    motDue: "2027-01-04",
    serviceHistory: "Full service history, 3 stamps",
    badge: null,
    highlights: ["ALLGRIP four-wheel drive", "Panoramic roof", "Heated seats"],
    features: [
      "ALLGRIP four-wheel drive",
      "Panoramic sunroof",
      "Heated front seats",
      "Satellite navigation",
      "Adaptive cruise control",
    ],
    description:
      "SZ5 ALLGRIP with the Boosterjet engine — the quickest Vitara of its generation and still returning close to 50mpg on a run. Two owners and a full history.",
    images: [IMG.vitara, IMG.forecourt, IMG.detail],
    stockedAt: "2026-07-30",
    location: "West Malling forecourt",
  },
  {
    reg: "LV71 SCX",
    condition: "used",
    make: "Suzuki",
    model: "S-Cross",
    derivative: "1.4 Boosterjet Hybrid SZ-T",
    year: 2021,
    price: 15495,
    monthly: 209,
    mileage: 34980,
    fuel: "Petrol",
    transmission: "Automatic",
    bodyStyle: "SUV",
    colour: "Galactic Grey Metallic",
    doors: 5,
    seats: 5,
    engineSize: "1.4",
    co2: 137,
    mpg: 46.3,
    owners: 1,
    motDue: "2026-11-22",
    serviceHistory: "Full Suzuki service history",
    badge: null,
    highlights: ["Automatic", "One owner", "12 months MOT on collection"],
    features: [
      "Six-speed automatic",
      "Rear parking sensors",
      "Dual zone climate control",
      "Smartphone mirroring",
      "17-inch alloys",
    ],
    description:
      "One-owner automatic S-Cross with a full Suzuki history. We MOT every used car before it leaves, so it goes out with a fresh twelve months.",
    images: [IMG.scross, IMG.showroom],
    stockedAt: "2026-08-08",
    location: "West Malling forecourt",
  },
  {
    reg: "YE70 JMN",
    condition: "used",
    make: "Suzuki",
    model: "Jimny",
    derivative: "1.5 SZ5 ALLGRIP",
    year: 2020,
    price: 21995,
    monthly: 299,
    mileage: 29640,
    fuel: "Petrol",
    transmission: "Manual",
    bodyStyle: "SUV",
    colour: "Kinetic Yellow",
    doors: 3,
    seats: 4,
    engineSize: "1.5",
    co2: 154,
    mpg: 35.8,
    owners: 2,
    motDue: "2027-02-18",
    serviceHistory: "Full service history",
    badge: "Rare",
    highlights: ["Genuine 4x4 low range", "Kinetic Yellow", "Sought after"],
    features: [
      "ALLGRIP PRO with low range",
      "Hill descent control",
      "Heated seats",
      "Satellite navigation",
      "Tow bar fitted",
    ],
    description:
      "Passenger-registered SZ5 Jimny in Kinetic Yellow with a tow bar already fitted. These hold their money better than anything else on the forecourt.",
    images: [IMG.forecourt, IMG.detail],
    stockedAt: "2026-06-25",
    location: "West Malling forecourt",
  },
  {
    reg: "MA23 SWC",
    condition: "used",
    make: "Suzuki",
    model: "Swace",
    derivative: "1.8 Hybrid Motion",
    year: 2023,
    price: 18749,
    monthly: 239,
    mileage: 21870,
    fuel: "Hybrid",
    transmission: "Automatic",
    bodyStyle: "Estate",
    colour: "Cosmic Black",
    doors: 5,
    seats: 5,
    engineSize: "1.8",
    co2: 103,
    mpg: 62.8,
    owners: 1,
    motDue: "2027-04-02",
    serviceHistory: "Full Suzuki service history",
    badge: null,
    highlights: ["596 litre boot", "Self-charging hybrid", "One owner"],
    features: [
      "Self-charging hybrid",
      "Adaptive cruise control",
      "Lane departure alert",
      "Heated front seats",
      "Reversing camera",
    ],
    description:
      "The estate nobody expects Suzuki to make: 596 litres of boot, a self-charging hybrid drivetrain and close to 60mpg in daily use. One owner from new.",
    images: [IMG.swace, IMG.detail, IMG.forecourt],
    stockedAt: "2026-08-26",
    location: "West Malling forecourt",
  },
  {
    reg: "HN69 ACR",
    condition: "used",
    make: "Suzuki",
    model: "Across",
    derivative: "2.5 Plug-in Hybrid E-Four",
    year: 2021,
    price: 24995,
    monthly: 329,
    mileage: 31250,
    fuel: "Plug-in Hybrid",
    transmission: "Automatic",
    bodyStyle: "SUV",
    colour: "Dark Blue Mica",
    doors: 5,
    seats: 5,
    engineSize: "2.5",
    co2: 22,
    mpg: 282.5,
    rangeMiles: 46,
    owners: 1,
    motDue: "2027-05-14",
    serviceHistory: "Full service history",
    badge: "Plug-in",
    highlights: ["46 mile electric range", "Four-wheel drive", "Low company car tax"],
    features: [
      "46 mile pure electric range",
      "E-Four all-wheel drive",
      "JBL premium audio",
      "Heated and ventilated seats",
      "Powered tailgate",
    ],
    description:
      "Plug-in hybrid Across with the full 46 mile electric range — most owners never touch the petrol engine on the school run. Still a very low benefit-in-kind car.",
    images: [IMG.detail, IMG.forecourt, IMG.showroom],
    stockedAt: "2026-07-11",
    location: "West Malling forecourt",
  },
  {
    reg: "OU24 IGS",
    condition: "used",
    make: "Suzuki",
    model: "Ignis",
    derivative: "1.2 Dualjet Hybrid SZ-T",
    year: 2024,
    price: 14495,
    monthly: 189,
    mileage: 9480,
    fuel: "Hybrid",
    transmission: "Automatic",
    bodyStyle: "Hatchback",
    colour: "Pure White Pearl",
    doors: 5,
    seats: 4,
    engineSize: "1.2",
    co2: 107,
    mpg: 59.4,
    owners: 1,
    motDue: "2027-06-30",
    serviceHistory: "Full Suzuki service history",
    badge: "Low mileage",
    highlights: ["Under 10,000 miles", "Automatic", "Balance of Suzuki warranty"],
    features: [
      "AGS automated manual",
      "Smartphone mirroring",
      "Rear parking camera",
      "Air conditioning",
      "Balance of manufacturer warranty",
    ],
    description:
      "A 2024 Ignis with under 10,000 miles and the balance of the Suzuki warranty still to run. Automatic, and about as cheap as a nearly-new car gets to insure.",
    images: [IMG.showroom, IMG.forecourt],
    stockedAt: "2026-09-03",
    location: "West Malling forecourt",
  },
  {
    reg: "RJ22 SWF",
    condition: "used",
    make: "Suzuki",
    model: "Swift",
    derivative: "1.2 Dualjet Hybrid SZ5",
    year: 2022,
    price: 12995,
    monthly: 175,
    mileage: 24110,
    fuel: "Hybrid",
    transmission: "Manual",
    bodyStyle: "Hatchback",
    colour: "Super Black Pearl",
    doors: 5,
    seats: 5,
    engineSize: "1.2",
    co2: 105,
    mpg: 59.8,
    owners: 2,
    motDue: "2026-12-09",
    serviceHistory: "Full service history, 4 stamps",
    badge: null,
    highlights: ["Top SZ5 trim", "Adaptive cruise", "Heated seats"],
    features: [
      "Adaptive cruise control",
      "Heated front seats",
      "Satellite navigation",
      "LED headlights",
      "Rear privacy glass",
    ],
    description:
      "Top-spec SZ5 Swift with the adaptive cruise and heated seats. Four stamps in the book and a clean history check.",
    images: [IMG.swift, IMG.forecourt],
    stockedAt: "2026-06-30",
    location: "West Malling forecourt",
  },
];

// Stock that has left the forecourt. Kept here because its stock numbers are
// SPENT — the issuer is seeded with them so nothing live can collide, and the
// reg lookup must be able to tell "this plate was ours once" from "this plate
// is ours now". Both regs below also appear in STOCK_INTAKE on purpose: the
// same plates, sold years ago and back with us now under fresh numbers.
const RETIRED_STOCK = [
  {
    stockNumber: "U-24-0087",
    reg: "SF23 XKD",
    condition: "used",
    make: "Suzuki",
    model: "Swift",
    derivative: "1.2 Dualjet Hybrid SZ-T 5dr",
    year: 2023,
    price: 15995,
    mileage: 6120,
    status: STOCK_STATUS.SOLD,
    stockedAt: "2024-02-06",
    retiredAt: "2024-03-30",
  },
  // Sold NEW by us in 2022 and back as USED stock in 2026. The condition class
  // changes between visits, which is the other reason a stock number cannot be
  // derived from the plate.
  {
    stockNumber: "N-22-0044",
    reg: "RJ22 SWF",
    condition: "new",
    make: "Suzuki",
    model: "Swift",
    derivative: "1.2 Dualjet Hybrid SZ5",
    year: 2022,
    price: 18499,
    mileage: 6,
    status: STOCK_STATUS.SOLD,
    stockedAt: "2022-03-04",
    retiredAt: "2022-04-21",
  },
];

// Issue a number to every live record, seeded with everything already spent.
// Ordering by stocked date keeps the sequence in the order cars arrived.
const issuer = createStockNumberIssuer(RETIRED_STOCK.map((r) => r.stockNumber));

export const stockVehicles = STOCK_INTAKE.slice()
  .sort((a, b) => String(a.stockedAt).localeCompare(String(b.stockedAt)))
  .map((record) => ({
    ...record,
    status: STOCK_STATUS.AVAILABLE,
    stockNumber: issuer.issue({ condition: record.condition, stockedAt: record.stockedAt }),
    title: `${record.make} ${record.model}`,
    subtitle: record.derivative,
  }));

export const retiredStockVehicles = RETIRED_STOCK;

/* ------------------------------------------------------------------ */
/* Query surface                                                       */
/* ------------------------------------------------------------------ */

const normaliseReg = (reg) => String(reg || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** URL-safe form of a registration — `SF23 XKD` -> `sf23xkd`. */
export const regToSlug = (reg) => normaliseReg(reg).toLowerCase();

/** Newest-first list of everything currently for sale. */
export const listStock = () =>
  stockVehicles
    .filter((v) => v.status === STOCK_STATUS.AVAILABLE)
    .slice()
    .sort((a, b) => String(b.stockedAt).localeCompare(String(a.stockedAt)));

/**
 * Resolve a registration to its CURRENT listing.
 *
 * Retired records are never returned: a plate that has been through the
 * forecourt before must not resurrect the old advert. When a reg matches only
 * retired stock the caller gets null and should render "no longer available"
 * rather than stale detail.
 */
export const getStockByReg = (reg) => {
  const wanted = normaliseReg(reg);
  if (!wanted) return null;
  return listStock().find((v) => normaliseReg(v.reg) === wanted) || null;
};

/** True when the reg was ours once but is not in stock now. */
export const wasPreviouslyInStock = (reg) => {
  const wanted = normaliseReg(reg);
  if (!wanted || getStockByReg(reg)) return false;
  return retiredStockVehicles.some((v) => normaliseReg(v.reg) === wanted);
};

export const getStockByNumber = (stockNumber) => {
  const wanted = String(stockNumber || "").toUpperCase();
  return (
    stockVehicles.find((v) => v.stockNumber === wanted) ||
    retiredStockVehicles.find((v) => v.stockNumber === wanted) ||
    null
  );
};

export const PRICE_BANDS = [
  { value: "0-15000", label: "Under £15,000", min: 0, max: 15000 },
  { value: "15000-20000", label: "£15,000 – £20,000", min: 15000, max: 20000 },
  { value: "20000-25000", label: "£20,000 – £25,000", min: 20000, max: 25000 },
  { value: "25000-30000", label: "£25,000 – £30,000", min: 25000, max: 30000 },
  { value: "30000-", label: "£30,000 and above", min: 30000, max: Infinity },
];

export const MILEAGE_BANDS = [
  { value: "0-1000", label: "Delivery mileage", min: 0, max: 1000 },
  { value: "0-15000", label: "Under 15,000", min: 0, max: 15000 },
  { value: "0-30000", label: "Under 30,000", min: 0, max: 30000 },
  { value: "0-60000", label: "Under 60,000", min: 0, max: 60000 },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Latest arrivals" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "mileage-asc", label: "Mileage: lowest first" },
  { value: "year-desc", label: "Year: newest first" },
];

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort();

/** Option lists for the search filters, derived from what is actually in stock. */
export const stockFacets = (list = listStock()) => ({
  models: uniqueSorted(list.map((v) => v.model)),
  fuels: uniqueSorted(list.map((v) => v.fuel)),
  transmissions: uniqueSorted(list.map((v) => v.transmission)),
  bodyStyles: uniqueSorted(list.map((v) => v.bodyStyle)),
});

const withinBand = (bands, value, selected) => {
  if (!selected) return true;
  const band = bands.find((b) => b.value === selected);
  if (!band) return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return n >= band.min && n <= band.max;
};

const matchesText = (vehicle, query) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    vehicle.make,
    vehicle.model,
    vehicle.derivative,
    vehicle.colour,
    vehicle.fuel,
    vehicle.bodyStyle,
    vehicle.transmission,
    vehicle.reg,
    vehicle.stockNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
};

/**
 * Apply the customer-facing search filters.
 * `condition` accepts "all" (or an empty value) to mean no condition filter.
 */
export const filterStock = (list, filters = {}) => {
  const { condition, query, model, fuel, transmission, bodyStyle, priceBand, mileageBand } = filters;
  return list.filter((v) => {
    if (condition && condition !== "all" && v.condition !== condition) return false;
    if (model && v.model !== model) return false;
    if (fuel && v.fuel !== fuel) return false;
    if (transmission && v.transmission !== transmission) return false;
    if (bodyStyle && v.bodyStyle !== bodyStyle) return false;
    if (!withinBand(PRICE_BANDS, v.price, priceBand)) return false;
    if (!withinBand(MILEAGE_BANDS, v.mileage, mileageBand)) return false;
    return matchesText(v, query);
  });
};

export const sortStock = (list, sort = "newest") => {
  const out = list.slice();
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => a.price - b.price);
    case "price-desc":
      return out.sort((a, b) => b.price - a.price);
    case "mileage-asc":
      return out.sort((a, b) => a.mileage - b.mileage);
    case "year-desc":
      return out.sort((a, b) => b.year - a.year || b.price - a.price);
    case "newest":
    default:
      return out.sort((a, b) => String(b.stockedAt).localeCompare(String(a.stockedAt)));
  }
};

/* ------------------------------------------------------------------ */
/* Formatting — shared so the card, the search row and the detail page  */
/* all render a price or a mileage the same way.                        */
/* ------------------------------------------------------------------ */

export const formatPrice = (value) =>
  Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      })
    : "POA";

export const formatMileage = (value) =>
  Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("en-GB")} miles` : "—";

/** "From £21,699" for new stock, "£13,995" for used. */
export const priceLabel = (vehicle) =>
  vehicle?.condition === "new" ? `From ${formatPrice(vehicle.price)}` : formatPrice(vehicle?.price);

/** Delivery-mileage cars read better as "Delivery mileage" than "12 miles". */
export const mileageLabel = (vehicle) => {
  if (!Number.isFinite(Number(vehicle?.mileage))) return "—";
  if (vehicle.condition === "new" && Number(vehicle.mileage) <= 100) return "Delivery mileage";
  return formatMileage(vehicle.mileage);
};

/** The customer-site URL for a stock record. */
export const stockHref = (vehicle) => `/website/stock/${regToSlug(vehicle?.reg)}`;
