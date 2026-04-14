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

async function findUserIdByNumericId(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id || null;
}

async function findUserIdByKeycloakId(keycloakUserId) {
  if (!keycloakUserId) return null;
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("keycloak_user_id", keycloakUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id || null;
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

export async function resolveSessionUserId(session) {
  if (!session?.user) {
    throw new Error("Authentication required");
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

  const keycloakCandidates = [
    asNonEmptyString(sessionUser.id),
    asNonEmptyString(session.userId),
    asNonEmptyString(sessionUser.sub),
  ].filter(Boolean);

  for (const keycloakId of keycloakCandidates) {
    const userId = await findUserIdByKeycloakId(keycloakId);
    if (userId) return userId;
  }

  const emailUserId = await findUserIdByEmail(asNonEmptyString(sessionUser.email));
  if (emailUserId) return emailUserId;

  const nameUserId = await findUserIdByName(asNonEmptyString(sessionUser.name));
  if (nameUserId) return nameUserId;

  throw new Error("User profile not found. Ask HR to link your account to a user record.");
}

