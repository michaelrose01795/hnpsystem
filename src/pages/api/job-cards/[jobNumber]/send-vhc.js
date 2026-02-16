import crypto from "crypto";
import nodemailer from "nodemailer";
import { supabaseService } from "@/lib/supabaseClient";
import { markVHCAsSent } from "@/lib/services/vhcStatusService";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const COMPANY_NAME = process.env.SMTP_COMPANY_NAME || "Service Department";

const generateLinkCode = () => crypto.randomBytes(9).toString("base64url").slice(0, 12);

const isLinkExpired = (createdAt) => {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;
  return Date.now() - created > 24 * 60 * 60 * 1000;
};

const resolveBaseUrl = (req) => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `${proto}://${host}` : "http://localhost:3000";
};

const buildHtml = ({ customerName, jobNumber, shareUrl }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5;">
    <p>Hello ${customerName || "Customer"},</p>
    <p>Your Vehicle Health Check for job <strong>#${jobNumber}</strong> is ready.</p>
    <p>
      Open your interactive VHC here:<br />
      <a href="${shareUrl}" target="_blank" rel="noopener noreferrer">${shareUrl}</a>
    </p>
    <p>This link expires in 24 hours.</p>
    <p>Regards,<br />${COMPANY_NAME}</p>
  </div>
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key is not configured" });
  }

  const { jobNumber } = req.query || {};
  if (!jobNumber) {
    return res.status(400).json({ success: false, error: "Job number is required" });
  }

  try {
    const { data: jobRow, error: jobError } = await supabaseService
      .from("jobs")
      .select("id, job_number, status, vhc_completed_at, customer:customer_id(firstname, lastname, email)")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!jobRow) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const body = req.body || {};
    const customerEmail = String(body.customerEmail || jobRow.customer?.email || "").trim();
    if (!customerEmail) {
      return res.status(400).json({ success: false, error: "Customer email is required to send VHC" });
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({
        success: false,
        error: "Email service not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS.",
      });
    }

    const { data: existingLinks, error: linksError } = await supabaseService
      .from("job_share_links")
      .select("link_code, created_at")
      .eq("job_number", jobNumber)
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
        job_number: jobNumber,
        link_code: linkCode,
        created_at: createdAt,
      });
      if (insertError) throw insertError;
    }

    const baseUrl = resolveBaseUrl(req);
    const shareUrl = `${baseUrl}/vhc/share/${jobNumber}/${linkCode}`;
    const customerName = `${jobRow.customer?.firstname || ""} ${jobRow.customer?.lastname || ""}`.trim() || "Customer";

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${COMPANY_NAME}" <${SMTP_FROM}>`,
      to: customerEmail,
      subject: `Vehicle Health Check for Job #${jobNumber}`,
      html: buildHtml({ customerName, jobNumber, shareUrl }),
      text: `Hello ${customerName},\n\nYour Vehicle Health Check for job #${jobNumber} is ready.\nOpen it here: ${shareUrl}\n\nThis link expires in 24 hours.\n\nRegards,\n${COMPANY_NAME}`,
    });

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
