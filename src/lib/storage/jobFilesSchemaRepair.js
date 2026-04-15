// file location: src/lib/storage/jobFilesSchemaRepair.js
// Best-effort runtime repair for the `job_files` table when PostgREST's
// schema cache is missing expected columns. This keeps uploads working even
// when a deployment is ahead of the exposed REST schema.

const JOB_FILES_COLUMN_DEFINITIONS = {
  visible_to_customer: "boolean DEFAULT true",
  file_size: "bigint",
  storage_type: "text",
  storage_path: "text",
};

const REPAIRABLE_JOB_FILES_COLUMNS = Object.keys(JOB_FILES_COLUMN_DEFINITIONS);
let repairAttemptPromise = null;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function isMissingSchemaColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(String(columnName || "").toLowerCase()) && message.includes("schema cache");
}

export function getRepairableJobFilesColumnsFromError(error, allowedColumns = REPAIRABLE_JOB_FILES_COLUMNS) {
  return allowedColumns.filter((columnName) => isMissingSchemaColumnError(error, columnName));
}

async function executeSqlThroughSupabase(query) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const endpoints = [
    `${supabaseUrl}/pg/query`,
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
    `${supabaseUrl}/rest/v1/rpc/query`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        return true;
      }
    } catch {
      // Try the next endpoint.
    }
  }

  return false;
}

function buildRepairSql(columns) {
  const statements = columns
    .map((columnName) => {
      const definition = JOB_FILES_COLUMN_DEFINITIONS[columnName];
      return definition
        ? `ALTER TABLE public.job_files ADD COLUMN IF NOT EXISTS ${columnName} ${definition};`
        : "";
    })
    .filter(Boolean);

  if (columns.includes("visible_to_customer")) {
    statements.push(
      "UPDATE public.job_files SET visible_to_customer = true WHERE visible_to_customer IS NULL;"
    );
  }

  statements.push("NOTIFY pgrst, 'reload schema';");
  return statements.join("\n");
}

/**
 * Try to repair the job_files schema at runtime. The helper is intentionally
 * best-effort: if the environment cannot run SQL, callers can safely continue
 * with their column-dropping fallback behavior.
 *
 * @param {string[]} columns
 * @returns {Promise<boolean>}
 */
export async function ensureJobFilesSchema(columns = REPAIRABLE_JOB_FILES_COLUMNS) {
  const uniqueColumns = Array.from(
    new Set(columns.filter((columnName) => REPAIRABLE_JOB_FILES_COLUMNS.includes(columnName)))
  );

  if (!uniqueColumns.length) {
    return false;
  }

  if (!repairAttemptPromise) {
    repairAttemptPromise = (async () => {
      const repaired = await executeSqlThroughSupabase(buildRepairSql(REPAIRABLE_JOB_FILES_COLUMNS));
      if (repaired) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else {
        repairAttemptPromise = null;
      }
      return repaired;
    })().catch(() => {
      repairAttemptPromise = null;
      return false;
    });
  }

  return repairAttemptPromise;
}
