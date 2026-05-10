// file location: src/pages/api/website/auth/notification-prefs.js
// Updates the customer's communication preferences. The schema only
// has a single `contact_preference` text field on customers, so we
// store the primary channel there and stash the granular opt-ins
// as an activity event so staff can honour them without needing a
// schema migration.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

const ALLOWED_CHANNELS = new Set(["email", "phone", "sms", "post"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  const channel = String(req.body?.contact_preference ?? "").trim().toLowerCase();
  const optIns = req.body?.optIns || {};
  const next = {};
  if (ALLOWED_CHANNELS.has(channel)) next.contact_preference = channel;
  next.updated_at = new Date().toISOString();

  const client = db();
  if (Object.keys(next).length > 1) {
    const { error } = await client
      .from("customers")
      .update(next)
      .eq("id", session.customerId);
    if (error) {
      console.error("notification-prefs:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not save preferences." });
    }
  }

  // Persist the granular flags as a recordable event so staff can act.
  await client.from("customer_activity_events").insert({
    customer_id: session.customerId,
    activity_type: "notification_prefs_updated",
    activity_source: "customer_portal",
    activity_payload: {
      contact_preference: channel || null,
      marketing_email: !!optIns.marketingEmail,
      marketing_sms: !!optIns.marketingSms,
      service_reminders: optIns.serviceReminders !== false,
      mot_reminders: optIns.motReminders !== false,
    },
  });

  return res.status(200).json({ success: true });
}
