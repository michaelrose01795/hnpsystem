import React, { useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  MetricPill,
  SectionLabel,
  StatusBadge,
  formatCurrency,
  widgetButtonStyle,
  widgetGhostButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";
import { calculateBillsForMonth } from "@/lib/profile/calculations";

export default function BillsWidget({
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
    name: "",
    amount: "",
    dueDay: "1",
  });

  const monthView = calculateBillsForMonth({
    monthKey: widgetMonthKey,
    bills: datasets.bills,
    widgetData,
  });

  const addBill = async () => {
    if (!form.name || !form.amount) return;
    await actions.createBill({
      name: form.name,
      amount: Number(form.amount || 0),
      dueDay: Number(form.dueDay || 1),
      isRecurring: true,
    });
    setForm({ name: "", amount: "", dueDay: "1" });
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Bills"}
      subtitle="Recurring monthly commitments"
      accent="var(--warning, #ef6c00)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <MetricPill label={monthView.status} value={formatCurrency(monthView.total)} accent="var(--warning, #ef6c00)" />
      }
      onRemove={onRemove}
      onOpenSettings={onOpenSettings}
      dragHandleProps={dragHandleProps}
      resizeHandleProps={resizeHandleProps}
      compact={compact}
    >
      <SectionLabel>{monthView.label} plan</SectionLabel>
      {monthView.rows.length === 0 ? (
        <EmptyState>No bill plan for this month yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {monthView.rows.map((row) => (
            <div key={row.category} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <div style={{ fontWeight: 700 }}>{row.category}</div>
                <StatusBadge tone={row.isProjected ? "warning" : "info"}>
                  {row.isProjected ? "Projected" : "Planned"}
                </StatusBadge>
              </div>
              <div style={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</div>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>Add recurring bill</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1.4fr 1fr 1fr auto" }}>
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Bill name"
        />
        <input
          type="number"
          value={form.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Amount"
        />
        <input
          type="number"
          min="1"
          max="31"
          value={form.dueDay}
          onChange={(event) => setForm((current) => ({ ...current, dueDay: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Due day"
        />
        <button type="button" onClick={addBill} style={widgetButtonStyle}>
          Add
        </button>
      </div>

      <SectionLabel>Upcoming bills</SectionLabel>
      {(datasets.bills || []).length === 0 ? (
        <EmptyState>No bills added yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {(datasets.bills || []).map((bill) => (
            <div
              key={bill.id}
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
                <div style={{ fontWeight: 700 }}>{bill.name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Due on day {bill.dueDay}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ fontWeight: 700 }}>{formatCurrency(bill.amount)}</div>
                <button type="button" onClick={() => actions.deleteBill(bill.id)} style={widgetGhostButtonStyle}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
