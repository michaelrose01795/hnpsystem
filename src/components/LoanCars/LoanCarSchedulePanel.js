// file location: src/components/LoanCars/LoanCarSchedulePanel.js
//
// The loan car tracker: a lightweight internal copy of the dealership's main
// external loan-car system, used on /tracking → Loan Cars and on the job card's
// Loan Car tab.
//
// Layout, top to bottom — the calendar stays the dominant element:
//   * a compact toolbar: Available / Out / Due today / Overdue summary filters
//     on the left, the shared month picker (Prev / month / Next) on the right
//     (plus New loan booking on the job card, which has no page header of its
//     own). On /tracking the page owns the month (`month` / `onMonthChange`)
//     and shows the picker in its header row beside the page actions;
//   * the registration-column / date-row calendar;
//   * popups for everything secondary: booking details, New loan booking,
//     Quick add and Manage fleet.
//
// Business rules live in src/features/loanCars/loanCarModel.js, data access in
// src/hooks/useLoanCarSchedule.js → /api/tracking/loan-cars/*, and appearance
// in the `.loan-car-*` block of staffglobal.css.

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button, EmptyState } from "@/components/ui";
import StatusMessage from "@/components/ui/StatusMessage";
import { MonthPickerField } from "@/components/ui/monthPickerAPI";
import LoanCarCalendar from "@/components/LoanCars/LoanCarCalendar";
import { SectionSkeleton } from "@/components/ui/LoadingSkeleton";
import useIdleWarm from "@/hooks/useIdleWarm";

// The booking and fleet popups (~1,200 lines, plus the booking form, fuel
// gauge, calendar and time pickers and confirmation dialog they pull in) render
// only after a click, so they are split out of the calendar's first-load chunk
// and warmed once the browser is idle, before anyone reaches for them.
const loadBookingDrawer = () => import("@/components/LoanCars/LoanCarBookingDrawer");
const loadFleetDrawer = () => import("@/components/LoanCars/LoanCarFleetDrawer");
const LoanCarBookingDrawer = dynamic(loadBookingDrawer, { ssr: false });
const LoanCarFleetDrawer = dynamic(loadFleetDrawer, { ssr: false });
const WARM_DRAWERS = [loadBookingDrawer, loadFleetDrawer];
import {
  SUMMARY_FILTERS,
  bookingMatchesSearch,
  buildCalendarRange,
  carMatchesSearch,
  carMatchesSummaryFilter,
  nowStamp,
} from "@/features/loanCars/loanCarModel";
import { loanCarApi, useLoanCarSchedule } from "@/hooks/useLoanCarSchedule";

const FILTER_TONE = {
  available: "loan-car-filter--available",
  out: "loan-car-filter--out",
  due_today: "loan-car-filter--due-today",
  overdue: "loan-car-filter--overdue",
};

/** Booking draft pre-filled from a job card (also used by the job card settings popup). */
export function buildJobDraft(jobData, highlightedJobNumber = "", highlightedReg = "") {
  if (!jobData) return null;
  return {
    startDate: jobData.appointment?.date || "",
    endDate: jobData.appointment?.date || "",
    startTime: String(jobData.appointment?.time || "").slice(0, 5),
    jobId: jobData.id || null,
    jobNumber: jobData.jobNumber || highlightedJobNumber || "",
    customerId: jobData.customerId || null,
    customerName: jobData.customer || "",
    customerEmail: jobData.customerEmail || "",
    customerPhone: jobData.customerPhone || "",
    customerAddress: jobData.customerAddress || "",
    customerPostcode: jobData.customerPostcode || "",
    vehicleReg: jobData.reg || highlightedReg || "",
    vehicleMakeModel: jobData.makeModel || [jobData.make, jobData.model].filter(Boolean).join(" "),
    mileage: jobData.mileage || jobData.milage || "",
    insuranceProvider: jobData.insuranceProvider || "",
    insurancePolicyNumber: jobData.insurancePolicyNumber || "",
  };
}

export default function LoanCarSchedulePanel({
  jobData = null,
  highlightedJobNumber = "",
  highlightedReg = "",
  mode = "job-card",
  searchTerm = "",
  // { view: "new" | "quick" | "fleet", nonce } — raised by the /tracking page
  // header buttons, which live outside this panel.
  request = null,
  // Optional controlled month ("YYYY-MM"). When onMonthChange is supplied the
  // parent renders the month picker, so the toolbar leaves it out.
  month = "",
  onMonthChange = null,
}) {
  const isTracking = mode === "tracking";
  // The calendar always shows one whole month, chosen with the month picker.
  const rangeType = "month";
  const [localAnchorKey, setAnchorKey] = useState("");
  const isMonthControlled = typeof onMonthChange === "function";
  const anchorKey = isMonthControlled ? (month ? `${month}-01` : "") : localAnchorKey;
  const [summaryFilter, setSummaryFilter] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState(null);

  // "Today" is the browser's local day; the range is rebuilt from it so the
  // Today row and every Due today / Overdue decision agree.
  const [todayKey, setTodayKey] = useState(() => nowStamp().slice(0, 10));
  const range = useMemo(
    () => buildCalendarRange({ rangeType, anchorKey: anchorKey || todayKey, todayKey }),
    [rangeType, anchorKey, todayKey]
  );

  const schedule = useLoanCarSchedule({ startDate: range.startKey, endDate: range.endKey, todayKey });
  useIdleWarm(WARM_DRAWERS);
  const { cars, allCars, bookings, periods, availabilityByCar, summary, now, capabilities, migrationPending, refresh } = schedule;

  useEffect(() => {
    const current = now.slice(0, 10);
    if (current !== todayKey) setTodayKey(current);
  }, [now, todayKey]);

  // Header buttons on /tracking.
  useEffect(() => {
    if (!request?.nonce) return;
    if (request.view === "fleet") setDrawer({ type: "fleet" });
    if (request.view === "new" || request.view === "quick") {
      setDrawer({ type: "booking", mode: "create", variant: request.view === "new" ? "full" : "quick", draft: null });
    }
  }, [request?.nonce, request?.view]);

  const jobDraft = useMemo(() => buildJobDraft(jobData, highlightedJobNumber, highlightedReg), [jobData, highlightedJobNumber, highlightedReg]);
  const highlightJob = String(highlightedJobNumber || jobData?.jobNumber || "").trim().toLowerCase();
  const highlightReg = String(highlightedReg || jobData?.reg || "").replace(/\s+/g, "").toLowerCase();
  const term = String(searchTerm || "").trim();

  const matchingBookingIds = useMemo(() => {
    if (!term) return null;
    return new Set(bookings.filter((booking) => bookingMatchesSearch(booking, term)).map((booking) => booking.bookingId));
  }, [bookings, term]);

  const visibleCars = useMemo(
    () =>
      cars.filter((car) => {
        if (!carMatchesSummaryFilter(availabilityByCar[car.loanCarId], summaryFilter)) return false;
        if (!term) return true;
        return (
          carMatchesSearch(car, term) ||
          bookings.some((booking) => booking.loanCarId === car.loanCarId && matchingBookingIds.has(booking.bookingId))
        );
      }),
    [cars, availabilityByCar, summaryFilter, term, bookings, matchingBookingIds]
  );

  const isBookingDimmed = useCallback(
    (booking) => Boolean(matchingBookingIds) && !matchingBookingIds.has(booking.bookingId) && !carMatchesSearch(
      cars.find((car) => car.loanCarId === booking.loanCarId) || {},
      term
    ),
    [matchingBookingIds, cars, term]
  );

  const isBookingHighlighted = useCallback(
    (booking) =>
      Boolean(
        (highlightJob && String(booking.jobNumber || "").toLowerCase() === highlightJob) ||
          (highlightReg && String(booking.vehicleReg || "").replace(/\s+/g, "").toLowerCase() === highlightReg)
      ),
    [highlightJob, highlightReg]
  );

  const openCreate = useCallback(
    (overrides = {}, variant = "quick") => {
      setDrawer({ type: "booking", mode: "create", variant, draft: { ...(jobDraft || {}), ...overrides } });
    },
    [jobDraft]
  );

  const handleAdjust = useCallback(
    async (booking, dates) => {
      setNotice(null);
      try {
        await loanCarApi.adjustBooking(booking.bookingId, dates);
        setNotice({ tone: "success", text: "Booking dates updated." });
      } catch (error) {
        const alternatives = error.payload?.alternatives || [];
        setNotice({
          tone: "danger",
          text: alternatives.length ? `${error.message}. Free instead: ${alternatives.map((car) => car.reg).join(", ")}.` : error.message,
        });
      } finally {
        refresh();
      }
    },
    [refresh]
  );

  const canBook = capabilities?.book === true;
  const closeDrawer = useCallback(() => setDrawer(null), []);

  return (
    <div className="loan-car-panel">
      <div className="loan-car-toolbar" data-dev-section="1" data-dev-section-key={`${mode}-loan-car-toolbar`} data-dev-section-type="toolbar">
        <div className="loan-car-toolbar__filters" role="group" aria-label="Filter loan cars by availability">
          {SUMMARY_FILTERS.map((filter) => {
            const active = summaryFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                className={`loan-car-filter ${FILTER_TONE[filter.id]}${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={() => setSummaryFilter(active ? "" : filter.id)}>
                <span className="loan-car-filter__count">{summary[filter.id] ?? 0}</span>
                <span className="loan-car-filter__label">{filter.label}</span>
              </button>
            );
          })}
        </div>
        {!isMonthControlled || (!isTracking && canBook) ? (
          <div className="loan-car-toolbar__range">
            {!isMonthControlled ? (
              <MonthPickerField
                value={range.startKey.slice(0, 7)}
                onValueChange={(monthValue) => setAnchorKey(`${monthValue}-01`)}
                aria-label={`Loan car calendar month, currently ${range.label}`} />
            ) : null}
            {!isTracking && canBook ? (
              <Button type="button" size="sm" variant="primary" onClick={() => openCreate({}, "full")} symbol={false}>
                New loan booking
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {migrationPending ? (
        <StatusMessage tone="warning">
          The loan car database update has not been applied yet. Booking works; times, hand-over, returns, unavailable periods and activity history switch on once it is.
        </StatusMessage>
      ) : null}
      {schedule.error ? <StatusMessage tone="danger">{schedule.error}</StatusMessage> : null}
      {notice ? <StatusMessage tone={notice.tone}>{notice.text}</StatusMessage> : null}

      {/* Until the first schedule arrives there is nothing to draw; show the
          calendar's place rather than an empty card. */}
      {schedule.loading ? <SectionSkeleton showHeader={false} rows={8} /> : null}

      {!schedule.loading && cars.length === 0 ? (
        <EmptyState
          title="No loan vehicles yet"
          description="Add the loan fleet to start copying bookings across from the main loan car system."
          action={
            capabilities?.manageFleet ? (
              <Button type="button" size="sm" variant="primary" onClick={() => setDrawer({ type: "fleet" })} symbol={false}>
                Manage fleet
              </Button>
            ) : null
          }
        />
      ) : null}

      {cars.length > 0 && visibleCars.length === 0 ? (
        <StatusMessage tone="info">No loan cars match the current search or filter.</StatusMessage>
      ) : null}

      {visibleCars.length > 0 ? (
        <LoanCarCalendar
          sectionKey={`${mode}-loan-car-calendar`}
          days={range.days}
          cars={visibleCars}
          bookings={bookings}
          periods={periods}
          availabilityByCar={availabilityByCar}
          now={now}
          capabilities={capabilities}
          isBookingDimmed={isBookingDimmed}
          isBookingHighlighted={isBookingHighlighted}
          onOpenBooking={(booking) => setDrawer({ type: "booking", mode: "view", booking })}
          onCreateAt={(car, dayKey) => openCreate({ loanCarId: car.loanCarId, startDate: dayKey, endDate: dayKey })}
          onOpenCar={(car) => setDrawer({ type: "fleet", carId: car.loanCarId })}
          onAdjust={handleAdjust}
        />
      ) : null}

      {drawer?.type === "booking" ? (
        <LoanCarBookingDrawer
          open
          mode={drawer.mode}
          booking={drawer.booking || null}
          initialDraft={drawer.draft || null}
          variant={drawer.variant || "quick"}
          cars={cars}
          allCars={allCars}
          bookings={bookings}
          periods={periods}
          now={now}
          capabilities={capabilities}
          migrationPending={migrationPending}
          onClose={closeDrawer}
          onChanged={refresh}
        />
      ) : null}

      {drawer?.type === "fleet" ? (
        <LoanCarFleetDrawer
          open
          initialCarId={drawer.carId || null}
          allCars={allCars}
          availabilityByCar={availabilityByCar}
          todayKey={todayKey}
          capabilities={capabilities}
          migrationPending={migrationPending}
          onClose={closeDrawer}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

