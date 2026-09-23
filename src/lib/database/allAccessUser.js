// file location: src/lib/database/allAccessUser.js
// ✅ Connected to Supabase (server-side, service role)
//
// The All Access demo login's DATABASE IDENTITY.
//
// The login itself is synthetic (see src/lib/auth/allAccessSession.js) — its
// ROLE is minted in code and never stored. But a session with no `users` row is
// invisible to every per-user feature: the profile page, clock in/out, the
// unread-message badge, payslips and the personal dashboard all key off
// users.user_id, so they came back empty rather than demoing anything.
//
// So the demo account gets a real row, with entirely made-up details. It behaves
// like any other staff record — it just describes a person who does not exist.
//
// SAFETY:
//   * password_algo = 'unset' ⇒ verifyPassword() ALWAYS returns false, so the
//     email/password form can never sign in as this account no matter what is
//     submitted. The only way in is the gated "All access" button.
//   * The row is created on demand by ensureAllAccessUser(), which is called
//     from the credentials provider AFTER isDevAuthAllowed() has passed.
//   * An existing row is never overwritten, so anything changed during a
//     demonstration (photo, theme, sidebar layout) persists. Use
//     `npm run seed:all-access -- --force` to reset it.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { ALL_ACCESS_EMAIL } from "@/lib/database/allAccessVisibility";

const db = () => supabaseService || supabase;

const USERS_TABLE = "users";
const PERSONAL_SECURITY_TABLE = "user_personal_security";

// The demo account's fixed address. Everything else about the row may be edited
// during a demonstration; this is the key we look it up by. It lives in
// ./allAccessVisibility.js because every user-listing query needs it too.
export { ALL_ACCESS_EMAIL };

// The personal dashboard is passcode-gated. The demo row is seeded with a known
// passcode so the tab opens during a walkthrough instead of stopping at setup.
export const ALL_ACCESS_PERSONAL_PASSCODE = "1234";

// Made-up staff details. Plausible enough that every profile field renders with
// something in it, and obviously fake on inspection: the address is "Example
// Way", and QQ123456C is in the officially reserved not-a-real-NI-number range.
export const ALL_ACCESS_USER_PROFILE = Object.freeze({
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
  // No usable password — this account is reachable ONLY through the gated
  // "All access" button, never through the email/password form.
  password_hash: "",
  password_algo: "unset",
});

const SELECTED_COLUMNS = "user_id, first_name, last_name, name, email, role, department, job_title";

async function findAllAccessUser() {
  const { data, error } = await db()
    .from(USERS_TABLE)
    .select(SELECTED_COLUMNS)
    .ilike("email", ALL_ACCESS_EMAIL)
    .maybeSingle();
  if (error) throw new Error(`Failed to read the All Access demo user: ${error.message}`);
  return data || null;
}

async function insertAllAccessUser() {
  const { data, error } = await db()
    .from(USERS_TABLE)
    .insert([ALL_ACCESS_USER_PROFILE])
    .select(SELECTED_COLUMNS)
    .single();
  if (error) throw new Error(`Failed to create the All Access demo user: ${error.message}`);
  return data;
}

/**
 * Seed the personal-dashboard passcode so the Personal tab opens during a demo
 * rather than stopping at first-run setup. Never overwrites an existing row —
 * if the passcode was changed mid-demonstration, that change stands.
 */
export async function ensureAllAccessPersonalPasscode(userId) {
  if (!Number.isInteger(userId) || userId <= 0) return false;
  // Imported lazily: personalServer pulls in node:crypto and the personal data
  // layer, neither of which the login path should pay for on every request.
  const { hashPasscode } = await import("@/lib/profile/personalServer");

  const { data: existing, error: readError } = await db()
    .from(PERSONAL_SECURITY_TABLE)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError || existing) return false;

  const { error } = await db()
    .from(PERSONAL_SECURITY_TABLE)
    .insert([
      {
        user_id: userId,
        passcode_hash: hashPasscode(ALL_ACCESS_PERSONAL_PASSCODE),
        is_setup: true,
      },
    ]);
  return !error;
}

/**
 * Resolve the demo account's `users` row, creating it on first use.
 *
 * @param {{ createIfMissing?: boolean }} [options]
 * @returns {Promise<{user_id:number,...}|null>} the row, or null if the database
 *   could not be reached. Callers MUST tolerate null — the login falls back to
 *   the fully synthetic session so a demonstration still works offline.
 */
export async function ensureAllAccessUser({ createIfMissing = true } = {}) {
  const existing = await findAllAccessUser();
  if (existing) return existing;
  if (!createIfMissing) return null;

  const created = await insertAllAccessUser();
  await ensureAllAccessPersonalPasscode(Number(created?.user_id)).catch(() => false);
  return created;
}

/**
 * Reset the demo row back to ALL_ACCESS_USER_PROFILE, discarding anything a
 * previous demonstration changed. Used by `npm run seed:all-access -- --force`.
 */
export async function resetAllAccessUser() {
  const existing = await findAllAccessUser();
  if (!existing) return ensureAllAccessUser();

  const { data, error } = await db()
    .from(USERS_TABLE)
    .update(ALL_ACCESS_USER_PROFILE)
    .eq("user_id", existing.user_id)
    .select(SELECTED_COLUMNS)
    .single();
  if (error) throw new Error(`Failed to reset the All Access demo user: ${error.message}`);
  await ensureAllAccessPersonalPasscode(Number(data?.user_id)).catch(() => false);
  return data;
}
