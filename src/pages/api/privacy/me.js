// file location: src/pages/api/privacy/me.js
//
// Returns a summary of the personal data we hold about the signed-in user,
// for display on /profile/privacy. Designed to be safe to fetch repeatedly:
// no PII of other people, no admin-only fields, no password material.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";
import { getEffectiveConsents, CONSENT_PURPOSES } from "@/lib/consent/consentLedger";

const PUBLIC_USER_FIELDS = [
  "user_id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "role",
  "job_title",
  "department",
  "employment_type",
  "start_date",
  "home_address",
  "created_at",
  "password_updated_at",
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

  const { data: user, error } = await supabaseService
    .from("users")
    .select(PUBLIC_USER_FIELDS.join(", "))
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !user) {
    return res.status(404).json({ success: false, message: "Account not found." });
  }

  const isCustomer = String(user.role || "").toLowerCase() === "customer";
  const subjectType = isCustomer ? "customer" : "employee";

  const [{ data: requests }, consents] = await Promise.all([
    supabaseService
      .from("subject_requests")
      .select("id, request_type, status, received_at, due_at, fulfilled_at")
      .eq("subject_user_id", userId)
      .order("received_at", { ascending: false })
      .limit(20),
    getEffectiveConsents({ subjectType, subjectId: userId }),
  ]);

  return res.status(200).json({
    success: true,
    profile: user,
    consents: { purposes: CONSENT_PURPOSES, effective: consents || {} },
    requests: requests || [],
  });
}
