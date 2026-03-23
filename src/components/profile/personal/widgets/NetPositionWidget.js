import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, formatCurrency } from "@/components/profile/personal/widgets/shared";

export default function NetPositionWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const previous = finance.model.previousMonth;
  const delta = finance.model.deltaFromPrevious;

  return (
    <BaseWidget
      title={widget.config?.title || "Money Left"}
      subtitle="Total in vs total out for selected month"
      accent={month.totals.difference >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
      monthLabel={finance.model.selectedMonthKey}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <MetricPill label="Total in" value={formatCurrency(month.totals.totalIn)} accent="var(--success, #2e7d32)" />
          <MetricPill label="Total out" value={formatCurrency(month.totals.totalOut)} accent="var(--danger, #c62828)" />
          <MetricPill label="Money left" value={formatCurrency(month.totals.difference)} accent={month.totals.difference >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"} />
          <MetricPill label="Planned saved" value={formatCurrency(month.totals.savingsTotal)} accent="var(--info, #1565c0)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Month comparison</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <MetricPill label="Previous month left" value={formatCurrency(previous.totals.difference)} />
        <MetricPill label="Change" value={formatCurrency(delta)} accent={delta >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"} />
        <MetricPill label="After-tax left" value={formatCurrency(month.totals.moneyLeftAfterTax)} accent="var(--accent-purple)" />
      </div>

      <SectionLabel>Year to date ({finance.model.selectedFinanceYear})</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <MetricPill label="Year total in" value={formatCurrency(finance.model.yearTotals.totalIn)} accent="var(--success, #2e7d32)" />
        <MetricPill label="Year total out" value={formatCurrency(finance.model.yearTotals.totalOut)} accent="var(--danger, #c62828)" />
        <MetricPill label="Year difference" value={formatCurrency(finance.model.yearTotals.difference)} accent={finance.model.yearTotals.difference >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"} />
        <MetricPill label="Year overtime" value={formatCurrency(finance.model.yearTotals.overtimePay)} accent="var(--warning, #ef6c00)" />
      </div>
    </BaseWidget>
  );
}
