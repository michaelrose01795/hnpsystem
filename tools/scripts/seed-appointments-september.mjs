#!/usr/bin/env node
// file location: tools/scripts/seed-appointments-september.mjs
//
// Seeds realistic workshop bookings for September 2026 into `jobs` +
// `appointments`, mirroring the shape of the existing August batch
// (HNP-SEED:APPT-2026-07-06_2026-08-31-V1) with three deliberate improvements:
//   1. job.type varies across the full type list, not just Service/Warranty.
//   2. vehicle_make_model / customer are populated (August left both blank, so
//      the appointments board rendered "Customer TBC" and no vehicle detail).
//   3. Request durations span 0.5h - 4.0h instead of 0.5h - 2.5h.
//
// Additive and idempotent: everything it writes carries the batch marker, and
// a re-run removes only its own previous rows first.
//
//   node tools/scripts/seed-appointments-september.mjs [--dry-run] [--undo]

import crypto from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(root, ".env") });
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MARKER = "HNP-SEED:APPT-2026-09-01_2026-09-30-V1";
const MONTH_START = "2026-09-01";
const MONTH_END = "2026-10-01";
const SEED_USER_ID = 19; // same booking user the August batch used
const DRY_RUN = process.argv.includes("--dry-run");
const UNDO = process.argv.includes("--undo");

// Deterministic PRNG so repeat runs produce the same month.
let seedState = parseInt(crypto.createHash("sha256").update(MARKER).digest("hex").slice(0, 8), 16);
const rnd = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickWeighted = (entries) => {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rnd() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
};
const intBetween = (min, max) => min + Math.floor(rnd() * (max - min + 1));

// --- Work catalogue -------------------------------------------------------
// Each entry: request text, labour hours, detected job categories.
// Hours deliberately span the full 0.5h - 4.0h range the workshop books.
const WORK_ITEMS = [
  { text: "Vehicle health check and fluid-level inspection", time: 0.5, cats: ["SERVICE"] },
  { text: "Wiper blade replacement and washer jet adjustment", time: 0.5, cats: ["WIPERS"] },
  { text: "TPMS warning light reset and sensor check", time: 0.5, cats: ["TPMS"] },
  { text: "Front number plate replacement", time: 0.5, cats: ["NUMBER_PLATE"] },
  { text: "Air conditioning re-gas and leak test", time: 1.0, cats: ["HVAC_VENTS"] },
  { text: "Interim service and safety inspection", time: 1.5, cats: ["SERVICE"] },
  { text: "MOT test and emissions check", time: 1.0, cats: ["MOT"] },
  { text: "Engine management light diagnostic check", time: 1.0, cats: ["EML", "DIAGNOSIS"] },
  { text: "Front brake pads and discs replacement", time: 1.5, cats: ["BRAKES"] },
  { text: "Rear brake pads replacement and handbrake adjustment", time: 1.5, cats: ["BRAKES"] },
  { text: "Four wheel alignment and tracking adjustment", time: 1.5, cats: ["WHEELS_TYRES", "STEERING"] },
  { text: "Two front tyres supplied and fitted, balanced", time: 1.0, cats: ["WHEELS_TYRES"] },
  { text: "Investigate steering vibration at road speed", time: 2.0, cats: ["STEERING", "DIAGNOSIS"] },
  { text: "Annual service and manufacturer schedule inspection", time: 2.5, cats: ["SERVICE"] },
  { text: "Front suspension arm and drop link replacement", time: 2.5, cats: ["SUSPENSION"] },
  { text: "Rear shock absorber pair replacement", time: 2.5, cats: ["SUSPENSION"] },
  { text: "Infotainment head unit fault diagnosis and software update", time: 2.0, cats: ["AUDIO", "DIAGNOSIS"] },
  { text: "Intermittent electrical fault trace and repair", time: 3.0, cats: ["DIAGNOSIS", "OTHER"] },
  { text: "Cambelt and water pump replacement", time: 4.0, cats: ["OTHER"] },
  { text: "Clutch replacement and gearbox refit", time: 4.0, cats: ["OTHER"] },
  { text: "DPF forced regeneration and exhaust system inspection", time: 3.0, cats: ["EML", "DIAGNOSIS"] },
  { text: "Interior trim rattle investigation and refit", time: 1.5, cats: ["TRIM_INTERIOR"] },
  { text: "Door mirror casing and glass replacement", time: 1.0, cats: ["TRIM_EXTERIOR"] },
  { text: "Bodywork panel blend and paint rectification", time: 4.0, cats: ["BODYWORK_REPAIR"] },
  { text: "Recall action - software campaign application", time: 1.0, cats: ["OTHER"] },
  { text: "Coolant system pressure test and thermostat replacement", time: 2.0, cats: ["OTHER", "DIAGNOSIS"] },
];

const JOB_TYPES = [
  ["Service", 30],
  ["Repair", 18],
  ["MOT", 12],
  ["Diagnostics", 12],
  ["Warranty", 14],
  ["Recall", 7],
  ["Sales Prep", 7],
];
const JOB_SOURCES = [["Service desk", 32], ["Retail", 26], ["Online booking", 16], ["Phone", 12], ["Warranty", 8], ["Sales handover", 6]];
const WAITING_STATUSES = [["Neither", 30], ["Waiting", 26], ["Collection", 24], ["Loan Car", 20]];
const TECH_IDS = [6, 7, 10, 13, 35, 48];
const SLOTS = [
  ["08:00", 14], ["08:30", 6], ["09:00", 8], ["09:30", 7], ["10:00", 7], ["10:30", 7],
  ["11:00", 7], ["11:30", 7], ["12:00", 7], ["12:30", 6], ["13:00", 6], ["13:30", 6],
  ["14:00", 6], ["14:30", 6], ["15:00", 3], ["15:30", 2],
];

const typeForCategories = (cats, fallbackType) => {
  if (cats.includes("MOT")) return "MOT";
  if (cats.includes("BODYWORK_REPAIR")) return "Repair";
  return fallbackType;
};

const fetchAll = async (table, columns, tweak) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = db.from(table).select(columns).range(from, from + 999);
    if (tweak) query = tweak(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const undo = async () => {
  const { data: appts, error } = await db.from("appointments").select("appointment_id, job_id").like("notes", `%${MARKER}%`);
  if (error) throw new Error(error.message);
  const jobIds = [...new Set(appts.map((a) => a.job_id).filter(Boolean))];
  if (appts.length) {
    await db.from("appointments").delete().in("appointment_id", appts.map((a) => a.appointment_id));
  }
  for (let i = 0; i < jobIds.length; i += 200) {
    await db.from("jobs").delete().in("id", jobIds.slice(i, i + 200));
  }
  console.log(`Removed ${appts.length} appointments and ${jobIds.length} jobs for ${MARKER}.`);
};

const run = async () => {
  const { count: existing } = await db
    .from("appointments").select("*", { count: "exact", head: true })
    .gte("scheduled_time", MONTH_START).lt("scheduled_time", MONTH_END);
  console.log(`September appointments currently in the database: ${existing}`);

  if (existing > 0) {
    const { data: mine } = await db.from("appointments").select("appointment_id").like("notes", `%${MARKER}%`).limit(1);
    if (!mine?.length) {
      console.log("September already has appointments that this batch did not create - stopping so nothing is duplicated.");
      return;
    }
    if (!DRY_RUN) await undo();
  }

  const vehicles = await fetchAll(
    "vehicles",
    "vehicle_id, registration, make, model, make_model, year, fuel_type, transmission, body_style, colour, mileage, customer_id",
    (q) => q.not("customer_id", "is", null),
  );
  const customers = await fetchAll("customers", "id, name, firstname, lastname");
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const usable = vehicles.filter((v) => v.registration && v.make && v.model && customerById.has(v.customer_id));
  if (usable.length < 50) throw new Error(`Only ${usable.length} usable vehicles found - aborting.`);
  console.log(`Vehicle pool: ${usable.length}`);

  // Deterministic shuffle so each booking gets a distinct vehicle.
  const pool = usable.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let poolCursor = 0;
  const nextVehicle = () => pool[poolCursor++ % pool.length];

  const bookings = [];
  for (let day = 1; day <= 30; day += 1) {
    const date = new Date(Date.UTC(2026, 8, day));
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue; // workshop is closed at weekends
    const dateKey = `2026-09-${String(day).padStart(2, "0")}`;
    const slotUsage = new Map();
    const perDay = intBetween(8, 17);

    for (let n = 0; n < perDay; n += 1) {
      let slot = pickWeighted(SLOTS);
      // Keep at most three bookings on any one slot so the board stays readable.
      let guard = 0;
      while ((slotUsage.get(slot) || 0) >= 3 && guard < 12) { slot = pickWeighted(SLOTS); guard += 1; }
      slotUsage.set(slot, (slotUsage.get(slot) || 0) + 1);

      const vehicle = nextVehicle();
      const customer = customerById.get(vehicle.customer_id);
      const itemCount = pickWeighted([[1, 46], [2, 40], [3, 14]]);
      const items = [];
      let totalHours = 0;
      while (items.length < itemCount) {
        const candidate = pick(WORK_ITEMS);
        if (items.some((i) => i.text === candidate.text)) continue;
        if (totalHours + candidate.time > 4) break; // total labour per job stays within 0.5h - 4h
        items.push(candidate);
        totalHours += candidate.time;
      }
      if (!items.length) items.push(WORK_ITEMS[0]);

      const cats = [...new Set(items.flatMap((i) => i.cats))].slice(0, 3);
      const fallbackType = pickWeighted(JOB_TYPES);
      const customerName = customer.name || [customer.firstname, customer.lastname].filter(Boolean).join(" ") || "Customer";

      bookings.push({
        dateKey,
        scheduledTime: `${dateKey}T${slot}:00+00:00`,
        vehicle,
        customerId: vehicle.customer_id,
        customerName,
        items,
        totalHours: Number(totalHours.toFixed(2)),
        cats,
        type: typeForCategories(cats, fallbackType),
        jobSource: pickWeighted(JOB_SOURCES),
        waitingStatus: pickWeighted(WAITING_STATUSES),
        assignedTo: pick(TECH_IDS),
        vhcRequired: rnd() < 0.72,
        washRequired: rnd() < 0.6,
      });
    }
  }

  bookings.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  console.log(`Prepared ${bookings.length} September bookings across ${new Set(bookings.map((b) => b.dateKey)).size} working days.`);
  const hours = bookings.map((b) => b.totalHours);
  console.log(`Labour per job: ${Math.min(...hours)}h - ${Math.max(...hours)}h`);
  console.log(`Job types: ${JSON.stringify(bookings.reduce((acc, b) => ({ ...acc, [b.type]: (acc[b.type] || 0) + 1 }), {}))}`);

  if (DRY_RUN) {
    console.log("Dry run - nothing written. Sample:");
    console.log(JSON.stringify(bookings.slice(0, 2), null, 1).slice(0, 1600));
    return;
  }

  const nowIso = new Date().toISOString();
  let written = 0;
  for (let i = 0; i < bookings.length; i += 25) {
    const chunk = bookings.slice(i, i + 25);
    const jobRows = chunk.map((b) => {
      const v = b.vehicle;
      // Full vehicle detail on the job row - the August batch left this blank.
      const makeModel = [v.year, v.make, v.model, v.body_style, v.fuel_type, v.transmission]
        .filter(Boolean).join(" ");
      return {
        customer: b.customerName,
        customer_id: b.customerId,
        vehicle_id: v.vehicle_id,
        vehicle_reg: v.registration,
        vehicle_make_model: makeModel,
        milage: v.mileage || null,
        waiting_status: b.waitingStatus,
        job_source: b.jobSource,
        job_categories: b.cats,
        requests: b.items.map((item) => ({
          text: item.text,
          time: item.time,
          noteText: `[${MARKER}]`,
          presetId: null,
          paymentType: b.type === "Warranty" ? "Warranty" : "Customer",
        })),
        description: b.items.map((item) => item.text).join("\n"),
        type: b.type,
        status: "Booked",
        assigned_to: b.assignedTo,
        vhc_required: b.vhcRequired,
        job_division: b.type === "Sales Prep" ? "Sales" : "Retail",
        service_mode: "workshop",
        maintenance_info: { seedBatch: MARKER, washRequired: b.washRequired, cosmeticDamagePresent: false },
        status_updated_at: nowIso,
        status_updated_by: String(SEED_USER_ID),
        booked_by: SEED_USER_ID,
      };
    });

    const { data: insertedJobs, error: jobError } = await db.from("jobs").insert(jobRows).select("id");
    if (jobError) throw new Error(`jobs insert: ${jobError.message}`);

    const apptRows = insertedJobs.map((job, index) => ({
      job_id: job.id,
      customer_id: chunk[index].customerId,
      scheduled_time: chunk[index].scheduledTime,
      status: "Scheduled",
      notes: `[${MARKER}] ${chunk[index].items.map((item) => item.text).join("; ")}`,
      created_by: SEED_USER_ID,
      updated_by: SEED_USER_ID,
    }));
    const { error: apptError } = await db.from("appointments").insert(apptRows);
    if (apptError) throw new Error(`appointments insert: ${apptError.message}`);

    // job_number mirrors the id, matching every other job in the database.
    for (const job of insertedJobs) {
      await db.from("jobs").update({ job_number: String(job.id).padStart(5, "0") }).eq("id", job.id);
    }
    written += chunk.length;
    process.stdout.write(`\rWritten ${written}/${bookings.length}`);
  }
  console.log(`\nDone. ${written} September jobs + appointments created under ${MARKER}.`);
};

(UNDO ? undo() : run()).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
