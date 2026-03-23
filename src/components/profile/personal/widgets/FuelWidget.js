import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, formatCurrency, widgetGhostButtonStyle, widgetInputStyle } from "@/components/profile/personal/widgets/shared";

function numberValue(value) {
  return Number(value || 0);
}

export default function FuelWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;

  return (
    <BaseWidget
      title={widget.config?.title || "Credit Cards"}
      subtitle="Balances, monthly card payments, and outgoing impact"
      accent="var(--accent-purple)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Card payments" value={formatCurrency(month.totals.creditCardOut)} accent="var(--accent-purple)" />
          <MetricPill label="Total card balances" value={formatCurrency(month.monthState.creditCards.reduce((sum, card) => sum + Number(card.balance || 0), 0))} accent="var(--danger, #c62828)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Card accounts</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.creditCards.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.2fr 1fr 1fr auto" }}>
            <input style={widgetInputStyle} value={entry.name || ""} placeholder="Card name" onChange={(event) => finance.updateCreditCard(entry.id, { name: event.target.value })} />
            <input type="number" style={widgetInputStyle} value={entry.balance || 0} placeholder="Balance" onChange={(event) => finance.updateCreditCard(entry.id, { balance: numberValue(event.target.value) })} />
            <input type="number" style={widgetInputStyle} value={entry.monthlyPayment || 0} placeholder="Monthly pay" onChange={(event) => finance.updateCreditCard(entry.id, { monthlyPayment: numberValue(event.target.value) })} />
            <button type="button" style={widgetGhostButtonStyle} onClick={() => finance.removeCreditCard(entry.id)}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" style={widgetGhostButtonStyle} onClick={finance.addCreditCard}>Add credit card</button>
    </BaseWidget>
  );
}
