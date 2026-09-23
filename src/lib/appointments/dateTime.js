import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APPOINTMENT_TIME_ZONE = "Europe/London";

export const WORKSHOP_APPOINTMENT_TIME_OPTIONS = Array.from(
  { length: 19 },
  (_, index) => {
    const totalMinutes = 8 * 60 + index * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const displayHour = hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? "PM" : "AM";

    return {
      value,
      label: `${displayHour}:${String(minute).padStart(2, "0")} ${period}`,
    };
  }
);

const WORKSHOP_APPOINTMENT_TIMES = new Set(
  WORKSHOP_APPOINTMENT_TIME_OPTIONS.map((option) => option.value)
);

export const isWorkshopAppointmentTime = (value) =>
  WORKSHOP_APPOINTMENT_TIMES.has(String(value || ""));

export const toAppointmentTimestamp = (date, time) => {
  const dateValue = String(date || "");
  const timeValue = String(time || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("Invalid appointment date");
  }
  if (!isWorkshopAppointmentTime(timeValue)) {
    throw new Error("Appointment time must be between 8:00 AM and 5:00 PM in 30-minute intervals");
  }

  const londonDateTime = dayjs.tz(
    `${dateValue} ${timeValue}`,
    "YYYY-MM-DD HH:mm",
    APPOINTMENT_TIME_ZONE
  );

  if (
    !londonDateTime.isValid() ||
    londonDateTime.format("YYYY-MM-DD HH:mm") !== `${dateValue} ${timeValue}`
  ) {
    throw new Error("Invalid appointment date or time");
  }

  return londonDateTime.toISOString();
};

// One formatter, built once at module load, reused for every call.
//
// formatAppointmentTimestamp is called once per job row from formatJobData
// (lib/database/jobs.js), so it runs hundreds of times per list render. The
// previous implementation used dayjs(value).tz(...), and the dayjs timezone
// plugin constructs a fresh Intl.DateTimeFormat on every single call — CPU
// profiles of production put `l.tz` at 219 ms of self-time on /appointments and
// 245 ms on /new-job, the second-largest block on both pages.
//
// Intl.DateTimeFormat is what dayjs.tz uses underneath, so hoisting one instance
// and reading formatToParts() produces byte-identical output for the same input.
// hourCycle "h23" (rather than hour12: false) is deliberate: hour12:false can
// render midnight as "24" on some engines, which would silently corrupt times.
const LONDON_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: APPOINTMENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const formatAppointmentTimestamp = (value) => {
  if (!value) return { date: "", time: "" };

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };

  const parts = {};
  for (const part of LONDON_PARTS.formatToParts(parsed)) {
    parts[part.type] = part.value;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};
