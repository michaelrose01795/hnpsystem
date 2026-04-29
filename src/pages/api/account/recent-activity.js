// file location: src/pages/api/account/recent-activity.js
//
// Returns the current user's recent auth-related events from audit_log.
// Used by /account/security to show the user their own login history so
// they can spot anything unfamiliar.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";

const VISIBLE_ACTIONS = [
  "login_success",
  "login_fail",
  "password_change",
  "password_change_fail",
  "password_reset",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const { data, error } = await supabaseService
    .from("audit_log")
    .select("id, occurred_at, action, ip_address, user_agent")
    .eq("actor_user_id", userId)
    .in("action", VISIBLE_ACTIONS)
    .order("occurred_at", { ascending: false })
    .limit(20);

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.status(200).json({
    success: true,
    events: (data || []).map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      action: row.action,
      ip: row.ip_address || null,
      userAgent: row.user_agent || null,
    })),
  });
}
