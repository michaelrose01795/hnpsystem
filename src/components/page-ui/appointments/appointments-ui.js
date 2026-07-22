// file location: src/components/page-ui/appointments/appointments-ui.js
//
// Single presentation file for the /appointments page. Together with the page
// logic in src/pages/appointments/index.js these are the ONLY two files the
// page needs — there is no separate scheduler component or CSS module any more.
// The workshop scheduling board (previously
// src/components/Appointments/SchedulerBoard.js + SchedulerBoard.module.css)
// now lives inline in this file, following the same app standard used by every
// other page-ui file: inline styles driven by the global theme tokens
// (var(--surface), var(--theme), var(--text-1) …) plus one small component-
// scoped <style jsx global> block for the things inline styles can't express
// (responsive sizing vars, hover states and the CSS-grid time axis). Because all
// styling lives in this component, every change hot-reloads reliably and a UI
// tweak only ever touches this file or the functions in index.js.
//
// DEV OVERLAY: every card section declares data-dev-section-key /
// data-dev-section-parent so the whole page forms one clean tree rooted at the
// layout's "app-layout-page-card" (StaffLayout.js). The root page shell here is
// "appointments-planner"; the booking toolbar, scheduler board and day-jobs
// table all hang off it, so the overlay reports the real card hierarchy.
import React, { useMemo, useCallback, useEffect, useRef } from "react";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical surface layer primitive (CLAUDE.md §3.0)
import PopupModal from "@/components/popups/popupStyleApi"; // shared staffglobal popup (full-cover backdrop hides the topbar)
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton"; // data-area skeletons while jobs load
import { CalendarField } from "@/components/ui/calendarAPI"; // in-app calendar picker (.calendar-api) — replaces the native date popup
import Button from "@/components/ui/Button"; // canonical staffglobal button family

// ===========================================================================
// Workshop Scheduler board (inlined — was src/components/Appointments/SchedulerBoard.js)
// CSS-Grid planning board that replaces the old availability table. Each row is
// a day; the time axis runs 08:00–17:00 in 15-min columns. The sticky left
// column is a day summary panel; booking cards stack in 28px lanes inside the
// time grid (longest span on top), the row growing to fit the lanes used, with a
// modal overflow when a slot has more than MAX_VISIBLE_PER_SLOT overlapping
// jobs. Styling lives in the appt-sched-* classes in the <style jsx global>
// block at the foot of this file.
// ===========================================================================
const DAY_START_MIN = 8 * 60; // 08:00
const DAY_END_MIN = 17 * 60; // 17:00
const SLOT_MINUTES = 15;
const SLOT_COUNT = (DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES + 1; // 37 columns
const LAST_END_SLOT = SLOT_COUNT - 1; // 36 = the 17:00 gridline; tiles may end here but never start here
const MAX_VISIBLE_PER_SLOT = 6; // max stacked tile lanes per day before the overflow button; the row grows to fit the lanes actually used
const MIN_BAR_SLOTS = 1; // tiles can be as narrow as a single 15-min column
const DEFAULT_BAR_SLOTS = 4; // fallback span (1h) when no finish time is known

const pad2 = (n) => n.toString().padStart(2, "0");

const slotLabel = (index) => {
  const minutes = DAY_START_MIN + index * SLOT_MINUTES;
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
};

// Build the array of column slot labels once.
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => slotLabel(i));

const toMidnight = (value) => {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

// "YYYY-MM-DD" key (local components) used to match a job's appointment.date.
const isoDateKey = (date) => {
  const d = toMidnight(date);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Convert an "HH:MM" time into a 0-based slot index, clamped to the visible
// 08:00–17:00 range. Returns null for unparseable input.
const timeToSlotIndex = (time) => {
  if (!time || typeof time !== "string") return null;
  const [hRaw, mRaw] = time.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const total = hours * 60 + minutes;
  const clamped = Math.min(Math.max(total, DAY_START_MIN), DAY_END_MIN);
  return Math.round((clamped - DAY_START_MIN) / SLOT_MINUTES);
};

// ---------------- Workshop status mapping ----------------
// Mirrors the /job-cards/waiting/nextjobs card treatment: the tile itself is
// always --surface; status is signalled by a soft tinted pill (pillBg) + dot on
// the right, never by tinting the whole tile.
const SCHED_STATUS_META = {
  waiting: { label: "Waiting", dot: "var(--warning)", pillBg: "var(--warning-surface)" },
  progress: { label: "In Progress", dot: "#3b82f6", pillBg: "rgba(59, 130, 246, 0.16)" },
  complete: { label: "Completed", dot: "var(--success)", pillBg: "var(--success-surface)" },
  cancelled: { label: "Cancelled", dot: "var(--surfaceTextMuted)", pillBg: "rgba(var(--accent-base-rgb), 0.12)" },
};

const deriveSchedStatusKey = (job) => {
  const raw = `${job?.status || ""} ${job?.appointment?.status || ""}`.toLowerCase();
  if (raw.includes("cancel")) return "cancelled";
  if (raw.includes("complete") || raw.includes("collected") || raw.includes("done")) return "complete";
  if (
    job?.checked_in_at ||
    job?.checkedInAt ||
    raw.includes("progress") ||
    raw.includes("checked") ||
    raw.includes("workshop") ||
    raw.includes("started")
  ) {
    return "progress";
  }
  return "waiting";
};

const formatSchedHours = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0.0";
  return numeric.toFixed(1);
};

const getCapacityState = (utilisation) => {
  if (utilisation >= 90) return "red";
  if (utilisation >= 70) return "amber";
  return "green";
};

const displaySchedStatus = (job, statusKey) => {
  const raw = job?.status || job?.appointment?.status || "";
  if (raw) return raw;
  return (SCHED_STATUS_META[statusKey] || SCHED_STATUS_META.waiting).label;
};

const getJobItemLabels = (job) => {
  const labels = [];
  const seen = new Set();
  const pushLabel = (value) => {
    const label = String(value || "").trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    labels.push(label);
  };

  (Array.isArray(job?.jobRequests) ? job.jobRequests : []).forEach((item) => {
    pushLabel(item?.description || item?.noteText || item?.jobType);
  });
  (Array.isArray(job?.jobCategories) ? job.jobCategories : []).forEach(pushLabel);
  pushLabel(job?.type);
  pushLabel(job?.description);

  return labels.length ? labels.slice(0, 3).join(", ") : "Job items pending";
};

const buildDaySummary = ({ cards, capacityHours }) => {
  const bookedHours = cards.reduce((sum, card) => sum + card.estimatedHours, 0);
  const utilisation =
    capacityHours > 0 ? Math.round((bookedHours / capacityHours) * 100) : 0;
  const cappedUtilisation = Math.min(Math.max(utilisation, 0), 999);
  const state = getCapacityState(cappedUtilisation);
  return {
    totalJobs: cards.length,
    bookedHours,
    capacityHours,
    utilisation: cappedUtilisation,
    progress: Math.min(cappedUtilisation, 100),
    state,
  };
};

// Greedy lane fill across up to MAX_VISIBLE_PER_SLOT stacked lanes. Cards are
// pre-sorted longest-span-first within a start time, so the lowest (top) lane
// goes to the longest tile and the shortest ends up at the bottom. Returns how
// many lanes were actually used so the row can size its height to the stack.
const assignVisibleLanes = (cards) => {
  const laneEnds = [];
  let lanesUsed = 0;
  cards.forEach((card) => {
    let assignedLane = -1;
    for (let lane = 0; lane < MAX_VISIBLE_PER_SLOT; lane += 1) {
      if ((laneEnds[lane] ?? -1) <= card.startSlot) {
        assignedLane = lane;
        laneEnds[lane] = card.endSlot;
        break;
      }
    }
    card.lane = assignedLane;
    if (assignedLane >= 0) lanesUsed = Math.max(lanesUsed, assignedLane + 1);
  });
  return lanesUsed;
};

const buildOverflowSlots = (cards) => {
  const seen = new Set();
  const overflowSlots = [];
  for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
    const activeCards = cards.filter(
      (card) => card.startSlot <= slotIndex && card.endSlot > slotIndex
    );
    if (activeCards.length <= MAX_VISIBLE_PER_SLOT) continue;
    const activeKey = activeCards.map((card) => card.id).sort().join("|");
    if (seen.has(activeKey)) continue;
    seen.add(activeKey);
    overflowSlots.push({ slotIndex, cards: activeCards });
  }
  return overflowSlots;
};

function SchedulerBoard({
  jobs = [],
  selectedDay,
  onSelectDay,
  onOpenDayJobs,
  getFinishTime,
  getBookingHours,
  getDayTechSummary,
  viewMode = "month",
}) {
  const isDayMode = viewMode === "day";
  const viewportRef = useRef(null);

  // Rows depend on the toolbar filter:
  //   • "month" (default) → every day of the selected day's month, scrollable,
  //     with the selected day (today by default) pinned to the top of the board.
  //   • "day" → only the selected day, stretched to fill the board height.
  const visibleDates = useMemo(() => {
    const base = toMidnight(selectedDay) || toMidnight(new Date()) || new Date();
    if (isDayMode) return [base];
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Workshop is closed Sundays — drop them from the date column entirely.
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)).filter(
      (d) => d.getDay() !== 0
    );
  }, [selectedDay, isDayMode]);

  // Group bookings by date key and active time slot. Each booking carries its
  // start → finish span and stacks in its own lane; up to MAX_VISIBLE_PER_SLOT
  // overlap, with further overlaps opened from that slot's overflow button.
  const bookingsByDate = useMemo(() => {
    const map = new Map();
    (jobs || []).forEach((job) => {
      const date = job?.appointment?.date;
      const time = job?.appointment?.time;
      if (!date || !time) return;
      let startSlot = timeToSlotIndex(time);
      if (startSlot === null) return;

      // ETA finish → end slot. Fall back to a default span when unknown.
      let endSlot = null;
      const finish = typeof getFinishTime === "function" ? getFinishTime(job) : null;
      const finishIndex = timeToSlotIndex(finish);
      if (finishIndex !== null && finishIndex > startSlot) endSlot = finishIndex;
      if (endSlot === null) endSlot = startSlot + DEFAULT_BAR_SLOTS;
      // Clamp the span to the visible 08:00–17:00 axis. 17:00 (LAST_END_SLOT) is
      // the right edge: a tile may END there but never START there, so a job ending
      // past 17:00 just stops at 17:00, and a job booked AT 17:00 is shown as the
      // final 16:45–17:00 column (the 15-min minimum width) by growing leftwards.
      endSlot = Math.min(Math.max(endSlot, startSlot + MIN_BAR_SLOTS), LAST_END_SLOT);
      if (endSlot - startSlot < MIN_BAR_SLOTS) {
        startSlot = Math.max(0, endSlot - MIN_BAR_SLOTS);
      }

      const dateKey = date.length > 10 ? isoDateKey(date) : date;
      const estimatedHours =
        typeof getBookingHours === "function" ? Number(getBookingHours(job)) : 0;
      const statusKey = deriveSchedStatusKey(job);
      const card = {
        id: job.id ?? `${job.jobNumber}-${time}`,
        job,
        jobNumber: job.jobNumber || job.id || "—",
        reg: job.reg || job.vehicleReg || "—",
        customer: job.customer || "Customer TBC",
        items: getJobItemLabels(job),
        estimatedHours: Number.isFinite(estimatedHours) ? estimatedHours : 0,
        statusLabel: displaySchedStatus(job, statusKey),
        time,
        finish: finish && finish !== "-" ? finish : null,
        statusKey,
        startSlot,
        endSlot,
        lane: 0,
      };
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(card);
    });

    const result = new Map();
    map.forEach((cards, key) => {
      // Stack overlapping bookings longest-first: longest span on top, shortest
      // on the bottom. Sorting by start, then duration desc, makes the greedy
      // lane fill hand the lowest (top) lane to the longest tile.
      cards.sort(
        (a, b) =>
          a.startSlot - b.startSlot ||
          b.endSlot - b.startSlot - (a.endSlot - a.startSlot) ||
          a.endSlot - b.endSlot
      );
      const laneCount = Math.max(1, assignVisibleLanes(cards));
      result.set(key, { cards, laneCount, overflowSlots: buildOverflowSlots(cards) });
    });
    return result;
  }, [jobs, getFinishTime, getBookingHours]);

  const todayKey = useMemo(() => isoDateKey(new Date()), []);
  const selectedKey = selectedDay ? isoDateKey(selectedDay) : null;

  // Month view: scroll so the selected day's row sits at the very top of the
  // board (today by default). Earlier days in the month remain above and are
  // reached by scrolling up. Re-runs whenever the day / month / view changes.
  useEffect(() => {
    if (isDayMode) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const row = vp.querySelector('[data-sched-selected="true"]');
    if (!row) return;
    const header = vp.querySelector(".appt-sched-header-row");
    const headerH = header ? header.offsetHeight : 0;
    vp.scrollTop = Math.max(0, row.offsetTop - headerH);
  }, [isDayMode, selectedKey, visibleDates]);

  const handleBookingClick = useCallback(
    (date, jobNumber) => {
      if (typeof onOpenDayJobs === "function") {
        onOpenDayJobs(new Date(date.getTime()), jobNumber);
      }
    },
    [onOpenDayJobs]
  );

  // Timeline grid template (the 37 time columns; the date column is a separate
  // sticky flex child so spanning bars only do column math within the axis).
  const timelineColumns = `repeat(${SLOT_COUNT}, minmax(0, 1fr))`;

  return (
    <>
      <div
        className="appt-sched-shell"
        data-presentation="appointments-scheduler"
        data-dev-section-key="appointments-scheduler"
        data-dev-section-parent="appointments-planner"
        data-dev-section-type="content-card"
        data-dev-background-token="surface"
        data-dev-text-preview="Workshop scheduler board"
      >
        {/* Scroll viewport — the whole 08:00–17:00 axis fits the card width (no
            horizontal scroll); vertical scroll reveals more day rows in month
            view. Date column + time header stay pinned. */}
        <div
          ref={viewportRef}
          className={`appt-sched-viewport ${isDayMode ? "appt-sched-viewport--day" : ""}`.trim()}
          data-dev-section-key="appointments-scheduler-viewport"
          data-dev-section-parent="appointments-scheduler"
          data-dev-section-type="section-shell"
          data-dev-background-token="theme"
          data-dev-text-preview="Scheduler time grid"
        >
          {/* Sticky time header row */}
          <div
            className="appt-sched-header-row"
            data-dev-section-key="appointments-scheduler-header"
            data-dev-section-parent="appointments-scheduler-viewport"
            data-dev-section-type="table-headings"
            data-dev-background-token="surface"
            data-dev-text-preview="Time axis 08:00–17:00"
          >
            <div className="appt-sched-corner" />
            <div className="appt-sched-head-track" style={{ gridTemplateColumns: timelineColumns }}>
              {SLOTS.map((label, i) => {
                const minutes = DAY_START_MIN + i * SLOT_MINUTES;
                const isHour = minutes % 60 === 0;
                // Label only the hour + half-hour columns so the axis stays
                // readable once it's fit to the card width (15-min columns still
                // exist for bar positioning, just unlabelled).
                const showLabel = minutes % 30 === 0;
                const edgeClass =
                  i === 0
                    ? " appt-sched-head-cell-first"
                    : i === SLOTS.length - 1
                    ? " appt-sched-head-cell-last"
                    : "";
                return (
                  <div
                    key={`head-${label}`}
                    className={`appt-sched-head-cell${isHour ? " appt-sched-head-cell-hour" : ""}${edgeClass}`}
                  >
                    {showLabel ? label : ""}
                  </div>
                );
              })}
            </div>
          </div>

          {/* One row per visible date */}
          {visibleDates.map((date) => {
            const dateKey = isoDateKey(date);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedKey;
            const isSaturday = date.getDay() === 6;
            const isWeekend = date.getDay() === 0 || isSaturday;
            const dayData = bookingsByDate.get(dateKey) || { cards: [], overflowSlots: [], laneCount: 1 };
            const visibleCards = dayData.cards.filter((c) => c.lane >= 0);
            const laneCount = dayData.laneCount || 1;
            const dayTechSummary =
              typeof getDayTechSummary === "function" ? getDayTechSummary(date) : null;
            const capacityHours = Number(dayTechSummary?.totalAvailableHours || 0);
            const daySummary = buildDaySummary({ cards: dayData.cards, capacityHours });

            const dateCellClasses = [
              "appt-sched-date-cell",
              isToday ? "appt-sched-date-today" : "",
              isSelected ? "appt-sched-date-selected" : "",
              isWeekend ? "appt-sched-date-weekend" : "",
              isSaturday ? "appt-sched-date-saturday" : "",
              `appt-sched-capacity-${daySummary.state}`,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                className="appt-sched-row"
                key={dateKey}
                data-sched-selected={isSelected ? "true" : undefined}
                data-dev-section-key={`appointments-sched-row-${dateKey}`}
                data-dev-section-parent="appointments-scheduler-viewport"
                data-dev-section-type="table-row"
                data-dev-background-token="theme"
                data-dev-text-preview={`Day row ${dateKey}`}
              >
                {/* Sticky date cell */}
                <div
                  className={dateCellClasses}
                  role="rowheader"
                  onClick={() => typeof onSelectDay === "function" && onSelectDay(new Date(date.getTime()))}
                  data-dev-section-key={`appointments-sched-date-${dateKey}`}
                  data-dev-section-parent={`appointments-sched-row-${dateKey}`}
                  data-dev-section-type="content-card"
                  data-dev-background-token="surface"
                  data-dev-text-preview={`Day summary ${dateKey}`}
                >
                  <div className="appt-sched-date-head">
                    <span className="appt-sched-date-weekday">
                      {date.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span className="appt-sched-date-day">
                      {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <div className="appt-sched-summary-grid" aria-label="Day capacity summary">
                    <div className="appt-sched-summary-cell">
                      <span>Jobs</span>
                      <strong>{daySummary.totalJobs}</strong>
                    </div>
                    <div className="appt-sched-summary-cell">
                      <span>Booked</span>
                      <strong>{formatSchedHours(daySummary.bookedHours)}h</strong>
                    </div>
                    <div className="appt-sched-summary-cell">
                      <span>Capacity</span>
                      <strong>{formatSchedHours(daySummary.capacityHours)}h</strong>
                    </div>
                    <div className="appt-sched-summary-cell">
                      <span>Utilisation</span>
                      <strong>{daySummary.utilisation}%</strong>
                    </div>
                  </div>
                  <div
                    className={`appt-sched-capacity-bar appt-sched-capacity-bar-${daySummary.state}`}
                    aria-label={`${daySummary.utilisation}% utilisation`}
                  >
                    <span style={{ width: `${daySummary.progress}%` }} />
                  </div>
                </div>

                {/* Timeline track — background grid lines + spanning booking bars */}
                <div
                  className={[
                    "appt-sched-timeline",
                    isToday ? "appt-sched-timeline-today" : "",
                    isSelected ? "appt-sched-timeline-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-dev-section-key={`appointments-sched-timeline-${dateKey}`}
                  data-dev-section-parent={`appointments-sched-row-${dateKey}`}
                  data-dev-section-type="section-shell"
                  data-dev-background-token="theme"
                  data-dev-text-preview={`Bookings timeline ${dateKey}`}
                  role="button"
                  tabIndex={0}
                  aria-label="View jobs for this day"
                  onClick={() => {
                    if (typeof onOpenDayJobs === "function") {
                      onOpenDayJobs(new Date(date.getTime()));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (typeof onOpenDayJobs === "function") {
                        onOpenDayJobs(new Date(date.getTime()));
                      }
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    gridTemplateColumns: timelineColumns,
                    gridTemplateRows: isDayMode
                      ? `repeat(${laneCount}, minmax(var(--sched-lane-h), 1fr))`
                      : `repeat(${laneCount}, var(--sched-lane-h))`,
                    ...(isDayMode ? { alignContent: "stretch", height: "100%" } : null),
                  }}
                >
                  {/* background separators (one per column, spanning all lanes) */}
                  {SLOTS.map((label, i) => {
                    const isHour = (DAY_START_MIN + i * SLOT_MINUTES) % 60 === 0;
                    return (
                      <div
                        key={`bg-${dateKey}-${label}`}
                        className={`appt-sched-bg-cell ${isHour ? "appt-sched-bg-cell-hour" : ""}`}
                        style={{ gridColumn: `${i + 1} / ${i + 2}`, gridRow: "1 / -1" }}
                      />
                    );
                  })}

                  {/* booking bars */}
                  {visibleCards.map((card) => {
                    const meta = SCHED_STATUS_META[card.statusKey] || SCHED_STATUS_META.waiting;
                    // Multi-line tooltip — one fact per line so the full job
                    // detail is easy to scan at a glance on hover.
                    const tooltip = [
                      `#${card.jobNumber}   ${card.reg}`,
                      card.customer,
                      `${card.time}${card.finish ? `–${card.finish}` : ""}   ${formatSchedHours(
                        card.estimatedHours
                      )}h`,
                      card.statusLabel,
                      card.items,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        className="appt-sched-bar"
                        style={{
                          gridColumn: `${card.startSlot + 1} / ${card.endSlot + 1}`,
                          gridRow: `${card.lane + 1} / ${card.lane + 2}`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookingClick(date, card.jobNumber);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleBookingClick(date, card.jobNumber);
                          }
                        }}
                        title={tooltip}
                      >
                        {/* single line: job · reg · customer · status (no time) */}
                        <span className="appt-sched-bar-line">
                          <span className="appt-sched-bar-job">#{card.jobNumber}</span>
                          <span className="appt-sched-bar-reg">{card.reg}</span>
                          <span className="appt-sched-bar-customer">{card.customer}</span>
                          <span
                            className="appt-sched-bar-status"
                            style={{ background: meta.pillBg }}
                          >
                            <span className="appt-sched-status-dot" style={{ background: meta.dot }} />
                            <span className="appt-sched-bar-status-label">{card.statusLabel}</span>
                          </span>
                        </span>
                      </div>
                    );
                  })}

                  {dayData.overflowSlots.map((slotOverflow) => {
                    const slotCards = slotOverflow.cards;
                    const overflowCount = slotCards.length;
                    // Jobs hidden behind the visible stack at this slot.
                    const hiddenCount = Math.max(1, overflowCount - MAX_VISIBLE_PER_SLOT);
                    const overflowSlot = slotOverflow.slotIndex;
                    // Rendered as a div (not <button>) so the global
                    // "html.staff-scope button:not(.app-btn)" rule can't hijack
                    // its colour / size — same reason the booking tiles are divs.
                    // Opens the day-jobs table popup (the single source of truth
                    // for "every job on this day"), same as clicking the row.
                    const openOverflow = (e) => {
                      e.stopPropagation();
                      if (typeof onOpenDayJobs === "function") {
                        onOpenDayJobs(new Date(date.getTime()));
                      }
                    };
                    return (
                      <div
                        key={`overflow-${dateKey}-${overflowSlot}`}
                        role="button"
                        tabIndex={0}
                        className="appt-sched-slot-overflow-btn"
                        style={{
                          gridColumn: `${overflowSlot + 1} / ${Math.min(overflowSlot + 3, SLOT_COUNT + 1)}`,
                          gridRow: "1 / -1",
                        }}
                        onClick={openOverflow}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openOverflow(e);
                          }
                        }}
                      >
                        +{hiddenCount} more
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduler styling. Self-contained (appt-sched-* prefix) so it never
          leaks into other pages. global keeps the dynamically-built class names
          (capacity state, status tint) reliable. */}
      <style jsx global>{`
        .appt-sched-shell {
          --sched-date-col: 236px;
          --sched-header-h: 46px;
          --sched-lane-h: 32px;
          --sched-row-min-h: 150px;
          /* Minimum board height (used as the floor). On the desktop locked-
             viewport layout the shell flex-grows to fill the whole page card;
             this clamp only kicks in when the parent has no definite height
             (e.g. tablet / auto-height contexts) so it never collapses. */
          --sched-viewport-h: clamp(380px, 56vh, 760px);

          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
          /* Fill the visible height of the appointments planner (the page card)
             below the booking toolbar, keeping its own internal scroll instead of
             scrolling the whole page. 273px ≈ topbar + page gutters + page-card
             padding + the 64px booking toolbar + stack gap. Floor at 380px on
             short screens. */
          flex: 0 0 auto;
          height: max(380px, calc(100dvh - 273px));
          border-radius: var(--radius-md);
          background: var(--surface);
          overflow: hidden;
        }

        /* Booking toolbar — responsive grid (search · date picker · view filter ·
           job number · time · book). display:grid is forced inline by
           LayerSurface; the column template + breakpoints live here so the row
           reflows on small screens. Job number / time / book are deliberately
           narrower so the calendar picker and filter share the single row. */
        .appt-booking-toolbar {
          grid-template-columns:
            minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)
            minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1.1fr);
        }
        @media (max-width: 1023px) {
          .appt-booking-toolbar {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .appt-booking-toolbar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .appt-sched-viewport {
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
          width: 100%;
          overflow-x: hidden;
          /* the day rows always scroll vertically inside the viewport card */
          overflow-y: auto;
          background: var(--theme);
          /* round the viewport card to match staffglobal section cards; clips the
             scrolled rows so the corners stay rounded as the user scrolls */
          border-radius: var(--section-card-radius);
          /* the whole 08:00–17:00 axis fits the card width — no horizontal scroll */
          overscroll-behavior: contain;
        }
        /* Day filter — the single selected-day row stretches to fill the board
           height; with the axis fit to width there is no scrolling at all. */
        .appt-sched-viewport--day {
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: hidden;
        }
        .appt-sched-viewport--day .appt-sched-header-row {
          flex: 0 0 auto;
        }
        .appt-sched-viewport--day .appt-sched-row {
          flex: 1 1 auto;
          min-height: 0;
        }

        .appt-sched-header-row {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          width: 100%;
          min-width: 0;
          /* Fully OPAQUE backstop so day rows scrolling up are hidden behind the
             sticky header instead of showing through it. --theme is only 10%
             opaque, so we stack it over the opaque --surface; the children then
             paint their 6% accent tint on top — giving the exact same colour as
             the date cells (6% accent → 10% theme → surface). */
          background:
            linear-gradient(var(--theme), var(--theme)),
            var(--surface);
        }
        .appt-sched-corner {
          position: sticky;
          left: 0;
          z-index: 2;
          flex: 0 0 var(--sched-date-col);
          width: var(--sched-date-col);
          height: var(--sched-header-h);
          /* header: 6% brand-red tint + 0.18 brand-red bottom hairline
             (matches the nextjobs board group header) */
          background: rgba(var(--accent-base-rgb), 0.06);
          box-shadow: inset -1px 0 0 var(--separating-line),
            inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.18);
        }
        .appt-sched-head-track {
          flex: 1 1 0;
          min-width: 0;
          display: grid;
          height: var(--sched-header-h);
          background: rgba(var(--accent-base-rgb), 0.06);
        }
        .appt-sched-head-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          height: var(--sched-header-h);
          padding: 0 2px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          /* match the nextjobs "Technicians" board header colour */
          color: var(--accent-strong);
          white-space: nowrap;
          /* let the sparse hour/half-hour labels spill into the blank quarter
             columns instead of clipping inside their own narrow cell */
          overflow: visible;
          box-shadow: inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.18);
        }
        .appt-sched-head-cell-first {
          justify-content: flex-start;
        }
        .appt-sched-head-cell-last {
          justify-content: flex-end;
        }
        .appt-sched-head-cell-hour {
          color: var(--accent-strong);
          box-shadow: inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.18),
            inset 1px 0 0 var(--separating-line);
        }

        .appt-sched-row {
          display: flex;
          width: 100%;
          min-width: 0;
        }
        .appt-sched-date-cell {
          position: sticky;
          left: 0;
          z-index: 1;
          flex: 0 0 var(--sched-date-col);
          width: var(--sched-date-col);
          min-height: var(--sched-row-min-h);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          /* date column: 6% brand-red tint + 0.18 brand-red bottom hairline */
          background: rgba(var(--accent-base-rgb), 0.06);
          cursor: pointer;
          box-shadow: inset -1px 0 0 var(--separating-line),
            inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.18);
          transition: background-color 0.15s ease;
        }
        .appt-sched-date-cell:hover {
          background: var(--theme-hover);
        }
        /* Title card — weekday chip + the date, baseline-aligned on one row */
        .appt-sched-date-head {
          display: flex;
          align-items: baseline;
          gap: 8px;
          width: 100%;
        }
        .appt-sched-date-weekday {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--surfaceTextMuted);
        }
        .appt-sched-date-day {
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
          /* match the nextjobs "Technicians" board header colour */
          color: var(--accent-strong);
          white-space: nowrap;
        }
        /* 2×2 summary grid — each metric stacks its label over its value */
        .appt-sched-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }
        .appt-sched-summary-cell {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .appt-sched-summary-cell span {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--surfaceTextMuted);
          white-space: nowrap;
        }
        .appt-sched-summary-cell strong {
          color: var(--text-1);
          font-size: 15px;
          font-weight: 800;
          line-height: 1.1;
          white-space: nowrap;
        }
        .appt-sched-capacity-bar {
          width: 100%;
          height: 7px;
          border-radius: var(--radius-pill);
          background: var(--theme);
          overflow: hidden;
        }
        .appt-sched-capacity-bar span {
          display: block;
          height: 100%;
          min-width: 3px;
          border-radius: inherit;
        }
        .appt-sched-capacity-bar-green span {
          background: var(--success);
        }
        .appt-sched-capacity-bar-amber span {
          background: var(--warning);
        }
        .appt-sched-capacity-bar-red span {
          background: var(--danger);
        }

        /* today / selected accents on the date column */
        .appt-sched-date-today {
          background: var(--success-surface);
        }
        .appt-sched-date-today .appt-sched-date-day {
          color: var(--success-dark);
        }
        .appt-sched-date-selected {
          background: rgba(var(--primary-rgb), 0.18);
        }
        .appt-sched-date-weekend .appt-sched-date-weekday {
          color: var(--warning);
        }
        /* Saturday is the only weekend day shown — flag its date in amber */
        .appt-sched-date-saturday .appt-sched-date-day {
          color: var(--warning);
        }
        .appt-sched-capacity-green .appt-sched-date-weekday {
          color: var(--success);
        }
        .appt-sched-capacity-amber .appt-sched-date-weekday {
          color: var(--warning);
        }
        .appt-sched-capacity-red .appt-sched-date-weekday {
          color: var(--danger);
        }

        .appt-sched-timeline {
          position: relative;
          flex: 1 1 0;
          min-width: 0;
          display: grid;
          min-height: var(--sched-row-min-h);
          align-content: start;
          /* 2px inset at the top of the row + a 2px gap between stacked tile
             lanes (the horizontal gap between tiles comes from the tile margin). */
          padding: 2px 0;
          row-gap: 2px;
          /* timeline rows: var(--theme) brand-red tint (10% light / 18% dark)
             + 0.14 brand-red bottom hairline (matches the nextjobs dropzone) */
          background: var(--theme);
          box-shadow: inset 0 -1px 0 rgba(var(--accent-base-rgb), 0.14);
        }
        .appt-sched-timeline-today {
          background: rgba(var(--success-rgb), 0.05);
        }
        .appt-sched-timeline-selected {
          background: rgba(var(--primary-rgb), 0.05);
        }

        /* background separators (one per time column, span all lanes) */
        .appt-sched-bg-cell {
          box-shadow: inset -1px 0 0 var(--separating-line),
            inset 0 -1px 0 var(--separating-line);
        }
        .appt-sched-bg-cell-hour {
          box-shadow: inset -1px 0 0 var(--separating-line),
            inset 0 -1px 0 var(--separating-line),
            inset 1px 0 0 rgba(var(--accent-base-rgb), 0.22);
        }

        /* Booking tile — mirrors the /job-cards/waiting/nextjobs job card:
           always --surface, radius-md, soft lift shadow, accent job number, an
           uppercase reg chip, and a tinted status pill on the right. */
        .appt-sched-bar {
          position: relative;
          z-index: 1;
          /* 32px lane — content packs onto one line; items that don't fit wrap to
             a (clipped) second row, so each chip is shown in full or hidden
             entirely rather than truncated mid-word. */
          display: flex;
          align-items: center;
          /* query container so the content can switch from centred (snug tile) to
             left-aligned (tile noticeably wider than the details) — see the
             @container rule below. */
          container-type: inline-size;
          /* vertical gaps come from the timeline (2px inset + row-gap); tiles
             only add a small horizontal gap so adjacent bookings don't touch. */
          margin: 0 3px;
          padding: 0 8px;
          border: none;
          border-radius: var(--radius-md);
          background: var(--surface);
          color: var(--text-1);
          font-size: 11px;
          line-height: 1.2;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
          transition: box-shadow 0.18s ease;
        }
        .appt-sched-bar:hover {
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
        }
        .appt-sched-bar-line {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          align-content: flex-start;
          /* Snug tile (fits 1–4 details with little spare): centre the chips.
             Once the tile is clearly wider than the details (see @container) the
             chips left-align instead. */
          justify-content: center;
          /* no row-gap: the 2nd (overflow) row butts straight against row 1 so
             max-height clips it away cleanly. */
          gap: 0 6px;
          min-width: 0;
          width: 100%;
          /* one row tall — anything that wraps below is clipped (fully hidden). */
          max-height: 16px;
          overflow: hidden;
        }
        /* Tile wider than the four details + ~one 15-min column (≈300px): the
           chips read left-to-right instead of floating centred. Narrower tiles
           keep the centred default above. */
        @container (min-width: 300px) {
          .appt-sched-bar-line {
            justify-content: flex-start;
          }
        }
        .appt-sched-status-dot {
          flex-shrink: 0;
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .appt-sched-bar-job {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 800;
          color: var(--accent-strong);
        }
        .appt-sched-bar-reg {
          flex-shrink: 0;
          padding: 1px 7px;
          border-radius: var(--radius-xs);
          background: rgba(var(--accent-base-rgb), 0.1);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--text-1);
        }
        /* status pill — packs inline; shown in full or wrapped away (hidden) */
        .appt-sched-bar-status {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          font-size: 10px;
          font-weight: 800;
          color: var(--text-1);
          white-space: nowrap;
        }
        .appt-sched-bar-status-label {
          white-space: nowrap;
        }
        .appt-sched-bar-customer {
          /* sized to its content so it shows in full or wraps away entirely —
             never truncated with an ellipsis */
          flex: 0 0 auto;
          white-space: nowrap;
          font-weight: 600;
          color: var(--text-1);
        }

        .appt-sched-slot-overflow-btn {
          z-index: 3;
          align-self: end;
          justify-self: stretch;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 2px;
          min-height: 28px;
          padding: 2px 6px;
          border: none;
          border-radius: var(--radius-pill);
          background: var(--surface);
          color: var(--accent-strong);
          font-size: 10px;
          font-weight: 700;
          text-align: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        }
        .appt-sched-slot-overflow-btn:hover {
          background: var(--primary);
          color: var(--surface);
        }

        /* Overflow modal */
        .appt-sched-modal-header {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin: 0 0 14px;
          font-size: 15px;
          font-weight: 700;
          color: var(--text-1);
        }
        .appt-sched-modal-header span {
          font-size: 12px;
          font-weight: 700;
          color: var(--surfaceTextMuted);
        }
        .appt-sched-modal-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 320px;
          overflow-y: auto;
          min-width: 300px;
        }
        .appt-sched-modal-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: start;
          gap: 5px 12px;
          padding: 9px 11px;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--section-card-bg);
          color: var(--text-1);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          width: 100%;
        }
        .appt-sched-modal-row:hover {
          background: var(--theme-hover);
        }
        .appt-sched-modal-time {
          grid-row: span 2;
          font-weight: 600;
          white-space: nowrap;
          color: var(--surfaceTextMuted);
        }
        .appt-sched-modal-main {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .appt-sched-modal-job {
          font-weight: 700;
          color: var(--accent-strong);
          white-space: nowrap;
        }
        .appt-sched-modal-reg {
          font-weight: 600;
          text-transform: uppercase;
        }
        .appt-sched-modal-details {
          grid-column: 2 / 3;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--surfaceTextMuted);
        }
        .appt-sched-modal-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          color: var(--surfaceTextMuted);
        }

        /* Tablet — tighter columns */
        @media (max-width: 1279px) {
          .appt-sched-shell {
            --sched-date-col: 208px;
          }
        }
        /* Phone — keep sticky date column + horizontal scroll, shrink cells */
        @media (max-width: 767px) {
          .appt-sched-shell {
            --sched-date-col: 184px;
            --sched-lane-h: 32px;
          }
          .appt-sched-date-cell {
            padding: 12px;
            gap: 10px;
          }
          .appt-sched-date-day {
            font-size: 18px;
          }
          .appt-sched-summary-grid {
            gap: 6px;
          }
          .appt-sched-summary-cell strong {
            font-size: 13px;
          }
          .appt-sched-head-cell {
            font-size: 11px;
          }
          .appt-sched-bar {
            padding: 0 7px;
          }
          .appt-sched-bar-line {
            gap: 0 4px;
          }
          .appt-sched-modal-row {
            grid-template-columns: 1fr;
          }
          .appt-sched-modal-time,
          .appt-sched-modal-details {
            grid-column: auto;
          }
        }

        /* ───────────────────────────────────────────────────────────────
           Defeat the global reset. staffglobal.css has
           "html.staff-scope * { margin: 0; padding: 0 }" (specificity 0,1,1),
           which outranks the plain .appt-sched-* class rules above (0,1,0) and
           silently zeroes every padding/margin we set — so tile padding, the
           date-cell text gap, reg/status pills etc. never render. Re-assert
           them here scoped under html.staff-scope (0,2,1) so they win. Keep
           the values in sync with the base rules above.
           ─────────────────────────────────────────────────────────────── */
        html.staff-scope .appt-sched-head-cell { padding: 0 2px; }
        html.staff-scope .appt-sched-date-cell { padding: 16px; }
        html.staff-scope .appt-sched-timeline { padding: 3px 0; }
        html.staff-scope .appt-sched-bar { margin: 0 3px; padding: 0 8px; }
        html.staff-scope .appt-sched-bar-reg { padding: 1px 7px; }
        html.staff-scope .appt-sched-bar-status { padding: 2px 8px; }
        html.staff-scope .appt-sched-slot-overflow-btn { margin: 2px; padding: 2px 6px; }
        html.staff-scope .appt-sched-modal-header { margin: 0 0 14px; }
        html.staff-scope .appt-sched-modal-row { padding: 9px 11px; }
        @media (max-width: 767px) {
          html.staff-scope .appt-sched-date-cell { padding: 12px; }
          html.staff-scope .appt-sched-bar { padding: 0 7px; }
        }
      `}</style>
    </>
  );
}

// ===========================================================================
// Page presentation
// ===========================================================================
export default function AppointmentsUi(props) {
  const {
    DropdownField,
    SearchBar,
    checkingInJobId,
    currentNote,
    formatDate,
    formatDateNoYear,
    getCustomerStatusBadgeColors,
    getDetectedJobTypeLabels,
    getEstimatedFinishTime,
    getJobGroupBadge,
    getJobTypeBadgeStyle,
    getVehicleDisplay,
    handleAddAppointment,
    handleCheckIn,
    handleJobNumberInputChange,
    handleJobRowClick,
    handleJobRowHover,
    handleSelectScheduleDate,
    handleOpenDayJobs,
    showDayJobsPopup,
    setShowDayJobsPopup,
    highlightJob,
    isCompactMobile,
    isJobActuallyCheckedIn,
    isLoading,
    jobNumber,
    jobsLoading,
    saveNote,
    schedulerGetFinish,
    schedulerJobs,
    schedulerGetBookingHours,
    getDayTechSummary,
    scheduleViewMode,
    setScheduleViewMode,
    searchQuery,
    selectedDay,
    setCurrentNote,
    setSearchQuery,
    setSelectedDay,
    setShowNotePopup,
    setShowStaffOffPopup,
    setTime,
    showNotePopup,
    showStaffOffPopup,
    sortedJobs,
    staffOffPopupDate,
    staffOffPopupDetails,
    time,
    timeSlots
  } = props; // receive page logic props.

  const dayJobsTableRef = useRef(null);

  // A scheduler booking opens the day-jobs popup with its matching row briefly
  // highlighted. Once the modal is mounted, center that row in the scroll area
  // so the clicked booking stays visible even on a busy day.
  useEffect(() => {
    if (!showDayJobsPopup || !highlightJob || !dayJobsTableRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const targetJobNumber = String(highlightJob);
      const targetRow = Array.from(dayJobsTableRef.current?.querySelectorAll("tr[data-job-number]") || [])
        .find((row) => row.dataset.jobNumber === targetJobNumber);
      targetRow?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightJob, showDayJobsPopup, sortedJobs]);

  switch (props.view) {// choose the page section requested by logic.
    case "section1":
      return (
        <div
          className="app-page-stack"
          data-presentation="appointments-planner"
          data-dev-section-key="appointments-planner"
          data-dev-section-parent="app-layout-page-card"
          data-dev-section-type="page-shell"
          data-dev-background-token="transparent"
          data-dev-text-preview="Appointments planner"
          style={{ height: "100%" }}
        >
          {/* Booking toolbar — search · calendar date picker · view filter
              (month/day) · job number · time · Book button. The date picker
              (defaults to today) drives the scheduler window, the day-jobs table
              and the booking date; the filter switches the board between the
              whole month and the single chosen day. */}
          <LayerSurface
            as="div"
            className="appt-booking-toolbar"
            sectionKey="appointments-booking-toolbar"
            parentKey="appointments-planner"
            sectionType="toolbar"
            backgroundToken="surface"
            data-presentation="appointments-booking-toolbar"
            data-dev-text-preview="Search, date, job number, time, book appointment"
            style={{
              display: "grid",
              gap: "10px",
              padding: "10px",
              alignItems: "center",
              // overflow visible so the .calendar-api popup can drop below the row
              overflow: "visible",
              boxShadow: "none"
            }}>
            <div style={{
                minWidth: 0
              }}>
              <SearchBar value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onClear={() => setSearchQuery("")} placeholder="Search by Job #, Name, Reg, or Vehicle..." disabled={isLoading} />
            </div>
            <CalendarField value={isoDateKey(selectedDay)} onChange={(e) => handleSelectScheduleDate(e.target.value)} disabled={isLoading} placeholder="Select date" aria-label="Appointment date" />
            <DropdownField value={scheduleViewMode} onChange={(e) => setScheduleViewMode(e.target.value)} disabled={isLoading} placeholder="View" aria-label="Scheduler view filter" title="Show the chosen day or its whole month">
              <option value="month">Month view</option>
              <option value="day">Day view</option>
            </DropdownField>
            <input type="text" value={jobNumber} onChange={handleJobNumberInputChange} placeholder="Job Number" disabled={isLoading} />
            <DropdownField value={time} onChange={(e) => setTime(e.target.value)} disabled={isLoading} placeholder="Select time">
              {timeSlots.map((slot) => <option key={slot} value={slot}>
                  {slot}
                </option>)}
            </DropdownField>
            <Button onClick={() => handleAddAppointment(isoDateKey(selectedDay))} busy={isLoading} style={{ width: "100%" }}>
              {isLoading ? "Booking..." : "Book Appointment"}
            </Button>
          </LayerSurface>

          {/* Workshop Scheduler — inlined CSS-Grid planning board (replaces the
              former availability table). Self-contained appt-sched-* styling. */}
          <SchedulerBoard
            jobs={schedulerJobs}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onOpenDayJobs={handleOpenDayJobs}
            getFinishTime={schedulerGetFinish}
            getBookingHours={schedulerGetBookingHours}
            getDayTechSummary={getDayTechSummary}
            viewMode={scheduleViewMode}
          />

          {/* Day Jobs popup — opened by clicking a scheduler day's time column.
              Replaces the former always-visible appointments-day-jobs section;
              shows that day's jobs in the same table/list layout. */}
          {/* Day-jobs popup uses the shared staffglobal PopupModal directly (not
              the <Popup> wrapper) so its full-cover 9999 backdrop sits above the
              3300 topbar — hiding the topbar while open — and so we can place the
              Close button top-right instead of a forced bottom button. */}
          <PopupModal
            isOpen={showDayJobsPopup}
            onClose={() => setShowDayJobsPopup(false)}
            ariaLabel="Jobs for the selected day"
            cardStyle={{
              width: "min(1100px, 94vw)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            <div
              data-presentation="appointments-day-jobs"
              data-dev-section-key="appointments-day-jobs"
              data-dev-section-parent="appointments-planner"
              data-dev-section-type="content-card"
              data-dev-background-token="surface"
              data-dev-text-preview="Jobs for the selected day"
              style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            {jobsLoading && <SkeletonKeyframes />}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px"
              }}>
              <h3 style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "600"
                }}>
                Jobs for <span style={{
                    color: "var(--primary)"
                  }}>{formatDateNoYear(selectedDay)}</span>
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "var(--text-1)"
                  }}>
                  {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
                </span>
                {/* Close — top-right of the popup */}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDayJobsPopup(false)}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* ✅ Enhanced Jobs Table — caps at ~10 rows, then scrolls vertically.
                ~10 × 49px row + the sticky header ≈ 540px. */}
            <div style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "min(64vh, 540px)",
                borderRadius: "var(--radius-md)",
                background: "var(--theme)"
              }}>
              <table ref={dayJobsTableRef} className="app-data-table app-data-table--rounded" data-dev-section-key="appointments-day-jobs-table" data-dev-section-parent="appointments-day-jobs" data-dev-section-type="data-table" style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: "13px",
                  backgroundColor: "transparent"
                }}>
                <thead data-dev-section-key="appointments-day-jobs-table-headings" data-dev-section-type="table-headings" data-dev-section-parent="appointments-day-jobs-table" style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    // Opaque sticky header: --theme-hover is translucent, so on its own the
                    // scrolling rows show through. Composite the tint over opaque --surface
                    // so the rows stop cleanly at the header and never read through it.
                    background: "linear-gradient(var(--theme-hover), var(--theme-hover)), var(--surface)"
                  }}>
                  <tr>
                  {["Time", "Job #", "Reg", "Vehicle", "Customer", "Job Type", "Customer Status", "EST Time", "Check-In"].map((head) => <th key={head} style={{
                        textAlign: head === "Check-In" ? "center" : "left",
                        padding: "12px 14px",
                        // Same opaque tint-over-surface stack as the thead above.
                        background: "linear-gradient(var(--theme-hover), var(--theme-hover)), var(--surface)",
                        color: "var(--text-1)",
                        fontWeight: "700",
                        fontSize: "11px",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        borderBottom: "var(--separating-line)",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        whiteSpace: "nowrap"
                      }}>
                        {head}
                      </th>)}
                  </tr>
                </thead>
                <tbody data-dev-section-key="appointments-day-jobs-table-rows" data-dev-section-type="table-rows" data-dev-section-parent="appointments-day-jobs-table">
                  {jobsLoading && sortedJobs.length === 0 ? Array.from({
                      length: 5
                    }).map((_, skeletonRow) => <tr key={`appt-skeleton-${skeletonRow}`} style={{
                      backgroundColor: skeletonRow % 2 === 0 ? "var(--section-card-bg)" : "rgba(var(--accent-base-rgb), 0.035)"
                    }}>
                      {Array.from({
                          length: 9
                        }).map((__, skeletonCol) => <td key={skeletonCol} style={{
                          padding: "12px 14px",
                          borderBottom: "var(--separating-line)",
                          textAlign: skeletonCol === 8 ? "center" : "left"
                        }}>
                          <SkeletonBlock width={skeletonCol === 3 || skeletonCol === 4 ? "85%" : skeletonCol === 8 ? "92px" : "62%"} height="14px" style={skeletonCol === 8 ? {
                            margin: "0 auto"
                          } : undefined} />
                        </td>)}
                    </tr>) : sortedJobs.length > 0 ? sortedJobs.map((job, idx) => {
                      const isCheckedIn = isJobActuallyCheckedIn(job);
                      const isCurrentlyCheckingIn = checkingInJobId === job.id;
                      const isHighlighted = String(highlightJob) === String(job.jobNumber || job.id);
                      const cellBorder = "var(--separating-line)";
                      const rowBackground = isHighlighted ? "var(--success-surface)" : idx % 2 === 0 ? "var(--section-card-bg)" : "rgba(var(--accent-base-rgb), 0.035)";
                      return <tr key={idx} data-job-number={String(job.jobNumber || job.id)} style={{
                        backgroundColor: rowBackground,
                        transition: "background-color 0.2s ease"
                      }} onMouseEnter={(e) => {
                        if (!isHighlighted) {
                          e.currentTarget.style.backgroundColor = "var(--theme-hover)";
                        }
                      }} onMouseLeave={(e) => {
                        if (!isHighlighted) {
                          e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--section-card-bg)" : "rgba(var(--accent-base-rgb), 0.035)";
                        }
                      }}>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder,
                          fontWeight: "700",
                          whiteSpace: "nowrap"
                        }}>
                            {job.appointment?.time || "-"}
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder,
                          color: "var(--primary)",
                          fontWeight: "700"
                        }}>
                            <button type="button" className="app-table-action-btn app-table-action-btn--primary" onClick={() => handleJobRowClick(job.jobNumber || job.id)} onMouseEnter={() => handleJobRowHover(job.jobNumber || job.id)} style={{ gap: "6px" }}>
                              <span>{job.jobNumber || job.id || "-"}</span>
                              {(() => {
                              const badge = getJobGroupBadge(job);
                              if (!badge) return null;
                              return <span style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "var(--radius-xs)",
                                backgroundColor: "var(--theme)",
                                color: "var(--accent-strong)",
                                fontWeight: "700",
                                whiteSpace: "nowrap"
                              }} title={job.isPrimeJob ? `Host job (${badge} job cards)` : `Job ${badge} — linked to host #${job.primeJobNumber}`}>
                                    {badge} Job Cards
                                  </span>;
                            })()}
                            </button>
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder,
                          fontWeight: "600",
                          whiteSpace: "nowrap"
                        }}>
                            {job.reg || "-"}
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder
                        }}>
                            {getVehicleDisplay(job)}
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder
                        }}>
                            {job.customer || "-"}
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder
                        }}>
                            <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                            maxHeight: "52px",
                            overflowY: "auto"
                          }}>
                              {Array.from(getDetectedJobTypeLabels(job)).filter(Boolean).map((label) => <span key={label} style={{
                              ...getJobTypeBadgeStyle(label),
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "6px 12px",
                              borderRadius: "var(--radius-xs)",
                              border: "none",
                              fontWeight: "700"
                            }}>
                                  {label}
                                </span>)}
                            </div>
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder
                        }}>
                            <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 12px",
                            borderRadius: "var(--radius-xs)",
                            border: "none",
                            fontSize: "11px",
                            fontWeight: "700",
                            ...getCustomerStatusBadgeColors(job.waitingStatus || "Neither")
                          }}>
                              {job.waitingStatus || "Neither"}
                            </span>
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder,
                          fontWeight: "700",
                          whiteSpace: "nowrap"
                        }}>
                            {getEstimatedFinishTime(job)}
                          </td>
                          <td style={{
                          padding: "12px 14px",
                          borderBottom: cellBorder,
                          textAlign: "center"
                        }}>
                            {isCheckedIn ? <span className="app-badge app-badge--success" style={{
                            minWidth: isCompactMobile ? "90px" : "110px",
                            justifyContent: "center"
                          }}>
                                {isCompactMobile ? "Checked In" : "✓ Checked In"}
                              </span> : <button onClick={(event) => {
                            event.stopPropagation();
                            handleCheckIn(job);
                          }} disabled={isCurrentlyCheckingIn} className="app-table-action-btn app-table-action-btn--primary" style={{
                            minWidth: isCompactMobile ? "90px" : "110px",
                          }}>
                                {isCurrentlyCheckingIn ? "Checking In..." : "Check In"}
                              </button>}
                          </td>
                        </tr>;
                    }) : <tr>
                      <td colSpan="9" style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "var(--grey-accent-light)",
                        fontSize: "14px",
                        background: "var(--section-card-bg)"
                      }}>
                        No appointments booked for this day
                      </td>
                    </tr>}
                </tbody>
              </table>
            </div>
            </div>
          </PopupModal>

          {/* Add Note Popup */}
          <PopupModal
            isOpen={showNotePopup}
            onClose={() => setShowNotePopup(false)}
            ariaLabel="Add appointment note"
            cardStyle={{ width: "min(100%, 440px)", padding: "var(--section-card-padding)" }}
          >
            <h3 style={{
                marginTop: 0,
                marginBottom: "16px",
                fontSize: "20px",
                fontWeight: "600"
              }}>
              Add Note for {formatDateNoYear(selectedDay)}
            </h3>
            <textarea style={{ height: "120px", resize: "vertical" }} value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} placeholder="Enter notes about this day's schedule..." />
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "16px",
                gap: "10px"
              }}>
              <Button onClick={saveNote} style={{ flex: 1 }}>
                Save Note
              </Button>
              <Button variant="secondary" onClick={() => setShowNotePopup(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
            </div>
          </PopupModal>

          {/* Staff Off Popup */}
          <PopupModal
            isOpen={showStaffOffPopup}
            onClose={() => setShowStaffOffPopup(false)}
            ariaLabel="Staff absences"
            cardStyle={{ width: "min(100%, 320px)", padding: "var(--section-card-padding)" }}
          >
            <div style={{
                width: "100%"
              }}>
            {/* Header */}
            <div style={{
                  marginBottom: "18px",
                  paddingBottom: "14px"
                }}>
              <h3 style={{
                    margin: "0 0 8px",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "var(--text-1)"
                  }}>
                Staff Off
              </h3>
              <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--theme)",
                    color: "var(--accent-strong)",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                {formatDate(staffOffPopupDate || selectedDay)}
              </span>
            </div>

            {/* Entry list */}
            {staffOffPopupDetails.length > 0 ? <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "calc(5 * 58px)",
                  overflowY: "auto"
                }}>
                {staffOffPopupDetails.map((entry, index) => {
                    const typeLower = (entry.type || "").toLowerCase();
                    const typeColor = typeLower.includes("sick") ? {
                      bg: "var(--warning-surface)",
                      text: "var(--warning)"
                    } : typeLower.includes("holiday") || typeLower.includes("annual") ? {
                      bg: "var(--success-surface)",
                      text: "var(--success-dark)"
                    } : {
                      bg: "var(--theme)",
                      text: "var(--text-1)"
                    };
                    const initial = (entry.name || "?").charAt(0).toUpperCase();
                    return <div key={`${entry.id}-${index}`} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--section-card-bg)"
                    }}>
                      {/* Avatar initial */}
                      <div style={{
                        flexShrink: 0,
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "var(--theme)",
                        color: "var(--accent-strong)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "14px"
                      }}>
                        {initial}
                      </div>

                      {/* Name + role */}
                      <div style={{
                        flex: 1,
                        minWidth: 0
                      }}>
                        <div style={{
                          fontWeight: "600",
                          fontSize: "14px",
                          color: "var(--text-1)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {entry.name}
                        </div>
                        <div style={{
                          fontSize: "11px",
                          color: "var(--text-1)",
                          marginTop: "2px"
                        }}>
                          {entry.role}
                        </div>
                      </div>

                      {/* Type badge + hours */}
                      <div style={{
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "4px"
                      }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: "var(--radius-pill)",
                          background: typeColor.bg,
                          color: typeColor.text,
                          fontSize: "11px",
                          fontWeight: "700",
                          whiteSpace: "nowrap"
                        }}>
                          {entry.type || "Holiday"}
                        </span>
                        {entry.unavailableHours != null && <span style={{
                          fontSize: "11px",
                          color: "var(--text-1)"
                        }}>
                            {entry.unavailableHours}h off
                          </span>}
                      </div>
                    </div>;
                  })}
              </div> : <div style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--text-1)",
                  fontSize: "13px"
                }}>
                <div style={{
                    fontSize: "20px",
                    marginBottom: "8px",
                    color: "var(--grey-accent-light)",
                    fontWeight: "300"
                  }}>—</div>
                No approved absences for this day
              </div>}
              <Button variant="secondary" onClick={() => setShowStaffOffPopup(false)} style={{ width: "100%", marginTop: "var(--layout-card-gap)" }}>
                Close
              </Button>
            </div>
          </PopupModal>
        </div>
      ); // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
