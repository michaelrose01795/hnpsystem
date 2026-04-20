// file location: src/pages/company-accounts/index.js // top-level list for company accounts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import AccountTable from "@/components/accounts/AccountTable";
import Button from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

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
    <DevLayoutSection
      as="section"
      sectionKey="company-accounts-ledger-panel"
      sectionType="content-card"
      parentKey="company-accounts-page-shell"
      className="app-section-card"
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <DevLayoutSection sectionKey="company-accounts-ledger-toolbar" sectionType="filter-row" parentKey="company-accounts-ledger-panel">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <SearchBar
            placeholder="Search ledger accounts"
            value={ledgerSearch}
            onChange={(event) => setLedgerSearch(event.target.value)}
            onClear={() => setLedgerSearch("")}
            style={{
              flex: "1 1 260px",
            }}
          />
        </div>
      </DevLayoutSection>
      {ledgerFeedback && !ledgerAccounts.length && !ledgerLoading && (
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{ledgerFeedback}</p>
      )}
      <DevLayoutSection sectionKey="company-accounts-ledger-table" sectionType="data-table" parentKey="company-accounts-ledger-panel">
        <AccountTable
          accounts={ledgerAccounts}
          loading={ledgerLoading}
          pagination={ledgerPagination}
          onPageChange={(nextPage) => setLedgerPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }))}
          sortState={ledgerSortState}
          onSortChange={setLedgerSortState}
          onSelectAccount={handleLedgerAccountSelect}
        />
      </DevLayoutSection>
    </DevLayoutSection>
  );

  const renderList = () => {
    if (loading) {
      // Skeleton list mirrors the real accounts list layout below (button-shaped
      // rows inside the same section-card container) so the first visible frame
      // already matches the final structure.
      return (
        <DevLayoutSection sectionKey="company-accounts-company-list" sectionType="content-card" parentKey="company-accounts-page-shell">
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            role="status"
            aria-live="polite"
            aria-label="Loading company accounts"
          >
            <SkeletonKeyframes />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} width="100%" height="54px" borderRadius="var(--radius-md,12px)" />
            ))}
          </div>
        </DevLayoutSection>
      );
    }
    if (!accounts.length) {
      return <p>{feedback || "No company accounts to display."}</p>;
    }
    return (
      <DevLayoutSection sectionKey="company-accounts-company-list" sectionType="content-card" parentKey="company-accounts-page-shell">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {accounts.map((account) => (
          <DevLayoutSection
            key={account.account_number}
            as="button"
            sectionKey={`company-accounts-company-card-${String(account.account_number || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            sectionType="content-card"
            parentKey="company-accounts-company-list"
            type="button"
            className="company-accounts-row"
            onClick={() => router.push(`/company-accounts/${account.account_number}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--surface)",
              textAlign: "left",
              width: "100%",
              boxShadow: "none",
              transition: "background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: "1 1 260px", minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                  {account.company_name || "Unnamed company"}
                </p>
                {account.trading_name && account.trading_name !== account.company_name && (
                  <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill">
                    {account.trading_name}
                  </span>
                )}
                {account.contact_name && (
                  <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill">
                    Contact · {account.contact_name}
                  </span>
                )}
                {account.contact_email && (
                  <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill">
                    {account.contact_email}
                  </span>
                )}
                {account.contact_phone && (
                  <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill">
                    {account.contact_phone}
                  </span>
                )}
                {account.billing_city && (
                  <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill">
                    {account.billing_city}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginLeft: "auto" }}>
                <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill company-accounts-account-pill">
                  #{account.account_number}
                </span>
                {(account.linked_account_label || account.linked_account_id) && (
                  <span className="app-btn app-btn--secondary app-btn--xs app-btn--pill company-accounts-meta-pill">
                    Ledger · {account.linked_account_label || account.linked_account_id}
                  </span>
                )}
              </div>
            </div>
          </DevLayoutSection>
        ))}
        </div>
      </DevLayoutSection>
    );
  };

  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <>
        <DevLayoutSection sectionKey="company-accounts-page-shell" sectionType="page-shell" shell>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <DevLayoutSection sectionKey="company-accounts-page-header" sectionType="content-card" parentKey="company-accounts-page-shell">
            <div>
            <h1 style={{ margin: 0 }}>Company Accounts</h1>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>Central directory of partner businesses linked to accounts.</p>
            </div>
          </DevLayoutSection>
          <DevLayoutSection sectionKey="company-accounts-tab-row" sectionType="tab-row" parentKey="company-accounts-page-shell">
            <div
            className="app-layout-tab-row"
            style={{
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
                <DevLayoutSection
                  key={tab.id}
                  as="button"
                  sectionKey={`company-accounts-tab-${tab.id}`}
                  sectionType="tab-chip"
                  parentKey="company-accounts-tab-row"
                  className={`app-btn ${isActive ? "app-btn--primary" : "app-btn--secondary"} app-btn--pill app-btn--sm`}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: "0 0 auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </DevLayoutSection>
              );
            })}
            </div>
          </DevLayoutSection>
          {activeTab === "companies" ? (
            <>
              {showForm && permissions.canCreateAccount && (
                <DevLayoutSection sectionKey="company-accounts-form-back-link" sectionType="toolbar" parentKey="company-accounts-page-shell">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowForm(false)}
                    style={{ alignSelf: "flex-start" }}
                  >
                    Back to company list
                  </Button>
                </DevLayoutSection>
              )}
              {showForm ? (
                <CompanyAccountForm
                  parentSectionKey="company-accounts-page-shell"
                  sectionKey="company-accounts-company-form"
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
                  <DevLayoutSection sectionKey="company-accounts-company-toolbar" sectionType="filter-row" parentKey="company-accounts-page-shell">
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                      <SearchBar
                        placeholder="Search companies A-Z"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onClear={() => setSearch("")}
                        style={{
                          flex: "1 1 260px",
                        }}
                      />
                      {permissions.canCreateAccount && (
                        <DevLayoutSection sectionKey="company-accounts-add-account-button" sectionType="floating-action" parentKey="company-accounts-company-toolbar">
                          <Button
                            type="button"
                            variant="primary"
                            pill
                            onClick={() => setShowForm(true)}
                            style={{
                              flex: "0 0 auto",
                            }}
                          >
                            Add new account
                          </Button>
                        </DevLayoutSection>
                      )}
                    </div>
                  </DevLayoutSection>
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
        </DevLayoutSection>
        <style jsx>{`
          .company-accounts-row:hover,
          .company-accounts-row:focus-visible {
            background: rgba(var(--primary-rgb), 0.1) !important;
            box-shadow: inset 0 0 0 1px rgba(var(--primary-rgb), 0.16);
            outline: none;
          }

          .company-accounts-meta-pill {
            pointer-events: none;
            max-width: 100%;
            color: var(--primary);
            background: var(--control-bg);
          }

          .company-accounts-account-pill {
            font-weight: 700;
          }

          @media (max-width: 900px) {
            .company-accounts-row {
              align-items: flex-start !important;
            }
          }
        `}</style>
      </>
    </ProtectedRoute>
  );
}
