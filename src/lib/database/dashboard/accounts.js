import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

const isCredit = (type) => String(type || "").toLowerCase() === "credit";

export const getAccountsDashboardData = async () => {
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [
    raisedRes,
    paidRes,
    outstandingJobs,
    completionRows,
    weekTransactions,
    recentTransactions,
    accountRows,
  ] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "Invoiced")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "Collected")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,status,customer_id,updated_at")
        .in("status", ["Complete", "Completed"])
        .order("updated_at", { ascending: false })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("completed_at")
        .gte("completed_at", weekStart)
    ),
    // Transactions in the last 7 days — used for the cashflow totals.
    runQuery(() =>
      supabase
        .from("account_transactions")
        .select("amount,type,payment_method,transaction_date")
        .gte("transaction_date", weekStart)
    ),
    // Most recent transactions regardless of age — feeds the activity table.
    runQuery(() =>
      supabase
        .from("account_transactions")
        .select("transaction_date,amount,type,description,job_number,payment_method")
        .order("transaction_date", { ascending: false })
        .limit(8)
    ),
    // Active customer accounts — feeds the credit watchlist and debt totals.
    runQuery(() =>
      supabase
        .from("accounts")
        .select("account_id,billing_name,balance,credit_limit,account_type,status")
        .eq("status", "Active")
    ),
  ]);

  // Cashflow totals for the last 7 days.
  const weeklyRevenue = weekTransactions
    .filter((row) => isCredit(row.type))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const weeklyOutgoing = weekTransactions
    .filter((row) => !isCredit(row.type))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paymentsReceived = weekTransactions.filter((row) => isCredit(row.type)).length;

  // Credit watchlist — accounts ordered by how much of their limit is used.
  const usage = (account) => {
    const limit = Number(account.credit_limit || 0);
    if (limit <= 0) return 0;
    return Number(account.balance || 0) / limit;
  };
  const creditAccounts = [...accountRows]
    .sort((a, b) => usage(b) - usage(a))
    .slice(0, 6);
  const outstandingDebt = accountRows
    .filter((row) => Number(row.balance || 0) > 0)
    .reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const accountsAtRisk = accountRows.filter((row) => usage(row) >= 0.8).length;

  return {
    invoicesRaised: raisedRes.count || 0,
    invoicesPaid: paidRes.count || 0,
    outstandingJobs,
    trends: buildSevenDaySeries(completionRows, "completed_at"),
    weeklyRevenue,
    weeklyOutgoing,
    paymentsReceived,
    recentTransactions,
    creditAccounts,
    outstandingDebt,
    accountsAtRisk,
  };
};
