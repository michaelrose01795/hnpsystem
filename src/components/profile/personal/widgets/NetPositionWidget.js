import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, formatCurrency } from "@/components/profile/personal/widgets/shared";
import { calculateNetPositionForMonth } from "@/lib/profile/calculations";

export default function NetPositionWidget({
  widget,
  widgetData,
  widgetMonthKey,
  widgetDataMap,
  datasets,
  onRemove,
  onOpenSettings,
  compact = false,
  isMoveMode = false,
  canDrag = false,
  isDraggingWidget = false,
  moveButtonProps = null,
}) {
  const monthView = calculateNetPositionForMonth({
    monthKey: widgetMonthKey,
    transactions: datasets.transactions,
    bills: datasets.bills,
    savings: datasets.savings,
    goals: datasets.goals,
    widgetData,
    widgetDataMap,
    workData: datasets.workData,
  });

  return (
    <BaseWidget
      title={widget.config?.title || "Net Position"}
      subtitle="Income minus planned spending"
      accent={monthView.total >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
          <MetricPill label="Income" value={formatCurrency(monthView.monthlyIncome)} accent="var(--success, #2e7d32)" />
          <MetricPill label="Spending" value={formatCurrency(monthView.totalSpending)} accent="var(--danger, #c62828)" />
          <MetricPill
            label="Net"
            value={formatCurrency(monthView.total)}
            accent={monthView.total >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
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
      <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
        Net position combines the selected month's income, planned outgoings, and optional savings contributions so you can spot thin months before they arrive.
      </div>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
        <MetricPill label="Bills included" value={formatCurrency(monthView.billsContribution)} accent="var(--warning, #ef6c00)" />
        <MetricPill label="Savings included" value={formatCurrency(monthView.savingsContribution)} accent="var(--info, #1565c0)" />
      </div>
    </BaseWidget>
  );
}
