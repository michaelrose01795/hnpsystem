// file location: src/pages/accounts/transactions/[accountId].js // header comment with file path
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks for state and lifecycle
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import TransactionTable from "@/components/accounts/TransactionTable";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { exportToCsv } from "@/utils/exportUtils";
const TRANSACTION_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER", "SALES"];
export default function AccountTransactionsPage() {
  const router = useRouter();
  const { accountId } = router.query;
  const { user } = useUser();
  const permissions = useMemo(() => deriveAccountPermissions(user?.roles || []), [user]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", payment_method: "", from: "", to: "" });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const fetchTransactions = useCallback(async () => {
    if (!accountId) return;
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
      const response = await fetch(`/api/accounts/${accountId}/transactions?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load transactions");
      }
      setTransactions(payload.data || []);
      setPagination((prev) => ({ ...prev, total: payload.pagination?.total || prev.total }));
    } catch (error) {
      console.error("Failed to load transactions", error);
    } finally {
      setLoading(false);
    }
  }, [accountId, filters, pagination.page, pagination.pageSize]);
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);
  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, nextPage) }));
  };
  const handleExport = () => {
    exportToCsv(`account-${accountId}-transactions.csv`, transactions, ["transaction_id", "transaction_date", "type", "amount", "payment_method", "job_number", "created_by"]);
  };
  return (
    <ProtectedRoute allowedRoles={TRANSACTION_ROLES}>
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Account {accountId}</p>
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Transactions</h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Filter ledger entries, export to CSV, and trace adjustments.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => router.push(`/accounts/view/${accountId}`)} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>Account</button>
              {permissions.canExport && <button type="button" onClick={handleExport} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontWeight: 600 }}>Export</button>}
            </div>
          </div>
          <TransactionTable transactions={transactions} loading={loading} filters={filters} onFilterChange={setFilters} pagination={pagination} onPageChange={handlePageChange} onExport={handleExport} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
