import React, { useMemo, useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  StatusBadge,
  EmptyState,
  MetricPill,
  SectionLabel,
  formatCurrency,
  formatDate,
  widgetButtonStyle,
  widgetGhostButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";
import {
  calculateAfterTaxTotal,
  calculateBasePay,
  calculateIncomeForMonth,
  calculateNationalInsuranceEstimate,
  calculateOvertimeHours,
  calculateOvertimePay,
  calculateTaxEstimate,
  expectedMonthlyContractHours,
} from "@/lib/profile/calculations";

export default function IncomeWidget({
  widget,
  widgetData,
  widgetMonthKey,
  datasets,
  actions,
  onOpenSettings,
  compact = false,
  isMoveMode = false,
  canDrag = false,
  isDraggingWidget = false,
  moveButtonProps = null,
}) {
  const [manualMonthlyIncome, setManualMonthlyIncome] = useState(widgetData?.manualMonthlyIncome || 0);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftCategory, setDraftCategory] = useState("Salary");

  const incomeTransactions = useMemo(
    () => (datasets.transactions || []).filter((transaction) => transaction.type === "income").slice(0, 4),
    [datasets.transactions]
  );

  const monthView = useMemo(
    () =>
      calculateIncomeForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        widgetData,
        workData: datasets.workData,
      }),
    [datasets.transactions, datasets.workData, widgetData, widgetMonthKey]
  );

  const saveManualIncome = async () => {
    await actions.saveWidgetData("income", {
      ...widgetData,
      manualMonthlyIncome: Number(manualMonthlyIncome || 0),
    });
  };

  const addIncomeEntry = async () => {
    if (!draftAmount) return;
    await actions.createTransaction({
      type: "income",
      category: draftCategory || "Salary",
      amount: Number(draftAmount || 0),
      date: new Date().toISOString().split("T")[0],
    });
    setDraftAmount("");
  };

  const settings = widgetData?.settings || {};
  const contractedWeeklyHours = Number(settings.contractedWeeklyHours || datasets.workData?.contractedWeeklyHours || 0);
  const expectedHours = expectedMonthlyContractHours(contractedWeeklyHours);
  const actualHours = Number(datasets.workData?.hoursWorked || 0);
  const overtimeHours = calculateOvertimeHours(actualHours, expectedHours);
  const hourlyRate = Number(settings.hourlyRate || datasets.workData?.hourlyRate || 0);
  const overtimeRate = Number(settings.overtimeRate || datasets.workData?.overtimeRate || hourlyRate);
  const standardHours = Math.min(actualHours, expectedHours);
  const basePay = calculateBasePay(standardHours, hourlyRate);
  const overtimePay = calculateOvertimePay(overtimeHours, overtimeRate);
  const grossPay = Number((basePay + overtimePay).toFixed(2));
  const taxAmount = calculateTaxEstimate(grossPay, Number(settings.taxRate || 0));
  const niAmount = calculateNationalInsuranceEstimate(grossPay, Number(settings.niRate || 0));
  const afterTaxTotal = calculateAfterTaxTotal(grossPay, taxAmount, niAmount);

  return (
    <BaseWidget
      title={widget.config?.title || "Income"}
      subtitle="Estimated pay and tracked income"
      accent="var(--success, #2e7d32)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label={monthView.status} value={formatCurrency(monthView.total)} accent="var(--success, #2e7d32)" />
          <MetricPill
            label="Work estimate"
            value={formatCurrency(datasets.workData?.estimatedIncome || 0)}
            accent="var(--accent-purple)"
          />
        </div>
      }
      onOpenSettings={onOpenSettings}
      compact={compact}
      isMoveMode={isMoveMode}
      canDrag={canDrag}
      isDraggingWidget={isDraggingWidget}
      moveButtonProps={moveButtonProps}
    >
      <SectionLabel>{monthView.label} breakdown</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {monthView.rows.length === 0 ? (
          <EmptyState>No income planned for this month yet.</EmptyState>
        ) : (
          monthView.rows.map((row) => (
            <div key={row.category} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <div style={{ fontWeight: 700 }}>{row.category}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                  <StatusBadge tone={row.isActual ? "positive" : row.isProjected ? "warning" : "info"}>
                    {row.isActual ? "Actual" : row.isProjected ? "Projected" : "Planned"}
                  </StatusBadge>
                </div>
              </div>
              <div style={{ fontWeight: 700, color: "var(--success, #2e7d32)" }}>{formatCurrency(row.amount)}</div>
            </div>
          ))
        )}
      </div>

      <SectionLabel>Detailed pay breakdown</SectionLabel>
      <div style={{ display: "grid", gap: "8px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
        <MetricPill label="Expected monthly hours" value={`${expectedHours.toFixed(2)}h`} accent="var(--info, #1565c0)" />
        <MetricPill label="Overtime (auto)" value={`${overtimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
        <MetricPill label="Base pay" value={formatCurrency(basePay)} accent="var(--success, #2e7d32)" />
        <MetricPill label="Overtime pay" value={formatCurrency(overtimePay)} accent="var(--success, #2e7d32)" />
        <MetricPill label="Tax estimate" value={formatCurrency(taxAmount)} accent="var(--danger, #c62828)" />
        <MetricPill label="NI estimate" value={formatCurrency(niAmount)} accent="var(--danger, #c62828)" />
        <MetricPill label="After tax" value={formatCurrency(afterTaxTotal)} accent="var(--accent-purple)" />
        <MetricPill
          label="After-tax / hr"
          value={actualHours > 0 ? formatCurrency(afterTaxTotal / actualHours) : "—"}
          accent="var(--info, #1565c0)"
        />
      </div>

      <SectionLabel>Manual top-up</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1fr auto" }}>
        <input
          type="number"
          value={manualMonthlyIncome}
          onChange={(event) => setManualMonthlyIncome(event.target.value)}
          style={widgetInputStyle}
          placeholder="Manual monthly income"
        />
        <button type="button" onClick={saveManualIncome} style={widgetButtonStyle}>
          Save
        </button>
      </div>

      <SectionLabel>Add income</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1fr 1fr auto" }}>
        <input
          type="number"
          value={draftAmount}
          onChange={(event) => setDraftAmount(event.target.value)}
          style={widgetInputStyle}
          placeholder="Amount"
        />
        <input
          value={draftCategory}
          onChange={(event) => setDraftCategory(event.target.value)}
          style={widgetInputStyle}
          placeholder="Category"
        />
        <button type="button" onClick={addIncomeEntry} style={widgetGhostButtonStyle}>
          Add
        </button>
      </div>

      <SectionLabel>Recent income</SectionLabel>
      {incomeTransactions.length === 0 ? (
        <EmptyState>No income transactions logged yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {incomeTransactions.map((transaction) => (
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{transaction.category}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{formatDate(transaction.date)}</div>
              </div>
              <div style={{ fontWeight: 700, color: "var(--success, #2e7d32)" }}>
                {formatCurrency(transaction.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
