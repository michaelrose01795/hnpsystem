// file location: src/pages/company-accounts/index.js // top-level list for company accounts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import AccountTable from "@/components/accounts/AccountTable";
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
  const [activeTab, setActiveTab] = useState("companies");
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerPagination, setLedgerPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [ledgerSortState, setLedgerSortState] = useState({ field: "updated_at", direction: "desc" });
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState("");
  const [ledgerFeedback, setLedgerFeedback] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLedgerSearch(ledgerSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [ledgerSearch]);

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

  const fetchLedgerAccounts = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerFeedback("");
    try {
      const params = new URLSearchParams();
      params.set("page", ledgerPagination.page.toString());
      params.set("pageSize", ledgerPagination.pageSize.toString());
      params.set("sortField", ledgerSortState.field);
      params.set("sortDirection", ledgerSortState.direction);
      if (debouncedLedgerSearch) {
        params.set("search", debouncedLedgerSearch);
      }
      if (permissions.restrictedAccountTypes && permissions.restrictedAccountTypes.length > 0) {
        params.set("accountType", permissions.restrictedAccountTypes[0]);
      }
      const response = await fetch(`/api/accounts?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load ledger accounts");
      }
      setLedgerAccounts(payload.data || []);
      setLedgerPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total }));
      if (!payload.data?.length) {
        setLedgerFeedback(debouncedLedgerSearch ? "No ledger accounts match the search." : "No ledger accounts available.");
      }
    } catch (error) {
      console.error("Unable to fetch ledger accounts", error);
      setLedgerFeedback(error.message || "Unable to load ledger accounts");
    } finally {
      setLedgerLoading(false);
    }
  }, [
    debouncedLedgerSearch,
    ledgerPagination.page,
    ledgerPagination.pageSize,
    ledgerSortState.direction,
    ledgerSortState.field,
    permissions.restrictedAccountTypes,
  ]);

  useEffect(() => {
    if (activeTab !== "ledgers") return;
    fetchLedgerAccounts();
  }, [activeTab, fetchLedgerAccounts]);

  useEffect(() => {
    if (activeTab === "companies") return;
    if (showForm) setShowForm(false);
  }, [activeTab, showForm]);

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

  const handleLedgerAccountSelect = (account, action) => {
    if (!account) return;
    if (action === "edit") {
      router.push(`/accounts/edit/${account.account_id}`);
      return;
    }
    router.push(`/accounts/view/${account.account_id}`);
  };

  const tabs = useMemo(
    () => [
      { id: "companies", label: "Company accounts" },
      { id: "ledgers", label: "Ledgers" },
    ],
    []
  );

  const renderLedgerTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Search ledger accounts"
          value={ledgerSearch}
          onChange={(event) => setLedgerSearch(event.target.value)}
          style={{
            flex: "1 1 260px",
            padding: "10px 14px",
            borderRadius: "999px",
            border: "1px solid var(--surface-light)",
          }}
        />
      </div>
      {ledgerFeedback && !ledgerAccounts.length && !ledgerLoading && (
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{ledgerFeedback}</p>
      )}
      <AccountTable
        accounts={ledgerAccounts}
        loading={ledgerLoading}
        pagination={ledgerPagination}
        onPageChange={(nextPage) => setLedgerPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }))}
        sortState={ledgerSortState}
        onSortChange={setLedgerSortState}
        onSelectAccount={handleLedgerAccountSelect}
      />
    </div>
  );

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
              gap: "10px",
              padding: "18px",
              borderRadius: "18px",
              border: "1px solid var(--surface-light)",
              background: "white",
              textAlign: "left",
              boxShadow: "0 6px 18px rgba(25, 25, 38, 0.08)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  {account.company_name || "Unnamed company"}
                </p>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>{account.trading_name || "—"}</p>
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: "var(--primary-dark)",
                    background: "var(--primary-tint, rgba(101, 44, 245, 0.08))",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontSize: "0.85rem",
                  }}
                >
                  #{account.account_number}
                </span>
                {(account.linked_account_label || account.linked_account_id) && (
                  <span style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    Ledger · {account.linked_account_label || account.linked_account_id}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {account.contact_name && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                    padding: "6px 12px",
                    background: "var(--surface-light)",
                    borderRadius: "999px",
                  }}
                >
                  Contact · {account.contact_name}
                </span>
              )}
              {account.contact_email && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                    padding: "6px 12px",
                    background: "var(--surface-light)",
                    borderRadius: "999px",
                  }}
                >
                  {account.contact_email}
                </span>
              )}
              {account.contact_phone && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                    padding: "6px 12px",
                    background: "var(--surface-light)",
                    borderRadius: "999px",
                  }}
                >
                  {account.contact_phone}
                </span>
              )}
              {account.billing_city && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                    padding: "6px 12px",
                    background: "var(--surface-light)",
                    borderRadius: "999px",
                  }}
                >
                  {account.billing_city}
                </span>
              )}
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
          <div
            style={{
              borderRadius: "999px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
              padding: "6px",
              display: "flex",
              gap: "6px",
              width: "100%",
              overflowX: "auto",
              flexShrink: 0,
              scrollbarWidth: "thin",
              scrollbarColor: "var(--scrollbar-thumb) transparent",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {tabs.map((tab) => {
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
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {activeTab === "companies" ? (
            <>
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
            </>
          ) : (
            renderLedgerTab()
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
