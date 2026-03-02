// file location: src/pages/api/invoices/email.js
import { isSmtpConfigured } from "@/lib/email/smtp";
import { sendDmsEmail } from "@/lib/email/emailApi";
import { escapeHtml, getEmailBranding, renderEmailShell } from "@/lib/email/template";

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function renderInvoiceBody(data) {
  const { company, invoice, requests = [], payment } = data || {};

  const companyName = company?.name || "HP Automotive";
  const companyAddress = (company?.address || []).filter(Boolean).join(", ");
  const companyPostcode = company?.postcode || "";
  const companyPhone = company?.phone_service || "";

  const invoiceNumber = invoice?.invoice_number || "-";
  const invoiceDate = formatDate(invoice?.invoice_date) || "-";
  const jobNumber = invoice?.job_number || "-";
  const orderNumber = invoice?.order_number || "-";

  const invoiceTo = invoice?.invoice_to || {};
  const vehicle = invoice?.vehicle_details || {};
  const totals = invoice?.totals || {};

  const customerLines = (invoiceTo.lines || [])
    .filter(Boolean)
    .map((line) => `<div style="font-size:13px;color:#4b5563;line-height:1.5;">${escapeHtml(line)}</div>`)
    .join("");

  const requestBlocks = requests
    .map((request, index) => {
      const requestLabel = request?.request_label || `Request ${request?.request_number || index + 1}`;
      const requestTitle = request?.title || "";
      const requestSummary = request?.summary || "";
      const partsNet = (request?.totals?.request_total_net || 0) - (request?.labour?.net || 0);
      const labourNet = request?.labour?.net || 0;
      const labourHours = request?.labour?.hours || 0;
      const requestVat = request?.totals?.request_total_vat || 0;
      const requestGross = request?.totals?.request_total_gross || 0;

      const partRows = (request?.parts || [])
        .map(
          (part) => `
            <tr>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${escapeHtml(part?.part_number || "-")}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${escapeHtml(part?.description || "-")}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${escapeHtml(part?.qty ?? 0)}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;">${escapeHtml(formatCurrency(part?.price || 0))}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;">${escapeHtml(formatCurrency(part?.vat || 0))}</td>
            </tr>
          `
        )
        .join("");

      const partsTable =
        request?.parts?.length > 0
          ? `
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;">Part No</th>
                  <th style="padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;">Description</th>
                  <th style="padding:7px 8px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;">Qty</th>
                  <th style="padding:7px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;">Price</th>
                  <th style="padding:7px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;">VAT</th>
                </tr>
              </thead>
              <tbody>${partRows}</tbody>
            </table>
          `
          : '<div style="margin-top:12px;font-size:12px;color:#6b7280;">No parts listed for this request.</div>';

      return `
        <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px 14px 12px 14px;background:#ffffff;margin-top:12px;">
          <div style="font-size:13px;font-weight:700;color:#111827;">${escapeHtml(requestLabel)}${requestTitle ? `: ${escapeHtml(requestTitle)}` : ""}</div>
          ${requestSummary ? `<div style="font-size:12px;color:#4b5563;margin-top:6px;line-height:1.5;">${escapeHtml(requestSummary)}</div>` : ""}
          <table style="width:100%;margin-top:10px;border-collapse:collapse;">
            <tr>
              <td style="font-size:12px;color:#6b7280;padding:2px 0;">Parts</td>
              <td style="font-size:12px;color:#111827;padding:2px 0;text-align:right;">${escapeHtml(formatCurrency(partsNet))}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;padding:2px 0;">Labour (${escapeHtml(labourHours)}h)</td>
              <td style="font-size:12px;color:#111827;padding:2px 0;text-align:right;">${escapeHtml(formatCurrency(labourNet))}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;padding:2px 0;">VAT</td>
              <td style="font-size:12px;color:#111827;padding:2px 0;text-align:right;">${escapeHtml(formatCurrency(requestVat))}</td>
            </tr>
            <tr>
              <td style="font-size:13px;font-weight:700;color:#111827;padding:5px 0 2px 0;">Request Total</td>
              <td style="font-size:13px;font-weight:700;color:#111827;padding:5px 0 2px 0;text-align:right;">${escapeHtml(formatCurrency(requestGross))}</td>
            </tr>
          </table>
          ${partsTable}
        </div>
      `;
    })
    .join("");

  const paymentInfo = payment
    ? `
      <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#ffffff;margin-top:14px;">
        <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:700;">Payment Details</div>
        <table style="width:100%;margin-top:8px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;font-size:12px;color:#6b7280;width:140px;">Bank Name</td><td style="padding:4px 0;font-size:12px;color:#111827;font-weight:700;">${escapeHtml(payment?.bank_name || "-")}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#6b7280;">Sort Code</td><td style="padding:4px 0;font-size:12px;color:#111827;font-weight:700;">${escapeHtml(payment?.sort_code || "-")}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#6b7280;">Account Number</td><td style="padding:4px 0;font-size:12px;color:#111827;font-weight:700;">${escapeHtml(payment?.account_number || "-")}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#6b7280;">Account Name</td><td style="padding:4px 0;font-size:12px;color:#111827;font-weight:700;">${escapeHtml(payment?.account_name || "-")}</td></tr>
        </table>
        <div style="margin-top:8px;font-size:12px;color:#4b5563;line-height:1.5;">
          ${escapeHtml(payment?.payment_reference_hint || "Please use the invoice number as your payment reference.")}
        </div>
      </div>
    `
    : "";

  return `
    <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#f8fafc;margin-bottom:14px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;padding:0 10px 10px 0;">
            <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:700;">Invoice</div>
            <div style="font-size:22px;color:#111827;font-weight:700;line-height:1.3;">${escapeHtml(invoiceNumber)}</div>
            <div style="font-size:12px;color:#4b5563;">Date: ${escapeHtml(invoiceDate)}</div>
            <div style="font-size:12px;color:#4b5563;">Job: ${escapeHtml(jobNumber)} | Order: ${escapeHtml(orderNumber)}</div>
          </td>
          <td style="vertical-align:top;padding:0 0 10px 10px;text-align:right;">
            <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:700;">Billed To</div>
            <div style="font-size:13px;color:#111827;font-weight:700;line-height:1.5;">${escapeHtml(invoiceTo?.name || "-")}</div>
            ${customerLines}
            ${invoiceTo?.postcode ? `<div style="font-size:13px;color:#4b5563;line-height:1.5;">${escapeHtml(invoiceTo.postcode)}</div>` : ""}
          </td>
        </tr>
      </table>
      <div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:12px;color:#4b5563;line-height:1.5;">
        <strong style="color:#111827;">Vehicle:</strong> ${escapeHtml(vehicle?.reg || "-")} | ${escapeHtml(vehicle?.vehicle || "-")}
        ${vehicle?.mileage ? ` | ${escapeHtml(vehicle.mileage)} mi` : ""}
      </div>
      <div style="margin-top:8px;font-size:12px;color:#4b5563;line-height:1.5;">
        <strong style="color:#111827;">From:</strong> ${escapeHtml(companyName)}
        ${companyAddress ? `, ${escapeHtml(companyAddress)}` : ""}
        ${companyPostcode ? `, ${escapeHtml(companyPostcode)}` : ""}
        ${companyPhone ? ` | Tel: ${escapeHtml(companyPhone)}` : ""}
      </div>
    </div>

    <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:700;margin:0 0 6px 2px;">Work Summary</div>
    ${requestBlocks || '<div style="font-size:13px;color:#6b7280;">No requests recorded.</div>'}

    <div style="border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#ffffff;margin-top:14px;">
      <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:700;margin-bottom:6px;">Totals</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;font-size:13px;color:#4b5563;">Service Total</td><td style="padding:4px 0;font-size:13px;color:#111827;text-align:right;font-weight:700;">${escapeHtml(formatCurrency(totals?.service_total || 0))}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#4b5563;">VAT Total</td><td style="padding:4px 0;font-size:13px;color:#111827;text-align:right;font-weight:700;">${escapeHtml(formatCurrency(totals?.vat_total || 0))}</td></tr>
        <tr><td style="padding:7px 0 2px 0;font-size:16px;color:#111827;font-weight:700;">Invoice Total</td><td style="padding:7px 0 2px 0;font-size:16px;color:#111827;text-align:right;font-weight:700;">${escapeHtml(formatCurrency(totals?.invoice_total || 0))}</td></tr>
      </table>
    </div>

    ${paymentInfo}
  `;
}

function buildInvoiceEmailHtml(data, branding) {
  const invoiceNumber = data?.invoice?.invoice_number || data?.invoice?.job_number || "Draft";
  return renderEmailShell({
    title: `Invoice ${invoiceNumber}`,
    previewText: `Invoice ${invoiceNumber} from ${branding.companyName}`,
    companyName: branding.companyName,
    logoSrc: branding.logoSrc,
    eyebrow: "Accounts / Invoice",
    headline: `Invoice ${invoiceNumber}`,
    intro: "Thank you for choosing us. Your invoice is below, with a full work and payment summary.",
    bodyHtml: renderInvoiceBody(data),
    footerText: `This invoice was generated by ${branding.companyName}. Please reply to this email if you have any questions.`,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { customerEmail, invoiceData, jobNumber } = req.body || {};

  if (!customerEmail) {
    return res.status(400).json({ success: false, error: "Customer email is required" });
  }

  if (!invoiceData) {
    return res.status(400).json({ success: false, error: "Invoice data is required" });
  }

  if (!isSmtpConfigured()) {
    return res.status(500).json({
      success: false,
      error: "Email service not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to environment variables.",
    });
  }

  try {
    const fallbackName = process.env.SMTP_COMPANY_NAME || "HP Automotive";
    const companyName = invoiceData?.company?.name || fallbackName;
    const branding = getEmailBranding(req, companyName);
    const invoiceNumber = invoiceData?.invoice?.invoice_number || jobNumber || "Draft";
    const html = buildInvoiceEmailHtml(invoiceData, branding);

    await sendDmsEmail({
      req,
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} from ${companyName}`,
      html,
      companyName,
    });

    return res.status(200).json({ success: true, message: `Invoice sent to ${customerEmail}` });
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to send email" });
  }
}
