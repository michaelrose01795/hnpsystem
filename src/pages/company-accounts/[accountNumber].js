// file location: src/pages/company-accounts/[accountNumber].js // detail view for company accounts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";

const ALLOWED_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];

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
              background: "transparent",
            }}
          >
            ← All company accounts
          </button>
          {loading ? (
            <p>Loading account…</p>
          ) : error ? (
            <p style={{ color: "var(--danger, #b45309)" }}>{error}</p>
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
                background: "white",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                <div>
                  <h1 style={{ margin: 0 }}>{account.company_name}</h1>
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>{account.trading_name}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>#{account.account_number}</p>
                  {(account.linked_account_label || account.linked_account_id) && (
                    <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                      Ledger account: {account.linked_account_label || account.linked_account_id}
                    </p>
                  )}
                </div>
              </div>
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
              {account.notes && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Notes</span>
                  <p style={{ margin: 0 }}>{account.notes}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                {permissions.canEditAccount && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "10px",
                        border: "1px solid var(--surface-light)",
                        background: "transparent",
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
                        background: "var(--danger, #b91c1c)",
                        color: "white",
                      }}
                    >
                      Delete
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
