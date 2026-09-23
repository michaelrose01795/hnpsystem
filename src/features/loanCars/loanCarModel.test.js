import { describe, expect, it } from "vitest";
import {
  AVAILABILITY,
  BOOKING_STATE,
  bookingDisplayEndDate,
  bookingMatchesSearch,
  buildCalendarRange,
  customerSurname,
  findAlternativeCars,
  findBookingConflicts,
  resolveBookingState,
  resolveCarAvailability,
  shiftAnchor,
  summariseAvailability,
  validateBookingWindow,
} from "@/features/loanCars/loanCarModel";
import { resolveLoanCarCapabilities } from "@/features/loanCars/loanCarAccess";

const NOW = "2026-09-22T11:00"; // a Tuesday

const booking = (overrides = {}) => ({
  bookingId: overrides.bookingId || "b1",
  loanCarId: "car-a",
  startDate: "2026-09-21",
  endDate: "2026-09-24",
  startTime: "",
  endTime: "",
  status: "reserved",
  customerName: "Mr John Smith",
  ...overrides,
});

describe("calendar ranges", () => {
  it("builds a 14 day window that opens two days before the anchor", () => {
    const range = buildCalendarRange({ rangeType: "14", anchorKey: "2026-09-22", todayKey: "2026-09-22" });
    expect(range.days).toHaveLength(14);
    expect(range.startKey).toBe("2026-09-20");
    expect(range.days.find((day) => day.isToday).key).toBe("2026-09-22");
  });

  it("builds a whole calendar month and steps month by month", () => {
    const range = buildCalendarRange({ rangeType: "month", anchorKey: "2026-02-10", todayKey: "2026-09-22" });
    expect(range.startKey).toBe("2026-02-01");
    expect(range.endKey).toBe("2026-02-28");
    expect(shiftAnchor({ rangeType: "month", anchorKey: "2026-01-31", direction: 1 })).toBe("2026-02-01");
  });

  it("steps rolling views by their length", () => {
    expect(shiftAnchor({ rangeType: "7", anchorKey: "2026-09-22", direction: -1 })).toBe("2026-09-15");
  });
});

describe("overlap detection", () => {
  const existing = [booking({ startDate: "2026-09-22", endDate: "2026-09-22", endTime: "10:00" })];

  it("allows a same-day turnaround once the earlier loan has a return time", () => {
    const candidate = { loanCarId: "car-a", startDate: "2026-09-22", endDate: "2026-09-23", startTime: "14:00" };
    expect(findBookingConflicts(candidate, { bookings: existing })).toHaveLength(0);
  });

  it("treats untimed bookings on the same day as a clash", () => {
    const candidate = { loanCarId: "car-a", startDate: "2026-09-22", endDate: "2026-09-22" };
    const untimed = [booking({ startDate: "2026-09-22", endDate: "2026-09-22" })];
    expect(findBookingConflicts(candidate, { bookings: untimed })).toHaveLength(1);
  });

  it("ignores the booking being edited and other cars", () => {
    const candidate = { bookingId: "b1", loanCarId: "car-a", startDate: "2026-09-22", endDate: "2026-09-22" };
    expect(findBookingConflicts(candidate, { bookings: existing })).toHaveLength(0);
    expect(findBookingConflicts({ ...candidate, bookingId: null, loanCarId: "car-b" }, { bookings: existing })).toHaveLength(0);
  });

  it("frees the car from an early return", () => {
    const returned = [booking({ status: "returned", returnedDate: "2026-09-22", returnedTime: "09:00" })];
    const candidate = { loanCarId: "car-a", startDate: "2026-09-22", endDate: "2026-09-23", startTime: "12:00" };
    expect(findBookingConflicts(candidate, { bookings: returned })).toHaveLength(0);
  });

  it("blocks unavailable periods and offers free alternatives", () => {
    const periods = [{ periodId: "p1", loanCarId: "car-a", startDate: "2026-09-25", endDate: "2026-09-26", reason: "mot" }];
    const candidate = { loanCarId: "car-a", startDate: "2026-09-26", endDate: "2026-09-27" };
    expect(findBookingConflicts(candidate, { periods })[0].type).toBe("unavailable");
    const cars = [
      { loanCarId: "car-a", status: "active" },
      { loanCarId: "car-b", status: "active" },
      { loanCarId: "car-c", status: "inactive" },
    ];
    expect(findAlternativeCars(candidate, { cars, periods }).map((car) => car.loanCarId)).toEqual(["car-b"]);
  });

  it("validates the booking window", () => {
    expect(validateBookingWindow({ loanCarId: "a", startDate: "2026-09-22", endDate: "2026-09-21" })).toMatch(/end date/);
    expect(
      validateBookingWindow({ loanCarId: "a", startDate: "2026-09-22", endDate: "2026-09-22", startTime: "15:00", endTime: "09:00" })
    ).toMatch(/return time/);
    expect(validateBookingWindow({ loanCarId: "a", startDate: "2026-09-22", endDate: "2026-09-22" })).toBe("");
  });
});

describe("booking state", () => {
  it("keeps a booking starting today Reserved until it is handed over", () => {
    expect(resolveBookingState(booking({ startDate: "2026-09-22", startTime: "15:00" }), NOW)).toBe(BOOKING_STATE.RESERVED);
    expect(resolveBookingState(booking({ startDate: "2026-09-22" }), NOW)).toBe(BOOKING_STATE.RESERVED);
    expect(resolveBookingState(booking({ startDate: "2026-09-22", status: "out" }), NOW)).toBe(BOOKING_STATE.OUT);
  });

  it("treats a reserved booking that began on an earlier day as out", () => {
    expect(resolveBookingState(booking(), NOW)).toBe(BOOKING_STATE.OUT);
  });

  it("flags due today and overdue", () => {
    expect(resolveBookingState(booking({ endDate: "2026-09-22", endTime: "17:00" }), NOW)).toBe(BOOKING_STATE.DUE_TODAY);
    expect(resolveBookingState(booking({ endDate: "2026-09-22", endTime: "10:00" }), NOW)).toBe(BOOKING_STATE.OVERDUE);
    expect(resolveBookingState(booking({ endDate: "2026-09-20", startDate: "2026-09-18" }), NOW)).toBe(BOOKING_STATE.OVERDUE);
  });

  it("runs an overdue block on to today", () => {
    expect(bookingDisplayEndDate(booking({ startDate: "2026-09-18", endDate: "2026-09-20" }), NOW)).toBe("2026-09-22");
    expect(bookingDisplayEndDate(booking({ status: "returned", returnedDate: "2026-09-23" }), NOW)).toBe("2026-09-23");
  });
});

describe("vehicle availability", () => {
  const car = { loanCarId: "car-a", status: "active" };

  it("prioritises unavailable, then overdue, over everything else", () => {
    const periods = [{ loanCarId: "car-a", startDate: "2026-09-22", endDate: "2026-09-23", reason: "service" }];
    expect(resolveCarAvailability(car, { periods }, NOW).state).toBe(AVAILABILITY.UNAVAILABLE);
    const bookings = [
      booking({ bookingId: "x", startDate: "2026-09-18", endDate: "2026-09-20" }),
      booking({ bookingId: "y", startDate: "2026-09-22", endDate: "2026-09-22" }),
    ];
    expect(resolveCarAvailability(car, { bookings }, NOW).state).toBe(AVAILABILITY.OVERDUE);
  });

  it("is available with a next booking when nothing covers today", () => {
    const bookings = [booking({ startDate: "2026-09-25", endDate: "2026-09-26" })];
    const result = resolveCarAvailability(car, { bookings }, NOW);
    expect(result.state).toBe(AVAILABILITY.AVAILABLE);
    expect(result.nextBooking.bookingId).toBe("b1");
  });

  it("counts Out including due today and overdue", () => {
    const counts = summariseAvailability({
      a: { state: AVAILABILITY.OUT },
      b: { state: AVAILABILITY.DUE_TODAY },
      c: { state: AVAILABILITY.OVERDUE },
      d: { state: AVAILABILITY.AVAILABLE },
    });
    expect(counts).toEqual({ available: 1, out: 3, due_today: 1, overdue: 1 });
  });
});

describe("search and labels", () => {
  const target = booking({ customerPhone: "07700 900123", vehicleReg: "AB12 CDE", jobNumber: "30412", externalReference: "LC-889" });

  it("matches phone digits, compact registrations, job numbers and external refs", () => {
    expect(bookingMatchesSearch(target, "07700900123")).toBe(true);
    expect(bookingMatchesSearch(target, "ab12cde")).toBe(true);
    expect(bookingMatchesSearch(target, "3041")).toBe(true);
    expect(bookingMatchesSearch(target, "lc-889")).toBe(true);
    expect(bookingMatchesSearch(target, "jones")).toBe(false);
  });

  it("derives a surname", () => {
    expect(customerSurname("Mr John Smith")).toBe("Smith");
    expect(customerSurname("Smith, John")).toBe("Smith");
    expect(customerSurname("Acme Motors Ltd")).toBe("Acme Motors Ltd");
  });
});

describe("capabilities", () => {
  it("gives reception booking but not fleet control", () => {
    const caps = resolveLoanCarCapabilities(["Receptionist"]);
    expect(caps).toMatchObject({ view: true, book: true, handover: true, adjust: false, manageFleet: false });
  });

  it("gives workshop controllers everything and the floor view only", () => {
    expect(resolveLoanCarCapabilities(["Workshop Controller"]).manageFleet).toBe(true);
    expect(resolveLoanCarCapabilities(["Techs"]).book).toBe(false);
  });
});
