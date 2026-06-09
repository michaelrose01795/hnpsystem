// file location: src/components/Workshop/QueuePlanner/WorkshopQueueBoard.js
// The main dispatch board for the Workshop Controller Board. CSS-Grid based (NOT
// an HTML table) with a sticky left user column and per-user horizontal job
// queues laid out left→right in execution order. Exposes the planner's named
// primitives: WorkshopQueueBoard / WorkshopQueueHeader / WorkshopQueueRow /
// WorkshopQueueCard / WorkshopQueueDropZone.
//
// Drag-and-drop reuses the existing pointer-capture engine in the page logic
// (`nextjobs.js`) via the data-dnd-* attribute contract and `handleCardPointerDown`,
// so cards stay draggable between technicians / MOT users / the unassigned queue.
import React from "react";
import styles from "./WorkshopQueuePlanner.module.css";
import { getStatusMeta, getCapacity } from "./workshopQueueHelpers";

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

// ---------------------------------------------------------------- Job card ----
export function WorkshopQueueCard({
  job,
  refCallback,
  onPointerDown,
  isDragging,
  isHighlighted,
  deriveJobTypeLabel,
  formatAppointmentTime,
  estimateJobHours,
  className = "",
  devSectionParent = "",
  devSectionPrefix = "workshop-queue-job",
}) {
  const statusMeta = getStatusMeta(job.status);
  const vehicle = [job.make, job.model].filter(Boolean).join(" ") || job.makeModel || "Vehicle TBC";
  const customer = job.customer || "Unknown customer";
  const bookingTime = formatAppointmentTime ? formatAppointmentTime(job) : "";
  const typeLabel = deriveJobTypeLabel ? deriveJobTypeLabel(job) : job.type;
  const estHours = estimateJobHours ? estimateJobHours(job) : 0;

  const classes = [
    styles.jobCard,
    isDragging ? styles.jobCardDragging : "",
    isHighlighted ? styles.jobCardHighlight : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={refCallback}
      data-dnd-job-card="true"
      data-dnd-job-number={job.jobNumber}
      data-dev-section="1"
      data-dev-section-key={`${devSectionPrefix}-${toDevSectionKey(job.jobNumber)}`}
      data-dev-section-parent={devSectionParent}
      data-dev-section-type="content-card"
      data-dev-background-token="theme"
      data-dev-text-preview={`${job.jobNumber || "Job"} ${job.reg || ""} ${vehicle} ${customer} ${statusMeta.label}`}
      onPointerDown={onPointerDown}
      className={classes}
      title={`#${job.jobNumber} · ${vehicle} · ${customer}`}
    >
      <div className={styles.jobCardHead}>
        <span className={styles.jobNo}>#{job.jobNumber}</span>
        <span className={styles.jobReg}>{job.reg || "—"}</span>
      </div>
      <div className={styles.jobLine}>
        {vehicle} • {customer}
      </div>
      <div className={styles.jobCardFoot}>
        {typeLabel && <span className={styles.jobType}>{typeLabel}</span>}
        <span className={`${styles.statusPill} ${statusMeta.pill}`}>
          <span className={styles.statusDot} style={{ background: statusMeta.dot }} />
          {statusMeta.label}
        </span>
      </div>
      <div className={styles.jobCardFoot}>
        <span className={styles.jobTime}>
          {bookingTime && bookingTime !== "No appointment" ? bookingTime : "—"}
        </span>
        <span className={styles.jobTime}>~{shortHours(estHours)}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Row drop zone ----
// The right-hand queue cell doubles as the drop target for a user row.
export function WorkshopQueueDropZone({
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
  const classes = [styles.queueCell, isActive ? styles.queueCellActive : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      data-dnd-target-type="assignee"
      data-dnd-target-key={panelKey}
      data-dev-section="1"
      data-dev-section-key={`workshop-queue-dropzone-${toDevSectionKey(panelKey)}`}
      data-dev-section-parent={`workshop-queue-row-${toDevSectionKey(panelKey)}`}
      data-dev-section-type="section-shell"
      data-dev-background-token="theme"
      data-dev-text-preview={`Drop zone for ${panelKey}`}
    >
      {jobs.length === 0 ? (
        <div
          className={`${styles.emptyRow} ${isActive ? styles.emptyRowActive : ""}`}
          data-dev-section="1"
          data-dev-section-key={`workshop-queue-empty-${toDevSectionKey(panelKey)}`}
          data-dev-section-parent={`workshop-queue-dropzone-${toDevSectionKey(panelKey)}`}
          data-dev-section-type="content-card"
          data-dev-background-token="theme"
          data-dev-text-preview={`No next job assigned for ${panelKey}`}
        >
          {isActive && draggingJob ? "Drop job here" : "No next job assigned"}
        </div>
      ) : (
        jobs.map((job, index) => {
          const isHighlighted = highlightedJobNumbers.includes(job.jobNumber);
          return (
            <React.Fragment key={job.jobNumber}>
              {matchesDropIndicator("assignee", panelKey, job.jobNumber, "before") && (
                <div className={styles.dropBar} />
              )}
              {/* execution-order arrow between queued cards */}
              {index > 0 && <span className={styles.arrow}>→</span>}
              <WorkshopQueueCard
                job={job}
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
              {matchesDropIndicator("assignee", panelKey, job.jobNumber, "after") && (
                <div className={styles.dropBar} />
              )}
            </React.Fragment>
          );
        })
      )}
      {/* trailing indicator when dropping into the tail of a populated row */}
      {jobs.length > 0 && isActive && draggingJob && !jobs.some((j) => j.jobNumber === draggingJob.jobNumber) && (
        <div className={styles.dropBar} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------- One row ----
export function WorkshopQueueRow({ row, estimateJobHours, ...dropZoneProps }) {
  const totalHours = row.jobs.reduce((sum, job) => sum + (estimateJobHours(job) || 0), 0);
  const capacity = getCapacity(totalHours);
  const unit = row.isMot ? (row.jobs.length === 1 ? "MOT" : "MOTs") : row.jobs.length === 1 ? "job" : "jobs";

  return (
    <React.Fragment>
      <div
        className={styles.userCell}
        data-dev-section="1"
        data-dev-section-key={`workshop-queue-user-${toDevSectionKey(row.panelKey)}`}
        data-dev-section-parent={`workshop-queue-row-${toDevSectionKey(row.panelKey)}`}
        data-dev-section-type="content-card"
        data-dev-background-token="theme"
        data-dev-text-preview={`${row.name} ${row.role} ${row.jobs.length} ${unit}`}
      >
        <div className={styles.userMeta}>
          <span className={styles.userName}>{row.name}</span>
          <span className={styles.workload} title={capacity.label}>
            <span className={`${styles.workloadDot} ${capacity.dot}`} />
            {row.jobs.length} {unit} • {shortHours(totalHours)}
          </span>
          <span className={styles.capacityTrack} title={capacity.label}>
            <span className={`${styles.capacityFill} ${capacity.fill}`} style={{ width: `${Math.max(capacity.pct, 4)}%` }} />
          </span>
        </div>
      </div>
      <WorkshopQueueDropZone
        panelKey={row.panelKey}
        jobs={row.jobs}
        estimateJobHours={estimateJobHours}
        {...dropZoneProps}
      />
    </React.Fragment>
  );
}

// --------------------------------------------------------------- Group head ----
export function WorkshopQueueHeader({ title, count }) {
  const key = title.toLowerCase().includes("mot") ? "mot" : "technicians";
  return (
    <div
      className={styles.groupHead}
      data-dev-section="1"
      data-dev-section-key={`workshop-queue-header-${key}`}
      data-dev-section-parent="workshop-queue-board-grid"
      data-dev-section-type="toolbar"
      data-dev-background-token="theme"
      data-dev-text-preview={`${title} ${count}`}
    >
      <span className={styles.groupHeadTitle}>{title}</span>
      <span className={styles.groupHeadCount}>({count})</span>
    </div>
  );
}

// ------------------------------------------------------------------- Board ----
export default function WorkshopQueueBoard({ techRows, motRows, activeDropTarget, ...shared }) {
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
      <WorkshopQueueRow
        row={row}
        isActive={activeDropTarget === row.panelKey}
        {...shared}
      />
    </div>
  );

  return (
    <div
      className={`${styles.themeSurface} ${styles.board}`}
      data-presentation="workshop-queue-board"
      data-dev-section="1"
      data-dev-section-key="workshop-queue-board"
      data-dev-section-parent="workshop-queue-planner"
      data-dev-section-type="content-card"
      data-dev-background-token="theme"
      data-dev-text-preview={`Workshop queue board ${techRows.length} technicians ${motRows.length} MOT users`}
    >
      <div
        className={styles.boardScroll}
        data-dev-section="1"
        data-dev-section-key="workshop-queue-board-scroll"
        data-dev-section-parent="workshop-queue-board"
        data-dev-section-type="section-shell"
        data-dev-background-token="transparent"
      >
        <div
          className={styles.boardGrid}
          role="grid"
          data-dev-section="1"
          data-dev-section-key="workshop-queue-board-grid"
          data-dev-section-parent="workshop-queue-board-scroll"
          data-dev-section-type="data-table"
          data-dev-background-token="transparent"
        >
          <WorkshopQueueHeader title="Technicians" count={techRows.length} />
          {techRows.map(renderRow)}
          {motRows.length > 0 && <WorkshopQueueHeader title="MOT Users" count={motRows.length} />}
          {motRows.map(renderRow)}
        </div>
      </div>
    </div>
  );
}
