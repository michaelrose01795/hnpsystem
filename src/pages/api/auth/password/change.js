// file location: src/pages/api/auth/password/change.js
//
// Authenticated password change for the currently signed-in user.
// Requires the user to re-supply their current password (re-auth) to make
// session-stealing attacks materially harder.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";
import {
  verifyPassword,
  hashPassword,
  isStrongEnough,
  PASSWORD_MIN_LENGTH,
  ALGO_BCRYPT,
} from "@/lib/auth/passwords";
import {
  checkRateLimit,
  recordAttempt,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/audit/auditLog";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed." });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const session = await getServerSession(req, res, authOptions);
  const sessionUserId = Number(session?.user?.id);
  if (!session?.user || !Number.isFinite(sessionUserId) || sessionUserId <= 0) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current and new password are required.",
    });
  }
  if (!isStrongEnough(newPassword)) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from the current password.",
    });
  }

  if (!supabaseService) {
    return res.status(500).json({
      success: false,
      message: "Server missing Supabase service client.",
    });
  }

  // Rate limit on the email associated with this account so an attacker
  // can't use a stolen session to brute-force the current password.
  const { data: user, error } = await supabaseService
    .from("users")
    .select("user_id, email, password_hash, password_algo, role, is_active")
    .eq("user_id", sessionUserId)
    .maybeSingle();

  if (error || !user || user.is_active === false) {
    return res.status(404).json({
      success: false,
      message: "Account not found.",
    });
  }

  const limit = await checkRateLimit({
    endpoint: "login",
    email: user.email,
    ip,
  });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSec || 900));
    return res.status(429).json({
      success: false,
      message: "Too many attempts. Try again later.",
    });
  }

  const algo = user.password_algo || "plaintext";
  const matched = await verifyPassword({
    submitted: currentPassword,
    stored: user.password_hash || "",
    algo,
  });
  if (!matched) {
    await recordAttempt({
      endpoint: "login",
      email: user.email,
      userId: user.user_id,
      ip,
      userAgent,
      succeeded: false,
      failureReason: "bad_current_password",
    });
    await writeAuditLog({
      action: "password_change_fail",
      actorUserId: user.user_id,
      actorRole: user.role || null,
      entityType: "user",
      entityId: user.user_id,
      diff: { reason: "bad_current_password" },
      ip,
      userAgent,
    });
    return res.status(400).json({
      success: false,
      message: "Current password is incorrect.",
    });
  }

  let newHash;
  try {
    newHash = await hashPassword(newPassword);
  } catch (hashErr) {
    console.error("[password-change] hash failed:", hashErr);
    return res.status(500).json({
      success: false,
      message: "Could not update password.",
    });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabaseService
    .from("users")
    .update({
      password_hash: newHash,
      password_algo: ALGO_BCRYPT,
      password_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", user.user_id);

  if (updateError) {
    return res.status(500).json({
      success: false,
      message: "Could not update password.",
    });
  }

  await writeAuditLog({
    action: "password_change",
    actorUserId: user.user_id,
    actorRole: user.role || null,
    entityType: "user",
    entityId: user.user_id,
    ip,
    userAgent,
  });

  return res
    .status(200)
    .json({ success: true, message: "Password updated." });
}
