// file location: src/pages/company-accounts/[accountNumber].js // detail view for company accounts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";

const ALLOWED_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];
const HISTORY_DEFAULT = { jobs: [], invoices: [] };
const ACCOUNT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing & Notes" },
  { id: "history", label: "History" },
];

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
        body: JSON.stringify(values),
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

  const handleDelete = async () => {
    if (!window.confirm("Delete this company account? This action cannot be undone.")) return;
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

  const detailRow = (label, value) => {
    if (!value) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const renderOverviewTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {detailRow("Primary contact", account.contact_name)}
        {detailRow("Email", account.contact_email)}
        {detailRow("Phone", account.contact_phone)}
        {detailRow("City", account.billing_city)}
        {detailRow("Postcode", account.billing_postcode)}
        {detailRow("Country", account.billing_country)}
      </div>
      {(account.billing_address_line1 || account.billing_address_line2) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Billing Address</span>
          <div>
            {account.billing_address_line1 && <p style={{ margin: 0 }}>{account.billing_address_line1}</p>}
            {account.billing_address_line2 && <p style={{ margin: 0 }}>{account.billing_address_line2}</p>}
          </div>
        </div>
      )}
    </div>
  );

  const renderBillingTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {(account.linked_account_label || account.linked_account_id) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Linked Ledger Account</span>
          <strong>{account.linked_account_label || account.linked_account_id}</strong>
        </div>
      )}
      {account.notes && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Notes</span>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{account.notes}</p>
        </div>
      )}
      {!account.notes && !(account.linked_account_label || account.linked_account_id) && (
        <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No billing information or notes available.</p>
      )}
    </div>
  );

  const renderHistoryTab = () => {
    const hasJobs = history.jobs && history.jobs.length > 0;
    const hasInvoices = history.invoices && history.invoices.length > 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Jobs Section */}
        <div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Job Cards</h3>
          {hasJobs ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => router.push(`/job-cards/${job.job_number}`)}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--surface-light)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "1rem" }}>Job #{job.job_number}</strong>
                        {job.status && (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "var(--surface-light)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {job.status}
                          </span>
                        )}
                      </div>
                      {job.customer && <p style={{ margin: "4px 0", color: "var(--text-secondary)" }}>{job.customer}</p>}
                      {job.vehicle_reg && (
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>
                          <strong>{job.vehicle_reg}</strong>
                          {job.vehicle_make_model && ` • ${job.vehicle_make_model}`}
                        </p>
                      )}
                      {job.job_source && (
                        <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          Source: {job.job_source}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Created</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(job.created_at)}</p>
                      {job.completed_at && (
                        <>
                          <p style={{ margin: "8px 0 4px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Completed</p>
                          <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(job.completed_at)}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No job cards found for this account.</p>
          )}
        </div>

        {/* Invoices Section */}
        <div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Invoices</h3>
          {hasInvoices ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => router.push(`/invoices/${invoice.invoice_number}`)}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--surface-light)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "1rem" }}>Invoice #{invoice.invoice_number}</strong>
                        {invoice.payment_status && (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background:
                                invoice.payment_status === "Paid"
                                  ? "var(--success-surface)"
                                  : invoice.payment_status === "Overdue"
                                  ? "var(--danger-surface)"
                                  : "var(--surface-light)",
                              color:
                                invoice.payment_status === "Paid"
                                  ? "var(--success)"
                                  : invoice.payment_status === "Overdue"
                                  ? "var(--danger)"
                                  : "var(--text-primary)",
                            }}
                          >
                            {invoice.payment_status}
                          </span>
                        )}
                      </div>
                      {invoice.invoice_to && <p style={{ margin: "4px 0", color: "var(--text-secondary)" }}>{invoice.invoice_to}</p>}
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "0.85rem" }}>
                        {invoice.job_number && <span>Job: #{invoice.job_number}</span>}
                        {invoice.order_number && <span>Order: #{invoice.order_number}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      {invoice.invoice_total && (
                        <>
                          <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total</p>
                          <p style={{ margin: "0 0 12px 0", fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)" }}>
                            £{parseFloat(invoice.invoice_total).toFixed(2)}
                          </p>
                        </>
                      )}
                      <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Invoice Date</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(invoice.invoice_date)}</p>
                      {invoice.due_date && (
                        <>
                          <p style={{ margin: "8px 0 4px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Due Date</p>
                          <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(invoice.due_date)}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No invoices found for this account.</p>
          )}
        </div>
      </div>
    );
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

  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <button
            type="button"
            onClick={() => router.push("/company-accounts")}
            style={{
              alignSelf: "flex-start",
              padding: "8px 14px",
              borderRadius: "999px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
            }}
          >
            ← All company accounts
          </button>
          {loading ? (
            <p>Loading account…</p>
          ) : error ? (
            <p style={{ color: "var(--danger)" }}>{error}</p>
          ) : !account ? (
            <p>Company account not found.</p>
          ) : mode === "edit" ? (
            <CompanyAccountForm
              initialValues={account}
              isSubmitting={saving}
              onSubmit={async (values) => {
                await handleUpdate(values);
                fetchAccount();
              }}
              onCancel={() => setMode("view")}
            />
          ) : (
            <div
              style={{
                padding: "24px",
                borderRadius: "16px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Header Section */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, color: "var(--text-primary)" }}>{account.company_name}</h1>
                  {account.trading_name && (
                    <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>{account.trading_name}</p>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "1.1rem", color: "var(--text-primary)" }}>
                    #{account.account_number}
                  </p>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  borderBottom: "1px solid var(--surface-light)",
                  paddingBottom: "8px",
                  overflowX: "auto",
                }}
                className="tabs-scroll-container"
              >
                {ACCOUNT_TABS.map((tab) => {
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        flex: "0 0 auto",
                        borderRadius: "999px",
                        border: "1px solid transparent",
                        padding: "10px 20px",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: isActive ? "var(--primary)" : "transparent",
                        color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "var(--surface-light)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div style={{ minHeight: "200px" }}>{renderTabContent()}</div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--surface-light)",
                }}
              >
                {permissions.canEditAccount && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "10px",
                        border: "1px solid var(--surface-light)",
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--surface-light)";
                        e.currentTarget.style.borderColor = "var(--primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--surface)";
                        e.currentTarget.style.borderColor = "var(--surface-light)";
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "10px",
                        border: "none",
                        background: saving ? "var(--surface-muted)" : "var(--danger)",
                        color: "var(--text-inverse)",
                        cursor: saving ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                        opacity: saving ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!saving) {
                          e.currentTarget.style.background = "var(--danger-dark)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!saving) {
                          e.currentTarget.style.background = "var(--danger)";
                        }
                      }}
                    >
                      {saving ? "Deleting…" : "Delete"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
