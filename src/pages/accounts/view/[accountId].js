// file location: src/pages/accounts/view/[accountId].js // include path comment for reviewers
import React, { useEffect, useMemo, useState } from "react"; // import React hooks for state/effects/memoization
import { useRouter } from "next/router"; // import router for navigation
import Layout from "@/components/Layout"; // import layout wrapper for consistent chrome
import ProtectedRoute from "@/components/ProtectedRoute"; // import auth guard for Keycloak roles
import { useUser } from "@/context/UserContext"; // import user context for role detection
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper to tailor UI actions
import InvoiceTable from "@/components/accounts/InvoiceTable"; // reuse invoice table to show linked invoices
import TransactionTable from "@/components/accounts/TransactionTable"; // reuse transaction table for recent activity
const VIEW_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER", "WORKSHOP MANAGER", "SALES"]; // define allowed roles for viewing accounts
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }); // formatter for monetary fields
export default function ViewAccountPage() { // component definition for account detail view
  const router = useRouter(); // instantiate router for navigation and query parsing
  const { accountId } = router.query; // extract dynamic route parameter
  const { user } = useUser(); // read user info from context
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]); // memoize permission flags whenever roles change
  const [account, setAccount] = useState(null); // hold account record fetched from API
  const [transactions, setTransactions] = useState([]); // hold linked transactions for preview table
  const [invoices, setInvoices] = useState([]); // hold linked invoices for preview table
  const [loading, setLoading] = useState(true); // track loading state for page data
  const [filters, setFilters] = useState({ type: "", payment_method: "", from: "", to: "" }); // simple transaction filter state passed to TransactionTable
  const [invoiceFilters, setInvoiceFilters] = useState({ search: "", status: "", from: "", to: "" }); // invoice filter state passed to InvoiceTable
  useEffect(() => { // fetch account when accountId changes
    if (!accountId) return; // guard when router param not ready yet
    const controller = new AbortController(); // create abort controller for fetch cleanup
    const loadAccount = async () => { // async function fetching account
      setLoading(true); // show spinner while data loads
      try { // try/catch for API request
        const response = await fetch(`/api/accounts/${accountId}`, { signal: controller.signal }); // call detail endpoint with abort signal
        const payload = await response.json(); // parse JSON body
        if (!response.ok) { // handle HTTP error
          throw new Error(payload?.message || "Failed to load account"); // throw descriptive error
        } // close guard
        setAccount(payload.data || null); // store account record
        setTransactions(payload.transactions || []); // store limited transaction list returned by API
        setInvoices(payload.invoices || []); // store linked invoices data
      } catch (error) { // handle fetch errors
        if (error.name === "AbortError") return; // ignore abort errors triggered by cleanup
        console.error("Failed to load account", error); // log real errors
      } finally { // cleanup to always hide spinner
        setLoading(false); // hide loading state
      } // close finally block
    }; // close loadAccount function
    loadAccount(); // trigger data fetch
    return () => controller.abort(); // abort fetch if component unmounts before completion
  }, [accountId]); // rerun effect when accountId changes
  const handleFreezeToggle = async () => { // toggle account status between Active and Frozen
    if (!account) return; // guard when account not loaded
    const nextStatus = account.status === "Frozen" ? "Active" : "Frozen"; // decide new status value
    try { // wrap API call in try/catch to handle errors
      const response = await fetch(`/api/accounts/${account.account_id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }); // send update request to API
      const payload = await response.json(); // parse JSON response
      if (!response.ok) { // check for server error
        throw new Error(payload?.message || "Unable to update status"); // throw if update failed
      } // close guard
      setAccount((prev) => ({ ...prev, status: nextStatus })); // update local state after successful toggle
    } catch (error) { // catch fetch errors
      console.error("Failed to toggle status", error); // log error for debugging
    } // close catch block
  }; // close handleFreezeToggle
  const handleEdit = () => { // navigate to edit form
    if (!account) return; // guard missing account
    router.push(`/accounts/edit/${account.account_id}`); // push edit route to router
  }; // close handleEdit
  const handleTransactionsPage = () => { // navigate to transactions page for this account
    if (!account) return; // guard missing account
    router.push(`/accounts/transactions/${account.account_id}`); // push transactions route
  }; // close handleTransactionsPage
  const handleInvoicesPage = () => { // navigate to invoices list filtered by this account
    router.push(`/accounts/invoices?accountId=${account?.account_id || ""}`); // push invoice list route with query param
  }; // close handleInvoicesPage
  const detailCard = (label, value) => ( // helper component that renders info cards for key metrics
    <div style={{ flex: "1 1 200px", border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "16px", background: "var(--surface)" }}> // styled info card container
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p> // label text for card
      <strong style={{ display: "block", marginTop: "8px", fontSize: "1.4rem", color: "var(--primary)" }}>{value}</strong> // value text for card
    </div>
  ); // close helper
  return ( // render detail page structure
    <ProtectedRoute allowedRoles={VIEW_ROLES}> // restrict view access to allowed roles
      <Layout> // wrap page with layout component
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // column layout container
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading account…</p>} // show loading indicator when data still fetching
          {!loading && account && ( // render detail layout once account available
            <>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}> // header row containing title and actions
                <div> // container for title text
                  <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Account</p> // small label above title
                  <h1 style={{ margin: "4px 0", fontSize: "2rem", color: "var(--primary)" }}>{account.billing_name || account.account_id}</h1> // show billing name as main title
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}> // row with meta data tags
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>ID: {account.account_id}</span> // show account id badge
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>Customer: {account.customer_id}</span> // show customer id badge
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "var(--surface-light)", fontWeight: 600 }}>Type: {account.account_type}</span> // show account type badge
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: account.status === "Frozen" ? "rgba(245,158,11,0.18)" : "rgba(16,185,129,0.18)", color: account.status === "Frozen" ? "#92400e" : "#065f46", fontWeight: 700 }}>{account.status}</span> // show status badge with color-coding
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}> // action buttons container
                  <button type="button" onClick={handleTransactionsPage} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Transactions</button> // view transactions button
                  <button type="button" onClick={handleInvoicesPage} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Invoices</button> // view invoices button
                  {permissions.canEditAccount && <button type="button" onClick={handleEdit} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Edit</button>} // edit button visible for permitted roles
                  {permissions.canFreezeAccount && <button type="button" onClick={handleFreezeToggle} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: account.status === "Frozen" ? "var(--surface-light)" : "var(--primary)", color: account.status === "Frozen" ? "var(--text-secondary)" : "white", fontWeight: 700 }}>{account.status === "Frozen" ? "Unfreeze" : "Freeze"}</button>} // freeze/unfreeze button for permitted roles
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}> // metrics card grid
                {detailCard("Balance", currencyFormatter.format(Number(account.balance || 0)))} // show balance card
                {detailCard("Credit Limit", currencyFormatter.format(Number(account.credit_limit || 0)))} // show credit limit card
                {detailCard("Credit Terms", `${account.credit_terms || 0} days`)} // show credit terms card
                {detailCard("Created", account.created_at ? new Date(account.created_at).toLocaleDateString("en-GB") : "—")} // show created date card
              </div>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)" }}> // billing information card
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Billing Information</h2> // section title
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "12px" }}> // grid for billing fields
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Name</p><strong>{account.billing_name || "—"}</strong></div> // billing name row
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Email</p><strong>{account.billing_email || "—"}</strong></div> // billing email row
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Phone</p><strong>{account.billing_phone || "—"}</strong></div> // billing phone row
                  <div><p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>Address</p><strong>{[account.billing_address_line1, account.billing_address_line2, account.billing_city, account.billing_postcode, account.billing_country].filter(Boolean).join(", ") || "—"}</strong></div> // billing address row combining fields
                </div>
              </section>
              <section style={{ border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "20px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "12px" }}> // notes section card
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Internal Notes</h2> // notes title
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>{account.notes || "No notes recorded."}</p> // notes content with fallback message
              </section>
              <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={{ page: 1, pageSize: transactions.length || 1, total: transactions.length || 0 }} onPageChange={handleTransactionsPage} onExport={() => router.push(`/accounts/transactions/${account.account_id}`)} /> // embed transaction table for quick glance using existing component
              <InvoiceTable invoices={invoices} filters={invoiceFilters} onFilterChange={setInvoiceFilters} pagination={{ page: 1, pageSize: invoices.length || 1, total: invoices.length || 0 }} onPageChange={handleInvoicesPage} onExport={() => router.push(`/accounts/invoices?accountId=${account.account_id}`)} loading={loading} /> // embed invoice table preview using existing component
            </>
          )}
          {!loading && !account && <p style={{ color: "var(--danger)" }}>Account not found.</p>} // display message when account id invalid
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close render tree
} // close ViewAccountPage definition
