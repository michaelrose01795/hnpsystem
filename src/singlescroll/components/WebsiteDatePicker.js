// file location: src/singlescroll/components/WebsiteDatePicker.js
// Custom <input type="date"> replacement for /website pages. The
// native control opens an OS-themed calendar popover that we can't
// style; this component shows a styled trigger that opens a calendar
// grid built from our own CSS module so the picker matches the rest
// of the portal.
//
// Value is an ISO date string (YYYY-MM-DD) — same shape <input
// type="date"> uses, so callers don't have to change anything else.

import { useEffect, useRef, useState } from "react";
import styles from "../styles/singlescroll.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n) => String(n).padStart(2, "0");
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};
const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

const buildGrid = (cursor) => {
  // Six rows × seven cols starting from the Monday on/before the 1st.
  const first = startOfMonth(cursor);
  // JS getDay: 0=Sun…6=Sat. We want Monday-first, so shift.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

export default function WebsiteDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className = "",
  min,
  max,
  name,
  required,
}) {
  const selected = fromIso(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(selected || new Date());
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current || rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (selected) setCursor(selected);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = buildGrid(cursor);
  const minD = fromIso(min);
  const maxD = fromIso(max);

  const isDisabled = (d) => {
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  };

  const labelText = selected
    ? selected.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : placeholder;

  return (
    <div ref={rootRef} className={styles.wsRoot} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={`app-btn ${styles.wsTrigger} ${className}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selected ? styles.wsTriggerValue : styles.wsTriggerPlaceholder}>
          {labelText}
        </span>
        <span className={styles.wsCalIcon} aria-hidden="true" />
      </button>
      {required ? (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value ?? ""}
          onChange={() => {}}
          name={name}
          style={{
            position: "absolute",
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {open ? (
        <div className={styles.wsCalPanel} role="dialog" aria-label="Choose a date">
          <div className={styles.wsCalHeader}>
            <button
              type="button"
              className={styles.wsCalNav}
              onClick={() => {
                const next = new Date(cursor);
                next.setMonth(cursor.getMonth() - 1);
                setCursor(next);
              }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className={styles.wsCalTitle}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button
              type="button"
              className={styles.wsCalNav}
              onClick={() => {
                const next = new Date(cursor);
                next.setMonth(cursor.getMonth() + 1);
                setCursor(next);
              }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className={styles.wsCalWeekdays}>
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className={styles.wsCalGrid}>
            {grid.map((d) => {
              const muted = d.getMonth() !== cursor.getMonth();
              const isSel = sameDay(d, selected);
              const isToday = sameDay(d, new Date());
              const dis = isDisabled(d);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={dis}
                  className={`${styles.wsCalDay} ${muted ? styles.wsCalDayMuted : ""} ${
                    isSel ? styles.wsCalDaySelected : ""
                  } ${isToday ? styles.wsCalDayToday : ""}`}
                  onClick={() => {
                    onChange(toIso(d));
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className={styles.wsCalFooter}>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(toIso(new Date()));
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
