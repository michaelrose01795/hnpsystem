// file location: src/lib/database/schema/apply-migration.js
// description: Script to apply database schema migrations from addtable.sql

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, "addtable.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Applying migration from addtable.sql...");
    console.log("SQL to execute:");
    console.log(sql);
    console.log("\n");

    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      console.error("Migration failed:", error);
      process.exit(1);
    }

    console.log("Migration applied successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error applying migration:", err);
    process.exit(1);
  }
}

applyMigration();
