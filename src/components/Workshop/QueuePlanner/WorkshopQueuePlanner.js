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
import { Dropdown } from "@/components/ui/dropdownAPI";
import WorkshopQueueBoard, { WorkshopQueueCard } from "./WorkshopQueueBoard";
import WorkshopJobModal from "./WorkshopJobModal";
import { getStatusMeta, formatClock } from "./workshopQueueHelpers";

// Single job-type filter (one dropdown). "all" = no type filtering.
const TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "all" },
  { label: "Technician", value: "technician" },
  { label: "MOT", value: "mot" },
  { label: "Service", value: "service" },
  { label: "Diagnostic", value: "diagnostic" },
  { label: "Retail", value: "retail" },
  { label: "Warranty", value: "warranty" },
];

const toDevSectionKey = (value) =>
  String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

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
  const [typeFilter, setTypeFilter] = useState("all");

  // ---- client-side job-type filter (single dropdown; "all" = no filtering) ----
  // Search is handled by the page (it highlights + scrolls to matches), so it is
  // intentionally NOT a hard filter here — that keeps the existing behaviour.
  const matchesType = useMemo(() => {
    return (job) => {
      if (typeFilter === "all") return true;
      const hay = [job.type, deriveJobTypeLabel ? deriveJobTypeLabel(job) : "", ...(job.jobCategories || [])]
        .join(" ")
        .toLowerCase();
      if (typeFilter === "diagnostic") return hay.includes("diag");
      return hay.includes(typeFilter);
    };
  }, [typeFilter, deriveJobTypeLabel]);

  const filterJobs = useCallback(
    (list) => (list || []).filter((job) => matchesType(job)),
    [matchesType]
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

  return (
    <div
      className={styles.shell}
      data-presentation="workshop-queue-planner"
      data-dev-section="1"
      data-dev-section-key="workshop-queue-planner"
      data-dev-section-parent="app-layout-page-card"
      data-dev-section-type="page-shell"
      data-dev-background-token="transparent"
      data-dev-text-preview="Workshop queue planner"
    >
      {/* ============================ 1 · Checked In Jobs =================== */}
      <section
        className={`${styles.themeSurface} ${styles.section}`}
        data-dev-section="1"
        data-dev-section-key="workshop-checked-in-section"
        data-dev-section-parent="workshop-queue-planner"
        data-dev-section-type="content-card"
        data-dev-background-token="theme"
        data-dev-text-preview={`Checked In Jobs ${checkedInJobs.length} checked in`}
      >
        <div
          className={styles.sectionHead}
          data-dev-section="1"
          data-dev-section-key="workshop-checked-in-header"
          data-dev-section-parent="workshop-checked-in-section"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
        >
          <h2 className={styles.sectionTitle}>Checked In Jobs</h2>
          <span className={styles.sectionMeta}>{checkedInJobs.length} checked in</span>
        </div>
        {checkedInJobs.length === 0 ? (
          <div
            className={styles.emptyState}
            data-dev-section="1"
            data-dev-section-key="workshop-checked-in-empty"
            data-dev-section-parent="workshop-checked-in-section"
            data-dev-section-type="content-card"
            data-dev-background-token="surface"
            data-dev-text-preview="No checked-in jobs"
          >
            <p className={styles.emptyTitle}>No checked-in jobs yet.</p>
            <p className={styles.emptyBody}>Jobs will appear here once a vehicle has been checked in.</p>
          </div>
        ) : (
          <div
            className={styles.checkedStrip}
            data-dev-section="1"
            data-dev-section-key="workshop-checked-in-strip"
            data-dev-section-parent="workshop-checked-in-section"
            data-dev-section-type="section-shell"
            data-dev-background-token="transparent"
          >
            {checkedInJobs.map((job) => {
              const statusMeta = getStatusMeta(job.status);
              const vehicle = [job.make, job.model].filter(Boolean).join(" ") || job.makeModel || "Vehicle TBC";
              const checkedTime = formatClock(job.checkedInAt);
              return (
                <button
                  key={job.jobNumber}
                  type="button"
                  className={styles.checkedCard}
                  data-dev-section="1"
                  data-dev-section-key={`workshop-checked-in-job-${toDevSectionKey(job.jobNumber)}`}
                  data-dev-section-parent="workshop-checked-in-strip"
                  data-dev-section-type="content-card"
                  data-dev-background-token="theme"
                  data-dev-text-preview={`${job.jobNumber || "Job"} ${job.reg || ""} ${vehicle} ${job.customer || ""} ${statusMeta.label}`}
                  onClick={() => handleOpenJobDetails(job)}
                  title={`#${job.jobNumber} · ${vehicle}`}
                >
                  <div className={styles.checkedCardTop}>
                    <span className={styles.checkedJob}>#{job.jobNumber || "Pending"}</span>
                    <span className={styles.checkedReg}>{job.reg || "—"}</span>
                  </div>
                  <span className={styles.checkedVehicle}>{vehicle}</span>
                  <span className={styles.checkedSub}>{job.customer || "Unknown customer"}</span>
                  <div className={styles.checkedFoot}>
                    <span className={styles.checkedTime}>Checked In {checkedTime}</span>
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

      {/* ============================ 2 · Filter bar ======================= */}
      <div
        className={`${styles.glass} ${styles.toolbar}`}
        data-dev-section="1"
        data-dev-section-key="workshop-filter-toolbar"
        data-dev-section-parent="workshop-queue-planner"
        data-dev-section-type="filter-row"
        data-dev-background-token="surface"
        data-dev-text-preview="Type filter and search"
      >
        <div
          className={styles.filterGroup}
          data-dev-section="1"
          data-dev-section-key="workshop-type-filter-group"
          data-dev-section-parent="workshop-filter-toolbar"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
        >
          <span className={styles.toolbarLabel}>Type</span>
          <Dropdown
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={(_raw, option) => setTypeFilter(option?.value ?? "all")}
            ariaLabel="Filter by job type"
            size="sm"
            style={{ minWidth: "190px" }}
          />
        </div>
        {SearchBar && (
          <div
            className={styles.searchWrap}
            data-dev-section="1"
            data-dev-section-key="workshop-search-filter"
            data-dev-section-parent="workshop-filter-toolbar"
            data-dev-section-type="filter-row"
            data-dev-background-token="transparent"
          >
            <SearchBar
              placeholder="Search job, reg, or customer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
            />
          </div>
        )}
      </div>

      {/* ====================== Unassigned jobs (drop tray) ================ */}
      {/* Sits above the board so controllers can drag work straight down onto a
          technician / MOT row. Stays mounted (even when empty) so it remains a
          valid drop target for returning a job to the pool. */}
      <section
        className={`${styles.themeSurface} ${styles.section} ${styles.unassignedDrop} ${
          activeDropTarget === "outstanding" ? styles.unassignedActive : ""
        }`}
        data-dnd-target-type="outstanding"
        data-dnd-target-key="outstanding"
        data-dev-section="1"
        data-dev-section-key="workshop-unassigned-section"
        data-dev-section-parent="workshop-queue-planner"
        data-dev-section-type="content-card"
        data-dev-background-token="theme"
        data-dev-text-preview={`Unassigned Jobs ${filteredOutstanding.length} waiting to allocate`}
      >
        <div
          className={styles.sectionHead}
          data-dev-section="1"
          data-dev-section-key="workshop-unassigned-header"
          data-dev-section-parent="workshop-unassigned-section"
          data-dev-section-type="toolbar"
          data-dev-background-token="transparent"
        >
          <h2 className={styles.sectionTitle}>Unassigned Jobs</h2>
          <span className={styles.sectionMeta}>{filteredOutstanding.length} waiting to allocate</span>
        </div>
        {filteredOutstanding.length === 0 ? (
          <div
            className={`${styles.emptyRow} ${activeDropTarget === "outstanding" ? styles.emptyRowActive : ""}`}
            style={{ marginTop: 12 }}
            data-dev-section="1"
            data-dev-section-key="workshop-unassigned-empty"
            data-dev-section-parent="workshop-unassigned-section"
            data-dev-section-type="content-card"
            data-dev-background-token="theme"
            data-dev-text-preview="Everything is allocated"
          >
            {activeDropTarget === "outstanding" && draggingJob
              ? "Drop job here to unassign"
              : searchTerm?.trim()
              ? "No matching unassigned jobs."
              : "Everything is allocated — drag a job here to return it to the pool."}
          </div>
        ) : (
          <div
            className={styles.unassignedGrid}
            data-dev-section="1"
            data-dev-section-key="workshop-unassigned-grid"
            data-dev-section-parent="workshop-unassigned-section"
            data-dev-section-type="section-shell"
            data-dev-background-token="transparent"
          >
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
                  devSectionParent="workshop-unassigned-grid"
                  devSectionPrefix="workshop-unassigned-job"
                />
                {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "after") && (
                  <div className={styles.dropBarH} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </section>

      {/* ===================== 4 + 5 · Next jobs board ===================== */}
      <WorkshopQueueBoard
        techRows={filteredTechRows}
        motRows={filteredMotRows}
        activeDropTarget={activeDropTarget}
        {...sharedDropProps}
      />

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
