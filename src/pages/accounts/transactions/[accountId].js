// file location: src/pages/accounts/transactions/[accountId].js // header comment with file path
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks for state and lifecycle
import { useRouter } from "next/router"; // import router to access accountId param and navigation
import Layout from "@/components/Layout"; // import shared layout for consistent chrome
import ProtectedRoute from "@/components/ProtectedRoute"; // import Keycloak-aware route guard
import TransactionTable from "@/components/accounts/TransactionTable"; // import reusable transaction table component
import { useUser } from "@/context/UserContext"; // import user context for role detection
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper to tailor actions
import { exportToCsv } from "@/utils/exportUtils"; // import CSV helper for export button
const TRANSACTION_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER", "SALES"]; // roles allowed to view transactions list
export default function AccountTransactionsPage() { // component definition for transactions page
  const router = useRouter(); // instantiate router for navigation and params
  const { accountId } = router.query; // extract account identifier from route
  const { user } = useUser(); // read user info from context
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]); // memoize permission flags
  const [transactions, setTransactions] = useState([]); // store fetched transactions for table
  const [loading, setLoading] = useState(true); // track loading state
  const [filters, setFilters] = useState({ type: "", payment_method: "", from: "", to: "" }); // filter object passed to table
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 }); // pagination metadata for API requests
  const fetchTransactions = useCallback(async () => { // define function fetching transaction list
    if (!accountId) return; // guard when route param not ready
    setLoading(true); // show loader while fetch occurs
    try { // wrap fetch in try/catch to handle failures
      const params = new URLSearchParams(); // instantiate query param builder
      params.set("page", pagination.page.toString()); // set page param
      params.set("pageSize", pagination.pageSize.toString()); // set page size param
      Object.entries(filters).forEach(([key, value]) => { // loop through filters object entries
        if (value) { // only append when value truthy
          params.set(key, value); // add filter value to query string
        } // close guard
      }); // close filters loop
      const response = await fetch(`/api/accounts/${accountId}/transactions?${params.toString()}`); // call API for transactions
      const payload = await response.json(); // parse JSON body
      if (!response.ok) { // check HTTP status
        throw new Error(payload?.message || "Failed to load transactions"); // throw descriptive error for catch block
      } // close guard
      setTransactions(payload.data || []); // store rows into state
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total })); // update total count from server response
    } catch (error) { // catch fetch errors
      console.error("Failed to load transactions", error); // log for debugging
    } finally { // cleanup block executed after try/catch
      setLoading(false); // hide loader after response
    } // close finally block
  }, [accountId, filters, pagination.page, pagination.pageSize]); // dependencies causing fetch to rerun
  useEffect(() => { // effect to trigger fetch when dependencies change
    fetchTransactions(); // call fetch function above
  }, [fetchTransactions]); // register fetch in dependency array
  const handlePageChange = (nextPage) => { // update pagination when table requests new page
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) })); // clamp page to at least one
  }; // close handlePageChange
  const handleExport = () => { // export current dataset to CSV
    exportToCsv(`account-${accountId}-transactions.csv`, transactions, ["transaction_id", "transaction_date", "type", "amount", "payment_method", "job_number", "created_by"]); // call helper with desired column order
  }; // close handleExport
  return ( // render transactions page markup
    <ProtectedRoute allowedRoles={TRANSACTION_ROLES}> // wrap in auth guard to enforce RBAC
      <Layout> // wrap page contents inside site layout
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // column layout container for page sections
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}> // header row containing title and actions
            <div> // header text container
              <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Account {accountId}</p> // label referencing account id
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Transactions</h1> // page title
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Filter ledger entries, export to CSV, and trace adjustments.</p> // descriptive subtitle text
            </div>
            <div style={{ display: "flex", gap: "10px" }}> // action buttons cluster
              <button type="button" onClick={() => router.push(`/accounts/view/${accountId}`)} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Account</button> // button returning to account view
              {permissions.canExport && <button type="button" onClick={handleExport} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export</button>} // export button shown only when user allowed per permissions
            </div>
          </div>
          <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} /> // render transaction table with filters/pagination/export hooks
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close component render tree
} // close AccountTransactionsPage definition
