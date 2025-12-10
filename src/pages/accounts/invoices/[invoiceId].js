// file location: src/pages/accounts/invoices/[invoiceId].js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React along with hooks for state/effects
import { useRouter } from "next/router"; // import router to access invoiceId param and navigation
import Layout from "@/components/Layout"; // import shared layout wrapper
import ProtectedRoute from "@/components/ProtectedRoute"; // import route guard for Keycloak roles
const DETAIL_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "SALES", "WORKSHOP", "WORKSHOP MANAGER", "PARTS", "PARTS MANAGER"]; // allowed roles for viewing invoice details
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }); // configure currency formatter for totals
export default function InvoiceDetailPage() { // component definition for invoice detail view
  const router = useRouter(); // instantiate router for navigation and param access
  const { invoiceId } = router.query; // extract invoice identifier from query params
  const [invoice, setInvoice] = useState(null); // state storing invoice record
  const [payments, setPayments] = useState([]); // state storing payment history rows
  const [job, setJob] = useState(null); // state storing linked job info
  const [loading, setLoading] = useState(true); // state tracking loading indicator
  useEffect(() => { // effect to fetch invoice data when invoiceId available
    if (!invoiceId) return; // guard until router query ready
    const controller = new AbortController(); // instantiate abort controller for cleanup
    const loadInvoice = async () => { // async loader function fetching invoice details
      setLoading(true); // show spinner while fetch occurs
      try { // try/catch to handle request failures
        const response = await fetch(`/api/invoices/${invoiceId}`, { signal: controller.signal }); // call invoice detail API endpoint
        const payload = await response.json(); // parse JSON payload
        if (!response.ok) { // handle HTTP errors
          throw new Error(payload?.message || "Failed to load invoice"); // throw descriptive error for catch block
        } // close guard
        setInvoice(payload.data || null); // store invoice record returned by server
        setPayments(payload.payments || []); // store payment history
        setJob(payload.job || null); // store linked job data
      } catch (error) { // catch fetch errors
        if (error.name === "AbortError") return; // ignore abort errors triggered by cleanup
        console.error("Failed to load invoice", error); // log genuine errors for debugging
      } finally { // cleanup block to run regardless of success or failure
        setLoading(false); // hide spinner after request resolves
      } // close finally block
    }; // close loadInvoice function
    loadInvoice(); // trigger fetch when effect runs
    return () => controller.abort(); // abort fetch when component unmounts or invoiceId changes
  }, [invoiceId]); // rerun effect when invoiceId param changes
  const infoRow = (label, value) => ( // helper returning a labeled info row
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}> // container with separator line
      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span> // label text styled with muted color
      <span style={{ fontWeight: 600 }}>{value || "—"}</span> // value text defaulting to em dash when missing
    </div>
  ); // close helper
  return ( // render invoice detail view structure
    <ProtectedRoute allowedRoles={DETAIL_ROLES}> // enforce allowed roles on this page
      <Layout> // wrap with layout for nav and chrome
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // column layout container for sections
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}> // header row containing title and actions
            <div> // title text container
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Invoice {invoiceId}</h1> // page title referencing invoice id
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Review invoice balances, payments, and linked job card.</p> // subtitle describing page purpose
            </div>
            <button type="button" onClick={() => router.push("/accounts/invoices")} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>All Invoices</button> // button navigating back to invoice list
          </div>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading invoice…</p>} // show loading text while fetch in progress
          {!loading && invoice && (
            <>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}> // invoice summary grid card
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Grand Total</p> // label for grand total value
                  <strong style={{ fontSize: "2rem", color: "var(--primary)" }}>{currencyFormatter.format(Number(invoice.grand_total || 0))}</strong> // display total formatted as currency
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Payment Status</p> // label for payment status
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>{invoice.payment_status}</span> // badge showing payment status
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Due Date</p> // due date label
                  <strong>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB") : "—"}</strong> // due date value formatted for display
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Account</p> // label for account id
                  <strong>{invoice.account_id || "—"}</strong> // account id value
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Customer</p> // label for customer id
                  <strong>{invoice.customer_id || "—"}</strong> // customer value
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Job</p> // label for job number
                  <strong>{invoice.job_number || "—"}</strong> // job number value
                </div>
              </section>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "8px" }}> // payment history section
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Payment History</h2> // section title
                {payments.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No payments recorded.</p>} // show empty message when no payments
                {payments.map((payment) => (
                  <div key={payment.payment_id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}> // row for each payment entry
                    <div>
                      <strong>{currencyFormatter.format(Number(payment.amount || 0))}</strong> // payment amount text
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{payment.method || payment.payment_method || "—"}</p> // payment method text
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("en-GB") : "—"}</p> // payment date text
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{payment.reference || "Manual"}</p> // payment reference text
                    </div>
                  </div>
                ))}
              </section>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "8px" }}> // linked job card section
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Linked Job Card</h2> // section title
                {job ? (
                  <>
                    {infoRow("Job Number", job.job_number)} // job number tuple row
                    {infoRow("Status", job.status)} // job status tuple row
                    {infoRow("Vehicle", job.vehicle || job.reg)} // job vehicle tuple row
                    {infoRow("Advisor", job.advisor || job.service_advisor)} // job advisor tuple row
                  </>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No job card linked.</p> // fallback when job not returned from API
                )}
              </section>
            </>
          )}
          {!loading && !invoice && <p style={{ color: "var(--danger)" }}>Invoice not found.</p>} // show message when invoice id invalid
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close render tree
} // close InvoiceDetailPage definition
