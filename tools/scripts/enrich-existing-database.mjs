#!/usr/bin/env node
// file location: tools/scripts/enrich-existing-database.mjs
// Additively enriches the live database around existing records. It never
// deletes rows, updates existing IDs, or reseeds from scratch.

import crypto from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

dotenv.config({ path: resolve(root, ".env") });
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const today = new Date("2026-06-09T12:00:00+01:00");
const targetCounts = {
  customers: 540,
  vehicles: 860,
  jobs: 2800,
  appointments: 900,
  job_check_sheets: 1600,
  parts_requests: 1250,
  audit_log: 4200,
  messages: 650,
  notifications: 700,
  vhc_checks: 1550,
  job_archive: 1050,
  invoices: 1500,
};

const firstNames = [
  "Amelia", "Arthur", "Ava", "Benjamin", "Charlotte", "Daniel", "Daisy", "Edward",
  "Emily", "Ethan", "Florence", "Freddie", "George", "Grace", "Harry", "Isla",
  "Jack", "Jessica", "Leo", "Lily", "Mason", "Mia", "Noah", "Olivia", "Oscar",
  "Poppy", "Ruby", "Samuel", "Sophia", "Thomas", "William", "Zoe",
];
const lastNames = [
  "Adams", "Baker", "Bennett", "Brown", "Carter", "Clarke", "Cooper", "Davies",
  "Edwards", "Evans", "Foster", "Green", "Hall", "Harris", "Hill", "Hughes",
  "Johnson", "Jones", "King", "Lewis", "Martin", "Miller", "Morgan", "Morris",
  "Parker", "Phillips", "Roberts", "Smith", "Taylor", "Thomas", "Walker", "Wilson",
];
const streets = [
  "High Street", "Station Road", "Church Lane", "Maidstone Road", "London Road",
  "Ashford Road", "Orchard Close", "Park Avenue", "Mill Lane", "The Street",
];
const towns = ["Maidstone", "West Malling", "Aylesford", "Tonbridge", "Paddock Wood", "Sevenoaks"];
const makes = [
  ["KGM", "Korando"], ["KGM", "Tivoli"], ["KGM", "Musso"], ["SsangYong", "Rexton"],
  ["Mitsubishi", "Outlander"], ["Mitsubishi", "L200"], ["Mitsubishi", "ASX"],
  ["Nissan", "Qashqai"], ["Hyundai", "Tucson"], ["Kia", "Sportage"],
  ["Ford", "Transit Custom"], ["Volkswagen", "Golf"], ["Toyota", "Yaris"],
];
const colours = ["White", "Black", "Silver", "Grey", "Red", "Blue", "Green"];
const fuelTypes = ["Petrol", "Diesel", "Hybrid", "Electric"];
const jobTypes = ["Service", "MOT", "Repair", "Warranty", "Diagnostics", "Sales Prep", "Recall"];
const jobDescriptions = [
  "Annual service and inspection",
  "MOT test with pre-check",
  "Customer reports warning light",
  "Brake noise investigation",
  "Warranty diagnosis and repair",
  "Sales preparation and valet",
  "Tyre replacement and wheel alignment",
  "Air conditioning service",
  "Battery and charging system check",
  "Software update and road test",
];
const partDescriptions = [
  "Oil filter", "Air filter", "Cabin filter", "Front brake pads", "Rear brake pads",
  "Wiper blade set", "Battery", "Tyre 225/55R18", "Timing belt kit", "Glow plug",
  "ABS sensor", "AdBlue injector", "Door mirror", "Clutch kit", "DPF pressure sensor",
];
const vhcSections = ["Tyres", "Brakes", "Suspension", "Lights", "Fluids", "Bodywork", "Battery"];
const vhcIssues = [
  "Nearside front tyre worn close to limit",
  "Front brake pads low",
  "Rear discs corroded",
  "Wiper blades smearing",
  "Battery health low",
  "Oil leak noted during inspection",
  "Suspension bush split",
  "Number plate light inoperative",
];

const seededMarker = "hnp_enrichment_20260609";

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const pick = (arr, index) => arr[index % arr.length];
const pad = (num, length) => String(num).padStart(length, "0");
const iso = (date) => date.toISOString();

const weighted = (index, options) => {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = hash(`${index}:weighted`).slice(0, 8);
  let value = Number.parseInt(cursor, 16) % total;
  for (const [item, weight] of options) {
    if (value < weight) return item;
    value -= weight;
  }
  return options[0][0];
};

const randomBetween = (index, min, max) => {
  const raw = Number.parseInt(hash(`${index}:range`).slice(0, 8), 16) / 0xffffffff;
  return min + Math.floor(raw * (max - min + 1));
};

const businessDate = (index, { future = false } = {}) => {
  const spanDays = future ? 35 : 1095;
  const offset = randomBetween(`days:${index}`, 0, spanDays);
  const date = new Date(today);
  date.setDate(date.getDate() + (future ? offset : -offset));

  if (date.getDay() === 0) date.setDate(date.getDate() + (future ? 1 : -2));
  if (date.getDay() === 6) date.setDate(date.getDate() + (future ? 2 : -1));

  const month = date.getMonth();
  if (!future && [2, 7, 8].includes(month) && index % 3 === 0) {
    date.setDate(Math.max(1, date.getDate() - 3));
  }
  if (!future && index % 9 === 0) {
    date.setDate(Math.min(28, randomBetween(`eom:${index}`, 24, 28)));
  }

  date.setHours(randomBetween(`hour:${index}`, 8, 17), randomBetween(`min:${index}`, 0, 59), 0, 0);
  return date;
};

const addHours = (date, hours) => {
  const next = new Date(date);
  next.setTime(next.getTime() + hours * 60 * 60 * 1000);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const countRows = async (table) => {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
  return count || 0;
};

const selectAll = async (table, columns, orderColumn) => {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = db.from(table).select(columns).range(from, from + pageSize - 1);
    if (orderColumn) query = query.order(orderColumn);
    const { data, error } = await query;
    if (error) throw new Error(`Select failed for ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

const insertBatch = async (table, rows, batchSize = 500) => {
  if (!rows.length) return [];
  const inserted = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await db.from(table).insert(batch).select();
    if (error) throw new Error(`Insert failed for ${table}: ${error.message}`);
    inserted.push(...(data || []));
    console.log(`Inserted ${Math.min(i + batch.length, rows.length)}/${rows.length} into ${table}`);
  }
  return inserted;
};

const auditCounts = async () => {
  const tables = [
    "users", "customers", "vehicles", "jobs", "appointments", "parts_requests", "vhc_checks",
    "job_check_sheets", "audit_log", "messages", "notifications", "job_requests", "job_archive",
    "invoices", "message_threads", "message_thread_members", "job_activity_events", "job_status_history",
  ];
  const entries = await Promise.all(tables.map(async (table) => [table, await countRows(table)]));
  return Object.fromEntries(entries);
};

const classifyUsers = (users) => {
  const byRole = (needle) => users.filter((u) => String(u.role || "").toLowerCase().includes(needle));
  const technicians = users.filter((u) => {
    const role = String(u.role || "").toLowerCase();
    const title = String(u.job_title || "").toLowerCase();
    return role.includes("tech") || title.includes("tech") || role.includes("mot tester");
  });
  return {
    technicians,
    mot: byRole("mot"),
    parts: users.filter((u) => String(u.role || "").toLowerCase().includes("parts")),
    managers: users.filter((u) => String(u.role || "").toLowerCase().includes("manager") || String(u.role || "").toLowerCase().includes("director") || String(u.role || "").toLowerCase() === "owner"),
    sales: byRole("sales"),
    admin: users.filter((u) => String(u.role || "").toLowerCase().includes("admin") || String(u.role || "").toLowerCase().includes("reception")),
    service: users.filter((u) => String(u.role || "").toLowerCase().includes("service")),
  };
};

const makeCustomer = (index, existingCount) => {
  const first = pick(firstNames, index + 3);
  const last = pick(lastNames, index * 7 + 5);
  const town = pick(towns, index);
  const postcode = `ME${randomBetween(`pc1:${index}`, 1, 20)} ${randomBetween(`pc2:${index}`, 1, 9)}${String.fromCharCode(65 + (index % 20))}${String.fromCharCode(65 + ((index * 3) % 20))}`;
  const createdAt = businessDate(`customer:${index}`);
  return {
    firstname: first,
    lastname: last,
    name: `${first} ${last}`,
    email: `${first}.${last}.${existingCount + index}@example-customer.hnp`.toLowerCase(),
    mobile: `07${randomBetween(`mobile:${index}`, 100000000, 999999999)}`,
    telephone: `01622 ${randomBetween(`tel:${index}`, 100000, 999999)}`,
    address: `${randomBetween(`house:${index}`, 1, 190)} ${pick(streets, index)}, ${town}`,
    postcode,
    contact_preference: weighted(`pref:${index}`, [["email", 55], ["sms", 30], ["phone", 15]]),
    created_at: iso(createdAt),
    updated_at: iso(addDays(createdAt, randomBetween(`custupd:${index}`, 0, 700))),
  };
};

const makeVehicle = (index, customers) => {
  const [make, model] = pick(makes, index);
  const year = randomBetween(`year:${index}`, 2014, 2026);
  const customer = customers[index % customers.length];
  const letters = `${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index * 7) % 26))}${String.fromCharCode(65 + ((index * 11) % 26))}`;
  const reg = `${randomBetween(`age:${index}`, 14, 75)}${letters}${pad(index % 1000, 3)}`;
  const createdAt = businessDate(`vehicle:${index}`);
  return {
    reg_number: reg,
    registration: reg,
    make,
    model,
    make_model: `${make} ${model}`,
    year,
    vin: `HNP${hash(`vin:${index}`).slice(0, 14).toUpperCase()}`,
    colour: pick(colours, index),
    mileage: randomBetween(`mileage:${index}`, 4000, 148000),
    fuel_type: pick(fuelTypes, index),
    transmission: index % 4 === 0 ? "Automatic" : "Manual",
    body_style: index % 5 === 0 ? "Pick-up" : "SUV",
    mot_due: iso(addDays(today, randomBetween(`mot:${index}`, -280, 360))).slice(0, 10),
    warranty_type: weighted(`warranty:${index}`, [["Manufacturer", 20], ["Approved Used", 25], ["None", 55]]),
    service_history: weighted(`history:${index}`, [["Full dealer history", 35], ["Partial history", 45], ["No history supplied", 20]]),
    customer_id: customer.id,
    created_at: iso(createdAt),
    updated_at: iso(addDays(createdAt, randomBetween(`vehupd:${index}`, 0, 500))),
  };
};

const chooseTechnician = (usersByType, index) => {
  const techPool = usersByType.technicians.length ? usersByType.technicians : usersByType.service;
  if (!techPool.length) return null;
  const weightedIndexes = [0, 0, 0, 0, 0, 1, 1, 1, 1, 5, 5, 5, 5, 3, 3, 3, 4, 4, 2, 7, 6, 8];
  return techPool[weightedIndexes[index % weightedIndexes.length] % techPool.length];
};

const makeJob = (index, vehicles, usersByType, sequence = index) => {
  const vehicle = vehicles[index % vehicles.length];
  const assigned = chooseTechnician(usersByType, index);
  const createdAt = index < 110
    ? addHours(addDays(today, randomBetween(`current:${index}`, -7, 21)), randomBetween(`currenth:${index}`, -3, 5))
    : businessDate(`job:${index}`);
  const isFuture = createdAt > today;
  const isRecent = createdAt > addDays(today, -14) && !isFuture;
  const status = isFuture
    ? "Booked"
    : isRecent
      ? weighted(`status:${index}`, [["Booked", 12], ["Checked In", 18], ["In Progress", 34], ["Open", 16], ["Released", 10], ["Complete", 10]])
      : weighted(`status:${index}`, [["Complete", 72], ["Released", 12], ["Archived", 8], ["Invoiced", 8]]);
  const waitingStatus = weighted(`wait:${index}`, [["Neither", 45], ["Waiting", 14], ["Customer", 15], ["Parts", 16], ["Loan Car", 5], ["Collection", 5]]);
  const completedAt = ["Complete", "Released", "Archived", "Invoiced"].includes(status)
    ? addHours(createdAt, randomBetween(`duration:${index}`, 3, 96))
    : null;
  const type = pick(jobTypes, index);
  const requiresVhc = type !== "Sales Prep" && index % 5 !== 0;
  const jobNumber = `ENR${pad(sequence + 1, 5)}`;
  const description = pick(jobDescriptions, index);
  return {
    customer: vehicle.customers?.name || [vehicle.customers?.firstname, vehicle.customers?.lastname].filter(Boolean).join(" ") || "Retail Customer",
    customer_id: vehicle.customer_id,
    vehicle_reg: vehicle.reg_number,
    vehicle_make_model: vehicle.make_model || `${vehicle.make || ""} ${vehicle.model || ""}`.trim(),
    waiting_status: waitingStatus,
    job_source: weighted(`source:${index}`, [["Service desk", 55], ["Online booking", 20], ["Sales handover", 15], ["Phone", 10]]),
    job_categories: [type],
    requests: { summary: description, source: seededMarker },
    job_number: jobNumber,
    vehicle_id: vehicle.vehicle_id,
    description,
    type,
    status,
    assigned_to: assigned?.user_id || null,
    cosmetic_notes: index % 11 === 0 ? "Minor marks noted on arrival" : null,
    vhc_required: requiresVhc,
    maintenance_info: { seededBy: seededMarker, serviceAdvisor: usersByType.service[index % Math.max(usersByType.service.length, 1)]?.user_id || null },
    status_updated_at: iso(completedAt || addHours(createdAt, randomBetween(`upd:${index}`, 1, 12))),
    status_updated_by: assigned ? `${assigned.first_name} ${assigned.last_name}` : null,
    checked_in_at: isFuture ? null : iso(addHours(createdAt, randomBetween(`checkin:${index}`, 0, 3))),
    workshop_started_at: ["In Progress", "Complete", "Released", "Archived", "Invoiced"].includes(status) ? iso(addHours(createdAt, randomBetween(`start:${index}`, 1, 5))) : null,
    vhc_completed_at: requiresVhc && completedAt ? iso(addHours(createdAt, randomBetween(`vhcdone:${index}`, 2, 8))) : null,
    vhc_sent_at: requiresVhc && completedAt && index % 3 !== 0 ? iso(addHours(createdAt, randomBetween(`vhcsent:${index}`, 3, 12))) : null,
    parts_ordered_at: waitingStatus === "Parts" || index % 4 === 0 ? iso(addHours(createdAt, randomBetween(`parts:${index}`, 2, 18))) : null,
    completed_at: completedAt ? iso(completedAt) : null,
    milage: vehicle.mileage ? vehicle.mileage + randomBetween(`jobmile:${index}`, 0, 9000) : null,
    completion_status: completedAt ? "completed" : weighted(`comp:${index}`, [["in_progress", 45], ["additional_work", 20], ["waiting_customer", 15], ["waiting_parts", 20]]),
    rectification_notes: completedAt ? "Work completed and road tested." : null,
    job_description_snapshot: description,
    task_checklist: { version: 2, source: seededMarker, tasks: [] },
    job_division: index % 9 === 0 ? "Sales" : "Retail",
    tech_completion_status: completedAt ? "completed" : null,
    booked_by: usersByType.service[index % Math.max(usersByType.service.length, 1)]?.user_id || usersByType.admin[0]?.user_id || null,
    checked_in_by: usersByType.service[(index + 1) % Math.max(usersByType.service.length, 1)]?.user_id || null,
    workshop_started_by: assigned?.user_id || null,
    service_mode: index % 18 === 0 ? "mobile" : "workshop",
    appointment_window_start: isFuture ? iso(createdAt) : null,
    appointment_window_end: isFuture ? iso(addHours(createdAt, 2)) : null,
    service_address: index % 18 === 0 ? vehicle.customers?.address : null,
    service_postcode: index % 18 === 0 ? vehicle.customers?.postcode : null,
    created_at: iso(createdAt),
    updated_at: iso(completedAt || addHours(createdAt, randomBetween(`update:${index}`, 1, 36))),
  };
};

const makeRequestRows = (jobs) =>
  jobs.flatMap((job, index) => {
    const count = randomBetween(`reqcount:${job.id}`, 1, 3);
    return Array.from({ length: count }, (_, requestIndex) => ({
      job_id: job.id,
      description: requestIndex === 0 ? job.description || pick(jobDescriptions, index) : pick(jobDescriptions, index + requestIndex),
      hours: Number((randomBetween(`hours:${job.id}:${requestIndex}`, 5, 35) / 10).toFixed(1)),
      job_type: job.type === "Warranty" ? "Warranty" : "Customer",
      sort_order: requestIndex + 1,
      created_at: job.created_at,
      updated_at: job.updated_at,
      status: job.completed_at ? "complete" : weighted(`reqstatus:${job.id}:${requestIndex}`, [["inprogress", 55], ["waiting_parts", 20], ["waiting_customer", 15], ["complete", 10]]),
      request_source: requestIndex === 0 ? "customer_request" : "technician_added",
      pre_pick_location: requestIndex === 1 && !job.completed_at ? "on_order" : null,
      note_text: requestIndex === 0 ? null : "Added during inspection.",
    }));
  });

const makeAppointment = (index, jobs) => {
  const job = jobs[index % jobs.length];
  const base = index < 60 ? businessDate(`appt-future:${index}`, { future: true }) : new Date(job.created_at || businessDate(`appt:${index}`));
  if (index >= 60) base.setHours(randomBetween(`appth:${index}`, 8, 17), [0, 15, 30, 45][index % 4], 0, 0);
  return {
    job_id: job.id,
    customer_id: job.customer_id,
    scheduled_time: iso(base),
    status: base > today ? weighted(`apptstatus:${index}`, [["booked", 78], ["confirmed", 22]]) : weighted(`apptstatus:${index}`, [["completed", 72], ["archived", 12], ["cancelled", 5], ["no_show", 3], ["booked", 8]]),
    notes: `${job.type || "Service"} appointment for ${job.vehicle_reg || "vehicle"}`,
    created_at: iso(addDays(base, -randomBetween(`apptcreated:${index}`, 1, 28))),
    updated_at: iso(addHours(base, randomBetween(`apptupd:${index}`, 1, 24))),
    created_by: job.booked_by || null,
    updated_by: job.checked_in_by || job.booked_by || null,
  };
};

const makeCheckSheet = (index, jobs) => {
  const job = jobs[index % jobs.length];
  const createdAt = job.checked_in_at || job.created_at || iso(businessDate(`sheet:${index}`));
  return {
    job_id: job.id,
    file_name: `check-sheet-${job.job_number || job.id}-${index % 3}.pdf`,
    file_type: "application/pdf",
    file_url: `https://example-customer.hnp/check-sheets/${job.job_number || job.id}-${index}.pdf`,
    storage_path: `enrichment/check-sheets/${job.job_number || job.id}-${index}.pdf`,
    created_by: job.assigned_to || job.checked_in_by || job.booked_by || null,
    signature_url: index % 4 === 0 ? `https://example-customer.hnp/signatures/${job.job_number || job.id}.png` : null,
    created_at: createdAt,
    updated_at: iso(addHours(new Date(createdAt), randomBetween(`sheetupd:${index}`, 1, 6))),
  };
};

const makePartsRequest = (index, jobs, usersByType, vhcRows = []) => {
  const job = jobs[index % jobs.length];
  const createdAt = addHours(new Date(job.created_at || today), randomBetween(`partcreated:${index}`, 2, 48));
  const completed = Boolean(job.completed_at);
  const status = completed ? weighted(`partdone:${index}`, [["fulfilled", 62], ["received", 25], ["archived", 13]]) : weighted(`partopen:${index}`, [["pending", 22], ["approved", 28], ["ordered", 25], ["backorder", 15], ["received", 10]]);
  return {
    job_id: job.id,
    requested_by: job.assigned_to || usersByType.technicians[index % Math.max(usersByType.technicians.length, 1)]?.user_id || null,
    approved_by: ["approved", "ordered", "received", "fulfilled", "archived"].includes(status) ? usersByType.parts[index % Math.max(usersByType.parts.length, 1)]?.user_id || usersByType.managers[0]?.user_id || null : null,
    quantity: randomBetween(`qty:${index}`, 1, 4),
    status,
    created_at: iso(createdAt),
    updated_at: iso(addHours(createdAt, randomBetween(`partupd:${index}`, status === "backorder" ? 72 : 4, status === "backorder" ? 240 : 72))),
    description: pick(partDescriptions, index),
    source: index % 5 === 0 ? "vhc" : "manual",
    pre_pick_location: status === "backorder" ? "on_order" : weighted(`pickloc:${index}`, [["service_rack_1", 20], ["service_rack_2", 20], ["service_rack_3", 16], ["tyre_shed", 12], ["stairs_pre_pick", 10], ["no_pick", 22]]),
    vhc_item_id: vhcRows[index % Math.max(vhcRows.length, 1)]?.vhc_id || null,
  };
};

const makeVhc = (index, jobs, sequence = index) => {
  const job = jobs[index % jobs.length];
  const createdAt = addHours(new Date(job.checked_in_at || job.created_at || today), randomBetween(`vhc:${index}`, 1, 6));
  const severity = weighted(`severity:${index}`, [["green", 48], ["amber", 34], ["red", 15], ["grey", 3]]);
  const approval = severity === "green" ? "n/a" : weighted(`approval:${index}`, [["pending", 25], ["authorized", 30], ["declined", 20], ["completed", 25]]);
  const cost = severity === "green" ? 0 : randomBetween(`cost:${index}`, 35, 650);
  return {
    job_id: job.id,
    section: pick(vhcSections, index),
    issue_title: severity === "green" ? "Checked and OK" : pick(vhcIssues, index),
    issue_description: severity === "green" ? "No issue found during inspection." : "Recommendation recorded during vehicle health check.",
    measurement: severity === "green" ? null : `${randomBetween(`measure:${index}`, 1, 6)}mm`,
    created_at: iso(createdAt),
    updated_at: iso(addHours(createdAt, randomBetween(`vhcupd:${index}`, 1, 24))),
    approval_status: approval,
    labour_hours: severity === "green" ? 0 : Number((randomBetween(`vhh:${index}`, 3, 18) / 10).toFixed(1)),
    parts_cost: cost,
    total_override: cost ? cost + randomBetween(`labcost:${index}`, 45, 240) : 0,
    labour_complete: ["completed", "n/a"].includes(approval),
    parts_complete: ["completed", "n/a"].includes(approval),
    approved_at: ["authorized", "completed"].includes(approval) ? iso(addHours(createdAt, randomBetween(`approved:${index}`, 2, 18))) : null,
    approved_by: ["authorized", "completed"].includes(approval) ? job.customer || "Customer" : null,
    display_status: severity === "grey" ? null : severity,
    authorization_state: approval === "authorized" || approval === "completed" ? "authorized" : approval === "declined" ? "declined" : "n/a",
    severity,
    slot_code: sequence % 1000,
    line_key: `${seededMarker}-${job.id}-${sequence}-${severity}`,
    note_text: severity === "green" ? null : "Discussed with customer where applicable.",
    pre_pick_location: approval === "authorized" ? "on_order" : null,
    display_id: `VHC-${pad(sequence + 1, 5)}`,
    authorized_total_gbp: approval === "authorized" || approval === "completed" ? cost : 0,
    declined_total_gbp: approval === "declined" ? cost : 0,
    Complete: approval === "completed",
    customer_description: severity === "green" ? "Checked OK." : pick(vhcIssues, index),
  };
};

const makeInvoice = (index, jobs, sequence = index) => {
  const job = jobs[index % jobs.length];
  const completedAt = job.completed_at ? new Date(job.completed_at) : businessDate(`invoice:${index}`);
  const labour = randomBetween(`labour:${index}`, 90, 850);
  const parts = randomBetween(`invparts:${index}`, 20, 900);
  const service = labour + parts;
  const vat = Number((service * 0.2).toFixed(2));
  const total = service + vat;
  const paid = index % 7 !== 0;
  return {
    job_id: job.id,
    customer_id: job.customer_id,
    total_parts: parts,
    total_labour: labour,
    total_vat: vat,
    total,
    paid,
    payment_method: paid ? weighted(`pay:${index}`, [["Card", 55], ["Bank Transfer", 25], ["Cash", 10], ["Account", 10]]) : null,
    created_at: iso(addHours(completedAt, 1)),
    updated_at: iso(addHours(completedAt, paid ? 8 : 2)),
    sent_email_at: iso(addHours(completedAt, 2)),
    sent_portal_at: iso(addHours(completedAt, 2)),
    job_number: job.job_number,
    labour_total: labour,
    parts_total: parts,
    consumables_total: randomBetween(`cons:${index}`, 0, 35),
    vat,
    grand_total: total,
    payment_status: paid ? "Paid" : weighted(`paystatus:${index}`, [["Draft", 20], ["Sent", 55], ["Overdue", 25]]),
    due_date: iso(addDays(completedAt, 30)).slice(0, 10),
    invoice_number: `INV-ENR-${pad(sequence + 1, 5)}`,
    invoice_date: iso(completedAt).slice(0, 10),
    invoice_to: { name: job.customer, customer_id: job.customer_id },
    vehicle_details: { registration: job.vehicle_reg, make_model: job.vehicle_make_model },
    service_total: service,
    vat_total: vat,
    invoice_total: total,
    meta: { seededBy: seededMarker },
  };
};

const makeArchive = (index, jobs) => {
  const job = jobs[index % jobs.length];
  const completedAt = job.completed_at || iso(businessDate(`archive:${index}`));
  return {
    job_id: job.id,
    job_number: job.job_number,
    customer_id: job.customer_id,
    vehicle_id: job.vehicle_id,
    vehicle_reg: job.vehicle_reg,
    completed_at: completedAt,
    snapshot: { seededBy: seededMarker, status: job.status, type: job.type },
    notes: "Archived historical enrichment record.",
    created_at: iso(addDays(new Date(completedAt), randomBetween(`arch:${index}`, 1, 20))),
    customer_name: job.customer,
    vehicle_make_model: job.vehicle_make_model,
    status: "Archived",
  };
};

const makeActivityRows = (jobs, usersByType) =>
  jobs.flatMap((job, index) => {
    const base = new Date(job.created_at || today);
    const actor = job.assigned_to || usersByType.service[index % Math.max(usersByType.service.length, 1)]?.user_id || null;
    const events = [
      ["booking", "created", "Job created"],
      ["status", "checked_in", "Vehicle checked in"],
      ["workshop", "started", "Workshop work started"],
    ];
    if (job.vhc_required) events.push(["vhc", "completed", "VHC inspection completed"]);
    if (job.completed_at) events.push(["status", "completed", "Job completed"]);
    return events.map(([category, action, summary], eventIndex) => ({
      job_id: job.id,
      category,
      action,
      target_type: "job",
      target_id: String(job.id),
      summary,
      payload: { seededBy: seededMarker, jobNumber: job.job_number },
      performed_by: actor,
      occurred_at: iso(addHours(base, eventIndex + 1)),
    }));
  });

const makeStatusRows = (jobs) =>
  jobs.flatMap((job) => {
    const base = new Date(job.created_at || today);
    const rows = [{
      job_id: job.id,
      from_status: null,
      to_status: "Booked",
      changed_by: "System enrichment",
      reason: "Booking created",
      changed_at: iso(base),
    }];
    if (job.checked_in_at) rows.push({ job_id: job.id, from_status: "Booked", to_status: "Checked In", changed_by: "Service", reason: "Vehicle arrived", changed_at: job.checked_in_at });
    if (job.workshop_started_at) rows.push({ job_id: job.id, from_status: "Checked In", to_status: "In Progress", changed_by: "Workshop", reason: "Technician started work", changed_at: job.workshop_started_at });
    if (job.completed_at) rows.push({ job_id: job.id, from_status: "In Progress", to_status: job.status || "Complete", changed_by: "Workshop", reason: "Work completed", changed_at: job.completed_at });
    return rows;
  });

const makeAuditRows = (count, jobs, users) =>
  Array.from({ length: count }, (_, index) => {
    const job = jobs[index % jobs.length];
    const user = users[index % users.length];
    const occurredAt = addHours(new Date(job.created_at || businessDate(`audit:${index}`)), randomBetween(`audith:${index}`, 0, 120));
    const entityType = weighted(`entity:${index}`, [["job", 55], ["vehicle", 15], ["customer", 12], ["parts_request", 10], ["appointment", 8]]);
    const action = weighted(`action:${index}`, [["created", 25], ["updated", 45], ["status_changed", 20], ["viewed", 10]]);
    const seed = `${seededMarker}:${entityType}:${action}:${job.id}:${index}`;
    return {
      occurred_at: iso(occurredAt),
      actor_user_id: user?.user_id || null,
      actor_role: user?.role || null,
      action,
      entity_type: entityType,
      entity_id: entityType === "job" ? String(job.id) : String(index),
      prev_hash: index ? hash(`${seed}:prev`) : null,
      row_hash: hash(seed),
      diff: { seededBy: seededMarker, status: job.status },
      reason: "Operational history enrichment",
      ip_address: `10.0.${index % 20}.${(index % 240) + 10}`,
      user_agent: "HNPSystem enrichment script",
    };
  });

const makeMessageData = async (count, users, jobs) => {
  const threads = [];
  const members = [];
  const messages = [];
  const staff = users.filter((u) => String(u.role || "").toLowerCase() !== "customer");
  for (let i = 0; i < Math.ceil(count / 4); i += 1) {
    const creator = staff[i % staff.length];
    threads.push({
      thread_type: i % 5 === 0 ? "group" : "direct",
      title: i % 5 === 0 ? `Workshop handover ${pad(i + 1, 3)}` : null,
      unique_hash: `${seededMarker}:thread:${i}`,
      created_by: creator.user_id,
      created_at: iso(businessDate(`thread:${i}`)),
      updated_at: iso(addHours(businessDate(`thread:${i}`), randomBetween(`threadupd:${i}`, 1, 48))),
    });
  }
  const insertedThreads = await insertBatch("message_threads", threads, 200);
  insertedThreads.forEach((thread, index) => {
    const a = staff[index % staff.length];
    const b = staff[(index + 3) % staff.length];
    members.push({ thread_id: thread.thread_id, user_id: a.user_id, role: "member", joined_at: thread.created_at, last_read_at: thread.updated_at });
    members.push({ thread_id: thread.thread_id, user_id: b.user_id, role: "member", joined_at: thread.created_at, last_read_at: index % 4 === 0 ? null : thread.updated_at });
    const perThread = Math.min(4, count - messages.length);
    for (let m = 0; m < perThread; m += 1) {
      const sender = m % 2 === 0 ? a : b;
      const receiver = m % 2 === 0 ? b : a;
      const job = jobs[(index + m) % jobs.length];
      const createdAt = addHours(new Date(thread.created_at), m + randomBetween(`msgh:${index}:${m}`, 1, 5));
      messages.push({
        sender_id: sender.user_id,
        receiver_id: receiver.user_id,
        content: pick([
          `Can you confirm the status on ${job.job_number}?`,
          `Parts are expected later today for ${job.vehicle_reg}.`,
          `Customer has approved the amber item on ${job.job_number}.`,
          `Please move ${job.vehicle_reg} to awaiting collection when washed.`,
          `MOT slot updated for ${job.vehicle_reg}.`,
        ], index + m),
        read: m < perThread - 1,
        created_at: iso(createdAt),
        thread_id: thread.thread_id,
        metadata: { seededBy: seededMarker, jobId: job.id, jobNumber: job.job_number },
        saved_forever: index % 9 === 0,
      });
    }
  });
  await insertBatch("message_thread_members", members, 500);
  await insertBatch("messages", messages.slice(0, count), 500);
};

const makeNotifications = (count, users, jobs) =>
  Array.from({ length: count }, (_, index) => {
    const user = users[index % users.length];
    const job = jobs[index % jobs.length];
    const createdAt = addHours(new Date(job.created_at || today), randomBetween(`notif:${index}`, 1, 60));
    return {
      user_id: user.user_id,
      type: weighted(`ntype:${index}`, [["job", 50], ["parts", 20], ["vhc", 15], ["message", 15]]),
      message: pick([
        `Job ${job.job_number} has changed status.`,
        `Parts update for ${job.vehicle_reg}.`,
        `VHC decision required for ${job.job_number}.`,
        `Customer message logged for ${job.vehicle_reg}.`,
      ], index),
      read: index % 5 !== 0,
      created_at: iso(createdAt),
      target_role: index % 4 === 0 ? user.role : null,
      job_number: job.job_number,
    };
  });

const statusReport = async (users) => {
  const jobs = await selectAll("jobs", "id,status,waiting_status,assigned_to,created_at,completed_at,type", "id");
  const statuses = {};
  const workloads = {};
  for (const job of jobs) {
    statuses[job.status || "NULL"] = (statuses[job.status || "NULL"] || 0) + 1;
    const key = job.assigned_to || "unassigned";
    workloads[key] ||= { total: 0, completed: 0, active: 0, waitingCustomer: 0, waitingParts: 0 };
    workloads[key].total += 1;
    if (job.completed_at || ["Complete", "Released", "Archived", "Invoiced"].includes(job.status)) workloads[key].completed += 1;
    else workloads[key].active += 1;
    if (String(job.waiting_status || "").toLowerCase().includes("customer")) workloads[key].waitingCustomer += 1;
    if (String(job.waiting_status || "").toLowerCase().includes("parts")) workloads[key].waitingParts += 1;
  }
  const dateDistribution = {};
  for (const job of jobs) {
    const month = String(job.created_at || "").slice(0, 7) || "unknown";
    dateDistribution[month] = (dateDistribution[month] || 0) + 1;
  }
  const userMap = Object.fromEntries(users.map((u) => [u.user_id, `${u.first_name} ${u.last_name} (${u.role})`]));
  return {
    statusCounts: statuses,
    technicianWorkloads: Object.fromEntries(
      Object.entries(workloads)
        .filter(([userId]) => userId !== "unassigned")
        .map(([userId, value]) => [userMap[userId] || userId, value])
    ),
    dateDistribution,
  };
};

const main = async () => {
  const before = await auditCounts();
  console.log("Initial audit");
  console.log(JSON.stringify(before, null, 2));

  const users = await selectAll("users", "user_id,first_name,last_name,email,role,department,job_title,is_active,employment_status,start_date", "user_id");
  const usersByType = classifyUsers(users);

  const existingCustomers = await selectAll("customers", "id,firstname,lastname,name,email,address,postcode,created_at,updated_at", "created_at");
  const customersNeeded = Math.max(0, targetCounts.customers - before.customers);
  const newCustomers = await insertBatch("customers", Array.from({ length: customersNeeded }, (_, i) => makeCustomer(i, before.customers)));
  const customers = [...existingCustomers, ...newCustomers];

  const existingVehicles = await selectAll("vehicles", "vehicle_id,reg_number,registration,make,model,make_model,mileage,customer_id,created_at,updated_at,customers(name,firstname,lastname,address,postcode)", "vehicle_id");
  const vehiclesNeeded = Math.max(0, targetCounts.vehicles - before.vehicles);
  const newVehicles = await insertBatch("vehicles", Array.from({ length: vehiclesNeeded }, (_, i) => makeVehicle(i, customers)));
  const refreshedNewVehicles = newVehicles.length
    ? await selectAll("vehicles", "vehicle_id,reg_number,registration,make,model,make_model,mileage,customer_id,created_at,updated_at,customers(name,firstname,lastname,address,postcode)", "vehicle_id")
    : existingVehicles;
  const vehicles = refreshedNewVehicles;

  const existingJobs = await selectAll("jobs", "id,job_number,customer,customer_id,vehicle_id,vehicle_reg,vehicle_make_model,type,status,waiting_status,assigned_to,booked_by,checked_in_by,created_at,updated_at,checked_in_at,workshop_started_at,vhc_required,completed_at", "id");
  const jobsNeeded = Math.max(0, targetCounts.jobs - before.jobs);
  const existingEnrichmentMax = existingJobs.reduce((max, job) => {
    const match = String(job.job_number || "").match(/^ENR(\d+)$/);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);
  const newJobs = await insertBatch("jobs", Array.from({ length: jobsNeeded }, (_, i) => makeJob(i, vehicles, usersByType, existingEnrichmentMax + i)), 300);
  const jobs = [...existingJobs, ...newJobs];
  const completedJobs = jobs.filter((job) => job.completed_at || ["Complete", "Released", "Archived", "Invoiced"].includes(job.status));

  const requestsNeeded = Math.max(0, 3200 - before.job_requests);
  await insertBatch("job_requests", makeRequestRows(jobs).slice(0, requestsNeeded), 500);

  const activityNeeded = Math.max(0, 5200 - before.job_activity_events);
  await insertBatch("job_activity_events", makeActivityRows(jobs, usersByType).slice(0, activityNeeded), 500);

  const statusNeeded = Math.max(0, 5000 - before.job_status_history);
  await insertBatch("job_status_history", makeStatusRows(jobs).slice(0, statusNeeded), 500);

  await insertBatch("appointments", Array.from({ length: Math.max(0, targetCounts.appointments - before.appointments) }, (_, i) => makeAppointment(i, jobs)), 300);
  await insertBatch("job_check_sheets", Array.from({ length: Math.max(0, targetCounts.job_check_sheets - before.job_check_sheets) }, (_, i) => makeCheckSheet(i, jobs)), 300);

  const vhcNeeded = Math.max(0, targetCounts.vhc_checks - before.vhc_checks);
  const vhcJobs = jobs.filter((job) => job.vhc_required !== false);
  const existingVhc = await selectAll("vhc_checks", "vhc_id", "vhc_id");
  const newVhc = await insertBatch("vhc_checks", Array.from({ length: vhcNeeded }, (_, i) => makeVhc(i, vhcJobs.length ? vhcJobs : jobs, existingVhc.length + i)), 300);

  await insertBatch("parts_requests", Array.from({ length: Math.max(0, targetCounts.parts_requests - before.parts_requests) }, (_, i) => makePartsRequest(i, jobs, usersByType, newVhc)), 300);
  const existingInvoices = await selectAll("invoices", "invoice_number", "invoice_number");
  const existingInvoiceMax = existingInvoices.reduce((max, invoice) => {
    const match = String(invoice.invoice_number || "").match(/^INV-ENR-(\d+)$/);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);
  await insertBatch("invoices", Array.from({ length: Math.max(0, targetCounts.invoices - before.invoices) }, (_, i) => makeInvoice(i, completedJobs.length ? completedJobs : jobs, existingInvoiceMax + i)), 300);
  const existingArchive = await selectAll("job_archive", "job_id", "job_id");
  const archivedJobIds = new Set(existingArchive.map((row) => row.job_id));
  const archiveCandidates = (completedJobs.length ? completedJobs : jobs).filter((job) => !archivedJobIds.has(job.id));
  await insertBatch("job_archive", Array.from({ length: Math.min(Math.max(0, targetCounts.job_archive - before.job_archive), archiveCandidates.length) }, (_, i) => makeArchive(i, archiveCandidates)), 300);
  await insertBatch("audit_log", makeAuditRows(Math.max(0, targetCounts.audit_log - before.audit_log), jobs, users), 500);
  await makeMessageData(Math.max(0, targetCounts.messages - before.messages), users, jobs);
  await insertBatch("notifications", makeNotifications(Math.max(0, targetCounts.notifications - before.notifications), users, jobs), 500);

  const after = await auditCounts();
  const report = await statusReport(users);
  console.log("Final audit");
  console.log(JSON.stringify({ before, after, ...report }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
