// file location: src/pages/accounts/invoices/[invoiceId].js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React along with hooks for state/effects
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
const DETAIL_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "SALES", "WORKSHOP", "WORKSHOP MANAGER", "PARTS", "PARTS MANAGER"];
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
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
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value || "—"}</span>
    </div>
  );
  return (
    <ProtectedRoute allowedRoles={DETAIL_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Invoice {invoiceId}</h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Review invoice balances, payments, and linked job card.</p>
            </div>
            <button type="button" onClick={() => router.push("/accounts/invoices")} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>All Invoices</button>
          </div>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading invoice…</p>}
          {!loading && invoice && (
            <>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Grand Total</p>
                  <strong style={{ fontSize: "2rem", color: "var(--primary)" }}>{currencyFormatter.format(Number(invoice.grand_total || 0))}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Payment Status</p>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>{invoice.payment_status}</span>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Due Date</p>
                  <strong>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB") : "—"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Account</p>
                  <strong>{invoice.account_id || "—"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Customer</p>
                  <strong>{invoice.customer_id || "—"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Job</p>
                  <strong>{invoice.job_number || "—"}</strong>
                </div>
              </section>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Payment History</h2>
                {payments.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No payments recorded.</p>}
                {payments.map((payment) => (
                  <div key={payment.payment_id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <div>
                      <strong>{currencyFormatter.format(Number(payment.amount || 0))}</strong>
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{payment.method || payment.payment_method || "—"}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("en-GB") : "—"}</p>
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{payment.reference || "Manual"}</p>
                    </div>
                  </div>
                ))}
              </section>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Linked Job Card</h2>
                {job ? (
                  <>
                    {infoRow("Job Number", job.job_number)}
                    {infoRow("Status", job.status)}
                    {infoRow("Vehicle", job.vehicle || job.reg)}
                    {infoRow("Advisor", job.advisor || job.service_advisor)}
                  </>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No job card linked.</p>
                )}
              </section>
            </>
          )}
          {!loading && !invoice && <p style={{ color: "var(--danger)" }}>Invoice not found.</p>}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
