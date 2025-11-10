// file location: scripts/test-supabase.js
import 'dotenv/config'; // ✅ Loads .env.local automatically when running Node
import { createClient } from "@supabase/supabase-js";

// Read env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Safety checks
if (!supabaseUrl) {
  console.error("❌ Supabase URL missing. Check your .env.local file.");
  process.exit(1);
}
if (!supabaseKey) {
  console.error("❌ Supabase key missing. Check SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log("🔄 Testing Supabase connection...");

  const { data, error } = await supabase
    .from("jobs")
    .select("completion_status, rectification_notes, job_description_snapshot, vhc_authorization_reference, task_checklist")
    .limit(1);

  if (error) {
    console.error("❌ Query failed:", error.message);
  } else {
    console.log("✅ Connection successful. Sample data:");
    console.log(data);
  }
})();
