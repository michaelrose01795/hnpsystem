import { createSmtpTransport, isSmtpConfigured, SMTP_FROM } from "@/lib/email/smtp";
import { getEmailBranding } from "@/lib/email/template";

function mergeAttachments(baseAttachments, extraAttachments) {
  const all = [...(baseAttachments || []), ...(extraAttachments || [])];
  const seen = new Set();
  return all.filter((item) => {
    const key = `${item?.cid || ""}|${item?.filename || ""}|${item?.path || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function sendDmsEmail({
  req,
  to,
  subject,
  html,
  text = "",
  companyName = "",
  attachments = [],
}) {
  if (!isSmtpConfigured()) {
    throw new Error("Email service not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS.");
  }

  const branding = getEmailBranding(req, companyName);
  const transporter = createSmtpTransport();
  const mailFromName = companyName || branding.companyName;

  await transporter.sendMail({
    from: `"${mailFromName}" <${SMTP_FROM}>`,
    to,
    subject,
    html,
    text,
    attachments: mergeAttachments(branding.attachments, attachments),
  });

  return { companyName: branding.companyName };
}

