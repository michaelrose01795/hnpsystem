// file location: src/lib/database/reporting/tableAvailability.js
//
// Graceful degradation primitive (Phase-1 Principle 9 / ADR-9).
//
// The reporting SQL migrations (src/lib/database/schema/reporting/*) are applied
// as a deploy step. Until a given table exists, the reporting data layer must
// return empty, non-erroring results rather than crash. This module answers
// "does reporting table X exist?" once, cheaply, and caches the answer for the
// life of the server process (table existence does not change at runtime).

import { supabase } from "@/lib/database/supabaseClient";

// Map of tableName -> Promise<boolean>. Memoised so we probe each table once.
const probes = new Map();

async function probe(tableName) {
  if (!supabase) return false;
  try {
    // A HEAD count with limit 0 is the cheapest existence probe. A missing
    // relation returns a PostgREST error (code 42P01 / "does not exist").
    const { error } = await supabase
      .from(tableName)
      .select("*", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      const msg = `${error.code || ""} ${error.message || ""}`.toLowerCase();
      if (msg.includes("does not exist") || error.code === "42p01" || error.code === "pgrst205") {
        return false;
      }
      // Permission or other errors: treat as "not available to reporting" so we
      // degrade rather than surface a 500. Logged for diagnostics.
      console.warn(`[reporting] table probe "${tableName}" inconclusive:`, error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[reporting] table probe "${tableName}" threw:`, err?.message || err);
    return false;
  }
}

// Returns a boolean. Cached after the first call per table.
export async function reportingTableExists(tableName) {
  if (!tableName) return false;
  if (!probes.has(tableName)) {
    probes.set(tableName, probe(tableName));
  }
  return probes.get(tableName);
}

// Test-time / admin helper to force a re-probe (e.g. after applying a migration).
export function clearTableAvailabilityCache() {
  probes.clear();
}

export default reportingTableExists;
