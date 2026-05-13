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
  Paid: { background: "var(--success-base)", color: "var(--text-2)" },
  Draft: { background: "var(--primary-selected)", color: "var(--text-2)" },
  Overdue: { background: "var(--warning-base)", color: "var(--text-2)" },
  Cancelled: { background: "var(--danger-base)", color: "var(--text-2)" }
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
  // Only flipped true when the API explicitly responds 404 — never on transient
  // states (router hydration, in-flight fetch, network error) so the skeleton
  // stays visible until we have a definitive answer.
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    if (!invoiceId) return;
    setNotFound(false);
    const controller = new AbortController();
    const loadInvoice = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setInvoice(null);
          setPayments([]);
          setJob(null);
          setNotFound(true);
          return;
        }
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

  // Canonicalize URL: if we loaded an invoice and the URL segment isn't the
  // human-readable invoice_number, swap it in without a history entry.
  useEffect(() => {
    if (!invoice?.invoice_number) return;
    const currentSegment = decodeURIComponent(String(invoiceId || "")).trim();
    if (currentSegment && currentSegment !== invoice.invoice_number) {
      router.replace(`/accounts/invoices/${encodeURIComponent(invoice.invoice_number)}`, undefined, {
        shallow: true,
      });
    }
  }, [invoice, invoiceId, router]);

  const infoRow = (label, value) =>
  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "var(--separating-line)" }}>
      <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{value || "—"}</span>
    </div>;

  return <InvoiceDetailPageUi view="section1" Button={Button} currencyFormatter={currencyFormatter} DETAIL_ROLES={DETAIL_ROLES} getAccountDisplayValue={getAccountDisplayValue} getCustomerDisplayValue={getCustomerDisplayValue} getDueDateDisplayValue={getDueDateDisplayValue} getInvoiceAmountValue={getInvoiceAmountValue} infoRow={infoRow} invoice={invoice} invoiceId={invoiceId} job={job} loading={loading} payments={payments} ProtectedRoute={ProtectedRoute} router={router} notFound={notFound} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} statusBadgeStyles={statusBadgeStyles} />;



























































































































}
