// file location: src/singlescroll/components/WebsiteNativeDateTimeInput.js
// /website date/time input with a real hidden native input for form semantics,
// plus a custom-rendered picker panel so the open surface matches the portal.

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

const pad = (value) => String(value).padStart(2, "0");
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (value) => {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};
const sameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const buildCalendarGrid = (cursor) => {
  const first = startOfMonth(cursor);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
});

const formatTimeLabel = (value) => {
  if (!value) return "";
  const [hours, minutes] = value.split(":");
  return `${hours}:${minutes}`;
};

export default function WebsiteNativeDateTimeInput({
  type = "date",
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  name,
  required,
  min,
  max,
}) {
  const isTime = type === "time";
  const selectedDate = isTime ? null : fromIso(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(selectedDate || new Date());
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (selectedDate) setCursor(selectedDate);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const minDate = fromIso(min);
  const maxDate = fromIso(max);
  const selectedLabel = isTime
    ? formatTimeLabel(value)
    : selectedDate?.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  const displayLabel = selectedLabel || placeholder || (isTime ? "Pick a time" : "Pick a date");
  const grid = isTime ? [] : buildCalendarGrid(cursor);

  const isDateDisabled = (date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.wsRoot} website-native-datetime`}
      data-open={open ? "true" : "false"}
      data-type={isTime ? "time" : "date"}
    >
      <input
        type={isTime ? "time" : "date"}
        name={name}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="app-btn website-native-datetime__field"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className={`${styles.wsTrigger} website-native-datetime__trigger ${className}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={
            selectedLabel
              ? `${styles.wsTriggerValue} website-native-datetime__value`
              : `${styles.wsTriggerPlaceholder} website-native-datetime__placeholder`
          }
        >
          {displayLabel}
        </span>
        <span className="website-native-datetime__icon" aria-hidden="true" />
      </button>
      {open && !isTime ? (
        <div className="website-calendar" role="dialog" aria-label="Choose a date">
          <div className="website-calendar__header">
            <button
              type="button"
              className="website-calendar__nav"
              onClick={() => {
                const next = new Date(cursor);
                next.setMonth(cursor.getMonth() - 1);
                setCursor(next);
              }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="website-calendar__title">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button
              type="button"
              className="website-calendar__nav"
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
          <div className="website-calendar__weekdays">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="website-calendar__grid">
            {grid.map((date) => {
              const muted = date.getMonth() !== cursor.getMonth();
              const isSelected = sameDay(date, selectedDate);
              const isToday = sameDay(date, new Date());
              // Weekends are not selectable — Sat (6) / Sun (0) columns.
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isDisabled = isDateDisabled(date) || isWeekend;
              const className = [
                "website-calendar__day",
                muted && "website-calendar__day--muted",
                isToday && "website-calendar__day--today",
                isSelected && "website-calendar__day--selected",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={isDisabled}
                  className={className}
                  onClick={() => {
                    onChange?.(toIso(date));
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="website-calendar__footer">
            <button
              type="button"
              onClick={() => {
                onChange?.("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="app-btn"
              onClick={() => {
                onChange?.(toIso(new Date()));
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
      {open && isTime ? (
        <div className="website-calendar website-time-picker" role="dialog" aria-label="Choose a time">
          <div className="website-calendar__header">
            <div className="website-calendar__title">Preferred time</div>
          </div>
          <div className="website-time-picker__grid">
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                type="button"
                className={`website-time-picker__option ${
                  value === time ? "website-time-picker__option--selected" : ""
                }`}
                onClick={() => {
                  onChange?.(time);
                  setOpen(false);
                }}
              >
                {time}
              </button>
            ))}
          </div>
          <div className="website-calendar__footer">
            <button
              type="button"
              onClick={() => {
                onChange?.("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange?.("09:00");
                setOpen(false);
              }}
            >
              09:00
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
