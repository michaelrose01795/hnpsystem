// file location: src/pages/accounts/index.js // header comment required by user
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks for state and memoization
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/context/UserContext";
import AccountTable from "@/components/accounts/AccountTable";
import AccountSummary from "@/components/accounts/AccountSummary";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from "@/config/accounts";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { exportToCsv } from "@/utils/exportUtils";
const ALLOWED_ROLES = [
  "ADMIN",
  "OWNER",
  "ADMIN MANAGER",
  "ACCOUNTS",
  "ACCOUNTS MANAGER",
  "GENERAL MANAGER",
  "SERVICE MANAGER",
  "WORKSHOP MANAGER",
  "SALES",
];
const defaultFilters = {
  search: "",
  status: "",
  accountType: "",
  dateFrom: "",
  dateTo: "",
  minBalance: "",
  maxBalance: "",
};
export default function AccountsListPage() {
  const router = useRouter();
  const { user } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [sortState, setSortState] = useState({ field: "updated_at", direction: "desc" });
  const [filters, setFilters] = useState(defaultFilters);
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const canCreateAccount = permissions.canCreateAccount;
  const canExport = permissions.canExport;
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
      setSummary(payload.summary || {});
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total }));
    } catch (error) {
      console.error("Failed to load accounts", error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize, permissions.restrictedAccountTypes, sortState.direction, sortState.field]);
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);
  const handleAccountSelect = (account, action) => {
    if (!account) return;
    if (action === "edit") {
      router.push(`/accounts/edit/${account.account_id}`);
      return;
    }
    router.push(`/accounts/view/${account.account_id}`);
  };
  const handleExport = () => {
    if (!canExport || !accounts.length) return;
    exportToCsv("accounts.csv", accounts, ["account_id", "customer_id", "account_type", "status", "balance", "credit_limit", "billing_name", "billing_email"]);
  };
  const renderFilters = () => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        padding: "16px",
        borderRadius: "16px",
        border: "1px solid var(--surface-light)",
        background: "var(--surface)",
      }}
    >
      <input
        type="search"
        name="search"
        placeholder="Search account, customer, or billing"
        value={filters.search}
        onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        style={{
          flex: "1 1 240px",
          padding: "10px 14px",
          borderRadius: "999px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface-light)",
        }}
      />
      <select
        name="status"
        value={filters.status}
        onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
        style={{
          flex: "0 0 200px",
          padding: "10px 12px",
          borderRadius: "999px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface-light)",
        }}
      >
        <option value="">All Statuses</option>
        {ACCOUNT_STATUSES.map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
      <select
        name="accountType"
        value={filters.accountType}
        onChange={(event) => setFilters((prev) => ({ ...prev, accountType: event.target.value }))}
        style={{
          flex: "0 0 200px",
          padding: "10px 12px",
          borderRadius: "999px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface-light)",
        }}
      >
        <option value="">All Account Types</option>
        {ACCOUNT_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <input type="date" name="dateFrom" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} style={{ flex: "0 0 180px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} />
      <input type="date" name="dateTo" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} style={{ flex: "0 0 180px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} />
      <input type="number" name="minBalance" value={filters.minBalance} placeholder="Min Balance" onChange={(event) => setFilters((prev) => ({ ...prev, minBalance: event.target.value }))} style={{ flex: "0 0 140px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} />
      <input type="number" name="maxBalance" value={filters.maxBalance} placeholder="Max Balance" onChange={(event) => setFilters((prev) => ({ ...prev, maxBalance: event.target.value }))} style={{ flex: "0 0 140px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} />
    </div>
  );
  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }));
  };
  const handleSortChange = (nextSort) => {
    setSortState(nextSort);
  };
  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}></h1>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem" }}>Full ledger of customer accounts, balances, and billing contacts.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {canExport && (
                <button type="button" onClick={handleExport} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export</button>
              )}
              {canCreateAccount && (
                <button type="button" onClick={() => router.push("/accounts/create")} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 700 }}>New Account</button>
              )}
            </div>
          </div>
          <AccountSummary summary={summary} onRefresh={fetchAccounts} showRefreshButton />
          {renderFilters()}
          <AccountTable accounts={accounts} loading={loading} pagination={pagination} onPageChange={handlePageChange} sortState={sortState} onSortChange={handleSortChange} onSelectAccount={handleAccountSelect} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
