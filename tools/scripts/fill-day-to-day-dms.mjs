#!/usr/bin/env node
// file location: tools/scripts/fill-day-to-day-dms.mjs
// Broad additive "day-to-day DMS" filler. Does not create users.

import crypto from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

dotenv.config({ path: resolve(root, ".env") });
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const marker = "hnp_day_to_day_fill_20260609";
const today = new Date("2026-06-09T12:00:00+01:00");

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const uuid = (value) => {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const pick = (arr, i) => arr[i % arr.length];
const pad = (n, len) => String(n).padStart(len, "0");
const iso = (d) => d.toISOString();
const date = (d) => iso(d).slice(0, 10);
const addDays = (d, n) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};
const addHours = (d, n) => {
  const next = new Date(d);
  next.setTime(next.getTime() + n * 60 * 60 * 1000);
  return next;
};
const money = (n) => Number(n.toFixed(2));

const countRows = async (table) => {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
  return count || 0;
};

const all = async (table, columns = "*", order) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = db.from(table).select(columns).range(from, from + 999);
    if (order) query = query.order(order);
    const { data, error } = await query;
    if (error) throw new Error(`Select failed for ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const insert = async (table, rows, batchSize = 500) => {
  if (!rows.length) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await db.from(table).insert(batch).select();
    if (error) throw new Error(`Insert failed for ${table}: ${error.message}`);
    out.push(...(data || []));
    console.log(`Inserted ${Math.min(i + batch.length, rows.length)}/${rows.length} into ${table}`);
  }
  return out;
};

const upsert = async (table, rows, onConflict, batchSize = 500) => {
  if (!rows.length) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await db.from(table).upsert(batch, { onConflict }).select();
    if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);
    out.push(...(data || []));
    console.log(`Upserted ${Math.min(i + batch.length, rows.length)}/${rows.length} into ${table}`);
  }
  return out;
};

const topUp = async (table, target, maker, batchSize = 500) => {
  const current = await countRows(table);
  const needed = Math.max(0, target - current);
  if (!needed) return [];
  return insert(table, Array.from({ length: needed }, (_, i) => maker(i, current)), batchSize);
};

const staffRoles = (users) => users.filter((u) => String(u.role || "").toLowerCase() !== "customer");
const techRoles = (users) => users.filter((u) => /tech|mot tester/i.test(`${u.role} ${u.job_title}`));
const managerRoles = (users) => users.filter((u) => /manager|director|owner/i.test(`${u.role}`));
const partsRoles = (users) => users.filter((u) => /parts/i.test(`${u.role}`));

const main = async () => {
  const users = await all("users", "user_id,first_name,last_name,email,role,department,job_title,phone,created_at", "user_id");
  const staff = staffRoles(users);
  const techs = techRoles(users);
  const managers = managerRoles(users);
  const partsUsers = partsRoles(users);
  const admin = staff.find((u) => /admin/i.test(u.role)) || managers[0] || staff[0];
  const customers = await all("customers", "id,name,firstname,lastname,email,mobile,address,postcode", "created_at");
  const vehicles = await all("vehicles", "vehicle_id,reg_number,registration,make,model,make_model,vin,mileage,customer_id", "vehicle_id");
  const jobs = await all("jobs", "id,job_number,customer,customer_id,vehicle_id,vehicle_reg,vehicle_make_model,type,status,assigned_to,created_at,checked_in_at,completed_at", "id");
  const invoices = await all("invoices", "id,invoice_number,job_id,job_number,customer_id,invoice_total,total,grand_total,payment_status,created_at", "created_at");

  console.log("Updating existing user profiles only; no users will be inserted.");
  for (const [i, user] of staff.entries()) {
    const manager = managers[i % Math.max(managers.length, 1)];
    await db
      .from("users")
      .update({
        phone: user.phone || `01622 ${pad(700000 + i * 137, 6)}`,
        dark_mode: pick(["system", "light", "dark"], i),
        department: user.department || pick(["Workshop", "Service", "Parts", "Sales", "Admin"], i),
        employment_type: i % 6 === 0 ? "Part Time" : "Full Time",
        employment_status: i % 17 === 0 ? "Holiday" : "Active",
        contracted_hours: i % 6 === 0 ? 24 : 40,
        contracted_hours_per_week: i % 6 === 0 ? 24 : 40,
        hourly_rate: money(13 + (i % 9) * 1.75),
        overtime_rate: money((13 + (i % 9) * 1.75) * 1.5),
        annual_salary: 24500 + (i % 12) * 3250,
        payroll_reference: `HNP-${pad(user.user_id, 4)}`,
        national_insurance_number: `QQ${pad(100000 + user.user_id * 37, 6)}C`,
        home_address: `${12 + i} Staff Close, Maidstone, ME${1 + (i % 16)} ${1 + (i % 9)}HP`,
        emergency_contact: { name: `Emergency Contact ${i + 1}`, relationship: "Family", phone: `07${pad(700000000 + i * 154321, 9)}` },
        documents: [
          { name: "Driving licence", status: "verified", checkedAt: date(addDays(today, -60 - i)) },
          { name: "Right to work", status: "verified", checkedAt: date(addDays(today, -90 - i)) },
          { name: "Handbook acknowledgement", status: "signed", checkedAt: date(addDays(today, -30 - i)) },
        ],
        manager_id: manager && manager.user_id !== user.user_id ? manager.user_id : null,
        photo_url: `https://example-customer.hnp/staff/${user.user_id}.jpg`,
        signature_storage_path: `staff/signatures/${user.user_id}.png`,
        signature_file_url: `https://example-customer.hnp/signatures/${user.user_id}.png`,
        probation_end: date(addDays(new Date(user.created_at || today), 180)),
        name: `${user.first_name} ${user.last_name}`,
        password_updated_at: iso(addDays(today, -20 - i)),
        updated_at: iso(today),
      })
      .eq("user_id", user.user_id);
  }

  const accounts = await all("accounts", "account_id,customer_id,billing_name,billing_email,balance", "account_id");
  await topUp("account_transactions", 300, (i) => {
    const account = accounts[i % accounts.length];
    const debit = i % 4 !== 0;
    return {
      account_id: account.account_id,
      transaction_date: iso(addDays(today, -i * 3)),
      amount: money(debit ? 80 + (i % 11) * 35 : -(60 + (i % 8) * 25)),
      type: debit ? "Debit" : "Credit",
      description: debit ? "Workshop invoice posted" : "Customer payment received",
      job_number: jobs[i % jobs.length]?.job_number,
      payment_method: debit ? null : pick(["Card", "Bank Transfer", "Cash"], i),
      created_by: admin.email,
      created_at: iso(addDays(today, -i * 3)),
    };
  });

  await topUp("consent_records", 260, (i) => {
    const customer = customers[i % customers.length];
    return {
      subject_type: "customer",
      email: customer.email,
      purpose: pick(["service_reminders", "mot_reminders", "marketing", "privacy_portal"], i),
      channel: pick(["email", "sms", "phone", "portal"], i),
      status: i % 7 === 0 ? "withdrawn" : "granted",
      source: pick(["website", "service desk", "phone booking", "paper form"], i),
      policy_version: "2026.1",
      wording_shown: "Customer consent captured for day-to-day dealership communications.",
      ip_address: `10.10.${i % 40}.${10 + (i % 200)}`,
      user_agent: "HNPSystem staff portal",
      captured_by: staff[i % staff.length].user_id,
      created_at: iso(addDays(today, -i * 4)),
    };
  });

  const locations = await upsert("consumable_locations", ["Main Store", "MOT Bay", "Workshop Bay 1", "Workshop Bay 2", "Valet Store", "Parts Counter"].map((name, i) => ({
    id: uuid(`consumable-location-${name}`),
    name,
    order_index: i,
    created_at: iso(addDays(today, -200 + i)),
  })), "id");
  const consumables = await all("consumables", "id,name,location_id", "created_at");
  for (const [i, row] of consumables.entries()) {
    if (!row.location_id) {
      await db.from("consumables").update({ location_id: locations[i % locations.length].id, location: locations[i % locations.length].name }).eq("id", row.id);
    }
  }

  await topUp("customer_activity_events", 1300, (i) => {
    const job = jobs[i % jobs.length];
    return {
      customer_id: job.customer_id,
      job_id: job.id,
      vehicle_id: job.vehicle_id,
      activity_type: pick(["booking_created", "vehicle_checked_in", "invoice_sent", "payment_received", "vhc_sent", "collection_confirmed"], i),
      activity_source: pick(["service", "parts", "accounts", "portal"], i),
      activity_payload: { seededBy: marker, jobNumber: job.job_number, vehicleReg: job.vehicle_reg },
      occurred_at: iso(addDays(today, -i)),
      created_by: staff[i % staff.length].user_id,
      created_at: iso(addDays(today, -i)),
    };
  });

  await topUp("customer_job_history", 1600, (i) => {
    const job = jobs[i % jobs.length];
    return {
      customer_id: job.customer_id,
      job_id: job.id,
      job_number: job.job_number,
      status_snapshot: job.status,
      vehicle_reg: job.vehicle_reg,
      vehicle_make_model: job.vehicle_make_model,
      mileage_at_service: 12000 + (i % 130000),
      recorded_at: job.completed_at || job.created_at,
      created_at: job.completed_at || job.created_at,
    };
  });

  await topUp("customer_payment_methods", 360, (i) => {
    const customer = customers[i % customers.length];
    return {
      customer_id: customer.id,
      nickname: pick(["Main card", "Business card", "Service account card"], i),
      card_brand: pick(["Visa", "Mastercard", "Amex"], i),
      last4: pad(1000 + (i * 37) % 9000, 4),
      expiry_month: 1 + (i % 12),
      expiry_year: 2027 + (i % 5),
      is_default: i % 3 === 0,
      created_at: iso(addDays(today, -i * 5)),
    };
  });

  await topUp("deliveries", 120, (i) => ({
    delivery_date: date(addDays(today, -60 + (i % 120))),
    driver_id: null,
    vehicle_reg: vehicles[i % vehicles.length].reg_number,
    fuel_type: pick(["Diesel", "Petrol"], i),
    vehicle_mpg: 32 + (i % 18),
    notes: "Parts/customer delivery run generated for live tracker coverage.",
    created_at: iso(addDays(today, -60 + i)),
    updated_at: iso(addDays(today, -59 + i)),
  }));
  await upsert("delivery_settings", [{ id: uuid("delivery-settings-default"), diesel_price_per_litre: 1.62, updated_at: iso(today) }], "id").catch(async () => {
    await insert("delivery_settings", [{ diesel_price_per_litre: 1.62, updated_at: iso(today) }]);
  });
  const deliveries = await all("deliveries", "id,delivery_date", "delivery_date");
  await topUp("delivery_stops", 260, (i) => {
    const job = jobs[i % jobs.length];
    return {
      delivery_id: deliveries[i % deliveries.length].id,
      stop_number: 1 + (i % 5),
      job_id: job.id,
      customer_id: job.customer_id,
      address: customers[i % customers.length].address,
      postcode: customers[i % customers.length].postcode,
      mileage_for_leg: 3 + (i % 42),
      estimated_fuel_cost: money(2.5 + (i % 14) * 0.75),
      status: pick(["planned", "en_route", "delivered"], i),
      notes: "Day-to-day delivery stop.",
      created_at: iso(addDays(today, -40 + i)),
      updated_at: iso(addDays(today, -39 + i)),
    };
  });

  await topUp("breach_records", 8, (i) => ({
    detected_at: iso(addDays(today, -180 + i * 21)),
    reported_internally_at: iso(addDays(today, -179 + i * 21)),
    category: pick(["misdirected email", "lost paperwork", "portal access review"], i),
    severity: pick(["low", "medium", "low"], i),
    root_cause: "Operational test record for compliance dashboard.",
    affected_count: 1 + (i % 6),
    data_categories_affected: ["contact details", "vehicle details"],
    containment_actions: "Access reviewed and record corrected.",
    remediation_actions: "Staff reminded of handling process.",
    reportable_to_ico: false,
    reportable_to_subjects: i % 4 === 0,
    decision_rationale: "No high risk to rights and freedoms identified.",
    status: pick(["closed", "open", "monitoring"], i),
    owner_user_id: managers[i % managers.length]?.user_id,
    created_at: iso(addDays(today, -180 + i * 21)),
    updated_at: iso(addDays(today, -170 + i * 21)),
  }));
  await topUp("dpia_records", 12, (i) => ({
    system_or_feature: pick(["Customer portal", "Vehicle tracking", "VHC video sharing", "HR records", "Parts delivery planner"], i),
    description: "Routine DPIA record for staff/admin dashboard coverage.",
    status: pick(["draft", "review", "signed_off"], i),
    risk_level: pick(["low", "medium", "low"], i),
    mitigations: "Role based access, audit logging, retention policy.",
    signed_off_by: managers[i % managers.length]?.user_id,
    signed_off_at: i % 3 === 0 ? iso(addDays(today, -60 + i)) : null,
    next_review: date(addDays(today, 180 + i * 12)),
    document_url: `https://example-customer.hnp/compliance/dpia-${i + 1}.pdf`,
    created_at: iso(addDays(today, -240 + i * 10)),
    updated_at: iso(addDays(today, -200 + i * 10)),
  }));
  await topUp("processing_activities", 18, (i) => ({
    name: pick(["Service bookings", "Workshop repair history", "Employee payroll", "Customer website shop", "Parts ordering"], i),
    purpose: "Operate dealership management workflows.",
    lawful_basis: pick(["contract", "legal obligation", "legitimate interests"], i),
    data_categories: ["identity", "contact", "vehicle", "transaction"],
    recipients: ["HNP staff", "suppliers", "payment providers"],
    international_transfers: "None",
    security_measures: "Role access, audit log, encrypted transport",
    retention_summary: "Retained according to published retention schedule.",
    owner_user_id: managers[i % managers.length]?.user_id,
    last_reviewed_at: date(addDays(today, -90 + i)),
    next_review_at: date(addDays(today, 270 + i)),
    created_at: iso(addDays(today, -365 + i)),
    updated_at: iso(addDays(today, -90 + i)),
  }));
  await topUp("subject_requests", 20, (i) => {
    const customer = customers[i % customers.length];
    return {
      subject_email: customer.email,
      subject_type: "customer",
      request_type: pick(["access", "rectification", "erasure", "restriction"], i),
      status: pick(["received", "in_progress", "fulfilled", "rejected"], i),
      received_at: iso(addDays(today, -80 + i * 3)),
      due_at: iso(addDays(today, -50 + i * 3)),
      fulfilled_at: i % 4 === 2 ? iso(addDays(today, -45 + i * 3)) : null,
      identity_verification_method: "email plus vehicle registration",
      response_artifact_url: i % 4 === 2 ? `https://example-customer.hnp/privacy/sar-${i}.zip` : null,
      rejection_reason: i % 4 === 3 ? "Identity not verified" : null,
      details: "Compliance request test record.",
      handled_by: admin.user_id,
      created_at: iso(addDays(today, -80 + i * 3)),
      updated_at: iso(addDays(today, -70 + i * 3)),
    };
  });
  await topUp("retention_runs", 24, (i) => ({
    ran_at: iso(addDays(today, -i * 14)),
    entity_type: pick(["audit_log", "messages", "job_archive", "customer_activity_events", "auth_login_attempts"], i),
    rows_processed: 100 + i * 7,
    rows_actioned: i % 3 === 0 ? i : 0,
    action: pick(["review", "archive", "delete"], i),
    dry_run: i % 4 !== 0,
    triggered_by: admin.user_id,
    notes: "Scheduled retention run coverage.",
  }));

  const courses = await upsert("hr_training_courses", [
    "Manual Handling", "GDPR Refresher", "EV Awareness", "MOT Annual Training", "Fire Safety", "Customer Care", "Parts Warranty Process",
  ].map((title, i) => ({
    course_id: 9000 + i,
    title,
    description: `${title} course for day-to-day DMS training records.`,
    category: pick(["Health & Safety", "Compliance", "Technical", "Customer"], i),
    renewal_interval_months: pick([12, 24, 36], i),
    created_at: iso(addDays(today, -400 + i)),
  })), "course_id");
  await topUp("hr_training_assignments", staff.length * 4, (i) => {
    const user = staff[i % staff.length];
    const course = courses[i % courses.length];
    const assignedAt = addDays(today, -120 + (i % 80));
    return {
      user_id: user.user_id,
      course_id: course.course_id,
      assigned_by: managers[i % managers.length]?.user_id || admin.user_id,
      assigned_at: iso(assignedAt),
      due_date: date(addDays(assignedAt, 45)),
      status: pick(["assigned", "in_progress", "completed", "overdue"], i),
      completed_at: i % 4 === 2 ? iso(addDays(assignedAt, 20)) : null,
      certificate_url: i % 4 === 2 ? `https://example-customer.hnp/training/cert-${user.user_id}-${course.course_id}.pdf` : null,
    };
  });
  await topUp("hr_performance_reviews", staff.length * 2, (i) => {
    const user = staff[i % staff.length];
    return {
      user_id: user.user_id,
      reviewer_id: managers[i % managers.length]?.user_id || admin.user_id,
      scheduled_at: iso(addDays(today, -120 + i)),
      score: { quality: 3 + (i % 3), attendance: 3 + ((i + 1) % 3), teamwork: 3 + ((i + 2) % 3) },
      status: pick(["scheduled", "completed", "draft"], i),
      notes: "Performance review record for HR dashboard.",
      created_at: iso(addDays(today, -160 + i)),
    };
  });
  await topUp("hr_disciplinary_cases", 12, (i) => ({
    user_id: staff[(i * 5) % staff.length].user_id,
    incident_date: date(addDays(today, -220 + i * 19)),
    incident_type: pick(["late attendance", "process reminder", "customer complaint review"], i),
    severity: pick(["informal", "low", "medium"], i),
    status: pick(["closed", "open", "monitoring"], i),
    notes: "HR case test record.",
    created_at: iso(addDays(today, -220 + i * 19)),
  }));
  const payrollRuns = await topUp("hr_payroll_runs", 18, (i) => ({
    period_start: date(addDays(today, -30 * (18 - i))),
    period_end: date(addDays(today, -30 * (17 - i) - 1)),
    processed_at: iso(addDays(today, -30 * (17 - i))),
    processed_by: managers[i % managers.length]?.user_id || admin.user_id,
    status: i === 17 ? "draft" : "processed",
  }));
  const allPayrollRuns = await all("hr_payroll_runs", "payroll_id,period_start,period_end", "payroll_id");
  await topUp("hr_payroll_adjustments", 120, (i) => ({
    payroll_id: allPayrollRuns[i % allPayrollRuns.length].payroll_id,
    user_id: staff[i % staff.length].user_id,
    type: pick(["bonus", "deduction", "overtime", "expense"], i),
    amount: money(25 + (i % 20) * 7.5),
    reason: "Payroll adjustment test record.",
    created_at: iso(addDays(today, -i * 4)),
  }));

  await topUp("clocking", staff.length * 12, (i) => {
    const user = staff[i % staff.length];
    const day = addDays(today, -Math.floor(i / staff.length));
    const inAt = new Date(`${date(day)}T08:${pad((i * 7) % 50, 2)}:00+01:00`);
    const outAt = addHours(inAt, 8 + (i % 3) * 0.5);
    return {
      user_id: user.user_id,
      date: date(day),
      clock_in: iso(inAt),
      clock_out: i % 37 === 0 ? null : iso(outAt),
      break_start: iso(addHours(inAt, 4)),
      break_end: iso(addHours(inAt, 4.5)),
      total_hours: i % 37 === 0 ? null : 7.5 + (i % 3) * 0.5,
      status: i % 37 === 0 ? "clocked_in" : "clocked_out",
      notes: pick(["Normal shift", "Late finish for customer collection", "Training morning", "Parts cover"], i),
      created_at: iso(inAt),
      updated_at: iso(outAt),
    };
  });
  await topUp("job_clocking", 900, (i) => {
    const job = jobs[i % jobs.length];
    const user = techs[i % techs.length] || staff[i % staff.length];
    const inAt = addHours(new Date(job.checked_in_at || job.created_at || today), 1 + (i % 5));
    return {
      user_id: user.user_id,
      job_id: job.id,
      job_number: job.job_number,
      clock_in: iso(inAt),
      clock_out: i % 18 === 0 ? null : iso(addHours(inAt, 1 + (i % 4))),
      work_type: pick(["initial", "diagnosis", "repair", "road_test", "quality_check"], i),
      created_at: iso(inAt),
      updated_at: iso(addHours(inAt, 2)),
    };
  });
  await topUp("overtime_sessions", 160, (i) => {
    const user = staff[i % staff.length];
    const job = jobs[i % jobs.length];
    return {
      period_id: null,
      user_id: user.user_id,
      job_id: job.id,
      date: date(addDays(today, -i)),
      start_time: "17:30",
      end_time: i % 3 === 0 ? "20:00" : "19:00",
      approved_by: managers[i % managers.length]?.user_id || admin.user_id,
      notes: "Overtime to finish booked work.",
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i)),
    };
  });
  await topUp("tech_efficiency_targets", techs.length, (i) => ({
    user_id: techs[i % techs.length].user_id,
    monthly_target_hours: 145 + (i % 4) * 10,
    weight: 0.7 + (i % 3) * 0.05,
    created_at: iso(addDays(today, -300 + i)),
    updated_at: iso(today),
  }));

  const parts = await all("parts_catalog", "id,part_number,name,unit_cost,unit_price,qty_in_stock,qty_reserved,qty_on_order", "part_number");
  const partsPool = parts.length ? parts : await insert("parts_catalog", Array.from({ length: 40 }, (_, i) => ({
    part_number: `HNP-STK-${pad(i + 1, 5)}`,
    name: pick(["Oil filter", "Air filter", "Brake pads", "Wiper blades", "Battery"], i),
    description: "Stock part generated for DMS coverage.",
    category: pick(["Service", "Brakes", "Electrical", "Tyres"], i),
    supplier: pick(["KGM Parts", "Mitsubishi Parts", "Accessory World"], i),
    oem_reference: `OEM-${pad(i + 1, 5)}`,
    barcode: `505000${pad(i + 1, 6)}`,
    unit_cost: money(8 + i * 1.75),
    unit_price: money(14 + i * 2.25),
    qty_in_stock: 4 + (i % 30),
    qty_reserved: i % 5,
    qty_on_order: i % 7,
    reorder_level: 3 + (i % 6),
    storage_location: pick(["A1", "A2", "B1", "Tyre Shed", "Service Rack 1"], i),
    service_default_zone: pick(["service_rack_1", "service_rack_2", "service_rack_3", "service_rack_4"], i),
    sales_default_zone: pick(["sales_rack_1", "sales_rack_2", "sales_rack_3", "sales_rack_4"], i),
    notes: "Common stock item.",
    is_active: true,
    created_at: iso(addDays(today, -300 + i)),
    updated_at: iso(today),
  })));
  await topUp("part_delivery_logs", 300, (i) => {
    const part = partsPool[i % partsPool.length];
    return {
      part_id: part.id,
      supplier: pick(["KGM Parts", "Mitsubishi Parts", "Accessory World", "Local Motor Factors"], i),
      order_reference: `DL-${pad(i + 1, 5)}`,
      qty_ordered: 1 + (i % 12),
      qty_received: i % 8 === 0 ? i % 6 : 1 + (i % 12),
      unit_cost: part.unit_cost || 10,
      delivery_date: date(addDays(today, -i)),
      notes: "Goods received into stock.",
      created_by: partsUsers[i % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
      created_at: iso(addDays(today, -i)),
    };
  });
  const deliveriesParts = await topUp("parts_deliveries", 80, (i) => ({
    supplier: pick(["KGM Parts", "Mitsubishi Parts", "Accessory World", "Local Motor Factors"], i),
    order_reference: `PO-${pad(i + 1, 5)}`,
    status: pick(["ordering", "on_route", "received", "partial", "cancelled"], i),
    expected_date: date(addDays(today, -10 + i)),
    received_date: i % 5 >= 2 ? date(addDays(today, -9 + i)) : null,
    notes: "Live delivery planner data.",
    created_by: partsUsers[i % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
    updated_by: partsUsers[(i + 1) % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
    created_at: iso(addDays(today, -40 + i)),
    updated_at: iso(addDays(today, -39 + i)),
  }));
  const allPartDeliveries = await all("parts_deliveries", "id,status", "created_at");
  const deliveryItems = await topUp("parts_delivery_items", 260, (i) => {
    const part = partsPool[i % partsPool.length];
    const delivery = allPartDeliveries[i % allPartDeliveries.length];
    const job = jobs[i % jobs.length];
    return {
      delivery_id: delivery.id,
      part_id: part.id,
      job_id: i % 3 === 0 ? job.id : null,
      quantity_ordered: 1 + (i % 8),
      quantity_received: i % 4 === 0 ? 0 : 1 + (i % 8),
      unit_cost: part.unit_cost || 10,
      unit_price: part.unit_price || 20,
      status: pick(["ordered", "backorder", "received", "cancelled"], i),
      notes: "Delivery item line.",
      created_by: partsUsers[i % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
      updated_by: partsUsers[(i + 1) % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
      created_at: iso(addDays(today, -30 + i)),
      updated_at: iso(addDays(today, -29 + i)),
    };
  });
  const allDeliveryItems = await all("parts_delivery_items", "id,part_id,unit_cost,unit_price", "created_at");
  await topUp("parts_stock_movements", 700, (i) => {
    const item = allDeliveryItems[i % allDeliveryItems.length];
    return {
      part_id: item.part_id,
      delivery_item_id: i % 2 === 0 ? item.id : null,
      movement_type: pick(["delivery", "allocation", "booked", "return", "adjustment", "stock_take", "correction"], i),
      quantity: i % 5 === 0 ? -1 : 1 + (i % 6),
      unit_cost: item.unit_cost || 10,
      unit_price: item.unit_price || 20,
      reference: `MOV-${pad(i + 1, 5)}`,
      notes: "Stock movement for live stock cards.",
      created_at: iso(addDays(today, -i)),
    };
  });
  const goodsIn = await topUp("parts_goods_in", 90, (i) => ({
    goods_in_number: `GIN-FILL-${pad(i + 1, 5)}`,
    supplier_name: pick(["KGM Parts", "Mitsubishi Parts", "Accessory World", "Local Motor Factors"], i),
    supplier_address: "Parts Industrial Estate, Maidstone",
    supplier_contact: "parts@example-supplier.hnp",
    invoice_number: `SUP-INV-${pad(i + 1, 5)}`,
    delivery_note_number: `DN-${pad(i + 1, 5)}`,
    invoice_date: date(addDays(today, -i)),
    price_level: pick(["Trade", "Retail", "Warranty"], i),
    notes: "Goods-in record with assigned item lines.",
    scan_payload: { seededBy: marker, source: "manual" },
    status: pick(["draft", "awaiting_assignment", "completed", "cancelled"], i),
    created_by_user_id: partsUsers[i % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
    completed_at: i % 4 === 2 ? iso(addDays(today, -i)) : null,
    created_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i + 1)),
  }));
  const allGoodsIn = await all("parts_goods_in", "id,goods_in_number", "created_at");
  await topUp("parts_goods_in_items", 450, (i) => {
    const gi = allGoodsIn[i % allGoodsIn.length];
    const part = partsPool[i % partsPool.length];
    const job = jobs[i % jobs.length];
    return {
      goods_in_id: gi.id,
      line_number: 1 + (i % 12),
      part_catalog_id: part.id,
      part_number: part.part_number,
      main_part_number: part.part_number,
      description: part.name,
      bin_location: pick(["A1", "B2", "Service Rack 1", "Tyre Shed", "Counter"], i),
      franchise: pick(["KGM", "Mitsubishi", "Aftermarket"], i),
      retail_price: part.unit_price || 20,
      cost_price: part.unit_cost || 10,
      discount_code: pick(["A", "B", "TRADE"], i),
      surcharge: i % 9 === 0 ? 12 : 0,
      quantity: 1 + (i % 8),
      vat_rate: "20",
      sales_prices: [{ level: "retail", price: part.unit_price || 20 }],
      purchase_details: { supplier: "Supplier", order: gi.goods_in_number },
      dealer_details: { franchise: "HNP" },
      stock_details: { bin: pick(["A1", "B2", "Counter"], i), inStock: true },
      added_to_job: i % 3 === 0,
      job_id: i % 3 === 0 ? job.id : null,
      job_number: i % 3 === 0 ? job.job_number : null,
      job_allocation_payload: i % 3 === 0 ? { jobNumber: job.job_number, vehicleReg: job.vehicle_reg } : {},
      notes: "Goods-in line with stock and job allocation metadata.",
      created_by_user_id: partsUsers[i % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
    };
  });

  const jobRequests = await all("job_requests", "request_id,job_id,description", "request_id");
  await topUp("parts_job_items", 900, (i) => {
    const job = jobs[i % jobs.length];
    const part = partsPool[i % partsPool.length];
    const req = jobRequests[i % jobRequests.length];
    return {
      job_id: job.id,
      part_id: part.id,
      quantity_requested: 1 + (i % 4),
      quantity_allocated: i % 5 === 0 ? 0 : 1 + (i % 3),
      quantity_fitted: i % 4 === 0 ? 0 : 1,
      status: pick(["pending", "waiting_authorisation", "awaiting_stock", "on_order", "booked", "allocated", "pre_picked", "picked", "loaded", "stock", "fitted", "cancelled", "removed", "unavailable"], i),
      origin: pick(["vhc", "manual", "goods_in"], i),
      pre_pick_location: pick(["service_rack_1", "service_rack_2", "service_rack_3", "service_rack_4", "sales_rack_1", "sales_rack_2", "tyre_shed", "stairs_pre_pick", "no_pick", "on_order"], i),
      storage_location: pick(["A1", "A2", "B3", "Counter"], i),
      unit_cost: part.unit_cost || 10,
      unit_price: part.unit_price || 20,
      request_notes: "Part line for job card parts tab.",
      authorised: i % 3 !== 0,
      stock_status: pick(["in_stock", "no_stock", "back_order"], i),
      eta_date: date(addDays(today, i % 12)),
      eta_time: "14:00",
      supplier_reference: `SUP-${pad(i + 1, 5)}`,
      labour_hours: money((i % 6) * 0.25),
      allocated_to_request_id: req?.request_id || null,
      part_number_snapshot: part.part_number,
      part_name_snapshot: part.name,
      row_description: part.name,
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
    };
  });
  const jobItems = await all("parts_job_items", "id,part_id,unit_cost,unit_price", "created_at");
  await topUp("parts_requests", 1800, (i, current) => {
    const job = jobs[(current + i) % jobs.length];
    const part = partsPool[(current + i) % partsPool.length];
    return {
      job_id: job.id,
      requested_by: job.assigned_to || techs[i % techs.length]?.user_id,
      approved_by: partsUsers[i % Math.max(partsUsers.length, 1)]?.user_id || admin.user_id,
      quantity: 1 + (i % 5),
      status: pick(["pending", "approved", "ordered", "backorder", "received", "fulfilled", "archived", "waiting_authorisation"], i),
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
      part_id: part.id,
      description: part.name,
      source: pick(["manual", "vhc", "goods_in"], i),
      pre_pick_location: pick(["service_rack_1", "service_rack_2", "sales_rack_1", "tyre_shed", "stairs_pre_pick", "no_pick", "on_order"], i),
      fulfilled_by: jobItems[i % jobItems.length]?.id || null,
    };
  });

  await topUp("parts_delivery_jobs", 160, (i) => {
    const invoice = invoices[i % invoices.length];
    const job = jobs.find((row) => row.id === invoice.job_id) || jobs[i % jobs.length];
    const customer = customers.find((row) => row.id === job.customer_id) || customers[i % customers.length];
    const part = partsPool[i % partsPool.length];
    const qty = 1 + (i % 3);
    const unit = part.unit_price || 20;
    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      job_id: job.id,
      customer_id: customer.id,
      customer_name: customer.name || `${customer.firstname || ""} ${customer.lastname || ""}`.trim(),
      part_name: part.name,
      part_number: part.part_number,
      quantity: qty,
      unit_price: unit,
      total_price: money(qty * unit),
      items: [{ partNumber: part.part_number, name: part.name, qty }],
      payment_method: pick(["Card", "Account", "Cash"], i),
      is_paid: i % 5 !== 0,
      delivery_date: date(addDays(today, -30 + i)),
      address: customer.address,
      contact_name: customer.name,
      contact_phone: customer.mobile,
      contact_email: customer.email,
      notes: "Parts delivery job.",
      status: pick(["scheduled", "en_route", "completed"], i),
      sort_order: i % 10,
      completed_at: i % 3 === 2 ? iso(addDays(today, -30 + i)) : null,
      created_at: iso(addDays(today, -40 + i)),
      updated_at: iso(addDays(today, -39 + i)),
    };
  });
  await topUp("parts_delivery_runs", 120, (i) => {
    const job = jobs[i % jobs.length];
    const customer = customers.find((row) => row.id === job.customer_id) || customers[i % customers.length];
    return {
      job_id: job.id,
      customer_id: customer.id,
      delivery_date: date(addDays(today, -30 + i)),
      time_leave: "09:15",
      time_arrive: "10:05",
      mileage: 8 + (i % 60),
      fuel_cost: money(4 + (i % 20) * 0.85),
      stops_count: 1 + (i % 5),
      destination_address: customer.address,
      status: pick(["planned", "dispatched", "completed", "cancelled"], i),
      notes: "Delivery planner run.",
      created_at: iso(addDays(today, -40 + i)),
      updated_at: iso(addDays(today, -39 + i)),
    };
  });

  await topUp("parts_search_events", 260, (i) => ({
    user_id: uuid(`parts-search-user-${staff[i % staff.length].user_id}`),
    job_id: uuid(`parts-search-job-${jobs[i % jobs.length].id}`),
    context_text: pick(["front brake pads", "oil filter", "tyre pressure sensor", "wiper blades", "battery"], i),
    selected_suggestion: pick(["brake pads", "oil filter", "tpms sensor", "wiper blade", "battery"], i),
    final_query: pick(["brake pads KGM", "oil filter Mitsubishi", "TPMS sensor", "wiper blade pair", "battery 096"], i),
    created_at: iso(addDays(today, -i)),
  }));
  await topUp("parts_search_learned", 80, (i) => ({
    normalized_context_key: `context-${pad(i + 1, 3)}`,
    learned_query: pick(["brake pads", "oil filter", "battery", "wiper blades"], i),
    scope: i % 5 === 0 ? "user" : "global",
    user_id: i % 5 === 0 ? uuid(`learned-${staff[i % staff.length].user_id}`) : null,
    usage_count: 3 + i,
    last_used_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i)),
  }));
  await topUp("parts_search_presets", 40, (i) => ({
    normalized_context_key: `preset-${pad(i + 1, 3)}`,
    context_keywords: [pick(["brake", "oil", "battery", "tyre", "wiper"], i)],
    suggested_query: pick(["front brake pads", "oil filter", "096 battery", "225 55 18 tyre", "wiper blade set"], i),
    tags: ["day-to-day", "parts"],
    created_at: iso(addDays(today, -i)),
  }));

  await topUp("invoice_items", 3200, (i) => {
    const invoice = invoices[i % invoices.length];
    const part = partsPool[i % partsPool.length];
    const qty = 1 + (i % 3);
    const unit = i % 2 === 0 ? part.unit_price || 25 : 75 + (i % 6) * 12;
    return { invoice_id: invoice.id, description: i % 2 === 0 ? part.name : "Workshop labour", quantity: qty, unit_price: unit, total: money(qty * unit) };
  });
  await topUp("invoice_payments", 900, (i) => {
    const invoice = invoices[i % invoices.length];
    const total = invoice.invoice_total || invoice.grand_total || invoice.total || 120;
    return {
      invoice_id: invoice.id,
      amount: money(Number(total) * (i % 5 === 0 ? 0.5 : 1)),
      payment_method: pick(["Card", "Bank Transfer", "Cash", "Account"], i),
      reference: `PAY-${pad(i + 1, 5)}`,
      payment_date: date(addDays(today, -i)),
      created_at: iso(addDays(today, -i)),
    };
  });
  const invoiceRequests = await topUp("invoice_requests", 900, (i) => {
    const invoice = invoices[i % invoices.length];
    return {
      invoice_id: invoice.id,
      request_number: 1 + (i % 5),
      title: pick(["Service labour", "Parts supplied", "Diagnostic", "MOT", "VHC authorised item"], i),
      notes: "Invoice request section line.",
      labour_net: money(40 + (i % 10) * 12),
      labour_vat: money((40 + (i % 10) * 12) * 0.2),
      labour_vat_rate: 20,
      metadata: { seededBy: marker },
    };
  });
  const allInvoiceRequests = await all("invoice_requests", "id,title", "request_number");
  await topUp("invoice_request_items", 1600, (i) => {
    const req = allInvoiceRequests[i % allInvoiceRequests.length];
    const part = partsPool[i % partsPool.length];
    const qty = 1 + (i % 4);
    const net = part.unit_price || 25;
    return {
      request_id: req.id,
      part_number: part.part_number,
      description: part.name,
      retail: net,
      qty,
      net_price: money(net * qty),
      vat_amount: money(net * qty * 0.2),
      vat_rate: 20,
      metadata: { seededBy: marker },
    };
  });
  await topUp("payment_links", 120, (i) => ({
    invoice_id: invoices[i % invoices.length].id,
    provider: "stripe",
    checkout_url: `https://pay.example-customer.hnp/${uuid(`payment-link-${i}`)}`,
    expires_at: iso(addDays(today, 14 + (i % 30))),
  }));
  await topUp("payment_plans", 60, (i) => {
    const invoice = invoices[i % invoices.length];
    return {
      customer_id: invoice.customer_id || customers[i % customers.length].id,
      job_id: invoice.job_id,
      invoice_id: invoice.id,
      name: `Service plan ${pad(i + 1, 3)}`,
      description: "Monthly payment plan for workshop invoice.",
      total_amount: 600 + i * 12,
      balance_due: i % 4 === 0 ? 0 : 300 + i * 7,
      frequency: "monthly",
      next_payment_date: date(addDays(today, 30 + i)),
      status: pick(["active", "completed", "paused"], i),
      created_at: iso(addDays(today, -90 + i)),
    };
  });
  await topUp("payslips", staff.length * 6, (i) => {
    const user = staff[i % staff.length];
    const gross = 2200 + (i % 12) * 115;
    const tax = gross * 0.18;
    const ni = gross * 0.08;
    const pension = gross * 0.05;
    return {
      user_id: user.user_id,
      paid_date: date(addDays(today, -30 * Math.floor(i / staff.length))),
      period_start: date(addDays(today, -30 * (Math.floor(i / staff.length) + 1))),
      period_end: date(addDays(today, -30 * Math.floor(i / staff.length) - 1)),
      pay_period_label: `2026 period ${1 + (i % 12)}`,
      status: pick(["issued", "paid", "draft"], i),
      gross_pay: gross,
      net_pay: money(gross - tax - ni - pension),
      taxable_pay: gross,
      tax_paid: money(tax),
      ni_paid: money(ni),
      pension_employee: money(pension),
      pension_employer: money(pension * 1.4),
      hourly_rate: 15 + (i % 8),
      contracted_hours: 40,
      tax_code: "1257L",
      ni_number: `QQ${pad(200000 + user.user_id * 17, 6)}C`,
      ytd_gross: gross * (1 + (i % 12)),
      ytd_net: money((gross - tax - ni - pension) * (1 + (i % 12))),
      earnings: [{ label: "Basic pay", amount: gross }],
      deductions: [{ label: "Tax", amount: money(tax) }, { label: "NI", amount: money(ni) }],
      employee_snapshot: { name: `${user.first_name} ${user.last_name}`, role: user.role },
      employer_snapshot: { name: "Humphries & Parks" },
      notes: "Payroll record for profile/accounts pages.",
      reference: `PS-${user.user_id}-${pad(i + 1, 4)}`,
      created_by: admin.user_id,
      updated_by: admin.user_id,
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i)),
    };
  });

  await upsert("personal_savings", staff.map((user, i) => ({
    user_id: user.user_id,
    target_amount: 5000 + (i % 8) * 1000,
    current_amount: 900 + (i % 10) * 275,
    monthly_contribution: 150 + (i % 6) * 25,
    created_at: iso(addDays(today, -180 + i)),
    updated_at: iso(today),
  })), "user_id");
  await upsert("user_personal_security", staff.map((user, i) => ({
    user_id: user.user_id,
    passcode_hash: hash(`passcode-${user.user_id}`),
    is_setup: true,
    created_at: iso(addDays(today, -90 + i)),
    updated_at: iso(today),
  })), "user_id");
  await upsert("user_personal_state", staff.map((user, i) => ({
    user_id: user.user_id,
    state_json: { selectedTab: "dashboard", budgetMonth: "2026-06", seededBy: marker },
    created_at: iso(addDays(today, -60 + i)),
    updated_at: iso(today),
  })), "user_id");
  await upsert("user_personal_layout", staff.map((user) => ({
    user_id: user.user_id,
    layout_json: [
      { widget: "savings", x: 1, y: 1, w: 4, h: 3 },
      { widget: "bills", x: 5, y: 1, w: 4, h: 3 },
      { widget: "goals", x: 9, y: 1, w: 4, h: 3 },
    ],
    updated_at: iso(today),
  })), "user_id");
  await topUp("personal_bills", staff.length * 5, (i) => ({
    user_id: staff[i % staff.length].user_id,
    name: pick(["Mortgage/Rent", "Council tax", "Utilities", "Phone", "Car insurance"], i),
    amount: money(35 + (i % 20) * 18),
    due_day: 1 + (i % 28),
    is_recurring: true,
    created_at: iso(addDays(today, -120 + i)),
    updated_at: iso(today),
  }));
  await topUp("personal_goals", staff.length * 2, (i) => ({
    user_id: staff[i % staff.length].user_id,
    type: pick(["house", "holiday", "custom"], i),
    target: 1500 + (i % 12) * 500,
    current: 250 + (i % 9) * 180,
    deadline: date(addDays(today, 120 + i * 7)),
    created_at: iso(addDays(today, -120 + i)),
    updated_at: iso(today),
  }));
  await topUp("personal_notes", staff.length * 3, (i) => ({
    user_id: staff[i % staff.length].user_id,
    content: pick(["Book dentist", "Renew insurance", "Check payslip", "Plan holiday", "Update emergency contact"], i),
    created_at: iso(addDays(today, -30 + i)),
    updated_at: iso(today),
  }));
  await topUp("personal_transactions", staff.length * 20, (i) => ({
    user_id: staff[i % staff.length].user_id,
    type: i % 5 === 0 ? "income" : "expense",
    category: pick(["Salary", "Fuel", "Food", "Bills", "Savings", "Workshop snacks"], i),
    amount: money(i % 5 === 0 ? 2100 + (i % 7) * 50 : 8 + (i % 30) * 4.5),
    date: date(addDays(today, -i)),
    is_recurring: i % 6 === 0,
    notes: "Personal finance dashboard record.",
    created_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i)),
  }));
  await topUp("personal_attachments", staff.length * 2, (i) => ({
    user_id: staff[i % staff.length].user_id,
    file_url: `https://example-customer.hnp/personal/${staff[i % staff.length].user_id}/attachment-${i}.pdf`,
    file_name: pick(["Insurance.pdf", "UtilityBill.pdf", "TrainingCertificate.pdf", "PayslipNote.pdf"], i),
    mime_type: "application/pdf",
    file_size: 120000 + i * 300,
    created_at: iso(addDays(today, -i)),
  }));
  await topUp("user_personal_widgets", staff.length * 6, (i) => ({
    user_id: staff[i % staff.length].user_id,
    widget_type: pick(["savings", "bills", "goals", "transactions", "notes", "attachments"], i),
    is_visible: true,
    position_x: 1 + (i % 3) * 4,
    position_y: 1 + Math.floor((i % 6) / 3) * 3,
    width: 4,
    height: 3,
    config_json: { seededBy: marker },
    created_at: iso(addDays(today, -30 + i)),
    updated_at: iso(today),
  }));
  const personalWidgetTypes = ["savings", "bills", "goals", "transactions", "notes", "attachments"];
  await upsert("user_personal_widget_data", staff.flatMap((user, userIndex) =>
    personalWidgetTypes.map((widgetType, widgetIndex) => ({
      user_id: user.user_id,
      widget_type: widgetType,
      data_json: { seededBy: marker, refreshedAt: iso(today), value: userIndex * personalWidgetTypes.length + widgetIndex },
      updated_at: iso(today),
    }))
  ), "user_id,widget_type");

  await topUp("news_updates", 80, (i) => ({
    title: pick(["Workshop update", "Parts delivery reminder", "Customer handover focus", "Health and safety notice", "Sales prep priority"], i),
    content: "Daily operating update for the staff news feed.",
    departments: [pick(["Workshop", "Service", "Parts", "Sales", "Admin"], i)],
    author: `${staff[i % staff.length].first_name} ${staff[i % staff.length].last_name}`,
    created_by: staff[i % staff.length].user_id,
    created_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i)),
  }));

  await topUp("job_check_sheet_checkboxes", 5000, (i) => {
    const sheets = []; // populated below for memory clarity
    return null;
  }).catch(() => {});
  const sheets = await all("job_check_sheets", "sheet_id,job_id,created_by,created_at", "sheet_id");
  const checkboxCurrent = await countRows("job_check_sheet_checkboxes");
  if (checkboxCurrent < 5000) {
    await insert("job_check_sheet_checkboxes", Array.from({ length: 5000 - checkboxCurrent }, (_, i) => ({
      sheet_id: sheets[i % sheets.length].sheet_id,
      label: pick(["Oil level", "Brake fluid", "Tyre pressures", "Lights", "Road test", "Customer items"], i),
      position_x: (i % 10) * 8 + 5,
      position_y: (i % 12) * 6 + 5,
      is_checked: i % 5 !== 0,
      created_at: iso(addDays(today, -i % 200)),
    })), 500);
  }
  await topUp("job_cosmetic_damage", 400, (i) => ({
    job_id: jobs[i % jobs.length].id,
    has_damage: i % 3 !== 0,
    notes: pick(["Stone chips on bonnet", "Small alloy scuff", "No visible damage", "Rear bumper mark"], i),
    created_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i + 1)),
  })).catch((error) => console.warn(error.message));
  await topUp("job_customer_statuses", 900, (i) => ({
    job_id: jobs[i % jobs.length].id,
    customer_status: pick(["Neither", "Waiting Customer", "Waiting Parts", "Authorised", "Declined"], i),
    created_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i + 1)),
  }));
  await topUp("job_files", 1200, (i) => {
    const job = jobs[i % jobs.length];
    return {
      job_id: job.id,
      file_name: pick(["checksheet.pdf", "customer-video.mp4", "invoice.pdf", "estimate.pdf", "damage-photo.jpg"], i),
      file_url: `https://example-customer.hnp/jobs/${job.job_number}/file-${i}`,
      file_type: pick(["application/pdf", "video/mp4", "image/jpeg"], i),
      uploaded_by: staff[i % staff.length].user_id,
      folder: pick(["general", "vhc", "invoice", "damage", "customer"], i),
      uploaded_at: iso(addDays(today, -i)),
      visible_to_customer: i % 4 !== 0,
      file_size: 50000 + i * 220,
      storage_type: "external",
      storage_path: `jobs/${job.job_number}/file-${i}`,
      vhc_concern_link: i % 5 === 0 ? { section: "Tyres" } : null,
    };
  });
  await topUp("job_notes", 1600, (i) => {
    const job = jobs[i % jobs.length];
    return {
      job_id: job.id,
      user_id: staff[i % staff.length].user_id,
      note_text: pick(["Customer called for update.", "Parts ETA confirmed.", "Road test completed.", "Awaiting authorisation.", "Vehicle moved to collection bay."], i),
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
      hidden_from_customer: i % 4 !== 0,
      last_updated_by: staff[(i + 1) % staff.length].user_id,
    };
  });
  await topUp("job_booking_requests", 500, (i) => {
    const job = jobs[i % jobs.length];
    return {
      job_id: job.id,
      customer_id: job.customer_id,
      vehicle_id: job.vehicle_id,
      description: "Customer requested booking confirmation and estimate.",
      waiting_status: job.status,
      status: pick(["pending", "approved", "declined", "confirmed"], i),
      submitted_by: staff[i % staff.length].user_id,
      submitted_by_name: `${staff[i % staff.length].first_name} ${staff[i % staff.length].last_name}`,
      submitted_at: iso(addDays(today, -i)),
      approved_by: managers[i % managers.length]?.user_id || admin.user_id,
      approved_by_name: managers[i % managers.length] ? `${managers[i % managers.length].first_name} ${managers[i % managers.length].last_name}` : `${admin.first_name} ${admin.last_name}`,
      approved_at: i % 3 !== 0 ? iso(addDays(today, -i + 1)) : null,
      confirmation_sent_at: i % 3 !== 0 ? iso(addDays(today, -i + 1)) : null,
      price_estimate: 120 + (i % 20) * 15,
      estimated_completion: iso(addDays(today, -i + 2)),
      loan_car_details: i % 4 === 0 ? "Loan car required" : null,
      confirmation_notes: "Booking request fixture.",
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
    };
  }).catch((error) => console.warn(error.message));
  await topUp("job_request_detections", 500, (i) => {
    const req = jobRequests[i % jobRequests.length];
    const job = jobs.find((row) => row.id === req.job_id) || jobs[i % jobs.length];
    return {
      job_id: job.id,
      job_number: job.job_number,
      request_id: req.request_id,
      request_index: 1 + (i % 3),
      source_text: req.description || "Customer request",
      job_type: pick(["service", "repair", "mot", "diagnostic"], i),
      item_category: pick(["customer", "vhc", "parts", "warranty"], i),
      confidence: money(0.7 + (i % 25) / 100),
      explanation: "Detected from job description.",
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
    };
  });
  await topUp("job_share_links", 400, (i) => {
    const job = jobs[i % jobs.length];
    return {
      job_id: job.id,
      job_number: job.job_number,
      link_code: `DAY${pad(i + 1, 6)}`,
      created_at: iso(addDays(today, -i)),
      viewed_at: i % 3 === 0 ? iso(addDays(today, -i + 1)) : null,
    };
  }).catch((error) => console.warn(error.message));
  await topUp("job_writeups", 1200, (i) => {
    const job = jobs[i % jobs.length];
    const tech = techs[i % techs.length] || staff[i % staff.length];
    return {
      job_id: job.id,
      technician_id: tech.user_id,
      fault: pick(["Noise from brakes", "Warning light", "Service due", "Customer reported vibration"], i),
      rectification: pick(["Pads replaced and road tested", "Diagnostic completed", "Service completed", "Wheel balance completed"], i),
      warranty_claim: i % 8 === 0 ? `WC-${pad(i, 5)}` : null,
      tsr_number: i % 12 === 0 ? `TSR-${pad(i, 5)}` : null,
      pwa_number: i % 15 === 0 ? `PWA-${pad(i, 5)}` : null,
      technical_bulletins: i % 9 === 0 ? "Checked latest bulletin" : null,
      technical_signature: `${tech.first_name} ${tech.last_name}`,
      quality_control: i % 4 === 0 ? "QC pass" : null,
      qty: [{ label: "Labour", value: 1 }],
      booked: [{ date: date(today), hours: 1.5 }],
      cause_entries: [{ cause: "Wear and tear" }],
      completion_status: pick(["additional_work", "completed", "waiting_parts"], i),
      task_checklist: { version: 2, tasks: [{ label: "Road test", checked: true }] },
      added_fault: "Additional check added",
      added_rectification: "Additional check completed",
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i + 1)),
    };
  }).catch((error) => console.warn(error.message));

  await topUp("labour_time_overrides", 80, (i) => ({
    normalized_key: `labour-${pad(i + 1, 3)}`,
    override_time_hours: money(0.5 + (i % 8) * 0.25),
    scope: i % 4 === 0 ? "user" : "global",
    user_id: i % 4 === 0 ? uuid(`labour-user-${staff[i % staff.length].user_id}`) : null,
    usage_count: i * 2,
    last_used_at: iso(addDays(today, -i)),
    updated_at: iso(addDays(today, -i)),
  }));
  await topUp("labour_time_presets", 80, (i) => ({
    normalized_key: `preset-labour-${pad(i + 1, 3)}`,
    display_description: pick(["Brake inspection", "Diagnostic scan", "Service inspection", "Road test", "VHC item"], i),
    default_time_hours: money(0.3 + (i % 10) * 0.2),
    tags: ["workshop", "day-to-day"],
    created_at: iso(addDays(today, -i)),
  }));

  await topUp("key_tracking_events", 1200, (i) => {
    const job = jobs[i % jobs.length];
    return {
      vehicle_id: job.vehicle_id,
      job_id: job.id,
      action: pick(["Keys received - Service desk", "Keys moved - Workshop board", "Keys hung - Collection", "Keys issued to technician"], i),
      performed_by: staff[i % staff.length].user_id,
      occurred_at: iso(addDays(today, -i)),
      notes: `Job ${job.job_number} ${job.vehicle_reg}`,
    };
  });
  await topUp("vehicle_tracking_events", 1200, (i) => {
    const job = jobs[i % jobs.length];
    return {
      vehicle_id: job.vehicle_id,
      job_id: job.id,
      status: pick(["Awaiting Workshop", "In Workshop", "Road Test", "Valet", "Ready For Collection", "Customer Collected"], i),
      location: pick(["Service car park", "Workshop bay 1", "MOT bay", "Wash bay", "Collection row"], i),
      notes: `Tracking event for ${job.vehicle_reg}`,
      occurred_at: iso(addDays(today, -i)),
      created_by: staff[i % staff.length].user_id,
    };
  });
  await topUp("tracking_loan_car_bookings", 220, (i) => {
    return null;
  }).catch(() => {});
  const loanCars = await all("tracking_loan_cars", "loan_car_id,reg,make_model", "sort_order");
  const bookingCurrent = await countRows("tracking_loan_car_bookings");
  if (bookingCurrent < 220 && loanCars.length) {
    await insert("tracking_loan_car_bookings", Array.from({ length: 220 - bookingCurrent }, (_, i) => {
      const job = jobs[i % jobs.length];
      const customer = customers.find((row) => row.id === job.customer_id) || customers[i % customers.length];
      return {
        loan_car_id: loanCars[i % loanCars.length].loan_car_id,
        start_date: date(addDays(today, -30 + i)),
        end_date: date(addDays(today, -29 + i + (i % 3))),
        job_id: job.id,
        job_number: job.job_number,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.mobile,
        customer_address: customer.address,
        customer_postcode: customer.postcode,
        vehicle_reg: job.vehicle_reg,
        vehicle_make_model: job.vehicle_make_model,
        mileage: 12000 + i * 40,
        insurance_provider: pick(["Aviva", "LV", "Direct Line"], i),
        insurance_policy_number: `INS-${pad(i + 1, 5)}`,
        licence_number: `LIC${pad(i + 1, 7)}`,
        date_of_birth: date(addDays(today, -9000 - i * 20)),
        notes: "Loan car booking fixture.",
        created_at: iso(addDays(today, -45 + i)),
        updated_at: iso(addDays(today, -44 + i)),
      };
    }), 300);
  }
  await topUp("tracking_equipment_tools", 80, (i) => ({
    name: pick(["Two-post lift", "Brake tester", "Torque wrench", "Diagnostic tablet", "Air con machine", "MOT emissions tester"], i),
    last_checked: iso(addDays(today, -30 + i)),
    next_due: iso(addDays(today, 30 + i)),
    created_by: admin.user_id,
    interval_days: pick([7, 30, 90], i),
    interval_months: null,
    interval_label: pick(["Weekly", "Monthly", "Quarterly"], i),
    created_at: iso(addDays(today, -200 + i)),
    updated_at: iso(today),
  }));

  const workshopConsumables = await all("workshop_consumables", "id,item_name,unit_cost,supplier", "item_name");
  await upsert("workshop_consumable_budgets", Array.from({ length: 24 }, (_, i) => ({
    year: 2025 + Math.floor(i / 12),
    month: 1 + (i % 12),
    monthly_budget: 600 + (i % 6) * 150,
    updated_by: admin.user_id,
    updated_at: iso(addDays(today, -i)),
  })), "year,month");
  await topUp("workshop_consumable_orders", 300, (i) => {
    const c = workshopConsumables[i % workshopConsumables.length];
    const qty = 1 + (i % 20);
    const unit = c.unit_cost || 8;
    return {
      consumable_id: c.id,
      order_date: date(addDays(today, -i)),
      quantity: qty,
      unit_cost: unit,
      supplier: c.supplier || pick(["Workshop Supplies", "Kent Factors", "MOT Consumables"], i),
      created_at: iso(addDays(today, -i)),
    };
  });
  await topUp("workshop_consumable_requests", 180, (i) => {
    const user = techs[i % techs.length] || staff[i % staff.length];
    return {
      item_name: workshopConsumables[i % workshopConsumables.length].item_name,
      quantity: 1 + (i % 10),
      requested_by: user.user_id,
      requested_by_name: `${user.first_name} ${user.last_name}`,
      requested_at: iso(addDays(today, -i)),
      status: pick(["pending", "approved", "ordered", "received", "rejected"], i),
      updated_at: iso(addDays(today, -i + 1)),
    };
  });
  await topUp("workshop_consumable_usage", 1200, (i) => {
    const c = workshopConsumables[i % workshopConsumables.length];
    const job = jobs[i % jobs.length];
    const qty = 1 + (i % 5);
    const unit = c.unit_cost || 4;
    return {
      job_id: job.id,
      consumable_id: c.id,
      quantity: qty,
      unit_cost: unit,
      used_by: job.assigned_to || techs[i % techs.length]?.user_id || admin.user_id,
      used_at: iso(addDays(today, -i)),
      notes: "Consumable used on workshop job.",
      created_at: iso(addDays(today, -i)),
    };
  });
  await topUp("tracking_oil_stock", 24, (i) => ({
    title: pick(["5W30 bulk oil", "0W20 hybrid oil", "AdBlue", "Screenwash", "Brake cleaner"], i),
    stock: pick(["Full", "Three quarters", "Half", "Low", "Ordered"], i),
    last_check: iso(addDays(today, -i * 3)),
    next_check: iso(addDays(today, 7 + i)),
    last_topped_up: i % 3 === 0 ? iso(addDays(today, -i)) : null,
    consumable_id: workshopConsumables[i % workshopConsumables.length]?.id || null,
    created_by: admin.user_id,
    interval_days: 7,
    interval_label: "Weekly",
    created_at: iso(addDays(today, -100 + i)),
    updated_at: iso(today),
  }));

  await topUp("vhc_declinations", 160, (i) => ({
    job_id: jobs[i % jobs.length].id,
    declined_by: customers[i % customers.length].name || "Customer",
    declined_at: iso(addDays(today, -i)),
    customer_notes: pick(["Customer declined until next visit.", "Customer wants second opinion.", "Budget declined today.", "Will rebook next month."], i),
    created_at: iso(addDays(today, -i)),
  }));
  await topUp("vhc_send_history", 400, (i) => {
    const job = jobs[i % jobs.length];
    const customer = customers.find((row) => row.id === job.customer_id) || customers[i % customers.length];
    return {
      job_id: job.id,
      sent_by: `${staff[i % staff.length].first_name} ${staff[i % staff.length].last_name}`,
      sent_at: iso(addDays(today, -i)),
      send_method: pick(["email", "sms", "portal"], i),
      customer_email: customer.email,
      created_at: iso(addDays(today, -i)),
    };
  });
  await topUp("vhc_customer_media", 260, (i) => {
    const job = jobs[i % jobs.length];
    return {
      job_number: job.job_number,
      media_type: i % 4 === 0 ? "video" : "image",
      storage_bucket: "vhc-media",
      storage_path: `vhc/${job.job_number}/media-${i}.${i % 4 === 0 ? "mp4" : "jpg"}`,
      public_url: `https://example-customer.hnp/vhc/${job.job_number}/media-${i}`,
      mime_type: i % 4 === 0 ? "video/mp4" : "image/jpeg",
      file_size_bytes: 180000 + i * 1000,
      overlays: [{ label: "Concern", x: 20, y: 30 }],
      context_label: pick(["Tyres", "Brakes", "Underbody", "Lights"], i),
      uploaded_by: `${staff[i % staff.length].first_name} ${staff[i % staff.length].last_name}`,
      created_at: iso(addDays(today, -i)),
      updated_at: iso(addDays(today, -i)),
    };
  });

  await seedWebsiteAndShop(staff, customers);

  await topUp("floating_note_shares", 80, async () => null).catch(() => {});
  const notes = await all("floating_notes", "note_id,id,user_id,created_at", "created_at").catch(() => []);
  const shareCurrent = await countRows("floating_note_shares").catch(() => 0);
  if (notes.length && shareCurrent < 80) {
    await insert("floating_note_shares", Array.from({ length: 80 - shareCurrent }, (_, i) => ({
      note_id: notes[i % notes.length].note_id || notes[i % notes.length].id,
      user_id: staff[i % staff.length].user_id,
      id: uuid(`floating-share-${i}`),
      created_at: iso(addDays(today, -i)),
    })).filter((row) => row.note_id), 200).catch((error) => console.warn(error.message));
  }

  const reportTables = [
    "account_transactions", "clocking", "job_clocking", "job_files", "job_notes", "job_writeups",
    "parts_goods_in", "parts_goods_in_items", "parts_job_items", "parts_stock_movements",
    "workshop_consumable_usage", "vehicle_tracking_events", "key_tracking_events",
    "hr_training_assignments", "hr_performance_reviews", "personal_transactions",
    "website_brand", "website_vehicles", "shop_products", "shop_orders",
  ];
  const report = {};
  for (const table of reportTables) report[table] = await countRows(table);
  console.log("Day-to-day DMS fill complete");
  console.log(JSON.stringify(report, null, 2));
};

const seedWebsiteAndShop = async (staff, customers) => {
  const actor = staff[0]?.email || "system";
  await upsert("website_brand", [{ id: "default", name: "Humphries & Parks", logo_url: "/logo.png", logo_white_url: "/logo-white.png", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_hero", [{ id: "default", eyebrow: "Kent family dealership", headline: "Humphries & Parks", subhead: "New and used vehicles, service, MOT, parts and customer care from one local team.", background_url: "/website/hero.jpg", ctas: [{ label: "Book service", href: "/website/profile" }, { label: "Shop parts", href: "/website/shop" }], updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_about", [{ id: "default", eyebrow: "About us", title: "A dealership built around repeat customers", body: ["Family-run dealership operations across sales, service, MOT and parts.", "The team keeps customers updated from booking to collection."], image_url: "/website/about.jpg", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_sell_your_car", [{ id: "default", eyebrow: "Sell your car", title: "Straightforward valuations and quick payment", steps: ["Submit vehicle details", "Inspection and valuation", "Same-day decision"], benefits: ["Local team", "No pressure", "Clear paperwork"], cta_label: "Start valuation", cta_href: "/website#sell", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_service_parts", [{ id: "default", eyebrow: "Service & parts", title: "Workshop, MOT and genuine parts support", body: ["Factory-trained technicians.", "Live parts tracking and VHC updates."], hours: ["Mon-Fri 08:00-18:00", "Sat 08:30-13:00"], image_url: "/website/service.jpg", cta_label: "Book online", cta_href: "/website/profile", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_motability", [{ id: "default", eyebrow: "Motability", title: "Support choosing and maintaining your next vehicle", body: ["Advice, test drives and aftersales in one place."], payments: "Advance payment offers available across selected models.", range_brands: ["KGM", "Mitsubishi", "Approved Used"], cta_label: "Ask the team", cta_href: "/website#contact", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_parts_content", [{ id: "default", eyebrow: "Parts", title: "Genuine parts and accessories", body: ["Order service parts, accessories and essentials."], brands: ["KGM", "Mitsubishi", "Aftermarket"], cta_label: "Shop parts", cta_href: "/website/shop", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_contact", [{ id: "default", eyebrow: "Contact", title: "Visit Humphries & Parks", phone: "01622 872121", phone_href: "tel:01622872121", address: ["Humphries & Parks", "Maidstone Road", "West Malling"], sales_hours: ["Mon-Fri 08:30-18:00", "Sat 09:00-17:00"], service_hours: ["Mon-Fri 08:00-18:00", "Sat 08:30-13:00"], socials: [{ label: "Facebook", href: "#" }], map_embed: "https://maps.example.com/hnp", updated_at: iso(today), updated_by: actor }], "id");
  await upsert("website_footer", [{ id: "default", legal_links: [{ label: "Privacy", href: "/profile/privacy" }, { label: "Terms", href: "/terms" }], fca_reg: "FCA reference available on request.", credit_disclosure: "Finance subject to status.", updated_at: iso(today), updated_by: actor }], "id");

  await upsert("website_trust_points", ["40+|Years trading", "4.8|Customer rating", "120+|Used cars", "24hr|Online updates"].map((raw, i) => {
    const [value, label] = raw.split("|");
    return { id: `trust-${i}`, value, label, sort_order: i, status: "published", updated_at: iso(today), updated_by: actor };
  }), "id");
  await upsert("website_partner_brands", ["KGM", "Mitsubishi", "Motability", "Approved Used"].map((name, i) => ({ id: `brand-${i}`, name, logo_url: `/website/brands/${name.toLowerCase().replaceAll(" ", "-")}.png`, sort_order: i, status: "published", updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_ratings", ["Google|4.8/5", "AutoTrader|Excellent", "Facebook|Recommended"].map((raw, i) => { const [source, score] = raw.split("|"); return { id: `rating-${i}`, source, score, sort_order: i, status: "published", updated_at: iso(today), updated_by: actor }; }), "id");
  await upsert("website_vehicles", Array.from({ length: 24 }, (_, i) => ({ id: `vehicle-${i}`, vehicle_type: i % 3 === 0 ? "new" : "used", brand: pick(["KGM", "Mitsubishi", "Hyundai", "Kia"], i), model: pick(["Korando", "Tivoli", "Outlander", "Sportage"], i), year: 2020 + (i % 7), price_text: `£${(8995 + i * 750).toLocaleString("en-GB")}`, miles: `${(1200 + i * 3400).toLocaleString("en-GB")} miles`, badge: pick(["Available", "Just arrived", "Low mileage"], i), image_url: `/website/vehicles/${i}.jpg`, status: "published", sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_offers", Array.from({ length: 10 }, (_, i) => ({ id: `offer-${i}`, title: pick(["Service plan", "MOT offer", "Accessory bundle", "Used car finance"], i), headline: "Current dealership offer", body: "Live offer managed through staff website manager.", image_url: `/website/offers/${i}.jpg`, status: "published", sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_reviews", Array.from({ length: 24 }, (_, i) => ({ id: `review-${i}`, customer_name: customers[i % customers.length].name || "Customer", rating: 4 + (i % 2), source: pick(["Google", "AutoTrader", "Facebook"], i), review_date: date(addDays(today, -i * 9)), quote: "Great communication from booking through to collection.", status: "published", sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_team_departments", ["sales", "service", "parts", "workshop", "admin"].map((id, i) => ({ id, label: id[0].toUpperCase() + id.slice(1), sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_team_members", staff.slice(0, 36).map((user, i) => ({ id: `staff-${user.user_id}`, name: `${user.first_name} ${user.last_name}`, role: user.job_title || user.role, department_id: String(user.department || user.role || "admin").toLowerCase().includes("part") ? "parts" : String(user.department || "").toLowerCase().includes("workshop") ? "workshop" : String(user.role || "").toLowerCase().includes("sales") ? "sales" : String(user.role || "").toLowerCase().includes("service") ? "service" : "admin", photo_url: `https://example-customer.hnp/staff/${user.user_id}.jpg`, status: "published", sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_timeline", Array.from({ length: 8 }, (_, i) => ({ id: `timeline-${i}`, year: String(1985 + i * 6), title: pick(["Business founded", "Workshop expanded", "Parts department opened", "Digital service updates launched"], i), body: "Milestone in Humphries & Parks history.", sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_blog_posts", Array.from({ length: 16 }, (_, i) => ({ id: `blog-${i}`, title: pick(["Preparing for MOT season", "Why VHC videos help customers", "Choosing used SUV", "Winter checks"], i), post_date: date(addDays(today, -i * 14)), excerpt: "Advice from the dealership team.", body: "Long-form content managed through the staff website CMS.", image_url: `/website/blog/${i}.jpg`, status: "published", sort_order: i, updated_at: iso(today), updated_by: actor })), "id");
  await upsert("website_pages", ["home", "shop", "profile", "contact", "service"].map((page, i) => ({ page_key: page, name: page[0].toUpperCase() + page.slice(1), route: page === "home" ? "/website" : `/website/${page}`, status: "published", last_edited_by: actor, last_edited_at: iso(today) })), "page_key");
  await upsert("website_seo", ["home", "shop", "profile", "contact", "service"].map((page) => ({ page_key: page, meta_title: `Humphries & Parks ${page}`, meta_description: "Dealer website content populated for live CMS.", slug: page, canonical: `https://example-customer.hnp/${page}`, og_image: "/website/og.jpg", indexed: true, updated_at: iso(today), updated_by: actor })), "page_key");
  await topUp("website_activity", 120, (i) => ({ occurred_at: iso(addDays(today, -i)), actor, action: pick(["updated", "published", "uploaded", "reviewed"], i), target: pick(["hero", "vehicle", "offer", "blog", "shop product"], i), page_key: pick(["home", "shop", "service", "contact"], i) }));
  await upsert("website_media", Array.from({ length: 60 }, (_, i) => ({ id: `media-${i}`, name: pick(["Vehicle image", "Workshop photo", "Team headshot", "Offer banner"], i), url: `/website/media/${i}.jpg`, media_type: i % 10 === 0 ? "video" : "image", size_kb: 120 + i * 8, storage_path: `website/media/${i}.jpg`, used_on: pick(["home", "shop", "team", "offers"], i), uploaded_by: actor, uploaded_at: iso(addDays(today, -i)) })), "id");

  const categories = await upsert("shop_categories", ["service-parts|Service Parts", "accessories|Accessories", "car-care|Car Care", "merchandise|Merchandise"].map((raw, i) => { const [slug, name] = raw.split("|"); return { id: `cat-${slug}`, slug, name, description: `${name} for HNP customers.`, sort_order: i, status: "active", updated_at: iso(today), updated_by: actor }; }), "id");
  const products = await upsert("shop_products", Array.from({ length: 40 }, (_, i) => {
    const cat = categories[i % categories.length];
    return { id: `prod-${pad(i + 1, 3)}`, category_id: cat.id, sku: `SHOP-${pad(i + 1, 5)}`, name: pick(["Oil filter", "Air filter", "Wiper blade set", "Screenwash", "Floor mats", "Touch-up paint"], i), slug: `product-${pad(i + 1, 3)}`, description: "Customer shop product.", price_pence: 899 + i * 125, compare_at_price_pence: 1099 + i * 150, image_url: `/shop/products/${i}.jpg`, gallery: [`/shop/products/${i}.jpg`], stock_qty: 5 + (i % 40), fit_brands: ["KGM", "Mitsubishi"], status: "published", sort_order: i, created_at: iso(addDays(today, -100 + i)), updated_at: iso(today), updated_by: actor };
  }), "id");
  const carts = await topUp("shop_carts", 120, (i) => ({ customer_id: customers[i % customers.length].id, guest_token: `guest-${marker}-${i}`, status: pick(["open", "converted", "abandoned"], i), created_at: iso(addDays(today, -i)), updated_at: iso(addDays(today, -i + 1)) }));
  const allCarts = await all("shop_carts", "id,status", "created_at");
  await topUp("shop_cart_items", 240, (i) => {
    const product = products[i % products.length];
    return { cart_id: allCarts[i % allCarts.length].id, product_id: product.id, qty: 1 + (i % 3), unit_price_pence: product.price_pence, added_at: iso(addDays(today, -i)) };
  }).catch((error) => console.warn(error.message));
  const orders = await topUp("shop_orders", 100, (i) => {
    const customer = customers[i % customers.length];
    const subtotal = 2500 + i * 120;
    return { order_number: `WEB-${pad(i + 1, 6)}`, customer_id: customer.id, contact_email: customer.email || `customer${i}@example.com`, contact_phone: customer.mobile, shipping_address: { address: customer.address, postcode: customer.postcode }, status: pick(["pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled", "refunded"], i), subtotal_pence: subtotal, shipping_pence: 499, tax_pence: Math.round(subtotal * 0.2), total_pence: subtotal + 499 + Math.round(subtotal * 0.2), currency: "GBP", stripe_session_id: `sess_${hash(`order-${i}`).slice(0, 24)}`, stripe_payment_intent: `pi_${hash(`payment-${i}`).slice(0, 24)}`, notes: "Website shop order.", created_at: iso(addDays(today, -i)), updated_at: iso(addDays(today, -i + 1)), updated_by: actor };
  });
  const allOrders = await all("shop_orders", "id,order_number", "created_at");
  await topUp("shop_order_items", 240, (i) => {
    const product = products[i % products.length];
    const qty = 1 + (i % 3);
    return { order_id: allOrders[i % allOrders.length].id, product_id: product.id, sku: product.sku, name: product.name, qty, unit_price_pence: product.price_pence, line_total_pence: qty * product.price_pence };
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
