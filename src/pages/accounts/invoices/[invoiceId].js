// file location: src/pages/accounts/invoices/[invoiceId].js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React along with hooks for state/effects
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
const DETAIL_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "SALES", "WORKSHOP", "WORKSHOP MANAGER", "PARTS", "PARTS MANAGER"];
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const statusBadgeStyles = {
  Paid: { background: "rgba(var(--success-rgb), 0.16)", color: "var(--success-text)" },
  Draft: { background: "rgba(var(--primary-rgb), 0.14)", color: "var(--primary-dark)" },
  Overdue: { background: "rgba(var(--warning-rgb), 0.18)", color: "var(--warning-text)" },
  Cancelled: { background: "rgba(var(--danger-rgb), 0.16)", color: "var(--danger-dark)" },
};

const getInvoiceAmountValue = (invoice) =>
  Number(
    invoice?.invoice_total ??
    invoice?.grand_total ??
    invoice?.total ??
    0
  );

const getAccountDisplayValue = (invoice) =>
  invoice?.account?.billing_name ||
  invoice?.account_number ||
  invoice?.account?.account_id ||
  invoice?.account_id ||
  "—";

const getCustomerDisplayValue = (invoice) => {
  const invoiceToName = typeof invoice?.invoice_to?.name === "string" ? invoice.invoice_to.name.trim() : "";
  if (invoiceToName) return invoiceToName;

  const customerName = typeof invoice?.customer_name === "string" ? invoice.customer_name.trim() : "";
  if (customerName) return customerName;

  const linkedCustomerName =
    invoice?.customer?.name ||
    [invoice?.customer?.firstname, invoice?.customer?.lastname].filter(Boolean).join(" ").trim();
  if (linkedCustomerName) return linkedCustomerName;

  return invoice?.customer_id || "—";
};

const getDueDateDisplayValue = (invoice) => {
  const explicitDueDate = invoice?.due_date ? new Date(invoice.due_date) : null;
  if (explicitDueDate && !Number.isNaN(explicitDueDate.getTime())) {
    return explicitDueDate.toLocaleDateString("en-GB");
  }

  const invoiceDate = invoice?.invoice_date ? new Date(invoice.invoice_date) : null;
  if (!invoiceDate || Number.isNaN(invoiceDate.getTime())) return "—";

  const creditTerms = Number(invoice?.account?.credit_terms || 30) || 30;
  invoiceDate.setDate(invoiceDate.getDate() + creditTerms);
  return invoiceDate.toLocaleDateString("en-GB");
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { invoiceId } = router.query;
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!invoiceId) return;
    const controller = new AbortController();
    const loadInvoice = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load invoice");
        }
        setInvoice(payload.data || null);
        setPayments(payload.payments || []);
        setJob(payload.job || null);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Failed to load invoice", error);
      } finally {
        setLoading(false);
      }
    };
    loadInvoice();
    return () => controller.abort();
  }, [invoiceId]);
  const infoRow = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(var(--primary-rgb), 0.08)" }}>
      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value || "—"}</span>
    </div>
  );
  return (
    <ProtectedRoute allowedRoles={DETAIL_ROLES}>
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="app-section-card" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "12px", alignItems: "start", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--text-primary)" }}>Invoice {invoice?.invoice_number || invoiceId}</h1>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => router.push("/accounts/invoices")}>All Invoices</Button>
            </div>
          </section>
          {loading && (
            <>
              <SkeletonKeyframes />
              <section
                className="app-section-card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  background: "rgba(var(--primary-rgb), 0.08)",
                  border: "1px solid rgba(var(--primary-rgb), 0.16)",
                }}
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--surface)",
                      borderRadius: "var(--control-radius)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <SkeletonBlock width="50%" height="10px" />
                    <SkeletonBlock width="70%" height="24px" />
                    <SkeletonBlock width="40%" height="10px" />
                  </div>
                ))}
              </section>
              <section
                className="app-section-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "rgba(var(--primary-rgb), 0.08)",
                  border: "1px solid rgba(var(--primary-rgb), 0.16)",
                }}
              >
                <SkeletonBlock width="20%" height="16px" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBlock key={i} width={i % 2 === 0 ? "100%" : "88%"} height="14px" />
                ))}
              </section>
            </>
          )}
          {!loading && invoice && (
            <>
              <section className="app-section-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
                <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Grand Total</p>
                  <strong style={{ display: "block", marginTop: "10px", fontSize: "1.8rem", color: "var(--text-primary)" }}>{currencyFormatter.format(getInvoiceAmountValue(invoice))}</strong>
                </div>
                <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Payment Status</p>
                  <span style={{ display: "inline-flex", alignItems: "center", marginTop: "10px", padding: "4px 12px", borderRadius: "var(--radius-pill)", fontWeight: 600, ...(statusBadgeStyles[invoice.payment_status] || { background: "rgba(var(--primary-rgb), 0.14)", color: "var(--primary-dark)" }) }}>{invoice.payment_status || "Draft"}</span>
                </div>
                <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Due Date</p>
                  <strong style={{ display: "block", marginTop: "10px", color: "var(--text-primary)" }}>{getDueDateDisplayValue(invoice)}</strong>
                </div>
                <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Account</p>
                  <strong style={{ display: "block", marginTop: "10px", color: "var(--text-primary)" }}>{getAccountDisplayValue(invoice)}</strong>
                </div>
                <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Customer</p>
                  <strong style={{ display: "block", marginTop: "10px", color: "var(--text-primary)" }}>{getCustomerDisplayValue(invoice)}</strong>
                </div>
                <div style={{ background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "16px" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Job</p>
                  <strong style={{ display: "block", marginTop: "10px", color: "var(--text-primary)" }}>{invoice.job_number || "—"}</strong>
                </div>
              </section>
              <section className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
                <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.25rem" }}>Payment History</h2>
                {payments.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No payments recorded.</p>}
                {payments.map((payment) => (
                  <div key={payment.payment_id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", background: "var(--surface)" }}>
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>{currencyFormatter.format(Number(payment.amount || 0))}</strong>
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{payment.method || payment.payment_method || "—"}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("en-GB") : "—"}</p>
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{payment.reference || "Manual"}</p>
                    </div>
                  </div>
                ))}
              </section>
              <section className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
                <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.25rem" }}>Linked Job Card</h2>
                {job ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "var(--surface)", borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", padding: "4px 16px" }}>
                    {infoRow("Job Number", job.job_number)}
                    {infoRow("Status", job.status)}
                    {infoRow("Vehicle", job.vehicle || job.reg)}
                    {infoRow("Advisor", job.advisor || job.service_advisor)}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No job card linked.</p>
                )}
              </section>
            </>
          )}
          {!loading && !invoice && <p style={{ color: "var(--danger)" }}>Invoice not found.</p>}
        </div>
      </>
    </ProtectedRoute>
  );
}
