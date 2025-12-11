import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
};

const createSupabaseClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Supabase credentials missing for overtime edge function.");
  }

  return createClient(url, serviceKey);
};

const sendJson = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: RESPONSE_HEADERS,
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return sendJson(405, { message: "Method not allowed" });
  }

  try {
    const supabase = createSupabaseClient();
    const body = await req.json();
    const { userId, periodId, date, start, end, notes } = body;

    if (!userId || !periodId || !date || !start || !end) {
      return sendJson(400, { message: "userId, periodId, date, start, and end are required." });
    }

    const diffMs = new Date(`${date}T${end}`) - new Date(`${date}T${start}`);
    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return sendJson(400, { message: "End time must be after start time." });
    }

    const { data, error } = await supabase
      .from("overtime_sessions")
      .insert({
        user_id: userId,
        period_id: periodId,
        date,
        start_time: start,
        end_time: end,
        notes: notes || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("❌ Supabase insert error", error);
      return sendJson(500, { message: "Failed to insert overtime session" });
    }

    return sendJson(200, { data });
  } catch (error) {
    console.error("❌ Overtime edge function error", error);
    return sendJson(500, { message: error.message || "Unhandled edge function error" });
  }
});
