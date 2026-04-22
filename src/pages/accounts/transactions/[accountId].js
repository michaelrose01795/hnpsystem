// file location: src/pages/accounts/transactions/[accountId].js
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks for state and lifecycle
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import TransactionTable from "@/components/accounts/TransactionTable";
import { Button, ControlGroup, PageSection } from "@/components/ui";
import { useUser } from "@/context/UserContext";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { exportToCsv } from "@/utils/exportUtils";
import AccountTransactionsPageUi from "@/components/page-ui/accounts/transactions/accounts-transactions-account-id-ui"; // Extracted presentation layer.
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
  return <AccountTransactionsPageUi view="section1" accountId={accountId} Button={Button} ControlGroup={ControlGroup} filters={filters} handleExport={handleExport} handlePageChange={handlePageChange} loading={loading} PageSection={PageSection} pagination={pagination} permissions={permissions} ProtectedRoute={ProtectedRoute} router={router} setFilters={setFilters} TRANSACTION_ROLES={TRANSACTION_ROLES} transactions={transactions} TransactionTable={TransactionTable} />;














}
