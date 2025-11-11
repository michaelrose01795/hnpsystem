#!/usr/bin/env node
// file location: scripts/seed-test-data.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const isTableEmpty = async (table) => {
  const { count, error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (error) {
    throw new Error(`Failed to inspect ${table}: ${error.message}`);
  }
  return (count || 0) === 0;
};

const seedUsers = async () => {
  if (!(await isTableEmpty("users"))) {
    console.info("ℹ️ Users table already has data. Skipping seed.");
    return null;
  }

  const staff = [
    {
      first_name: "Nicola",
      last_name: "Hart",
      email: "nicola.service@example.com",
      role: "Service Manager",
      phone: "+44 113 123 4001",
      password_hash: "dev_seed",
    },
    {
      first_name: "Darrell",
      last_name: "Parker",
      email: "darrell.workshop@example.com",
      role: "Workshop Manager",
      phone: "+44 113 123 4002",
      password_hash: "dev_seed",
    },
    {
      first_name: "Scott",
      last_name: "Adams",
      email: "scott.parts@example.com",
      role: "Parts Manager",
      phone: "+44 113 123 4003",
      password_hash: "dev_seed",
    },
    {
      first_name: "Glen",
      last_name: "Mason",
      email: "glen.tech@example.com",
      role: "Techs",
      phone: "+44 113 123 4004",
      password_hash: "dev_seed",
    },
    {
      first_name: "Jake",
      last_name: "Turner",
      email: "jake.mot@example.com",
      role: "MOT Tester",
      phone: "+44 113 123 4005",
      password_hash: "dev_seed",
    },
    {
      first_name: "Sarah",
      last_name: "Thompson",
      email: "portal.customer@example.com",
      role: "Customer",
      phone: "+44 7700 900123",
      password_hash: "dev_seed",
    },
  ];

  const { data, error } = await supabase.from("users").insert(staff).select("user_id, email");
  if (error) throw new Error(`Failed to seed users: ${error.message}`);
  console.info("✅ Seeded users table.");
  return Object.fromEntries(data.map((row) => [row.email, row.user_id]));
};

const seedCustomers = async () => {
  if (!(await isTableEmpty("customers"))) {
    console.info("ℹ️ Customers table already has data. Skipping seed.");
    return null;
  }

  const customers = [
    {
      firstname: "Sarah",
      lastname: "Thompson",
      email: "portal.customer@example.com",
      mobile: "+44 7700 900123",
      telephone: "+44 113 555 0100",
      address: "12 Meadow Park",
      postcode: "LS1 3AB",
      contact_preference: "email",
    },
  ];

  const { data, error } = await supabase.from("customers").insert(customers).select("id, email");
  if (error) throw new Error(`Failed to seed customers: ${error.message}`);
  console.info("✅ Seeded customers table.");
  return Object.fromEntries(data.map((row) => [row.email, row.id]));
};

const seedVehicles = async (customerIds) => {
  if (!customerIds) return null;
  if (!(await isTableEmpty("vehicles"))) {
    console.info("ℹ️ Vehicles table already has data. Skipping seed.");
    return null;
  }

  const customerId = customerIds["portal.customer@example.com"];
  if (!customerId) {
    console.warn("⚠️ Unable to locate seeded customer for vehicles. Skipping vehicle seed.");
    return null;
  }

  const vehicles = [
    {
      registration: "HN70 HPA",
      reg_number: "HN70 HPA",
      make: "Audi",
      model: "A3 Sportback",
      make_model: "Audi A3 Sportback",
      vin: "WAUZZZ8V5LA012345",
      mileage: 28540,
      mot_due: "2024-07-18",
      customer_id: customerId,
    },
    {
      registration: "HP23 VHC",
      reg_number: "HP23 VHC",
      make: "VW",
      model: "Tiguan R-Line",
      make_model: "VW Tiguan R-Line",
      vin: "WVGZZZ5NZPW456789",
      mileage: 12110,
      mot_due: "2024-11-02",
      customer_id: customerId,
    },
  ];

  const { data, error } = await supabase.from("vehicles").insert(vehicles).select("vehicle_id, registration");
  if (error) throw new Error(`Failed to seed vehicles: ${error.message}`);
  console.info("✅ Seeded vehicles table.");
  return Object.fromEntries(data.map((row) => [row.registration, row.vehicle_id]));
};

const seedJobs = async (customerIds, vehicleIds, userIds) => {
  if (!customerIds || !vehicleIds || !userIds) return null;
  if (!(await isTableEmpty("jobs"))) {
    console.info("ℹ️ Jobs table already has data. Skipping seed.");
    return null;
  }

  const customerId = customerIds["portal.customer@example.com"];
  const vehicleId = vehicleIds["HN70 HPA"];
  const technicianId = userIds["glen.tech@example.com"];

  const now = new Date();
  const jobs = [
    {
      job_number: "JC1442",
      customer_id: customerId,
      vehicle_id: vehicleId,
      vehicle_reg: "HN70 HPA",
      vehicle_make_model: "Audi A3 Sportback",
      status: "Workshop/MOT",
      job_source: "Service",
      job_categories: ["Service", "VHC"],
      assigned_to: technicianId,
      job_concern: "Oil & filter, front brakes, software update",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      waiting_status: "With technician",
    },
  ];

  const { data, error } = await supabase.from("jobs").insert(jobs).select("id, job_number");
  if (error) throw new Error(`Failed to seed jobs: ${error.message}`);
  console.info("✅ Seeded jobs table.");
  return data;
};

const seedJobHistory = async (jobRow, userIds) => {
  if (!jobRow) return;
  if (!(await isTableEmpty("job_status_history"))) {
    console.info("ℹ️ job_status_history already has data. Skipping seed.");
    return;
  }

  const statusTimeline = [
    { to_status: "Booked", changed_by: "system", reason: "Online booking confirmed", offsetHours: 72 },
    { to_status: "Checked In", changed_by: userIds["nicola.service@example.com"], reason: "Customer arrived", offsetHours: 48 },
    { to_status: "Workshop/MOT", changed_by: userIds["glen.tech@example.com"], reason: "Technician clocked onto job", offsetHours: 24 },
    { to_status: "VHC Sent", changed_by: userIds["darrell.workshop@example.com"], reason: "VHC shared with service advisors", offsetHours: 6 },
  ];

  const { error } = await supabase.from("job_status_history").insert(
    statusTimeline.map((entry, index) => ({
      job_id: jobRow.id,
      from_status: index === 0 ? null : statusTimeline[index - 1].to_status,
      to_status: entry.to_status,
      changed_by: entry.changed_by,
      reason: entry.reason,
      changed_at: dayjs().subtract(entry.offsetHours, "hour").toISOString(),
    }))
  );

  if (error) throw new Error(`Failed to seed job status history: ${error.message}`);
  console.info("✅ Seeded job_status_history table.");
};

const seedVhcWorkflow = async (jobRow) => {
  if (!jobRow) return;
  if (!(await isTableEmpty("vhc_workflow_status"))) {
    console.info("ℹ️ vhc_workflow_status already has data. Skipping seed.");
    return;
  }

  const { error } = await supabase.from("vhc_workflow_status").insert([
    {
      job_id: jobRow.id,
      job_number: jobRow.job_number,
      vehicle_reg: jobRow.vehicle_reg,
      status: "vhc_sent_to_customer",
      vhc_checks_count: 5,
      authorization_count: 2,
      vhc_sent_at: dayjs().subtract(2, "hour").toISOString(),
      last_sent_at: dayjs().subtract(2, "hour").toISOString(),
    },
  ]);
  if (error) throw new Error(`Failed to seed vhc_workflow_status: ${error.message}`);
  console.info("✅ Seeded vhc_workflow_status table.");
};

const seedPartsCatalog = async () => {
  if (!(await isTableEmpty("parts_catalog"))) {
    console.info("ℹ️ parts_catalog already has data. Skipping seed.");
    return;
  }

  const parts = [
    {
      part_number: "BRK-FR-001",
      name: "Front brake kit",
      category: "Brakes",
      supplier: "TPS Leeds",
      unit_cost: 180,
      unit_price: 285,
      qty_in_stock: 2,
      storage_location: "Aisle 1 / Bin 3",
    },
    {
      part_number: "CAB-FLTR-019",
      name: "OEM cabin filter",
      category: "HVAC",
      supplier: "TPS Leeds",
      unit_cost: 12.5,
      unit_price: 29.5,
      qty_in_stock: 12,
      storage_location: "Aisle 4 / Bin 9",
    },
    {
      part_number: "WHL-19-SET",
      name: '19" diamond cut wheel (set of 4)',
      category: "Wheels",
      supplier: "VW UK",
      unit_cost: 980,
      unit_price: 1280,
      qty_in_stock: 1,
      storage_location: "Bulk storage",
    },
  ];

  const { error } = await supabase.from("parts_catalog").insert(parts);
  if (error) throw new Error(`Failed to seed parts_catalog: ${error.message}`);
  console.info("✅ Seeded parts_catalog table.");
};

const seedHrData = async (userIds) => {
  if (!(await isTableEmpty("hr_training_courses"))) {
    console.info("ℹ️ HR tables already have data. Skipping HR seed.");
    return;
  }

  const { data: courses, error: courseError } = await supabase
    .from("hr_training_courses")
    .insert([
      {
        title: "Hybrid Vehicle Safety",
        description: "Mandatory EV safety procedures",
        category: "Workshop",
        renewal_interval_months: 24,
      },
    ])
    .select("course_id");
  if (courseError) throw courseError;

  const courseId = courses?.[0]?.course_id;

  const trainingAssignment = {
    user_id: userIds["glen.tech@example.com"],
    course_id: courseId,
    due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
    status: "assigned",
  };

  const payrollReview = {
    user_id: userIds["glen.tech@example.com"],
    reviewer_id: userIds["darrell.workshop@example.com"],
    scheduled_at: dayjs().add(14, "day").format("YYYY-MM-DD"),
    status: "scheduled",
    score: { overall: 4.2 },
    notes: "Quarterly review seeded via script",
  };

  const absence = {
    user_id: userIds["glen.tech@example.com"],
    type: "Annual Leave",
    start_date: dayjs().add(20, "day").format("YYYY-MM-DD"),
    end_date: dayjs().add(22, "day").format("YYYY-MM-DD"),
    approval_status: "Approved",
  };

  const [{ error: trainingError }, { error: reviewError }, { error: absenceError }] = await Promise.all([
    supabase.from("hr_training_assignments").insert(trainingAssignment),
    supabase.from("hr_performance_reviews").insert(payrollReview),
    supabase.from("hr_absences").insert(absence),
  ]);

  if (trainingError) throw trainingError;
  if (reviewError) throw reviewError;
  if (absenceError) throw absenceError;
  console.info("✅ Seeded HR training, performance reviews, and absences.");
};

const run = async () => {
  try {
    const userIds = await seedUsers();
    if (!userIds) {
      console.info("Seed aborted because initial lookup tables already contain data.");
      return;
    }
    const customerIds = await seedCustomers();
    const vehicleIds = await seedVehicles(customerIds);
    const jobs = await seedJobs(customerIds, vehicleIds, userIds);
    if (jobs?.length) {
      await seedJobHistory(jobs[0], userIds);
      await seedVhcWorkflow(jobs[0]);
    }
    await seedPartsCatalog();
    await seedHrData(userIds);
    console.info("🎉 Seed complete.");
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    process.exitCode = 1;
  }
};

run();
