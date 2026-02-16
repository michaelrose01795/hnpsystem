// file location: src/lib/welcomeQuoteSlot.js

const LONDON_TIMEZONE = "Europe/London";

const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const londonPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIMEZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const getLondonDateParts = (date = new Date()) => {
  const parts = londonPartsFormatter.formatToParts(date);
  const lookup = Object.create(null);
  parts.forEach((part) => {
    if (part.type !== "literal") {
      lookup[part.type] = part.value;
    }
  });
  return {
    weekdayIndex: WEEKDAY_TO_INDEX[lookup.weekday] ?? 0,
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  };
};

const toIsoDate = ({ year, month, day }) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getPreviousIsoDate = (isoDate) => {
  const [year, month, day] = isoDate.split("-").map((value) => Number(value));
  const previous = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
  return previous.toISOString().slice(0, 10);
};

const getWeekdayFromIso = (isoDate) => new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();

const getPreviousValidDate = (isoDate) => {
  let cursor = getPreviousIsoDate(isoDate);
  while (getWeekdayFromIso(cursor) === 0) {
    cursor = getPreviousIsoDate(cursor);
  }
  return cursor;
};

export const resolveWelcomeQuoteSlot = (date = new Date()) => {
  const london = getLondonDateParts(date);
  const todayIso = toIsoDate(london);

  if (london.weekdayIndex === 0) {
    return {
      dateIso: getPreviousValidDate(todayIso),
      slot: "15",
    };
  }

  if (london.hour >= 15) {
    return { dateIso: todayIso, slot: "15" };
  }

  if (london.hour >= 13) {
    return { dateIso: todayIso, slot: "13" };
  }

  if (london.hour >= 10) {
    return { dateIso: todayIso, slot: "10" };
  }

  return {
    dateIso: getPreviousValidDate(todayIso),
    slot: "15",
  };
};

export const getWelcomeQuoteSlotKey = (date = new Date()) => {
  const { dateIso, slot } = resolveWelcomeQuoteSlot(date);
  return `${dateIso}-${slot}`;
};

