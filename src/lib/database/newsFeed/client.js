// file location: src/lib/database/newsFeed/client.js
//
// Shared plumbing for every news-hub data module: the Supabase client the
// server side uses, the standard user projection (so an author avatar is
// built the same way everywhere), and small guards.
//
// Mirrors the convention already set by src/lib/database/reactions.js — reads
// run on whichever client is available so the browser's realtime refresh can
// re-read directly, writes require the service key.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { getDisplayName } from "@/lib/users/displayName";

export const db = supabaseService || supabase;
export const hasServiceClient = Boolean(supabaseService);

export const USER_COLUMNS = "user_id, first_name, last_name, photo_url, job_title, department, role";

export const assertWriteAccess = (what = "this write") => {
  if (!hasServiceClient) {
    throw new Error(
      `Server missing SUPABASE_SERVICE_ROLE_KEY; ${what} is blocked by RLS.`
    );
  }
};

// The author/commenter shape the UI renders: a name, an avatar and enough
// context to caption it.
export const formatUser = (row) => {
  if (!row) return null;
  return {
    userId: row.user_id,
    name: getDisplayName(row),
    photoUrl: row.photo_url || null,
    jobTitle: row.job_title || "",
    department: row.department || "",
    role: row.role || "",
  };
};

export const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

export const requireUserId = (value, label = "userId") => {
  const parsed = toPositiveInt(value);
  if (!parsed) throw new Error(`A valid ${label} is required.`);
  return parsed;
};

export const requireUuid = (value, label = "id") => {
  const parsed = String(value || "").trim();
  if (!parsed) throw new Error(`${label} is required.`);
  return parsed;
};

// Supabase's .in() breaks on an empty array; every call site wants "no rows"
// rather than an error, so chunk through this guard first.
export const uniqueIds = (ids = []) =>
  Array.from(new Set((ids || []).map((id) => String(id)).filter(Boolean)));

export const throwIf = (error, message) => {
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
};
