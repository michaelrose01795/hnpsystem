// file location: tools/scripts/seed-all-access-user.js
//
// Seed (or reset) the All Access demo login's `users` row.
//
// The login creates this row on first use, so running this is OPTIONAL — it is
// here for when you want the record to exist before a demonstration, want to
// read back its user id, or want to reset details that were changed mid-demo.
//
//   npm run seed:all-access            create it if missing, then print it
//   npm run seed:all-access -- --force overwrite it back to the fixed details
//
// The row's password is stored as 'unset', so it can never be signed into
// through the email/password form — only through the gated "All access" button.

/* eslint-disable no-console */
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Kept in step with src/lib/database/allAccessUser.js — that module is ESM with
// an "@/" alias, so it cannot be required from a plain Node script.
const ALL_ACCESS_EMAIL = "alex.morgan@hnp-demo.co.uk";
const ALL_ACCESS_PERSONAL_PASSCODE = "1234";

const ALL_ACCESS_USER_PROFILE = {
  first_name: "Alex",
  last_name: "Morgan",
  name: "Alex Morgan",
  email: ALL_ACCESS_EMAIL,
  role: "All Access",
  job_title: "Demonstration Account",
  department: "Management",
  phone: "01234 567890",
  extension: "100",
  employment_type: "Full Time",
  employment_status: "Active",
  start_date: "2021-03-01",
  probation_end: "2021-06-01",
  contracted_hours: 40,
  contracted_hours_per_week: 40,
  hourly_rate: 18.5,
  overtime_rate: 27.75,
  annual_salary: 38480,
  payroll_reference: "HNP-DEMO-001",
  national_insurance_number: "QQ123456C",
  home_address: "12 Example Way, Demo Town, Demonshire, DT1 1AA",
  emergency_contact: {
    name: "Jordan Reed",
    relationship: "Partner",
    phone: "01234 567891",
  },
  documents: [],
  dark_mode: "system",
  accent_color: "red",
  is_active: true,
  password_hash: "",
  password_algo: "unset",
};

// Mirrors hashPasscode() in src/lib/profile/personalServer.js.
const PASSCODE_HASH_PREFIX = "scrypt";
function hashPasscode(passcode) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(passcode), salt, 64).toString("hex");
  return `${PASSCODE_HASH_PREFIX}$${salt}$${derived}`;
}

const SELECTED = "user_id, first_name, last_name, email, role, department, job_title";

async function findRow() {
  const { data, error } = await supabase
    .from("users")
    .select(SELECTED)
    .ilike("email", ALL_ACCESS_EMAIL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function seedPasscode(userId) {
  const { data: existing } = await supabase
    .from("user_personal_security")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return "already set";

  const { error } = await supabase.from("user_personal_security").insert([
    {
      user_id: userId,
      passcode_hash: hashPasscode(ALL_ACCESS_PERSONAL_PASSCODE),
      is_setup: true,
    },
  ]);
  return error ? `failed (${error.message})` : `set to ${ALL_ACCESS_PERSONAL_PASSCODE}`;
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await findRow();

  let row;
  if (!existing) {
    const { data, error } = await supabase
      .from("users")
      .insert([ALL_ACCESS_USER_PROFILE])
      .select(SELECTED)
      .single();
    if (error) throw new Error(error.message);
    row = data;
    console.log("Created the All Access demo user.");
  } else if (force) {
    const { data, error } = await supabase
      .from("users")
      .update(ALL_ACCESS_USER_PROFILE)
      .eq("user_id", existing.user_id)
      .select(SELECTED)
      .single();
    if (error) throw new Error(error.message);
    row = data;
    console.log("Reset the All Access demo user to its fixed details.");
  } else {
    row = existing;
    console.log("The All Access demo user already exists (pass --force to reset it).");
  }

  const passcode = await seedPasscode(row.user_id);

  console.log("");
  console.log(`  user_id     ${row.user_id}`);
  console.log(`  name        ${row.first_name} ${row.last_name}`);
  console.log(`  email       ${row.email}`);
  console.log(`  role        ${row.role}`);
  console.log(`  department  ${row.department}`);
  console.log(`  job title   ${row.job_title}`);
  console.log(`  password    unset - reachable only via the "All access" button`);
  console.log(`  personal PIN ${passcode}`);
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
