// file location: src/pages/api/consent/index.js
//
// GET  — return effective consents for the signed-in user
// POST — record a grant or withdrawal for the signed-in user. Body:
//        { purpose, channel?, status: 'granted'|'withdrawn', source? }

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";
import { getClientIp, getUserAgent } from "@/lib/auth/rateLimit";
import {
  recordConsent,
  getEffectiveConsents,
  CONSENT_PURPOSES,
} from "@/lib/consent/consentLedger";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const { data: user, error: userErr } = await supabaseService
    .from("users")
    .select("user_id, email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (userErr || !user) {
    return res.status(404).json({ success: false, message: "Account not found." });
  }

  const isCustomer = String(user.role || "").toLowerCase() === "customer";
  const subjectType = isCustomer ? "customer" : "employee";

  if (req.method === "GET") {
    const effective = await getEffectiveConsents({
      subjectType,
      subjectId: userId,
    });
    return res.status(200).json({
      success: true,
      purposes: CONSENT_PURPOSES,
      consents: effective,
    });
  }

  if (req.method === "POST") {
    const purpose = String(req.body?.purpose || "");
    const channel = req.body?.channel ? String(req.body.channel) : null;
    const status = String(req.body?.status || "");
    const source = req.body?.source ? String(req.body.source) : "profile_settings";

    if (!CONSENT_PURPOSES[purpose]) {
      return res.status(400).json({ success: false, message: "Unknown purpose." });
    }
    if (status !== "granted" && status !== "withdrawn") {
      return res.status(400).json({ success: false, message: "status must be 'granted' or 'withdrawn'." });
    }

    try {
      await recordConsent({
        subjectType,
        subjectId: userId,
        email: user.email,
        purpose,
        channel,
        status,
        source,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
    } catch (err) {
      console.error("[consent] recordConsent failed:", err?.message || err);
      return res.status(500).json({ success: false, message: "Could not record consent." });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed." });
}
