// file location: src/features/invoices/components/InvoiceWorkspace.js
// Redesigned, app-native invoice layout for the JOB CARD Invoice tab.
// Follows the staffglobal.css design system: LayerSurface/LayerTheme surfaces,
// .app-data-table line tables, <Button> action buttons, and design tokens — no
// ad-hoc surface borders. The legacy "document" layout (InvoiceDetail) is kept
// for the /new-order proforma viewer and is shared via buildInvoiceRequestRows
// and useProformaOverrideEditor so both stay in sync.
import React, { useEffect, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import PopupModal from "@/components/popups/popupStyleApi";
import InvoiceDetail from "@/features/invoices/components/InvoiceDetail";
import InvoicePaymentModal from "@/features/invoices/components/InvoicePaymentModal";
import { buildInvoiceRequestRows } from "@/features/invoices/lib/buildInvoiceRequestRows";
import { useProformaOverrideEditor } from "@/features/invoices/components/ProformaOverrideModal";
import { isInvoiceRowPaid, isInvoicePaid, isInvoiceCancelled } from "@/lib/status/statusHelpers";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Small label/value tile (nested LayerTheme keeps surface alternation correct).
const SummaryTile = ({ label, children, tone }) => (
  <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="6px">
    <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-1)" }}>
      {label}
    </span>
    <strong style={{ fontSize: "1.05rem", color: tone || "var(--text-1)" }}>{children}</strong>
  </LayerTheme>
);

// One per-request line-items table: a Labour row plus a row per part.
const RequestSection = ({ row, isProforma, onOpenEditor }) => {
  const request = row.displayRequest;
  const displayParts =
    Array.isArray(row.linkedParts) && row.linkedParts.length > 0 ? row.linkedParts : request.parts;
  const parts = Array.isArray(displayParts) ? displayParts : [];

  const labourNet = Number(request.labour?.net || 0);
  const labourHours = Number(request.labour?.hours || 0);
  const totalsNet = Number(request.totals?.request_total_net || 0);
  const totalsVat = Number(request.totals?.request_total_vat || 0);
  const totalsGross = Number(request.totals?.request_total_gross || 0);
  const partsNet = totalsNet - labourNet;
  const labourVat = Math.max(0, totalsVat - parts.reduce((sum, p) => sum + Number(p.vat || 0), 0));
  const hasLabour = labourNet > 0 || labourHours > 0;
  const hasLineItems = hasLabour || parts.length > 0;

  return (
    <LayerTheme
      radius="var(--radius-sm)"
      gap="var(--space-3)"
      onClick={isProforma ? () => onOpenEditor?.(request) : undefined}
      style={isProforma ? { cursor: "pointer" } : undefined}
      title={isProforma ? "Click to edit proforma row overrides" : undefined}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>
            {`${request.request_label || `Request ${request.request_number}`}: ${request.title}`}
          </h3>
          {request.summary && (
            <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "0.9rem" }}>{request.summary}</p>
          )}
          {request.writeup?.fault && (
            <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "0.85rem" }}>
              <strong>Fault:</strong> {request.writeup.fault}
            </p>
          )}
          {request.writeup?.rectification && (
            <p style={{ margin: "2px 0 0", color: "var(--text-1)", fontSize: "0.85rem" }}>
              <strong>Rectification:</strong> {request.writeup.rectification}
            </p>
          )}
          {isProforma && (
            <p style={{ margin: "6px 0 0", color: "var(--primary-selected)", fontSize: "0.78rem", fontWeight: 600 }}>
              Proforma override enabled — click to edit
            </p>
          )}
        </div>
      </div>

      {hasLineItems ? (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="app-data-table app-data-table--rounded" style={{ minWidth: "560px" }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Part No</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit (ex VAT)</th>
                <th style={{ textAlign: "right" }}>VAT</th>
                <th style={{ textAlign: "right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {hasLabour && (
                <tr>
                  <td>Labour{labourHours ? ` (${labourHours}h)` : ""}</td>
                  <td>—</td>
                  <td style={{ textAlign: "right" }}>{labourHours || "—"}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(labourNet)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(labourVat)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(labourNet + labourVat)}</td>
                </tr>
              )}
              {parts.map((item, index) => {
                const lineNet = Number(item.price || 0) * Number(item.qty || 0);
                const lineVat = Number(item.vat || 0);
                return (
                  <tr key={`${item.part_number || "part"}-${index}`}>
                    <td>{item.description || "Part"}</td>
                    <td>{item.part_number || "—"}</td>
                    <td style={{ textAlign: "right" }}>{item.qty ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(item.price || 0)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(lineVat)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(lineNet + lineVat)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.9rem" }}>No line items recorded for this request.</p>
      )}

      {/* Per-request totals — parts + labour shown individually for this section. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "flex-end", alignItems: "baseline" }}>
        <span style={{ color: "var(--text-1)", fontSize: "0.85rem" }}>
          Parts Total: <strong style={{ color: "var(--text-1)" }}>{formatCurrency(partsNet)}</strong>
        </span>
        <span style={{ color: "var(--text-1)", fontSize: "0.85rem" }}>
          Labour Total: <strong style={{ color: "var(--text-1)" }}>{formatCurrency(labourNet)}</strong>
        </span>
        <span style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>
          Request Total (inc VAT): <strong style={{ color: "var(--accentText)" }}>{formatCurrency(totalsGross)}</strong>
        </span>
      </div>
    </LayerTheme>
  );
};

export default function InvoiceWorkspace({
  data,
  onPrint,
  onEmail,
  emailStatus,
  customerEmail,
  jobData = null,
  onDataRefresh = null,
  onDataPatch = null,
  onPaymentCompleted = null,
  onReleaseRequested = null,
  onSaveNotes = null,
}) {
  const detailData = data ?? {};
  const { invoice = {} } = detailData;
  const payments = Array.isArray(detailData.payments) ? detailData.payments : [];

  const isProforma = Boolean(data?.meta?.isProforma);
  const invoicePaid = isInvoiceRowPaid(invoice);
  const totals = invoice.totals || { service_total: 0, vat_total: 0, invoice_total: 0 };

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notes, setNotes] = useState(invoice.invoice_notes || "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState("");

  // Re-seed notes when the underlying invoice payload changes (e.g. after a refresh).
  useEffect(() => {
    setNotes(invoice.invoice_notes || "");
  }, [invoice.invoice_notes, invoice.id]);

  const { openEditor, modal } = useProformaOverrideEditor({
    jobIdForOverride: jobData?.id || null,
    onDataPatch,
    onDataRefresh,
  });

  if (!data) return null;

  const { rows } = buildInvoiceRequestRows(data, jobData);

  // Balance due = invoice total − captured payments; zero once marked paid.
  const capturedTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const invoiceTotal = Number(totals.invoice_total || 0);
  const balanceDue = invoicePaid ? 0 : Math.max(0, invoiceTotal - capturedTotal);

  const paymentStatusLabel = isProforma
    ? "Proforma"
    : invoicePaid
    ? "Paid"
    : invoice.payment_status || "Draft";
  const statusTone = isInvoicePaid(invoice.payment_status) || invoicePaid
    ? "app-badge--success"
    : isInvoiceCancelled(invoice.payment_status)
    ? "app-badge--danger"
    : "app-badge--neutral";

  const handleOpenEditor = (request) => {
    if (!isProforma) return;
    openEditor(request);
  };

  const handleSaveNotes = async () => {
    if (typeof onSaveNotes !== "function") return;
    setNotesSaving(true);
    setNotesStatus("");
    try {
      const result = await onSaveNotes(notes);
      if (result?.success === false) {
        throw new Error(result.error || "Failed to save notes");
      }
      setNotesStatus("Saved");
    } catch (error) {
      console.error("Failed to save invoice notes", error);
      setNotesStatus(error.message || "Failed to save notes");
    } finally {
      setNotesSaving(false);
      setTimeout(() => setNotesStatus(""), 4000);
    }
  };

  return (
    <>
      {/* ── Action bar ───────────────────────────────────────────── */}
      <LayerSurface radius="var(--radius-sm)" gap="var(--space-3)">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "var(--accentText)" }}>Invoice</h2>
            <span className={`app-badge ${statusTone} app-badge--uppercase`}>{paymentStatusLabel}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
              Preview Invoice
            </Button>
            <Button variant="secondary" size="sm" onClick={onPrint}>
              Print Invoice
            </Button>
            {!isProforma &&
              (invoicePaid ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onEmail}
                  disabled={!customerEmail || emailStatus === "Sending..."}
                  title={customerEmail ? `Send to ${customerEmail}` : "No customer email on file"}
                >
                  {emailStatus === "Sending..." ? "Sending..." : "Send Invoice"}
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setPaymentModalOpen(true)}>
                  Make Payment
                </Button>
              ))}
          </div>
        </div>
        {emailStatus && emailStatus !== "Sending..." && (
          <span
            className={`app-status-message ${emailStatus.includes("success") ? "app-status-message--success" : "app-status-message--danger"}`}
          >
            {emailStatus}
          </span>
        )}
      </LayerSurface>

      {/* ── Summary ──────────────────────────────────────────────── */}
      <LayerSurface radius="var(--radius-sm)" gap="var(--space-3)">
        <h3 style={{ margin: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-1)" }}>
          Invoice Summary
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-3)" }}>
          <SummaryTile label="Invoice Number">{invoice.invoice_number || "—"}</SummaryTile>
          <SummaryTile label="Invoice Date">{formatDate(invoice.invoice_date)}</SummaryTile>
          <SummaryTile label="Due Date">{formatDate(invoice.due_date)}</SummaryTile>
          <SummaryTile label="Invoice Total">{formatCurrency(invoiceTotal)}</SummaryTile>
          <SummaryTile label="Balance Due" tone={balanceDue > 0 ? "var(--danger-dark)" : "var(--success-dark)"}>
            {formatCurrency(balanceDue)}
          </SummaryTile>
          <SummaryTile label="Payment Status">{paymentStatusLabel}</SummaryTile>
        </div>
      </LayerSurface>

      {/* ── Per-request sections ─────────────────────────────────── */}
      {rows.length === 0 ? (
        <LayerSurface radius="var(--radius-sm)">
          <p style={{ margin: 0, color: "var(--text-1)" }}>No detailed requests recorded for this invoice yet.</p>
        </LayerSurface>
      ) : (
        rows.map((row) => (
          <RequestSection key={row.key} row={row} isProforma={isProforma} onOpenEditor={handleOpenEditor} />
        ))
      )}

      {isProforma && modal}

      {/* ── Notes + totals ───────────────────────────────────────── */}
      <LayerSurface radius="var(--radius-sm)" gap="var(--space-4)">
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <label htmlFor="invoice-notes" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-1)" }}>
            Invoice Notes
          </label>
          <textarea
            id="invoice-notes"
            className="app-input"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add notes to appear on this invoice…"
            style={{ resize: "vertical", minHeight: "72px" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            {notesStatus && (
              <span style={{ fontSize: "0.82rem", color: notesStatus === "Saved" ? "var(--success-dark)" : "var(--danger-dark)" }}>
                {notesStatus}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveNotes}
              disabled={notesSaving || !invoice.id || notes === (invoice.invoice_notes || "")}
              title={!invoice.id ? "Create the invoice before saving notes" : undefined}
            >
              {notesSaving ? "Saving…" : "Save Notes"}
            </Button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
          <SummaryTile label="Subtotal (ex VAT)">{formatCurrency(totals.service_total)}</SummaryTile>
          <SummaryTile label="VAT Total (20%)">{formatCurrency(totals.vat_total)}</SummaryTile>
          <SummaryTile label="Invoice Total (inc VAT)" tone="var(--accentText)">
            {formatCurrency(totals.invoice_total)}
          </SummaryTile>
        </div>
      </LayerSurface>

      {/* ── Make Payment popup (existing flow) ───────────────────── */}
      {!isProforma && !invoicePaid && (
        <InvoicePaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          invoice={invoice}
          customerEmail={customerEmail}
          onInvoiceActionComplete={async () => {
            await onDataRefresh?.({ silent: true });
          }}
          onPaymentCompleted={onPaymentCompleted}
          onReleaseRequested={onReleaseRequested}
        />
      )}

      {/* ── Preview Invoice (formatted/document layout) ──────────── */}
      <PopupModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        ariaLabel="Invoice preview"
        cardStyle={{
          width: "min(100%, 960px)",
          padding: "var(--section-card-padding)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--accentText)" }}>Invoice Preview</h2>
            <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "0.88rem" }}>
              {invoice.invoice_number || "—"}
              {isProforma ? " · Proforma" : ` · ${formatCurrency(invoiceTotal)}`}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <Button variant="secondary" size="sm" onClick={onPrint}>
              Print
            </Button>
            {!isProforma && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onEmail}
                disabled={!customerEmail || emailStatus === "Sending..."}
                title={customerEmail ? `Send to ${customerEmail}` : "No customer email on file"}
              >
                {emailStatus === "Sending..." ? "Sending..." : "Email"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </div>
        </header>
        <InvoiceDetail
          data={data}
          jobData={jobData}
          hideActions
          onPrint={onPrint}
          onEmail={onEmail}
          emailStatus={emailStatus}
          customerEmail={customerEmail}
          onDataRefresh={onDataRefresh}
          onDataPatch={onDataPatch}
          onPaymentCompleted={onPaymentCompleted}
          onReleaseRequested={onReleaseRequested}
        />
      </PopupModal>
    </>
  );
}
