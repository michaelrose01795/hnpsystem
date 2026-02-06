// file location: src/pages/api/invoices/email.js
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function buildInvoiceEmailHtml(data) {
  const { company, invoice, requests = [], payment } = data;

  const companyName = company?.name || "Company";
  const companyAddress = (company?.address || []).join(", ");
  const companyPostcode = company?.postcode || "";
  const companyPhone = company?.phone_service || "";

  const invoiceNumber = invoice?.invoice_number || "—";
  const invoiceDate = formatDate(invoice?.invoice_date);
  const jobNumber = invoice?.job_number || "—";
  const orderNumber = invoice?.order_number || "—";

  const invoiceTo = invoice?.invoice_to || {};
  const vehicle = invoice?.vehicle_details || {};
  const totals = invoice?.totals || {};

  const requestBlocks = requests.map((req) => {
    const partsNet = (req.totals?.request_total_net || 0) - (req.labour?.net || 0);
    const partRows = (req.parts || []).map((p) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;">${p.part_number || "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;">${p.description || "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">${p.qty ?? 0}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatCurrency(p.price || 0)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatCurrency(p.vat || 0)}</td>
      </tr>
    `).join("");

    return `
      <div style="margin-bottom:20px;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
        <div style="background:#f8f8f8;padding:12px 16px;border-bottom:1px solid #e5e5e5;">
          <strong style="font-size:14px;">${req.request_label || `Request ${req.request_number}`}: ${req.title || ""}</strong>
          ${req.summary ? `<div style="font-size:12px;color:#666;margin-top:4px;">${req.summary}</div>` : ""}
          <div style="display:flex;gap:20px;margin-top:8px;font-size:12px;color:#555;">
            <span>Parts: ${formatCurrency(partsNet)}</span>
            <span>Labour: ${formatCurrency(req.labour?.net || 0)} (${req.labour?.hours || 0}h)</span>
            <span>VAT: ${formatCurrency(req.totals?.request_total_vat || 0)}</span>
            <span><strong>Total: ${formatCurrency(req.totals?.request_total_gross || 0)}</strong></span>
          </div>
        </div>
        ${(req.parts && req.parts.length > 0) ? `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;">Part No</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;">Description</th>
              <th style="padding:6px 8px;text-align:center;font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;">Qty</th>
              <th style="padding:6px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;">Price</th>
              <th style="padding:6px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #ddd;">VAT</th>
            </tr>
          </thead>
          <tbody>${partRows}</tbody>
        </table>` : ""}
      </div>
    `;
  }).join("");

  const paymentInfo = payment ? `
    <div style="margin-top:24px;border:1px solid #e5e5e5;border-radius:8px;padding:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#555;">Payment Details</h3>
      <table style="width:100%;font-size:13px;">
        <tr><td style="padding:3px 0;color:#888;width:140px;">Bank Name</td><td style="padding:3px 0;"><strong>${payment.bank_name || "—"}</strong></td></tr>
        <tr><td style="padding:3px 0;color:#888;">Sort Code</td><td style="padding:3px 0;"><strong>${payment.sort_code || "—"}</strong></td></tr>
        <tr><td style="padding:3px 0;color:#888;">Account Number</td><td style="padding:3px 0;"><strong>${payment.account_number || "—"}</strong></td></tr>
        <tr><td style="padding:3px 0;color:#888;">Account Name</td><td style="padding:3px 0;"><strong>${payment.account_name || "—"}</strong></td></tr>
      </table>
      <p style="margin:10px 0 0;font-size:12px;color:#888;">${payment.payment_reference_hint || "Please use the invoice number as your payment reference."}</p>
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- Company Header -->
    <div style="background:#1a1a1a;color:#ffffff;padding:24px 28px;">
      <h1 style="margin:0;font-size:22px;">${companyName}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#ccc;">${companyAddress}${companyPostcode ? `, ${companyPostcode}` : ""}</p>
      ${companyPhone ? `<p style="margin:4px 0 0;font-size:13px;color:#ccc;">Tel: ${companyPhone}</p>` : ""}
    </div>

    <div style="padding:24px 28px;">

      <!-- Invoice Meta -->
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:16px;">
        <div>
          <h2 style="margin:0;font-size:18px;color:#333;">Invoice ${invoiceNumber}</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Date: ${invoiceDate}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#666;">Job: ${jobNumber} | Order: ${orderNumber}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;color:#888;">Invoice To</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${invoiceTo.name || "—"}</p>
          ${(invoiceTo.lines || []).map((l) => `<p style="margin:1px 0;font-size:13px;color:#555;">${l}</p>`).join("")}
          ${invoiceTo.postcode ? `<p style="margin:1px 0;font-size:13px;color:#555;">${invoiceTo.postcode}</p>` : ""}
        </div>
      </div>

      <!-- Vehicle Info -->
      <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:13px;">
        <strong>Vehicle:</strong> ${vehicle.reg || "—"} &mdash; ${vehicle.vehicle || "—"}
        ${vehicle.mileage ? ` &mdash; ${vehicle.mileage} mi` : ""}
      </div>

      <!-- Request Blocks -->
      ${requestBlocks || '<p style="color:#888;">No requests recorded.</p>'}

      <!-- Totals -->
      <div style="border-top:2px solid #333;padding-top:16px;margin-top:8px;">
        <table style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:4px 0;color:#666;">Service Total</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;">${formatCurrency(totals.service_total || 0)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">VAT Total</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;">${formatCurrency(totals.vat_total || 0)}</td>
          </tr>
          <tr style="font-size:16px;">
            <td style="padding:8px 0 4px;font-weight:700;">Invoice Total</td>
            <td style="padding:8px 0 4px;text-align:right;font-weight:700;">${formatCurrency(totals.invoice_total || 0)}</td>
          </tr>
        </table>
      </div>

      ${paymentInfo}

    </div>

    <!-- Footer -->
    <div style="background:#fafafa;border-top:1px solid #eee;padding:16px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#999;">This invoice was generated by ${companyName}. If you have any queries, please contact us.</p>
    </div>
  </div>
</body>
</html>`;
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

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      success: false,
      error: "Email service not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to environment variables.",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const invoiceNumber = invoiceData?.invoice?.invoice_number || jobNumber || "Draft";
    const companyName = invoiceData?.company?.name || "Service Department";
    const html = buildInvoiceEmailHtml(invoiceData);

    await transporter.sendMail({
      from: `"${companyName}" <${SMTP_FROM}>`,
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} from ${companyName}`,
      html,
    });

    return res.status(200).json({ success: true, message: `Invoice sent to ${customerEmail}` });
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to send email" });
  }
}
