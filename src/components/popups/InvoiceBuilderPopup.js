import React, { useState, useEffect, useMemo } from "react";
import Popup from "./Popup";
import { normalizeRequests } from "@/lib/jobcards/utils";
import { PAYMENT_PROVIDERS } from "@/lib/payments/paymentProviders";

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `£${amount.toFixed(2)}`;
};

const DEFAULT_VAT_RATE = 0.2;

export default function InvoiceBuilderPopup({
  isOpen,
  onClose,
  jobData,
  onConfirm,
  invoiceResponse,
  isSubmitting = false
}) {
  const [requestLines, setRequestLines] = useState([]);
  const [labourTotal, setLabourTotal] = useState(0);
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(
    PAYMENT_PROVIDERS[0]?.id || "klarna"
  );
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPortal, setSendPortal] = useState(true);
  const [latestBuilderPayload, setLatestBuilderPayload] = useState(null);
  const [invoiceMeta, setInvoiceMeta] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (invoiceResponse) {
      setInvoiceMeta(invoiceResponse);
    }
  }, [invoiceResponse]);

  useEffect(() => {
    const raw = normalizeRequests(jobData?.requests).map((entry, index) => ({
      id: entry.id || index,
      rawDescription:
        entry.text ||
        entry.description ||
        entry.label ||
        "",
      quantity: Number(entry.quantity || entry.qty || 1),
      paymentType: entry.paymentType || entry.payment_type || "Customer"
    }));
    const sorted = [...raw].sort((a, b) => { // customer requests first, authorised last
      const aIsAuth = (a.paymentType || "").toLowerCase() === "authorised";
      const bIsAuth = (b.paymentType || "").toLowerCase() === "authorised";
      if (aIsAuth === bIsAuth) return 0;
      return aIsAuth ? 1 : -1;
    });
    let customerCount = 0;
    let authorisedCount = 0;
    const normalized = sorted.map((entry) => {
      const isAuth = (entry.paymentType || "").toLowerCase() === "authorised";
      if (isAuth) { authorisedCount++; } else { customerCount++; }
      const requestLabel = isAuth
        ? `Authorised Request ${authorisedCount}`
        : `Request ${customerCount}`;
      return {
        id: entry.id,
        description: entry.rawDescription || requestLabel,
        requestLabel,
        quantity: entry.quantity,
        paymentType: entry.paymentType
      };
    });
    setRequestLines(normalized);
    setLabourTotal(Number(jobData?.writeUp?.labour_time || 0));
  }, [jobData]);

  const partLines = useMemo(() => {
    const allocations = Array.isArray(jobData?.partsAllocations)
      ? jobData.partsAllocations
      : [];

    return allocations
      .filter((item) => item && item.part)
      .map((item) => ({
        id: item.id,
        partNumber: item.part.partNumber || item.part_number || "Part",
        name: item.part?.name || "Part",
        quantity: Number(item.quantityAllocated || item.quantityRequested || 0),
        unitPrice:
          Number(item.unitPrice) ||
          Number(item.part?.unitPrice) ||
          Number(item.part?.unit_price) ||
          0,
        source: item.origin || item.source || "VHC"
      }));
  }, [jobData?.partsAllocations]);

  const partsSubtotal = useMemo(() => {
    return partLines.reduce((total, line) => {
      return total + line.quantity * line.unitPrice;
    }, 0);
  }, [partLines]);

  const labourValue = Number(labourTotal) || 0;
  const vatBase = partsSubtotal + labourValue;
  const vatTotal = vatBase * vatRate;
  const invoiceTotal = vatBase + vatTotal;

  const handleDescriptionChange = (id, value) => {
    setRequestLines((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, description: value } : line
      )
    );
  };

  const handleConfirm = () => {
    const builderPayload = {
      requests: requestLines.map((line) => ({
        ...line
      })),
      partLines,
      providerId: selectedProvider,
      sendEmail,
      sendPortal,
      totals: {
        partsTotal: partsSubtotal,
        labourTotal: labourValue,
        vatTotal,
        total: invoiceTotal
      }
    };

    setLatestBuilderPayload(builderPayload);
    if (typeof onConfirm === "function") {
      onConfirm(builderPayload);
    }
  };

  const buildInvoiceHtml = () => {
    if (!latestBuilderPayload) {
      return `<html><body><p>Invoice preview will appear here once generated.</p></body></html>`;
    }

    const { requests, partLines, totals } = latestBuilderPayload;
    const requestRows =
      (requests || [])
        .map(
          (req) =>
            `<tr>
              <td><strong>${req.requestLabel || "Request"}</strong>: ${req.description}</td>
              <td>${req.quantity}</td>
              <td>${formatCurrency(req.unitPrice ?? 0)}</td>
              <td>${formatCurrency((req.quantity || 1) * (req.unitPrice ?? 0))}</td>
            </tr>`
        )
        .join("") || "<tr><td colspan='4'>No requests</td></tr>";

    const partRows =
      (partLines || [])
        .map(
          (part) =>
            `<tr>
              <td>${part.name}</td>
              <td>${part.quantity}</td>
              <td>${formatCurrency(part.unitPrice)}</td>
              <td>${formatCurrency(part.quantity * part.unitPrice)}</td>
            </tr>`
        )
        .join("") || "<tr><td colspan='4'>No parts</td></tr>";

    const summaryRows = `
      <tr><td>Parts Subtotal</td><td colspan="3">${formatCurrency(totals.partsTotal)}</td></tr>
      <tr><td>Labour</td><td colspan="3">${formatCurrency(totals.labourTotal)}</td></tr>
      <tr><td>VAT</td><td colspan="3">${formatCurrency(totals.vatTotal)}</td></tr>
      <tr><td><strong>Total</strong></td><td colspan="3"><strong>${formatCurrency(totals.total)}</strong></td></tr>
    `;

    const invoiceNumber = invoiceMeta?.invoice?.job_id
      ? `INV-${invoiceMeta.invoice.job_id}-${invoiceMeta.invoice.id}`
      : "INV-DRAFT";

    return `
      <html>
        <head>
          <title>${invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; color: var(--accent-purple); padding: 24px; }
            h1 { color: var(--info-dark); margin-bottom: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 8px; border: 1px solid var(--accent-purple-surface); }
            th { background: var(--info-surface); text-align: left; }
          </style>
        </head>
        <body>
          <h1>Invoice Preview</h1>
          <p>Job: ${jobData?.jobNumber || "N/A"} | Customer: ${
      jobData?.customer || "N/A"
    }</p>
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${requestRows}
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${partRows}
            </tbody>
          </table>

          <table style="margin-top: 16px;">
            <tbody>
              ${summaryRows}
            </tbody>
          </table>
          ${
            invoiceMeta?.paymentLink?.checkout_url
              ? `<p>Payment Link: <a href="${invoiceMeta.paymentLink.checkout_url}">${invoiceMeta.paymentLink.checkout_url}</a></p>`
              : ""
          }
        </body>
      </html>
    `;
  };

  const createPdfResource = () => {
    if (!latestBuilderPayload) return;
    const html = buildInvoiceHtml();
    const blob = new Blob([html], { type: "application/pdf" });
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfBlob(blob);
    setPdfUrl(URL.createObjectURL(blob));
  };

  useEffect(() => {
    if (invoiceMeta && latestBuilderPayload) {
      createPdfResource();
    }
  }, [invoiceMeta, latestBuilderPayload]);

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handlePrintInvoice = () => {
    const html = buildInvoiceHtml();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleShareInvoice = async (action) => {
    if (!invoiceMeta || !pdfBlob) {
      setShareFeedback("Generate invoice PDF first.");
      return;
    }
    setIsSharing(true);
    setShareFeedback("");
    try {
      const base64 = await blobToBase64(pdfBlob);
      const fileName = `invoice-${invoiceMeta.invoice.id}.pdf`;
      const response = await fetch("/api/invoices/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobData?.id,
          jobNumber: jobData?.jobNumber,
          invoiceId: invoiceMeta.invoice.id,
          customerEmail: jobData?.customerEmail,
          fileData: base64,
          fileName,
          action
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to share invoice");
      }
      setShareFeedback(
        action === "email"
          ? "Invoice emailed to customer."
          : "Invoice saved to job documents."
      );
    } catch (error) {
      console.error("Share invoice failed:", error);
      setShareFeedback(error.message);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Popup isOpen={isOpen} onClose={onClose}>
      <div style={{ maxWidth: "900px" }}>
        <header style={{ marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 4px 0" }}>Invoice Builder (Pro Forma)</h2>
          <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "14px" }}>
            Edit request descriptions, verify VHC/parts pricing, and preview totals before dispatching.
          </p>
        </header>

        <section style={{ marginBottom: "18px" }}>
          <h3 style={{ marginBottom: "8px" }}>Job Requests</h3>
          {requestLines.map((line) => (
            <div
              key={line.id}
              style={{
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "10px",
                background: "var(--surface)"
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--info)",
                  marginBottom: "6px",
                  fontWeight: 600
                }}
              >
                {line.requestLabel || "Request"}
              </label>
              <input
                value={line.description}
                onChange={(event) =>
                  handleDescriptionChange(line.id, event.target.value)
                }
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  padding: "8px 10px",
                  fontSize: "14px"
                }}
              />
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "var(--info-dark)",
                  display: "flex",
                  gap: "14px"
                }}
              >
                <span>Qty: {line.quantity}</span>
                <span>Payment Type: {line.paymentType}</span>
              </div>
            </div>
          ))}
        </section>

        <section style={{ marginBottom: "18px" }}>
          <h3 style={{ marginBottom: "12px" }}>Parts & VHC Items</h3>
          {partLines.length === 0 ? (
            <p style={{ color: "var(--info)" }}>
              No priced parts yet; VHC additions populate here automatically.
            </p>
          ) : (
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid var(--accent-purple-surface)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "10px 12px",
                  background: "var(--info-surface)",
                  fontSize: "13px",
                  fontWeight: 600
                }}
              >
                <span>Part / Item</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span>Total</span>
              </div>
              {partLines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    padding: "12px",
                    borderTop: "1px solid var(--info-surface)",
                    fontSize: "14px"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{line.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--info)" }}>
                      {line.partNumber} · {line.source}
                    </div>
                  </div>
                  <span>{line.quantity}</span>
                  <span>{formatCurrency(line.unitPrice)}</span>
                  <span>{formatCurrency(line.unitPrice * line.quantity)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginBottom: "18px" }}>
          <h3 style={{ marginBottom: "12px" }}>Payment Provider</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {PAYMENT_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProvider(provider.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border:
                    selectedProvider === provider.id
                      ? "2px solid var(--info-dark)"
                      : "1px solid var(--accent-purple-surface)",
                  background:
                    selectedProvider === provider.id ? "var(--success-surface)" : "var(--surface)",
                  cursor: "pointer",
                  fontWeight: selectedProvider === provider.id ? 600 : 500,
                  color: "var(--accent-purple)"
                }}
              >
                {provider.label}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              fontSize: "14px",
              color: "var(--info-dark)"
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
              />
              Send invoice to customer email
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="checkbox"
                checked={sendPortal}
                onChange={(event) => setSendPortal(event.target.checked)}
              />
              Publish invoice to customer portal balance
            </label>
          </div>
        </section>

        <section
          style={{
            marginBottom: "18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}
        >
          <div
            style={{
              borderRadius: "10px",
              border: "1px solid var(--accent-purple-surface)",
              padding: "12px",
              background: "var(--surface)"
            }}
          >
            <label style={{ fontSize: "12px", color: "var(--info)" }}>
              Labour total
            </label>
            <input
              type="number"
              value={labourTotal}
              min="0"
              onChange={(event) => setLabourTotal(Number(event.target.value))}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid var(--info)",
                padding: "10px",
                fontSize: "14px",
                marginTop: "6px"
              }}
            />
          </div>

          <div
            style={{
              borderRadius: "10px",
              border: "1px solid var(--accent-purple-surface)",
              padding: "12px",
              background: "var(--surface)"
            }}
          >
            <label style={{ fontSize: "12px", color: "var(--info)" }}>
              VAT rate
            </label>
            <select
              value={vatRate}
              onChange={(event) => setVatRate(Number(event.target.value))}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid var(--info)",
                padding: "10px",
                fontSize: "14px",
                marginTop: "6px",
                background: "var(--surface)"
              }}
            >
              <option value={0}>0%</option>
              <option value={0.05}>5%</option>
              <option value={0.2}>20%</option>
            </select>
          </div>
        </section>

        {invoiceMeta && (
          <section
            style={{
              marginBottom: "18px",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--info-surface)"
            }}
          >
            <h3 style={{ margin: "0 0 10px 0" }}>Invoice Actions</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                disabled={!pdfUrl}
                onClick={() => {
                  if (!pdfUrl) return;
                  const link = document.createElement("a");
                  link.href = pdfUrl;
                  link.download = `invoice-${invoiceMeta.invoice.id}.pdf`;
                  link.click();
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--info-dark)",
                  color: "white",
                  cursor: pdfUrl ? "pointer" : "not-allowed"
                }}
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={handlePrintInvoice}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  background: "var(--surface)",
                  cursor: "pointer"
                }}
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => handleShareInvoice("email")}
                disabled={isSharing}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--info-dark)",
                  background: "var(--info-dark)",
                  color: "white",
                  cursor: isSharing ? "not-allowed" : "pointer"
                }}
              >
                {isSharing ? "Sending..." : "Email to customer"}
              </button>
              <button
                type="button"
                onClick={() => handleShareInvoice("save")}
                disabled={isSharing}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  background: "var(--surface)",
                  cursor: isSharing ? "not-allowed" : "pointer"
                }}
              >
                {isSharing ? "Saving..." : "Save copy to documents"}
              </button>
            </div>
            {shareFeedback && (
              <p style={{ marginTop: "10px", color: "var(--info-dark)" }}>{shareFeedback}</p>
            )}
          </section>
        )}

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}
          >
            <h3 style={{ margin: 0 }}>Pro Forma Preview</h3>
            <button
              type="button"
              onClick={() => setPreviewOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "1px solid var(--info)",
                borderRadius: "999px",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              {previewOpen ? "Hide" : "Show"} summary
            </button>
          </div>
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              padding: "14px",
              background: "var(--info-surface)",
              display: previewOpen ? "block" : "none"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px"
              }}
            >
              <span>Parts (incl. VHC items)</span>
              <strong>{formatCurrency(partsSubtotal)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px"
              }}
            >
              <span>Labour</span>
              <strong>{formatCurrency(labourValue)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                fontSize: "12px",
                color: "var(--info)"
              }}
            >
              <span>VAT ({(vatRate * 100).toFixed(0)}%)</span>
              <strong>{formatCurrency(vatTotal)}</strong>
            </div>
            <div
              style={{
                borderTop: "1px solid var(--info)",
                marginTop: "8px",
                paddingTop: "8px",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "16px"
              }}
            >
              <span>Total</span>
              <strong>{formatCurrency(invoiceTotal)}</strong>
            </div>
          </div>
        </section>

        <footer
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "var(--info-dark)",
              color: "white",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer"
            }}
          >
            {isSubmitting ? "Submitting..." : "Confirm & Invoicing"}
          </button>
        </footer>
      </div>
    </Popup>
  );
}
