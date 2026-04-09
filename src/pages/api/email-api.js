import { sendDmsEmail } from "@/lib/email/emailApi";
import { getEmailBranding, renderEmailShell } from "@/lib/email/template";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    to,
    subject,
    companyName = "HP Automotive",
    previewText = "",
    eyebrow = "",
    headline = "",
    intro = "",
    bodyHtml = "",
    ctaLabel = "",
    ctaUrl = "",
    footerText = "",
    text = "",
    attachments = [],
  } = req.body || {};

  if (!to || !subject) {
    return res.status(400).json({ success: false, error: "`to` and `subject` are required" });
  }

  try {
    const branding = getEmailBranding(req, companyName);
    const html = renderEmailShell({
      title: subject,
      previewText,
      companyName: branding.companyName,
      logoSrc: branding.logoSrc,
      eyebrow,
      headline: headline || subject,
      intro,
      bodyHtml,
      ctaLabel,
      ctaUrl,
      footerText,
    });

    await sendDmsEmail({
      req,
      to,
      subject,
      html,
      text,
      companyName: branding.companyName,
      attachments,
    });

    return res.status(200).json({ success: true, message: `Email sent to ${to}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || "Failed to send email" });
  }
}

export default withRoleGuard(handler);
