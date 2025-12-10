// file location: src/pages/accounts/index.js // header comment required by user
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks for state and memoization
import { useRouter } from "next/router"; // import router for navigation actions
import Layout from "@/components/Layout"; // import shared layout wrapper to match global UI
import ProtectedRoute from "@/components/ProtectedRoute"; // import auth guard tied to Keycloak session
import { useUser } from "@/context/UserContext"; // import user context for role awareness
import AccountTable from "@/components/accounts/AccountTable"; // import reusable accounts table
import AccountSummary from "@/components/accounts/AccountSummary"; // import summary ribbon component
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from "@/config/accounts"; // import constants for filters
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper to align UI with RBAC
import { exportToCsv } from "@/utils/exportUtils"; // import CSV export helper for export button
const ALLOWED_ROLES = [ // define Keycloak roles allowed to open the accounts list
  "ADMIN", // admin full access
  "OWNER", // owner full access
  "ADMIN MANAGER", // admin manager access
  "ACCOUNTS", // accounts department
  "ACCOUNTS MANAGER", // accounts leadership
  "GENERAL MANAGER", // general manager view
  "SERVICE MANAGER", // service manager view
  "WORKSHOP MANAGER", // workshop manager view
  "SALES", // sales team read-only scope
]; // close allowed roles array
const defaultFilters = { // baseline filter state for the list page
  search: "", // search term for account/customer
  status: "", // account status filter
  accountType: "", // account type filter
  dateFrom: "", // created date from filter
  dateTo: "", // created date to filter
  minBalance: "", // min amount filter
  maxBalance: "", // max amount filter
}; // close defaultFilters
export default function AccountsListPage() { // component definition for the accounts landing page
  const router = useRouter(); // initialize router instance
  const { user } = useUser(); // read user info from context
  const [accounts, setAccounts] = useState([]); // hold table data
  const [summary, setSummary] = useState({}); // hold summary metrics
  const [loading, setLoading] = useState(true); // track loading state
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 }); // store pagination metadata
  const [sortState, setSortState] = useState({ field: "updated_at", direction: "desc" }); // track current sort state
  const [filters, setFilters] = useState(defaultFilters); // store filter inputs
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]); // recompute permissions whenever roles change
  const canCreateAccount = permissions.canCreateAccount; // convenience boolean for button
  const canExport = permissions.canExport; // convenience boolean for export button
  const fetchAccounts = useCallback(async () => { // define function that loads account data from API
    setLoading(true); // show loading state before fetch
    try { // wrap fetch in try/catch for error handling
      const params = new URLSearchParams(); // create query parameter builder
      params.set("page", pagination.page.toString()); // append page param
      params.set("pageSize", pagination.pageSize.toString()); // append page size param
      params.set("sortField", sortState.field); // append sort field
      params.set("sortDirection", sortState.direction); // append direction
      Object.entries(filters).forEach(([key, value]) => { // iterate over filter entries
        if (value !== undefined && value !== null && value !== "") { // append only when value provided
          params.set(key, value); // append filter param
        } // close guard
      }); // close filters loop
      if (permissions.restrictedAccountTypes && permissions.restrictedAccountTypes.length > 0) { // apply sales scope restrictions when necessary
        params.set("accountType", permissions.restrictedAccountTypes[0]); // set account type filter for restricted roles
      } // close scope guard
      const response = await fetch(`/api/accounts?${params.toString()}`); // call API route with query string
      const payload = await response.json(); // parse JSON response
      if (!response.ok) { // check HTTP status code
        throw new Error(payload?.message || "Failed to load accounts"); // throw when server returned error
      } // close error branch
      setAccounts(payload.data || []); // store rows from response
      setSummary(payload.summary || {}); // store summary metrics from response
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total })); // update total count while retaining current page/pageSize
    } catch (error) { // catch fetch or parsing errors
      console.error("Failed to load accounts", error); // log for debugging
    } finally { // run cleanup regardless of success/failure
      setLoading(false); // hide loading state after fetch completes
    } // close finally block
  }, [filters, pagination.page, pagination.pageSize, permissions.restrictedAccountTypes, sortState.direction, sortState.field]); // dependencies causing fetch to rerun
  useEffect(() => { // trigger data load when dependencies change
    fetchAccounts(); // call fetch function defined above
  }, [fetchAccounts]); // register fetch as dependency so effect reruns when fetch reference changes
  const handleAccountSelect = (account, action) => { // manage row action buttons for view/edit
    if (!account) return; // guard when no account provided
    if (action === "edit") { // handle edit action
      router.push(`/accounts/edit/${account.account_id}`); // route to edit page
      return; // exit after navigation
    } // close edit branch
    router.push(`/accounts/view/${account.account_id}`); // default to view page
  }; // close handleAccountSelect
  const handleExport = () => { // export currently loaded rows to CSV
    if (!canExport || !accounts.length) return; // guard when export not allowed or no data
    exportToCsv("accounts.csv", accounts, ["account_id", "customer_id", "account_type", "status", "balance", "credit_limit", "billing_name", "billing_email"]); // call helper with selected columns
  }; // close handleExport function
  const renderFilters = () => ( // helper returning filter UI to keep JSX tidy
    <div // wrapper for filter controls
      style={{ // style container to match top filter bars elsewhere
        display: "flex", // align filters horizontally
        flexWrap: "wrap", // wrap for mobile
        gap: "12px", // spacing between controls
        padding: "16px", // internal spacing
        borderRadius: "16px", // rounded corners
        border: "1px solid var(--surface-light)", // subtle border
        background: "var(--surface)", // white background
      }} // close style object
    >
      <input // search input element
        type="search" // use search input semantics
        name="search" // name used to update state
        placeholder="Search account, customer, or billing" // placeholder text
        value={filters.search} // bind to state
        onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} // update filter state when typing
        style={{ // style for search input
          flex: "1 1 240px", // allow growth but enforce min width
          padding: "10px 14px", // comfortable padding
          borderRadius: "999px", // pill shape consistent with DMS search bars
          border: "1px solid var(--surface-light)", // subtle border
          background: "var(--surface-light)", // tinted background
        }} // close search style
      />
      <select // status filter select
        name="status" // name attribute for state update
        value={filters.status} // bind to filter state
        onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} // update state on change
        style={{ // style select to match search pill
          flex: "0 0 200px", // fixed width for select
          padding: "10px 12px", // internal padding
          borderRadius: "999px", // pill shape
          border: "1px solid var(--surface-light)", // border style
          background: "var(--surface-light)", // background color
        }} // close select style
      >
        <option value="">All Statuses</option> // default option
        {ACCOUNT_STATUSES.map((status) => ( // iterate statuses from config
          <option key={status} value={status}>{status}</option> // option element for status
        ))}
      </select>
      <select // account type select input
        name="accountType" // use accountType key for filters object
        value={filters.accountType} // bind to state
        onChange={(event) => setFilters((prev) => ({ ...prev, accountType: event.target.value }))} // update filter state
        style={{ // style select similar to status select
          flex: "0 0 200px", // fixed width
          padding: "10px 12px", // padding
          borderRadius: "999px", // pill shape
          border: "1px solid var(--surface-light)", // border
          background: "var(--surface-light)", // background color
        }} // close style
      >
        <option value="">All Account Types</option> // default option for account type filter
        {ACCOUNT_TYPES.map((type) => ( // map account types to options
          <option key={type} value={type}>{type}</option> // option element
        ))}
      </select>
      <input type="date" name="dateFrom" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} style={{ flex: "0 0 180px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // created-from date input
      <input type="date" name="dateTo" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} style={{ flex: "0 0 180px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // created-to date input
      <input type="number" name="minBalance" value={filters.minBalance} placeholder="Min Balance" onChange={(event) => setFilters((prev) => ({ ...prev, minBalance: event.target.value }))} style={{ flex: "0 0 140px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // min balance filter input
      <input type="number" name="maxBalance" value={filters.maxBalance} placeholder="Max Balance" onChange={(event) => setFilters((prev) => ({ ...prev, maxBalance: event.target.value }))} style={{ flex: "0 0 140px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // max balance filter input
    </div>
  ); // close renderFilters helper
  const handlePageChange = (nextPage) => { // update pagination state when table requests new page
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) })); // clamp page to minimum of one
  }; // close handlePageChange
  const handleSortChange = (nextSort) => { // update sort state from table header clicks
    setSortState(nextSort); // store new sort descriptor
  }; // close handleSortChange
  return ( // render page content through ProtectedRoute and Layout
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}> // block unauthorized users via Keycloak roles
      <Layout> // wrap in global layout for consistent nav and chrome
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // vertical stacking container
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}> // header row with title and actions
            <div> // container for page title
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Accounts</h1> // page heading text
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem" }}>Full ledger of customer accounts, balances, and billing contacts.</p> // page description text
            </div>
            <div style={{ display: "flex", gap: "10px" }}> // action buttons container
              {canExport && ( // show export button only when user allowed
                <button type="button" onClick={handleExport} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export</button> // export CSV button
              )}
              {canCreateAccount && ( // show create button only for permitted roles
                <button type="button" onClick={() => router.push("/accounts/create")} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 700 }}>New Account</button> // new account button navigates to create page
              )}
            </div>
          </div>
          <AccountSummary summary={summary} onRefresh={fetchAccounts} showRefreshButton /> // summary cards component showing system stats
          {renderFilters()} // render filter controls below summary
          <AccountTable accounts={accounts} loading={loading} pagination={pagination} onPageChange={handlePageChange} sortState={sortState} onSortChange={handleSortChange} onSelectAccount={handleAccountSelect} /> // render reusable table with data and event handlers
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close render
} // close AccountsListPage component definition
