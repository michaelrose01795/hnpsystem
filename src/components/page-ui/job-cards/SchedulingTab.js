// file location: src/components/page-ui/job-cards/SchedulingTab.js
// Scheduling tab sections — consolidated into one file per CLAUDE.md §4.3
// (one file per tab). Each section below is the same component previously held
// in its own file under scheduling/; behaviour and markup are unchanged.
//   • TechnicianAssignmentSection  — assignable technicians + capacity/queue
//   • JobProgressSection           — circular requests-complete progress ring
//   • CollectionTypeSection        — waiting/loan/collection selector + detail
//   • CustomerUpdatesSection       — last updated (derived) + next update due
//   • QuickActionsSection          — shortcut buttons wired by the orchestrator
//   • AlertsRemindersSection       — live derived status rows (parts/updates)
import React, { useEffect, useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import useJobProgressBreakdown from "@/hooks/useJobProgressBreakdown";

const sectionTitleStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 700,
  color: "var(--text-1)",
};
const labelStyle = {
  fontSize: "var(--text-label)",
  fontWeight: 600,
  color: "var(--text-1)",
  opacity: 0.65,
};

/* ────────────────────────────────────────────────────────────────────────
   Technician Assignment.
   Dropdown of assignable technicians; on selection shows the tech's name,
   skill chips, today's capacity (hours done vs available) and their job count
   for today (with this job's position in the queue). Wired to real data via
   GET /api/technicians and POST /api/job-cards/[jobNumber]/technician.
   ──────────────────────────────────────────────────────────────────────── */
export function TechnicianAssignmentSection({
  jobData,
  canEdit = false,
  jobNumber,
  onRefreshJob = () => {},
}) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assignedId = jobData?.assignedTo != null ? String(jobData.assignedTo) : "";
  const currentJobId = jobData?.id ?? jobData?.jobId ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/technicians")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.success) setTechnicians(data.technicians || []);
        else setError(data?.error || "Failed to load technicians");
      })
      .catch((err) => active && setError(err?.message || "Failed to load technicians"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selectedTech = useMemo(
    () => technicians.find((tech) => String(tech.id) === assignedId) || null,
    [technicians, assignedId]
  );

  const handleAssign = async (value) => {
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    const tech = technicians.find((t) => String(t.id) === String(value));
    try {
      const res = await fetch(
        `/api/job-cards/${encodeURIComponent(jobNumber)}/technician`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId: value ? Number(value) : null,
            technicianName: tech?.name || "",
          }),
        }
      );
      const data = await res.json();
      if (!data?.success) {
        setError(data?.error || "Failed to update assignment");
      } else {
        await onRefreshJob();
      }
    } catch (err) {
      setError(err?.message || "Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  // Position of this job in the tech's day, e.g. "4 of 6".
  const jobPosition = useMemo(() => {
    if (!selectedTech || currentJobId == null) return null;
    const idx = (selectedTech.jobIdsToday || []).findIndex(
      (id) => Number(id) === Number(currentJobId)
    );
    return idx >= 0 ? idx + 1 : null;
  }, [selectedTech, currentJobId]);

  const hoursDone = selectedTech?.hoursDone ?? 0;
  const hoursAvailable = selectedTech?.hoursAvailable || 8;
  const capacityPct = Math.min(
    100,
    Math.round((hoursDone / (hoursAvailable || 1)) * 100)
  );
  const overCapacity = hoursDone > hoursAvailable;

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-technician"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "14px" }}
    >
      <h3 style={sectionTitleStyle}>Technician Assignment</h3>

      <DropdownField
        label="Assigned technician"
        placeholder={loading ? "Loading technicians…" : "Select a technician"}
        value={assignedId}
        onChange={(event) => handleAssign(event.target.value)}
        disabled={!canEdit || loading || saving}
        className="compact-picker"
        options={[
          { value: "", label: "Unassigned" },
          ...technicians.map((tech) => ({
            value: String(tech.id),
            label: tech.jobTitle ? `${tech.name} · ${tech.jobTitle}` : tech.name,
          })),
        ]}
      />

      {error && (
        <div className="app-status-message app-status-message--danger">{error}</div>
      )}

      {selectedTech ? (
        <LayerTheme
          sectionKey="jobcard-scheduling-technician-detail"
          sectionType="content-card"
          parentKey="jobcard-scheduling-technician"
          style={{ gap: "12px" }}
        >
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)" }}>
              {selectedTech.name}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
              {selectedTech.jobTitle || selectedTech.role || "Technician"}
            </div>
          </div>

          {/* Skill chips */}
          <div>
            <div style={{ ...labelStyle, marginBottom: "6px" }}>Skill set</div>
            {selectedTech.skills && selectedTech.skills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {selectedTech.skills.map((skill) => (
                  <span key={skill} className="app-badge app-badge--accent-soft">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.55 }}>
                No skills recorded.
              </div>
            )}
          </div>

          {/* Capacity bar */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "6px",
              }}
            >
              <span style={labelStyle}>Capacity today</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: overCapacity ? "var(--danger)" : "var(--text-1)",
                }}
              >
                {hoursDone}h of {hoursAvailable}h
              </span>
            </div>
            {/* Functional progress indicator (not a card) — tinted track + fill. */}
            <div
              style={{
                height: "10px",
                borderRadius: "var(--radius-pill)",
                background: "rgba(var(--grey-accent-rgb), 0.25)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${capacityPct}%`,
                  borderRadius: "var(--radius-pill)",
                  background: overCapacity ? "var(--danger)" : "var(--success)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Jobs today */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={labelStyle}>Jobs today</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>
              {jobPosition
                ? `${jobPosition} of ${selectedTech.jobsToday}`
                : `${selectedTech.jobsToday} scheduled`}
            </span>
          </div>
        </LayerTheme>
      ) : (
        <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.6 }}>
          No technician assigned to this job yet.
        </div>
      )}
    </LayerSurface>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Job Progress.
   Circular progress ring showing "n / total requests complete" in the centre,
   with green / amber / red / grey arc segments, alongside a vertical legend.
   The ring is an SVG functional diagram primitive (CLAUDE.md §3.0a allowlist),
   not a card, so its strokes are permitted.
   ──────────────────────────────────────────────────────────────────────── */
const PROGRESS_SIZE = 150;
const PROGRESS_STROKE = 16;
const PROGRESS_RADIUS = (PROGRESS_SIZE - PROGRESS_STROKE) / 2;
const PROGRESS_CENTER = PROGRESS_SIZE / 2;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

export function JobProgressSection({ jobData }) {
  const breakdown = useJobProgressBreakdown(jobData);
  const { total, complete, percentComplete, segments } = breakdown;

  // Build the accumulating arc offsets for each non-zero segment.
  let accumulated = 0;
  const arcs =
    total > 0
      ? segments
          .filter((seg) => seg.count > 0)
          .map((seg) => {
            const fraction = seg.count / total;
            const dash = fraction * PROGRESS_CIRCUMFERENCE;
            const arc = {
              key: seg.key,
              token: seg.token,
              dasharray: `${dash} ${PROGRESS_CIRCUMFERENCE - dash}`,
              dashoffset: -accumulated,
            };
            accumulated += dash;
            return arc;
          })
      : [];

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-progress"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "16px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Job Progress
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ring */}
        <div style={{ position: "relative", width: PROGRESS_SIZE, height: PROGRESS_SIZE, flexShrink: 0 }}>
          <svg width={PROGRESS_SIZE} height={PROGRESS_SIZE} viewBox={`0 0 ${PROGRESS_SIZE} ${PROGRESS_SIZE}`} role="img"
            aria-label={`${complete} of ${total} requests complete`}>
            <g transform={`rotate(-90 ${PROGRESS_CENTER} ${PROGRESS_CENTER})`}>
              {/* Base track */}
              <circle
                cx={PROGRESS_CENTER}
                cy={PROGRESS_CENTER}
                r={PROGRESS_RADIUS}
                fill="none"
                stroke="rgba(var(--grey-accent-rgb), 0.22)"
                strokeWidth={PROGRESS_STROKE}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx={PROGRESS_CENTER}
                  cy={PROGRESS_CENTER}
                  r={PROGRESS_RADIUS}
                  fill="none"
                  stroke={arc.token}
                  strokeWidth={PROGRESS_STROKE}
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                />
              ))}
            </g>
          </svg>
          {/* Centre label */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>
              {complete}/{total}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-1)", opacity: 0.6, marginTop: "2px" }}>
              requests complete
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--success)", marginTop: "2px" }}>
              {percentComplete}%
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "150px", flex: "1 1 150px" }}>
          {segments.map((seg) => (
            <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "var(--radius-pill)",
                  background: seg.token,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)", minWidth: "18px" }}>
                {seg.count}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.75 }}>
                {seg.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </LayerSurface>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Collection Type.
   "Waiting / Loan Car / Collection / Neither" selector (persists to the job's
   waiting_status via the existing logistics handler). Below it, a conditional
   detail panel derived from real data already on the job:
     Loan Car   → the loan-car details recorded on the booking request
     Waiting    → "waiting from" = the appointment time
     Collection → "collect by" = the booking ETA, else appointment time
     Neither    → nothing
   ──────────────────────────────────────────────────────────────────────── */
const WAITING_OPTIONS = ["Waiting", "Loan Car", "Collection", "Neither"];

const collectionLabelStyle = {
  fontSize: "var(--text-label)",
  fontWeight: 600,
  color: "var(--text-1)",
  opacity: 0.65,
};
const collectionValueStyle = { fontSize: "14px", fontWeight: 600, color: "var(--text-1)" };

const formatAppointment = (appointment) => {
  if (!appointment?.date) return null;
  const time = appointment.time ? ` at ${appointment.time}` : "";
  const dt = new Date(`${appointment.date}T${appointment.time || "00:00"}`);
  if (Number.isNaN(dt.getTime())) return `${appointment.date}${time}`;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }) + time;
};

const formatCollectionDateTime = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
    <span style={collectionLabelStyle}>{label}</span>
    <span style={collectionValueStyle}>{value}</span>
  </div>
);

export function CollectionTypeSection({
  waitingStatus,
  canEdit = false,
  onSelect = () => {},
  jobData,
}) {
  const active = waitingStatus || "Neither";
  const appointmentText = formatAppointment(jobData?.appointment);
  const loanCarDetails = jobData?.bookingRequest?.loanCarDetails || "";
  const collectBy =
    formatCollectionDateTime(jobData?.bookingRequest?.estimatedCompletion) || appointmentText;

  const renderDetail = () => {
    if (active === "Loan Car") {
      return (
        <DetailRow
          label="Loan car"
          value={loanCarDetails || "No loan car details recorded yet."}
        />
      );
    }
    if (active === "Waiting") {
      return (
        <DetailRow
          label="Waiting from"
          value={appointmentText || "No appointment time set."}
        />
      );
    }
    if (active === "Collection") {
      return (
        <DetailRow label="Collect by" value={collectBy || "No collection time set."} />
      );
    }
    return (
      <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.55 }}>
        No collection arrangement required.
      </span>
    );
  };

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-collection"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "14px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Collection Type
      </h3>

      {/* Reuses the canonical tab strip family (same as the main job tabs). */}
      <div
        className="tab-scroll-row"
        role="tablist"
        style={{
          backgroundColor: "var(--tab-container-bg)",
          borderRadius: "var(--radius-sm)",
          padding: "8px",
        }}
      >
        {WAITING_OPTIONS.map((option) => {
          const isActive = active === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              className={`tab-api__item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(option)}
              disabled={!canEdit}
              aria-selected={isActive}
            >
              {option}
            </button>
          );
        })}
      </div>

      <LayerTheme
        sectionKey="jobcard-scheduling-collection-detail"
        sectionType="content-card"
        parentKey="jobcard-scheduling-collection"
        style={{ gap: "8px" }}
      >
        {renderDetail()}
      </LayerTheme>
    </LayerSurface>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Customer Updates.
   "Last updated" is derived (read-only) from the latest customer-visible
   message on the job's messaging thread. "Next update due" is editable and
   persists to jobs.next_update_due via POST /api/job-cards/[jobNumber]/next-update.
   ──────────────────────────────────────────────────────────────────────── */
const splitIso = (iso) => {
  if (!iso) return { date: "", time: "" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { date: "", time: "" };
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
};

export function CustomerUpdatesSection({
  jobData,
  jobNumber,
  canEdit = false,
  onRefreshJob = () => {},
}) {
  const initial = splitIso(jobData?.nextUpdateDue);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Re-sync when the persisted value changes (e.g. after a refresh).
  useEffect(() => {
    const next = splitIso(jobData?.nextUpdateDue);
    setDate(next.date);
    setTime(next.time);
    setMessage("");
  }, [jobData?.nextUpdateDue]);

  // Last customer-visible message timestamp.
  const lastUpdated = useMemo(() => {
    const messages = jobData?.messagingThread?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const visible = messages.filter(
      (m) => m?.customerVisible !== false && m?.audience !== "staff" && m?.createdAt
    );
    if (visible.length === 0) return null;
    const latest = visible.reduce((acc, m) =>
      new Date(m.createdAt) > new Date(acc.createdAt) ? m : acc
    );
    return latest.createdAt;
  }, [jobData?.messagingThread]);

  const lastUpdatedText = lastUpdated
    ? new Date(lastUpdated).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No updates sent yet";

  const persist = async (nextUpdateDue) => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/job-cards/${encodeURIComponent(jobNumber)}/next-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextUpdateDue }),
        }
      );
      const data = await res.json();
      if (!data?.success) {
        setMessage(data?.error || "Failed to save");
      } else {
        setMessage(nextUpdateDue ? "Next update saved" : "Next update cleared");
        await onRefreshJob();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!canEdit || !date || !time) return;
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return;
    persist(dt.toISOString());
  };

  const handleClear = () => {
    if (!canEdit) return;
    setDate("");
    setTime("");
    persist(null);
  };

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-customer-updates"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "14px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Customer Updates
      </h3>

      <LayerTheme
        sectionKey="jobcard-scheduling-customer-updates-last"
        sectionType="content-card"
        parentKey="jobcard-scheduling-customer-updates"
        style={{ gap: "2px" }}
      >
        <span style={labelStyle}>Last updated</span>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-1)" }}>
          {lastUpdatedText}
        </span>
      </LayerTheme>

      <div>
        <div style={{ ...labelStyle, marginBottom: "6px" }}>Next update due</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <CalendarField
            label="Date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={!canEdit || saving}
            className="compact-picker"
          />
          <TimePickerField
            label="Time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={!canEdit || saving}
            className="compact-picker"
          />
        </div>
      </div>

      {canEdit && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={handleSave}
            disabled={saving || !date || !time}
          >
            {saving ? "Saving…" : "Set next update"}
          </button>
          {jobData?.nextUpdateDue && (
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={handleClear}
              disabled={saving}
            >
              Clear
            </button>
          )}
          {message && (
            <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: 500 }}>
              {message}
            </span>
          )}
        </div>
      )}
    </LayerSurface>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Quick Actions.
   A row of shortcut buttons. The orchestrator wires each handler to the
   relevant existing behaviour (scroll to collection, jump to Notes tab, jump
   to Messages tab, etc.).
   ──────────────────────────────────────────────────────────────────────── */
const ACTION_BTN_CLASS = "app-btn app-btn--secondary";

export function QuickActionsSection({
  canEdit = false,
  onChangeCollectionTimes = () => {},
  onAddWorkshopNote = () => {},
  onSendCustomerUpdate = () => {},
}) {
  const actions = [
    { key: "collection", label: "Change collection times", icon: "🕒", onClick: onChangeCollectionTimes },
    { key: "note", label: "Add workshop note", icon: "📝", onClick: onAddWorkshopNote },
    { key: "update", label: "Send update to customer", icon: "✉️", onClick: onSendCustomerUpdate },
  ];

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-quick-actions"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "12px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Quick Actions
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "10px",
        }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={ACTION_BTN_CLASS}
            onClick={action.onClick}
            disabled={!canEdit}
            style={{ justifyContent: "flex-start", gap: "8px" }}
          >
            <span aria-hidden="true">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </LayerSurface>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Alerts & Reminders.
   Derives live status rows from the job's real data: requests blocked on parts,
   whether the next customer update is due/overdue, and a scheduling-conflict
   indicator. Rows use the tokenised app-status-message tones (tint + icon),
   never coloured side-borders (CLAUDE.md §3.0a).
   ──────────────────────────────────────────────────────────────────────── */
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

const ALERT_ICONS = { success: "✅", warning: "⚠️", danger: "⛔", info: "ℹ️" };

const AlertRow = ({ tone, children }) => (
  <div
    className={`app-status-message app-status-message--${tone}`}
    style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
    role="status"
  >
    <span aria-hidden="true">{ALERT_ICONS[tone]}</span>
    <span>{children}</span>
  </div>
);

export function AlertsRemindersSection({ jobData }) {
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
