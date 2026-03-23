import React, { useMemo } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  MetricPill,
  SectionLabel,
  formatDate,
} from "@/components/profile/personal/widgets/shared";

export default function HolidayWidget({
  widget,
  datasets,
  onOpenSettings,
  compact = false,
}) {
  const approvedRequests = useMemo(() => {
    const leaveRequests = Array.isArray(datasets?.workData?.leaveRequests) ? datasets.workData.leaveRequests : [];
    return leaveRequests
      .filter((request) => String(request.status || "").toLowerCase() === "approved")
      .slice(0, 6);
  }, [datasets?.workData?.leaveRequests]);

  const workDaysTaken = approvedRequests.reduce((sum, request) => sum + Number(request.totalDays || 0), 0);
  const calendarDaysTaken = approvedRequests.reduce((sum, request) => {
    if (!request.startDate || !request.endDate) return sum;
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sum;
    const days = Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1, 0);
    return sum + days;
  }, 0);

  return (
    <BaseWidget
      title={widget.config?.title || "Holiday Tracking"}
      subtitle="Linked to Work tab leave records"
      accent="var(--info, #00838f)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
          <MetricPill label="Work days taken" value={`${workDaysTaken.toFixed(1)}d`} accent="var(--warning, #ef6c00)" />
          <MetricPill label="Calendar days" value={`${calendarDaysTaken.toFixed(0)}d`} accent="var(--info, #00838f)" />
          <MetricPill label="Days left" value={datasets.workData?.leaveRemaining ?? "—"} accent="var(--success, #2e7d32)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
      compact={compact}
    >
      <SectionLabel>Recent approved leave</SectionLabel>
      {approvedRequests.length === 0 ? (
        <EmptyState>No approved leave records yet in the Work tab.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {approvedRequests.map((request) => (
            <div
              key={request.id}
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
                <div style={{ fontWeight: 700 }}>{request.type || "Leave"}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {formatDate(request.startDate)} → {formatDate(request.endDate)}
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{Number(request.totalDays || 0).toFixed(1)}d</div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
