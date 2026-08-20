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

export const formatAppointmentTimestamp = (value) => {
  if (!value) return { date: "", time: "" };

  const londonDateTime = dayjs(value).tz(APPOINTMENT_TIME_ZONE);
  if (!londonDateTime.isValid()) return { date: "", time: "" };

  return {
    date: londonDateTime.format("YYYY-MM-DD"),
    time: londonDateTime.format("HH:mm"),
  };
};
