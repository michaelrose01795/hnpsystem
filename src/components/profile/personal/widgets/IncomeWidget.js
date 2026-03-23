import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, formatCurrency, widgetInputStyle } from "@/components/profile/personal/widgets/shared";

function numberValue(value) {
  return Number(value || 0);
}

export default function IncomeWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const pay = finance.financeState.paySettings || {};

  return (
    <BaseWidget
      title={widget.config?.title || "Income Summary"}
      subtitle="Salary settings and monthly income projection"
      accent="var(--success, #2e7d32)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <MetricPill label="Base pay" value={formatCurrency(month.pay.basePay)} accent="var(--success, #2e7d32)" />
          <MetricPill label="Overtime pay" value={formatCurrency(month.pay.overtimePay)} accent="var(--warning, #ef6c00)" />
          <MetricPill label="Other income" value={formatCurrency(month.totals.classicIncome)} accent="var(--info, #1565c0)" />
          <MetricPill label="Total in" value={formatCurrency(month.totals.totalIn)} accent="var(--success, #2e7d32)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Pay / salary settings</SectionLabel>
      <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <label>
          <div style={{ fontSize: "0.74rem", marginBottom: "4px" }}>Contracted weekly hours</div>
          <input type="number" style={widgetInputStyle} value={pay.contractedWeeklyHours || 0} onChange={(event) => finance.updatePaySetting("contractedWeeklyHours", numberValue(event.target.value))} />
        </label>
        <label>
          <div style={{ fontSize: "0.74rem", marginBottom: "4px" }}>Hourly rate (£)</div>
          <input type="number" style={widgetInputStyle} value={pay.hourlyRate || 0} onChange={(event) => finance.updatePaySetting("hourlyRate", numberValue(event.target.value))} />
        </label>
        <label>
          <div style={{ fontSize: "0.74rem", marginBottom: "4px" }}>Overtime rate (£)</div>
          <input type="number" style={widgetInputStyle} value={pay.overtimeRate || 0} onChange={(event) => finance.updatePaySetting("overtimeRate", numberValue(event.target.value))} />
        </label>
        <label>
          <div style={{ fontSize: "0.74rem", marginBottom: "4px" }}>Annual salary (£)</div>
          <input type="number" style={widgetInputStyle} value={pay.annualSalary || 0} onChange={(event) => finance.updatePaySetting("annualSalary", numberValue(event.target.value))} />
        </label>
        <label>
          <div style={{ fontSize: "0.74rem", marginBottom: "4px" }}>Other income (£)</div>
          <input type="number" style={widgetInputStyle} value={month.monthState.otherIncome || 0} onChange={(event) => finance.updateMonthField("otherIncome", numberValue(event.target.value))} />
        </label>
        <label>
          <div style={{ fontSize: "0.74rem", marginBottom: "4px" }}>Income adjustment (£)</div>
          <input type="number" style={widgetInputStyle} value={month.monthState.incomeAdjustments || 0} onChange={(event) => finance.updateMonthField("incomeAdjustments", numberValue(event.target.value))} />
        </label>
      </div>

      <SectionLabel>Tax estimates</SectionLabel>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <MetricPill label="Expected hours" value={`${month.pay.expectedHours.toFixed(2)}h`} />
        <MetricPill label="Overtime hours" value={`${month.pay.overtimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
        <MetricPill label="Tax" value={formatCurrency(month.pay.tax)} accent="var(--danger, #c62828)" />
        <MetricPill label="NI" value={formatCurrency(month.pay.nationalInsurance)} accent="var(--danger, #c62828)" />
      </div>
    </BaseWidget>
  );
}
