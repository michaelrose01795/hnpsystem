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
import { calculateFuelEntryValues, calculateFuelForMonth } from "@/lib/profile/calculations";

export default function FuelWidget({
  widget,
  widgetData,
  widgetMonthKey,
  datasets,
  actions,
  onOpenSettings,
  dragHandleProps,
  resizeHandleProps,
  compact = false,
  isInteracting = false,
  isActiveInteractionWidget = false,
  interactionMode = null,
}) {
  const [draft, setDraft] = useState({ totalCost: "", litres: "", pricePerLitre: "" });
  const [draftAmount, setDraftAmount] = useState("");
  const fuelTransactions = useMemo(
    () => (datasets.transactions || []).filter((transaction) => transaction.category === "Fuel").slice(0, 5),
    [datasets.transactions]
  );
  const monthView = useMemo(
    () =>
      calculateFuelForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        widgetData,
      }),
    [datasets.transactions, widgetData, widgetMonthKey]
  );
  const previousMonthDate = useMemo(() => {
    const date = new Date(`${widgetMonthKey}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return new Date();
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }, [widgetMonthKey]);
  const fuelThisMonth = monthView.total;
  const fuelLastMonth = calculateFuelForMonth({
    monthKey: previousMonthDate,
    transactions: datasets.transactions,
    widgetData,
  }).total;

  const delta = fuelThisMonth - fuelLastMonth;

  const addFuelExpense = async () => {
    if (!draftAmount) return;
    await actions.createTransaction({
      type: "expense",
      category: "Fuel",
      amount: Number(draftAmount || 0),
      date: new Date().toISOString().split("T")[0],
    });
    setDraftAmount("");
  };

  const addFuelEntry = async () => {
    const computed = calculateFuelEntryValues(draft);
    if (!computed.totalCost || !computed.litres || !computed.pricePerLitre) return;
    await actions.saveWidgetData("fuel", {
      ...widgetData,
      fuelEntries: [
        ...(Array.isArray(widgetData?.fuelEntries) ? widgetData.fuelEntries : []),
        {
          id: `${Date.now()}`,
          monthKey: widgetMonthKey,
          ...computed,
        },
      ],
    });
    setDraft({ totalCost: "", litres: "", pricePerLitre: "" });
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Fuel"}
      subtitle="Fuel cost tracking"
      accent="var(--warning, #ff8f00)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="This month" value={formatCurrency(fuelThisMonth)} accent="var(--warning, #ff8f00)" />
          <MetricPill
            label="Change"
            value={delta === 0 ? "Flat" : `${delta > 0 ? "+" : ""}${formatCurrency(delta)}`}
            accent={delta > 0 ? "var(--danger, #c62828)" : "var(--success, #2e7d32)"}
          />
        </div>
      }
      onOpenSettings={onOpenSettings}
      dragHandleProps={dragHandleProps}
      resizeHandleProps={resizeHandleProps}
      compact={compact}
      isInteracting={isInteracting}
      isActiveInteractionWidget={isActiveInteractionWidget}
      interactionMode={interactionMode}
    >
      <SectionLabel>{monthView.label} fuel plan</SectionLabel>
      {monthView.rows.length === 0 ? (
        <EmptyState>No fuel plan for this month yet.</EmptyState>
      ) : (
        monthView.rows.map((row) => (
          <div key={row.category} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "grid", gap: "4px" }}>
              <div style={{ fontWeight: 700 }}>{row.category}</div>
              <StatusBadge tone={row.isActual ? "positive" : row.isProjected ? "warning" : "info"}>
                {row.isActual ? "Actual" : row.isProjected ? "Projected" : "Planned"}
              </StatusBadge>
            </div>
            <div style={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</div>
          </div>
        ))
      )}

      <SectionLabel>Add fuel spend</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1fr auto" }}>
        <input
          type="number"
          value={draftAmount}
          onChange={(event) => setDraftAmount(event.target.value)}
          style={widgetInputStyle}
          placeholder="Fuel amount"
        />
        <button type="button" onClick={addFuelExpense} style={widgetButtonStyle}>
          Add
        </button>
      </div>

      <SectionLabel>Fuel entry calculator</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr)) auto" }}>
        <input
          type="number"
          value={draft.totalCost}
          onChange={(event) => setDraft((current) => ({ ...current, totalCost: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Total cost"
        />
        <input
          type="number"
          value={draft.litres}
          onChange={(event) => setDraft((current) => ({ ...current, litres: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Litres"
        />
        <input
          type="number"
          value={draft.pricePerLitre}
          onChange={(event) => setDraft((current) => ({ ...current, pricePerLitre: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Price / litre"
        />
        <button type="button" onClick={addFuelEntry} style={widgetButtonStyle}>
          Save
        </button>
      </div>

      <SectionLabel>Recent fuel entries</SectionLabel>
      {fuelTransactions.length === 0 ? (
        <EmptyState>No fuel entries yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {fuelTransactions.map((transaction) => (
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
              <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>{formatDate(transaction.date)}</div>
              <div style={{ fontWeight: 700 }}>{formatCurrency(transaction.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
