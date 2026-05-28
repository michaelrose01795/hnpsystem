import { useEffect, useMemo, useRef } from "react";
import LayerSurface from "@/components/ui/LayerSurface";

const DEFAULT_LOAN_CARS = [
  { id: "lc-01", reg: "LOAN 1", name: "Loan Car 1" },
  { id: "lc-02", reg: "LOAN 2", name: "Loan Car 2" },
  { id: "lc-03", reg: "LOAN 3", name: "Loan Car 3" },
  { id: "lc-04", reg: "LOAN 4", name: "Loan Car 4" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOOK_BACK_DAYS = 14;
const LOOK_AHEAD_DAYS = 35;

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normaliseDateKey = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return toDateKey(parsed);
};

const buildDateRows = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: LOOK_BACK_DAYS + LOOK_AHEAD_DAYS + 1 }, (_, index) => {
    const offset = index - LOOK_BACK_DAYS;
    const date = new Date(today.getTime() + offset * MS_PER_DAY);
    return {
      key: toDateKey(date),
      label: date.toLocaleDateString("en-GB", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      isToday: offset === 0,
    };
  });
};

const buildJobBooking = ({ jobData, highlightedJobNumber, highlightedReg }) => {
  if (!jobData) return null;
  const dateKey = normaliseDateKey(jobData.appointment?.date || jobData.appointment?.scheduledTime);
  if (!dateKey) return null;

  return {
    id: `job-${jobData.id || jobData.jobNumber || highlightedJobNumber || highlightedReg}`,
    loanCarId: "lc-01",
    date: dateKey,
    jobNumber: jobData.jobNumber || highlightedJobNumber || "",
    reg: jobData.reg || highlightedReg || "",
    customer: jobData.customer || "Customer",
  };
};

const getBookingForCell = (bookings, carId, dayKey) =>
  bookings.find((booking) => booking.loanCarId === carId && booking.date === dayKey);

const BookingCell = ({ booking, highlightedJob, highlightedVehicle }) => {
  if (!booking) {
    return <span style={{ color: "var(--success-dark)", fontWeight: 700 }}>Available</span>;
  }

  const isHighlighted =
    (highlightedJob && String(booking.jobNumber || "").toLowerCase() === highlightedJob) ||
    (highlightedVehicle && String(booking.reg || "").toLowerCase() === highlightedVehicle);

  return (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: isHighlighted ? "rgba(var(--primary-rgb), 0.18)" : "var(--warning-surface)",
        color: "var(--text-1)",
      }}>
      <strong style={{ fontSize: "12px" }}>
        #{booking.jobNumber || "Job"} {booking.reg ? `- ${booking.reg}` : ""}
      </strong>
      <span style={{ fontSize: "12px" }}>{booking.customer || "Customer"}</span>
      {isHighlighted ? (
        <span style={{ fontSize: "11px", color: "var(--primary-selected)", fontWeight: 700 }}>
          Current job
        </span>
      ) : null}
    </span>
  );
};

export default function LoanCarSchedulePanel({
  jobData = null,
  highlightedJobNumber = "",
  highlightedReg = "",
  mode = "job-card",
  cars = DEFAULT_LOAN_CARS,
  bookings = [],
  showApiTodo = false,
}) {
  const scrollRef = useRef(null);
  const todayRowRef = useRef(null);
  const dateRows = useMemo(() => buildDateRows(), []);
  const jobBooking = buildJobBooking({ jobData, highlightedJobNumber, highlightedReg });
  const allBookings = jobBooking
    ? [jobBooking, ...bookings.filter((booking) => booking.id !== jobBooking.id)]
    : bookings;
  const highlightedJob = String(highlightedJobNumber || jobData?.jobNumber || "").trim().toLowerCase();
  const highlightedVehicle = String(highlightedReg || jobData?.reg || "").trim().toLowerCase();

  useEffect(() => {
    if (!todayRowRef.current || !scrollRef.current) return;
    todayRowRef.current.scrollIntoView({ block: "start" });
  }, []);

  const content = (
    <>
      <div
        data-dev-section="1"
        data-dev-section-key={`${mode}-loan-car-header`}
        data-dev-section-type="toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          flexWrap: "wrap",
        }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "18px", fontWeight: 700 }}>
            {mode === "tracking" ? "Loan Cars" : "Loan Car Booking"}
          </h3>
          <p style={{ margin: "4px 0 0", color: "var(--grey-accent)", fontSize: "13px" }}>
            Two weeks back and five weeks ahead. The table opens at today.
          </p>
        </div>
        {showApiTodo ? (
          <span
            style={{
              padding: "6px 10px",
              borderRadius: "var(--control-radius)",
              backgroundColor: "var(--warning-surface)",
              color: "var(--warning-dark)",
              fontSize: "12px",
              fontWeight: 700,
            }}>
            TODO: external API
          </span>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="app-table-shell-scroll"
        data-dev-section="1"
        data-dev-section-key={`${mode}-loan-car-appointments-table-scroll`}
        data-dev-section-type="data-table"
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: mode === "tracking" ? "calc(100dvh - 280px)" : "560px",
        }}>
        <table
          className="app-data-table app-table-shell app-table-shell--with-headings"
          data-dev-section="1"
          data-dev-section-key={`${mode}-loan-car-appointments-table`}
          data-dev-section-type="data-table"
          style={{ minWidth: "980px", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "180px" }}>Appointment Day</th>
              {cars.map((car) => (
                <th key={car.id}>
                  {car.reg}
                  <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "var(--grey-accent)" }}>
                    {car.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dateRows.map((day) => (
              <tr key={day.key} ref={day.isToday ? todayRowRef : null}>
                <td>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      color: day.isToday ? "var(--primary-selected)" : "var(--text-1)",
                      fontWeight: day.isToday ? 800 : 700,
                    }}>
                    <span>{day.label}</span>
                    <span style={{ fontSize: "12px", color: day.isToday ? "var(--primary-selected)" : "var(--grey-accent)" }}>
                      {day.isToday ? "Today" : day.dateLabel}
                    </span>
                  </span>
                </td>
                {cars.map((car) => (
                  <td key={`${day.key}-${car.id}`}>
                    <BookingCell
                      booking={getBookingForCell(allBookings, car.id, day.key)}
                      highlightedJob={highlightedJob}
                      highlightedVehicle={highlightedVehicle}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showApiTodo ? (
        <p
          data-dev-section="1"
          data-dev-section-key={`${mode}-loan-car-api-todo`}
          data-dev-section-type="empty-state"
          style={{ margin: 0, color: "var(--text-1)", fontSize: "13px" }}>
          TODO: Replace the placeholder fleet and booking rows with the external company API once credentials, endpoint, and field mapping are confirmed.
        </p>
      ) : null}
    </>
  );

  if (mode === "tracking") {
    return content;
  }

  return (
    <LayerSurface
      as="section"
      sectionKey="job-card-loan-car-schedule-panel"
      sectionType="section-shell"
      parentKey="jobcard-tab-loan-car"
      radius="var(--radius-sm)"
      padding="var(--section-card-padding)"
      gap="var(--layout-card-gap)">
      {content}
    </LayerSurface>
  );
}
