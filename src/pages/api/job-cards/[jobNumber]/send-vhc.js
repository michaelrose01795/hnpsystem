import crypto from "crypto";
import { supabaseService } from "@/lib/database/supabaseClient";
import { markVHCAsSent } from "@/lib/services/vhcStatusService";
import { isSmtpConfigured } from "@/lib/email/smtp";
import { sendDmsEmail } from "@/lib/email/emailApi";
import { getEmailBranding, renderEmailShell } from "@/lib/email/template";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const COMPANY_NAME = process.env.SMTP_COMPANY_NAME || "Service Department";

const generateLinkCode = () => crypto.randomBytes(9).toString("base64url").slice(0, 12);

const isLinkExpired = (createdAt) => {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;
  return Date.now() - created > 24 * 60 * 60 * 1000;
};

const buildHtml = ({ customerName, jobNumber, shareUrl, branding }) =>
  renderEmailShell({
    title: `Vehicle Health Check for Job #${jobNumber}`,
    previewText: `Your Vehicle Health Check for job #${jobNumber} is ready to view.`,
    companyName: branding.companyName,
    logoSrc: branding.logoSrc,
    eyebrow: "Vehicle Health Check",
    headline: `Job #${jobNumber} report is ready`,
    intro: `Hello ${customerName || "Customer"}, your interactive Vehicle Health Check is now available.`,
    bodyHtml: `
      <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#ffffff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:12px;color:#6b7280;width:130px;padding:4px 0;">Job Number</td>
            <td style="font-size:13px;color:#111827;font-weight:700;padding:4px 0;">#${jobNumber}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#6b7280;padding:4px 0;">Link Expiry</td>
            <td style="font-size:13px;color:#111827;font-weight:700;padding:4px 0;">24 hours</td>
          </tr>
        </table>
      </div>
      <div style="margin-top:10px;font-size:12px;color:#4b5563;line-height:1.6;">
        If you cannot open the button, copy and paste this link into your browser:<br />
        <a href="${shareUrl}" target="_blank" rel="noopener noreferrer">${shareUrl}</a>
      </div>
    `,
    ctaLabel: "Open Vehicle Health Check",
    ctaUrl: shareUrl,
    footerText: `This secure link expires after 24 hours. Contact ${branding.companyName} if you need a new one.`,
  });

async function handler(req, res, session) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key is not configured" });
  }

  const { jobNumber: rawJobNumber } = req.query || {};
  if (!rawJobNumber) {
    return res.status(400).json({ success: false, error: "Job number is required" });
  }

  try {
    const identity = await resolveJobIdentity({
      client: supabaseService,
      identifier: rawJobNumber,
      select: "id, job_number",
    });
    if (!identity?.id) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const canonicalJobNumber = identity.job_number;
    const { data: jobRow, error: jobError } = await supabaseService
      .from("jobs")
      .select("id, job_number, status, vhc_completed_at, customer:customer_id(firstname, lastname, email)")
      .eq("id", identity.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!jobRow) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const body = req.body || {};
    // TODO: revert to `body.customerEmail || jobRow.customer?.email` once VHC send testing is complete.
    const TEST_EMAIL_OVERRIDE = "michaelrose01795@icloud.com";
    const customerEmail = TEST_EMAIL_OVERRIDE;
    // TODO: revert to `body.customerPhone || jobRow.customer?.phone` once VHC send testing is complete.
    const TEST_PHONE_OVERRIDE = "07740795711";
    const customerPhone = TEST_PHONE_OVERRIDE;
    if (!customerEmail) {
      return res.status(400).json({ success: false, error: "Customer email is required to send VHC" });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({
        success: false,
        error: "Email service not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS.",
      });
    }

    const { data: existingLinks, error: linksError } = await supabaseService
      .from("job_share_links")
      .select("link_code, created_at")
      .eq("job_number", canonicalJobNumber)
      .order("created_at", { ascending: false })
      .limit(1);

    if (linksError) throw linksError;

    let linkCode = existingLinks?.[0]?.link_code || null;
    let createdAt = existingLinks?.[0]?.created_at || null;

    if (!linkCode || isLinkExpired(createdAt)) {
      linkCode = generateLinkCode();
      createdAt = new Date().toISOString();
      const { error: insertError } = await supabaseService.from("job_share_links").insert({
        job_id: jobRow.id,
        job_number: canonicalJobNumber,
        link_code: linkCode,
        created_at: createdAt,
      });
      if (insertError) throw insertError;
    }

    // The share link goes to the customer's phone/email, so it must always
    // resolve to a publicly reachable host. resolveEmailBaseUrl can fall back
    // to localhost when running in dev, which leaves customers with an
    // unopenable URL — pin to the production app URL (override with
    // VHC_PUBLIC_BASE_URL or NEXT_PUBLIC_APP_URL when needed).
    const baseUrl = (
      process.env.VHC_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://hnpsystem.vercel.app"
    ).replace(/\/+$/, "");
    const shareUrl = `${baseUrl}/vhc/share/${canonicalJobNumber}/${linkCode}`;
    const customerName = `${jobRow.customer?.firstname || ""} ${jobRow.customer?.lastname || ""}`.trim() || "Customer";
    const branding = getEmailBranding(req, COMPANY_NAME);

    await sendDmsEmail({
      req,
      to: customerEmail,
      subject: `Vehicle Health Check for Job #${canonicalJobNumber}`,
      html: buildHtml({ customerName, jobNumber: canonicalJobNumber, shareUrl, branding }),
      text: `Hello ${customerName},\n\nYour Vehicle Health Check for job #${canonicalJobNumber} is ready.\nOpen it here: ${shareUrl}\n\nThis link expires in 24 hours.\n\nRegards,\n${COMPANY_NAME}`,
      companyName: COMPANY_NAME,
    });

    // TODO: replace this stub with a real SMS provider integration (e.g. Twilio,
    // MessageBird) and wire credentials via env vars. For now this only logs the
    // attempt so the test phone number receives the share link via the dev console.
    if (customerPhone) {
      const smsBody = `Hello ${customerName}, your Vehicle Health Check for job #${canonicalJobNumber} is ready: ${shareUrl} (expires in 24h). - ${COMPANY_NAME}`;
      try {
        const smsApiUrl = process.env.SMS_API_URL;
        const smsApiKey = process.env.SMS_API_KEY;
        const smsFrom = process.env.SMS_FROM || COMPANY_NAME;
        if (smsApiUrl && smsApiKey) {
          await fetch(smsApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${smsApiKey}`,
            },
            body: JSON.stringify({ to: customerPhone, from: smsFrom, body: smsBody }),
          });
        } else {
          console.log(`[send-vhc] SMS provider not configured. Would send to ${customerPhone}: ${smsBody}`);
        }
      } catch (smsError) {
        console.error("[send-vhc] SMS dispatch failed (continuing):", smsError);
      }
    }

    if (!jobRow.vhc_completed_at) {
      const { error: completeStampError } = await supabaseService
        .from("jobs")
        .update({ vhc_completed_at: new Date().toISOString() })
        .eq("id", jobRow.id);
      if (completeStampError) throw completeStampError;
    }

    const sentBy = body.sentBy ?? body.sentByName ?? null;
    const statusResult = await markVHCAsSent(jobRow.id, sentBy, "email", customerEmail);
    if (!statusResult?.success) {
      return res.status(500).json({
        success: false,
        error: statusResult?.error || "Failed to set VHC sent status",
      });
    }

    return res.status(200).json({
      success: true,
      message: "VHC sent successfully",
      shareUrl,
      secondaryStatus: "VHC sent",
      mainStatus: "inprogress",
    });
  } catch (error) {
    console.error("Failed to send VHC:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send VHC",
    });
  }
}

export default withRoleGuard(handler);
