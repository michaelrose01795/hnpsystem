// file location: src/pages/accounts/invoices/index.js // header comment referencing file path
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks
import { useRouter } from "next/router"; // import router for query params and navigation
import Layout from "@/components/Layout"; // import shared layout component
import ProtectedRoute from "@/components/ProtectedRoute"; // import auth guard to enforce Keycloak roles
import InvoiceTable from "@/components/accounts/InvoiceTable"; // import invoice table component
import { useUser } from "@/context/UserContext"; // import user context to read roles
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper for RBAC logic
import { exportToCsv } from "@/utils/exportUtils"; // import CSV helper for export button
const INVOICE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "SALES", "WORKSHOP", "WORKSHOP MANAGER", "PARTS", "PARTS MANAGER"]; // define allowed roles for viewing invoices
export default function InvoicesPage() { // component definition for invoice list page
  const router = useRouter(); // instantiate router for query params
  const { user } = useUser(); // read user info from context
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]); // memoize permission flags based on roles
  const [invoices, setInvoices] = useState([]); // array of invoice records
  const [loading, setLoading] = useState(true); // loading flag for network state
  const initialAccountId = typeof router.query.accountId === "string" ? router.query.accountId : ""; // accountId filter passed via query string when navigating from account view
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "", accountId: initialAccountId }); // filter object stored in state
  useEffect(() => { // sync filters when accountId query changes after mount
    if (initialAccountId) { // update only when query provides a value
      setFilters((prev) => ({ ...prev, accountId: initialAccountId })); // update accountId filter to reflect query parameter
    } // close guard
  }, [initialAccountId]); // rerun effect when router query value changes
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 }); // pagination metadata stored in state
  const fetchInvoices = useCallback(async () => { // define function fetching invoice data from API
    setLoading(true); // set loading true while fetching
    try { // try/catch for request error handling
      const params = new URLSearchParams(); // instantiate param builder
      params.set("page", pagination.page.toString()); // add page param
      params.set("pageSize", pagination.pageSize.toString()); // add page size param
      Object.entries(filters).forEach(([key, value]) => { // iterate through filter entries
        if (value) { // include only truthy filters
          params.set(key, value); // append filter to query string
        } // close guard
      }); // close loop
      if (permissions.restrictInvoicesToJobs && router.query.jobNumber) { // further restrict data when workshop/parts user passed job number query
        params.set("jobNumber", router.query.jobNumber); // restrict to provided job number for workshop/parts scope
      } // close job restriction guard
      const response = await fetch(`/api/invoices?${params.toString()}`); // call invoice API route with query string
      const payload = await response.json(); // parse JSON response body
      if (!response.ok) { // check HTTP status code
        throw new Error(payload?.message || "Failed to load invoices"); // throw descriptive error
      } // close guard
      setInvoices(payload.data || []); // store invoice rows from payload
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total })); // update pagination total count
    } catch (error) { // catch fetch errors
      console.error("Failed to load invoices", error); // log error to console
    } finally { // cleanup branch executed after try/catch
      setLoading(false); // hide loading state
    } // close finally block
  }, [filters, pagination.page, pagination.pageSize, permissions.restrictInvoicesToJobs, router.query.jobNumber]); // dependencies causing fetch to rerun
  useEffect(() => { // effect hooking into fetch function
    fetchInvoices(); // begin loading invoices whenever dependencies change
  }, [fetchInvoices]); // declare dependency on fetch callback itself
  const handlePageChange = (nextPage) => { // update pagination when user toggles pages
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) })); // clamp page and store new value
  }; // close handlePageChange
  const handleExport = () => { // export currently loaded invoices to CSV
    exportToCsv("invoices.csv", invoices, ["invoice_id", "account_id", "customer_id", "job_number", "grand_total", "payment_status", "due_date"]); // call helper specifying column order
  }; // close handleExport
  return ( // render invoice page structure
    <ProtectedRoute allowedRoles={INVOICE_ROLES}> // enforce allowed roles for invoices page
      <Layout> // wrap page with layout chrome
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // column layout container for page sections
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}> // header row containing title and actions
            <div> // heading container for text content
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Invoices</h1> // page title text
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Search invoices, filter by status, and review overdue balances.</p> // subtitle text describing functionality
            </div>
            <div style={{ display: "flex", gap: "10px" }}> // actions container for navigation buttons
              <button type="button" onClick={handleExport} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export</button> // export CSV button
              <button type="button" onClick={() => router.push("/accounts")} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Accounts</button> // button linking back to accounts list
            </div>
          </div>
          <InvoiceTable invoices={invoices} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} loading={loading} /> // render invoice table with filters/pagination/export wired up
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close component render tree
} // close InvoicesPage definition
