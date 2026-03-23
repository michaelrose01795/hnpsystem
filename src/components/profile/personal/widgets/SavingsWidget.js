import React, { useMemo, useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  MetricPill,
  SectionLabel,
  formatCurrency,
  formatDate,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";
import {
  calculateAllSavingsTotal,
  calculateProjectedSavingsDateForPlan,
  calculateProjectedSavingsDate,
  calculateSavingsAccountTotal,
  calculateSavingsProgress,
  calculateSavingsForMonth,
} from "@/lib/profile/calculations";

export default function SavingsWidget({
  widget,
  widgetData,
  widgetMonthKey,
  datasets,
  actions,
  onOpenSettings,
  compact = false,
}) {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accountAmount, setAccountAmount] = useState("");
  const accounts = widgetData?.settings?.savingsAccounts || [];
  const accountEntries = Array.isArray(widgetData?.accountEntries) ? widgetData.accountEntries : [];
  const selectedAccountName = selectedAccount || accounts[0]?.name || "";
  const accountTotal = calculateSavingsAccountTotal(accountEntries, selectedAccountName);
  const allSavingsTotal = calculateAllSavingsTotal(accountEntries);

  const progress = useMemo(() => calculateSavingsProgress(datasets.savings), [datasets.savings]);
  const projectedDate = calculateProjectedSavingsDate(datasets.savings);
  const monthView = useMemo(
    () =>
      calculateSavingsForMonth({
        monthKey: widgetMonthKey,
        savings: datasets.savings,
        goals: datasets.goals,
        widgetData,
      }),
    [datasets.goals, datasets.savings, widgetData, widgetMonthKey]
  );
  const projectedPlanDate = useMemo(
    () =>
      calculateProjectedSavingsDateForPlan({
        monthKey: widgetMonthKey,
        savings: datasets.savings,
        goals: datasets.goals,
        widgetData,
      }),
    [datasets.goals, datasets.savings, widgetData, widgetMonthKey]
  );


  return (
    <BaseWidget
      title={widget.config?.title || "Savings"}
      subtitle="Target tracking and contribution pace"
      accent="var(--info, #1565c0)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
          <MetricPill label="Current" value={formatCurrency(progress.currentAmount)} accent="var(--success, #2e7d32)" />
          <MetricPill label="Target" value={formatCurrency(progress.targetAmount)} accent="var(--accent-purple)" />
          <MetricPill label={monthView.status} value={formatCurrency(monthView.total)} accent="var(--info, #1565c0)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
      compact={compact}
    >
      <SectionLabel>{monthView.label} categories</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {monthView.rows.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            No savings rules for this month yet. Open settings to add recurring categories or a one-off override.
          </div>
        ) : (
          monthView.rows.map((row) => (
            <div key={row.category} style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>{row.category}</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</span>
            </div>
          ))
        )}
      </div>

      <SectionLabel>Account contributions</SectionLabel>
      {accounts.length === 0 ? (
        <EmptyState>Add savings accounts in widget settings (for example: Lloyds, Tembo ISA, Club Saver).</EmptyState>
      ) : (
        <>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1fr 1fr auto" }}>
            <select value={selectedAccountName} onChange={(event) => setSelectedAccount(event.target.value)} style={widgetInputStyle}>
              {accounts.map((account) => (
                <option key={account.name} value={account.name}>
                  {account.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={accountAmount}
              onChange={(event) => setAccountAmount(event.target.value)}
              style={widgetInputStyle}
              placeholder="Contribution amount"
            />
            <button
              type="button"
              onClick={async () => {
                if (!selectedAccountName || !accountAmount) return;
                const nextEntries = [
                  ...accountEntries,
                  {
                    id: `${Date.now()}`,
                    monthKey: widgetMonthKey,
                    accountName: selectedAccountName,
                    amount: Number(accountAmount || 0),
                  },
                ];
                await actions.saveWidgetData("savings", {
                  ...widgetData,
                  accountEntries: nextEntries,
                });
                setAccountAmount("");
              }}
              style={widgetButtonStyle}
            >
              Add
            </button>
          </div>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
            <MetricPill label="All accounts total" value={formatCurrency(allSavingsTotal)} accent="var(--success, #2e7d32)" />
            <MetricPill label={`${selectedAccountName || "Account"} total`} value={formatCurrency(accountTotal)} accent="var(--info, #1565c0)" />
          </div>
        </>
      )}

      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
        <MetricPill label="Remaining" value={formatCurrency(progress.remainingAmount)} accent="var(--warning, #ef6c00)" />
        <MetricPill
          label="Projected"
          value={projectedPlanDate ? formatDate(projectedPlanDate) : projectedDate ? formatDate(projectedDate) : "No projection"}
          accent="var(--success, #2e7d32)"
        />
      </div>
    </BaseWidget>
  );
}
