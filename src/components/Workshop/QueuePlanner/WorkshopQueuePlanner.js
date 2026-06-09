// file location: src/components/Workshop/QueuePlanner/WorkshopQueuePlanner.js
// Top-level presentation for the Workshop Controller Board — the dealership
// dispatch screen that replaces the old Next Jobs table/list. Composes:
//   1. Page header           (title + live workshop summary stats)
//   2. Checked In Jobs        (jobs currently in the workshop, glass cards)
//   3. Filter / search bar    (Today / Tomorrow / This Week / All · type chips)
//   4. Next Jobs board        (sticky user column + per-user horizontal queues,
//                              technician rows then MOT-user rows)
//   5. Unassigned Jobs queue  (always-visible drop target for allocation)
//   6. Job details modal      (full summary + quick actions)
//
// All data + the pointer drag-and-drop engine live in the page logic
// (`src/pages/job-cards/waiting/nextjobs.js`). This component is deliberately
// presentational. Surfaces use a page-scoped Liquid-Glass treatment (translucent
// surface + backdrop blur) defined in the CSS module; filter controls use the
// canonical shared `.app-btn` family so they match every other staff control.
import React, { useCallback, useMemo, useState } from "react";
import styles from "./WorkshopQueuePlanner.module.css";
import WorkshopQueueBoard, { WorkshopQueueCard } from "./WorkshopQueueBoard";
import WorkshopJobModal from "./WorkshopJobModal";
import { getStatusMeta, formatClock } from "./workshopQueueHelpers";

const DATE_RANGES = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This Week" },
  { key: "all", label: "All" },
];

const TYPE_OPTIONS = [
  { key: "technician", label: "Technician" },
  { key: "mot", label: "MOT" },
  { key: "service", label: "Service" },
  { key: "diagnostic", label: "Diagnostic" },
  { key: "retail", label: "Retail" },
  { key: "warranty", label: "Warranty" },
];

const startOfDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

// Shared staff button family — secondary control, pill, small. `.is-active` paints
// the selected (brand) state. We never invent a new button style here.
const filterBtnClass = (active) =>
  `app-btn app-btn--secondary app-btn--sm app-btn--pill${active ? " is-active" : ""}`;

export default function WorkshopQueuePlanner({
  // data
  techRows,
  motRows,
  outstandingJobs,
  clockedInJobs,
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
  handleOpenCurrentClocking,
  selectedJob,
  feedbackMessage,
  setFeedbackMessage,
  handleCloseJobDetails,
  handleViewSelectedJobCard,
  unassignTechFromJob,
}) {
  const [dateRange, setDateRange] = useState("today");
  const [typeFilters, setTypeFilters] = useState(() => new Set());

  const toggleType = (key) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- client-side filters (date range + job type) ----
  // Search is handled by the page (it highlights + scrolls to matches), so it is
  // intentionally NOT a hard filter here — that keeps the existing behaviour.
  const inDateRange = useMemo(() => {
    return (job) => {
      if (dateRange === "all") return true;
      const iso = job?.appointment?.scheduledTime || job?.appointment?.scheduled_time;
      // Jobs with no appointment (active / walk-in work) always stay visible.
      if (!iso) return true;
      const day = startOfDay(iso);
      if (!day) return true;
      const today = startOfDay(new Date());
      if (dateRange === "today") return day.getTime() === today.getTime();
      if (dateRange === "tomorrow") {
        const t = new Date(today);
        t.setDate(t.getDate() + 1);
        return day.getTime() === t.getTime();
      }
      if (dateRange === "week") {
        const end = new Date(today);
        end.setDate(end.getDate() + 7);
        return day >= today && day <= end;
      }
      return true;
    };
  }, [dateRange]);

  const matchesType = useMemo(() => {
    return (job) => {
      if (typeFilters.size === 0) return true;
      const hay = [job.type, deriveJobTypeLabel ? deriveJobTypeLabel(job) : "", ...(job.jobCategories || [])]
        .join(" ")
        .toLowerCase();
      for (const key of typeFilters) {
        if (key === "diagnostic" && hay.includes("diag")) return true;
        if (hay.includes(key)) return true;
      }
      return false;
    };
  }, [typeFilters, deriveJobTypeLabel]);

  const filterJobs = useCallback(
    (list) => (list || []).filter((job) => inDateRange(job) && matchesType(job)),
    [inDateRange, matchesType]
  );

  const filteredTechRows = useMemo(
    () => (techRows || []).map((row) => ({ ...row, jobs: filterJobs(row.jobs) })),
    [techRows, filterJobs]
  );
  const filteredMotRows = useMemo(
    () => (motRows || []).map((row) => ({ ...row, jobs: filterJobs(row.jobs) })),
    [motRows, filterJobs]
  );
  const filteredOutstanding = useMemo(() => filterJobs(outstandingJobs), [outstandingJobs, filterJobs]);

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
      setFeedbackMessage?.({
        type: "info",
        text: "Drag the job card onto a technician or MOT row to reassign it or change its queue position.",
      });
    } else if (type === "ready") {
      setFeedbackMessage?.({
        type: "info",
        text: "Mark Ready updates the workshop status — open the job card to set the status until this shortcut is wired up.",
      });
    }
  };

  const technicianCount = filteredTechRows.length + filteredMotRows.length;

  return (
    <div className={styles.shell} data-presentation="workshop-queue-planner">
      {/* ============================ 1 · Page header ======================= */}
      <header className={`${styles.glass} ${styles.pageHeader}`}>
        <div className={styles.pageHeaderText}>
          <h1 className={styles.pageTitle}>Workshop Controller Board</h1>
          <p className={styles.pageSubtitle}>
            Live job allocation &amp; technician queue planner · checked-in vehicles, next jobs and workload at a glance
          </p>
        </div>
        <div className={styles.pageHeaderMeta}>
          <div className={styles.headerStat}>
            <span className={styles.headerStatValue}>{clockedInJobs.length}</span>
            <span className={styles.headerStatLabel}>Checked In</span>
          </div>
          <div className={styles.headerStat}>
            <span className={styles.headerStatValue}>{technicianCount}</span>
            <span className={styles.headerStatLabel}>On Board</span>
          </div>
          <div className={styles.headerStat}>
            <span className={styles.headerStatValue}>{filteredOutstanding.length}</span>
            <span className={styles.headerStatLabel}>Unassigned</span>
          </div>
        </div>
      </header>

      {/* ============================ 2 · Checked In Jobs =================== */}
      <section className={`${styles.glass} ${styles.section}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Checked In Jobs</h2>
          <span className={styles.sectionMeta}>{clockedInJobs.length} in the workshop</span>
        </div>
        {clockedInJobs.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🅿️</span>
            <p className={styles.emptyTitle}>No checked-in jobs yet.</p>
            <p className={styles.emptyBody}>Jobs will appear here once a vehicle has been checked in.</p>
          </div>
        ) : (
          <div className={styles.checkedStrip}>
            {clockedInJobs.map((entry) => {
              const statusMeta = getStatusMeta(entry.status);
              const vehicle = entry.makeModel || "Vehicle TBC";
              const checkedTime = formatClock(entry.checkedInAt || entry.clockIn);
              return (
                <button
                  key={`${entry.userId}-${entry.jobNumber}`}
                  type="button"
                  className={styles.checkedCard}
                  onClick={() => handleOpenCurrentClocking(entry, entry.technicianName)}
                  title={`#${entry.jobNumber} · ${vehicle}`}
                >
                  <div className={styles.checkedCardTop}>
                    <span className={styles.checkedJob}>#{entry.jobNumber || "Pending"}</span>
                    <span className={styles.checkedReg}>{entry.reg || "—"}</span>
                  </div>
                  <span className={styles.checkedVehicle}>{vehicle}</span>
                  <span className={styles.checkedSub}>{entry.customer || "Unknown customer"}</span>
                  <div className={styles.checkedFoot}>
                    <span className={styles.checkedTime}>🕑 Checked In {checkedTime}</span>
                    <span className={`${styles.statusPill} ${statusMeta.pill}`}>
                      <span className={styles.statusDot} style={{ background: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================ 3 · Filter bar ======================= */}
      <div className={`${styles.glass} ${styles.toolbar}`}>
        <div className={styles.filterGroup}>
          {DATE_RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              className={filterBtnClass(dateRange === range.key)}
              onClick={() => setDateRange(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <span className={styles.filterDivider} />
        <div className={styles.filterGroup}>
          <span className={styles.toolbarLabel}>Type</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={filterBtnClass(typeFilters.has(opt.key))}
              onClick={() => toggleType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {SearchBar && (
          <div className={styles.searchWrap}>
            <SearchBar
              placeholder="Search job, reg, or customer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
            />
          </div>
        )}
      </div>

      {/* ===================== 4 + 5 · Next jobs board ===================== */}
      <WorkshopQueueBoard
        techRows={filteredTechRows}
        motRows={filteredMotRows}
        activeDropTarget={activeDropTarget}
        {...sharedDropProps}
      />

      {/* ============================ Unassigned jobs ====================== */}
      <section
        className={`${styles.glass} ${styles.section} ${styles.unassignedDrop} ${
          activeDropTarget === "outstanding" ? styles.unassignedActive : ""
        }`}
        data-dnd-target-type="outstanding"
        data-dnd-target-key="outstanding"
      >
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Unassigned Jobs</h2>
          <span className={styles.sectionMeta}>{filteredOutstanding.length} waiting to allocate</span>
        </div>
        {filteredOutstanding.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✅</span>
            <p className={styles.emptyTitle}>
              {searchTerm?.trim() ? "No matching unassigned jobs." : "Everything is allocated."}
            </p>
            <p className={styles.emptyBody}>Unassigned jobs will appear here ready to drag onto a technician.</p>
          </div>
        ) : (
          <div className={styles.unassignedGrid}>
            {filteredOutstanding.map((job) => (
              <React.Fragment key={job.jobNumber}>
                {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "before") && (
                  <div className={styles.dropBarH} />
                )}
                <WorkshopQueueCard
                  job={job}
                  className={styles.unassignedCard}
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
                />
                {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "after") && (
                  <div className={styles.dropBarH} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </section>

      {/* ============================ Drag ghost ============================ */}
      {isDragActive && draggingJob && (
        <div
          aria-hidden="true"
          className={styles.dragGhost}
          style={{ left: dragState.clientX + DRAG_PREVIEW_OFFSET_PX, top: dragState.clientY + DRAG_PREVIEW_OFFSET_PX }}
        >
          <div className={styles.dragGhostJob}>#{draggingJob.jobNumber}</div>
          <div className={styles.dragGhostReg}>{draggingJob.reg || "Reg TBC"}</div>
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

      <style jsx global>{`
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
