// file location: src/pages/company-accounts/index.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import CompanyAccountForm from "@/components/companyAccounts/CompanyAccountForm";
import AccountTable from "@/components/accounts/AccountTable";
import Button from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup"; // canonical staffglobal .tab-api tab system
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import CompanyAccountsIndexPageUi from "@/components/page-ui/company-accounts/company-accounts-ui"; // Extracted presentation layer.

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
  permissions.restrictedAccountTypes]
  );

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
        body: JSON.stringify(values)
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
    { id: "ledgers", label: "Ledgers" }],

    []
  );

  const renderLedgerTab = () =>
  <LayerSurface
    as="section"
    sectionKey="company-accounts-ledger-panel"
    sectionType="content-card"
    parentKey="company-accounts-page-shell"
    gap="16px">

      <DevLayoutSection sectionKey="company-accounts-ledger-toolbar" sectionType="filter-row" parentKey="company-accounts-ledger-panel">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <SearchBar
          placeholder="Search ledger accounts"
          value={ledgerSearch}
          onChange={(event) => setLedgerSearch(event.target.value)}
          onClear={() => setLedgerSearch("")}
          style={{
            flex: "1 1 260px"
          }} />

        </div>
      </DevLayoutSection>
      {ledgerFeedback && !ledgerAccounts.length && !ledgerLoading &&
    <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>{ledgerFeedback}</p>
    }
      <DevLayoutSection sectionKey="company-accounts-ledger-table" sectionType="data-table" parentKey="company-accounts-ledger-panel">
        <AccountTable
        accounts={ledgerAccounts}
        loading={ledgerLoading}
        pagination={ledgerPagination}
        onPageChange={(nextPage) => setLedgerPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }))}
        sortState={ledgerSortState}
        onSortChange={setLedgerSortState}
        onSelectAccount={handleLedgerAccountSelect} />

      </DevLayoutSection>
    </LayerSurface>;


  const renderList = () => {
    if (loading) {
      // Skeleton list mirrors the real accounts list layout below (button-shaped
      // rows inside the same section-card container) so the first visible frame
      // already matches the final structure.
      return (
        <LayerTheme sectionKey="company-accounts-company-list" sectionType="content-card" parentKey="company-accounts-page-shell">
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            role="status"
            aria-live="polite"
            aria-label="Loading company accounts">

            <SkeletonKeyframes />
            {Array.from({ length: 5 }).map((_, i) =>
            <SkeletonBlock key={i} width="100%" height="54px" borderRadius="var(--radius-md,12px)" />
            )}
          </div>
        </LayerTheme>);

    }
    if (!accounts.length) {
      return (
        <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>
          {feedback || "No company accounts to display."}
        </p>
      );
    }
    return (
      <LayerTheme sectionKey="company-accounts-company-list" sectionType="content-card" parentKey="company-accounts-page-shell">
        <div className="app-table-shell-scroll">
          <table className="app-data-table app-table-shell app-table-shell--with-headings">
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Account #</th>
                <th>Company</th>
                <th>Trading name</th>
                <th>Contact</th>
                <th>Email</th>
                <th style={{ whiteSpace: "nowrap" }}>Phone</th>
                <th>City</th>
                <th>Ledger</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) =>
                <tr
                  key={account.account_number}
                  onClick={() => router.push(`/company-accounts/${account.account_number}`)}
                  style={{ cursor: "pointer" }}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>#{account.account_number}</td>
                  <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{account.company_name || "Unnamed company"}</td>
                  <td>{account.trading_name && account.trading_name !== account.company_name ? account.trading_name : "—"}</td>
                  <td>{account.contact_name || "—"}</td>
                  <td>{account.contact_email || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{account.contact_phone || "—"}</td>
                  <td>{account.billing_city || "—"}</td>
                  <td>{account.linked_account_label || account.linked_account_id || "—"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LayerTheme>);

  };

  return <CompanyAccountsIndexPageUi view="section1" accounts={accounts} activeTab={activeTab} ALLOWED_ROLES={ALLOWED_ROLES} Button={Button} CompanyAccountForm={CompanyAccountForm} DevLayoutSection={DevLayoutSection} feedback={feedback} fetchAccounts={fetchAccounts} handleCreate={handleCreate} loading={loading} permissions={permissions} ProtectedRoute={ProtectedRoute} renderLedgerTab={renderLedgerTab} renderList={renderList} saving={saving} search={search} SearchBar={SearchBar} TabGroup={TabGroup} setActiveTab={setActiveTab} setSearch={setSearch} setShowForm={setShowForm} showForm={showForm} tabs={tabs} />;

















































































































































}
