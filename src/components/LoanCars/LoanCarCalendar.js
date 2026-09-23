// file location: src/components/LoanCars/LoanCarCalendar.js
//
// The loan car calendar grid: one column per loan registration (with its live
// availability underneath), one row per day. Bookings render as compact
// blocks — surname, job, times — that run down the column for their dates,
// flag when they continue beyond the visible range, and open the booking
// drawer on click. With the `adjust` capability a block's top / bottom edge can
// be dragged to change its duration.
//
// All appearance comes from the `.loan-car-*` block in staffglobal.css; every
// inline style here is layout only (widths, the table's min-width).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AVAILABILITY_META,
  BOOKING_STATE,
  BOOKING_STATUS,
  addDays,
  bookingDisplayEndDate,
  bookingHoverText,
  bookingStartStamp,
  customerSurname,
  formatBookingWindow,
  formatDayLabel,
  formatShortDate,
  normaliseTime,
  resolveBookingState,
  unavailableReasonLabel,
} from "@/features/loanCars/loanCarModel";

const DATE_COLUMN_WIDTH = 112;
const CAR_COLUMN_WIDTH = 148;

const BLOCK_TONE = {
  [BOOKING_STATE.UPCOMING]: "reserved",
  [BOOKING_STATE.RESERVED]: "reserved",
  [BOOKING_STATE.OUT]: "out",
  [BOOKING_STATE.DUE_TODAY]: "due-today",
  [BOOKING_STATE.OVERDUE]: "overdue",
  [BOOKING_STATE.RETURNED]: "returned",
};

const STATUS_TONE_CLASS = {
  success: "loan-car-status--available",
  warning: "loan-car-status--reserved",
  accent: "loan-car-status--out",
  "warning-strong": "loan-car-status--due-today",
  danger: "loan-car-status--overdue",
  neutral: "loan-car-status--unavailable",
};

/** Hover text for a column's availability chip. */
function availabilityHoverText(car, availability) {
  const meta = AVAILABILITY_META[availability?.state];
  if (!meta) return car.reg;
  const parts = [`${car.reg} · ${meta.label}`];
  if (availability.reason) parts.push(availability.reason);
  if (availability.booking) {
    const booking = availability.booking;
    parts.push(customerSurname(booking.customerName) || "Booking");
    parts.push(`due back ${formatDayLabel(booking.endDate)}${booking.endTime ? ` ${booking.endTime}` : ""}`);
  }
  if (availability.period) {
    parts.push(`until ${formatDayLabel(availability.period.endDate)}`);
  }
  if (availability.nextBooking) {
    const next = availability.nextBooking;
    parts.push(`next ${formatDayLabel(next.startDate)} (${customerSurname(next.customerName) || "booking"})`);
  }
  return parts.join(" · ");
}

/**
 * Per car, per day: the blocks that occupy the cell. A block knows whether it
 * starts / ends in that cell or continues beyond the visible range, which is
 * all the cell needs to decide what to print and how to round its corners.
 */
function buildCellMap({ cars, bookings, periods, days, now, preview }) {
  const firstDay = days[0]?.key;
  const lastDay = days[days.length - 1]?.key;
  const carIds = new Set(cars.map((car) => car.loanCarId));
  const map = new Map();
  if (!firstDay) return map;

  const place = (carId, kind, item, startKey, endKey, sortKey) => {
    if (!carIds.has(carId) || !startKey || endKey < firstDay || startKey > lastDay) return;
    const clipStart = startKey < firstDay ? firstDay : startKey;
    const clipEnd = endKey > lastDay ? lastDay : endKey;
    for (let day = clipStart; day && day <= clipEnd; day = addDays(day, 1)) {
      const cellKey = `${carId}|${day}`;
      const entry = {
        kind,
        item,
        sortKey,
        isStart: day === startKey,
        isEnd: day === endKey,
        isFirstVisible: day === clipStart,
        continuesBefore: startKey < firstDay && day === firstDay,
        continuesAfter: endKey > lastDay && day === lastDay,
        startKey,
        endKey,
      };
      const list = map.get(cellKey);
      if (list) list.push(entry);
      else map.set(cellKey, [entry]);
    }
  };

  for (const booking of bookings) {
    const shown = preview && preview.bookingId === booking.bookingId ? { ...booking, ...preview.dates } : booking;
    place(
      shown.loanCarId,
      "booking",
      shown,
      shown.startDate,
      bookingDisplayEndDate(shown, now),
      bookingStartStamp(shown)
    );
  }
  for (const period of periods) {
    place(period.loanCarId, "period", period, period.startDate, period.endDate, `${period.startDate}T00:00`);
  }
  for (const list of map.values()) list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return map;
}

function BookingBlock({ entry, car, now, dayKey, compact, dimmed, highlighted, canAdjust, onOpen, onHandleDown, dragging }) {
  const booking = entry.item;
  const state = resolveBookingState(booking, now);
  const tone = BLOCK_TONE[state] || "reserved";
  const isOverrun = state === BOOKING_STATE.OVERDUE && dayKey > booking.endDate;
  const showTitle = entry.isFirstVisible;
  const startTime = normaliseTime(booking.startTime);
  const endTime = normaliseTime(booking.endTime);

  let meta = "";
  if (entry.continuesBefore) meta = `↑ from ${formatShortDate(booking.startDate)}`;
  else if (entry.isStart && entry.isEnd && (startTime || endTime)) meta = [startTime, endTime].filter(Boolean).join("–");
  else if (entry.isStart && startTime) meta = `${startTime} →`;

  let tail = "";
  if (!showTitle && entry.continuesAfter) tail = `↓ to ${formatShortDate(booking.endDate)}`;
  else if (!showTitle && entry.isEnd && !isOverrun) tail = endTime ? `→ ${endTime}` : "Due back";
  else if (!showTitle && isOverrun && entry.isEnd) tail = "Still out";
  const continuesAfterOnTitleRow = showTitle && entry.continuesAfter;

  const canDrag = canAdjust && booking.status !== BOOKING_STATUS.RETURNED;
  const modifierClass = [
    `loan-car-block--${tone}`,
    isOverrun ? "is-overrun" : "",
    entry.isStart ? "is-start" : "",
    entry.isEnd ? "is-end" : "",
    entry.continuesBefore ? "is-continued-before" : "",
    entry.continuesAfter ? "is-continued-after" : "",
    dimmed ? "is-dimmed" : "",
    highlighted ? "is-highlighted" : "",
    dragging ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const title = `${customerSurname(booking.customerName) || "Booking"}${booking.jobNumber ? ` · #${booking.jobNumber}` : ""}`;

  return (
    <button
      type="button"
      className={`loan-car-block ${modifierClass}`}
      data-tooltip={bookingHoverText(booking, car, now)}
      aria-label={`${car.reg}: ${booking.customerName || "booking"}${booking.jobNumber ? `, job ${booking.jobNumber}` : ""}, ${formatBookingWindow(booking)}. Open details.`}
      onClick={() => onOpen(booking)}>
      {canDrag && entry.isStart ? (
        <span
          className="loan-car-block__handle loan-car-block__handle--start"
          aria-hidden="true"
          onPointerDown={(event) => onHandleDown(event, booking, "start")}
        />
      ) : null}
      {showTitle ? (
        <>
          <span className="loan-car-block__title">{title}</span>
          {!compact && (meta || continuesAfterOnTitleRow) ? (
            <span className="loan-car-block__meta">
              {meta}
              {continuesAfterOnTitleRow ? ` ↓ to ${formatShortDate(booking.endDate)}` : ""}
            </span>
          ) : null}
        </>
      ) : tail && !compact ? (
        <span className="loan-car-block__meta">{tail}</span>
      ) : null}
      {canDrag && entry.isEnd && !isOverrun ? (
        <span
          className="loan-car-block__handle loan-car-block__handle--end"
          aria-hidden="true"
          onPointerDown={(event) => onHandleDown(event, booking, "end")}
        />
      ) : null}
    </button>
  );
}

function PeriodBlock({ entry, car, compact, onOpen }) {
  const period = entry.item;
  const reason = unavailableReasonLabel(period.reason);
  const modifierClass = [
    "loan-car-block--unavailable",
    entry.isStart ? "is-start" : "",
    entry.isEnd ? "is-end" : "",
    entry.continuesBefore ? "is-continued-before" : "",
    entry.continuesAfter ? "is-continued-after" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const hover = [
    `${car.reg} unavailable`,
    reason,
    `${formatShortDate(period.startDate)} – ${formatShortDate(period.endDate)}`,
    period.notes,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button type="button" className={`loan-car-block ${modifierClass}`} data-tooltip={hover} aria-label={`${hover}. Open vehicle.`} onClick={() => onOpen(car)}>
      {entry.isFirstVisible ? <span className="loan-car-block__title">{reason}</span> : null}
      {entry.isFirstVisible && !compact && period.notes ? <span className="loan-car-block__meta">{period.notes}</span> : null}
    </button>
  );
}

export default function LoanCarCalendar({
  days,
  cars,
  bookings,
  periods,
  availabilityByCar,
  now,
  capabilities,
  isBookingDimmed,
  isBookingHighlighted,
  onOpenBooking,
  onCreateAt,
  onOpenCar,
  onAdjust,
  scrollToTodayToken = 0,
  sectionKey = "loan-car-calendar",
}) {
  const scrollRef = useRef(null);
  const todayRowRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState(null);
  const canBook = capabilities?.book === true;
  const canAdjust = capabilities?.adjust === true;

  const preview = useMemo(() => {
    if (!drag) return null;
    const { booking, edge, dayKey } = drag;
    const dates =
      edge === "end"
        ? { endDate: dayKey < booking.startDate ? booking.startDate : dayKey }
        : { startDate: dayKey > booking.endDate ? booking.endDate : dayKey };
    return { bookingId: booking.bookingId, dates };
  }, [drag]);

  const cellMap = useMemo(
    () => buildCellMap({ cars, bookings, periods, days, now, preview }),
    [cars, bookings, periods, days, now, preview]
  );

  // Put today's row flush under the sticky heading: on first render, whenever
  // the range changes, and when the toolbar's Today button is pressed.
  const scrollTodayIntoView = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const row = todayRowRef.current;
    if (!row) {
      scroller.scrollTop = 0;
      return;
    }
    const heading = scroller.querySelector("thead");
    const headingHeight = heading ? heading.getBoundingClientRect().height : 0;
    scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headingHeight;
  }, []);

  const firstDayKey = days[0]?.key;
  const hasCars = cars.length > 0;
  useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(scrollTodayIntoView);
    });
    return () => {
      window.cancelAnimationFrame(first);
      if (second) window.cancelAnimationFrame(second);
    };
  }, [firstDayKey, days.length, hasCars, scrollToTodayToken, scrollTodayIntoView]);

  // ----- drag to adjust -----------------------------------------------------
  const handleHandleDown = useCallback((event, booking, edge) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDrag({ booking, edge, dayKey: edge === "end" ? booking.endDate : booking.startDate });
  }, []);

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (event) => {
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-loan-car-day]");
      const dayKey = cell?.getAttribute("data-loan-car-day");
      if (dayKey) setDrag((current) => (current && current.dayKey !== dayKey ? { ...current, dayKey } : current));
    };
    const onUp = () => {
      const { booking } = drag;
      const next = {
        startDate: preview?.dates.startDate ?? booking.startDate,
        endDate: preview?.dates.endDate ?? booking.endDate,
      };
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      setDrag(null);
      if (next.startDate !== booking.startDate || next.endDate !== booking.endDate) onAdjust(booking, next);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [drag, preview, onAdjust]);

  const openBooking = useCallback(
    (booking) => {
      if (suppressClickRef.current) return;
      onOpenBooking(booking);
    },
    [onOpenBooking]
  );

  const tableMinWidth = `${DATE_COLUMN_WIDTH + cars.length * CAR_COLUMN_WIDTH}px`;

  return (
    <div
      ref={scrollRef}
      className={`loan-car-calendar${drag ? " is-adjusting" : ""}`}
      data-dev-section="1"
      data-dev-section-key={sectionKey}
      data-dev-section-type="data-table"
      // The calendar owns its own sticky heading, column and row rules; opt out
      // of the global table-shell enhancer so it does not restyle the cells.
      data-app-table-shell="off">
      <table className="loan-car-calendar__table" data-app-table-shell="off" style={{ minWidth: tableMinWidth }}>
        <colgroup>
          <col style={{ width: `${DATE_COLUMN_WIDTH}px` }} />
          {cars.map((car) => (
            <col key={car.loanCarId} style={{ width: `${CAR_COLUMN_WIDTH}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="loan-car-calendar__corner">
              <button type="button" className="loan-car-calendar__corner-button" onClick={scrollTodayIntoView} data-tooltip="Jump to today">
                Date
              </button>
            </th>
            {cars.map((car) => {
              const availability = availabilityByCar[car.loanCarId];
              const meta = AVAILABILITY_META[availability?.state] || AVAILABILITY_META.available;
              return (
                <th key={car.loanCarId} scope="col" className="loan-car-calendar__car">
                  <button
                    type="button"
                    className="loan-car-calendar__car-button"
                    onClick={() => onOpenCar(car)}
                    data-tooltip={availabilityHoverText(car, availability)}
                    aria-label={`${car.reg}, ${meta.label}. Open vehicle details.`}>
                    <span className="loan-car-calendar__reg">{car.reg}</span>
                    <span className={`loan-car-status ${STATUS_TONE_CLASS[meta.tone] || ""}`}>{meta.label}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr
              key={day.key}
              ref={day.isToday ? todayRowRef : null}
              data-loan-car-day={day.key}
              className={[
                "loan-car-calendar__row",
                day.isToday ? "is-today" : "",
                day.isWeekend ? "is-weekend" : "",
                day.isPast ? "is-past" : "",
              ]
                .filter(Boolean)
                .join(" ")}>
              <th scope="row" className="loan-car-calendar__date" data-loan-car-day={day.key}>
                <span className="loan-car-calendar__weekday">{day.weekday}</span>
                <span className="loan-car-calendar__daymonth">{day.dayMonth}</span>
                {day.isToday ? <span className="loan-car-calendar__today-marker">Today</span> : null}
              </th>
              {cars.map((car) => {
                const entries = cellMap.get(`${car.loanCarId}|${day.key}`) || [];
                const compact = entries.length > 1;
                return (
                  <td key={car.loanCarId} className="loan-car-calendar__cell" data-loan-car-day={day.key}>
                    {entries.length === 0 ? (
                      canBook ? (
                        <button
                          type="button"
                          className="loan-car-calendar__slot"
                          onClick={() => onCreateAt(car, day.key)}
                          aria-label={`Book ${car.reg} on ${formatDayLabel(day.key)}`}>
                          <span aria-hidden="true">+</span>
                        </button>
                      ) : null
                    ) : (
                      <div className={`loan-car-calendar__stack${compact ? " loan-car-calendar__stack--multi" : ""}`}>
                        {entries.map((entry) =>
                          entry.kind === "booking" ? (
                            <BookingBlock
                              key={entry.item.bookingId}
                              entry={entry}
                              car={car}
                              now={now}
                              dayKey={day.key}
                              compact={compact}
                              dimmed={isBookingDimmed?.(entry.item)}
                              highlighted={isBookingHighlighted?.(entry.item)}
                              canAdjust={canAdjust}
                              dragging={drag?.booking.bookingId === entry.item.bookingId}
                              onOpen={openBooking}
                              onHandleDown={handleHandleDown}
                            />
                          ) : (
                            <PeriodBlock key={entry.item.periodId} entry={entry} car={car} compact={compact} onOpen={onOpenCar} />
                          )
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
