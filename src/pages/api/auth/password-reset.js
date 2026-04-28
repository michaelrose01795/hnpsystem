import crypto from "crypto";
import { supabaseService } from "@/lib/database/supabaseClient";
import { isSmtpConfigured } from "@/lib/email/smtp";
import { sendDmsEmail } from "@/lib/email/emailApi";
import { getEmailBranding, renderEmailShell } from "@/lib/email/template";

const TEST_RESET_EMAIL = "michaelrose01795@icloud.com";
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_PUBLIC_BASE_URL =
  process.env.PASSWORD_RESET_PUBLIC_URL || "https://hnpsystem.vercel.app";

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev-secret";
}

function signResetToken(payload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyResetToken(token) {
  if (!token || !token.includes(".")) {
    throw new Error("Invalid reset token.");
  }
  const [encodedPayload, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    throw new Error("Reset token verification failed.");
  }
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("Reset token verification failed.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload?.iat || Date.now() - Number(payload.iat) > RESET_TOKEN_TTL_MS) {
    throw new Error("Reset token has expired.");
  }
  return payload;
}

function buildPasswordResetEmailHtml({ displayName, revertLink, branding }) {
  return renderEmailShell({
    title: `${displayName} you have reset your password`,
    previewText: "Your password was changed. Use this email to review and revert if needed.",
    companyName: branding.companyName,
    logoSrc: branding.logoSrc,
    eyebrow: "Security Alert",
    headline: `${displayName} you have reset your password`,
    intro: "A password reset was completed for your account.",
    bodyHtml: `
      <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#ffffff;">
        <p style="margin:0 0 10px 0;font-size:13px;color:#374151;line-height:1.6;">
          If this was you, no action is needed.
        </p>
        <p style="margin:0 0 14px 0;font-size:13px;color:#374151;line-height:1.6;">
          If this was not you, use the button below to review and revert the password change.
        </p>
        <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
          Button not working? Open this link directly:
          <a href="${revertLink}" target="_blank" rel="noopener noreferrer">${revertLink}</a>
        </p>
      </div>
    `,
    ctaLabel: "Review Password Reset",
    ctaUrl: revertLink,
    footerText: "For account safety, this link expires after 24 hours.",
  });
}

async function sendPasswordResetEmail({ req, displayName, subject, revertLink }) {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      skipped: true,
      reason: "Email service is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
    };
  }

  const branding = getEmailBranding(req, "HP Automotive");
  const html = buildPasswordResetEmailHtml({ displayName, revertLink, branding });

  await sendDmsEmail({
    req,
    to: TEST_RESET_EMAIL,
    // TODO: replace TEST_RESET_EMAIL with the user's real email after testing.
    subject: subject || `${displayName} you have reset your password`,
    html,
    companyName: "HP Automotive",
  });

  return { sent: true, skipped: false };
}

async function handlePasswordReset(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const newPassword = String(req.body?.newPassword ?? "");

  if (!email || newPassword === "") {
    return res.status(400).json({ success: false, message: "Email and newPassword are required." });
  }

  const { data: user, error: userError } = await supabaseService
    .from("users")
    .select("user_id, first_name, last_name, email, password_hash")
    .ilike("email", email)
    .maybeSingle();

  if (userError) {
    return res.status(500).json({ success: false, message: userError.message });
  }
  if (!user?.user_id) {
    return res.status(404).json({ success: false, message: "No user found for that email." });
  }

  const previousPasswordHash = user.password_hash || "";

  const { error: updateError } = await supabaseService
    .from("users")
    .update({
      password_hash: newPassword,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.user_id);

  if (updateError) {
    return res.status(500).json({ success: false, message: updateError.message });
  }

  const token = signResetToken({
    userId: user.user_id,
    oldPasswordHash: previousPasswordHash,
    newPasswordHash: newPassword,
    iat: Date.now(),
  });
  const baseUrl = String(PASSWORD_RESET_PUBLIC_BASE_URL).replace(/\/+$/, "");
  const revertLink = `${baseUrl}/password-reset/reverted?token=${encodeURIComponent(token)}`;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
  const subject = `${displayName} you have reset your password`;

  const emailResult = await sendPasswordResetEmail({ req, displayName, subject, revertLink });

  return res.status(200).json({
    success: true,
    message: emailResult?.sent
      ? "Password reset completed. Confirmation email sent."
      : "Password reset completed. Email not sent because SMTP is not configured yet.",
    emailSent: Boolean(emailResult?.sent),
    emailWarning: emailResult?.reason || null,
    testingRecipient: TEST_RESET_EMAIL,
  });
}

async function handlePasswordRevert(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const token = String(req.body?.token || "");
  if (!token) {
    return res.status(400).json({ success: false, message: "Reset token is required." });
  }

  let payload = null;
  try {
    payload = verifyResetToken(token);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Invalid token." });
  }

  const { data: user, error: lookupError } = await supabaseService
    .from("users")
    .select("user_id, password_hash, accent_color, dark_mode, first_name, last_name, email")
    .eq("user_id", payload.userId)
    .maybeSingle();

  if (lookupError) {
    return res.status(500).json({ success: false, message: lookupError.message });
  }
  if (!user?.user_id) {
    return res.status(404).json({ success: false, message: "User no longer exists." });
  }

  // Allow re-opening the link after revert: if DB already matches the old hash,
  // treat as already-reverted (idempotent) instead of failing with 409.
  const alreadyReverted =
    String(user.password_hash || "") === String(payload.oldPasswordHash || "");

  if (
    !alreadyReverted &&
    String(user.password_hash || "") !== String(payload.newPasswordHash || "")
  ) {
    return res.status(409).json({
      success: false,
      message: "Password has changed again since this reset email was sent.",
    });
  }

  if (!alreadyReverted) {
    const { error: revertError } = await supabaseService
      .from("users")
      .update({
        password_hash: String(payload.oldPasswordHash || ""),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payload.userId);

    if (revertError) {
      return res.status(500).json({ success: false, message: revertError.message });
    }
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || "";

  return res.status(200).json({
    success: true,
    message: alreadyReverted ? "Password is already reverted." : "Password has been reverted.",
    revertedPassword: String(payload.oldPasswordHash || ""),
    themePreferences: {
      accentColor: user.accent_color || "red",
      darkMode: user.dark_mode || "system",
    },
    displayName,
  });
}

// Allow the customer to choose a new password from the revert page using the
// same token. We re-verify the token, then require the current DB password to
// match the token's oldPasswordHash — proving the revert was just performed by
// this token and the account hasn't been tampered with by a third party.
async function handleSetNewFromToken(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const token = String(req.body?.token || "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (!token) {
    return res.status(400).json({ success: false, message: "Reset token is required." });
  }
  if (!newPassword) {
    return res.status(400).json({ success: false, message: "A new password is required." });
  }

  let payload = null;
  try {
    payload = verifyResetToken(token);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Invalid token." });
  }

  const { data: user, error: lookupError } = await supabaseService
    .from("users")
    .select("user_id, password_hash")
    .eq("user_id", payload.userId)
    .maybeSingle();

  if (lookupError) {
    return res.status(500).json({ success: false, message: lookupError.message });
  }
  if (!user?.user_id) {
    return res.status(404).json({ success: false, message: "User no longer exists." });
  }

  if (String(user.password_hash || "") !== String(payload.oldPasswordHash || "")) {
    return res.status(409).json({
      success: false,
      message: "This token can no longer be used to set a new password.",
    });
  }

  const { error: updateError } = await supabaseService
    .from("users")
    .update({
      password_hash: newPassword,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", payload.userId);

  if (updateError) {
    return res.status(500).json({ success: false, message: updateError.message });
  }

  return res.status(200).json({
    success: true,
    message: "Your new password has been saved.",
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const action = String(req.body?.action || "reset").toLowerCase();
    if (action === "revert") {
      return handlePasswordRevert(req, res);
    }
    if (action === "setnewfromtoken") {
      return handleSetNewFromToken(req, res);
    }
    return handlePasswordReset(req, res);
  } catch (error) {
    console.error("password-reset API error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Unexpected password reset error.",
    });
  }
}
