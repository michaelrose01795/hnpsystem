// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/users/devUsers.js

import { supabase } from "@/lib/supabaseClient";

// Create a slug from display name for deterministic fake emails
const slugify = (txt) =>
  String(txt || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const ROSTER_CACHE_TTL = 5 * 60 * 1000;
let rosterCache = null;
let rosterCacheFetchedAt = 0;

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const buildRosterMap = (rows = []) =>
  rows.reduce((acc, row) => {
    const role = row.role || "Technician";
    if (!acc[role]) acc[role] = [];
    const display =
      `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
      row.email ||
      "Unknown user";
    acc[role].push(display);
    return acc;
  }, {});

const fetchRoster = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email, role");

  if (error) throw error;
  return buildRosterMap(data || []);
};

const getRoster = async () => {
  const now = Date.now();
  if (rosterCache && now - rosterCacheFetchedAt < ROSTER_CACHE_TTL) {
    return rosterCache;
  }

  try {
    const roster = await fetchRoster();
    rosterCache = roster;
    rosterCacheFetchedAt = now;
    return roster;
  } catch (error) {
    console.warn("⚠️ Failed to refresh roster from Supabase:", error?.message || error);
    return rosterCache || {};
  }
};

// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
const inferRoleFromRoster = async (displayName) => {
  const norm = String(displayName || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!norm) return "Technician";

  const roster = await getRoster();

  for (const [role, names] of Object.entries(roster)) {
    for (const entry of names) {
      const rosterName = normalizeName(entry);

      if (rosterName === norm) return role;

      const cleanRoster = rosterName
        .replace(/\(.*?\)/g, "")
        .replace(/\s-\s.*$/, "")
        .trim();
      const cleanNorm = norm
        .replace(/\(.*?\)/g, "")
        .replace(/\s-\s.*$/, "")
        .trim();

      if (cleanRoster && cleanRoster === cleanNorm) return role;
      if (cleanRoster && (cleanRoster.includes(cleanNorm) || cleanNorm.includes(cleanRoster))) {
        return role;
      }
    }
  }

  return "Technician";
};

// Split a display name into first/last names for users table inserts
const splitName = (displayName) => {
  const safe = String(displayName || "").trim();
  if (!safe) return { first: "Dev", last: "User" };
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
};

// Try to find an existing users row that matches the display name
const findUserByName = async (displayName) => {
  const { first, last } = splitName(displayName);
  const patterns = [];

  if (first) patterns.push(`first_name.ilike.%${first}%`);
  if (last) patterns.push(`last_name.ilike.%${last}%`);

  const orFilter = patterns.join(",");

  const query = supabase
    .from("users")
    .select("user_id, first_name, last_name, email, role")
    .limit(1);

  const { data, error } = patterns.length
    ? await query.or(orFilter)
    : await query;

  if (error && error.code !== "PGRST116") throw error;
  return data?.[0] || null;
};

// Ensure a users row exists for the supplied display name and return user_id
export const ensureUserIdForDisplayName = async (displayName) => {
  const trimmedName = String(displayName || "").trim();
  const role = await inferRoleFromRoster(trimmedName);

  if (!trimmedName) return null;

  // Try exact match by name before creating a new record
  try {
    const existingByName = await findUserByName(trimmedName);
    if (existingByName?.user_id) {
      return existingByName.user_id;
    }
  } catch (nameLookupError) {
    console.warn("⚠️ ensureUserIdForDisplayName name lookup failed:", nameLookupError?.message);
  }

  const slug = slugify(trimmedName) || `tech-${Date.now()}`;
  const fakeEmail = `${slug}@dev.local`;

  const { data: existingByEmail, error: findErr } = await supabase
    .from("users")
    .select("user_id, role")
    .eq("email", fakeEmail)
    .maybeSingle();

  if (findErr && findErr.code !== "PGRST116") throw findErr;

  if (existingByEmail?.user_id) {
    return existingByEmail.user_id;
  }

  const { first, last } = splitName(trimmedName);

  const { data: inserted, error: insertErr } = await supabase
    .from("users")
    .insert([
      {
        first_name: first,
        last_name: last,
        email: fakeEmail,
        password_hash: "external_auth",
        role,
        phone: null,
      },
    ])
    .select("user_id")
    .single();

  if (insertErr) throw insertErr;
  return inserted.user_id;
};

// Convenience helper mirroring the previous ensureDevDbUserAndGetId signature
export const ensureDevDbUserAndGetId = async (devUser) => {
  const candidateId =
    devUser?.id ?? devUser?.user_id ?? devUser?.identifier ?? null;
  if (candidateId !== null && candidateId !== undefined) {
    const numeric = Number(candidateId);
    if (Number.isInteger(numeric) && !Number.isNaN(numeric)) {
      try {
        const { data: existing } = await supabase
          .from("users")
          .select("user_id")
          .eq("user_id", numeric)
          .maybeSingle();
        if (existing?.user_id) {
          return existing.user_id;
        }
      } catch (error) {
        console.warn("⚠️ Failed to validate dev user id:", error?.message || error);
      }
    }
  }

  const displayName =
    devUser?.name ||
    devUser?.fullName ||
    devUser?.displayName ||
    devUser?.username ||
    `Tech-${devUser?.id || "dev"}`;

  return ensureUserIdForDisplayName(displayName);
};
