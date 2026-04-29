// file location: src/pages/api/cookies/consent.js
//
// Mirrors the browser-side cookie banner choice to the server. PECR
// requires demonstrable proof that consent was captured for non-essential
// cookies. The browser keeps the choice in a first-party cookie for
// performance; this endpoint logs it server-side for evidence.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";
import { getClientIp, getUserAgent } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { COOKIE_POLICY_VERSION } from "@/lib/consent/consentLedger";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitiseCategories = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const out = { essential: true };
  for (const [key, value] of Object.entries(raw)) {
    if (key === "essential") continue;
    if (typeof value !== "boolean") continue;
    out[key] = value;
  }
  return out;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const anonymousId = String(req.body?.anonymousId || "").trim();
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ success: false, message: "anonymousId must be a uuid." });
  }
  const categories = sanitiseCategories(req.body?.categories);
  if (!categories) {
    return res.status(400).json({ success: false, message: "categories must be an object of booleans." });
  }
  const policyVersion =
    typeof req.body?.policyVersion === "string" && req.body.policyVersion
      ? req.body.policyVersion
      : COOKIE_POLICY_VERSION;

  const session = await getServerSession(req, res, authOptions);
  const userIdRaw = Number(session?.user?.id);
  const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;

  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const { data, error } = await supabaseService
    .from("cookie_consents")
    .insert([
      {
        anonymous_id: anonymousId,
        user_id: userId,
        categories,
        policy_version: policyVersion,
        ip_address: ip || null,
        user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("[cookies/consent] insert failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not record cookie consent." });
  }

  await writeAuditLog({
    action: "cookie_consent",
    actorUserId: userId,
    entityType: "cookie_consent",
    entityId: data?.id || null,
    diff: { categories, policy_version: policyVersion, anonymous_id: anonymousId },
    ip,
    userAgent,
  });

  return res.status(200).json({ success: true });
}
