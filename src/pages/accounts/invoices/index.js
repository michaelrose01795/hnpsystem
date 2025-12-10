// file location: src/pages/accounts/invoices/index.js // header comment referencing file path
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { exportToCsv } from "@/utils/exportUtils";
const INVOICE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "SALES", "WORKSHOP", "WORKSHOP MANAGER", "PARTS", "PARTS MANAGER"];
export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useUser();
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialAccountId = typeof router.query.accountId === "string" ? router.query.accountId : "";
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "", accountId: initialAccountId });
  useEffect(() => {
    if (initialAccountId) {
      setFilters((prev) => ({ ...prev, accountId: initialAccountId }));
    }
  }, [initialAccountId]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      if (permissions.restrictInvoicesToJobs && router.query.jobNumber) {
        params.set("jobNumber", router.query.jobNumber);
      }
      const response = await fetch(`/api/invoices?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load invoices");
      }
      setInvoices(payload.data || []);
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total }));
    } catch (error) {
      console.error("Failed to load invoices", error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize, permissions.restrictInvoicesToJobs, router.query.jobNumber]);
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);
  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }));
  };
  const handleExport = () => {
    exportToCsv("invoices.csv", invoices, ["invoice_id", "account_id", "customer_id", "job_number", "grand_total", "payment_status", "due_date"]);
  };
  return (
    <ProtectedRoute allowedRoles={INVOICE_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Invoices</h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Search invoices, filter by status, and review overdue balances.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={handleExport} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export</button>
              <button type="button" onClick={() => router.push("/accounts")} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Accounts</button>
            </div>
          </div>
          <InvoiceTable invoices={invoices} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} loading={loading} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
