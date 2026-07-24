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
import PopupModal from "@/components/popups/popupStyleApi";

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
  isClockedOn = false,
  deriveJobTypeLabel,
  formatAppointmentTime,
  estimateJobHours,
  variant = "", // "assigned" | "unassigned" | "checked-in" | ""
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
  const checkedIn = variant === "checked-in";
  const timingText = checkedIn
    ? `Checked in ${formatClock(job.checkedInAt)}`
    : bookingTime && bookingTime !== "No appointment"
      ? bookingTime
      : "—";

  const cardStyle = {
    flex: "0 0 auto",
    width: "var(--wqp-card-w)",
    minHeight: "var(--wqp-card-min-h)",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    padding: "12px 14px",
    borderRadius: "var(--radius-md)",
    // Assigned card turns success-tinted once the technician is clocked onto it.
    background: assigned && isClockedOn ? "var(--success-surface)" : "var(--surface)",
    color: "var(--text-1)",
    textAlign: "left",
    cursor: "grab",
    touchAction: "none",
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isHighlighted ? HIGHLIGHT_SHADOW : LIFT_SM,
    alignSelf: "center",
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
        <span style={{ marginLeft: "auto", maxWidth: "55%", padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "rgba(var(--accent-base-rgb), 0.1)", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          minHeight: "2.7em",
        }}
      >
        {vehicle} • {customer}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", minWidth: 0, marginTop: "1px" }}>
        {typeLabel && (
          <span style={{ flex: "1 1 auto", minWidth: 0, maxWidth: "100%", fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "2px 7px", borderRadius: "var(--radius-pill)", background: "rgba(var(--accent-base-rgb), 0.1)", color: "var(--surfaceTextMuted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {typeLabel}
          </span>
        )}
        <StatusPill meta={statusMeta} marginLeftAuto={true} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", minWidth: 0, marginTop: "1px" }}>
        <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {timingText}
        </span>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--surfaceTextMuted)" }}>
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
  clockedOnJobNumbers,
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
        gap: "var(--wqp-gap)",
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
          const isClockedOn = (clockedOnJobNumbers || []).includes(job.jobNumber);
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
                isClockedOn={isClockedOn}
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

  return (
    <React.Fragment>
      <div
        data-dnd-target-type="assignee"
        data-dnd-target-key={row.panelKey}
        data-dev-section="1"
        data-dev-section-key={`workshop-queue-user-${toDevSectionKey(row.panelKey)}`}
        data-dev-section-parent={`workshop-queue-row-${toDevSectionKey(row.panelKey)}`}
        data-dev-section-type="content-card"
        data-dev-background-token="theme"
        data-dev-text-preview={`${row.name} ${row.role} ${row.jobs.length} ${unit}`}
        style={{ position: "sticky", left: 0, zIndex: 2, display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", minHeight: "var(--wqp-row-min-h)", background: "rgba(var(--accent-base-rgb), 0.06)", boxShadow: HAIRLINE_BOTTOM }}
      >
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
      style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "10px", boxSizing: "border-box", minHeight: "56px", padding: "18px 22px", background: "rgba(var(--accent-base-rgb), 0.06)", boxShadow: "inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.18)" }}
    >
      <span style={{ position: "sticky", left: "22px", zIndex: 1, display: "inline-flex", alignItems: "baseline", gap: "8px" }}>
        <span style={sectionTitleStyle}>{title}</span>
        <span style={sectionMetaStyle}>{count}</span>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------- Board ----
// Memoised: during a drag the planner re-renders every frame to move the ghost,
// but the board's props (rows, drag target, handlers) only change when the drop
// target actually changes — so this whole 11-row grid stays put between those,
// keeping the drag smooth and stopping the rest of the board from flickering.
const WorkshopQueueBoard = React.memo(function WorkshopQueueBoard({ techRows, motRows, activeDropTarget, ...shared }) {
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
});

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

function WorkshopJobModal({ job, feedback, onClose, onOpenJobCard, onUnassign, onAssign, onQuickAction, estimateJobHours, deriveJobTypeLabel, formatAppointmentTime, getJobRequestItems }) {
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
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={onAssign}>Assign Technician</button>
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

function TechnicianAssignmentModal({ job, technicians, onClose, onAssign }) {
  const [technicianId, setTechnicianId] = React.useState("");
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  React.useEffect(() => {
    setTechnicianId("");
    setIsAssigning(false);
    setErrorMessage("");
  }, [job?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!technicianId || isAssigning) return;

    setIsAssigning(true);
    setErrorMessage("");
    try {
      await onAssign?.(technicianId);
      onClose?.();
    } catch (error) {
      setErrorMessage(error?.message || "Failed to assign technician.");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <PopupModal
      isOpen={Boolean(job)}
      onClose={isAssigning ? undefined : onClose}
      closeOnBackdrop={!isAssigning}
      ariaLabel={`Assign technician to job ${job?.jobNumber || ""}`}
      cardStyle={{ width: "min(100%, 440px)", padding: "24px" }}
    >
      <form onSubmit={handleSubmit}>
        <h3 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 800, color: "var(--accent-strong)" }}>
          Assign Technician
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--surfaceTextMuted)" }}>
          Choose who should receive job #{job?.jobNumber}. It will be placed at the end of their row.
        </p>

        <label htmlFor="workshop-technician-assignment" style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: 700, color: "var(--text-1)" }}>
          Technician
        </label>
        <select
          id="workshop-technician-assignment"
          className="app-input"
          value={technicianId}
          onChange={(event) => setTechnicianId(event.target.value)}
          disabled={isAssigning}
          autoFocus
          style={{ width: "100%", minHeight: "44px", marginBottom: "16px" }}
        >
          <option value="">Select a technician</option>
          {technicians.map((technician) => (
            <option key={String(technician.id)} value={String(technician.id)}>
              {technician.name}
            </option>
          ))}
        </select>

        {errorMessage && (
          <div role="alert" style={{ marginBottom: "16px", padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--danger-surface)", color: "var(--danger)", fontSize: "13px", fontWeight: 600 }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "8px" }}>
          <button type="submit" className="app-btn app-btn--primary" disabled={!technicianId || isAssigning}>
            {isAssigning ? "Assigning…" : "Assign Technician"}
          </button>
          <button type="button" className="app-btn app-btn--secondary" onClick={onClose} disabled={isAssigning}>
            Close
          </button>
        </div>
      </form>
    </PopupModal>
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
  // job numbers a technician/MOT user is currently clocked onto (success tint)
  clockedOnJobNumbers,
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
  assignableStaffList,
  assignSelectedJobToTechnician,
}) {
  // The job-type dropdown was removed — the single search box (page-driven) now
  // drives all matching across every section. The search only highlights matches
  // (it never filters cards out), so `outstandingJobs` arrives unfiltered and the
  // matching job numbers come through `highlightedSearchJobNumbers`.
  const techRowsSafe = techRows || [];
  const motRowsSafe = motRows || [];
  const outstanding = outstandingJobs || [];
  const highlighted = highlightedSearchJobNumbers || [];
  const clockedOn = clockedOnJobNumbers || [];

  // Search bar rests in flow (top-left). The moment it's focused (being used) it
  // becomes `position: sticky` so it can never scroll out of view — but it looks
  // identical to its resting self until it's actually pinned. Only once the page
  // scrolls far enough that the bar reaches the sticky line do we add the elevated
  // "float" styling (surface + lift), so it doesn't visibly change just from being
  // focused. A 1px sentinel at the bar's rest spot, watched by an observer, tells
  // us when it's stuck. Position is gated on focus alone (it must be sticky BEFORE
  // any scroll); the cosmetic float is gated on focus + stuck. Blur → back to rest.
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [searchStuck, setSearchStuck] = React.useState(false);
  const [checkedInCollapsed, setCheckedInCollapsed] = React.useState(false);
  const [unassignedCollapsed, setUnassignedCollapsed] = React.useState(false);
  const [showTechnicianAssignment, setShowTechnicianAssignment] = React.useState(false);
  const searchSentinelRef = React.useRef(null);

  React.useEffect(() => {
    if (!selectedJob) setShowTechnicianAssignment(false);
  }, [selectedJob]);

  React.useEffect(() => {
    const node = searchSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    // Find the actual scroll container (nearest vertically-scrollable ancestor) so
    // the "stuck" detection is measured against the same box position: sticky pins
    // to — not the viewport, which sits above this card's internal scroller.
    let root = node.parentElement;
    while (root && root !== document.body) {
      const oy = window.getComputedStyle(root).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      root = root.parentElement;
    }
    const observer = new IntersectionObserver(
      // Stuck = the rest position has scrolled up out of the container's top, i.e.
      // the bar has lifted off and is now pinned. At rest the sentinel sits at the
      // container top (intersecting) → not stuck → no float styling, no movement.
      ([entry]) => setSearchStuck(!entry.isIntersecting),
      { root: root && root !== document.body ? root : null, threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const searchSticky = searchFocused; // pinned position while in use
  const searchFloating = searchFocused && searchStuck; // elevated look only when stuck

  const sharedDropProps = {
    draggingJob,
    matchesDropIndicator,
    jobCardRefs,
    handleCardPointerDown,
    handleOpenJobDetails,
    highlightedJobNumbers: highlighted,
    clockedOnJobNumbers: clockedOn,
    deriveJobTypeLabel,
    formatAppointmentTime,
    estimateJobHours,
  };

  const handleQuickAction = (type) => {
    if (type === "move") {
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
      style={{ position: "relative", display: "flex", flexDirection: "column", gap: "16px", width: "100%", minWidth: 0, minHeight: "100%" }}
    >
      {/* Sentinel at the search bar's resting position. While it stays in view the
          bar is at rest (no float styling); once it scrolls past the sticky line
          the bar is "stuck" and gets its elevated look. */}
      <div ref={searchSentinelRef} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: "1px", height: "1px", pointerEvents: "none" }} />

      {/* ===================== Search (top — all sections) ================= */}
      {/* One search box for the whole page. The page matches the term against
          every job (checked-in, unassigned and assigned) and feeds back the
          matching job numbers, so a search lights up matches in any section. */}
      {SearchBar && (
        <div
          className={`wqp-searchwrap${searchSticky ? " wqp-searchwrap--sticky" : ""}${searchFloating ? " wqp-searchwrap--stuck" : ""}`}
          data-dev-section="1"
          data-dev-section-key="workshop-search-filter"
          data-dev-section-parent="workshop-queue-planner"
          data-dev-section-type="filter-row"
          data-dev-background-token="transparent"
          data-dev-text-preview="Search all sections"
        >
          <SearchBar
            placeholder="Search job, reg, or customer across all sections"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      )}

      {/* ============================ 1 · Checked In Jobs =================== */}
      <LayerTheme
        as="section"
        sectionKey="workshop-checked-in-section"
        parentKey="workshop-queue-planner"
        sectionType="content-card"
        backgroundToken="theme"
        radius={RADIUS_LG}
        padding={checkedInCollapsed ? "0 18px" : "18px"}
        gap="0"
        data-dev-text-preview={`Checked In Jobs ${checkedInJobs.length} checked in`}
        style={{
          boxShadow: LIFT,
          height: checkedInCollapsed ? "44px" : "auto",
          minHeight: checkedInCollapsed ? "44px" : undefined,
          maxHeight: checkedInCollapsed ? "44px" : undefined,
          overflow: "hidden"
        }}
      >
        <div
          data-dev-section="1"
          data-dev-section-key="workshop-checked-in-header"
          data-dev-section-parent="workshop-checked-in-section"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
          role="button"
          tabIndex={0}
          aria-expanded={!checkedInCollapsed}
          onClick={() => setCheckedInCollapsed((collapsed) => !collapsed)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setCheckedInCollapsed((collapsed) => !collapsed);
            }
          }}
          style={{
            ...sectionHeadStyle,
            minHeight: checkedInCollapsed ? "44px" : undefined,
            cursor: "pointer",
            flexWrap: checkedInCollapsed ? "nowrap" : "wrap"
          }}
        >
          <h2 style={sectionTitleStyle}>Checked In Jobs</h2>
          {!checkedInCollapsed && <span style={sectionMetaStyle}>{checkedInJobs.length} checked in</span>}
        </div>
        {!checkedInCollapsed && (checkedInJobs.length === 0 ? (
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
            {checkedInJobs.map((job) => (
              <WorkshopQueueCard
                key={job.jobNumber}
                job={job}
                variant="checked-in"
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
                devSectionParent="workshop-checked-in-strip"
                devSectionPrefix="workshop-checked-in-job"
              />
            ))}
          </div>
        ))}
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
        padding={unassignedCollapsed ? "0 18px" : "18px"}
        gap="0"
        data-dnd-target-type="outstanding"
        data-dnd-target-key="outstanding"
        data-dev-text-preview={`Unassigned Jobs ${outstanding.length} waiting to allocate`}
        style={{
          transition: "box-shadow 0.15s ease, height 0.15s ease",
          boxShadow: activeDropTarget === "outstanding" ? `${LIFT}, inset 0 0 0 2px var(--primary)` : LIFT,
          height: unassignedCollapsed ? "44px" : "auto",
          minHeight: unassignedCollapsed ? "44px" : undefined,
          maxHeight: unassignedCollapsed ? "44px" : undefined,
          overflow: "hidden"
        }}
      >
        <div
          data-dev-section="1"
          data-dev-section-key="workshop-unassigned-header"
          data-dev-section-parent="workshop-unassigned-section"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
          role="button"
          tabIndex={0}
          aria-expanded={!unassignedCollapsed}
          onClick={() => setUnassignedCollapsed((collapsed) => !collapsed)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setUnassignedCollapsed((collapsed) => !collapsed);
            }
          }}
          style={{
            ...sectionHeadStyle,
            minHeight: unassignedCollapsed ? "44px" : undefined,
            cursor: "pointer",
            flexWrap: unassignedCollapsed ? "nowrap" : "wrap"
          }}
        >
          <h2 style={sectionTitleStyle}>Unassigned Jobs</h2>
          {!unassignedCollapsed && <span style={sectionMetaStyle}>{outstanding.length} waiting to allocate</span>}
        </div>
        {!unassignedCollapsed && (outstanding.length === 0 ? (
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
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, var(--wqp-card-w))", gap: "var(--wqp-gap)", marginTop: "14px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}
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
        ))}
      </LayerTheme>

      {/* ===================== 4 + 5 · Next jobs board ===================== */}
      <WorkshopQueueBoard techRows={techRowsSafe} motRows={motRowsSafe} activeDropTarget={activeDropTarget} {...sharedDropProps} />

      {/* ============================ Drag ghost ============================ */}
      {isDragActive && draggingJob && (
        <div
          aria-hidden="true"
          data-dnd-drag-preview="true"
          style={{
            position: "fixed",
            // Move via a compositor transform (not left/top) so the ghost glides
            // without forcing layout on every frame — same visual position.
            left: 0,
            top: 0,
            transform: `translate3d(${dragState.clientX + DRAG_PREVIEW_OFFSET_PX}px, ${dragState.clientY + DRAG_PREVIEW_OFFSET_PX}px, 0)`,
            willChange: "transform",
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
          onAssign={() => setShowTechnicianAssignment(true)}
          onQuickAction={handleQuickAction}
          estimateJobHours={estimateJobHours}
          deriveJobTypeLabel={deriveJobTypeLabel}
          formatAppointmentTime={formatAppointmentTime}
          getJobRequestItems={getJobRequestItems}
        />
      )}

      {showTechnicianAssignment && selectedJob && (
        <TechnicianAssignmentModal
          job={selectedJob}
          technicians={assignableStaffList || []}
          onClose={() => setShowTechnicianAssignment(false)}
          onAssign={assignSelectedJobToTechnician}
        />
      )}

      {/* The only non-inline styling: responsive sizing vars, hover lifts and the
          drag-active body lock — things inline styles fundamentally can't do.
          Scoped class names (wqp-*) keep this from leaking into other pages. */}
      <style jsx global>{`
        .wqp-shell {
          --wqp-user-col: 200px;
          --wqp-card-w: 212px;
          --wqp-card-min-h: 132px;
          --wqp-gap: 14px;
          --wqp-row-min-h: 104px;
        }
        @media (max-width: 1279px) {
          .wqp-shell {
            --wqp-user-col: 176px;
            --wqp-card-w: 198px;
            --wqp-row-min-h: 100px;
          }
        }
        @media (max-width: 767px) {
          .wqp-shell {
            --wqp-user-col: 144px;
            --wqp-card-w: 184px;
            --wqp-row-min-h: 96px;
          }
          .wqp-searchwrap {
            align-self: stretch;
            width: 100%;
            max-width: 100%;
          }
          .wqp-fieldgrid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
        .wqp-searchwrap {
          /* Rests top-left, on its own line at the top of the page. */
          align-self: flex-start;
          width: 340px;
          min-width: 220px;
          max-width: 100%;
          /* Hug the search bar's own height — the shell is a column flex container,
             so a flex-basis here would stretch the wrapper's height, not its width. */
          flex: 0 0 auto;
        }
        /* While the search is in use it's sticky so it can never scroll out of
           view. The bar is the first element in the scroll container, so its rest
           offset is ~0 — top:0 keeps it exactly where it rests (no push-down / no
           jump into the section below on focus). It only lifts once stuck. */
        .wqp-searchwrap--sticky {
          position: sticky;
          top: 0;
          /* Above every card / section in the page (they sit at z-index 1–3), but
             below the job-details modal (3200) so popups still cover it. */
          z-index: 200;
          isolation: isolate;
          transition: top 0.18s ease, box-shadow 0.18s ease;
        }
        /* Once actually stuck (scrolled off its rest spot), lift it clear of the
           topbar and give it the elevated look so content passes cleanly under it. */
        .wqp-searchwrap--stuck {
          /* Clear the topbar (≈75px) so it isn't covered when the bar folds down. */
          top: 88px;
          background: var(--surface);
          border-radius: var(--radius-md);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
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
