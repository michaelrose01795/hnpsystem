// file location: src/pages/accounts/index.js
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks for state and memoization
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/context/UserContext";
import AccountTable from "@/components/accounts/AccountTable";
import AccountUpsertModal from "@/components/accounts/AccountUpsertModal";
import AccountsSettingsModal from "@/components/accounts/AccountsSettingsModal";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from "@/config/accounts";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { exportToCsv } from "@/utils/exportUtils";
import { CalendarField } from "@/components/ui/calendarAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import ToolbarRow from "@/components/ui/ToolbarRow";
import ControlGroup from "@/components/ui/ControlGroup";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import AccountsListPageUi from "@/components/page-ui/accounts/accounts-ui"; // Extracted presentation layer.

const ALLOWED_ROLES = [
"ADMIN",
"OWNER",
"ADMIN MANAGER",
"ACCOUNTS",
"ACCOUNTS MANAGER",
"GENERAL MANAGER",
"SERVICE MANAGER",
"WORKSHOP MANAGER",
"SALES"];

const defaultFilters = {
  search: "",
  status: "",
  accountType: "",
  dateFrom: "",
  dateTo: "",
  minBalance: "",
  maxBalance: ""
};

const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const formatShortDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function AccountsListPage() {
  const router = useRouter();
  const { user } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [linkedInvoices, setLinkedInvoices] = useState([]);
  const [linkedGoodsIn, setLinkedGoodsIn] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkedLoading, setLinkedLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [sortState, setSortState] = useState({ field: "updated_at", direction: "desc" });
  const [filters, setFilters] = useState(defaultFilters);
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const canCreateAccount = permissions.canCreateAccount;
  const canExport = permissions.canExport;

  useEffect(() => {
    if (permissions.restrictedAccountTypes?.length) {
      setFilters((prev) => ({ ...prev, accountType: permissions.restrictedAccountTypes[0] }));
    }
  }, [permissions.restrictedAccountTypes]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      params.set("sortField", sortState.field);
      params.set("sortDirection", sortState.direction);
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, value);
        }
      });
      if (permissions.restrictedAccountTypes && permissions.restrictedAccountTypes.length > 0) {
        params.set("accountType", permissions.restrictedAccountTypes[0]);
      }
      const response = await fetch(`/api/accounts?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load accounts");
      }
      setAccounts(payload.data || []);
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total }));
    } catch (error) {
      console.error("Failed to load accounts", error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize, permissions.restrictedAccountTypes, sortState.direction, sortState.field]);

  const fetchLinkedRecords = useCallback(async () => {
    setLinkedLoading(true);
    try {
      const [invoiceResponse, goodsInResponse] = await Promise.allSettled([
      fetch("/api/invoices?page=1&pageSize=6"),
      fetch("/api/parts/goods-in?limit=6")]
      );

      if (invoiceResponse.status === "fulfilled") {
        const payload = await invoiceResponse.value.json();
        if (invoiceResponse.value.ok) {
          setLinkedInvoices(payload.data || []);
        }
      }

      if (goodsInResponse.status === "fulfilled") {
        const payload = await goodsInResponse.value.json();
        if (goodsInResponse.value.ok) {
          setLinkedGoodsIn(payload.goodsIn || []);
        }
      }
    } catch (error) {
      console.error("Failed to load linked financial records", error);
    } finally {
      setLinkedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchLinkedRecords();
  }, [fetchLinkedRecords]);

  const handleAccountSelect = (account, action) => {
    if (!account) return;
    if (action === "edit") {
      const nextQuery = { ...router.query, edit: account.account_id };
      delete nextQuery.create;
      router.push({ pathname: "/accounts", query: nextQuery }, undefined, { shallow: true });
      return;
    }
    router.push(`/accounts/view/${account.account_id}`);
  };
  const handleExport = () => {
    if (!canExport || !accounts.length) return;
    exportToCsv("accounts.csv", accounts, ["account_id", "customer_id", "account_type", "status", "balance", "credit_limit", "billing_name", "billing_email"]);
  };

  const openCreateModal = () => {
    const nextQuery = { ...router.query, create: "1" };
    delete nextQuery.edit;
    router.push({ pathname: "/accounts", query: nextQuery }, undefined, { shallow: true });
  };

  const closeAccountModal = () => {
    const nextQuery = { ...router.query };
    delete nextQuery.create;
    delete nextQuery.edit;
    router.push({ pathname: "/accounts", query: nextQuery }, undefined, { shallow: true });
  };

  const openSettingsModal = () => {
    const nextQuery = { ...router.query, settings: "1" };
    router.push({ pathname: "/accounts", query: nextQuery }, undefined, { shallow: true });
  };

  const closeSettingsModal = () => {
    const nextQuery = { ...router.query };
    delete nextQuery.settings;
    router.push({ pathname: "/accounts", query: nextQuery }, undefined, { shallow: true });
  };

  const modalMode = router.query.edit ? "edit" : "create";
  const modalAccountId = typeof router.query.edit === "string" ? router.query.edit : "";
  const isAccountModalOpen = router.query.create === "1" || Boolean(modalAccountId);
  const isSettingsModalOpen = router.query.settings === "1";

  const handleFilterChange = (name, value) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters(defaultFilters);
  };

  const financeLinks = [
  {
    title: "Invoices",
    description: "Open invoice balances and payment status",
    value: linkedInvoices.length ? `${linkedInvoices.length} recent refs` : "Review ledger invoices",
    actionLabel: "Open invoices",
    onClick: () => router.push("/accounts/invoices")
  },
  {
    title: "Job Cards",
    description: "Trace account spend back to workshop jobs",
    value: linkedInvoices.find((invoice) => invoice.job_number)?.job_number || "Linked by job number",
    actionLabel: "Open job cards",
    onClick: () => router.push("/job-cards/view")
  },
  {
    title: "Parts Orders",
    description: "Follow order numbers tied to invoiced work",
    value: linkedInvoices.find((invoice) => invoice.order_number)?.order_number || "Linked by order number",
    actionLabel: "Open orders",
    onClick: () => router.push("/parts/create-order")
  },
  {
    title: "Goods In",
    description: "Check supplier intake and stock-side value flow",
    value: linkedGoodsIn[0]?.goods_in_number || "Linked by goods-in reference",
    actionLabel: "Open goods in",
    onClick: () => router.push("/parts/goods-in")
  }];


  const renderFilters = () =>
  <DevLayoutSection as="section" sectionKey="accounts-filter-panel" sectionType="content-card" parentKey="accounts-page-shell" className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
      <DevLayoutSection sectionKey="accounts-filter-toolbar" sectionType="filter-row" parentKey="accounts-filter-panel">
      <ToolbarRow>
      <SearchBar
          name="search"
          placeholder="Search account, customer, or billing"
          value={filters.search}
          onChange={(event) => handleFilterChange("search", event.target.value)}
          onClear={() => handleFilterChange("search", "")}
          style={{
            flex: "1 1 240px",
            background: "var(--surface)"
          }} />
        
      <DropdownField
          name="status"
          value={filters.status}
          onChange={(event) => handleFilterChange("status", event.target.value)}
          placeholder="All statuses"
          options={[{ label: "All Statuses", value: "", placeholder: true }, ...ACCOUNT_STATUSES.map((status) => ({ label: status, value: status }))]}
          style={{ flex: "0 0 200px", background: "var(--surface)" }} />
        
      <DropdownField
          name="accountType"
          value={filters.accountType}
          onChange={(event) => handleFilterChange("accountType", event.target.value)}
          placeholder="All account types"
          options={[{ label: "All Account Types", value: "", placeholder: true }, ...ACCOUNT_TYPES.map((type) => ({ label: type, value: type }))]}
          disabled={Boolean(permissions.restrictedAccountTypes?.length)}
          style={{ flex: "0 0 220px", background: "var(--surface)" }} />
        
      <div style={{ flex: "0 0 180px" }}>
        <CalendarField name="dateFrom" placeholder="From date" value={filters.dateFrom} onChange={(event) => handleFilterChange("dateFrom", event.target.value)} style={{ background: "var(--surface)" }} />
      </div>
      <div style={{ flex: "0 0 180px" }}>
        <CalendarField name="dateTo" placeholder="To date" value={filters.dateTo} onChange={(event) => handleFilterChange("dateTo", event.target.value)} style={{ background: "var(--surface)" }} />
      </div>
      <input type="number" name="minBalance" value={filters.minBalance} placeholder="Min balance" onChange={(event) => handleFilterChange("minBalance", event.target.value)} style={{ flex: "0 0 124px", background: "var(--control-bg)" }} />
      <input type="number" name="maxBalance" value={filters.maxBalance} placeholder="Max balance" onChange={(event) => handleFilterChange("maxBalance", event.target.value)} style={{ flex: "0 0 124px", background: "var(--control-bg)" }} />
      <Button type="button" variant="secondary" size="sm" onClick={handleResetFilters} style={{ background: "var(--control-bg)", color: "var(--primary)" }}>
        Clear filters
      </Button>
      </ToolbarRow>
      </DevLayoutSection>
    </DevLayoutSection>;


  const renderLinkedFinance = () =>
  <DevLayoutSection as="section" sectionKey="accounts-linked-finance" sectionType="content-card" parentKey="accounts-page-shell" widthMode="full" className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "18px", background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
      <DevLayoutSection sectionKey="accounts-linked-finance-jump-links" sectionType="toolbar" parentKey="accounts-linked-finance">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        {financeLinks.map((link) =>
        <DevLayoutSection
          key={link.title}
          sectionKey={`accounts-linked-finance-${link.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
          sectionType="content-card"
          parentKey="accounts-linked-finance-jump-links"
          as="article"
          style={{
            borderRadius: "var(--control-radius)",
            border: "1px solid rgba(var(--primary-rgb), 0.08)",
            background: "var(--surface)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
          
            <div>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {link.title}
              </p>
              <strong style={{ display: "block", marginTop: "8px", color: "var(--text-primary)", fontSize: "1.05rem" }}>
                {link.value}
              </strong>
            </div>
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5, minHeight: "3em" }}>
              {link.description}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={link.onClick}>
              {link.actionLabel}
            </Button>
          </DevLayoutSection>
        )}
      </div>
      </DevLayoutSection>
      <DevLayoutSection sectionKey="accounts-linked-finance-reference-grid" sectionType="content-card" parentKey="accounts-linked-finance">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <DevLayoutSection sectionKey="accounts-linked-finance-invoice-refs" sectionType="content-card" parentKey="accounts-linked-finance-reference-grid" as="article" style={{ borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", background: "var(--surface)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1rem" }}>Recent Invoice References</h3>
            <Button type="button" variant="ghost" size="xs" onClick={() => router.push("/accounts/invoices")}>
              All invoices
            </Button>
          </div>
          {linkedLoading && linkedInvoices.length === 0 && <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading links…</p>}
          {!linkedLoading && linkedInvoices.length === 0 && <p style={{ margin: 0, color: "var(--text-secondary)" }}>No invoice references available.</p>}
          {linkedInvoices.map((invoice) =>
          <div key={invoice.id || invoice.invoice_id} style={{ borderTop: "1px solid rgba(var(--primary-rgb), 0.08)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>{invoice.invoice_number || invoice.invoice_id || "Invoice"}</strong>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    {invoice.account_id || "No account"} · {currencyFormatter.format(Number(invoice.grand_total || invoice.invoice_total || 0))}
                  </span>
                </div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{formatShortDate(invoice.due_date || invoice.created_at)}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {invoice.job_number &&
              <Button type="button" variant="secondary" size="xs" onClick={() => router.push(`/job-cards/${encodeURIComponent(invoice.job_number)}`)}>
                    Job {invoice.job_number}
                  </Button>
              }
                {invoice.order_number &&
              <Button type="button" variant="secondary" size="xs" onClick={() => router.push(`/parts/create-order/${encodeURIComponent(invoice.order_number)}`)}>
                    Order {invoice.order_number}
                  </Button>
              }
                {invoice.invoice_id &&
              <Button type="button" variant="ghost" size="xs" onClick={() => router.push(`/accounts/invoices/${encodeURIComponent(invoice.invoice_id)}`)}>
                    Invoice details
                  </Button>
              }
              </div>
            </div>
          )}
        </DevLayoutSection>
        <DevLayoutSection sectionKey="accounts-linked-finance-goodsin-refs" sectionType="content-card" parentKey="accounts-linked-finance-reference-grid" as="article" style={{ borderRadius: "var(--control-radius)", border: "1px solid rgba(var(--primary-rgb), 0.08)", background: "var(--surface)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1rem" }}>Recent Goods In References</h3>
            <Button type="button" variant="ghost" size="xs" onClick={() => router.push("/parts/goods-in")}>
              Goods in
            </Button>
          </div>
          {linkedLoading && linkedGoodsIn.length === 0 && <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading links…</p>}
          {!linkedLoading && linkedGoodsIn.length === 0 && <p style={{ margin: 0, color: "var(--text-secondary)" }}>No goods-in references available.</p>}
          {linkedGoodsIn.map((record) =>
          <div key={record.id || record.goods_in_number} style={{ borderTop: "1px solid rgba(var(--primary-rgb), 0.08)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>{record.goods_in_number || "Goods in"}</strong>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    {record.supplier_name || "Unknown supplier"}{record.invoice_number ? ` · Inv ${record.invoice_number}` : ""}
                  </span>
                </div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{formatShortDate(record.invoice_date || record.created_at)}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {record.goods_in_number &&
              <Button type="button" variant="secondary" size="xs" onClick={() => router.push(`/parts/goods-in/${encodeURIComponent(record.goods_in_number)}`)}>
                    {record.goods_in_number}
                  </Button>
              }
                <Button type="button" variant="ghost" size="xs" onClick={() => router.push("/parts/goods-in")}>
                  Goods in workspace
                </Button>
              </div>
            </div>
          )}
        </DevLayoutSection>
      </div>
      </DevLayoutSection>
    </DevLayoutSection>;


  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }));
  };

  const handleSortChange = (nextSort) => {
    setSortState(nextSort);
  };

  return <AccountsListPageUi view="section1" accounts={accounts} AccountsSettingsModal={AccountsSettingsModal} AccountTable={AccountTable} AccountUpsertModal={AccountUpsertModal} ALLOWED_ROLES={ALLOWED_ROLES} Button={Button} canCreateAccount={canCreateAccount} canExport={canExport} closeAccountModal={closeAccountModal} closeSettingsModal={closeSettingsModal} DevLayoutSection={DevLayoutSection} fetchAccounts={fetchAccounts} handleAccountSelect={handleAccountSelect} handleExport={handleExport} handlePageChange={handlePageChange} handleSortChange={handleSortChange} isAccountModalOpen={isAccountModalOpen} isSettingsModalOpen={isSettingsModalOpen} loading={loading} modalAccountId={modalAccountId} modalMode={modalMode} openCreateModal={openCreateModal} openSettingsModal={openSettingsModal} pagination={pagination} ProtectedRoute={ProtectedRoute} renderFilters={renderFilters} renderLinkedFinance={renderLinkedFinance} sortState={sortState} ToolbarRow={ToolbarRow} />;





















}
