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
// HOW THE MOCK RECORDS ARE BUILT
// ------------------------------
// Each car in STOCK_INTAKE names a VARIANT (the engine / body the factory
// builds — performance, economy, boot space, photos) and a TRIM (the equipment
// level). `buildRecord` merges the three, so a Swift Ultra and a Swift Motion
// share their mechanical facts but not their kit list, and every car still ends
// up as one flat record with the full field set the detail page reads.
//
// PHOTOS
// ------
// Real photographs of each model from Wikimedia Commons (hotlinked, CC BY /
// CC BY-SA — the file name is the attribution key on commons.wikimedia.org).
// They show the right model, not the individual car; the live stock feed will
// replace them with the dealership's own forecourt shots.
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

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

// "e/e8/File_name.jpg" -> the 960px Commons thumbnail of that file.
const commons = (path) => {
  const file = path.split("/").pop();
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/960px-${file}`;
};

// `exterior` photos rotate per car so two Swifts do not open on the same shot;
// `detail` photos (rears, interiors) always follow them.
const PHOTOS = {
  swift24: {
    exterior: [
      "e/e8/Suzuki_Swift_%282024%29_hybrid_IMG_9683.jpg",
      "0/06/Suzuki_Swift_%282024%29_hybrid_IMG_1873.jpg",
      "3/3d/Suzuki_Swift_%282024%29_hybrid_DSC_6076.jpg",
      "3/30/Suzuki_Swift_%282024%29_hybrid_DSC_7922.jpg",
    ],
    detail: [
      "8/8a/Suzuki_Swift_%282024%29_hybrid_IMG_9686.jpg",
      "7/7c/Suzuki_Swift_%282024%29_hybrid_DSC_7923.jpg",
      "e/ea/Suzuki_Swift_%282024%29_hybrid_IMG_2582.jpg",
    ],
  },
  swift17: {
    exterior: [
      "0/08/2020_Suzuki_Swift_Facelift_IMG_1880.jpg",
      "0/08/2020_Suzuki_Swift_Facelift_IMG_1881.jpg",
    ],
    detail: ["2/2c/2020_Suzuki_Swift_Facelift_IMG_1884.jpg"],
  },
  swiftSport: {
    exterior: [
      "f/f3/Suzuki_Swift_Sport_%2850731460538%29.jpg",
      "6/6c/Suzuki_Swift_Sport_%282019%29_%2853980959214%29.jpg",
      "e/e0/2019_Suzuki_Swift_Sport_Boosterjet.jpg",
    ],
    detail: [
      "7/77/Suzuki_SWIFT_Sport_%28TA-HT81S%29_front.jpg",
      "5/58/Suzuki_SWIFT_Sport_%28TA-HT81S%29_rear.jpg",
    ],
  },
  vitara: {
    exterior: [
      "8/8f/2023_Suzuki_Vitara_hybrid_in_White%2C_front_right%2C_06-06-2025.jpg",
      "7/75/Suzuki_Vitara_%284th_generation%29_IMG_4186.jpg",
      "1/1b/Suzuki_Vitara_Turbo_%28IV%2C_Facelift%29_%E2%80%93_f_02012026.jpg",
      "8/8f/Suzuki_Vitara_Turbo%2C_2018_front.jpg",
    ],
    detail: [
      "a/a9/2023_Suzuki_Vitara_hybrid_in_White%2C_rear_right%2C_06-06-2025.jpg",
      "1/10/Suzuki_Vitara_in_Ireland.jpg",
    ],
  },
  scross: {
    exterior: [
      "6/6e/2022_Suzuki_S-Cross.jpg",
      "d/d6/Suzuki_S-Cross_%28third_generation%29.jpg",
      "6/64/2022_Suzuki_SX4_S-Cross_AllGrip_Hybrid_01.jpg",
      "9/9b/SUZUKI_S-CROSS_China.jpg",
    ],
    detail: [
      "7/7f/2022_Suzuki_SX4_S-Cross_AllGrip_Hybrid_02.jpg",
      "1/1e/2022_Suzuki_SX4_S-Cross_AllGrip_Hybrid_%28rear%29.jpg",
      "7/7c/2022_Suzuki_SX4_S-Cross_AllGrip_Hybrid_Interior.jpg",
    ],
  },
  evitara: {
    exterior: [
      "1/1d/2025_Suzuki_e_Vitara_front_view.jpg",
      "1/1c/Suzuki_e_Vitara_in_Hamamatsu_Sta_front.jpg",
      "a/a2/Suzuki_e_Vitara_Z_4WD.jpg",
    ],
    detail: ["8/81/Suzuki_e_Vitara_in_Hamamatsu_Sta_rear.jpg"],
  },
  ignis: {
    exterior: [
      "3/33/2020_Suzuki_Ignis_SZ-T_Dualjet_MHEV_CVT_facelift_1.2_Front.jpg",
      "2/2b/Suzuki_Ignis_%28third_generation%29_Facelift_IMG_3656.jpg",
      "9/95/Suzuki_Ignis_GL_facelift%2C_2020_front.jpg",
      "6/6c/Suzuki_Ignis_1.2_SHVS_%282020%29_%2854727772454%29.jpg",
    ],
    detail: [
      "c/cd/2020_Suzuki_Ignis_SZ-T_Dualjet_MHEV_CVT_facelift_1.2_Rear.jpg",
      "2/2e/Suzuki_Ignis_GL_facelift%2C_2020_rear.jpg",
      "4/4b/2020_Suzuki_Ignis_facelift_Interior.jpg",
    ],
  },
  jimny: {
    exterior: [
      "5/53/2019_Suzuki_Jimny_SZ5_4X4_Automatic_1.5_%281%29.jpg",
      "6/63/2019_Suzuki_Jimny_1.5.jpg",
      "4/42/2019_Suzuki_Jimny_4x4_1.5_JB74W_%2820210812%29.jpg",
      "7/74/Suzuki_Jimny_Solitude_Revival_2019_IMG_1765.jpg",
    ],
    detail: ["e/e3/2019_Suzuki_Jimny_AllGrip_Interior.jpg"],
  },
  swace: {
    exterior: [
      "d/d9/2023_Suzuki_Swace_1X7A7186.jpg",
      "2/24/Suzuki_Swace_1X7A0433.jpg",
      "1/14/2023_Suzuki_Swace_Auto_Zuerich_2023_1X7A1475.jpg",
    ],
    detail: ["1/1c/Suzuki_Swace_%28LRM_20210814_100507%29.jpg"],
  },
  across: {
    exterior: [
      "3/39/2020_Suzuki_Across_E-Four_2.5.jpg",
      "6/6c/Suzuki_Across_%28XA50%29_1X7A0314.jpg",
      "3/33/Suzuki_Across_%28XA50%29_1X7A6320.jpg",
    ],
    detail: ["8/89/Suzuki_Across_%28XA50%29_Auto_Zuerich_2021_IMG_0436.jpg"],
  },
};

const photosFor = (set, offset = 0) => {
  const { exterior, detail } = PHOTOS[set];
  const start = offset % exterior.length;
  return [...exterior.slice(start), ...exterior.slice(0, start), ...detail].map(commons);
};

/* ------------------------------------------------------------------ */
/* Variants and trims                                                  */
/* ------------------------------------------------------------------ */

// Mechanical facts per engine / body. `co2` and `mpg` are the WLTP combined
// figures for the manual (or only) gearbox; a car on a different gearbox
// overrides them in its own record.
const VARIANTS = {
  swift24: {
    model: "Swift", photos: "swift24", fuel: "Hybrid", transmission: "Manual", bodyStyle: "Hatchback",
    doors: 5, seats: 5, engineSize: "1.2", powerBhp: 81, zeroToSixty: 12.5, topSpeed: 103,
    bootLitres: 265, insuranceGroup: "14E", co2: 99, mpg: 64.2,
    features: ["12V mild hybrid system", "LED headlights", "Emergency brake support"],
  },
  swift17: {
    model: "Swift", photos: "swift17", fuel: "Hybrid", transmission: "Manual", bodyStyle: "Hatchback",
    doors: 5, seats: 5, engineSize: "1.2", powerBhp: 82, zeroToSixty: 13.1, topSpeed: 111,
    bootLitres: 265, insuranceGroup: "13E", co2: 106, mpg: 58.9,
    features: ["SHVS mild hybrid system", "Dual sensor brake support", "Hill hold control"],
  },
  swiftSport: {
    model: "Swift", photos: "swiftSport", fuel: "Hybrid", transmission: "Manual", bodyStyle: "Hatchback",
    doors: 5, seats: 5, engineSize: "1.4", powerBhp: 127, zeroToSixty: 9.1, topSpeed: 130,
    bootLitres: 265, insuranceGroup: "30E", co2: 127, mpg: 50.4,
    features: ["1.4 Boosterjet turbo engine", "Sports suspension", "Twin exhaust tailpipes"],
  },
  vitara: {
    model: "Vitara", photos: "vitara", fuel: "Hybrid", transmission: "Manual", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: "1.4", powerBhp: 127, zeroToSixty: 9.5, topSpeed: 118,
    bootLitres: 375, insuranceGroup: "20E", co2: 128, mpg: 49.6,
    features: ["1.4 Boosterjet 48V mild hybrid", "Dual sensor brake support", "Traffic sign recognition"],
  },
  vitaraFH: {
    model: "Vitara", photos: "vitara", fuel: "Hybrid", transmission: "Automatic", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: "1.5", powerBhp: 114, zeroToSixty: 12.5, topSpeed: 112,
    bootLitres: 289, insuranceGroup: "19E", co2: 125, mpg: 51.4,
    features: ["1.5 full hybrid with EV mode", "Auto Gear Shift transmission", "Traffic sign recognition"],
  },
  scross: {
    model: "S-Cross", photos: "scross", fuel: "Hybrid", transmission: "Manual", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: "1.4", powerBhp: 127, zeroToSixty: 9.5, topSpeed: 121,
    bootLitres: 430, insuranceGroup: "21E", co2: 127, mpg: 50.4,
    features: ["1.4 Boosterjet 48V mild hybrid", "Dual sensor brake support", "Lane keep assist"],
  },
  scrossFH: {
    model: "S-Cross", photos: "scross", fuel: "Hybrid", transmission: "Automatic", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: "1.5", powerBhp: 114, zeroToSixty: 12.7, topSpeed: 108,
    bootLitres: 380, insuranceGroup: "20E", co2: 121, mpg: 53.3,
    features: ["1.5 full hybrid with EV mode", "Auto Gear Shift transmission", "Lane keep assist"],
  },
  evitara49: {
    model: "e-Vitara", photos: "evitara", fuel: "Electric", transmission: "Automatic", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: null, powerBhp: 142, zeroToSixty: 9.6, topSpeed: 93,
    bootLitres: 306, insuranceGroup: "25E", co2: 0, mpg: null, rangeMiles: 214, batteryKwh: 49,
    features: ["49kWh battery", "Heat pump", "Type 2 and CCS charging"],
  },
  evitara61: {
    model: "e-Vitara", photos: "evitara", fuel: "Electric", transmission: "Automatic", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: null, powerBhp: 172, zeroToSixty: 8.7, topSpeed: 93,
    bootLitres: 306, insuranceGroup: "28E", co2: 0, mpg: null, rangeMiles: 265, batteryKwh: 61,
    features: ["61kWh battery", "Heat pump", "Vehicle-to-load power take-off"],
  },
  evitara61awd: {
    model: "e-Vitara", photos: "evitara", fuel: "Electric", transmission: "Automatic", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: null, powerBhp: 181, zeroToSixty: 7.4, topSpeed: 93,
    bootLitres: 306, insuranceGroup: "30E", co2: 0, mpg: null, rangeMiles: 246, batteryKwh: 61,
    features: ["61kWh battery", "ALLGRIP-e dual motor four-wheel drive", "Heat pump"],
  },
  ignis: {
    model: "Ignis", photos: "ignis", fuel: "Hybrid", transmission: "Manual", bodyStyle: "Hatchback",
    doors: 5, seats: 4, engineSize: "1.2", powerBhp: 82, zeroToSixty: 12.2, topSpeed: 106,
    bootLitres: 267, insuranceGroup: "13E", co2: 104, mpg: 60.1,
    features: ["Dualjet mild hybrid system", "Sliding and reclining rear seats", "Hill hold control"],
  },
  jimny: {
    model: "Jimny", photos: "jimny", fuel: "Petrol", transmission: "Manual", bodyStyle: "SUV",
    doors: 3, seats: 4, engineSize: "1.5", powerBhp: 100, zeroToSixty: 11.9, topSpeed: 90,
    bootLitres: 85, insuranceGroup: "22E", co2: 154, mpg: 35.8,
    features: ["ALLGRIP PRO with low range transfer box", "Ladder frame chassis", "Hill descent control"],
  },
  swace: {
    model: "Swace", photos: "swace", fuel: "Hybrid", transmission: "Automatic", bodyStyle: "Estate",
    doors: 5, seats: 5, engineSize: "1.8", powerBhp: 120, zeroToSixty: 11.1, topSpeed: 112,
    bootLitres: 596, insuranceGroup: "17E", co2: 103, mpg: 62.8,
    features: ["1.8 self-charging hybrid", "Pre-collision system", "Road sign assist"],
  },
  across: {
    model: "Across", photos: "across", fuel: "Plug-in Hybrid", transmission: "Automatic", bodyStyle: "SUV",
    doors: 5, seats: 5, engineSize: "2.5", powerBhp: 302, zeroToSixty: 6.0, topSpeed: 112,
    bootLitres: 490, insuranceGroup: "38E", co2: 22, mpg: 282.5, rangeMiles: 46, batteryKwh: 18.1,
    features: ["2.5 plug-in hybrid", "E-Four electric all-wheel drive", "Powered tailgate"],
  },
};

// Equipment each trim ADDS. Suzuki's ladder is SZ3 < SZ-T < SZ5 up to 2023,
// Motion < Ultra from the 2024 range on.
const TRIMS = {
  SZ3: ["DAB radio with Bluetooth", "Air conditioning", "LED daytime running lights", "Electric front windows"],
  "SZ-T": [
    "7-inch touchscreen with Apple CarPlay and Android Auto",
    "Rear parking camera",
    "16-inch alloy wheels",
    "Rear privacy glass",
    "Air conditioning",
  ],
  SZ5: [
    "Satellite navigation",
    "Adaptive cruise control",
    "Automatic climate control",
    "Keyless entry and start",
    "Rear parking camera",
    "Electric folding door mirrors",
  ],
  Motion: [
    "9-inch touchscreen with wireless Apple CarPlay",
    "Adaptive cruise control",
    "Rear parking camera",
    "Automatic air conditioning",
    "16-inch alloy wheels",
  ],
  Ultra: [
    "9-inch touchscreen with satellite navigation",
    "Adaptive cruise control",
    "Heated front seats",
    "Keyless entry and start",
    "Blind spot monitor",
    "Rear cross traffic alert",
    "360 degree camera",
  ],
  Sport: [
    "Sports seats with red detailing",
    "17-inch polished alloys",
    "Satellite navigation",
    "Adaptive cruise control",
    "Keyless entry and start",
  ],
  Across: [
    "9-inch touchscreen with satellite navigation",
    "JBL premium audio",
    "Heated front seats and steering wheel",
    "Head-up display",
    "Wireless phone charging",
  ],
};

const unique = (list) => Array.from(new Set(list));

const warrantyFor = (car) => {
  if (car.condition === "new") return "3 years or 60,000 miles Suzuki warranty";
  if (car.year >= 2023) return "Balance of Suzuki warranty, plus 12 months Humphries & Parks cover";
  return "12 months Humphries & Parks used car warranty included";
};

const drivetrainFor = (car) => {
  if (/ALLGRIP|E-Four|4x4/i.test(`${car.derivative} ${car.variant}`) || car.variant === "jimny") {
    return "Four-wheel drive";
  }
  return "Front-wheel drive";
};

const emissionsStandardFor = (car, variant) => {
  if (variant.fuel === "Electric") return "Zero tailpipe emissions";
  return car.year >= 2020 ? "Euro 6d" : "Euro 6";
};

// Flatten variant + trim + car into the single record the site reads.
const buildRecord = ({ variant: key, trim, extras = [], photoOffset = 0, ...car }) => {
  const variant = VARIANTS[key];
  const { photos, features, ...facts } = variant;
  return {
    make: "Suzuki",
    ...facts,
    ...car,
    variant: key,
    trim,
    drivetrain: drivetrainFor({ ...car, variant: key }),
    emissionsStandard: emissionsStandardFor(car, variant),
    warranty: car.warranty || warrantyFor(car),
    keys: car.keys ?? 2,
    ulezCompliant: true,
    features: unique([...(TRIMS[trim] || []), ...features, ...extras]),
    images: photosFor(photos, photoOffset),
    location: car.location || (car.condition === "new" ? "West Malling showroom" : "West Malling forecourt"),
  };
};

const NEW_HISTORY = "Brand new — first service due at 12 months";

// Records as the sales team enters them — no stock number yet. Numbers are
// issued below so the mock data exercises the same guard live stock will.
const STOCK_INTAKE = [
  /* ------------------------------- NEW ------------------------------- */
  {
    reg: "AB26 SWV", condition: "new", variant: "swift24", trim: "Ultra",
    derivative: "1.2 Hybrid Ultra 5dr", year: 2026, price: 21699, monthly: 249, mileage: 12,
    colour: "Frontier Blue Pearl Metallic", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "0% APR",
    highlights: ["0% APR available", "3 year warranty", "Adaptive cruise control"],
    description:
      "The latest Swift Ultra in Frontier Blue, delivery mileage only. Hybrid assistance makes it genuinely cheap to run around Kent, and the Ultra trim adds the heated seats and adaptive cruise most owners want.",
    stockedAt: "2026-08-14",
  },
  {
    reg: "AB26 SWM", condition: "new", variant: "swift24", trim: "Motion", photoOffset: 1,
    derivative: "1.2 Hybrid Motion 5dr", year: 2026, price: 19499, monthly: 219, mileage: 9,
    colour: "Burning Red Pearl Metallic", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "Best seller",
    highlights: ["Under £20,000 new", "64mpg combined", "Wireless Apple CarPlay"],
    description:
      "The Swift most of our customers choose. Motion trim already has adaptive cruise, a reversing camera and wireless CarPlay, so there is very little reason to spend more unless you want heated seats.",
    stockedAt: "2026-09-05",
  },
  {
    reg: "AB26 SWC", condition: "new", variant: "swift24", trim: "Motion", photoOffset: 2,
    derivative: "1.2 Hybrid Motion CVT 5dr", year: 2026, price: 20999, monthly: 235, mileage: 14,
    transmission: "Automatic", co2: 108, mpg: 59.5, zeroToSixty: 13.1,
    colour: "Pure White Pearl", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: null,
    highlights: ["CVT automatic", "Ideal first automatic", "3 year warranty"],
    description:
      "Swift Motion with the smooth CVT automatic — the easiest way into a new automatic for under £21,000. Pure White with black interior trim.",
    stockedAt: "2026-08-22",
  },
  {
    reg: "AB26 SWA", condition: "new", variant: "swift24", trim: "Ultra", photoOffset: 3,
    derivative: "1.2 Hybrid Ultra ALLGRIP 5dr", year: 2026, price: 22999, monthly: 259, mileage: 18,
    co2: 112, mpg: 57.0, zeroToSixty: 13.4,
    colour: "Cool Yellow Metallic", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "ALLGRIP",
    highlights: ["Four-wheel drive supermini", "Heated seats", "Cool Yellow with black roof"],
    description:
      "One of very few four-wheel drive superminis you can still buy new. ALLGRIP AUTO sends drive to the rear only when the front wheels slip, so economy barely suffers.",
    stockedAt: "2026-07-28",
  },
  {
    reg: "AB26 VTR", condition: "new", variant: "vitaraFH", trim: "Ultra",
    derivative: "1.5 Full Hybrid Ultra ALLGRIP", year: 2026, price: 29499, monthly: 329, mileage: 8,
    co2: 135, mpg: 47.5,
    colour: "Cool White Pearl", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "0% PCP",
    highlights: ["ALLGRIP four-wheel drive", "0% PCP available", "Panoramic sunroof"],
    extras: ["Panoramic sliding sunroof", "Suzuki Connect services", "Leather upholstery"],
    description:
      "Full Hybrid Vitara with ALLGRIP, the version to have if you use the lanes in winter. Ultra specification throughout, including the panoramic roof and 360 degree camera.",
    stockedAt: "2026-08-02",
  },
  {
    reg: "AB26 VIT", condition: "new", variant: "vitara", trim: "Motion", photoOffset: 1,
    derivative: "1.4 Boosterjet Mild Hybrid Motion", year: 2026, price: 25349, monthly: 289, mileage: 11,
    colour: "Sphere Blue Pearl", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "£1,500 deposit contribution",
    highlights: ["Turbocharged 127bhp", "£1,500 finance deposit contribution", "375 litre boot"],
    description:
      "The punchy Boosterjet Vitara in Sphere Blue. It is the quickest Vitara in the range and the one to pick if most of your miles are motorway rather than town.",
    stockedAt: "2026-08-30",
  },
  {
    reg: "AB26 SCR", condition: "new", variant: "scrossFH", trim: "Motion",
    derivative: "1.5 Full Hybrid Motion", year: 2026, price: 27450, monthly: 309, mileage: 22,
    colour: "Titan Dark Grey Pearl", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "£3,050 saving",
    highlights: ["£3,050 customer saving", "Full hybrid automatic", "Wireless charging"],
    extras: ["Wireless smartphone charging", "Polished 17-inch alloys"],
    description:
      "Registered this month and discounted by £3,050 against list. The full hybrid drivetrain runs on electric power at town speeds, so it suits short local journeys far better than the old mild hybrid.",
    stockedAt: "2026-09-01",
  },
  {
    reg: "AB26 SXU", condition: "new", variant: "scross", trim: "Ultra", photoOffset: 2,
    derivative: "1.4 Boosterjet Mild Hybrid Ultra ALLGRIP", year: 2026, price: 30499, monthly: 339, mileage: 6,
    co2: 138, mpg: 46.3,
    colour: "Energetic Red Pearl Metallic", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: null,
    highlights: ["Top-spec Ultra ALLGRIP", "430 litre boot", "Panoramic roof"],
    extras: ["Panoramic sliding sunroof", "Leather upholstery", "LED projector headlights"],
    description:
      "Everything S-Cross: the turbo engine, four-wheel drive with Snow and Lock modes, the panoramic roof and leather. A big, practical family car that still tows 1,500kg.",
    stockedAt: "2026-07-24",
  },
  {
    reg: "AB26 EVT", condition: "new", variant: "evitara61", trim: "Ultra",
    derivative: "61kWh Ultra", year: 2026, price: 33999, monthly: 379, mileage: 5,
    colour: "Land Breeze Green with Black Roof", owners: 0, motDue: null,
    serviceHistory: "Brand new — first service due at 24 months",
    warranty: "3 years or 60,000 miles Suzuki warranty, battery 8 years or 100,000 miles",
    badge: "All-electric",
    highlights: ["265 mile range", "150kW rapid charging", "Heat pump fitted"],
    extras: ["150kW DC rapid charging", "Heated steering wheel", "Two-tone roof"],
    description:
      "Suzuki's first bespoke electric car, with the larger 61kWh battery and a real-world range comfortably past 240 miles. Personal Contract Hire quotes available the same day.",
    stockedAt: "2026-08-28",
  },
  {
    reg: "AB26 EVM", condition: "new", variant: "evitara49", trim: "Motion", photoOffset: 1,
    derivative: "49kWh Motion", year: 2026, price: 28499, monthly: 319, mileage: 7,
    colour: "Arctic White Pearl", owners: 0, motDue: null,
    serviceHistory: "Brand new — first service due at 24 months",
    warranty: "3 years or 60,000 miles Suzuki warranty, battery 8 years or 100,000 miles",
    badge: "Electric Car Grant",
    highlights: ["214 mile range", "Electric Car Grant applied", "Free home charger survey"],
    extras: ["10.25-inch driver display", "Heated front seats"],
    description:
      "The entry e-Vitara, with the government Electric Car Grant already taken off the price. 214 miles covers a week of commuting for most of our customers.",
    stockedAt: "2026-09-08",
  },
  {
    reg: "AB26 EVA", condition: "new", variant: "evitara61awd", trim: "Ultra", photoOffset: 2,
    derivative: "61kWh Ultra ALLGRIP-e", year: 2026, price: 37499, monthly: 419, mileage: 10,
    colour: "Opulent Red Pearl with Black Roof", owners: 0, motDue: null,
    serviceHistory: "Brand new — first service due at 24 months",
    warranty: "3 years or 60,000 miles Suzuki warranty, battery 8 years or 100,000 miles",
    badge: "Dual motor",
    highlights: ["Dual motor four-wheel drive", "0–62mph in 7.4 seconds", "Trail mode"],
    extras: ["150kW DC rapid charging", "Trail mode", "Heated steering wheel"],
    description:
      "The dual-motor e-Vitara — properly quick, and with a Trail mode that brakes a spinning wheel so it genuinely copes with a muddy field. Opulent Red over a black roof.",
    stockedAt: "2026-08-11",
  },
  {
    reg: "AB26 IGN", condition: "new", variant: "ignis", trim: "SZ5",
    derivative: "1.2 Dualjet Hybrid SZ5", year: 2026, price: 19245, monthly: 219, mileage: 16,
    colour: "Flame Orange Pearl Metallic", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: null,
    highlights: ["Sliding rear seats", "Under 3.7m long", "Top SZ5 trim"],
    extras: ["Rear privacy glass", "16-inch polished alloys"],
    description:
      "The easiest car we sell to park, and the SZ5 gets the sliding rear bench that makes the boot usable. Flame Orange with the black roof.",
    stockedAt: "2026-07-19",
  },
  {
    reg: "AB26 SWE", condition: "new", variant: "swace", trim: "Ultra",
    derivative: "1.8 Hybrid Ultra CVT", year: 2026, price: 29999, monthly: 335, mileage: 13,
    colour: "Precious Silver Metallic", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "Last of the line",
    highlights: ["596 litre boot", "Self-charging hybrid", "Final 2026 allocation"],
    extras: ["Heated front seats", "Wireless phone charging", "Front and rear parking sensors"],
    description:
      "One of our last new Swace estates. Enormous boot, a hybrid system with a decade of reliability behind it, and Ultra kit including heated seats.",
    stockedAt: "2026-06-18",
  },
  {
    reg: "AB26 ACR", condition: "new", variant: "across", trim: "Across",
    derivative: "2.5 Plug-in Hybrid E-Four", year: 2026, price: 46999, monthly: 529, mileage: 20,
    colour: "Sensual Red Mica", owners: 0, motDue: null, serviceHistory: NEW_HISTORY,
    badge: "Plug-in",
    highlights: ["46 mile electric range", "302bhp", "Low benefit-in-kind"],
    extras: ["Heated and ventilated front seats", "Panoramic sunroof", "11kW onboard charger"],
    description:
      "Suzuki's flagship plug-in hybrid. Most of the week it is an electric car; for the long run it is a 302bhp four-wheel drive SUV with nothing to plan around.",
    stockedAt: "2026-07-06",
  },

  /* ------------------------------- USED ------------------------------ */
  {
    reg: "SF23 XKD", condition: "used", variant: "swift17", trim: "SZ-T",
    derivative: "1.2 Dualjet Hybrid SZ-T 5dr", year: 2023, price: 13995, monthly: 189, mileage: 18420,
    colour: "Speedy Blue Metallic", owners: 1, motDue: "2027-03-11",
    serviceHistory: "Full Suzuki service history", badge: "Sold here new",
    highlights: ["One owner", "Full Suzuki history", "Supplied new by us"],
    extras: ["Cruise control", "DAB radio"],
    description:
      "We supplied this Swift new in 2023 and have serviced it ever since, so we know exactly what it has had done. One owner from new and just over 18,000 miles.",
    stockedAt: "2026-08-20",
  },
  {
    reg: "RJ22 SWF", condition: "used", variant: "swift17", trim: "SZ5", photoOffset: 1,
    derivative: "1.2 Dualjet Hybrid SZ5", year: 2022, price: 12995, monthly: 175, mileage: 24110,
    co2: 105, mpg: 59.8,
    colour: "Super Black Pearl", owners: 2, motDue: "2026-12-09",
    serviceHistory: "Full service history, 4 stamps", badge: null,
    highlights: ["Top SZ5 trim", "Adaptive cruise", "Heated seats"],
    extras: ["Heated front seats", "LED headlights", "Rear privacy glass"],
    description:
      "Top-spec SZ5 Swift with the adaptive cruise and heated seats. Four stamps in the book and a clean history check.",
    stockedAt: "2026-06-30",
  },
  {
    reg: "KP74 SWT", condition: "used", variant: "swift24", trim: "Ultra", photoOffset: 2,
    derivative: "1.2 Hybrid Ultra CVT 5dr", year: 2024, price: 16995, monthly: 219, mileage: 11200,
    transmission: "Automatic", co2: 108, mpg: 59.5, zeroToSixty: 13.1,
    colour: "Premium Silver Metallic", owners: 1, motDue: "2027-10-31",
    serviceHistory: "Full Suzuki service history", badge: "Nearly new",
    highlights: ["Current shape Swift", "Automatic", "Suzuki warranty to 2027"],
    description:
      "Current-shape Swift Ultra automatic at a little over 11,000 miles. Serviced by us at 12 months, and the manufacturer warranty runs until late 2027.",
    stockedAt: "2026-09-10",
  },
  {
    reg: "EA24 SWN", condition: "used", variant: "swift24", trim: "Motion", photoOffset: 3,
    derivative: "1.2 Hybrid Motion 5dr", year: 2024, price: 14995, monthly: 199, mileage: 15850,
    colour: "Frontier Blue Pearl Metallic", owners: 1, motDue: "2027-06-22",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["64mpg combined", "£20 a year road tax band", "One owner"],
    description:
      "Ex-Motability Swift Motion in Frontier Blue, returned at the end of its agreement with every service done on time by a Suzuki dealer. No marks on the bumpers or wheels.",
    stockedAt: "2026-08-17",
  },
  {
    reg: "BD19 SPT", condition: "used", variant: "swiftSport", trim: "Sport",
    derivative: "1.4 Boosterjet Sport 5dr", year: 2019, price: 13495, monthly: 189, mileage: 42100,
    fuel: "Petrol", co2: 135, mpg: 47.1, powerBhp: 138, zeroToSixty: 8.1,
    colour: "Champion Yellow", owners: 2, motDue: "2027-09-01",
    serviceHistory: "Full service history, 6 stamps, cambelt not required (chain)", badge: "Enthusiast pick",
    highlights: ["Pre-hybrid 138bhp Sport", "Only 975kg", "Champion Yellow"],
    extras: ["LED headlights", "Aluminium sports pedals"],
    description:
      "The last Swift Sport before the hybrid system arrived, and the lightest — under a tonne. Champion Yellow, two owners, and a new set of Continental tyres fitted before sale.",
    stockedAt: "2026-07-15",
  },
  {
    reg: "WR21 SPR", condition: "used", variant: "swiftSport", trim: "Sport", photoOffset: 1,
    derivative: "1.4 Boosterjet Hybrid Sport 5dr", year: 2021, price: 17495, monthly: 229, mileage: 22400,
    colour: "Flame Red Pearl Metallic", owners: 1, motDue: "2027-04-18",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["48V hybrid Sport", "One owner", "Under 23,000 miles"],
    extras: ["Blind spot monitor", "Rear cross traffic alert"],
    description:
      "A one-owner Swift Sport hybrid with low miles and full Suzuki history. Still genuinely fun on a B-road, but 50mpg when you are not enjoying it.",
    stockedAt: "2026-08-24",
  },
  {
    reg: "FG20 SWZ", condition: "used", variant: "swift17", trim: "SZ-T",
    derivative: "1.2 Dualjet SHVS SZ-T 5dr", year: 2020, price: 9995, monthly: 159, mileage: 38700,
    colour: "Burning Red Pearl Metallic", owners: 2, motDue: "2027-08-14",
    serviceHistory: "Full service history, 5 stamps", badge: "Under £10k",
    highlights: ["Under £10,000", "Apple CarPlay", "Reversing camera"],
    description:
      "A tidy SZ-T Swift for under ten thousand pounds, with the touchscreen and reversing camera that make it feel much newer than a 2020 car.",
    stockedAt: "2026-07-02",
  },
  {
    reg: "CV68 SWB", condition: "used", variant: "swift17", trim: "SZ3", photoOffset: 1,
    derivative: "1.2 Dualjet SZ3 5dr", year: 2018, price: 7995, monthly: 139, mileage: 51200,
    fuel: "Petrol", co2: 112, mpg: 57.0, powerBhp: 89, zeroToSixty: 11.9,
    colour: "Premium Silver Metallic", owners: 3, motDue: "2027-09-10", keys: 1,
    serviceHistory: "Part service history, 4 stamps plus invoices", badge: "First car",
    highlights: ["Insurance group 11", "First car favourite", "Fresh MOT"],
    insuranceGroup: "11E",
    description:
      "The simplest Swift, which is why it makes such a good first car: cheap to insure, easy to see out of and very little to go wrong. Supplied with one key.",
    stockedAt: "2026-09-02",
  },
  {
    reg: "NX20 SWK", condition: "used", variant: "swift17", trim: "SZ5",
    derivative: "1.2 Dualjet SHVS SZ5 ALLGRIP 5dr", year: 2020, price: 10995, monthly: 165, mileage: 33800,
    co2: 114, mpg: 55.4,
    colour: "Mineral Grey Metallic", owners: 1, motDue: "2027-05-29",
    serviceHistory: "Full Suzuki service history", badge: "ALLGRIP",
    highlights: ["Four-wheel drive", "One owner", "Heated seats"],
    extras: ["Heated front seats", "LED headlights"],
    description:
      "A rare four-wheel drive Swift, owned by one retired couple near Sevenoaks who bought it for the icy hill up to their house. Full Suzuki history.",
    stockedAt: "2026-06-12",
  },
  {
    reg: "GK72 VTA", condition: "used", variant: "vitara", trim: "SZ5",
    derivative: "1.4 Boosterjet Hybrid SZ5 ALLGRIP", year: 2022, price: 18749, monthly: 249, mileage: 27310,
    co2: 132, mpg: 48.7,
    colour: "Bright Red", owners: 2, motDue: "2027-01-04",
    serviceHistory: "Full service history, 3 stamps", badge: null,
    highlights: ["ALLGRIP four-wheel drive", "Panoramic roof", "Heated seats"],
    extras: ["Panoramic sunroof", "Heated front seats"],
    description:
      "SZ5 ALLGRIP with the Boosterjet engine — the quickest Vitara of its generation and still returning close to 50mpg on a run. Two owners and a full history.",
    stockedAt: "2026-07-30",
  },
  {
    reg: "GJ73 VTS", condition: "used", variant: "vitara", trim: "Ultra", photoOffset: 2,
    derivative: "1.4 Boosterjet Mild Hybrid Ultra", year: 2023, price: 20995, monthly: 269, mileage: 14200,
    colour: "Solar Yellow Pearl Metallic with Black Roof", owners: 1, motDue: "2026-09-30",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["Ultra trim", "Under 15,000 miles", "MOT before handover"],
    extras: ["Panoramic sliding sunroof", "Suede and leather seats"],
    description:
      "A striking Solar Yellow Vitara Ultra with a black roof. Its first MOT falls due this month, so we will test it before handover and it leaves with a full twelve months.",
    stockedAt: "2026-08-05",
  },
  {
    reg: "LB20 VTG", condition: "used", variant: "vitara", trim: "SZ-T", photoOffset: 3,
    derivative: "1.4 Boosterjet SZ-T", year: 2020, price: 13995, monthly: 199, mileage: 41900,
    fuel: "Petrol", co2: 141, mpg: 45.6, powerBhp: 138,
    colour: "Galactic Grey Metallic", owners: 2, motDue: "2027-08-22",
    serviceHistory: "Full service history, 5 stamps", badge: null,
    highlights: ["Turbo petrol", "Towbar fitted", "Fresh MOT"],
    extras: ["Detachable towbar", "Rear parking sensors"],
    description:
      "Pre-hybrid Boosterjet Vitara with a detachable towbar already fitted — it was used to pull a small caravan, and has the service stamps to show it was looked after.",
    stockedAt: "2026-06-21",
  },
  {
    reg: "KN22 VFH", condition: "used", variant: "vitaraFH", trim: "SZ-T", photoOffset: 1,
    derivative: "1.5 Full Hybrid SZ-T AGS", year: 2022, price: 18495, monthly: 245, mileage: 26800,
    colour: "Ice Greyish Blue Metallic", owners: 1, motDue: "2027-03-28",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["Full hybrid automatic", "EV mode in town", "One owner"],
    description:
      "Full hybrid Vitara automatic that drives on electric power alone at low speeds. One company owner, serviced at Suzuki dealers every year.",
    stockedAt: "2026-08-12",
  },
  {
    reg: "ML24 VFU", condition: "used", variant: "vitaraFH", trim: "Ultra", photoOffset: 2,
    derivative: "1.5 Full Hybrid Ultra ALLGRIP AGS", year: 2024, price: 24495, monthly: 309, mileage: 9100,
    co2: 135, mpg: 47.5,
    colour: "Cool White Pearl with Black Roof", owners: 1, motDue: "2027-03-15",
    serviceHistory: "Full Suzuki service history", badge: "Ex-demonstrator",
    highlights: ["Our own demonstrator", "ALLGRIP four-wheel drive", "Under 10,000 miles"],
    extras: ["Panoramic sliding sunroof", "Leather upholstery"],
    description:
      "Our own showroom demonstrator, now replaced by the facelift. Maintained by our workshop from day one and saving over £6,000 against the new price.",
    stockedAt: "2026-09-09",
  },
  {
    reg: "LV71 SCX", condition: "used", variant: "scross", trim: "SZ-T",
    derivative: "1.4 Boosterjet Hybrid SZ-T", year: 2021, price: 15495, monthly: 209, mileage: 34980,
    transmission: "Automatic", co2: 137, mpg: 46.3,
    colour: "Galactic Grey Metallic", owners: 1, motDue: "2026-11-22",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["Automatic", "One owner", "12 months MOT on collection"],
    extras: ["Six-speed automatic", "Rear parking sensors", "Dual zone climate control"],
    description:
      "One-owner automatic S-Cross with a full Suzuki history. We MOT every used car before it leaves, so it goes out with a fresh twelve months.",
    stockedAt: "2026-08-08",
  },
  {
    reg: "PE72 SCU", condition: "used", variant: "scross", trim: "Ultra", photoOffset: 1,
    derivative: "1.4 Boosterjet Mild Hybrid Ultra ALLGRIP", year: 2022, price: 21995, monthly: 279, mileage: 23800,
    co2: 138, mpg: 46.3,
    colour: "Sphere Blue Pearl", owners: 1, motDue: "2027-01-19",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["Top-spec Ultra", "Four-wheel drive", "Panoramic roof"],
    extras: ["Panoramic sliding sunroof", "Leather upholstery"],
    description:
      "Current-shape S-Cross in top Ultra ALLGRIP form. Leather, panoramic roof and the 360 degree camera, with a single private owner and a full Suzuki history.",
    stockedAt: "2026-07-22",
  },
  {
    reg: "SJ23 SCM", condition: "used", variant: "scross", trim: "Motion", photoOffset: 2,
    derivative: "1.4 Boosterjet Mild Hybrid Motion", year: 2023, price: 19995, monthly: 259, mileage: 17600,
    colour: "Celestial Blue Pearl Metallic", owners: 1, motDue: "2026-10-12",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["430 litre boot", "Balance of warranty", "MOT before handover"],
    description:
      "A practical S-Cross Motion with a big 430 litre boot and the balance of the Suzuki warranty. First MOT is due next month, and we will do it before handover.",
    stockedAt: "2026-08-29",
  },
  {
    reg: "DY73 SFH", condition: "used", variant: "scrossFH", trim: "Ultra", photoOffset: 3,
    derivative: "1.5 Full Hybrid Ultra AGS", year: 2023, price: 23995, monthly: 299, mileage: 12400,
    colour: "Titan Dark Grey Pearl", owners: 1, motDue: "2026-11-04",
    serviceHistory: "Full Suzuki service history", badge: "Low mileage",
    highlights: ["Full hybrid automatic", "Ultra trim", "Only 12,400 miles"],
    extras: ["Leather upholstery", "Panoramic sliding sunroof"],
    description:
      "Low-mileage full hybrid S-Cross Ultra. A quiet, easy automatic that returns over 50mpg in mixed driving and has every option box ticked.",
    stockedAt: "2026-09-04",
  },
  {
    reg: "BT25 EVU", condition: "used", variant: "evitara61", trim: "Ultra", photoOffset: 1,
    derivative: "61kWh Ultra", year: 2025, price: 29995, monthly: 349, mileage: 4800,
    colour: "Celestial Blue Pearl Metallic with Black Roof", owners: 1, motDue: "2028-06-30",
    serviceHistory: "Brand new — first service due at 24 months",
    warranty: "Balance of Suzuki warranty, battery covered to 2033 or 100,000 miles",
    badge: "Battery health 99%",
    highlights: ["Battery health certificate: 99%", "265 mile range", "Under 5,000 miles"],
    extras: ["150kW DC rapid charging", "Heated steering wheel"],
    description:
      "A 2025 e-Vitara Ultra with a printed battery health certificate showing 99%. Saving a substantial sum against new with barely any miles on it.",
    stockedAt: "2026-08-19",
  },
  {
    reg: "OV25 EVM", condition: "used", variant: "evitara49", trim: "Motion", photoOffset: 2,
    derivative: "49kWh Motion", year: 2025, price: 25995, monthly: 309, mileage: 6200,
    colour: "Grandeur Grey Pearl", owners: 1, motDue: "2028-09-15",
    serviceHistory: "Brand new — first service due at 24 months",
    warranty: "Balance of Suzuki warranty, battery covered to 2033 or 100,000 miles",
    badge: null,
    highlights: ["Battery health certificate: 100%", "214 mile range", "Granny cable and Type 2 cable"],
    extras: ["Type 2 charging cable", "3-pin charging cable"],
    description:
      "Nearly new e-Vitara Motion, supplied with both charging cables and a battery health certificate. An inexpensive way into a new-shape electric SUV.",
    stockedAt: "2026-07-26",
  },
  {
    reg: "OU24 IGS", condition: "used", variant: "ignis", trim: "SZ-T",
    derivative: "1.2 Dualjet Hybrid SZ-T", year: 2024, price: 14495, monthly: 189, mileage: 9480,
    transmission: "Automatic", co2: 107, mpg: 59.4,
    colour: "Pure White Pearl", owners: 1, motDue: "2027-06-30",
    serviceHistory: "Full Suzuki service history", badge: "Low mileage",
    highlights: ["Under 10,000 miles", "Automatic", "Balance of Suzuki warranty"],
    extras: ["CVT automatic"],
    description:
      "A 2024 Ignis with under 10,000 miles and the balance of the Suzuki warranty still to run. Automatic, and about as cheap as a nearly-new car gets to insure.",
    stockedAt: "2026-09-03",
  },
  {
    reg: "YH20 IGT", condition: "used", variant: "ignis", trim: "SZ-T", photoOffset: 1,
    derivative: "1.2 Dualjet Hybrid SZ-T", year: 2020, price: 9495, monthly: 155, mileage: 35100,
    colour: "Tough Khaki Pearl Metallic", owners: 2, motDue: "2027-07-09",
    serviceHistory: "Full service history, 5 stamps", badge: null,
    highlights: ["Tough Khaki", "Apple CarPlay", "Under £10,000"],
    description:
      "Facelift Ignis in the Tough Khaki colour everyone asks about. SZ-T trim with the touchscreen and reversing camera, and five stamps in the book.",
    stockedAt: "2026-06-27",
  },
  {
    reg: "LS21 IGZ", condition: "used", variant: "ignis", trim: "SZ5", photoOffset: 2,
    derivative: "1.2 Dualjet Hybrid SZ5 ALLGRIP", year: 2021, price: 11495, monthly: 169, mileage: 28400,
    co2: 114, mpg: 55.4,
    colour: "Caravan Ivory Pearl Metallic with Black Roof", owners: 1, motDue: "2027-04-11",
    serviceHistory: "Full Suzuki service history", badge: "ALLGRIP",
    highlights: ["Four-wheel drive city car", "One owner", "Full Suzuki history"],
    extras: ["Hill descent control", "Grip control"],
    description:
      "The four-wheel drive Ignis — a tiny car that copes with snow and grass car parks far better than its size suggests. One owner since new.",
    stockedAt: "2026-08-01",
  },
  {
    reg: "WK19 IGC", condition: "used", variant: "ignis", trim: "SZ3", photoOffset: 3,
    derivative: "1.2 Dualjet SZ3", year: 2019, price: 7495, monthly: 135, mileage: 47800,
    fuel: "Petrol", co2: 114, mpg: 55.0, powerBhp: 89, insuranceGroup: "11E",
    colour: "Fervent Red", owners: 3, motDue: "2027-09-06", keys: 1,
    serviceHistory: "Part service history, 3 stamps", badge: "Budget buy",
    highlights: ["Insurance group 11", "Cheapest car in stock", "Fresh MOT"],
    description:
      "Our most affordable car this month. The simple non-hybrid Ignis SZ3, fresh MOT, new brake pads and a full valet. Supplied with one key.",
    stockedAt: "2026-09-06",
  },
  {
    reg: "YE70 JMN", condition: "used", variant: "jimny", trim: "SZ5",
    derivative: "1.5 SZ5 ALLGRIP", year: 2020, price: 21995, monthly: 299, mileage: 29640,
    colour: "Kinetic Yellow with Black Roof", owners: 2, motDue: "2027-02-18",
    serviceHistory: "Full service history", badge: "Rare",
    highlights: ["Genuine 4x4 low range", "Kinetic Yellow", "Sought after"],
    extras: ["Heated front seats", "Tow bar fitted"],
    description:
      "Passenger-registered SZ5 Jimny in Kinetic Yellow with a tow bar already fitted. These hold their money better than anything else on the forecourt.",
    stockedAt: "2026-06-25",
  },
  {
    reg: "RX69 JMY", condition: "used", variant: "jimny", trim: "SZ5", photoOffset: 1,
    derivative: "1.5 SZ5 ALLGRIP Automatic", year: 2019, price: 20495, monthly: 285, mileage: 44600,
    transmission: "Automatic", co2: 170, mpg: 32.8,
    colour: "Medium Grey", owners: 2, motDue: "2027-08-03",
    serviceHistory: "Full service history, 7 stamps", badge: "Automatic",
    highlights: ["Rare automatic Jimny", "Four seats", "Full history"],
    extras: ["Four-speed automatic", "Heated front seats"],
    description:
      "An automatic passenger Jimny, which is rarer still. Grey with black steels and a clean underside — we put it on the ramp for you if you would like to see.",
    stockedAt: "2026-07-09",
  },
  {
    reg: "KM20 JMB", condition: "used", variant: "jimny", trim: "SZ5", photoOffset: 2,
    derivative: "1.5 SZ5 ALLGRIP", year: 2020, price: 22995, monthly: 309, mileage: 18900,
    colour: "Jungle Green", owners: 1, motDue: "2027-03-31",
    serviceHistory: "Full Suzuki service history", badge: "Low mileage",
    highlights: ["Jungle Green", "Under 19,000 miles", "One owner"],
    extras: ["Rubber floor mats and boot liner"],
    description:
      "A one-owner, low-mileage Jimny in Jungle Green, never off-road according to its owner and the condition of the underside backs that up.",
    stockedAt: "2026-08-15",
  },
  {
    reg: "MA23 SWC", condition: "used", variant: "swace", trim: "Motion",
    derivative: "1.8 Hybrid Motion CVT", year: 2023, price: 18749, monthly: 239, mileage: 21870,
    colour: "Cosmic Black", owners: 1, motDue: "2027-04-02",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["596 litre boot", "Self-charging hybrid", "One owner"],
    extras: ["Heated front seats"],
    description:
      "The estate nobody expects Suzuki to make: 596 litres of boot, a self-charging hybrid drivetrain and close to 60mpg in daily use. One owner from new.",
    stockedAt: "2026-08-26",
  },
  {
    reg: "HF71 SWG", condition: "used", variant: "swace", trim: "Ultra", photoOffset: 1,
    derivative: "1.8 Hybrid Ultra CVT", year: 2021, price: 16495, monthly: 219, mileage: 36200,
    colour: "Pure White Pearl", owners: 1, motDue: "2027-09-12",
    serviceHistory: "Full Suzuki service history", badge: null,
    highlights: ["Ultra trim", "Hybrid battery health checked", "Fresh MOT"],
    extras: ["Heated front seats", "Wireless phone charging"],
    description:
      "A white Swace Ultra, previously a sales rep's car. The miles are motorway, the service book is full, and the hybrid battery has passed our health check.",
    stockedAt: "2026-07-18",
  },
  {
    reg: "EK22 SWL", condition: "used", variant: "swace", trim: "Motion", photoOffset: 2,
    derivative: "1.8 Hybrid Motion CVT", year: 2022, price: 17295, monthly: 229, mileage: 29900,
    colour: "Grey Metallic", owners: 2, motDue: "2027-02-25",
    serviceHistory: "Full service history, 4 stamps", badge: null,
    highlights: ["Big boot estate", "62mpg combined", "Dog guard included"],
    extras: ["Boot dog guard"],
    description:
      "Grey Swace Motion with a fitted dog guard — ideal if the boot is for four legs. Two owners and four stamps in the book.",
    stockedAt: "2026-08-09",
  },
  {
    reg: "HN71 ACR", condition: "used", variant: "across", trim: "Across",
    derivative: "2.5 Plug-in Hybrid E-Four", year: 2021, price: 24995, monthly: 329, mileage: 31250,
    colour: "Dark Blue Mica", owners: 1, motDue: "2027-05-14",
    serviceHistory: "Full service history", badge: "Plug-in",
    highlights: ["46 mile electric range", "Four-wheel drive", "Low company car tax"],
    extras: ["Heated and ventilated front seats"],
    description:
      "Plug-in hybrid Across with the full 46 mile electric range — most owners never touch the petrol engine on the school run. Still a very low benefit-in-kind car.",
    stockedAt: "2026-07-11",
  },
  {
    reg: "GN70 ACX", condition: "used", variant: "across", trim: "Across", photoOffset: 1,
    derivative: "2.5 Plug-in Hybrid E-Four", year: 2020, price: 22495, monthly: 305, mileage: 44100,
    colour: "Platinum White Pearl", owners: 2, motDue: "2027-08-28",
    serviceHistory: "Full service history, hybrid health check passed", badge: null,
    highlights: ["302bhp", "Hybrid health check passed", "Tows 1,500kg"],
    extras: ["Panoramic sunroof"],
    description:
      "An early Across in Platinum White with the panoramic roof. The plug-in battery still delivers over 40 miles of electric range on a full charge.",
    stockedAt: "2026-06-15",
  },
  {
    reg: "BJ23 ACU", condition: "used", variant: "across", trim: "Across", photoOffset: 2,
    derivative: "2.5 Plug-in Hybrid E-Four", year: 2023, price: 30995, monthly: 389, mileage: 15300,
    colour: "Attitude Black Mica", owners: 1, motDue: "2026-10-27",
    serviceHistory: "Full Suzuki service history", badge: "Low mileage",
    highlights: ["Balance of Suzuki warranty", "15,300 miles", "Heated and ventilated seats"],
    extras: ["Heated and ventilated front seats", "Panoramic sunroof"],
    description:
      "A low-mileage 2023 Across in black, still under manufacturer warranty. Charged at home every night by its owner, so the petrol engine has done very little work.",
    stockedAt: "2026-09-11",
  },
].map(buildRecord);

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

/**
 * Current listings most like `vehicle`, best match first. Scores shared body
 * style, fuel, make, condition and gearbox, then breaks ties on price gap.
 */
export const similarStock = (vehicle, limit = 8) => {
  if (!vehicle) return [];
  const score = (v) =>
    (v.bodyStyle === vehicle.bodyStyle ? 3 : 0) +
    (v.fuel === vehicle.fuel ? 2 : 0) +
    (v.make === vehicle.make ? 2 : 0) +
    (v.condition === vehicle.condition ? 1 : 0) +
    (v.transmission === vehicle.transmission ? 1 : 0);
  const priceGap = (v) => Math.abs((Number(v.price) || 0) - (Number(vehicle.price) || 0));
  return listStock()
    .filter((v) => v.stockNumber !== vehicle.stockNumber)
    .sort((a, b) => score(b) - score(a) || priceGap(a) - priceGap(b))
    .slice(0, limit);
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

// Representative monthly finance, as carried on each record's `monthly`.
export const MONTHLY_BANDS = [
  { value: "0-200", label: "Under £200 a month", min: 0, max: 200 },
  { value: "200-300", label: "£200 – £300 a month", min: 200, max: 300 },
  { value: "300-400", label: "£300 – £400 a month", min: 300, max: 400 },
  { value: "400-", label: "£400 a month and above", min: 400, max: Infinity },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Latest arrivals" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "monthly-asc", label: "Monthly: low to high" },
  { value: "mileage-asc", label: "Mileage: lowest first" },
  { value: "year-desc", label: "Year: newest first" },
];

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort();

/** Electric, hybrid and plug-in hybrid all count for the "Electric / hybrid" filter. */
export const isElectrified = (vehicle) => /electric|hybrid/i.test(String(vehicle?.fuel || ""));

export const isAutomatic = (vehicle) => /automatic/i.test(String(vehicle?.transmission || ""));

/**
 * Option lists for the search filters, derived from what is actually in stock.
 * Pass `make` to narrow the model list to that manufacturer's range.
 */
export const stockFacets = (list = listStock(), { make } = {}) => ({
  makes: uniqueSorted(list.map((v) => v.make)),
  models: uniqueSorted(list.filter((v) => !make || v.make === make).map((v) => v.model)),
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
  const {
    condition,
    query,
    make,
    model,
    fuel,
    transmission,
    bodyStyle,
    priceBand,
    monthlyBand,
    mileageBand,
    photosOnly,
    electrified,
    automatic,
  } = filters;
  return list.filter((v) => {
    if (condition && condition !== "all" && v.condition !== condition) return false;
    if (make && v.make !== make) return false;
    if (model && v.model !== model) return false;
    if (fuel && v.fuel !== fuel) return false;
    if (transmission && v.transmission !== transmission) return false;
    if (bodyStyle && v.bodyStyle !== bodyStyle) return false;
    if (photosOnly && !(Array.isArray(v.images) && v.images.length)) return false;
    if (electrified && !isElectrified(v)) return false;
    if (automatic && !isAutomatic(v)) return false;
    if (!withinBand(PRICE_BANDS, v.price, priceBand)) return false;
    if (!withinBand(MONTHLY_BANDS, v.monthly, monthlyBand)) return false;
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
    case "monthly-asc":
      // A car with no finance quote sorts last rather than first.
      return out.sort((a, b) => (a.monthly ?? Infinity) - (b.monthly ?? Infinity));
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

// A car stocked within this many days reads as a "New arrival". Kept short so
// the badge still means something on a newest-first list.
export const NEW_ARRIVAL_DAYS = 7;
// Used stock under this mileage reads as "Low mileage".
export const LOW_MILEAGE_MAX = 15000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The badges a listing card shows, most specific first, at most `limit`.
 * The sales team's own `badge` always leads; the rest are derived from the
 * record so they can never contradict it (an "Electric" badge on a petrol car).
 */
export const stockBadges = (vehicle, { now = Date.now(), limit = 2 } = {}) => {
  if (!vehicle) return [];
  const badges = [];
  if (vehicle.badge) badges.push(vehicle.badge);
  if (vehicle.fuel === "Electric") badges.push("Electric");
  const stocked = Date.parse(vehicle.stockedAt);
  if (Number.isFinite(stocked) && now - stocked >= 0 && now - stocked <= NEW_ARRIVAL_DAYS * DAY_MS) {
    badges.push("New arrival");
  }
  if (vehicle.condition === "used" && Number(vehicle.mileage) < LOW_MILEAGE_MAX) badges.push("Low mileage");
  const seen = new Set();
  return badges
    .filter((b) => {
      const key = b.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

/** The customer-site URL for a stock record. */
export const stockHref = (vehicle) => `/website/stock/${regToSlug(vehicle?.reg)}`;
