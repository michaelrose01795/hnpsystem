// file location: src/pages/company-accounts/index.js // top-level list for company accounts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";

const ALLOWED_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];

export default function CompanyAccountsIndexPage() {
  const router = useRouter();
  const { user } = useUser();
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setFeedback("");
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      const query = params.toString();
      const response = await fetch(`/api/company-accounts${query ? `?${query}` : ""}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load company accounts");
      }
      setAccounts(payload.data || []);
      if (!payload.data?.length) {
        setFeedback(debouncedSearch ? "No company accounts match the search." : "No company accounts have been created yet.");
      }
    } catch (error) {
      console.error("Unable to fetch company accounts", error);
      setFeedback(error.message || "Unable to load company accounts");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (values) => {
    setSaving(true);
    try {
      const response = await fetch("/api/company-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to create company account");
      }
      setShowForm(false);
      setSearch("");
      return payload.data;
    } finally {
      setSaving(false);
    }
  };

  const renderList = () => {
    if (loading) {
      return <p>Loading company accounts…</p>;
    }
    if (!accounts.length) {
      return <p>{feedback || "No company accounts to display."}</p>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {accounts.map((account) => (
          <button
            key={account.account_number}
            type="button"
            onClick={() => router.push(`/company-accounts/${account.account_number}`)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "6px",
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid var(--surface-light)",
              background: "white",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{account.company_name || "Unnamed company"}</p>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>{account.trading_name}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>#{account.account_number}</p>
                {account.linked_account_id && <p style={{ margin: 0, color: "var(--text-secondary)" }}>Ledger: {account.linked_account_id}</p>}
              </div>
            </div>
            <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              {account.contact_name && <span>Contact: {account.contact_name}</span>}
              {account.contact_email && <span>Email: {account.contact_email}</span>}
              {account.contact_phone && <span>Phone: {account.contact_phone}</span>}
              {account.billing_city && <span>City: {account.billing_city}</span>}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h1 style={{ margin: 0 }}>Company Accounts</h1>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>Central directory of partner businesses linked to accounts.</p>
          </div>
          {showForm && permissions.canCreateAccount && (
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                alignSelf: "flex-start",
                padding: "10px 18px",
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                background: "transparent",
                fontWeight: 600,
              }}
            >
              Back to company list
            </button>
          )}
          {showForm ? (
            <CompanyAccountForm
              autoGenerateAccountNumber
              isSubmitting={saving}
              onSubmit={async (values) => {
                await handleCreate(values);
                fetchAccounts();
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="search"
                  placeholder="Search companies A-Z"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={{
                    flex: "1 1 260px",
                    padding: "10px 14px",
                    borderRadius: "999px",
                    border: "1px solid var(--surface-light)",
                  }}
                />
                {permissions.canCreateAccount && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    style={{
                      flex: "0 0 auto",
                      padding: "10px 18px",
                      borderRadius: "999px",
                      border: "none",
                      background: "var(--primary)",
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    Add new account
                  </button>
                )}
              </div>
              {feedback && !accounts.length && !loading && (
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>{feedback}</p>
              )}
              {renderList()}
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
