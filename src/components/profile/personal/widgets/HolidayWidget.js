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
import { calculateGoalContributionForMonth } from "@/lib/profile/calculations";

export default function HolidayWidget({
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
    () => (datasets.goals || []).find((goal) => goal.type === "holiday") || null,
    [datasets.goals]
  );
  const [form, setForm] = useState({
    target: existingGoal?.target || 0,
    current: existingGoal?.current || 0,
    deadline: existingGoal?.deadline || "",
  });
  const monthView = useMemo(
    () =>
      calculateGoalContributionForMonth({
        monthKey: widgetMonthKey,
        widgetData,
        defaultCategory: "Holiday",
      }),
    [widgetData, widgetMonthKey]
  );

  const saveHoliday = async () => {
    if (existingGoal?.id) {
      await actions.updateGoal({
        id: existingGoal.id,
        type: "holiday",
        target: Number(form.target || 0),
        current: Number(form.current || 0),
        deadline: form.deadline || null,
      });
    } else {
      await actions.createGoal({
        type: "holiday",
        target: Number(form.target || 0),
        current: Number(form.current || 0),
        deadline: form.deadline || null,
      });
    }
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Holiday"}
      subtitle="Trip fund tracking"
      accent="var(--info, #00838f)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
          <MetricPill label="Saved" value={formatCurrency(form.current)} accent="var(--success, #2e7d32)" />
          <MetricPill label="Target" value={formatCurrency(form.target)} accent="var(--accent-purple)" />
          <MetricPill label={monthView.status} value={formatCurrency(monthView.total)} accent="var(--info, #00838f)" />
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
      <SectionLabel>Holiday goal</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
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
      </div>
      <button type="button" onClick={saveHoliday} style={{ ...widgetButtonStyle, alignSelf: "flex-start" }}>
        Save holiday goal
      </button>
      <MetricPill label="Deadline" value={form.deadline ? formatDate(form.deadline) : "No deadline"} accent="var(--info, #1565c0)" />
    </BaseWidget>
  );
}
