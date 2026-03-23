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
import { calculateGoalContributionForMonth, calculateProjectedSavingsDate } from "@/lib/profile/calculations";

export default function MortgageWidget({
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
  const existingGoal = useMemo(
    () => (datasets.goals || []).find((goal) => goal.type === "house") || null,
    [datasets.goals]
  );
  const [form, setForm] = useState({
    target: existingGoal?.target || 0,
    current: existingGoal?.current || 0,
    deadline: existingGoal?.deadline || "",
    monthlyPayment: widgetData?.monthlyPayment || 0,
  });
  const monthView = useMemo(
    () =>
      calculateGoalContributionForMonth({
        monthKey: widgetMonthKey,
        widgetData,
        defaultCategory: "House",
      }),
    [widgetData, widgetMonthKey]
  );

  const projectedDate = calculateProjectedSavingsDate({
    targetAmount: form.target,
    currentAmount: form.current,
    monthlyContribution: widgetData?.monthlyContribution || datasets.savings?.monthlyContribution || 0,
  });

  const saveMortgage = async () => {
    if (existingGoal?.id) {
      await actions.updateGoal({
        id: existingGoal.id,
        type: "house",
        target: Number(form.target || 0),
        current: Number(form.current || 0),
        deadline: form.deadline || null,
      });
    } else {
      await actions.createGoal({
        type: "house",
        target: Number(form.target || 0),
        current: Number(form.current || 0),
        deadline: form.deadline || null,
      });
    }

    await actions.saveWidgetData("mortgage", {
      ...widgetData,
      monthlyPayment: Number(form.monthlyPayment || 0),
    });
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Mortgage"}
      subtitle="House deposit and payment planning"
      accent="var(--text-primary)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Deposit target" value={formatCurrency(form.target)} />
          <MetricPill label={monthView.status} value={formatCurrency(monthView.total || form.monthlyPayment)} accent="var(--warning, #ef6c00)" />
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
      <SectionLabel>House goal</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
        <input
          type="number"
          value={form.target}
          onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Target"
        />
        <input
          type="number"
          value={form.current}
          onChange={(event) => setForm((current) => ({ ...current, current: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Current"
        />
        <input
          type="date"
          value={form.deadline}
          onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
          style={widgetInputStyle}
        />
        <input
          type="number"
          value={form.monthlyPayment}
          onChange={(event) => setForm((current) => ({ ...current, monthlyPayment: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Monthly payment"
        />
      </div>
      <button type="button" onClick={saveMortgage} style={{ ...widgetButtonStyle, alignSelf: "flex-start" }}>
        Save mortgage view
      </button>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
        <MetricPill label="Deadline" value={form.deadline ? formatDate(form.deadline) : "No deadline"} accent="var(--info, #1565c0)" />
        <MetricPill label="Projected" value={projectedDate ? formatDate(projectedDate) : "No projection"} accent="var(--success, #2e7d32)" />
      </div>
    </BaseWidget>
  );
}
