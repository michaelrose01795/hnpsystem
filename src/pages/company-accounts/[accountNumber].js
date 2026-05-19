// file location: src/pages/company-accounts/[accountNumber].js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import { prefetchJob } from "@/lib/swr/prefetch";
import CompanyAccountDetailPageUi from "@/components/page-ui/company-accounts/company-accounts-account-number-ui"; // Extracted presentation layer.

const ALLOWED_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];
const HISTORY_DEFAULT = { jobs: [], invoices: [] };
const ACCOUNT_TABS = [
{ id: "overview", label: "Overview" },
{ id: "billing", label: "Billing & Notes" },
{ id: "history", label: "History" }];


export default function CompanyAccountDetailPage() {
  const router = useRouter();
  const { accountNumber } = router.query;
  const { user } = useUser();
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("view");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(HISTORY_DEFAULT);
  const [activeTab, setActiveTab] = useState(ACCOUNT_TABS[0].id);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchAccount = useCallback(async () => {
    if (!accountNumber) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/company-accounts/${accountNumber}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load company account");
      }
      setAccount(payload.data);
      setHistory(payload.history || HISTORY_DEFAULT);
    } catch (err) {
      console.error("Failed to load company account", err);
      setError(err.message || "Unable to load company account");
    } finally {
      setLoading(false);
    }
  }, [accountNumber]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleUpdate = async (values) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/company-accounts/${accountNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to update company account");
      }
      setAccount(payload.data);
      setMode("view");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/company-accounts/${accountNumber}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json();
        throw new Error(payload?.message || "Unable to delete company account");
      }
      router.push("/company-accounts");
    } catch (err) {
      setError(err.message || "Unable to delete company account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setConfirmDialog({
      message: "Delete this company account? This action cannot be undone.",
      onConfirm: () => {
        setConfirmDialog(null);
        doDelete();
      }
    });
  };

  const detailRow = (label, value) => {
    if (!value) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>{label}</span>
        <strong>{value}</strong>
      </div>);

  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  // Tab content sits inside the page LayerSurface, so each section card is a
  // LayerTheme (--theme background) per the strict layer-alternation rule.
  const renderOverviewTab = () =>
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <LayerTheme
      sectionKey="company-account-detail-overview-contact"
      parentKey="company-account-detail-card"
      radius="var(--radius-sm)"
      padding="16px"
      gap="16px">

        <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px"
        }}>

          {detailRow("Primary contact", account.contact_name)}
          {detailRow("Email", account.contact_email)}
          {detailRow("Phone", account.contact_phone)}
          {detailRow("City", account.billing_city)}
          {detailRow("Postcode", account.billing_postcode)}
          {detailRow("Country", account.billing_country)}
        </div>
      </LayerTheme>
      {(account.billing_address_line1 || account.billing_address_line2) &&
    <LayerTheme
      sectionKey="company-account-detail-overview-address"
      parentKey="company-account-detail-card"
      radius="var(--radius-sm)"
      padding="16px"
      gap="6px">

          <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Billing Address</span>
          <div>
            {account.billing_address_line1 && <p style={{ margin: 0 }}>{account.billing_address_line1}</p>}
            {account.billing_address_line2 && <p style={{ margin: 0 }}>{account.billing_address_line2}</p>}
          </div>
        </LayerTheme>
    }
    </div>;


  const renderBillingTab = () => {
    const hasLinked = account.linked_account_label || account.linked_account_id;
    if (!account.notes && !hasLinked) {
      return (
        <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>
          No billing information or notes available.
        </p>);

    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {hasLinked &&
        <LayerTheme
          sectionKey="company-account-detail-billing-linked"
          parentKey="company-account-detail-card"
          radius="var(--radius-sm)"
          padding="16px"
          gap="6px">

            <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Linked Ledger Account</span>
            <strong>{account.linked_account_label || account.linked_account_id}</strong>
          </LayerTheme>
        }
        {account.notes &&
        <LayerTheme
          sectionKey="company-account-detail-billing-notes"
          parentKey="company-account-detail-card"
          radius="var(--radius-sm)"
          padding="16px"
          gap="6px">

            <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Notes</span>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{account.notes}</p>
          </LayerTheme>
        }
      </div>);

  };


  const renderHistoryTab = () => {
    const hasJobs = history.jobs && history.jobs.length > 0;
    const hasInvoices = history.invoices && history.invoices.length > 0;

    // Each row is a --theme card (LayerTheme) sitting inside the page
    // LayerSurface, so the surface/theme alternation holds. The wrapper div
    // owns the click handler + hover lift.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Jobs Section */}
        <div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "var(--text-1)" }}>Job Cards</h3>
          {hasJobs ?
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.jobs.map((job, index) =>
            <div
              key={job.id}
              onClick={() => router.push(`/job-cards/${job.job_number}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
                prefetchJob(job.job_number); // warm SWR cache on hover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.zIndex = "0";
              }}
              style={{
                cursor: "pointer",
                transition: "transform 0.2s ease"
              }}>

                  <LayerTheme
                sectionKey={`company-account-detail-job-${index}`}
                parentKey="company-account-detail-card"
                radius="var(--radius-sm)"
                padding="16px">

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "1rem" }}>Job #{job.job_number}</strong>
                        {job.status &&
                    <span className="app-badge app-badge--neutral app-badge--control">{job.status}</span>
                    }
                      </div>
                      {job.customer && <p style={{ margin: "4px 0", color: "var(--text-1)" }}>{job.customer}</p>}
                      {job.vehicle_reg &&
                  <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>
                          <strong>{job.vehicle_reg}</strong>
                          {job.vehicle_make_model && ` • ${job.vehicle_make_model}`}
                        </p>
                  }
                      {job.job_source &&
                  <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "var(--text-1)" }}>
                          Source: {job.job_source}
                        </p>
                  }
                    </div>
                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "var(--text-1)" }}>Created</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(job.created_at)}</p>
                      {job.completed_at &&
                  <>
                          <p style={{ margin: "8px 0 4px 0", fontSize: "0.85rem", color: "var(--text-1)" }}>Completed</p>
                          <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(job.completed_at)}</p>
                        </>
                  }
                    </div>
                  </div>
                  </LayerTheme>
                </div>
            )}
            </div> :

          <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>No job cards found for this account.</p>
          }
        </div>

        {/* Invoices Section */}
        <div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "var(--text-1)" }}>Invoices</h3>
          {hasInvoices ?
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.invoices.map((invoice, index) => {
              const status = invoice.payment_status;
              const statusTone = status === "Paid" ? "app-badge--success" : status === "Overdue" ? "app-badge--danger" : "app-badge--neutral";
              return (
                <div
                key={invoice.id}
                onClick={() => router.push(`/invoices/${invoice.invoice_number}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.zIndex = "0";
                }}
                style={{
                  cursor: "pointer",
                  transition: "transform 0.2s ease"
                }}>

                  <LayerTheme
                  sectionKey={`company-account-detail-invoice-${index}`}
                  parentKey="company-account-detail-card"
                  radius="var(--radius-sm)"
                  padding="16px">

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "1rem" }}>Invoice #{invoice.invoice_number}</strong>
                        {status &&
                    <span className={`app-badge app-badge--control ${statusTone}`}>{status}</span>
                    }
                      </div>
                      {invoice.invoice_to && <p style={{ margin: "4px 0", color: "var(--text-1)" }}>{invoice.invoice_to}</p>}
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "0.85rem", flexWrap: "wrap" }}>
                        {invoice.job_number && <span>Job: #{invoice.job_number}</span>}
                        {invoice.order_number && <span>Order: #{invoice.order_number}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      {invoice.invoice_total &&
                  <>
                          <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "var(--text-1)" }}>Total</p>
                          <p style={{ margin: "0 0 12px 0", fontSize: "1.2rem", fontWeight: 700, color: "var(--text-accent)" }}>
                            £{parseFloat(invoice.invoice_total).toFixed(2)}
                          </p>
                        </>
                  }
                      <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "var(--text-1)" }}>Invoice Date</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(invoice.invoice_date)}</p>
                      {invoice.due_date &&
                  <>
                          <p style={{ margin: "8px 0 4px 0", fontSize: "0.85rem", color: "var(--text-1)" }}>Due Date</p>
                          <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(invoice.due_date)}</p>
                        </>
                  }
                    </div>
                  </div>
                  </LayerTheme>
                </div>);

            })}
            </div> :

          <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>No invoices found for this account.</p>
          }
        </div>
      </div>);

  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "billing":
        return renderBillingTab();
      case "history":
        return renderHistoryTab();
      default:
        return renderOverviewTab();
    }
  };

  return <CompanyAccountDetailPageUi view="section1" account={account} ACCOUNT_TABS={ACCOUNT_TABS} activeTab={activeTab} ALLOWED_ROLES={ALLOWED_ROLES} CompanyAccountForm={CompanyAccountForm} ConfirmationDialog={ConfirmationDialog} confirmDialog={confirmDialog} error={error} fetchAccount={fetchAccount} handleDelete={handleDelete} handleUpdate={handleUpdate} loading={loading} mode={mode} permissions={permissions} ProtectedRoute={ProtectedRoute} renderTabContent={renderTabContent} router={router} saving={saving} setActiveTab={setActiveTab} setConfirmDialog={setConfirmDialog} setMode={setMode} />;









































































































































































































}
