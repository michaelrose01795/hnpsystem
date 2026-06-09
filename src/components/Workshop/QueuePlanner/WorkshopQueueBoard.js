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
import {
  getStatusMeta,
  getInitials,
  getCapacity,
} from "./workshopQueueHelpers";

// Small dotted drag-grip icon — signals a card / row is draggable.
export function DragGrip({ height = 12 }) {
  return (
    <svg width={height * 0.6} height={height} viewBox="0 0 6 10" aria-hidden="true" fill="currentColor">
      <circle cx="1.5" cy="1.5" r="1" />
      <circle cx="4.5" cy="1.5" r="1" />
      <circle cx="1.5" cy="5" r="1" />
      <circle cx="4.5" cy="5" r="1" />
      <circle cx="1.5" cy="8.5" r="1" />
      <circle cx="4.5" cy="8.5" r="1" />
    </svg>
  );
}

const shortHours = (hours) => {
  const value = Number(hours) || 0;
  return `${value % 1 === 0 ? value : value.toFixed(1)}h`;
};

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
      onPointerDown={onPointerDown}
      className={classes}
      title={`#${job.jobNumber} · ${vehicle} · ${customer}`}
    >
      <div className={styles.jobCardHead}>
        <span className={styles.jobGrip}>
          <DragGrip height={11} />
        </span>
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
          {bookingTime && bookingTime !== "No appointment" ? `🕑 ${bookingTime}` : "🕑 —"}
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
    <div className={classes} data-dnd-target-type="assignee" data-dnd-target-key={panelKey}>
      {jobs.length === 0 ? (
        <div className={`${styles.emptyRow} ${isActive ? styles.emptyRowActive : ""}`}>
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
      <div className={styles.userCell}>
        <span className={styles.dragHandle} title="Drag to reorder">
          <DragGrip height={16} />
        </span>
        <span className={styles.avatar}>{getInitials(row.name)}</span>
        <div className={styles.userMeta}>
          <span className={styles.userName}>{row.name}</span>
          <span className={styles.userRole}>{row.role}</span>
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
export function WorkshopQueueHeader({ icon, title, count }) {
  return (
    <div className={styles.groupHead}>
      {icon && <span className={styles.groupHeadIcon}>{icon}</span>}
      <span className={styles.groupHeadTitle}>{title}</span>
      <span className={styles.groupHeadCount}>({count})</span>
    </div>
  );
}

// ------------------------------------------------------------------- Board ----
export default function WorkshopQueueBoard({ techRows, motRows, activeDropTarget, ...shared }) {
  const renderRow = (row) => (
    <WorkshopQueueRow
      key={row.panelKey}
      row={row}
      isActive={activeDropTarget === row.panelKey}
      {...shared}
    />
  );

  return (
    <div className={`${styles.glass} ${styles.board}`} data-presentation="workshop-queue-board">
      <div className={styles.boardScroll}>
        <div className={styles.boardGrid} role="grid">
          <WorkshopQueueHeader icon="🔧" title="Technicians" count={techRows.length} />
          {techRows.map(renderRow)}
          {motRows.length > 0 && <WorkshopQueueHeader icon="🚗" title="MOT Users" count={motRows.length} />}
          {motRows.map(renderRow)}
        </div>
      </div>
    </div>
  );
}
