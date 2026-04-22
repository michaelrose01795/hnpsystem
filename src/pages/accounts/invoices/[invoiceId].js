// file location: src/pages/accounts/invoices/[invoiceId].js
import React, { useEffect, useState } from "react"; // import React along with hooks for state/effects
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import InvoiceDetailPageUi from "@/components/page-ui/accounts/invoices/accounts-invoices-invoice-id-ui"; // Extracted presentation layer.
const DETAIL_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "SALES", "WORKSHOP", "WORKSHOP MANAGER", "PARTS", "PARTS MANAGER"];
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const statusBadgeStyles = {
  Paid: { background: "rgba(var(--success-rgb), 0.16)", color: "var(--success-text)" },
  Draft: { background: "rgba(var(--primary-rgb), 0.14)", color: "var(--primary-dark)" },
  Overdue: { background: "rgba(var(--warning-rgb), 0.18)", color: "var(--warning-text)" },
  Cancelled: { background: "rgba(var(--danger-rgb), 0.16)", color: "var(--danger-dark)" }
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
  const infoRow = (label, value) =>
  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(var(--primary-rgb), 0.08)" }}>
      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value || "—"}</span>
    </div>;

  return <InvoiceDetailPageUi view="section1" Button={Button} currencyFormatter={currencyFormatter} DETAIL_ROLES={DETAIL_ROLES} getAccountDisplayValue={getAccountDisplayValue} getCustomerDisplayValue={getCustomerDisplayValue} getDueDateDisplayValue={getDueDateDisplayValue} getInvoiceAmountValue={getInvoiceAmountValue} infoRow={infoRow} invoice={invoice} invoiceId={invoiceId} job={job} loading={loading} payments={payments} ProtectedRoute={ProtectedRoute} router={router} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} statusBadgeStyles={statusBadgeStyles} />;



























































































































}
