// file location: src/pages/api/auth/password-reset.js
//
// Phase 1A — password reset. Two actions:
//   action: "request" — body { email }. Always responds 200 with a generic
//     message (no account enumeration). If the email matches an active user,
//     a single-use reset link is generated and emailed to that user's real
//     address. Token contains no password material.
//   action: "confirm" — body { token, newPassword }. Verifies the token
//     against the user's current password hash (so old/used tokens fail),
//     then writes the new password.
//
// Removed in this phase:
//   - "revert"   (relied on storing/transmitting the user's old plaintext)
//   - "setNewFromToken" (relied on the same broken token shape)
//   - The hardcoded TEST_RESET_EMAIL recipient
//   - The "you can change anyone's password by knowing their email" path:
//     resets now require the user to receive an email at their address.
//
// Password storage at this point is still plaintext in users.password_hash;
// that is fixed in Phase 1B (bcrypt migration). Do not infer security from
// the column name.

import { supabaseService } from "@/lib/database/supabaseClient";
import { isSmtpConfigured } from "@/lib/email/smtp";
import { sendDmsEmail } from "@/lib/email/emailApi";
import { getEmailBranding, renderEmailShell } from "@/lib/email/template";
import {
  issueResetToken,
  verifyResetToken,
  RESET_TOKEN_TTL_MS,
} from "@/lib/auth/resetTokens";
import {
  checkRateLimit,
  recordAttempt,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/rateLimit";
import { hashPassword, ALGO_BCRYPT } from "@/lib/auth/passwords";
import { writeAuditLog } from "@/lib/audit/auditLog";

const PASSWORD_RESET_PUBLIC_BASE_URL =
  process.env.PASSWORD_RESET_PUBLIC_URL || "https://hnpsystem.vercel.app";

const GENERIC_REQUEST_RESPONSE = {
  success: true,
  message:
    "If an account with that email exists, a password reset link has been sent.",
};

const isEmail = (value) =>
  typeof value === "string" && /.+@.+\..+/.test(value.trim());

function buildResetEmailHtml({ displayName, resetLink, branding }) {
  const ttlMinutes = Math.round(RESET_TOKEN_TTL_MS / 60000);
  return renderEmailShell({
    title: "Reset your HNP System password",
    previewText: "Use this link to set a new password.",
    companyName: branding.companyName,
    logoSrc: branding.logoSrc,
    eyebrow: "Password Reset",
    headline: `Hello ${displayName || "there"},`,
    intro:
      "We received a request to reset the password for this account. " +
      "If this was you, use the button below to choose a new password.",
    bodyHtml: `
      <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#ffffff;">
        <p style="margin:0 0 10px 0;font-size:13px;color:#374151;line-height:1.6;">
          If you did not request this, you can safely ignore this email — your password will not change.
        </p>
        <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
          Button not working? Open this link directly:
          <a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a>
        </p>
      </div>
    `,
    ctaLabel: "Choose a New Password",
    ctaUrl: resetLink,
    footerText: `This link expires in ${ttlMinutes} minutes and can only be used once.`,
  });
}

async function emailResetLink({ req, user, token }) {
  if (!isSmtpConfigured()) {
    console.warn(
      "[password-reset] SMTP not configured; reset email not sent for user",
      user.user_id
    );
    return { sent: false };
  }
  if (!user.email) {
    console.warn(
      "[password-reset] user has no email on file; cannot send reset link.",
      user.user_id
    );
    return { sent: false };
  }

  const branding = getEmailBranding(req, "HP Automotive");
  const baseUrl = String(PASSWORD_RESET_PUBLIC_BASE_URL).replace(/\/+$/, "");
  const resetLink = `${baseUrl}/password-reset/new?token=${encodeURIComponent(token)}`;
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email;

  const html = buildResetEmailHtml({ displayName, resetLink, branding });

  await sendDmsEmail({
    req,
    to: user.email,
    subject: "Reset your HNP System password",
    html,
    companyName: "HP Automotive",
  });

  return { sent: true };
}

async function handleRequest(req, res) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!isEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "A valid email address is required.",
    });
  }

  const limit = await checkRateLimit({
    endpoint: "password_reset_request",
    email,
    ip,
  });
  if (!limit.allowed) {
    await recordAttempt({
      endpoint: "password_reset_request",
      email,
      ip,
      userAgent,
      succeeded: false,
      failureReason: limit.reason,
    });
    res.setHeader("Retry-After", String(limit.retryAfterSec || 900));
    return res.status(429).json({
      success: false,
      message: "Too many reset requests. Please try again later.",
    });
  }

  if (!supabaseService) {
    return res.status(500).json({
      success: false,
      message: "Server missing Supabase service client.",
    });
  }

  const { data: user, error } = await supabaseService
    .from("users")
    .select("user_id, first_name, last_name, email, password_hash, is_active")
    .ilike("email", email)
    .maybeSingle();

  // Always respond with the same generic message regardless of whether the
  // account exists, so an attacker can't enumerate emails. We still record
  // the attempt for forensics.
  if (error || !user || user.is_active === false) {
    await recordAttempt({
      endpoint: "password_reset_request",
      email,
      ip,
      userAgent,
      succeeded: false,
      failureReason: error ? "lookup_error" : "no_account",
    });
    return res.status(200).json(GENERIC_REQUEST_RESPONSE);
  }

  let token;
  try {
    token = issueResetToken({
      userId: user.user_id,
      currentPasswordHash: user.password_hash || "",
    });
  } catch (tokenErr) {
    console.error("[password-reset] token issue failed:", tokenErr);
    return res.status(500).json({
      success: false,
      message: "Could not issue a reset token.",
    });
  }

  let emailResult = { sent: false };
  try {
    emailResult = await emailResetLink({ req, user, token });
  } catch (emailErr) {
    console.error("[password-reset] email send failed:", emailErr);
    // Fall through — don't tell the caller whether the email succeeded.
  }

  await recordAttempt({
    endpoint: "password_reset_request",
    email,
    userId: user.user_id,
    ip,
    userAgent,
    succeeded: true,
    failureReason: emailResult.sent ? null : "email_not_sent",
  });

  return res.status(200).json(GENERIC_REQUEST_RESPONSE);
}

async function handleConfirm(req, res) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const token = String(req.body?.token || "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "A reset token is required.",
    });
  }
  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: "A new password is required.",
    });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 12 characters.",
    });
  }

  const limit = await checkRateLimit({
    endpoint: "password_reset_confirm",
    email: null,
    ip,
  });
  if (!limit.allowed) {
    await recordAttempt({
      endpoint: "password_reset_confirm",
      ip,
      userAgent,
      succeeded: false,
      failureReason: limit.reason,
    });
    res.setHeader("Retry-After", String(limit.retryAfterSec || 900));
    return res.status(429).json({
      success: false,
      message: "Too many attempts. Please try again later.",
    });
  }

  if (!supabaseService) {
    return res.status(500).json({
      success: false,
      message: "Server missing Supabase service client.",
    });
  }

  // We need the userId from the token to look up the user, but the token
  // can't be verified until we know the user's current password_hash. So we
  // peek at the userId from the (still-untrusted) payload, load the user,
  // then run the cryptographic check.
  let peekedUserId = null;
  try {
    const encoded = token.split(".")[0];
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    peekedUserId = Number(payload?.uid);
  } catch {
    peekedUserId = null;
  }
  if (!Number.isFinite(peekedUserId) || peekedUserId <= 0) {
    await recordAttempt({
      endpoint: "password_reset_confirm",
      ip,
      userAgent,
      succeeded: false,
      failureReason: "malformed_token",
    });
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset link.",
    });
  }

  const { data: user, error } = await supabaseService
    .from("users")
    .select("user_id, email, password_hash, is_active")
    .eq("user_id", peekedUserId)
    .maybeSingle();

  if (error || !user || user.is_active === false) {
    await recordAttempt({
      endpoint: "password_reset_confirm",
      userId: peekedUserId,
      ip,
      userAgent,
      succeeded: false,
      failureReason: "no_account",
    });
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset link.",
    });
  }

  const verification = verifyResetToken({
    token,
    currentPasswordHash: user.password_hash || "",
  });
  if (!verification.ok) {
    await recordAttempt({
      endpoint: "password_reset_confirm",
      email: user.email,
      userId: user.user_id,
      ip,
      userAgent,
      succeeded: false,
      failureReason: `token_${verification.reason}`,
    });
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset link.",
    });
  }

  let newHash;
  try {
    newHash = await hashPassword(newPassword);
  } catch (hashErr) {
    console.error("[password-reset] hash failed:", hashErr);
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

  await recordAttempt({
    endpoint: "password_reset_confirm",
    email: user.email,
    userId: user.user_id,
    ip,
    userAgent,
    succeeded: true,
  });
  await writeAuditLog({
    action: "password_reset",
    actorUserId: user.user_id,
    entityType: "user",
    entityId: user.user_id,
    ip,
    userAgent,
  });

  return res.status(200).json({
    success: true,
    message: "Your password has been updated. You can now sign in.",
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed." });
    }

    const action = String(req.body?.action || "request").toLowerCase();

    if (action === "request" || action === "reset") {
      return handleRequest(req, res);
    }
    if (action === "confirm") {
      return handleConfirm(req, res);
    }
    if (action === "revert" || action === "setnewfromtoken") {
      return res.status(410).json({
        success: false,
        message:
          "This password recovery flow has been removed. Please request a new reset email.",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Unknown action.",
    });
  } catch (error) {
    console.error("password-reset API error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unexpected password reset error." });
  }
}
