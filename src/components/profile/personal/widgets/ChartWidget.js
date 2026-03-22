import React, { useMemo } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  SectionLabel,
  widgetButtonStyle,
} from "@/components/profile/personal/widgets/shared";
import {
  calculateIncomeForMonth,
  calculateProjectedTimeline,
  calculateSpendingForMonth,
} from "@/lib/profile/calculations";
import { formatMonthLabel } from "@/lib/profile/monthPlanning";

function BarChart({ items = [] }) {
  const maxValue = items.reduce((largest, item) => Math.max(largest, item.value), 0) || 1;

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "grid", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "0.82rem" }}>
            <span>{item.label}</span>
            <span style={{ fontWeight: 700 }}>{item.value.toFixed(2)}</span>
          </div>
          <div
            style={{
              height: "10px",
              borderRadius: "999px",
              background: "rgba(var(--accent-purple-rgb), 0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                height: "100%",
                borderRadius: "999px",
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChartWidget({
  widget,
  widgetData,
  widgetMonthKey,
  widgetDataMap,
  datasets,
  actions,
  onRemove,
  onOpenSettings,
  dragHandleProps,
  resizeHandleProps,
  compact = false,
}) {
  const source = widgetData?.source || "spendingByCategory";

  const chartItems = useMemo(() => {
    if (source === "incomeVsSpending") {
      const income = calculateIncomeForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        widgetData: widgetData,
        workData: datasets.workData,
      }).total;
      const spending = calculateSpendingForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        bills: datasets.bills,
        widgetData: widgetDataMap?.spending?.data || {},
      }).total;
      return [
        { label: "Income", value: income, color: "var(--success, #2e7d32)" },
        { label: "Spending", value: spending, color: "var(--danger, #c62828)" },
      ];
    }

    if (source === "goalsProgress") {
      return (datasets.goals || []).map((goal) => ({
        label: goal.type,
        value: Number(goal.current || 0),
        color: "var(--info, #1565c0)",
      }));
    }

    if (source === "timeline") {
      return calculateProjectedTimeline({
        startMonth: widgetMonthKey,
        endMonth: (() => {
          const date = new Date(`${widgetMonthKey}-01T00:00:00`);
          if (Number.isNaN(date.getTime())) return widgetMonthKey;
          date.setMonth(date.getMonth() + 5);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        })(),
        datasets,
        widgetDataMap,
      }).map((entry) => ({
        label: formatMonthLabel(entry.monthKey),
        value: entry.net,
        color: entry.net >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)",
      }));
    }

    return calculateSpendingForMonth({
      monthKey: widgetMonthKey,
      transactions: datasets.transactions,
      bills: datasets.bills,
      widgetData: widgetDataMap?.spending?.data || {},
    }).rows.map((row) => ({
      label: row.category,
      value: Number(row.amount || 0),
      color: "var(--accent-purple)",
    }));
  }, [datasets, source, widgetData, widgetDataMap, widgetMonthKey]);

  const saveSource = async (nextSource) => {
    await actions.saveWidgetData("chart", {
      ...widgetData,
      source: nextSource,
    });
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Chart"}
      subtitle="Visual dashboard snapshot"
      accent="var(--info, #1e88e5)"
      monthLabel={formatMonthLabel(widgetMonthKey)}
      statusLabel="Planned"
      onRemove={onRemove}
      onOpenSettings={onOpenSettings}
      dragHandleProps={dragHandleProps}
      resizeHandleProps={resizeHandleProps}
      compact={compact}
    >
      <SectionLabel>Chart source</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[
          ["spendingByCategory", "Spending"],
          ["incomeVsSpending", "Income vs spending"],
          ["goalsProgress", "Goals"],
          ["timeline", "Timeline"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => saveSource(value)}
            style={{
              ...widgetButtonStyle,
              background: source === value ? "var(--accent-purple)" : "rgba(var(--accent-purple-rgb), 0.1)",
              color: source === value ? "#ffffff" : "var(--text-primary)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {chartItems.length === 0 ? <EmptyState>No chart data available yet.</EmptyState> : <BarChart items={chartItems} />}
    </BaseWidget>
  );
}
