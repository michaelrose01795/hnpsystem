// file location: codex/notify-status-change.js
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// ===============================================
// 🔔 Supabase Edge Function: Notify on Job Status Change
// ===============================================

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const payload = await req.json();
  const newJob = payload.record;

  // Example notification condition
  if (newJob.status === "Ready for Workshop") {
    await supabase
      .from("notifications")
      .insert({
        message: `🚗 Job #${newJob.job_number} is ready for workshop.`,
        target_role: "Techs",
        created_at: new Date().toISOString(),
      });
  }

  if (newJob.status === "Waiting for Parts") {
    await supabase
      .from("notifications")
      .insert({
        message: `🧩 Job #${newJob.job_number} is waiting for parts approval.`,
        target_role: "Parts",
        created_at: new Date().toISOString(),
      });
  }

  return new Response("Notification automation executed", { status: 200 });
});
