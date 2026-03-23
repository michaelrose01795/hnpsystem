import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, formatCurrency, widgetGhostButtonStyle, widgetInputStyle } from "@/components/profile/personal/widgets/shared";

function numberValue(value) {
  return Number(value || 0);
}

export default function SavingsWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;

  return (
    <BaseWidget
      title={widget.config?.title || "Savings / Pots"}
      subtitle="Monthly savings allocations and pot tracking"
      accent="var(--info, #1565c0)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Saved this month" value={formatCurrency(month.totals.savingsTotal)} accent="var(--info, #1565c0)" />
          <MetricPill label="Year planned savings" value={formatCurrency(finance.model.yearTotals.savingsTotal)} accent="var(--success, #2e7d32)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Pot allocations (Payments sheet style)</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.savingsBuckets.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.6fr 1fr auto" }}>
            <input style={widgetInputStyle} value={entry.name || ""} placeholder="Pot name" onChange={(event) => finance.updateSavingsBucket(entry.id, { name: event.target.value })} />
            <input type="number" style={widgetInputStyle} value={entry.amount || 0} placeholder="Amount" onChange={(event) => finance.updateSavingsBucket(entry.id, { amount: numberValue(event.target.value) })} />
            <button type="button" style={widgetGhostButtonStyle} onClick={() => finance.removeSavingsBucket(entry.id)}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" style={widgetGhostButtonStyle} onClick={finance.addSavingsBucket}>Add savings pot</button>
    </BaseWidget>
  );
}
