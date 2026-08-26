import { supabase } from "@/lib/database/supabaseClient";

function asNonEmptyString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parsePositiveInt(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// Confirming that a numeric id from the session still exists is a round trip
// that ~20 API routes make on their hot path, and the answer ("does user N
// exist") is the same for every caller — it is not user-scoped data. Cache
// POSITIVE results only, briefly: a newly created user is picked up on its first
// request, while a repeat request within the window skips the query.
//
// This does not weaken anything: the NextAuth JWT already grants access for its
// own lifetime regardless of this lookup, so a short existence cache cannot
// extend access that the session did not already carry.
const NUMERIC_ID_CACHE_TTL_MS = 60_000;
const numericIdCache = new Map(); // userId -> expiresAt

async function findUserIdByNumericId(userId) {
  const cachedUntil = numericIdCache.get(userId);
  if (cachedUntil && cachedUntil > Date.now()) return userId;

  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const resolved = data?.user_id || null;
  if (resolved) {
    numericIdCache.set(resolved, Date.now() + NUMERIC_ID_CACHE_TTL_MS);
    // Bound the map so a long-lived instance cannot grow without limit.
    if (numericIdCache.size > 500) {
      const now = Date.now();
      for (const [key, expiry] of numericIdCache) {
        if (expiry <= now) numericIdCache.delete(key);
      }
    }
  }
  return resolved;
}

async function findUserIdByEmail(email) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .ilike("email", normalizedEmail)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id || null;
}

async function findUserIdByName(name) {
  if (!name) return null;
  const nameParts = name.split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return null;

  if (nameParts.length === 1) {
    const needle = nameParts[0];
    const { data, error } = await supabase
      .from("users")
      .select("user_id")
      .or(`first_name.ilike.${needle},last_name.ilike.${needle}`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.user_id || null;
  }

  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id || null;
}

// Distinguishes "this session has no users row" (a settled, permanent answer —
// synthetic dev-platform / cookie-bypass sessions, or a staff account HR has not
// linked to a users row yet) from "the lookup itself failed" (transient: a
// database error or a dropped connection). Callers must not treat the two the
// same: the first means there is no per-user record to wait for, the second
// means the answer is still unknown and must be retried.
export const USER_PROFILE_NOT_FOUND = "USER_PROFILE_NOT_FOUND";

export class UserProfileNotFoundError extends Error {
  constructor(message = "User profile not found. Ask HR to link your account to a user record.") {
    super(message);
    this.name = "UserProfileNotFoundError";
    this.code = USER_PROFILE_NOT_FOUND;
  }
}

export const isUserProfileNotFound = (error) => error?.code === USER_PROFILE_NOT_FOUND;

export async function resolveSessionUserId(session) {
  if (!session?.user) {
    throw new UserProfileNotFoundError("Authentication required");
  }

  const sessionUser = session.user;
  const numericSessionId =
    parsePositiveInt(sessionUser.user_id) ||
    parsePositiveInt(sessionUser.id) ||
    parsePositiveInt(session.userId);

  if (numericSessionId) {
    const userId = await findUserIdByNumericId(numericSessionId);
    if (userId) return userId;
  }

  const emailUserId = await findUserIdByEmail(asNonEmptyString(sessionUser.email));
  if (emailUserId) return emailUserId;

  const nameUserId = await findUserIdByName(asNonEmptyString(sessionUser.name));
  if (nameUserId) return nameUserId;

  throw new UserProfileNotFoundError();
}

