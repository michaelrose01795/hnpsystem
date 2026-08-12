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
  buildWorkshopAttention,
  buildWorkshopBoard,
  CLOCKING_STATUSES,
  DEFAULT_WAITING_THRESHOLD_MINUTES,
} from "@/lib/clocking/workshopBoard";
import { getWorkshopClockingSnapshot } from "@/lib/database/workshopClocking";
import { supabase } from "@/lib/database/supabaseClient";

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

const WAITING_THRESHOLD_OPTIONS = [15, 30, 45, 60].map((minutes) => ({
  value: String(minutes),
  label: `${minutes} minute threshold`,
}));

const STATUS_META = {
  [CLOCKING_STATUSES.IN_PROGRESS]: { tone: "success", short: "In progress" },
  [CLOCKING_STATUSES.ON_MOT]: { tone: "success", short: "On MOT" },
  [CLOCKING_STATUSES.TEA_BREAK]: { tone: "warning", short: "Tea break" },
  [CLOCKING_STATUSES.WAITING]: { tone: "warning", short: "Waiting" },
  [CLOCKING_STATUSES.NOT_CLOCKED]: { tone: "danger", short: "Not clocked" },
};

const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDayStartIso = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const formatHours = (value) => `${Number(value || 0).toFixed(2)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatClockTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
const formatPlannedTime = (value) => value ? formatClockTime(value) : "Queue order";

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

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META[CLOCKING_STATUSES.NOT_CLOCKED];
  return <span className={`clocking-board__status app-tone-${meta.tone}`}>{meta.short}</span>;
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

function AllocationIndicator({ technician }) {
  if (!technician.currentJobId) return null;
  if (!technician.allocationAvailable) {
    return <div className="app-status-message app-status-message--warning">Allocation details are temporarily unavailable.</div>;
  }
  const overBy = Math.max(0, technician.differenceHours);
  return (
    <div className="clocking-board__allocation">
      <div className="clocking-board__allocation-copy">
        <span>Allocated {formatHours(technician.allocatedHours)}</span>
        <strong className={technician.isOverAllocated ? "clocking-board__danger-text" : ""}>
          Actual {formatHours(technician.actualHours)}
        </strong>
      </div>
      <div className="clocking-board__progress" aria-label={`${technician.allocationProgress.toFixed(0)} percent of allocated time used`}>
        <span
          className={technician.isOverAllocated ? "is-over" : ""}
          style={{ width: `${Math.min(100, technician.allocationProgress)}%` }}
        />
      </div>
      <small className={technician.isOverAllocated ? "clocking-board__danger-text" : ""}>
        {technician.isOverAllocated
          ? `${formatHours(overBy)} over allocation`
          : `${formatHours(Math.max(0, -technician.differenceHours))} remaining`}
      </small>
    </div>
  );
}

const TechnicianCard = memo(function TechnicianCard({ technician, canManage, onManage }) {
  const active = technician.status === CLOCKING_STATUSES.IN_PROGRESS || technician.status === CLOCKING_STATUSES.ON_MOT;
  return (
    <LayerSurface
      as="article"
      padding="var(--section-card-padding)"
      gap="var(--space-3)"
      className={`clocking-board__technician clocking-board__technician--${STATUS_META[technician.status]?.tone || "danger"}`}
      data-status={technician.status}
    >
      <header className="clocking-board__technician-header">
        <div>
          <h3>{technician.name}</h3>
          <p>{technician.role}</p>
        </div>
        <StatusBadge status={technician.status} />
      </header>

      <LayerTheme padding="var(--space-3)" gap="var(--space-2)" className="clocking-board__current-work">
        <div className="clocking-board__work-heading">
          <span>{active ? "Current job" : technician.status === CLOCKING_STATUSES.WAITING ? "Idle time" : "Current activity"}</span>
          <strong>{active ? technician.currentJobNumber || "—" : formatHours(active ? technician.activityHours : technician.idleHours || technician.activityHours)}</strong>
        </div>
        <p>
          {active
            ? technician.currentDescription
            : technician.status === CLOCKING_STATUSES.WAITING
              ? `Waiting since ${formatClockTime(technician.waitingSince)}`
              : technician.status === CLOCKING_STATUSES.TEA_BREAK
                ? `${technician.breakNotes} · since ${formatClockTime(technician.activityStartedAt)}`
                : "No attendance record today"}
        </p>
        {active ? (
          <div className="clocking-board__live-duration">
            <span>Live activity</span>
            <strong>{formatHours(technician.activityHours)}</strong>
          </div>
        ) : null}
        <AllocationIndicator technician={technician} />
      </LayerTheme>

      <div className="clocking-board__next-job">
        <span>Next queued job</span>
        {technician.nextJob ? (
          <div>
            <strong>{technician.nextJob.jobNumber}</strong>
            <p>{technician.nextJob.description}</p>
            <small>{technician.nextJob.type} · {formatHours(technician.nextJob.plannedHours)} · {formatPlannedTime(technician.nextJob.scheduledTime)}</small>
          </div>
        ) : <p>No queued job</p>}
      </div>

      <footer className="clocking-board__card-actions">
        {canManage ? (
          <Button type="button" variant={active ? "secondary" : "primary"} size="xs" onClick={() => onManage(technician)}>
            {active ? "Clock off" : "Clock onto job"}
          </Button>
        ) : null}
        {active && technician.currentJobNumber ? (
          <Link className="app-btn app-btn--secondary app-btn--xs" href={`/job-cards/${encodeURIComponent(technician.currentJobNumber)}`}>
            Open job card
          </Link>
        ) : null}
        <Link className="app-btn app-btn--secondary app-btn--xs" href={`/clocking/${technician.slug}`}>
          View details
        </Link>
      </footer>
    </LayerSurface>
  );
});

function BoardSkeleton() {
  return (
    <div className="clocking-board__technician-grid" aria-label="Loading live technician board">
      <SkeletonKeyframes />
      {Array.from({ length: 6 }).map((_, index) => (
        <LayerSurface key={index} padding="var(--section-card-padding)" gap="var(--space-3)">
          <SkeletonBlock width="52%" height="18px" />
          <SkeletonBlock width="30%" height="12px" />
          <SkeletonBlock width="100%" height="112px" />
          <SkeletonBlock width="100%" height="44px" />
        </LayerSurface>
      ))}
    </div>
  );
}

function ClockingControlModal({ technician, onClose, onCompleted }) {
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
      onClose();
      void onCompleted();
    } catch (actionError) {
      setError(actionError?.message || "Unable to update technician clocking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PopupModal
      isOpen={Boolean(technician)}
      onClose={submitting ? undefined : onClose}
      closeOnBackdrop={!submitting}
      ariaLabel="Clocking control"
      cardClassName="clocking-control-modal"
      cardStyle={{ width: "min(460px, 100%)", padding: "var(--page-card-padding)" }}
    >
      <div className="clocking-control-modal__content">
        <header className="app-popup-compact-header">
          <h2>Clocking control</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="primary" size="sm" busy={submitting} disabled={!active && !jobNumber.trim()} onClick={submit}>
              {active ? "Clock off" : "Clock on"}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={submitting} onClick={onClose}>Close</Button>
          </div>
        </header>
        <LayerTheme padding="var(--space-3)" gap="var(--space-2)">
          <span className="clocking-board__label">Technician</span>
          <strong>{technician?.name} · {technician?.role}</strong>
        </LayerTheme>
        {error ? <div className="app-status-message app-status-message--danger" role="alert">{error}</div> : null}
        {active ? (
          <LayerTheme padding="var(--space-3)" gap="var(--space-2)">
            <span className="clocking-board__label">Active job</span>
            <strong>{technician?.currentJobNumber || "—"} · {formatHours(technician?.activityHours)}</strong>
            <span>{technician?.currentDescription}</span>
          </LayerTheme>
        ) : (
          <LayerTheme padding="var(--space-3)" gap="var(--space-2)">
            <label htmlFor="clocking-control-job-number">Job number</label>
            <input
              id="clocking-control-job-number"
              className="app-input"
              value={jobNumber}
              onChange={(event) => setJobNumber(event.target.value)}
              placeholder="Enter job number"
              autoComplete="off"
            />
          </LayerTheme>
        )}
      </div>
    </PopupModal>
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
  const [waitingThreshold, setWaitingThreshold] = useState(DEFAULT_WAITING_THRESHOLD_MINUTES);
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
      const data = await getWorkshopClockingSnapshot({
        dateKey: toDateKey(referenceDate),
        dayStartIso: toDayStartIso(referenceDate),
      });
      if (sequence !== fetchSequenceRef.current) return;
      setSnapshot(data);
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
  const attention = useMemo(
    () => buildWorkshopAttention(board.technicians, capacityDay, waitingThreshold),
    [board.technicians, capacityDay, waitingThreshold]
  );
  const longJobs = useMemo(
    () => board.technicians.filter((technician) => technician.isOverAllocated).sort((a, b) => b.differenceHours - a.differenceHours),
    [board.technicians]
  );
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

  const selectedTechnician = board.technicians.find((technician) => technician.userId === selectedTechnicianId) || null;
  const stale = lastUpdated ? now.getTime() - lastUpdated.getTime() > 120000 : false;
  const liveLabel = realtimeState === "live" && !stale ? "Live" : realtimeState === "offline" ? "Connection interrupted" : stale ? "Data may be stale" : "Connecting";

  return (
    <div className="clocking-board">
      <LayerTheme as="section" sectionKey="clocking-capacity-summary" padding="var(--section-card-padding)" gap="var(--space-3)">
        <header className="clocking-board__section-header">
          <div>
            <h1>Workshop control board</h1>
            <p>Live workshop capacity and technician activity</p>
          </div>
          <div className="clocking-board__live-state" aria-live="polite">
            <span className={realtimeState === "live" && !stale ? "is-live" : "is-stale"} />
            <strong>{refreshing ? "Updating" : liveLabel}</strong>
            <small>Refreshed {formatClockTime(lastUpdated)}</small>
          </div>
        </header>
        {capacityError ? <div className="app-status-message app-status-message--warning" role="status">Capacity summary unavailable: {capacityError}</div> : null}
        <div className="app-summary-grid clocking-board__capacity-grid">
          <Metric label="Working technicians" value={`${capacity.working} / ${capacity.total}`} detail="Clocked today" />
          <Metric label="Productive today" value={formatHours(capacity.productiveHours)} detail="Job clocking" />
          <Metric label="Hours remaining" value={capacityLoading ? "—" : formatHours(capacity.remainingHours)} detail={capacityLoading ? "Loading capacity" : `${formatHours(capacity.capacityHours)} available`} />
          <Metric label="Utilisation" value={capacityLoading ? "—" : formatPercent(capacity.utilisationPct)} detail="Productive ÷ available" tone={capacity.utilisationPct > 100 ? "danger" : ""} />
        </div>
      </LayerTheme>

      <LayerTheme as="section" sectionKey="clocking-live-status" padding="var(--space-3)" gap="var(--space-3)">
        <div className="clocking-board__toolbar">
          <div className="app-summary-grid clocking-board__status-grid">
            <Metric label="Technicians" value={board.summary.total} />
            <Metric label="In progress" value={board.summary.inProgress} />
            <Metric label="On MOT" value={board.summary.onMot} />
            <Metric label="Tea break" value={board.summary.teaBreak} />
            <Metric label="Waiting" value={board.summary.waiting} />
            <Metric label="Not clocked" value={board.summary.notClocked} />
          </div>
          <div className="clocking-board__filters">
            <DropdownField ariaLabel="Filter technician status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={STATUS_FILTER_OPTIONS} />
            <DropdownField ariaLabel="Sort technicians" value={sortBy} onChange={(event) => setSortBy(event.target.value)} options={SORT_OPTIONS} />
            {canManageCapacity ? <Button type="button" variant="primary" size="sm" onClick={() => setCapacitySettingsOpen(true)}>Capacity settings</Button> : null}
          </div>
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

      <div className="clocking-board__primary-layout">
        <LayerTheme as="section" sectionKey="clocking-technician-board" padding="var(--section-card-padding)" gap="var(--space-3)">
          <header className="clocking-board__section-header clocking-board__section-header--compact">
            <div><h2>Technicians</h2><p>{visibleTechnicians.length} shown</p></div>
          </header>
          {loading && !snapshot ? <BoardSkeleton /> : visibleTechnicians.length ? (
            <div className="clocking-board__technician-grid">
              {visibleTechnicians.map((technician) => (
                <TechnicianCard key={technician.userId} technician={technician} canManage={canManageCapacity} onManage={(selected) => setSelectedTechnicianId(selected.userId)} />
              ))}
            </div>
          ) : (
            <LayerSurface padding="var(--section-card-padding)" gap="var(--space-2)" className="clocking-board__empty">
              <strong>No technicians match this view</strong>
              <span>Change the status filter to show the rest of the workshop.</span>
            </LayerSurface>
          )}
        </LayerTheme>

        <aside className="clocking-board__operations-rail">
          <LayerTheme as="section" sectionKey="clocking-workshop-attention" padding="var(--section-card-padding)" gap="var(--space-3)">
            <header className="clocking-board__section-header clocking-board__section-header--compact clocking-board__section-header--rail">
              <div><h2>Workshop attention</h2><p>{attention.length} actionable {attention.length === 1 ? "exception" : "exceptions"}</p></div>
              <DropdownField ariaLabel="Waiting alert threshold" value={String(waitingThreshold)} onChange={(event) => setWaitingThreshold(Number(event.target.value))} options={WAITING_THRESHOLD_OPTIONS} />
            </header>
            {capacityLoading && !capacityDay ? <div className="app-status-message app-status-message--info">Checking expected attendance and capacity…</div> : null}
            <div className="clocking-board__attention-list">
              {attention.length ? attention.map((item) => (
                <LayerSurface key={item.id} padding="var(--space-3)" gap="var(--space-2)" className="clocking-board__attention-item">
                  <span className={`clocking-board__attention-tone app-tone-${item.tone}`}>{item.tone === "danger" ? "Needs action" : "Check"}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <Link href={`/clocking/${item.technician.slug}`}>View technician</Link>
                </LayerSurface>
              )) : !loading ? (
                <LayerSurface padding="var(--section-card-padding)" gap="var(--space-2)" className="clocking-board__empty">
                  <strong>No workshop exceptions</strong>
                  <span>Current waiting, attendance and allocation checks are clear.</span>
                </LayerSurface>
              ) : null}
            </div>
          </LayerTheme>

          <LayerTheme as="section" sectionKey="clocking-workshop-activity" padding="var(--section-card-padding)" gap="var(--space-3)">
            <header className="clocking-board__section-header clocking-board__section-header--compact">
              <div><h2>Workshop activity</h2><p>Recent meaningful clocking changes</p></div>
            </header>
            <div className="clocking-board__activity-list">
              {board.activity.length ? board.activity.map((event) => (
                <div className="clocking-board__activity-row" key={event.id}>
                  <span>{formatClockTime(event.at)}</span>
                  <strong>{event.message}</strong>
                </div>
              )) : <p className="clocking-board__empty-copy">No clocking changes recorded today.</p>}
            </div>
          </LayerTheme>

          <LayerTheme as="section" sectionKey="clocking-long-jobs" padding="var(--section-card-padding)" gap="var(--space-3)">
            <header className="clocking-board__section-header clocking-board__section-header--compact">
              <div><h2>Long jobs vs allocated</h2><p>Active work currently above allocation</p></div>
            </header>
            <div className="clocking-board__long-list">
              {longJobs.length ? longJobs.map((technician) => (
                <LayerSurface key={`${technician.userId}-${technician.currentJobId}`} padding="var(--space-3)" gap="var(--space-2)" className="clocking-board__long-row">
                  <div><strong>{technician.currentJobNumber}</strong><span>{technician.name}</span></div>
                  <div><strong className="clocking-board__danger-text">+{formatHours(technician.differenceHours)}</strong><span>{formatHours(technician.actualHours)} / {formatHours(technician.allocatedHours)}</span></div>
                </LayerSurface>
              )) : <p className="clocking-board__empty-copy">No active jobs are above their existing allocation.</p>}
            </div>
          </LayerTheme>
        </aside>
      </div>

      <LayerTheme as="section" sectionKey="clocking-today-summary" padding="var(--section-card-padding)" gap="var(--space-3)">
        <header className="clocking-board__section-header clocking-board__section-header--compact">
          <div><h2>Today&apos;s summary</h2><p>Live capacity distribution; technician efficiency calculations are unchanged</p></div>
          <Link className="app-btn app-btn--secondary app-btn--xs" href="/tech/efficiency">Open technician efficiency</Link>
        </header>
        <div className="app-summary-grid clocking-board__performance-grid">
          <Metric label="Productive hours" value={formatHours(board.performance.productiveHours)} detail="Job clocking" />
          <Metric label="Available hours" value={capacityLoading ? "—" : formatHours(capacity.capacityHours)} detail="Capacity settings" />
          <Metric label="Remaining hours" value={capacityLoading ? "—" : formatHours(capacity.remainingHours)} detail="Available less productive" />
          <Metric label="Idle time" value={formatHours(board.performance.idleHours)} detail="Attendance less job and break" />
          <Metric label="Break time" value={formatHours(board.performance.breakHours)} detail="Recorded today" />
          <Metric label="Capacity used" value={capacityLoading ? "—" : formatPercent(capacity.utilisationPct)} detail="Live distribution" tone={capacity.utilisationPct > 100 ? "danger" : ""} />
        </div>
      </LayerTheme>

      <ClockingControlModal technician={selectedTechnician} onClose={() => setSelectedTechnicianId(null)} onCompleted={() => fetchBoard({ background: true })} />
      <CapacitySettingsPopup
        isOpen={capacitySettingsOpen}
        onClose={() => setCapacitySettingsOpen(false)}
        onSaved={fetchCapacity}
      />

      <style jsx>{`
        .clocking-board { container: clocking-board / inline-size; display: flex; flex-direction: column; gap: var(--page-stack-gap); width: 100%; min-width: 0; color: var(--text-1); }
        .clocking-board__section-header, .clocking-board__toolbar, .clocking-board__technician-header, .clocking-board__work-heading, .clocking-board__live-duration, .clocking-board__allocation-copy, .clocking-board__card-actions, .clocking-board__activity-row, .clocking-board__long-row, .clocking-board__filters { display: flex; align-items: center; gap: var(--space-3); }
        .clocking-board__section-header, .clocking-board__toolbar, .clocking-board__technician-header, .clocking-board__work-heading, .clocking-board__live-duration, .clocking-board__allocation-copy, .clocking-board__long-row { justify-content: space-between; }
        .clocking-board__section-header > div:first-child, .clocking-board__technician-header > div:first-child { min-width: 0; }
        .clocking-board__section-header h1 { margin: 0; color: var(--accentText); font-size: clamp(1.35rem, 2.4vw, 1.9rem); letter-spacing: -0.025em; line-height: 1.1; }
        .clocking-board__section-header h2 { margin: 0; color: var(--accentText); font-size: 1.05rem; line-height: 1.15; }
        .clocking-board__section-header p, .clocking-board__technician-header p, .clocking-board__current-work p, .clocking-board__next-job p, .clocking-board__attention-item p, .clocking-board__empty-copy { margin: 2px 0 0; color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__section-header--compact { min-height: 44px; }
        .clocking-board__section-header--rail { align-items: stretch; flex-direction: column; }
        .clocking-board__section-header--rail :global(.dropdown-api) { width: 100%; }
        .clocking-board__live-state { display: grid; grid-template-columns: 8px auto; align-items: center; column-gap: var(--space-sm); flex: 0 0 auto; }
        .clocking-board__live-state > span { width: 8px; height: 8px; border-radius: 50%; background: var(--warning); grid-row: 1 / span 2; }
        .clocking-board__live-state > span.is-live { background: var(--success); }
        .clocking-board__live-state strong { font-size: var(--text-label); }
        .clocking-board__live-state small { color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__capacity-grid { flex: 0 0 auto; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .clocking-board__status-grid { grid-template-columns: repeat(6, minmax(104px, 1fr)); flex: 1 1 620px; }
        .clocking-board__metric { max-height: none; height: auto; min-height: 52px; font-variant-numeric: tabular-nums; }
        .clocking-board__metric small { flex-basis: 100%; color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__toolbar { align-items: stretch; flex-wrap: wrap; }
        .clocking-board__filters { justify-content: flex-end; flex-wrap: wrap; flex: 0 1 auto; }
        .clocking-board__filters :global(.dropdown-api) { width: min(190px, 100%); }
        .clocking-board__primary-layout { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(18rem, 0.85fr); gap: var(--page-stack-gap); align-items: start; }
        .clocking-board__operations-rail { display: flex; flex-direction: column; gap: var(--page-stack-gap); align-self: start; min-width: 0; }
        .clocking-board__technician-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); grid-auto-rows: max-content; gap: var(--layout-card-gap); align-items: start; align-content: start; }
        .clocking-board__technician { min-height: 0; height: auto; align-self: start; transition: transform 180ms ease, box-shadow 180ms ease; }
        .clocking-board__technician:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
        .clocking-board__technician-header { align-items: flex-start; }
        .clocking-board__technician-header h3 { margin: 0; color: var(--text-1); font-size: 1rem; line-height: 1.15; }
        .clocking-board__status, .clocking-board__attention-tone { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 5px 9px; border-radius: var(--radius-xs); font-size: var(--text-caption); font-weight: 700; white-space: nowrap; }
        .clocking-board__current-work { min-height: 0; }
        .clocking-board__work-heading > span, .clocking-board__live-duration > span, .clocking-board__next-job > span, .clocking-board__label { color: var(--grey-accent); font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
        .clocking-board__work-heading strong, .clocking-board__live-duration strong { color: var(--accentText); font-variant-numeric: tabular-nums; }
        .clocking-board__current-work p, .clocking-board__next-job p { overflow-wrap: anywhere; }
        .clocking-board__allocation { display: flex; flex-direction: column; gap: var(--space-2); margin-top: auto; }
        .clocking-board__allocation-copy, .clocking-board__allocation small { font-size: var(--text-caption); font-variant-numeric: tabular-nums; }
        .clocking-board__progress { width: 100%; height: 7px; border-radius: var(--radius-xs); background: var(--surface); overflow: hidden; }
        .clocking-board__progress > span { display: block; height: 100%; background: var(--success); border-radius: inherit; transition: width 240ms ease; }
        .clocking-board__progress > span.is-over { background: var(--danger); }
        .clocking-board__danger-text { color: var(--danger-dark) !important; }
        .clocking-board__next-job { display: flex; flex-direction: column; gap: var(--space-2); min-height: 0; }
        .clocking-board__next-job > div { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--space-sm); }
        .clocking-board__next-job > div p, .clocking-board__next-job > div small { grid-column: 2; }
        .clocking-board__next-job small { color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__card-actions { align-items: stretch; flex-wrap: wrap; margin-top: auto; padding-top: var(--space-2); }
        .clocking-board__card-actions > :global(*) { flex: 1 1 112px; }
        .clocking-board__attention-list, .clocking-board__long-list { display: flex; flex-direction: column; gap: var(--space-sm); }
        .clocking-board__attention-item strong { font-size: var(--text-label); line-height: 1.25; }
        .clocking-board__attention-item a { font-size: var(--text-caption); font-weight: 700; }
        .clocking-board__activity-list { display: flex; flex-direction: column; max-height: min(18rem, 34dvh); overflow-y: auto; }
        .clocking-board__activity-row { align-items: baseline; padding: var(--space-2) 0; border-bottom: var(--separating-line); font-size: var(--text-label); }
        .clocking-board__activity-row:last-child { border-bottom: none; }
        .clocking-board__activity-row span { flex: 0 0 48px; color: var(--grey-accent); font-variant-numeric: tabular-nums; }
        .clocking-board__long-row { flex-direction: row; }
        .clocking-board__long-row > div { display: flex; flex-direction: column; gap: 2px; }
        .clocking-board__long-row > div:last-child { align-items: flex-end; text-align: right; }
        .clocking-board__long-row span { color: var(--text-1); font-size: var(--text-caption); }
        .clocking-board__performance-grid { flex: 0 0 auto; grid-template-columns: repeat(6, minmax(0, 1fr)); }
        .clocking-board__empty { align-items: flex-start; }
        .clocking-board__empty span { color: var(--text-1); font-size: var(--text-label); }
        .clocking-control-modal__content { display: flex; flex-direction: column; gap: var(--layout-card-gap); }
        .clocking-control-modal__content h2 { color: var(--accentText); font-size: 1.2rem; }
        :global(.clocking-control-modal) { overflow: visible; }
        :global(.clocking-board > .app-status-message) { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        @container clocking-board (max-width: 60rem) {
          .clocking-board__primary-layout { grid-template-columns: 1fr; }
          .clocking-board__operations-rail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
          .clocking-board__operations-rail > :first-child { grid-column: 1 / -1; }
          .clocking-board__capacity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .clocking-board__performance-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .clocking-board__status-grid { grid-template-columns: repeat(3, minmax(104px, 1fr)); }
        }
        @container clocking-board (max-width: 45rem) {
          .clocking-board__operations-rail { grid-template-columns: 1fr; }
          .clocking-board__operations-rail > :first-child { grid-column: auto; }
          .clocking-board__performance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 768px) {
          .clocking-board__section-header { align-items: flex-start; flex-wrap: wrap; }
          .clocking-board__live-state { width: 100%; }
          .clocking-board__filters { width: 100%; justify-content: stretch; }
          .clocking-board__filters :global(.dropdown-api), .clocking-board__filters :global(.app-btn) { flex: 1 1 180px; width: 100%; }
        }
        @media (max-width: 520px) {
          .clocking-board__capacity-grid, .clocking-board__performance-grid { grid-template-columns: 1fr 1fr; }
          .clocking-board__status-grid { display: flex; flex-flow: row nowrap; overflow-x: auto; }
          .clocking-board__status-grid > :global(*) { flex: 0 0 118px; }
          .clocking-board__technician-grid { grid-template-columns: 1fr; }
          .clocking-board__card-actions { display: grid; grid-template-columns: 1fr; }
          .clocking-board__card-actions > :global(*) { width: 100%; }
          .clocking-board__section-header--compact :global(.dropdown-api) { width: 100%; }
          :global(.clocking-board > .app-status-message) { align-items: stretch; flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) {
          .clocking-board__technician, .clocking-board__progress > span { transition: none; }
          .clocking-board__technician:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}

export default function ClockingPage() {
  return <ClockingPageUi view="section1" ClockingOverviewTab={ClockingOverviewTab} ContentWidth={ContentWidth} PageShell={PageShell} />;
}
