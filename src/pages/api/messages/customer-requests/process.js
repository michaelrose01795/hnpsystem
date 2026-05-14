// file location: src/pages/api/messages/customer-requests/process.js
// Called after /create finishes saving a job that was opened from a
// customer-portal request card. Marks the activity event as processed
// (so it drops out of the staff inbox) and inserts an appointment row
// with the customer's preferred date so /appointments lands on it.

import { supabaseService, supabase } from "@/lib/database/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { SERVICE_ACTION_ROLES } from "@/lib/auth/serviceActionRoles";

const db = () => supabaseService || supabase;

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const eventIdRaw = req.body?.event_id;
  const eventId = typeof eventIdRaw === "string" ? eventIdRaw.trim() : "";
  const jobId = Number(req.body?.job_id);
  const customerId = req.body?.customer_id || null;
  const preferredDate = req.body?.preferred_date || null;
  const description = req.body?.description || null;

  if (!eventId) {
    return res.status(400).json({ success: false, message: "Invalid event id." });
  }
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid job id." });
  }

  const client = db();

  const { data: event, error: fetchErr } = await client
    .from("customer_activity_events")
    .select("event_id, customer_id, activity_type, activity_payload")
    .eq("event_id", eventId)
    .maybeSingle();
  if (fetchErr) {
    console.error("/process fetch:", fetchErr.message);
    return res.status(500).json({ success: false, message: "Could not load request." });
  }
  if (!event) {
    return res.status(404).json({ success: false, message: "Request not found." });
  }

  const now = new Date().toISOString();
  const nextType = event.activity_type.endsWith("_processed")
    ? event.activity_type
    : `${event.activity_type}_processed`;

  const nextPayload = {
    ...(event.activity_payload || {}),
    processed_job_id: jobId,
    processed_at: now,
  };

  let appointmentId = null;
  if (preferredDate) {
    // Convert the customer's preferred date into a scheduled_time. If the
    // payload already carries a time, honour it; otherwise default to 09:00.
    const scheduledTime = (() => {
      const raw = String(preferredDate);
      if (raw.includes("T")) return raw;
      return `${raw}T09:00:00`;
    })();

    const { data: appt, error: apptErr } = await client
      .from("appointments")
      .insert({
        job_id: jobId,
        customer_id: customerId || event.customer_id || null,
        scheduled_time: scheduledTime,
        status: "booked",
        notes: description || null,
        created_at: now,
        updated_at: now,
      })
      .select("appointment_id")
      .single();
    if (apptErr) {
      console.error("/process appointment insert:", apptErr.message);
    } else {
      appointmentId = appt?.appointment_id || null;
      nextPayload.processed_appointment_id = appointmentId;
    }
  }

  const { error: updErr } = await client
    .from("customer_activity_events")
    .update({
      activity_type: nextType,
      activity_payload: nextPayload,
      job_id: jobId,
    })
    .eq("event_id", eventId);
  if (updErr) {
    console.error("/process update:", updErr.message);
    return res.status(500).json({ success: false, message: "Could not mark request processed." });
  }

  return res.status(200).json({
    success: true,
    event_id: eventId,
    appointment_id: appointmentId,
  });
}

export default withRoleGuard(handler, { allow: SERVICE_ACTION_ROLES });
