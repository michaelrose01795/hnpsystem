// file location: src/components/Appointments/SchedulerBoard.js
// One-off workshop scheduling board that replaces the old availability table on
// the /appointments page. Built on CSS Grid (NOT HTML tables) and deliberately
// kept independent of the staffglobal.css table system. Each row is a date; the
// time axis runs 08:00–17:00 in 15-min columns. Bookings render as timeline
// BARS that span from their start time to their estimated finish time, stacked
// into lanes so overlapping bookings stay readable.
import React, { useMemo, useState, useCallback } from "react";
import Popup from "@/components/popups/Popup";
import styles from "./SchedulerBoard.module.css";

// ---------------- Time axis (08:00 → 17:00, every 15 minutes) ----------------
const DAY_START_MIN = 8 * 60; // 08:00
const DAY_END_MIN = 17 * 60; // 17:00
const SLOT_MINUTES = 15;
const SLOT_COUNT = (DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES + 1; // 37 columns
const VISIBLE_DAYS = 9; // days shown in the window at once
const MAX_LANES = 4; // stacked timeline lanes before bookings overflow to "+more"
const MIN_BAR_SLOTS = 3; // guarantee a bar is wide enough to show #job + reg
const DEFAULT_BAR_SLOTS = 4; // fallback span (1h) when no finish time is known

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
const STATUS_META = {
  waiting: { label: "Waiting", className: styles.statusWaiting, dot: "var(--warning)" },
  progress: { label: "In Progress", className: styles.statusProgress, dot: "#3b82f6" }, // soft blue (no blue token in theme)
  complete: { label: "Completed", className: styles.statusComplete, dot: "var(--success)" },
  cancelled: { label: "Cancelled", className: styles.statusCancelled, dot: "var(--danger)" },
};

const deriveStatusKey = (job) => {
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

// Greedy interval-lane assignment: place each booking (sorted by start) in the
// first lane whose previous bar has already ended. Returns the lane index, or
// -1 once MAX_LANES is exceeded (caller treats that as overflow).
const assignLanes = (bookings) => {
  const laneEnds = []; // laneEnds[i] = endSlot of last bar placed in lane i
  bookings.forEach((b) => {
    let placed = false;
    for (let lane = 0; lane < laneEnds.length; lane += 1) {
      if (b.startSlot >= laneEnds[lane]) {
        laneEnds[lane] = b.endSlot;
        b.lane = lane;
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (laneEnds.length < MAX_LANES) {
        b.lane = laneEnds.length;
        laneEnds.push(b.endSlot);
      } else {
        b.lane = -1; // overflow
      }
    }
  });
  return Math.min(laneEnds.length, MAX_LANES);
};

export default function SchedulerBoard({ jobs = [], selectedDay, onSelectDay, onOpenJob, getFinishTime }) {
  // Anchor date for the visible window — defaults to today.
  const [anchor, setAnchor] = useState(() => toMidnight(new Date()) || new Date());

  // The nine visible day rows starting from the anchor (weekends included).
  const visibleDates = useMemo(() => {
    const base = toMidnight(anchor) || new Date();
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => new Date(base.getTime() + i * ONE_DAY_MS));
  }, [anchor]);

  // Group bookings by date key. Each booking carries its start slot and the
  // span (start → ETA finish) so it can render as a timeline bar. Computed once
  // per jobs change so 1000+ bookings stay cheap.
  const bookingsByDate = useMemo(() => {
    const map = new Map();
    (jobs || []).forEach((job) => {
      const date = job?.appointment?.date;
      const time = job?.appointment?.time;
      if (!date || !time) return;
      const startSlot = timeToSlotIndex(time);
      if (startSlot === null) return;

      // ETA finish → end slot. Fall back to a default span when unknown.
      let endSlot = null;
      const finish = typeof getFinishTime === "function" ? getFinishTime(job) : null;
      const finishIndex = timeToSlotIndex(finish);
      if (finishIndex !== null && finishIndex > startSlot) endSlot = finishIndex;
      if (endSlot === null) endSlot = startSlot + DEFAULT_BAR_SLOTS;
      // Enforce a minimum width so #job + reg always fit, and clamp to the axis.
      endSlot = Math.min(Math.max(endSlot, startSlot + MIN_BAR_SLOTS), SLOT_COUNT);

      const dateKey = date.length > 10 ? isoDateKey(date) : date;
      const card = {
        id: job.id ?? `${job.jobNumber}-${time}`,
        jobNumber: job.jobNumber || job.id || "—",
        reg: job.reg || job.vehicleReg || "—",
        time,
        finish: finish && finish !== "-" ? finish : null,
        statusKey: deriveStatusKey(job),
        startSlot,
        endSlot,
        lane: 0,
      };
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(card);
    });

    // Sort each day's bookings by start time and assign lanes.
    const result = new Map();
    map.forEach((cards, key) => {
      cards.sort((a, b) => a.startSlot - b.startSlot || a.endSlot - b.endSlot);
      const laneCount = assignLanes(cards);
      result.set(key, { cards, laneCount });
    });
    return result;
  }, [jobs, getFinishTime]);

  // Overflow modal state: { dateLabel, bookings } | null
  const [overflow, setOverflow] = useState(null);

  const todayKey = useMemo(() => isoDateKey(new Date()), []);
  const selectedKey = selectedDay ? isoDateKey(selectedDay) : null;

  const moveWindow = useCallback((deltaDays) => {
    setAnchor((prev) => {
      const base = toMidnight(prev) || new Date();
      return new Date(base.getTime() + deltaDays * ONE_DAY_MS);
    });
  }, []);

  const goToday = useCallback(() => {
    setAnchor(toMidnight(new Date()) || new Date());
  }, []);

  const handleBookingClick = useCallback(
    (jobNumber) => {
      if (typeof onOpenJob === "function") onOpenJob(jobNumber);
    },
    [onOpenJob]
  );

  const rangeLabel = useMemo(() => {
    if (!visibleDates.length) return "";
    const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(visibleDates[0])} – ${fmt(visibleDates[visibleDates.length - 1])}`;
  }, [visibleDates]);

  // Timeline grid template (the 37 time columns; the date column is a separate
  // sticky flex child so spanning bars only do column math within the axis).
  const timelineColumns = `repeat(${SLOT_COUNT}, var(--sched-slot-col))`;

  return (
    <div
      className={styles.shell}
      data-presentation="appointments-scheduler"
      data-dev-section-key="appointments-scheduler"
      data-dev-section-type="content-card"
    >
      {/* Toolbar — window range + navigation */}
      <div className={styles.toolbar}>
        <div>
          <h3 className={styles.toolbarTitle}>Workshop Scheduler</h3>
          <span className={styles.toolbarRange}>{rangeLabel}</span>
        </div>
        <div className={styles.navGroup}>
          <button type="button" className={styles.navBtn} onClick={() => moveWindow(-VISIBLE_DAYS)}>
            ‹ Previous
          </button>
          <button type="button" className={`${styles.navBtn} ${styles.navBtnPrimary}`} onClick={goToday}>
            Today
          </button>
          <button type="button" className={styles.navBtn} onClick={() => moveWindow(VISIBLE_DAYS)}>
            Next ›
          </button>
        </div>
      </div>

      {/* Single scroll viewport — horizontal scroll reveals later time slots,
          vertical scroll reveals more rows; date column + time header stay
          pinned. All scrolling is contained here (no page-level scrollbar). */}
      <div className={styles.viewport}>
        {/* Sticky time header row */}
        <div className={styles.headerRow}>
          <div className={styles.corner} />
          <div className={styles.headTrack} style={{ gridTemplateColumns: timelineColumns }}>
            {SLOTS.map((label, i) => {
              const isHour = (DAY_START_MIN + i * SLOT_MINUTES) % 60 === 0;
              return (
                <div
                  key={`head-${label}`}
                  className={`${styles.headCell} ${isHour ? styles.headCellHour : ""}`}
                >
                  {label}
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
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const dayData = bookingsByDate.get(dateKey) || { cards: [], laneCount: 0 };
          const visibleCards = dayData.cards.filter((c) => c.lane >= 0);
          const overflowCount = dayData.cards.length - visibleCards.length;
          const lanes = Math.max(dayData.laneCount, 1);

          const dateCellClasses = [
            styles.dateCell,
            isToday ? styles.dateToday : "",
            isSelected ? styles.dateSelected : "",
            isWeekend ? styles.dateWeekend : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div className={styles.row} key={dateKey}>
              {/* Sticky date cell */}
              <div
                className={dateCellClasses}
                role="rowheader"
                onClick={() => typeof onSelectDay === "function" && onSelectDay(new Date(date.getTime()))}
              >
                <span className={styles.dateWeekday}>
                  {date.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span className={styles.dateDay}>
                  {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                <span className={styles.dateCount}>
                  {dayData.cards.length > 0
                    ? `${dayData.cards.length} booking${dayData.cards.length !== 1 ? "s" : ""}`
                    : "—"}
                </span>
                {overflowCount > 0 && (
                  <button
                    type="button"
                    className={styles.moreBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverflow({
                        dateLabel: date.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        }),
                        bookings: dayData.cards,
                      });
                    }}
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>

              {/* Timeline track — background grid lines + spanning booking bars */}
              <div
                className={[
                  styles.timeline,
                  isToday ? styles.timelineToday : "",
                  isSelected ? styles.timelineSelected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  gridTemplateColumns: timelineColumns,
                  gridTemplateRows: `repeat(${lanes}, var(--sched-lane-h))`,
                }}
              >
                {/* background separators (one per column, spanning all lanes) */}
                {SLOTS.map((label, i) => {
                  const isHour = (DAY_START_MIN + i * SLOT_MINUTES) % 60 === 0;
                  return (
                    <div
                      key={`bg-${dateKey}-${label}`}
                      className={`${styles.bgCell} ${isHour ? styles.bgCellHour : ""}`}
                      style={{ gridColumn: `${i + 1} / ${i + 2}`, gridRow: "1 / -1" }}
                    />
                  );
                })}

                {/* booking bars */}
                {visibleCards.map((card) => {
                  const meta = STATUS_META[card.statusKey] || STATUS_META.waiting;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`${styles.bar} ${meta.className}`}
                      style={{
                        gridColumn: `${card.startSlot + 1} / ${card.endSlot + 1}`,
                        gridRow: `${card.lane + 1} / ${card.lane + 2}`,
                      }}
                      onClick={() => handleBookingClick(card.jobNumber)}
                      title={`#${card.jobNumber} · ${card.reg} · ${meta.label}${
                        card.finish ? ` · ${card.time}–${card.finish}` : ""
                      }`}
                    >
                      <span className={styles.statusDot} style={{ background: meta.dot }} />
                      <span className={styles.barJob}>#{card.jobNumber}</span>
                      <span className={styles.barReg}>{card.reg}</span>
                      <span className={styles.barStatus}>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overflow popup — every booking for the clicked day */}
      <Popup isOpen={!!overflow} onClose={() => setOverflow(null)}>
        {overflow && (
          <>
            <h3 className={styles.modalHeader}>{overflow.dateLabel}</h3>
            <div className={styles.modalList}>
              {overflow.bookings.map((card) => {
                const meta = STATUS_META[card.statusKey] || STATUS_META.waiting;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={styles.modalRow}
                    onClick={() => {
                      setOverflow(null);
                      handleBookingClick(card.jobNumber);
                    }}
                  >
                    <span className={styles.modalTime}>
                      {card.time}
                      {card.finish ? `–${card.finish}` : ""}
                    </span>
                    <span className={styles.modalJob}>#{card.jobNumber}</span>
                    <span className={styles.modalReg}>{card.reg}</span>
                    <span className={styles.modalStatus}>
                      <span className={styles.statusDot} style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Popup>
    </div>
  );
}
