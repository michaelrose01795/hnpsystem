import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, widgetGhostButtonStyle, widgetInputStyle } from "@/components/profile/personal/widgets/shared";

function numberValue(value) {
  return Number(value || 0);
}

export default function WorkSummaryWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;

  return (
    <BaseWidget
      title={widget.config?.title || "Overtime"}
      subtitle="Attendance overtime + manual daily overtime entries"
      accent="var(--warning, #ef6c00)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <MetricPill label="Attendance overtime" value={`${month.pay.attendanceOvertimeHours.toFixed(2)}h`} accent="var(--info, #1565c0)" />
          <MetricPill label="Manual overtime" value={`${month.pay.manualOvertimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
          <MetricPill label="Total overtime" value={`${month.pay.overtimeHours.toFixed(2)}h`} accent="var(--warning, #ef6c00)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Manual overtime entries (day-by-day)</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.overtimeEntries.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.3fr 0.9fr 1.4fr auto" }}>
            <input type="date" style={widgetInputStyle} value={entry.date || ""} onChange={(event) => finance.updateOvertimeEntry(entry.id, { date: event.target.value })} />
            <input type="number" style={widgetInputStyle} value={entry.hours || 0} onChange={(event) => finance.updateOvertimeEntry(entry.id, { hours: numberValue(event.target.value) })} />
            <input style={widgetInputStyle} value={entry.note || ""} placeholder="Note" onChange={(event) => finance.updateOvertimeEntry(entry.id, { note: event.target.value })} />
            <button type="button" style={widgetGhostButtonStyle} onClick={() => finance.removeOvertimeEntry(entry.id)}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" style={widgetGhostButtonStyle} onClick={finance.addOvertimeEntry}>Add overtime row</button>
    </BaseWidget>
  );
}
