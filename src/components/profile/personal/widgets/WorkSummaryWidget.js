import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, formatCurrency } from "@/components/profile/personal/widgets/shared";
import {
  calculateAfterTaxTotal,
  calculateBasePay,
  calculateNationalInsuranceEstimate,
  calculateOvertimePay,
  calculateTaxEstimate,
  expectedMonthlyContractHours,
} from "@/lib/profile/calculations";
import { formatMonthLabel } from "@/lib/profile/monthPlanning";

export default function WorkSummaryWidget({
  widget,
  widgetMonthKey,
  datasets,
  onOpenSettings,
  compact = false,
}) {
  const workData = datasets.workData || {};
  const hoursWorked = Number(workData.hoursWorked || 0);
  const overtimeHours = Number(workData.overtimeHours || 0);
  const contractedWeeklyHours = Number(workData.contractedWeeklyHours || 0);
  const expectedHours = expectedMonthlyContractHours(contractedWeeklyHours, widgetMonthKey);
  const baseRate = Number(workData.hourlyRate || 0);
  const overtimeRate = Number(workData.overtimeRate || baseRate);
  const basePay = calculateBasePay(expectedHours, baseRate);
  const overtimePay = calculateOvertimePay(overtimeHours, overtimeRate);
  const grossPay = Number((basePay + overtimePay).toFixed(2));
  const tax = calculateTaxEstimate(grossPay);
  const nationalInsurance = calculateNationalInsuranceEstimate(grossPay);
  const afterTax = calculateAfterTaxTotal(grossPay, tax, nationalInsurance);

  return (
    <BaseWidget
      title={widget.config?.title || "Work Summary"}
      subtitle="Attendance and leave source of truth"
      accent="var(--accent-purple)"
      monthLabel={formatMonthLabel(widgetMonthKey)}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Hours worked" value={`${hoursWorked.toFixed(2)}h`} />
          <MetricPill label="Overtime (logged)" value={`${overtimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
      compact={compact}
    >
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
        <MetricPill label="Overtime value" value={formatCurrency(workData.overtimeValue || 0)} accent="var(--success, #2e7d32)" />
        <MetricPill label="Expected hours (month)" value={`${expectedHours.toFixed(2)}h`} accent="var(--info, #1565c0)" />
        <MetricPill label="Leave remaining" value={workData.leaveRemaining ?? "No data"} accent="var(--info, #1565c0)" />
        <MetricPill label="Tax estimate" value={formatCurrency(tax)} accent="var(--danger, #c62828)" />
        <MetricPill label="NI estimate" value={formatCurrency(nationalInsurance)} accent="var(--danger, #c62828)" />
        <MetricPill label="After-tax estimate" value={formatCurrency(afterTax)} accent="var(--accent-purple)" />
      </div>
      <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
        Values come from attendance history, overtime sessions/rules, and leave balances used by the Work tab.
      </div>
    </BaseWidget>
  );
}
