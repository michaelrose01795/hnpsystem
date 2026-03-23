import React, { useMemo, useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  MetricPill,
  SectionLabel,
  StatusBadge,
  formatCurrency,
  formatDate,
  widgetButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";
import { calculateSpendingForMonth } from "@/lib/profile/calculations";

export default function SpendingWidget({
  widget,
  widgetData,
  widgetMonthKey,
  datasets,
  actions,
  onRemove,
  onOpenSettings,
  compact = false,
  isMoveMode = false,
  canDrag = false,
  isDraggingWidget = false,
  moveButtonProps = null,
}) {
  const [draftAmount, setDraftAmount] = useState("");
  const [draftCategory, setDraftCategory] = useState("General");
  const monthView = useMemo(
    () =>
      calculateSpendingForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        bills: datasets.bills,
        widgetData,
      }),
    [datasets.bills, datasets.transactions, widgetData, widgetMonthKey]
  );
  const categoryTotals = Object.fromEntries(monthView.rows.map((row) => [row.category, row.amount]));
  const recentExpenses = useMemo(
    () => (datasets.transactions || []).filter((transaction) => transaction.type === "expense").slice(0, 5),
    [datasets.transactions]
  );
  const topCategory = Object.entries(categoryTotals).sort((left, right) => right[1] - left[1])[0];

  const addExpense = async () => {
    if (!draftAmount) return;
    await actions.createTransaction({
      type: "expense",
      category: draftCategory || "General",
      amount: Number(draftAmount || 0),
      date: new Date().toISOString().split("T")[0],
    });
    setDraftAmount("");
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Spending"}
      subtitle="Monthly outgoings and expense capture"
      accent="var(--danger, #c62828)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label={monthView.status} value={formatCurrency(monthView.total)} accent="var(--danger, #c62828)" />
          <MetricPill
            label="Top category"
            value={topCategory ? `${topCategory[0]} (${formatCurrency(topCategory[1])})` : "No data"}
            accent="var(--warning, #ef6c00)"
          />
        </div>
      }
      onRemove={onRemove}
      onOpenSettings={onOpenSettings}
      compact={compact}
      isMoveMode={isMoveMode}
      canDrag={canDrag}
      isDraggingWidget={isDraggingWidget}
      moveButtonProps={moveButtonProps}
    >
      <SectionLabel>{monthView.label} plan</SectionLabel>
      {monthView.rows.length === 0 ? (
        <EmptyState>No spending plan for this month yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {monthView.rows.map((row) => (
            <div key={row.category} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <div style={{ fontWeight: 700 }}>{row.category}</div>
                <StatusBadge tone={row.isActual ? "positive" : row.isProjected ? "warning" : "info"}>
                  {row.isActual ? "Actual" : row.isProjected ? "Projected" : "Planned"}
                </StatusBadge>
              </div>
              <div style={{ fontWeight: 700, color: "var(--danger, #c62828)" }}>{formatCurrency(row.amount)}</div>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>Quick expense</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1fr 1fr auto" }}>
        <input
          type="number"
          value={draftAmount}
          onChange={(event) => setDraftAmount(event.target.value)}
          style={widgetInputStyle}
          placeholder="Amount"
        />
        <input
          value={draftCategory}
          onChange={(event) => setDraftCategory(event.target.value)}
          style={widgetInputStyle}
          placeholder="Category"
        />
        <button type="button" onClick={addExpense} style={widgetButtonStyle}>
          Add
        </button>
      </div>

      <SectionLabel>Recent expenses</SectionLabel>
      {recentExpenses.length === 0 ? (
        <EmptyState>No expenses logged yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {recentExpenses.map((transaction) => (
            <div
              key={transaction.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: "14px",
                background: "rgba(var(--accent-purple-rgb), 0.04)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{transaction.category}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{formatDate(transaction.date)}</div>
              </div>
              <div style={{ fontWeight: 700, color: "var(--danger, #c62828)" }}>{formatCurrency(transaction.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
