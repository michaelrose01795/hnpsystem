// file location: src/components/Workshop/QueuePlanner/WorkshopQueuePlanner.js
// Top-level presentation for the Workshop Controller Board — the dealership
// dispatch screen that replaces the old Next Jobs table/list. Single self-
// contained UI file (helpers + board primitives + details modal all live here).
//
// STYLING: this page now follows the app standard used by every other page-ui
// file — inline styles driven by the global theme tokens (var(--theme),
// var(--surface), var(--text-1) …) plus the canonical <LayerSurface> /
// <LayerTheme> surface primitives (CLAUDE.md §3.0). There is NO CSS module any
// more: the only non-inline styling is one small component-scoped <style jsx
// global> block for the things inline styles can't express (responsive sizing
// vars, hover lifts and the drag-active body lock). Because all styling lives in
// this component, every change hot-reloads reliably like the rest of the app.
//
// Drag-and-drop reuses the page pointer engine (`nextjobs.js`) via the data-dnd-*
// attribute contract and `handleCardPointerDown`.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

// ===========================================================================
// Shared style constants (replace the former CSS-module tokens)
// ===========================================================================
const LIFT = "0 10px 26px rgba(0, 0, 0, 0.22)";
const LIFT_SM = "0 4px 12px rgba(0, 0, 0, 0.16)";
const RADIUS_LG = "var(--radius-lg, 16px)";
const HAIRLINE_BOTTOM = "inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.14)";
const HIGHLIGHT_SHADOW =
  "inset 0 0 0 1px rgba(var(--success-rgb), 0.6), 0 0 0 2px rgba(var(--success-rgb), 0.45), " +
  LIFT;

// ===========================================================================
// Presentation helpers (pure display logic — no data fetching)
// ===========================================================================
const DAILY_CAPACITY_HOURS = 7.5;

// status → soft visual treatment (calm tints only, no bright red).
// `pillBg` is the pill background colour; the label always uses --text-1.
const STATUS_META = {
  waiting: { label: "Waiting", dot: "var(--warning)", pillBg: "var(--warning-surface)" },
  progress: { label: "In Progress", dot: "#3b82f6", pillBg: "rgba(59, 130, 246, 0.16)" },
  complete: { label: "Completed", dot: "var(--success)", pillBg: "var(--success-surface)" },
  ready: { label: "Ready", dot: "var(--success)", pillBg: "var(--success-surface)" },
  parts: { label: "Parts Waiting", dot: "#e0a458", pillBg: "rgba(224, 164, 88, 0.16)" },
  mot: { label: "MOT Required", dot: "#6366f1", pillBg: "rgba(99, 102, 241, 0.16)" },
  cancelled: { label: "Cancelled", dot: "var(--surfaceTextMuted)", pillBg: "rgba(var(--accent-base-rgb), 0.12)" },
};

const deriveStatusKey = (status) => {
  const raw = String(status || "").toLowerCase();
  if (!raw) return "waiting";
  if (raw.includes("cancel")) return "cancelled";
  if (raw.includes("part")) return "parts";
  if (raw.includes("mot")) return "mot";
  if (raw.includes("ready") || raw.includes("wash")) return "ready";
  if (raw.includes("complete") || raw.includes("invoiced") || raw.includes("collected") || raw.includes("finished")) {
    return "complete";
  }
  if (raw.includes("progress") || raw.includes("workshop") || raw.includes("started") || raw.includes("additional") || raw.includes("vhc")) {
    return "progress";
  }
  return "waiting";
};

const getStatusMeta = (status) => STATUS_META[deriveStatusKey(status)] || STATUS_META.waiting;

const formatClock = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
};

// capacity level from total hours (low <50% · medium 50–90% · high ≥90%).
const getCapacity = (totalHours) => {
  const pct = Math.min(100, Math.round((totalHours / DAILY_CAPACITY_HOURS) * 100));
  if (pct >= 90) return { pct, level: "high", dot: "rgba(var(--warning-rgb), 1)", label: "High workload" };
  if (pct >= 50) return { pct, level: "medium", dot: "rgba(59, 130, 246, 0.95)", label: "Medium workload" };
  return { pct, level: "low", dot: "rgba(var(--success-rgb), 0.95)", label: "Low workload" };
};

const shortHours = (hours) => {
  const value = Number(hours) || 0;
  return `${value % 1 === 0 ? value : value.toFixed(1)}h`;
};

const toDevSectionKey = (value) =>
  String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

const formatCheckedIn = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return formatClock(value);
  }
};

// ===========================================================================
// Reusable inline style fragments
// ===========================================================================
const sectionHeadStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" };
const sectionTitleStyle = { margin: 0, fontSize: "14px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-1)" };
const sectionMetaStyle = { fontSize: "12px", fontWeight: 700, color: "var(--surfaceTextMuted)" };
const statusDotStyle = { width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0 };

const statusPillStyle = (pillBg, marginLeftAuto = true) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  maxWidth: "100%",
  marginLeft: marginLeftAuto ? "auto" : 0,
  padding: "2px 8px",
  borderRadius: "var(--radius-pill)",
  fontSize: "10px",
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  background: pillBg,
  color: "var(--text-1)",
});

const StatusPill = ({ meta, marginLeftAuto = true }) => (
  <span style={statusPillStyle(meta.pillBg, marginLeftAuto)}>
    <span style={{ ...statusDotStyle, background: meta.dot }} />
    {meta.label}
  </span>
);

// ===========================================================================
// Dispatch board primitives
// ===========================================================================

// ---------------------------------------------------------------- Job card ----
function WorkshopQueueCard({
  job,
  refCallback,
  onPointerDown,
  isDragging,
  isHighlighted,
  deriveJobTypeLabel,
  formatAppointmentTime,
  estimateJobHours,
  variant = "", // "assigned" | "unassigned" | ""
  devSectionParent = "",
  devSectionPrefix = "workshop-queue-job",
}) {
  const statusMeta = getStatusMeta(job.status);
  const vehicle = [job.make, job.model].filter(Boolean).join(" ") || job.makeModel || "Vehicle TBC";
  const customer = job.customer || "Unknown customer";
  const bookingTime = formatAppointmentTime ? formatAppointmentTime(job) : "";
  const typeLabel = deriveJobTypeLabel ? deriveJobTypeLabel(job) : job.type;
  const estHours = estimateJobHours ? estimateJobHours(job) : 0;
  const assigned = variant === "assigned";

  const cardStyle = {
    flex: "0 0 auto",
    width: assigned ? "var(--wqp-assigned-w)" : variant === "unassigned" ? "100%" : "var(--wqp-card-w)",
    display: "flex",
    flexDirection: "column",
    gap: assigned ? "10px" : "7px",
    padding: assigned ? "16px 18px" : "12px 14px 11px",
    borderRadius: "var(--radius-md)",
    background: "var(--surface)",
    color: "var(--text-1)",
    textAlign: "left",
    cursor: "grab",
    touchAction: "none",
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isHighlighted ? HIGHLIGHT_SHADOW : LIFT_SM,
    ...(assigned ? { minHeight: 0, alignSelf: "center" } : null),
  };

  return (
    <div
      ref={refCallback}
      data-dnd-job-card="true"
      data-dnd-job-number={job.jobNumber}
      data-dev-section="1"
      data-dev-section-key={`${devSectionPrefix}-${toDevSectionKey(job.jobNumber)}`}
      data-dev-section-parent={devSectionParent}
      data-dev-section-type="content-card"
      data-dev-background-token="surface"
      data-dev-text-preview={`${job.jobNumber || "Job"} ${job.reg || ""} ${vehicle} ${customer} ${statusMeta.label}`}
      onPointerDown={onPointerDown}
      className="wqp-lift wqp-grab"
      style={cardStyle}
      title={`#${job.jobNumber} · ${vehicle} · ${customer}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--accent-strong)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          #{job.jobNumber}
        </span>
        <span style={{ marginLeft: "auto", maxWidth: assigned ? "55%" : "46%", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(assigned ? { padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "rgba(var(--accent-base-rgb), 0.1)" } : null) }}>
          {job.reg || "—"}
        </span>
      </div>
      <div
        style={{
          fontSize: "11px",
          lineHeight: 1.35,
          color: "var(--text-1)",
          display: "-webkit-box",
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          wordBreak: "break-word",
          ...(assigned ? { minHeight: "2.7em" } : null),
        }}
      >
        {vehicle} • {customer}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap", minWidth: 0, marginTop: "1px" }}>
        {typeLabel && (
          <span style={{ maxWidth: "100%", fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "2px 7px", borderRadius: "var(--radius-pill)", background: "rgba(var(--accent-base-rgb), 0.1)", color: "var(--surfaceTextMuted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {typeLabel}
          </span>
        )}
        <StatusPill meta={statusMeta} marginLeftAuto={true} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap", minWidth: 0, marginTop: "1px", paddingTop: assigned ? "2px" : 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)" }}>
          {bookingTime && bookingTime !== "No appointment" ? bookingTime : "—"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)" }}>
          ~{shortHours(estHours)}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Row drop zone ----
function WorkshopQueueDropZone({
  panelKey,
  jobs,
  isActive,
  draggingJob,
  matchesDropIndicator,
  jobCardRefs,
  handleCardPointerDown,
  handleOpenJobDetails,
  highlightedJobNumbers,
  deriveJobTypeLabel,
  formatAppointmentTime,
  estimateJobHours,
}) {
  const dropBar = <div style={{ flex: "0 0 auto", width: "3px", alignSelf: "stretch", margin: "8px 1px", borderRadius: "var(--radius-pill)", background: "var(--primary)" }} />;

  return (
    <div
      data-dnd-target-type="assignee"
      data-dnd-target-key={panelKey}
      data-dev-section="1"
      data-dev-section-key={`workshop-queue-dropzone-${toDevSectionKey(panelKey)}`}
      data-dev-section-parent={`workshop-queue-row-${toDevSectionKey(panelKey)}`}
      data-dev-section-type="section-shell"
      data-dev-background-token="theme"
      data-dev-text-preview={`Drop zone for ${panelKey}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "18px 22px",
        minHeight: "var(--wqp-row-min-h)",
        background: isActive ? "rgba(var(--primary-rgb), 0.1)" : "var(--theme)",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        boxShadow: isActive ? `inset 0 0 0 2px var(--primary), ${HAIRLINE_BOTTOM}` : HAIRLINE_BOTTOM,
        transition: "background-color 0.15s ease",
      }}
    >
      {jobs.length > 0 &&
        jobs.map((job, index) => {
          const isHighlighted = highlightedJobNumbers.includes(job.jobNumber);
          return (
            <React.Fragment key={job.jobNumber}>
              {matchesDropIndicator("assignee", panelKey, job.jobNumber, "before") && dropBar}
              {index > 0 && (
                <span style={{ flex: "0 0 auto", color: "var(--surfaceTextMuted)", fontSize: "14px", fontWeight: 700, userSelect: "none", opacity: 0.6 }}>→</span>
              )}
              <WorkshopQueueCard
                job={job}
                variant="assigned"
                refCallback={(node) => {
                  if (node) jobCardRefs.current[job.jobNumber] = node;
                  else if (jobCardRefs.current[job.jobNumber]) delete jobCardRefs.current[job.jobNumber];
                }}
                onPointerDown={handleCardPointerDown(job, () => handleOpenJobDetails(job))}
                isDragging={draggingJob?.jobNumber === job.jobNumber}
                isHighlighted={isHighlighted}
                deriveJobTypeLabel={deriveJobTypeLabel}
                formatAppointmentTime={formatAppointmentTime}
                estimateJobHours={estimateJobHours}
                devSectionParent={`workshop-queue-dropzone-${toDevSectionKey(panelKey)}`}
                devSectionPrefix={`workshop-queue-assigned-job-${toDevSectionKey(panelKey)}`}
              />
              {matchesDropIndicator("assignee", panelKey, job.jobNumber, "after") && dropBar}
            </React.Fragment>
          );
        })}
      {jobs.length > 0 && isActive && draggingJob && !jobs.some((j) => j.jobNumber === draggingJob.jobNumber) && dropBar}
    </div>
  );
}

// ----------------------------------------------------------------- One row ----
function WorkshopQueueRow({ row, estimateJobHours, ...dropZoneProps }) {
  const totalHours = row.jobs.reduce((sum, job) => sum + (estimateJobHours(job) || 0), 0);
  const capacity = getCapacity(totalHours);
  const unit = row.isMot ? (row.jobs.length === 1 ? "MOT" : "MOTs") : row.jobs.length === 1 ? "job" : "jobs";
  const initial = String(row.name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <React.Fragment>
      <div
        data-dev-section="1"
        data-dev-section-key={`workshop-queue-user-${toDevSectionKey(row.panelKey)}`}
        data-dev-section-parent={`workshop-queue-row-${toDevSectionKey(row.panelKey)}`}
        data-dev-section-type="content-card"
        data-dev-background-token="theme"
        data-dev-text-preview={`${row.name} ${row.role} ${row.jobs.length} ${unit}`}
        style={{ position: "sticky", left: 0, zIndex: 2, display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", minHeight: "var(--wqp-row-min-h)", background: "rgba(var(--accent-base-rgb), 0.06)", boxShadow: HAIRLINE_BOTTOM }}
      >
        {/* Technician initial — the frozen label column shares the group-header tint */}
        <span
          aria-hidden="true"
          style={{ flexShrink: 0, width: "var(--wqp-avatar)", height: "var(--wqp-avatar)", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-md)", background: "rgba(var(--accent-base-rgb), 0.16)", color: "var(--accent-strong)", fontSize: "15px", fontWeight: 800 }}
        >
          {initial}
        </span>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 auto" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)" }} title={capacity.label}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: capacity.dot }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.jobs.length} {unit} • {shortHours(totalHours)}</span>
          </span>
          {/* Workload bar — visualises total hours against the 7.5h daily target */}
          <span style={{ position: "relative", display: "block", width: "100%", height: "4px", borderRadius: "var(--radius-pill)", background: "rgba(var(--accent-base-rgb), 0.12)", overflow: "hidden" }} title={`${capacity.pct}% of daily capacity`}>
            <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${capacity.pct}%`, borderRadius: "var(--radius-pill)", background: capacity.dot }} />
          </span>
        </div>
      </div>
      <WorkshopQueueDropZone panelKey={row.panelKey} jobs={row.jobs} estimateJobHours={estimateJobHours} {...dropZoneProps} />
    </React.Fragment>
  );
}

// --------------------------------------------------------------- Group head ----
function WorkshopQueueHeader({ title, count }) {
  const key = title.toLowerCase().includes("mot") ? "mot" : "technicians";
  return (
    <div
      data-dev-section="1"
      data-dev-section-key={`workshop-queue-header-${key}`}
      data-dev-section-parent="workshop-queue-board-grid"
      data-dev-section-type="toolbar"
      data-dev-background-token="theme"
      data-dev-text-preview={`${title} ${count}`}
      style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "10px", boxSizing: "border-box", minHeight: "69px", padding: "24px 22px 25px", background: "rgba(var(--accent-base-rgb), 0.06)", boxShadow: "inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.18)" }}
    >
      <span style={{ position: "sticky", left: "22px", zIndex: 1, display: "inline-flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent-strong)" }}>{title}</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)" }}>({count})</span>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------- Board ----
function WorkshopQueueBoard({ techRows, motRows, activeDropTarget, ...shared }) {
  const renderRow = (row) => (
    <div
      key={`${row.panelKey}-row-shell`}
      data-dev-section="1"
      data-dev-section-key={`workshop-queue-row-${toDevSectionKey(row.panelKey)}`}
      data-dev-section-parent="workshop-queue-board-grid"
      data-dev-section-type="section-shell"
      data-dev-background-token="transparent"
      data-dev-text-preview={`${row.name} queue row`}
      style={{ display: "contents" }}
    >
      <WorkshopQueueRow row={row} isActive={activeDropTarget === row.panelKey} {...shared} />
    </div>
  );

  return (
    <LayerTheme
      sectionKey="workshop-queue-board"
      parentKey="workshop-queue-planner"
      sectionType="content-card"
      backgroundToken="theme"
      radius={RADIUS_LG}
      padding="0"
      gap="0"
      data-presentation="workshop-queue-board"
      data-dev-text-preview={`Workshop queue board ${techRows.length} technicians ${motRows.length} MOT users`}
      style={{ overflow: "hidden", boxShadow: LIFT }}
    >
      <div
        data-dev-section="1"
        data-dev-section-key="workshop-queue-board-scroll"
        data-dev-section-parent="workshop-queue-board"
        data-dev-section-type="section-shell"
        data-dev-background-token="transparent"
        style={{ width: "100%", overflowX: "auto", overscrollBehaviorX: "contain" }}
      >
        <div
          role="grid"
          data-dev-section="1"
          data-dev-section-key="workshop-queue-board-grid"
          data-dev-section-parent="workshop-queue-board-scroll"
          data-dev-section-type="data-table"
          data-dev-background-token="transparent"
          style={{ display: "grid", gridTemplateColumns: "var(--wqp-user-col) minmax(0, 1fr)", minWidth: "680px" }}
        >
          <WorkshopQueueHeader title="Technicians" count={techRows.length} />
          {techRows.map(renderRow)}
          {motRows.length > 0 && <WorkshopQueueHeader title="MOT Users" count={motRows.length} />}
          {motRows.map(renderRow)}
        </div>
      </div>
    </LayerTheme>
  );
}

// ===========================================================================
// Job details modal
// ===========================================================================
const btnFlex = { flex: "1 1 auto", minWidth: "120px" };

const Field = ({ label, value, wide }) => (
  <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "rgba(var(--surface-rgb), 0.5)", minWidth: 0, ...(wide ? { gridColumn: "1 / -1" } : null) }}>
    <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--surfaceTextMuted)", marginBottom: "4px" }}>{label}</div>
    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)", wordBreak: "break-word" }}>{value || "—"}</div>
  </div>
);

function WorkshopJobModal({ job, feedback, onClose, onOpenJobCard, onUnassign, onQuickAction, estimateJobHours, deriveJobTypeLabel, formatAppointmentTime, getJobRequestItems }) {
  if (!job) return null;

  const statusMeta = getStatusMeta(job.status);
  const vehicle = [job.make, job.model].filter(Boolean).join(" ") || job.makeModel || "Vehicle TBC";
  const technician = job.assignedTech?.name || job.technician || "Unassigned";
  const role = (job.assignedTech?.role || job.technicianRole || "").toLowerCase();
  const motAssigned = role.includes("mot") ? technician : job.motTester || "Not assigned";
  const bookingTime = formatAppointmentTime ? formatAppointmentTime(job) : "";
  const estHours = estimateJobHours ? estimateJobHours(job) : 0;
  const requests = getJobRequestItems ? getJobRequestItems(job) : [];

  const vhcCount = Array.isArray(job.vhcChecks) ? job.vhcChecks.length : 0;
  const vhcStatus = job.vhcRequired ? (vhcCount > 0 ? `${vhcCount} item${vhcCount === 1 ? "" : "s"} recorded` : "Required — not started") : "Not required";
  const partsStatus = job.partsStatus || job.parts_status || "—";

  const feedbackStyle =
    feedback?.type === "error"
      ? { background: "var(--danger-surface)", color: "var(--danger)" }
      : feedback?.type === "success"
      ? { background: "var(--success-surface)", color: "var(--success-dark)" }
      : { background: "rgba(var(--accent-base-rgb), 0.08)", color: "var(--text-1)" };

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "hidden" }}>
        <LayerSurface
          className="popup-card"
          sectionKey="workshop-queue-job-modal"
          sectionType="content-card"
          backgroundToken="surface"
          radius="var(--radius-xl)"
          padding="28px"
          style={{ width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}
        >
          <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "var(--accent-strong)" }}>#{job.jobNumber}</h3>
          <p style={{ margin: "0 0 18px", fontSize: "12px", fontWeight: 600, color: "var(--surfaceTextMuted)" }}>
            {vehicle} · {job.reg || "Reg TBC"} · {statusMeta.label}
          </p>

          {feedback && (
            <div style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: 600, ...feedbackStyle }}>
              {feedback.text}
            </div>
          )}

          <div className="wqp-fieldgrid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginBottom: "18px" }}>
            <Field label="Registration" value={job.reg} />
            <Field label="Vehicle" value={vehicle} />
            <Field label="Customer" value={job.customer || "Unknown customer"} />
            <Field label="Phone" value={job.customerPhone} />
            <Field label="Booking Time" value={bookingTime && bookingTime !== "No appointment" ? bookingTime : "—"} />
            <Field label="Checked In" value={formatCheckedIn(job.checkedInAt)} />
            <Field label="Estimated Time" value={estHours ? `${estHours.toFixed(estHours % 1 === 0 ? 0 : 1)} hrs` : "—"} />
            <Field label="Service Type" value={deriveJobTypeLabel ? deriveJobTypeLabel(job) : job.type} />
            <Field label="Status" value={statusMeta.label} />
            <Field label="Technician" value={technician} />
            <Field label="MOT Assigned" value={motAssigned} />
            <Field label="VHC Status" value={vhcStatus} />
            <Field label="Parts Status" value={partsStatus} />

            <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "rgba(var(--surface-rgb), 0.5)", minWidth: 0, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--surfaceTextMuted)", marginBottom: "4px" }}>Customer Requests</div>
              {requests.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                  {requests.map((request, index) => (
                    <div key={request.id} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--text-1)", lineHeight: 1.4 }}>
                      <span style={{ flexShrink: 0, fontWeight: 800, color: "var(--accent-strong)" }}>{index + 1}.</span>
                      <span>{request.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)", wordBreak: "break-word" }}>No requests recorded.</div>
              )}
            </div>
          </div>

          {/* Quick actions use the shared `.app-btn` family — no bespoke styles. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button type="button" className="app-btn app-btn--primary" style={btnFlex} onClick={onOpenJobCard}>Open Job Card</button>
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={() => onQuickAction?.("assign")}>Assign Technician</button>
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={() => onQuickAction?.("move")}>Move Position</button>
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={() => onQuickAction?.("ready")}>Mark Ready</button>
            {job.assignedTech && (
              <button type="button" className="app-btn app-btn--danger" style={btnFlex} onClick={onUnassign}>Unassign</button>
            )}
            <button type="button" className="app-btn app-btn--ghost" style={btnFlex} onClick={onClose}>Close</button>
          </div>
        </LayerSurface>
      </div>
    </div>
  );
}

// ===========================================================================
// Planner (default export)
// ===========================================================================
export default function WorkshopQueuePlanner({
  // data
  techRows,
  motRows,
  outstandingJobs,
  checkedInJobs,
  // helpers
  estimateJobHours,
  deriveJobTypeLabel,
  formatAppointmentTime,
  getJobRequestItems,
  // search (page-driven, drives highlight)
  SearchBar,
  searchTerm,
  setSearchTerm,
  highlightedSearchJobNumbers,
  // drag-and-drop wiring (from page pointer engine)
  activeDropTarget,
  draggingJob,
  dragState,
  isDragActive,
  matchesDropIndicator,
  jobCardRefs,
  handleCardPointerDown,
  DRAG_PREVIEW_OFFSET_PX,
  // interactions
  handleOpenJobDetails,
  selectedJob,
  feedbackMessage,
  setFeedbackMessage,
  handleCloseJobDetails,
  handleViewSelectedJobCard,
  unassignTechFromJob,
}) {
  // The job-type dropdown was removed — the single search box (page-driven) now
  // drives all matching across every section. `outstandingJobs` already arrives
  // search-filtered from the page.
  const techRowsSafe = techRows || [];
  const motRowsSafe = motRows || [];
  const outstanding = outstandingJobs || [];
  const highlighted = highlightedSearchJobNumbers || [];

  const sharedDropProps = {
    draggingJob,
    matchesDropIndicator,
    jobCardRefs,
    handleCardPointerDown,
    handleOpenJobDetails,
    highlightedJobNumbers: highlighted,
    deriveJobTypeLabel,
    formatAppointmentTime,
    estimateJobHours,
  };

  const handleQuickAction = (type) => {
    if (type === "assign" || type === "move") {
      setFeedbackMessage?.({ type: "info", text: "Drag the job card onto a technician or MOT row to reassign it or change its queue position." });
    } else if (type === "ready") {
      setFeedbackMessage?.({ type: "info", text: "Mark Ready updates the workshop status — open the job card to set the status until this shortcut is wired up." });
    }
  };

  const emptyRowStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "64px",
    borderRadius: "var(--radius-md)",
    boxShadow: active ? "inset 0 0 0 2px var(--primary)" : "inset 0 0 0 2px rgba(var(--accent-base-rgb), 0.18)",
    background:
      "repeating-linear-gradient(45deg, rgba(var(--accent-base-rgb), 0.03), rgba(var(--accent-base-rgb), 0.03) 10px, transparent 10px, transparent 20px)",
    fontSize: "12px",
    fontWeight: 600,
    color: active ? "var(--accent-strong)" : "var(--surfaceTextMuted)",
  });

  return (
    <div
      className="wqp-shell"
      data-presentation="workshop-queue-planner"
      data-dev-section="1"
      data-dev-section-key="workshop-queue-planner"
      data-dev-section-parent="app-layout-page-card"
      data-dev-section-type="page-shell"
      data-dev-background-token="transparent"
      data-dev-text-preview="Workshop queue planner"
      style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", minWidth: 0, minHeight: "100%" }}
    >
      {/* ===================== Search (top — all sections) ================= */}
      {/* One search box for the whole page. The page matches the term against
          every job (checked-in, unassigned and assigned) and feeds back the
          matching job numbers, so a search lights up matches in any section. */}
      {SearchBar && (
        <LayerTheme
          sectionKey="workshop-filter-toolbar"
          parentKey="workshop-queue-planner"
          sectionType="filter-row"
          backgroundToken="theme"
          radius={RADIUS_LG}
          padding="14px 16px"
          gap="14px"
          data-dev-text-preview="Search all sections"
          style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", boxShadow: LIFT }}
        >
          <div
            className="wqp-searchwrap"
            data-dev-section="1"
            data-dev-section-key="workshop-search-filter"
            data-dev-section-parent="workshop-filter-toolbar"
            data-dev-section-type="filter-row"
            data-dev-background-token="transparent"
          >
            <SearchBar
              placeholder="Search job, reg, or customer across all sections"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
            />
          </div>
        </LayerTheme>
      )}

      {/* ============================ 1 · Checked In Jobs =================== */}
      <LayerTheme
        as="section"
        sectionKey="workshop-checked-in-section"
        parentKey="workshop-queue-planner"
        sectionType="content-card"
        backgroundToken="theme"
        radius={RADIUS_LG}
        padding="18px"
        gap="0"
        data-dev-text-preview={`Checked In Jobs ${checkedInJobs.length} checked in`}
        style={{ boxShadow: LIFT }}
      >
        <div
          data-dev-section="1"
          data-dev-section-key="workshop-checked-in-header"
          data-dev-section-parent="workshop-checked-in-section"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
          style={sectionHeadStyle}
        >
          <h2 style={sectionTitleStyle}>Checked In Jobs</h2>
          <span style={sectionMetaStyle}>{checkedInJobs.length} checked in</span>
        </div>
        {checkedInJobs.length === 0 ? (
          <div
            data-dev-section="1"
            data-dev-section-key="workshop-checked-in-empty"
            data-dev-section-parent="workshop-checked-in-section"
            data-dev-section-type="content-card"
            data-dev-background-token="surface"
            data-dev-text-preview="No checked-in jobs"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", textAlign: "center", padding: "28px 16px", marginTop: "12px", borderRadius: "var(--radius-md)", background: "rgba(var(--surface-rgb), 0.35)" }}
          >
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>No checked-in jobs yet.</p>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--surfaceTextMuted)" }}>Jobs will appear here once a vehicle has been checked in.</p>
          </div>
        ) : (
          <div
            data-dev-section="1"
            data-dev-section-key="workshop-checked-in-strip"
            data-dev-section-parent="workshop-checked-in-section"
            data-dev-section-type="section-shell"
            data-dev-background-token="transparent"
            style={{ display: "flex", gap: "var(--wqp-gap)", overflowX: "auto", overscrollBehaviorX: "contain", padding: "14px 2px 6px", scrollbarWidth: "thin", marginTop: "12px" }}
          >
            {checkedInJobs.map((job) => {
              const statusMeta = getStatusMeta(job.status);
              const vehicle = [job.make, job.model].filter(Boolean).join(" ") || job.makeModel || "Vehicle TBC";
              const checkedTime = formatClock(job.checkedInAt);
              const isHighlighted = highlighted.includes(job.jobNumber);
              return (
                <button
                  key={job.jobNumber}
                  type="button"
                  className="wqp-lift"
                  data-dev-section="1"
                  data-dev-section-key={`workshop-checked-in-job-${toDevSectionKey(job.jobNumber)}`}
                  data-dev-section-parent="workshop-checked-in-strip"
                  data-dev-section-type="content-card"
                  data-dev-background-token="surface"
                  data-dev-text-preview={`${job.jobNumber || "Job"} ${job.reg || ""} ${vehicle} ${job.customer || ""} ${statusMeta.label}`}
                  onClick={() => handleOpenJobDetails(job)}
                  title={`#${job.jobNumber} · ${vehicle}`}
                  style={{ flex: "0 0 auto", width: "236px", display: "flex", flexDirection: "column", gap: "5px", padding: "13px 14px", borderRadius: "var(--radius-md)", background: "var(--surface)", boxShadow: isHighlighted ? HIGHLIGHT_SHADOW : LIFT_SM, color: "var(--text-1)", textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--accent-strong)" }}>#{job.jobNumber || "Pending"}</span>
                    <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "rgba(var(--accent-base-rgb), 0.1)" }}>{job.reg || "—"}</span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vehicle}</span>
                  <span style={{ fontSize: "12px", color: "var(--surfaceTextMuted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.customer || "Unknown customer"}</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "3px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)" }}>Checked In {checkedTime}</span>
                    <StatusPill meta={statusMeta} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </LayerTheme>

      {/* ====================== Unassigned jobs (drop tray) ================ */}
      {/* Sits above the board so controllers can drag work straight down onto a
          technician / MOT row. Stays mounted (even when empty) so it remains a
          valid drop target for returning a job to the pool. */}
      <LayerTheme
        as="section"
        sectionKey="workshop-unassigned-section"
        parentKey="workshop-queue-planner"
        sectionType="content-card"
        backgroundToken="theme"
        radius={RADIUS_LG}
        padding="18px"
        gap="0"
        data-dnd-target-type="outstanding"
        data-dnd-target-key="outstanding"
        data-dev-text-preview={`Unassigned Jobs ${outstanding.length} waiting to allocate`}
        style={{ transition: "box-shadow 0.15s ease", boxShadow: activeDropTarget === "outstanding" ? `${LIFT}, inset 0 0 0 2px var(--primary)` : LIFT }}
      >
        <div
          data-dev-section="1"
          data-dev-section-key="workshop-unassigned-header"
          data-dev-section-parent="workshop-unassigned-section"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
          style={sectionHeadStyle}
        >
          <h2 style={sectionTitleStyle}>Unassigned Jobs</h2>
          <span style={sectionMetaStyle}>{outstanding.length} waiting to allocate</span>
        </div>
        {outstanding.length === 0 ? (
          <div
            data-dev-section="1"
            data-dev-section-key="workshop-unassigned-empty"
            data-dev-section-parent="workshop-unassigned-section"
            data-dev-section-type="content-card"
            data-dev-background-token="theme"
            data-dev-text-preview="Everything is allocated"
            style={{ ...emptyRowStyle(activeDropTarget === "outstanding"), marginTop: "12px" }}
          >
            {activeDropTarget === "outstanding" && draggingJob
              ? "Drop job here to unassign"
              : searchTerm?.trim()
              ? "No matching unassigned jobs."
              : "Everything is allocated — drag a job here to return it to the pool."}
          </div>
        ) : (
          <div
            data-dev-section="1"
            data-dev-section-key="workshop-unassigned-grid"
            data-dev-section-parent="workshop-unassigned-section"
            data-dev-section-type="section-shell"
            data-dev-background-token="transparent"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--wqp-gap)", marginTop: "14px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}
          >
            {outstanding.map((job) => (
              <React.Fragment key={job.jobNumber}>
                {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "before") && (
                  <div style={{ height: "3px", width: "100%", borderRadius: "var(--radius-pill)", background: "var(--primary)" }} />
                )}
                <WorkshopQueueCard
                  job={job}
                  variant="unassigned"
                  refCallback={(node) => {
                    if (node) jobCardRefs.current[job.jobNumber] = node;
                    else if (jobCardRefs.current[job.jobNumber]) delete jobCardRefs.current[job.jobNumber];
                  }}
                  onPointerDown={handleCardPointerDown(job, () => handleOpenJobDetails(job))}
                  isDragging={draggingJob?.jobNumber === job.jobNumber}
                  isHighlighted={highlighted.includes(job.jobNumber)}
                  deriveJobTypeLabel={deriveJobTypeLabel}
                  formatAppointmentTime={formatAppointmentTime}
                  estimateJobHours={estimateJobHours}
                  devSectionParent="workshop-unassigned-grid"
                  devSectionPrefix="workshop-unassigned-job"
                />
                {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "after") && (
                  <div style={{ height: "3px", width: "100%", borderRadius: "var(--radius-pill)", background: "var(--primary)" }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </LayerTheme>

      {/* ===================== 4 + 5 · Next jobs board ===================== */}
      <WorkshopQueueBoard techRows={techRowsSafe} motRows={motRowsSafe} activeDropTarget={activeDropTarget} {...sharedDropProps} />

      {/* ============================ Drag ghost ============================ */}
      {isDragActive && draggingJob && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: dragState.clientX + DRAG_PREVIEW_OFFSET_PX,
            top: dragState.clientY + DRAG_PREVIEW_OFFSET_PX,
            pointerEvents: "none",
            zIndex: 3200,
            minWidth: "160px",
            maxWidth: "240px",
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(180deg, rgba(var(--surface-rgb), 0.82), rgba(var(--surface-rgb), 0.62))",
            backdropFilter: "blur(16px) saturate(140%)",
            WebkitBackdropFilter: "blur(16px) saturate(140%)",
            boxShadow: "0 16px 34px rgba(0, 0, 0, 0.34)",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--accent-strong)" }}>#{draggingJob.jobNumber}</div>
          <div style={{ fontSize: "11px", color: "var(--text-1)" }}>{draggingJob.reg || "Reg TBC"}</div>
        </div>
      )}

      {/* ============================ 6 · Details modal ==================== */}
      {selectedJob && (
        <WorkshopJobModal
          job={selectedJob}
          feedback={feedbackMessage}
          onClose={handleCloseJobDetails}
          onOpenJobCard={handleViewSelectedJobCard}
          onUnassign={unassignTechFromJob}
          onQuickAction={handleQuickAction}
          estimateJobHours={estimateJobHours}
          deriveJobTypeLabel={deriveJobTypeLabel}
          formatAppointmentTime={formatAppointmentTime}
          getJobRequestItems={getJobRequestItems}
        />
      )}

      {/* The only non-inline styling: responsive sizing vars, hover lifts and the
          drag-active body lock — things inline styles fundamentally can't do.
          Scoped class names (wqp-*) keep this from leaking into other pages. */}
      <style jsx global>{`
        .wqp-shell {
          --wqp-user-col: 248px;
          --wqp-card-w: 212px;
          --wqp-assigned-w: 232px;
          --wqp-gap: 14px;
          --wqp-row-min-h: 104px;
          --wqp-avatar: 38px;
        }
        @media (max-width: 1279px) {
          .wqp-shell {
            --wqp-user-col: 210px;
            --wqp-card-w: 198px;
            --wqp-assigned-w: 220px;
            --wqp-row-min-h: 100px;
          }
        }
        @media (max-width: 767px) {
          .wqp-shell {
            --wqp-user-col: 158px;
            --wqp-card-w: 184px;
            --wqp-assigned-w: 204px;
            --wqp-row-min-h: 96px;
            --wqp-avatar: 32px;
          }
          .wqp-searchwrap {
            margin-left: 0;
            max-width: 100%;
          }
          .wqp-fieldgrid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
        .wqp-searchwrap {
          margin-left: auto;
          min-width: 220px;
          max-width: 340px;
          flex: 1 1 220px;
        }
        .wqp-lift {
          transition: transform 0.14s ease, box-shadow 0.18s ease;
        }
        .wqp-lift:hover {
          transform: translateY(-2px);
          box-shadow: ${LIFT};
        }
        .wqp-grab:active {
          cursor: grabbing;
        }
        body.nextjobs-drag-active,
        body.nextjobs-drag-active * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -webkit-touch-callout: none !important;
          cursor: grabbing !important;
        }
      `}</style>
    </div>
  );
}
