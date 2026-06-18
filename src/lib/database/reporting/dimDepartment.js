// file location: src/lib/database/reporting/dimDepartment.js
//
// Data access for the department dimension (dim_department). The canonical list
// lives in config (src/lib/reporting/config/departments.js); this helper seeds
// the table from that config and reads it back. Reporting code should prefer the
// config for synchronous lookups and use this only for seeding / admin views.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { reportingTableExists } from "./tableAvailability";
import { DEPARTMENTS } from "@/lib/reporting/config/departments";

const TABLE = "dim_department";

// Read all department rows. Falls back to the config when the table is absent
// (graceful degradation) so callers always get the canonical set.
export async function listDepartments() {
  const exists = await reportingTableExists(TABLE);
  if (!exists) {
    return Object.values(DEPARTMENTS).map((d) => ({
      code: d.code,
      name: d.name,
      kind: d.kind,
      parent_code: d.parent,
      is_active: true,
    }));
  }
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) {
    console.warn("[reporting] listDepartments read failed:", error.message);
    return [];
  }
  return data || [];
}

// Seed / upsert dim_department from the config. Parents must exist before
// children (self-referential FK), so insert in two passes: roots first.
export async function seedDepartments() {
  if (!supabaseService) return { seeded: 0, skipped: "no service client" };
  const exists = await reportingTableExists(TABLE);
  if (!exists) return { seeded: 0, skipped: "table not applied" };

  const rows = Object.values(DEPARTMENTS).map((d) => ({
    code: d.code,
    name: d.name,
    kind: d.kind,
    parent_code: d.parent,
    is_active: true,
  }));
  const roots = rows.filter((r) => !r.parent_code);
  const children = rows.filter((r) => r.parent_code);

  let seeded = 0;
  for (const batch of [roots, children]) {
    if (batch.length === 0) continue;
    const { error } = await supabaseService.from(TABLE).upsert(batch, { onConflict: "code" });
    if (error) {
      console.warn("[reporting] seedDepartments upsert failed:", error.message);
    } else {
      seeded += batch.length;
    }
  }
  return { seeded };
}

export default listDepartments;
