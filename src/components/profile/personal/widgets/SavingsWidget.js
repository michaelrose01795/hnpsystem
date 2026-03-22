import React, { useMemo, useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  MetricPill,
  SectionLabel,
  formatCurrency,
  formatDate,
  widgetButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";
import {
  calculateProjectedSavingsDateForPlan,
  calculateProjectedSavingsDate,
  calculateSavingsProgress,
  calculateSavingsForMonth,
} from "@/lib/profile/calculations";

export default function SavingsWidget({
  widget,
  widgetData,
  widgetMonthKey,
  datasets,
  actions,
  onRemove,
  onOpenSettings,
  dragHandleProps,
  resizeHandleProps,
  compact = false,
}) {
  const [form, setForm] = useState({
    targetAmount: datasets.savings?.targetAmount || 0,
    currentAmount: datasets.savings?.currentAmount || 0,
    monthlyContribution: datasets.savings?.monthlyContribution || 0,
  });

  const progress = useMemo(() => calculateSavingsProgress(form), [form]);
  const projectedDate = calculateProjectedSavingsDate(form);
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

  const saveSavings = async () => {
    await actions.saveSavings({
      targetAmount: Number(form.targetAmount || 0),
      currentAmount: Number(form.currentAmount || 0),
      monthlyContribution: Number(form.monthlyContribution || 0),
    });
  };

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
      onRemove={onRemove}
      onOpenSettings={onOpenSettings}
      dragHandleProps={dragHandleProps}
      resizeHandleProps={resizeHandleProps}
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

      <SectionLabel>Update savings</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
        <input
          type="number"
          value={form.targetAmount}
          onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Target amount"
        />
        <input
          type="number"
          value={form.currentAmount}
          onChange={(event) => setForm((current) => ({ ...current, currentAmount: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Current amount"
        />
        <input
          type="number"
          value={form.monthlyContribution}
          onChange={(event) => setForm((current) => ({ ...current, monthlyContribution: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Monthly contribution"
        />
      </div>
      <button type="button" onClick={saveSavings} style={{ ...widgetButtonStyle, alignSelf: "flex-start" }}>
        Save savings
      </button>

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
