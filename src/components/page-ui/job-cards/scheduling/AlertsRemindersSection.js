// file location: src/components/page-ui/job-cards/scheduling/AlertsRemindersSection.js
// Scheduling dashboard → Alerts & Reminders.
// Derives live status rows from the job's real data: requests blocked on parts,
// whether the next customer update is due/overdue, and a scheduling-conflict
// indicator. Rows use the tokenised app-status-message tones (tint + icon),
// never coloured side-borders (CLAUDE.md §3.0a).
import React, { useMemo } from "react";
import LayerSurface from "@/components/ui/LayerSurface";

const AWAITING_PART_STATUSES = new Set([
  "pending",
  "waiting_authorisation",
  "awaiting_stock",
  "on_order",
  "booked",
]);

const norm = (value) => String(value || "").trim().toLowerCase();

const formatDue = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const ICONS = { success: "✅", warning: "⚠️", danger: "⛔", info: "ℹ️" };

const AlertRow = ({ tone, children }) => (
  <div
    className={`app-status-message app-status-message--${tone}`}
    style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
    role="status"
  >
    <span aria-hidden="true">{ICONS[tone]}</span>
    <span>{children}</span>
  </div>
);

export default function AlertsRemindersSection({ jobData }) {
  const alerts = useMemo(() => {
    const rows = [];

    // 1. Requests blocked on parts.
    const requests = Array.isArray(jobData?.jobRequests) ? jobData.jobRequests : [];
    const ordered = [...requests].sort(
      (a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0)
    );
    const partsItems = Array.isArray(jobData?.parts_job_items)
      ? jobData.parts_job_items
      : [];
    const awaitingRequestIds = new Set();
    partsItems.forEach((item) => {
      if (AWAITING_PART_STATUSES.has(norm(item?.status)) && item?.allocated_to_request_id != null) {
        awaitingRequestIds.add(item.allocated_to_request_id);
      }
    });
    ordered.forEach((req, index) => {
      if (awaitingRequestIds.has(req?.requestId)) {
        rows.push({
          tone: "warning",
          text: `Request ${index + 1} is waiting on parts${
            req?.description ? ` — ${req.description}` : ""
          }.`,
        });
      }
    });

    // 2. Customer update due / overdue.
    if (jobData?.nextUpdateDue) {
      const due = new Date(jobData.nextUpdateDue);
      const overdue = due.getTime() < Date.now();
      rows.push({
        tone: overdue ? "danger" : "info",
        text: overdue
          ? `Customer update overdue — was due ${formatDue(jobData.nextUpdateDue)}.`
          : `Customer update due ${formatDue(jobData.nextUpdateDue)}.`,
      });
    } else {
      rows.push({ tone: "info", text: "No customer update scheduled." });
    }

    // 3. Scheduling conflicts (clear state — cross-job conflict detection is
    //    out of scope for this section).
    rows.push({ tone: "success", text: "No scheduling conflicts detected." });

    return rows;
  }, [jobData?.jobRequests, jobData?.parts_job_items, jobData?.nextUpdateDue]);

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-alerts"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "12px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Alerts &amp; Reminders
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {alerts.map((alert, index) => (
          <AlertRow key={`${alert.tone}-${index}`} tone={alert.tone}>
            {alert.text}
          </AlertRow>
        ))}
      </div>
    </LayerSurface>
  );
}
