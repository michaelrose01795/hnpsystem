// file location: tools/scripts/seed-parts-catalogue.js
//
// Fills public.parts_catalog with a realistic genuine-parts range for the
// /website/parts-catalog shop (and the staff Stock Catalogue, which reads the
// same table).
//
//   npm run seed:parts-catalogue              write / refresh the range
//   npm run seed:parts-catalogue -- --plan    print what it would write
//   npm run seed:parts-catalogue -- --clear   remove it again
//
// Each part TYPE is stocked for several Suzuki and Mitsubishi fitments, so the
// shop shows e.g. eight different alternators — every one of which draws the
// same generic alternator picture (src/lib/parts/partTypeImages.js). Parts go
// into the categories the catalogue already uses; no new sections are made.
//
// Reversible: every row carries SEED_NOTE in `notes`, and --clear deletes
// exactly those rows. Re-running upserts on part_number, so it never
// duplicates. A seeded part that has since been used on a job cannot be
// deleted (foreign keys) — --clear deactivates it instead.

/* eslint-disable no-console */
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const SEED_NOTE = "Seeded by tools/scripts/seed-parts-catalogue.js";

// ---------------------------------------------------------------------------
// Fitments
// ---------------------------------------------------------------------------
// `pn` builds a part number in the manufacturer's own format from a base code
// and the fitment index, so numbers look right and never collide.
const SUZUKI = { brand: "Suzuki", supplier: "Suzuki GB Genuine Parts" };
const MITSUBISHI = { brand: "Mitsubishi", supplier: "Mitsubishi Motors Genuine Parts" };

const FITMENTS = [
  { ...SUZUKI, model: "Swift 1.2 Dualjet Hybrid (2020–)", code: "53R" },
  { ...SUZUKI, model: "Vitara 1.4 Boosterjet Hybrid (2020–)", code: "54P" },
  { ...SUZUKI, model: "S-Cross 1.4 Boosterjet Hybrid (2022–)", code: "61M" },
  { ...SUZUKI, model: "Ignis 1.2 Dualjet Hybrid (2020–)", code: "62R" },
  { ...SUZUKI, model: "Jimny 1.5 AllGrip (2018–)", code: "78R" },
  { ...MITSUBISHI, model: "Outlander 2.4 PHEV (2019–)", code: "A5" },
  { ...MITSUBISHI, model: "Eclipse Cross 2.4 PHEV (2021–)", code: "A6" },
  { ...MITSUBISHI, model: "L200 2.2 DI-D (2019–)", code: "A7" },
  { ...MITSUBISHI, model: "ASX 2.0 MIVEC (2017–2021)", code: "A3" },
  { ...MITSUBISHI, model: "Mirage 1.2 MIVEC (2016–)", code: "A2" },
];

const partNumber = (fitment, base, index) => {
  const seq = String(index + 1).padStart(2, "0");
  if (fitment.brand === "Suzuki") {
    // Suzuki: 31400-53R00 style
    return `${base.suzuki}-${fitment.code}${seq}`;
  }
  // Mitsubishi: 1800A5 + 3 digits, e.g. 1800A501
  return `${base.mitsubishi}${fitment.code}${seq}`;
};

// ---------------------------------------------------------------------------
// The range — one entry per part type
// ---------------------------------------------------------------------------
// `names` are the variants stocked per fitment (e.g. front and rear pads).
// `fit` is how many fitments carry it (engine-agnostic parts carry them all).
// Categories match the spellings already live in parts_catalog.
const RANGE = [
  { names: ["Alternator"], category: "Electrical", base: { suzuki: "31400", mitsubishi: "1800" }, price: [289, 449], fit: 10, desc: "Genuine remanufactured-exchange alternator. Old unit surcharge refunded on return." },
  { names: ["Starter Motor"], category: "Electrical", base: { suzuki: "31100", mitsubishi: "1810" }, price: [219, 369], fit: 10, desc: "Genuine starter motor, direct fit." },
  { names: ["12V Battery"], category: "Electrical", base: { suzuki: "33610", mitsubishi: "8201" }, price: [109, 189], fit: 10, desc: "Maintenance-free 12V battery matched to the stop/start system." },
  { names: ["Spark Plug"], category: "Engine", base: { suzuki: "09482", mitsubishi: "1822" }, price: [11, 19], fit: 7, desc: "Iridium spark plug, sold individually." },
  { names: ["Ignition Coil"], category: "Engine", base: { suzuki: "33400", mitsubishi: "1832" }, price: [69, 119], fit: 7, desc: "Pencil ignition coil, one per cylinder." },
  { names: ["Timing Belt Kit", "Auxiliary Drive Belt"], category: "Engine", base: { suzuki: "12810", mitsubishi: "1145" }, price: [34, 229], fit: 8, desc: "Genuine belt, tensioner and idler where supplied as a kit." },
  { names: ["Front Brake Pads", "Rear Brake Pads"], category: "Brakes", base: { suzuki: "55810", mitsubishi: "4605" }, price: [54, 96], fit: 10, desc: "Genuine pad set with shims and wear indicators. Axle set." },
  { names: ["Front Brake Discs"], category: "Brakes", base: { suzuki: "55311", mitsubishi: "4615" }, price: [98, 189], fit: 10, desc: "Vented front disc pair." },
  { names: ["Rear Brake Drums"], category: "Brakes", base: { suzuki: "43511", mitsubishi: "4610" }, price: [89, 139], fit: 4, desc: "Rear drum pair for drum-braked models." },
  { names: ["Front Brake Caliper"], category: "Brakes", base: { suzuki: "55102", mitsubishi: "4605B" }, price: [149, 259], fit: 8, desc: "Genuine caliper, near or offside. Old unit surcharge applies." },
  { names: ["Brake Fluid DOT4 1L"], category: "Brakes", base: { suzuki: "99000", mitsubishi: "MZ31" }, price: [14, 18], fit: 2, desc: "DOT4 brake fluid, 1 litre." },
  { names: ["ABS Wheel Speed Sensor"], category: "Brakes", base: { suzuki: "56210", mitsubishi: "4670" }, price: [46, 94], fit: 8, desc: "Wheel speed sensor with harness." },
  { names: ["Front Shock Absorber", "Rear Shock Absorber"], category: "Suspension", base: { suzuki: "41601", mitsubishi: "4060" }, price: [109, 219], fit: 8, desc: "Genuine damper, sold individually." },
  { names: ["Front Coil Spring"], category: "Suspension", base: { suzuki: "41111", mitsubishi: "4082" }, price: [74, 129], fit: 6, desc: "Front road spring, sold individually." },
  { names: ["Front Lower Control Arm"], category: "Suspension", base: { suzuki: "45201", mitsubishi: "4013" }, price: [99, 189], fit: 8, desc: "Lower arm with bushes and ball joint fitted." },
  { names: ["Track Rod End"], category: "Steering", base: { suzuki: "48810", mitsubishi: "4422" }, price: [39, 69], fit: 8, desc: "Outer track rod end. Alignment check recommended after fitting." },
  { names: ["Steering Rack"], category: "Steering", base: { suzuki: "48580", mitsubishi: "4410" }, price: [589, 989], fit: 5, desc: "Electric power steering rack assembly." },
  { names: ["Front Wheel Bearing & Hub"], category: "Steering", base: { suzuki: "43401", mitsubishi: "3880" }, price: [119, 219], fit: 8, desc: "Hub and bearing assembly, pre-greased and sealed." },
  { names: ["Radiator"], category: "Cooling", base: { suzuki: "17700", mitsubishi: "1350" }, price: [229, 389], fit: 8, desc: "Aluminium core radiator." },
  { names: ["Water Pump"], category: "Cooling", base: { suzuki: "17400", mitsubishi: "1300" }, price: [119, 209], fit: 7, desc: "Water pump with gasket." },
  { names: ["Thermostat"], category: "Cooling", base: { suzuki: "17670", mitsubishi: "1305" }, price: [39, 79], fit: 7, desc: "Thermostat and housing seal." },
  { names: ["Radiator Top Hose"], category: "Cooling", base: { suzuki: "17851", mitsubishi: "1370" }, price: [29, 59], fit: 6, desc: "Moulded top hose." },
  { names: ["Rear Silencer"], category: "Exhaust", base: { suzuki: "14300", mitsubishi: "1571" }, price: [189, 329], fit: 7, desc: "Rear box with tailpipe and fitting kit." },
  { names: ["Clutch Kit"], category: "Transmission", base: { suzuki: "22400", mitsubishi: "2300" }, price: [289, 519], fit: 6, desc: "Cover, plate and release bearing." },
  { names: ["Front Driveshaft"], category: "Transmission", base: { suzuki: "44101", mitsubishi: "3815" }, price: [259, 449], fit: 7, desc: "Complete driveshaft, near or offside." },
  { names: ["Oil Filter"], category: "Filters", base: { suzuki: "16510", mitsubishi: "1230" }, price: [9, 16], fit: 10, desc: "Genuine oil filter with sealing ring." },
  { names: ["Air Filter", "Cabin Pollen Filter"], category: "Filters", base: { suzuki: "13780", mitsubishi: "1500" }, price: [16, 36], fit: 10, desc: "Genuine panel filter." },
  { names: ["Fuel Filter"], category: "Filters", base: { suzuki: "15410", mitsubishi: "1770" }, price: [34, 64], fit: 3, desc: "Diesel fuel filter." },
  { names: ["Front Wiper Blade Set", "Rear Wiper Blade"], category: "Wiper", base: { suzuki: "38340", mitsubishi: "8250" }, price: [14, 39], fit: 10, desc: "Vehicle-specific aero blades." },
  { names: ["Door Mirror Glass"], category: "Body", base: { suzuki: "84702", mitsubishi: "7632" }, price: [39, 89], fit: 8, desc: "Heated mirror glass, near or offside." },
  { names: ["Headlight Bulb"], category: "Electrical", base: { suzuki: "35116", mitsubishi: "8301" }, price: [12, 24], fit: 5, desc: "Halogen headlight bulb." },
  { names: ["Tyre Pressure (TPMS) Sensor"], category: "Tyres", base: { suzuki: "43130", mitsubishi: "4250" }, price: [59, 89], fit: 8, desc: "TPMS valve sensor, coded on fitting." },
  { names: ["Front Window Regulator"], category: "Window", base: { suzuki: "83401", mitsubishi: "5743" }, price: [129, 219], fit: 6, desc: "Electric window regulator with motor." },
  { names: ["Front Door Lock Actuator"], category: "Body", base: { suzuki: "82201", mitsubishi: "5710" }, price: [109, 189], fit: 6, desc: "Door latch and central locking actuator." },
];

// Deterministic pseudo-random so a re-run writes identical prices and stock.
const hashRng = (key) => {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const money = (value) => Math.round(value * 100) / 100;
const toPrice = (value) => Math.floor(value) + 0.99; // shelf prices end .99

function buildRows() {
  const rows = [];
  RANGE.forEach((entry) => {
    // The diesel-only fuel filter goes to the diesel and PHEV models; every
    // other type is carried by `fit` models, alternating across both brands.
    const spread = entry.names[0] === "Fuel Filter"
      ? FITMENTS.filter((f) => /DI-D|PHEV/.test(f.model))
      : interleave(entry.fit);

    entry.names.forEach((name, variant) => {
      spread.forEach((fitment, index) => {
        const base = variant === 0
          ? entry.base
          : { suzuki: bump(entry.base.suzuki, variant), mitsubishi: bump(entry.base.mitsubishi, variant) };
        const number = partNumber(fitment, base, index);
        const rng = hashRng(number);
        const price = toPrice(entry.price[0] + rng() * (entry.price[1] - entry.price[0]));
        const inStock = rng() < 0.12 ? 0 : 1 + Math.floor(rng() * 14);
        rows.push({
          part_number: number,
          name: `${name} — ${fitment.brand} ${fitment.model}`,
          description: entry.desc,
          category: entry.category,
          supplier: fitment.supplier,
          oem_reference: number,
          unit_cost: money(price * (0.55 + rng() * 0.1)),
          unit_price: price,
          qty_in_stock: inStock,
          qty_reserved: inStock > 3 && rng() < 0.3 ? 1 : 0,
          qty_on_order: inStock === 0 ? 2 : 0,
          reorder_level: 2,
          storage_location: `${String.fromCharCode(65 + Math.floor(rng() * 6))}${1 + Math.floor(rng() * 8)}`,
          notes: SEED_NOTE,
          is_active: true,
        });
      });
    });
  });
  return rows;
}

// A part carried by only some models should span both brands, not just the
// first few Suzukis.
function interleave(count) {
  const suzuki = FITMENTS.filter((f) => f.brand === "Suzuki");
  const mitsubishi = FITMENTS.filter((f) => f.brand === "Mitsubishi");
  const out = [];
  for (let i = 0; out.length < count && i < FITMENTS.length; i += 1) {
    if (suzuki[i]) out.push(suzuki[i]);
    if (out.length < count && mitsubishi[i]) out.push(mitsubishi[i]);
  }
  return out;
}

// Second variant of a type (rear pads, cabin filter…) gets its own base code.
const bump = (base, variant) => base.replace(/\d$/, (d) => String((Number(d) + variant) % 10));

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const chunk = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function main() {
  const rows = buildRows();
  const numbers = new Set(rows.map((r) => r.part_number));
  if (numbers.size !== rows.length) throw new Error("Duplicate part numbers generated.");

  if (process.argv.includes("--plan")) {
    const byCategory = rows.reduce((acc, r) => ({ ...acc, [r.category]: (acc[r.category] || 0) + 1 }), {});
    console.log(`Plan: ${rows.length} parts`, byCategory);
    rows.slice(0, 12).forEach((r) => console.log(`  ${r.part_number}  £${r.unit_price}  ${r.name}`));
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (process.argv.includes("--clear")) {
    const { data, error } = await db.from("parts_catalog").delete().eq("notes", SEED_NOTE).select("id");
    if (error) {
      // Most likely a seeded part is referenced by a job — hide them instead.
      console.warn(`Delete refused (${error.message}); deactivating seeded parts instead.`);
      const { data: off, error: offError } = await db
        .from("parts_catalog")
        .update({ is_active: false })
        .eq("notes", SEED_NOTE)
        .select("id");
      if (offError) throw new Error(`Unable to deactivate seeded parts: ${offError.message}`);
      console.log(`Deactivated ${(off || []).length} seeded part(s).`);
      return;
    }
    console.log(`Removed ${(data || []).length} seeded part(s).`);
    return;
  }

  // Never overwrite a real part that happens to share a number.
  const { data: clashes, error: clashError } = await db
    .from("parts_catalog")
    .select("part_number, notes")
    .in("part_number", [...numbers]);
  if (clashError) throw new Error(`Unable to read parts_catalog: ${clashError.message}`);
  const foreign = new Set((clashes || []).filter((c) => c.notes !== SEED_NOTE).map((c) => c.part_number));
  const writable = rows.filter((r) => !foreign.has(r.part_number));
  if (foreign.size) console.warn(`Skipping ${foreign.size} part number(s) already used by real parts.`);

  let written = 0;
  for (const batch of chunk(writable, 100)) {
    const { data, error } = await db
      .from("parts_catalog")
      .upsert(batch, { onConflict: "part_number" })
      .select("id");
    if (error) throw new Error(`Unable to write parts: ${error.message}`);
    written += (data || []).length;
  }
  console.log(`Wrote ${written} parts across ${new Set(writable.map((r) => r.category)).size} categories.`);
  console.log("Open /website/parts-catalog to see them. Re-run with --clear to remove.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
