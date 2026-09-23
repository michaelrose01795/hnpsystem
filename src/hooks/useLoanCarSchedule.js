// file location: src/hooks/useLoanCarSchedule.js
//
// The data layer for the loan car calendar (/tracking → Loan Cars and the job
// card's Loan Car tab).
//
// One SWR key per visible range carries the fleet, the bookings, the
// unavailable periods and the caller's capabilities. Availability is derived
// here from the loan car model against a "now" that ticks every minute, so a
// car turns Due today → Overdue on screen without a refetch. Mutations go
// through `loanCarApi` and revalidate the key once.

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR, { preload } from "swr";
import { swrConfig } from "@/lib/swr/config";
import {
  buildCalendarRange,
  isActiveCar,
  nowStamp,
  resolveCarAvailability,
  summariseAvailability,
} from "@/features/loanCars/loanCarModel";

const BASE = "/api/tracking/loan-cars";

/** fetch wrapper that keeps the server's JSON (conflicts, alternatives) on errors. */
async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || "The loan car request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload?.data ?? null;
}

const scheduleFetcher = (url) => request(url);

export const loanCarApi = {
  createBooking: (booking, { source = "form" } = {}) =>
    request(`${BASE}/bookings`, { method: "POST", body: { booking, source } }),
  getBooking: (bookingId) => request(`${BASE}/bookings/${bookingId}`),
  updateBooking: (bookingId, booking) =>
    request(`${BASE}/bookings/${bookingId}`, { method: "PATCH", body: { action: "update", booking } }),
  adjustBooking: (bookingId, booking) =>
    request(`${BASE}/bookings/${bookingId}`, { method: "PATCH", body: { action: "adjust", booking } }),
  handOver: (bookingId, payload) =>
    request(`${BASE}/bookings/${bookingId}`, { method: "PATCH", body: { action: "handover", payload } }),
  returnBooking: (bookingId, payload) =>
    request(`${BASE}/bookings/${bookingId}`, { method: "PATCH", body: { action: "return", payload } }),
  reopenBooking: (bookingId) =>
    request(`${BASE}/bookings/${bookingId}`, { method: "PATCH", body: { action: "reopen" } }),
  deleteBooking: (bookingId) => request(`${BASE}/bookings/${bookingId}`, { method: "DELETE" }),
  lookup: (term) => request(`${BASE}/lookup?q=${encodeURIComponent(term)}`),
  getCar: (loanCarId) => request(`${BASE}/fleet/${loanCarId}`),
  createCar: (car) => request(`${BASE}/fleet`, { method: "POST", body: { car } }),
  updateCar: (loanCarId, car) => request(`${BASE}/fleet/${loanCarId}`, { method: "PATCH", body: { car } }),
  deleteCar: (loanCarId) => request(`${BASE}/fleet/${loanCarId}`, { method: "DELETE" }),
  savePeriod: (period, { periodId = null, allowBookingClash = false } = {}) =>
    request(`${BASE}/unavailability${periodId ? `?periodId=${periodId}` : ""}`, {
      method: periodId ? "PATCH" : "POST",
      body: { period, allowBookingClash },
    }),
  deletePeriod: (periodId) => request(`${BASE}/unavailability?periodId=${periodId}`, { method: "DELETE" }),
};

/** A "now" stamp that advances once a minute. */
export function useNowStamp() {
  const [now, setNow] = useState(() => nowStamp());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowStamp()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const EMPTY = [];

const scheduleKey = ({ startDate, endDate, todayKey }) =>
  startDate && endDate
    ? `${BASE}?${new URLSearchParams({ start: startDate, end: endDate, today: todayKey }).toString()}`
    : null;

/**
 * Start this month's schedule request before the calendar mounts.
 *
 * /tracking/Loan-car calls this on mount, in parallel with the calendar's
 * chunk, instead of the request waiting for the chunk to download and render.
 * It builds exactly the key the panel's first render asks for (the month
 * containing the browser's local today), so useSWR picks the in-flight request
 * up rather than starting a second one. The API still decides who may read it.
 */
export function preloadLoanCarSchedule() {
  const todayKey = nowStamp().slice(0, 10);
  const range = buildCalendarRange({ rangeType: "month", anchorKey: todayKey, todayKey });
  const key = scheduleKey({ startDate: range.startKey, endDate: range.endKey, todayKey });
  return key ? preload(key, scheduleFetcher) : Promise.resolve(null);
}

/**
 * @param {{ startDate: string, endDate: string, todayKey: string, enabled?: boolean }} params
 */
export function useLoanCarSchedule({ startDate, endDate, todayKey, enabled = true }) {
  const key = enabled ? scheduleKey({ startDate, endDate, todayKey }) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, scheduleFetcher, {
    ...swrConfig,
    keepPreviousData: true,
    // Reception, the workshop and management all watch the same board; a
    // minute keeps it honest without hammering the API from a tab left open.
    refreshInterval: 60_000,
  });

  const now = useNowStamp();
  const allCars = data?.cars ?? EMPTY;
  const bookings = data?.bookings ?? EMPTY;
  const periods = data?.periods ?? EMPTY;
  const cars = useMemo(() => allCars.filter(isActiveCar), [allCars]);

  const availabilityByCar = useMemo(() => {
    const map = {};
    for (const car of allCars) {
      map[car.loanCarId] = resolveCarAvailability(car, { bookings, periods }, now);
    }
    return map;
  }, [allCars, bookings, periods, now]);

  const summary = useMemo(() => {
    const activeOnly = {};
    for (const car of cars) activeOnly[car.loanCarId] = availabilityByCar[car.loanCarId];
    return summariseAvailability(activeOnly);
  }, [availabilityByCar, cars]);

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    cars,
    allCars,
    bookings,
    periods,
    availabilityByCar,
    summary,
    now,
    capabilities: data?.capabilities ?? null,
    migrationPending: Boolean(data?.migrationPending),
    loading: isLoading && !data,
    refreshing: isValidating,
    error: error?.message || "",
    refresh,
  };
}

export default useLoanCarSchedule;
