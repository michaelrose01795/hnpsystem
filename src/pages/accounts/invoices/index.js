// file location: src/pages/accounts/invoices/index.js // header comment referencing file path
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
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
        <DevLayoutSection sectionKey="accounts-invoices-page-shell" sectionType="page-shell" shell>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <DevLayoutSection
              as="div"
              sectionKey="accounts-invoices-header-actions"
              sectionType="toolbar"
              parentKey="accounts-invoices-page-shell"
              style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap", alignItems: "center" }}
            >
              <Button type="button" variant="secondary" onClick={handleExport}>
                Export
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/accounts")}
                style={{
                  background: "rgba(var(--primary-rgb), 0.12)",
                  borderColor: "rgba(var(--primary-rgb), 0.28)",
                  color: "var(--primary-dark)",
                }}
              >
                Accounts
              </Button>
            </DevLayoutSection>
            <DevLayoutSection sectionKey="accounts-invoices-table" sectionType="data-table" parentKey="accounts-invoices-page-shell">
              <InvoiceTable invoices={invoices} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} loading={loading} accentSurface />
            </DevLayoutSection>
          </div>
        </DevLayoutSection>
      </Layout>
    </ProtectedRoute>
  );
}
