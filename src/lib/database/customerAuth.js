// file location: src/lib/database/customerAuth.js
// DB layer for the customer-facing auth used by /website/login + /website/profile.
// Keeps customer credentials isolated from the staff `users` table.

import { supabaseService, supabase } from "@/lib/database/supabaseClient";
import { buildSlugKeyFromNames } from "@/lib/customers/slug";

const TABLE = "customer_auth";
const SELECT_FIELDS =
  "id, email, password_hash, password_algo, customer_id, created_at, updated_at, last_login_at";

const db = () => supabaseService || supabase;

const normaliseEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export async function getCustomerAuthByEmail(email) {
  const e = normaliseEmail(email);
  if (!e) return null;
  const { data, error } = await db()
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("email", e)
    .maybeSingle();
  if (error) {
    console.error("getCustomerAuthByEmail:", error.message);
    return null;
  }
  return data || null;
}

export async function getCustomerAuthById(id) {
  if (!id) return null;
  const { data, error } = await db()
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getCustomerAuthById:", error.message);
    return null;
  }
  return data || null;
}

export async function findCustomerByEmail(email) {
  const e = normaliseEmail(email);
  if (!e) return null;
  const { data, error } = await db()
    .from("customers")
    .select(
      "id, firstname, lastname, email, mobile, telephone, address, postcode, contact_preference",
    )
    .ilike("email", e)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("findCustomerByEmail:", error.message);
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function createCustomerRow({
  firstname,
  lastname,
  email,
  mobile,
  telephone,
  address,
  postcode,
}) {
  const { data, error } = await db()
    .from("customers")
    .insert({
      firstname: firstname || null,
      lastname: lastname || null,
      email: normaliseEmail(email) || null,
      mobile: mobile || null,
      telephone: telephone || null,
      address: address || null,
      postcode: postcode || null,
      contact_preference: "email",
    })
    .select("id, firstname, lastname, email, mobile, telephone, address, postcode")
    .single();
  if (error) {
    console.error("createCustomerRow:", error.message);
    return null;
  }
  return data;
}

export async function createCustomerAuth({
  email,
  passwordHash,
  customerId,
  algo = "bcrypt",
}) {
  const { data, error } = await db()
    .from(TABLE)
    .insert({
      email: normaliseEmail(email),
      password_hash: passwordHash,
      password_algo: algo,
      customer_id: customerId,
    })
    .select(SELECT_FIELDS)
    .single();
  if (error) {
    console.error("createCustomerAuth:", error.message);
    return { data: null, error };
  }
  return { data, error: null };
}

export async function updateCustomerLastLogin(authId) {
  if (!authId) return;
  const now = new Date().toISOString();
  const { error } = await db()
    .from(TABLE)
    .update({ last_login_at: now, updated_at: now })
    .eq("id", authId);
  if (error) console.error("updateCustomerLastLogin:", error.message);
}

export async function updateCustomerProfile(customerId, patch) {
  if (!customerId) return null;
  const allowed = [
    "firstname",
    "lastname",
    "email",
    "mobile",
    "telephone",
    "address",
    "postcode",
    "contact_preference",
  ];
  const next = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  if (Object.keys(next).length === 0) return null;

  // Keep slug_key in sync when the name changes. The column is only computed as
  // a column DEFAULT at insert time (no trigger), so a rename would otherwise
  // leave it stale and force the staff page to fall back to a name search.
  if (next.firstname !== undefined || next.lastname !== undefined) {
    let firstname = next.firstname;
    let lastname = next.lastname;
    if (firstname === undefined || lastname === undefined) {
      const { data: current } = await db()
        .from("customers")
        .select("firstname, lastname")
        .eq("id", customerId)
        .maybeSingle();
      if (firstname === undefined) firstname = current?.firstname || "";
      if (lastname === undefined) lastname = current?.lastname || "";
    }
    next.slug_key = buildSlugKeyFromNames(firstname, lastname);
  }

  next.updated_at = new Date().toISOString();
  const { data, error } = await db()
    .from("customers")
    .update(next)
    .eq("id", customerId)
    .select(
      "id, firstname, lastname, email, mobile, telephone, address, postcode, contact_preference",
    )
    .single();
  if (error) {
    console.error("updateCustomerProfile:", error.message);
    return null;
  }
  return data;
}
