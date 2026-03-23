import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, formatCurrency } from "@/components/profile/personal/widgets/shared";
import {
  calculateAfterTaxTotal,
  calculateBasePay,
  calculateNationalInsuranceEstimate,
  calculateOvertimeHours,
  calculateOvertimePay,
  calculateTaxEstimate,
  expectedMonthlyContractHours,
} from "@/lib/profile/calculations";
import { formatMonthLabel, getCurrentMonthKey } from "@/lib/profile/monthPlanning";

export default function WorkSummaryWidget({
  widget,
  widgetData,
  widgetMonthKey,
  datasets,
  onOpenSettings,
  dragHandleProps,
  resizeHandleProps,
  compact = false,
  isInteracting = false,
  isActiveInteractionWidget = false,
  interactionMode = null,
}) {
  const workData = datasets.workData || {};
  const settings = widgetData?.settings || {};
  const isFutureView = widgetMonthKey > getCurrentMonthKey();
  const hoursWorked = isFutureView ? Number(settings.plannedHours || workData.hoursWorked || 0) : Number(workData.hoursWorked || 0);
  const overtimeHours = isFutureView ? Number(settings.plannedOvertimeHours || workData.overtimeHours || 0) : Number(workData.overtimeHours || 0);
  const estimatedIncome = isFutureView && settings.useWorkEstimate === false
    ? Number(settings.baseMonthlyIncome || 0)
    : Number(workData.estimatedIncome || settings.baseMonthlyIncome || 0);
  const contractedWeeklyHours = Number(settings.contractedWeeklyHours || workData.contractedWeeklyHours || 0);
  const expectedHours = expectedMonthlyContractHours(contractedWeeklyHours);
  const autoOvertimeHours = calculateOvertimeHours(hoursWorked, expectedHours);
  const baseRate = Number(settings.hourlyRate || workData.hourlyRate || 0);
  const overtimeRate = Number(settings.overtimeRate || workData.overtimeRate || baseRate);
  const basePay = calculateBasePay(Math.min(hoursWorked, expectedHours), baseRate);
  const overtimePay = calculateOvertimePay(autoOvertimeHours, overtimeRate);
  const grossPay = Number((basePay + overtimePay).toFixed(2));
  const tax = calculateTaxEstimate(grossPay, Number(settings.taxRate || 0));
  const nationalInsurance = calculateNationalInsuranceEstimate(grossPay, Number(settings.niRate || 0));
  const afterTax = calculateAfterTaxTotal(grossPay, tax, nationalInsurance);

  return (
    <BaseWidget
      title={widget.config?.title || "Work Summary"}
      subtitle="Linked from your work profile"
      accent="var(--accent-purple)"
      monthLabel={formatMonthLabel(widgetMonthKey)}
      statusLabel={isFutureView ? "Projected" : "Actual"}
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Hours worked" value={`${hoursWorked.toFixed(2)}h`} />
          <MetricPill label="Overtime" value={`${overtimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
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
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
        <MetricPill label="Overtime value" value={formatCurrency(workData.overtimeValue || 0)} accent="var(--success, #2e7d32)" />
        <MetricPill label="Estimated pay" value={formatCurrency(estimatedIncome)} accent="var(--success, #2e7d32)" />
        <MetricPill label="Leave remaining" value={workData.leaveRemaining ?? "No data"} accent="var(--info, #1565c0)" />
        <MetricPill label="Expected hours (month)" value={`${expectedHours.toFixed(2)}h`} accent="var(--info, #1565c0)" />
        <MetricPill label="Auto overtime" value={`${autoOvertimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
        <MetricPill label="After-tax estimate" value={formatCurrency(afterTax)} accent="var(--accent-purple)" />
      </div>
      <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
        This widget uses your existing profile attendance, overtime, and leave data. Future months can fall back to planned values from widget settings when live work scheduling is not available.
      </div>
    </BaseWidget>
  );
}
