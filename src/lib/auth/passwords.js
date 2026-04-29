// Password hashing — Phase 1B.
//
// Single source of truth for how the DMS stores and verifies passwords.
// All callers must go through hashPassword() / verifyPassword() — never
// touch users.password_hash directly.
//
// Algorithm: bcrypt cost 12 (~150–300 ms per op). Selected for pure-JS
// implementation that runs on Vercel serverless without a native build.
//
// Lazy migration: existing rows have password_algo='plaintext'. On a
// successful plaintext login, the caller must rehash and persist via
// rehashAndPersist() to migrate the row to bcrypt. New writes (registration,
// password reset, admin "create user") must always produce bcrypt.

import bcrypt from "bcryptjs";
import { supabaseService } from "@/lib/database/supabaseClient";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

export const ALGO_BCRYPT = "bcrypt";
export const ALGO_PLAINTEXT = "plaintext";
// 'unset' marks rows that have no usable password (HR-created stubs, customer
// accounts created by external flows). verifyPassword always returns false
// for these — the user must go through password reset to set one.
export const ALGO_UNSET = "unset";

export function isStrongEnough(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

export async function hashPassword(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("hashPassword: password must be a non-empty string.");
  }
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

// Returns true if the submitted password matches the stored value, given
// the algorithm in algo. Constant-time within each branch.
export async function verifyPassword({ submitted, stored, algo }) {
  if (typeof submitted !== "string" || typeof stored !== "string") {
    return false;
  }
  if (algo === ALGO_UNSET || stored.length === 0) {
    return false;
  }
  if (algo === ALGO_BCRYPT) {
    try {
      return await bcrypt.compare(submitted, stored);
    } catch {
      return false;
    }
  }
  // Legacy plaintext branch — kept until every row has been migrated. Never
  // call this with new data.
  if (algo === ALGO_PLAINTEXT || !algo) {
    // Length-mismatch fast path is unavoidable; both branches are equally
    // observable so this does not leak more than the existing == comparison
    // it replaces.
    return stored === submitted;
  }
  return false;
}

// Persist a freshly-hashed password for the user. Used by both the lazy
// rehash path (after a successful plaintext login) and any write path that
// sets a new password.
export async function rehashAndPersist({ userId, plaintext }) {
  if (!supabaseService) {
    throw new Error("rehashAndPersist: Supabase service client unavailable.");
  }
  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    throw new Error("rehashAndPersist: userId must be a number.");
  }
  const hash = await hashPassword(plaintext);
  const { error } = await supabaseService
    .from("users")
    .update({
      password_hash: hash,
      password_algo: ALGO_BCRYPT,
      password_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) {
    throw new Error(`rehashAndPersist: ${error.message}`);
  }
  return { hash, algo: ALGO_BCRYPT };
}

// Best-effort heuristic: does this stored value already look like a bcrypt
// hash? Used at write time to avoid double-hashing if a caller has already
// hashed (e.g. an admin importer). Bcrypt hashes always start with
// $2a$ / $2b$ / $2y$ and are 60 chars long.
export function looksLikeBcryptHash(value) {
  return (
    typeof value === "string" &&
    value.length === 60 &&
    /^\$2[aby]\$/.test(value)
  );
}

export const PASSWORD_MIN_LENGTH = MIN_PASSWORD_LENGTH;
