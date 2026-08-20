// file location: src/pages/clocking/index.js
"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import CapacitySettingsPopup from "@/components/Clocking/CapacitySettingsPopup";
import ClockingPageUi from "@/components/page-ui/clocking/clocking-ui";
import PopupModal from "@/components/popups/popupStyleApi";
import { ContentWidth, PageShell } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { useUser } from "@/context/UserContext";
import { hasAnyRole, WORKSHOP_CAPACITY_MANAGER_ROLES } from "@/lib/auth/roles";
import {
  buildCapacitySummary,
  buildWorkshopBoard,
  CLOCKING_STATUSES,
} from "@/lib/clocking/workshopBoard";
import { WORKSHOP_ASSIGNMENT_OPTIONS } from "@/lib/clocking/workshopAssignments";
import { getWorkshopClockingSnapshot } from "@/lib/database/workshopClocking";
import { supabase } from "@/lib/database/supabaseClient";
// The /clocking/[technicianSlug] route component, rendered inline in the
// technician popup via its `embedded` mode.
import UserClockingHistory from "@/pages/clocking/[technicianSlug]";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.values(CLOCKING_STATUSES).map((status) => ({ value: status, label: status })),
];

const SORT_OPTIONS = [
  { value: "workshop", label: "Workshop order" },
  { value: "name", label: "Technician name" },
  { value: "waiting", label: "Longest waiting" },
  { value: "active", label: "Longest active job" },
];

// Tone only. The label comes from CLOCKING_STATUSES itself so the badge, the
// status filter and the board data all speak with one vocabulary — the previous
// local `short` strings were a second, differently-cased copy of these values.
const STATUS_TONE = {
  [CLOCKING_STATUSES.IN_PROGRESS]: "success",
  [CLOCKING_STATUSES.ON_MOT]: "success",
  [CLOCKING_STATUSES.TEA_BREAK]: "warning",
  [CLOCKING_STATUSES.WAITING]: "warning",
  [CLOCKING_STATUSES.NOT_CLOCKED]: "danger",
};

const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDayStartIso = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const formatHours = (value) => `${Number(value || 0).toFixed(2)}h`;
// Allocation variance reads in minutes on the card ("+38m", "-1h 12m") because
// that is how the workshop talks about running over or under on a job.
const formatVariance = (hours) => {
  const totalMinutes = Math.round(Math.abs(Number(hours) || 0) * 60);
  const sign = (Number(hours) || 0) < 0 ? "-" : "+";
  if (totalMinutes < 60) return `${sign}${totalMinutes}m`;
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${sign}${wholeHours}h ${minutes}m` : `${sign}${wholeHours}h`;
};
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatClockTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
// Far-right scheduling value on the next-job strip. Prefer a real clock time;
// fall back to the queue position so the slot never renders a bare label.
const formatPlannedTime = (nextJob) => {
  if (!nextJob) return "—";
  if (nextJob.scheduledTime) return formatClockTime(nextJob.scheduledTime);
  const position = Number(nextJob.queuePosition);
  return Number.isFinite(position) ? `Queue ${position}` : "—";
};

const submitManagedClockingAction = async (payload) => {
  const response = await fetch("/api/clocking/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Unable to update technician clocking.");
  }
  return result;
};

// Plain .app-badge + variant class — the same shape used across the app (see
// EfficiencyInsights). No local sizing or colour: --sm is the shared size
// modifier and the tone variants own the palette.
function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || STATUS_TONE[CLOCKING_STATUSES.NOT_CLOCKED];
  return <span className={`app-badge app-badge--${tone}`}>{status || CLOCKING_STATUSES.NOT_CLOCKED}</span>;
}

function Metric({ label, value, detail, tone = "" }) {
  return (
    <div className={`app-summary-item clocking-board__metric${tone ? ` app-tone-${tone}` : ""}`}>
      <span className="app-summary-label">{label}</span>
      <strong className="app-summary-value">{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

// One job panel — used for both the current and the next job so the two read as
// the same object at two points in time rather than two unrelated widgets.
// Layout is a fixed three-beat rhythm: job number + badge, scrollable work
// summary, then panel-specific detail. Each variant has a fixed height (see the
// --clocking-*-panel-height tokens) so cards never resize with their content.
function JobPanel({ variant, prefix, jobNumber, descriptions, badge, headerMeta, emptyLabel, children }) {
  const lines = Array.isArray(descriptions) ? descriptions.filter(Boolean) : [];
  const summary = lines.join(" · ");

  return (
    <LayerTheme
      as="section"
      padding={variant === "current" ? "var(--space-2)" : "var(--space-3)"}
      gap="var(--space-2)"
      className={`clocking-board__job-panel clocking-board__job-panel--${variant}`}
    >
      {/* The job number takes the place of a "Current job" / "Next job" label —
          the badge and the rows beneath already say which panel this is. */}
      <div className="clocking-board__job-panel-head">
        {jobNumber ? (
          <Link className="clocking-board__job-number" href={`/job-cards/${encodeURIComponent(jobNumber)}`}>
            {prefix ? <span className="clocking-board__job-number-prefix">{prefix}</span> : null}
            <span className="clocking-board__job-number-value">{jobNumber}</span>
          </Link>
        ) : (
          <span className="clocking-board__job-number-empty">{emptyLabel}</span>
        )}
        <span className={`clocking-board__job-header-meta${headerMeta ? " app-badge clocking-board__job-header-meta--filled" : ""}`}>
          {headerMeta}
        </span>
        <span className="clocking-board__job-header-badge">{badge}</span>
      </div>

      {/* Bounded scroll region: short descriptions use only the space they need,
          while longer request lists scroll instead of resizing the panel. */}
      <div className="clocking-board__job-summary themed-scrollbar">
        <p title={summary || undefined}>{jobNumber ? summary || "No description recorded" : "—"}</p>
      </div>

      {jobNumber ? children : null}
    </LayerTheme>
  );
}

const TechnicianCard = memo(function TechnicianCard({ technician, onOpenDetails }) {
  const hasCurrentJob = Boolean(technician.currentJobNumber);
  // A zero allocation is not an allocation: without this the card renders a
  // "+335h 10m" variance against "Allocated 0.00h" and "0% used".
  const allocated = Number(technician.allocatedHours) || 0;
  const showAllocation = hasCurrentJob && technician.allocationAvailable && allocated > 0;
  const nextJob = technician.nextJob;
  // Bar fill is elapsed vs allocated, clamped at the end of the track; the
  // overrun keeps showing numerically in the variance pill beside it.
  const progress = showAllocation
    ? technician.isOverAllocated
      ? 100
      : Math.min(100, Math.max(0, Number(technician.allocationProgress) || 0))
    : 0;
  // Uncapped so the legend can report a real overrun (e.g. "143% used") while
  // the bar itself stays pinned at the end of the track.
  const usedPercent = showAllocation ? (Number(technician.actualHours) || 0) / allocated * 100 : 0;
  // Board-level isOverAllocated can be true against a zero allocation; the card
  // only treats an overrun as real when there is an allocation to overrun.
  const isOver = showAllocation && technician.isOverAllocated;
  const allocationLabel = technician.allocationAvailable
    ? allocated > 0 ? `Allocated ${formatHours(allocated)}` : "No allocation set"
    : "Allocation unavailable";

  return (
    <LayerSurface
      as="article"
      padding="var(--space-3)"
      gap="var(--space-2)"
      className="clocking-board__technician"
      data-status={technician.status}
    >
      <header className="clocking-board__technician-header">
        <h3 title={technician.name}>{technician.name}</h3>
        {/* app-btn--icon is the family's single-glyph shape (square at
            --control-height, pill radius). Opens the technician popup, which
            carries Change status and the full detail view. */}
        <Button
          type="button"
          variant="primary"
          className="app-btn--icon"
          aria-haspopup="dialog"
          aria-label={`Clocking details for ${technician.name}`}
          onClick={() => onOpenDetails(technician)}
        >
          <span aria-hidden="true">ⓘ</span>
        </Button>
      </header>

      <JobPanel
        variant="current"
        prefix="Job"
        jobNumber={technician.currentJobNumber}
        descriptions={technician.currentDescriptions}
        badge={<StatusBadge status={technician.status} />}
        emptyLabel="Not clocked on"
      >
        <div className="clocking-board__time-row">
          <div className="clocking-board__time-block">
            <span className="app-summary-label">Time on job</span>
            {/* actualHours (all clockings against this job), not the current
                session — it is what the bar and the variance are measured on. */}
            <strong className="clocking-board__time-value">{formatHours(technician.actualHours)}</strong>
          </div>
          {showAllocation ? (
            <span className={`app-badge ${isOver ? "app-badge--danger" : "app-badge--success"}`}>
              {formatVariance(technician.differenceHours)}
            </span>
          ) : null}
        </div>

        <div
          className="clocking-board__progress"
          role="progressbar"
          aria-label="Time on job against allocated time"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress)}
        >
          <span
            className={isOver ? "is-over" : ""}
            style={{ width: `${progress}%` /* Live elapsed-vs-allocated value, not a static style. */ }}
          />
        </div>

        <div className="clocking-board__progress-legend">
          <span>{allocationLabel}</span>
          {showAllocation ? <span>{Math.round(usedPercent)}% used</span> : null}
        </div>
      </JobPanel>

      <JobPanel
        variant="next"
        jobNumber={nextJob?.jobNumber}
        descriptions={nextJob?.descriptions}
        badge={nextJob ? <span className="app-badge app-badge--accent-soft">{nextJob.type || "Job"}</span> : null}
        emptyLabel="No queued job"
        headerMeta={nextJob ? (
          <time dateTime={nextJob.scheduledTime || undefined}>{formatPlannedTime(nextJob)}</time>
        ) : null}
      />
    </LayerSurface>
  );
});

function BoardSkeleton({ count = 6 }) {
  return (
    <div className="clocking-board__technician-grid" aria-label="Loading live technician board">
      <SkeletonKeyframes />
      {Array.from({ length: count }).map((_, index) => (
        <LayerSurface key={index} padding="var(--space-3)" gap="var(--space-2)">
          {/* Mirrors the real card: header, current panel, next panel. */}
          <SkeletonBlock width="55%" height="var(--control-height)" />
          <SkeletonBlock width="100%" height="var(--clocking-current-panel-height)" />
          <SkeletonBlock width="100%" height="var(--clocking-next-panel-height)" />
        </LayerSurface>
      ))}
    </div>
  );
}

// Clock-on / clock-off controls. Extracted from the old standalone modal so it
// can sit as the first section of the technician popup.
function ChangeStatusSection({ technician, onCompleted }) {
  const active = technician && (technician.status === CLOCKING_STATUSES.IN_PROGRESS || technician.status === CLOCKING_STATUSES.ON_MOT);
  const [jobNumber, setJobNumber] = useState(technician?.currentJobNumber || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setJobNumber(technician?.currentJobNumber || "");
    setError("");
  }, [technician]);

  const submit = async () => {
    if (!technician) return;
    const trimmedJobNumber = jobNumber.trim();
    if (!active && !trimmedJobNumber) {
      setError("Enter a job number before clocking on.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitManagedClockingAction(active
        ? { action: "clock-out", userId: technician.userId, clockingId: technician.clockingId }
        : { action: "clock-in", userId: technician.userId, jobNumber: trimmedJobNumber });
      void onCompleted();
    } catch (actionError) {
      setError(actionError?.message || "Unable to update technician clocking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LayerTheme as="section" padding="var(--section-card-padding)" gap="var(--space-3)">
      <header className="app-popup-compact-header">
        <h2>Change status</h2>
        <div className="app-popup-compact-header__actions">
          <Button type="button" variant="primary" size="sm" busy={submitting} disabled={!active && !jobNumber.trim()} onClick={submit}>
            {active ? "Clock off" : "Clock on"}
          </Button>
        </div>
      </header>
      {error ? <div className="app-status-message app-status-message--danger" role="alert">{error}</div> : null}
      {active ? (
        <LayerSurface padding="var(--space-3)" gap="var(--space-2)">
          <span className="app-summary-label">Active job</span>
          <strong>{technician?.currentJobNumber || "—"} · {formatHours(technician?.actualHours)}</strong>
          <span>{technician?.currentDescription}</span>
        </LayerSurface>
      ) : (
        <LayerSurface padding="var(--space-3)" gap="var(--space-2)">
          <label htmlFor="clocking-control-job-number">Job number</label>
          <input
            id="clocking-control-job-number"
            className="app-input"
            value={jobNumber}
            onChange={(event) => setJobNumber(event.target.value)}
            placeholder="Enter job number"
            autoComplete="off"
          />
        </LayerSurface>
      )}
    </LayerTheme>
  );
}

function WorkshopAssignmentSection({ technician, onCompleted }) {
  const assignmentDate = toDateKey(new Date());
  const [assignmentType, setAssignmentType] = useState(technician?.workshopAssignment || "tech");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAssignmentType(technician?.workshopAssignment || "tech");
    setError("");
    setSaved(false);
  }, [technician]);

  const saveAssignment = async () => {
    if (!technician) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/clocking/workshop-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: technician.userId,
          assignmentDate,
          assignmentType,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to update the workshop section.");
      }
      await onCompleted?.();
      setSaved(true);
    } catch (saveError) {
      setError(saveError?.message || "Unable to update the workshop section.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LayerTheme as="section" padding="var(--section-card-padding)" gap="var(--space-3)">
      <header className="app-popup-compact-header">
        <h2>Workshop section</h2>
        <div className="app-popup-compact-header__actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            busy={saving}
            disabled={assignmentType === technician?.workshopAssignment}
            onClick={saveAssignment}
          >
            Save assignment
          </Button>
        </div>
      </header>

      {error ? <div className="app-status-message app-status-message--danger" role="alert">{error}</div> : null}
      {saved ? <div className="app-status-message app-status-message--success" role="status">Workshop section updated for today.</div> : null}

      <LayerSurface padding="var(--space-3)" gap="var(--space-2)">
        <DropdownField
          id="clocking-workshop-assignment"
          label="Today’s board section"
          ariaLabel="Today’s workshop board section"
          value={assignmentType}
          options={WORKSHOP_ASSIGNMENT_OPTIONS}
          disabled={saving}
          onChange={(event) => {
            setAssignmentType(event.target.value);
            setSaved(false);
          }}
        />
        <small className="clocking-details-modal__assignment-help">
          This controls today’s Tech/MOT board placement only. Permanent role: {technician?.role || "Technician"}.
        </small>
      </LayerSurface>
    </LayerTheme>
  );
}

// The card's info button opens this instead of navigating to
// /clocking/[technicianSlug]: Change status first, then the full detail page
// rendered inline underneath via its `embedded` mode (same component, same data
// loading — no duplicated markup).
function TechnicianDetailsPopup({ technician, canManage, onClose, onCompleted }) {
  return (
    <PopupModal
      isOpen={Boolean(technician)}
      onClose={onClose}
      ariaLabel={technician ? `${technician.name} clocking details` : "Technician clocking details"}
      cardClassName="clocking-details-modal"
      cardStyle={{ width: "min(1040px, 100%)", padding: "var(--page-card-padding)" }}
    >
      {technician ? (
        <div className="clocking-details-modal__content">
          <header className="app-popup-compact-header">
            <h2>{technician.name}</h2>
            <div className="app-popup-compact-header__actions">
              <Link className="app-btn app-btn--secondary app-btn--sm" href={`/clocking/${technician.slug}`}>Open full page</Link>
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
            </div>
          </header>

          {canManage ? (
            <div className="clocking-details-modal__management-grid">
              <ChangeStatusSection technician={technician} onCompleted={onCompleted} />
              <WorkshopAssignmentSection technician={technician} onCompleted={onCompleted} />
            </div>
          ) : null}

          <LayerTheme as="section" padding="var(--section-card-padding)" gap="var(--space-3)">
            <h3 className="clocking-details-modal__section-title">View details</h3>
            <UserClockingHistory slug={technician.slug} embedded />
          </LayerTheme>
        </div>
      ) : null}
    </PopupModal>
  );
}

function TechnicianSection({ sectionKey, title, technicians, loading, snapshot, emptyLabel, onOpenDetails, skeletonCount = 6 }) {
  return (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      parentKey="app-layout-page-card"
      padding="var(--section-card-padding)"
      gap="var(--space-3)"
    >
      <header className="clocking-board__section-header clocking-board__section-header--compact">
        <div><h2>{title}</h2></div>
      </header>
      {loading && !snapshot ? <BoardSkeleton count={skeletonCount} /> : technicians.length ? (
        <div className="clocking-board__technician-grid">
          {technicians.map((technician) => (
            <TechnicianCard key={technician.userId} technician={technician} onOpenDetails={onOpenDetails} />
          ))}
        </div>
      ) : (
        <LayerSurface padding="var(--section-card-padding)" gap="var(--space-2)" className="clocking-board__empty">
          <strong>{emptyLabel}</strong>
          <span>Change the status filter to show other workshop users.</span>
        </LayerSurface>
      )}
    </LayerTheme>
  );
}

function ClockingOverviewTab() {
  const { data: session } = useSession();
  const { user } = useUser();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [realtimeState, setRealtimeState] = useState("connecting");
  const [now, setNow] = useState(() => new Date());
  const [capacityDay, setCapacityDay] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [capacityError, setCapacityError] = useState("");
  const [capacitySettingsOpen, setCapacitySettingsOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("workshop");
  const refreshTimerRef = useRef(null);
  const fetchSequenceRef = useRef(0);

  const sessionRoles = Array.isArray(session?.user?.roles) ? session.user.roles : session?.user?.role ? [session.user.role] : [];
  const contextRoles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
  const canManageCapacity = hasAnyRole([...sessionRoles, ...contextRoles], WORKSHOP_CAPACITY_MANAGER_ROLES);

  const fetchBoard = useCallback(async ({ background = false } = {}) => {
    const sequence = fetchSequenceRef.current + 1;
    fetchSequenceRef.current = sequence;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const referenceDate = new Date();
      const dateKey = toDateKey(referenceDate);
      const [data, assignmentsResponse] = await Promise.all([
        getWorkshopClockingSnapshot({
          dateKey,
          dayStartIso: toDayStartIso(referenceDate),
        }),
        fetch(`/api/clocking/workshop-assignment?date=${encodeURIComponent(dateKey)}`),
      ]);
      const assignmentsPayload = await assignmentsResponse.json().catch(() => null);
      if (!assignmentsResponse.ok || !assignmentsPayload?.success) {
        throw new Error(assignmentsPayload?.message || "Unable to load today’s workshop assignments.");
      }
      if (sequence !== fetchSequenceRef.current) return;
      setSnapshot({ ...data, assignments: assignmentsPayload.data || [] });
      setError("");
      setLastUpdated(new Date());
      setNow(new Date());
    } catch (fetchError) {
      if (sequence === fetchSequenceRef.current) {
        setError(fetchError?.message || "Unable to load the live workshop board.");
      }
    } finally {
      if (sequence === fetchSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const fetchCapacity = useCallback(async () => {
    const date = toDateKey(new Date());
    setCapacityLoading(true);
    setCapacityError("");
    try {
      const response = await fetch(`/api/technician-capacity?start=${date}&end=${date}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to load workshop capacity.");
      setCapacityDay(payload.data?.[0] || null);
    } catch (fetchError) {
      setCapacityError(fetchError?.message || "Unable to load workshop capacity.");
    } finally {
      setCapacityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    fetchCapacity();
  }, [fetchBoard, fetchCapacity]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const queueRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => fetchBoard({ background: true }), 250);
    };
    const channel = supabase
      .channel("clocking-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "time_records" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_clocking" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_settings" }, (payload) => {
        const settingKey = payload?.new?.setting_key || payload?.old?.setting_key || "";
        if (String(settingKey).startsWith("workshop_daily_assignment:")) queueRefresh();
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setRealtimeState("live");
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") setRealtimeState("offline");
      });
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchBoard]);

  const board = useMemo(() => buildWorkshopBoard(snapshot || {}, now), [snapshot, now]);
  const capacity = useMemo(() => buildCapacitySummary(board, capacityDay), [board, capacityDay]);
  const visibleTechnicians = useMemo(() => {
    const filtered = statusFilter === "all"
      ? [...board.technicians]
      : board.technicians.filter((technician) => technician.status === statusFilter);
    return filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "waiting") return b.idleHours - a.idleHours || a.name.localeCompare(b.name);
      if (sortBy === "active") return b.activityHours - a.activityHours || a.name.localeCompare(b.name);
      if (a.isMotRole !== b.isMotRole) return a.isMotRole ? 1 : -1;
      return a.workshopOrder - b.workshopOrder || a.name.localeCompare(b.name);
    });
  }, [board.technicians, sortBy, statusFilter]);
  const visibleWorkshopTechnicians = visibleTechnicians.filter((technician) => !technician.isMotRole);
  const visibleMotUsers = visibleTechnicians.filter((technician) => technician.isMotRole);
  const selectedTechnician = board.technicians.find((technician) => technician.userId === selectedTechnicianId) || null;

  const stale = lastUpdated ? now.getTime() - lastUpdated.getTime() > 120000 : false;
  const liveLabel = realtimeState === "live" && !stale ? "Live" : realtimeState === "offline" ? "Connection interrupted" : stale ? "Data may be stale" : "Connecting";

  return (
    <div className="clocking-board">
      <LayerTheme as="section" sectionKey="clocking-capacity-summary" padding="var(--section-card-padding)" gap="var(--space-2)">
        {capacityError ? <div className="app-status-message app-status-message--warning" role="status">Capacity summary unavailable: {capacityError}</div> : null}
        <div className="clocking-board__toolbar">
          <div className="clocking-board__filters">
            <DropdownField ariaLabel="Filter technician status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={STATUS_FILTER_OPTIONS} />
            <DropdownField ariaLabel="Sort technicians" value={sortBy} onChange={(event) => setSortBy(event.target.value)} options={SORT_OPTIONS} />
            {canManageCapacity ? <Button type="button" variant="primary" size="sm" onClick={() => setCapacitySettingsOpen(true)}>Capacity settings</Button> : null}
          </div>
          <div className="clocking-board__live-state" aria-live="polite">
            <span className={realtimeState === "live" && !stale ? "is-live" : "is-stale"} />
            <strong>{refreshing ? "Updating" : liveLabel}</strong>
            <small>Refreshed {formatClockTime(lastUpdated)}</small>
          </div>
        </div>
        <div className="clocking-board__capacity-grid">
          <Metric label="Working technicians" value={`${capacity.working} / ${capacity.total}`} />
          <Metric label="Productive today" value={formatHours(capacity.productiveHours)} />
          <Metric label="Hours remaining" value={capacityLoading ? "—" : formatHours(capacity.remainingHours)} />
          <Metric label="Utilisation" value={capacityLoading ? "—" : formatPercent(capacity.utilisationPct)} tone={capacity.utilisationPct > 100 ? "danger" : ""} />
        </div>
        <div className="clocking-board__status-grid">
          <Metric label="Technicians" value={board.summary.total} />
          <Metric label="In progress" value={board.summary.inProgress} />
          <Metric label="On MOT" value={board.summary.onMot} />
          <Metric label="Tea break" value={board.summary.teaBreak} />
          <Metric label="Waiting" value={board.summary.waiting} />
          <Metric label="Not clocked" value={board.summary.notClocked} />
        </div>
      </LayerTheme>

      {error ? (
        <div className={`app-status-message ${snapshot ? "app-status-message--warning" : "app-status-message--danger"}`} role="alert">
          {snapshot ? `Live refresh failed; showing the last successful data. ${error}` : error}
          <Button type="button" variant="secondary" size="xs" onClick={() => fetchBoard()}>Retry</Button>
        </div>
      ) : null}
      {snapshot?.sectionErrors?.jobs ? (
        <div className="app-status-message app-status-message--warning" role="status">
          Job descriptions, allocations and queued work are temporarily unavailable. The live technician board is still updating.
        </div>
      ) : null}

      <TechnicianSection
        sectionKey="clocking-technician-board"
        title="Technicians"
        technicians={visibleWorkshopTechnicians}
        loading={loading}
        snapshot={snapshot}
        emptyLabel="No technicians match this view"
        onOpenDetails={(technician) => setSelectedTechnicianId(technician.userId)}
      />

      <TechnicianSection
        sectionKey="clocking-mot-user-board"
        title="MOT users"
        technicians={visibleMotUsers}
        loading={loading}
        snapshot={snapshot}
        emptyLabel="No MOT users match this view"
        onOpenDetails={(technician) => setSelectedTechnicianId(technician.userId)}
        skeletonCount={3}
      />

      <TechnicianDetailsPopup
        technician={selectedTechnician}
        canManage={canManageCapacity}
        onClose={() => setSelectedTechnicianId(null)}
        onCompleted={() => fetchBoard({ background: true })}
      />

      <CapacitySettingsPopup
        isOpen={capacitySettingsOpen}
        onClose={() => setCapacitySettingsOpen(false)}
        onSaved={fetchCapacity}
      />

      {/*
        `global` is required, not stylistic. styled-jsx only stamps its scope
        class onto JSX inside the component that owns the <style> tag, and the
        card / section / modal markup lives in sibling components in this file
        (TechnicianCard, TechnicianSection, BoardSkeleton, TechnicianDetailsPopup).
        Scoped rules therefore never matched them and the card rendered as raw
        stacked blocks. Every selector below is namespaced under
        .clocking-board / .clocking-details-modal so global emission is safe.
      */}
      <style jsx global>{`
        /* The current panel uses a compact one-line baseline and grows only when
           its bounded description needs more room. The next panel stays fixed. */
        .clocking-board { --clocking-current-panel-height: 191px; --clocking-next-panel-height: 128px; }
        .clocking-board { container: clocking-board / inline-size; display: flex; flex-direction: column; gap: var(--page-stack-gap); width: 100%; min-width: 0; color: var(--text-1); }
        .clocking-board__section-header, .clocking-board__toolbar, .clocking-board__filters { display: flex; align-items: center; gap: var(--space-3); }
        .clocking-board__section-header, .clocking-board__toolbar { justify-content: space-between; }
        .clocking-board__section-header > div:first-child { min-width: 0; }
        .clocking-board__section-header h1 { margin: 0; color: var(--accentText); font-size: clamp(1.35rem, 2.4vw, 1.9rem); letter-spacing: -0.025em; line-height: 1.1; }
        .clocking-board__section-header h2 { margin: 0; color: var(--accentText); font-size: 1.05rem; line-height: 1.15; }
        .clocking-board__section-header--compact { min-height: 44px; }
        .clocking-board__live-state { display: grid; grid-template-columns: 8px auto; align-items: center; column-gap: var(--space-sm); flex: 0 0 auto; }
        .clocking-board__live-state > span { width: 8px; height: 8px; border-radius: 50%; background: var(--warning); grid-row: 1 / span 2; }
        .clocking-board__live-state > span.is-live { background: var(--success); }
        .clocking-board__live-state strong { font-size: var(--text-label); }
        .clocking-board__live-state small { color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__capacity-grid, .clocking-board__status-grid { display: grid; width: 100%; min-width: 0; gap: var(--space-2); }
        .clocking-board__capacity-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .clocking-board__status-grid { grid-template-columns: repeat(6, minmax(104px, 1fr)); }
        html.staff-scope .clocking-board__metric { max-height: none; height: auto; min-height: 52px; font-variant-numeric: tabular-nums; }
        .clocking-board__metric small { flex-basis: 100%; color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__toolbar { align-items: center; flex-wrap: nowrap; gap: var(--space-2); }
        .clocking-board__filters { justify-content: flex-start; flex: 0 1 auto; flex-wrap: nowrap; gap: var(--space-2); min-width: 0; }
        .clocking-board__filters .dropdown-api { flex: 0 0 190px; width: 190px; }
        .clocking-board__filters .app-btn { flex: 0 0 auto; white-space: nowrap; }
        /* Technician card: name + overflow header, then two --theme job panels
           (current, next) sharing one JobPanel shape, then the action footer.
           Sizing comes from tokens and the shared families only — badges use
           .app-badge--sm, buttons keep the family's locked --control-height,
           micro-labels reuse .app-summary-label. No local re-styling of either
           family lives here. Three cards per row; the grid is capped so cards
           stay ~400px on ultrawide displays. */
        .clocking-board__technician-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--layout-card-gap); align-items: stretch; align-content: start; width: 100%; max-width: calc((400px * 3) + (var(--layout-card-gap) * 2)); }
        .clocking-board__technician { min-width: 0; min-height: 0; height: 100%; align-self: stretch; box-shadow: var(--shadow-sm); transition: transform 180ms ease, box-shadow 180ms ease; }
        .clocking-board__technician:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
        .clocking-board__technician-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-width: 0; }
        .clocking-board__technician-header h3 { margin: 0; min-width: 0; overflow: hidden; color: var(--text-1); font-size: var(--text-h4); font-weight: 700; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
        /* The current panel keeps one --space-2 token beneath its allocation
           legend; longer descriptions can grow up to the three-line cap. */
        .clocking-board__job-panel { min-width: 0; flex: 0 0 auto; }
        .clocking-board__job-panel--current { min-height: var(--clocking-current-panel-height); }
        .clocking-board__job-panel--next { height: var(--clocking-next-panel-height); }
        .clocking-board__job-panel-head { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: var(--space-2); flex: 0 0 auto; min-height: var(--control-height); min-width: 0; }
        /* html.staff-scope prefix is required on anchors: the global
           "html.staff-scope a" rule (0,1,2) otherwise out-specifies a bare class
           and paints these accent-red with a hover underline. */
        html.staff-scope .clocking-board__job-number { display: flex; align-items: baseline; gap: var(--space-1); min-width: 0; color: var(--text-1); text-decoration: none; }
        html.staff-scope .clocking-board__job-number:hover { color: var(--accentText); text-decoration: none; }
        .clocking-board__job-number-prefix { flex: 0 0 auto; color: var(--grey-accent); font-size: var(--text-caption); opacity: 0.75; }
        .clocking-board__job-number-value { min-width: 0; overflow: hidden; font-size: var(--text-h4); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; text-overflow: ellipsis; white-space: nowrap; }
        .clocking-board__job-number-empty { min-width: 0; overflow: hidden; color: var(--grey-accent); font-size: var(--text-h4); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; opacity: 0.75; }
        .clocking-board__job-header-meta { justify-self: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .clocking-board__job-header-meta--filled { background: var(--primary-control-bg); color: var(--primary-control-color); /* Matches the canonical Primary button palette; no shared badge variant provides this pairing. */ }
        .clocking-board__job-header-badge { justify-self: end; min-width: 0; }
        .clocking-board__job-summary { flex: 0 0 auto; overflow-y: auto; overscroll-behavior: contain; }
        .clocking-board__job-summary > p { margin: 0; color: var(--text-1); font-size: var(--text-body-sm); line-height: 1.35; overflow-wrap: anywhere; }
        .clocking-board__job-panel--current .clocking-board__job-summary { max-height: calc(1.35em * 3); }
        .clocking-board__job-panel--next .clocking-board__job-summary { max-height: calc(1.35em * 2); }
        .clocking-board__time-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex: 0 0 auto; min-height: var(--control-height); min-width: 0; }
        .clocking-board__time-block { display: flex; flex-direction: column; gap: var(--space-xs); min-width: 0; }
        .clocking-board__time-value { color: var(--text-1); font-size: var(--text-h2); font-variant-numeric: tabular-nums; letter-spacing: -0.03em; line-height: 1; }
        .clocking-board__progress { width: 100%; height: 10px; flex: 0 0 auto; overflow: hidden; border-radius: var(--radius-pill); background: var(--surface); }
        .clocking-board__progress > span { display: block; height: 100%; border-radius: inherit; background: var(--success); transition: width 240ms ease; }
        .clocking-board__progress > span.is-over { background: var(--danger); }
        .clocking-board__progress-legend { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex: 0 0 auto; color: var(--grey-accent); font-size: var(--text-caption); font-variant-numeric: tabular-nums; opacity: 0.75; }
        .clocking-details-modal__content { display: flex; flex-direction: column; gap: var(--layout-card-gap); }
        .clocking-details-modal__management-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--layout-card-gap); align-items: stretch; }
        .clocking-details-modal__management-grid > section { height: 100%; min-width: 0; }
        .clocking-details-modal__assignment-help { color: var(--text-1); font-size: var(--text-caption); line-height: 1.4; }
        .clocking-details-modal__content h2 { color: var(--accentText); font-size: var(--text-h3); }
        .clocking-details-modal__section-title { margin: 0; color: var(--accentText); font-size: var(--text-h4); }
        .clocking-details-modal { overflow: visible; }
        .clocking-board__empty { align-items: flex-start; }
        .clocking-board__empty span { color: var(--text-1); font-size: var(--text-label); }
        .clocking-board > .app-status-message { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        @container clocking-board (max-width: 60rem) {
          .clocking-board__capacity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .clocking-board__status-grid { grid-template-columns: repeat(3, minmax(104px, 1fr)); }
          .clocking-board__technician-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @container clocking-board (max-width: 44rem) {
          .clocking-board__technician-grid { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 768px) {
          .clocking-details-modal__management-grid { grid-template-columns: minmax(0, 1fr); }
          .clocking-board__section-header { align-items: flex-start; flex-wrap: wrap; }
          .clocking-board__toolbar { align-items: flex-start; flex-wrap: wrap; }
          .clocking-board__live-state { width: 100%; }
          .clocking-board__filters { width: 100%; justify-content: stretch; flex-wrap: wrap; }
          .clocking-board__filters .dropdown-api, .clocking-board__filters .app-btn { flex: 1 1 180px; width: 100%; }
          .clocking-board__technician-grid { grid-template-columns: minmax(0, 1fr); max-width: none; }
        }
        @media (max-width: 520px) {
          .clocking-board__capacity-grid { grid-template-columns: 1fr 1fr; }
          .clocking-board__status-grid { display: flex; flex-flow: row nowrap; overflow-x: auto; }
          .clocking-board__status-grid > * { flex: 0 0 118px; }
          .clocking-board > .app-status-message { align-items: stretch; flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) {
          .clocking-board__technician { transition: none; }
          .clocking-board__technician:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}

export default function ClockingPage() {
  return <ClockingPageUi view="section1" ClockingOverviewTab={ClockingOverviewTab} ContentWidth={ContentWidth} PageShell={PageShell} />;
}
