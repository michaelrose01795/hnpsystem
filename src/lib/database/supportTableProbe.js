// file location: src/lib/database/supportTableProbe.js
//
// Phase 10 — shared, memoised "does this support table exist?" probe used by the
// new Phase 10 data helpers (github links, notifications, rules, approvals,
// knowledge, activity). Identical semantics to the probe in supportSavedViews.js
// (service-role, since RLS blocks anon) but factored out so the five new helpers
// don't each re-implement it. Degrades gracefully: an unmigrated / missing table
// returns false and the caller returns an empty/skip result rather than throwing.

import { supabaseService } from "@/lib/database/supabaseClient";

const probes = new Map();

export async function supportTableExists(table) {
  if (!supabaseService) return false;
  if (!probes.has(table)) {
    probes.set(
      table,
      (async () => {
        try {
          const { error } = await supabaseService.from(table).select("*", { head: true, count: "exact" }).limit(1);
          if (error) {
            const msg = `${error.code || ""} ${error.message || ""}`.toLowerCase();
            if (msg.includes("does not exist") || error.code === "42p01" || error.code === "pgrst205") return false;
            console.warn(`[support] table probe "${table}" inconclusive:`, error.message || error);
            return false;
          }
          return true;
        } catch (err) {
          console.warn(`[support] table probe "${table}" threw:`, err?.message || err);
          return false;
        }
      })()
    );
  }
  return probes.get(table);
}

// Force a re-probe (e.g. in tests, or after applying the migration at runtime).
export function clearSupportProbeCache() {
  probes.clear();
}
