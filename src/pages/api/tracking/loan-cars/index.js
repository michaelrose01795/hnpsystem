// file location: src/pages/api/tracking/loan-cars/index.js
//
// The loan car calendar in one request: the fleet, the bookings for the
// visible range (plus anything outstanding today), the unavailable periods and
// what the caller's role may do. Everything here is a read; writes live in the
// sibling routes.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import { addDays } from "@/features/loanCars/loanCarModel";
import {
  isLoanCarTrackerMigrationPending,
  listBookingsForSchedule,
  listLoanCars,
  listUnavailability,
} from "@/lib/database/loanCars";
import { ISO_DATE_RE, capabilitiesFor, methodNotAllowed, sendServerError } from "@/lib/loanCars/loanCarApi";

// A month view is the widest range the page asks for; anything larger is a
// malformed or hostile request.
const MAX_RANGE_DAYS = 62;

async function handler(req, res, session) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }

  const capabilities = capabilitiesFor(session);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }

  // "Today" comes from the browser: the dealership's local day, which is what
  // every Due today / Overdue decision on the page is measured against.
  const serverToday = new Date().toISOString().slice(0, 10);
  const todayKey = ISO_DATE_RE.test(String(req.query.today || "")) ? String(req.query.today) : serverToday;
  const startDate = ISO_DATE_RE.test(String(req.query.start || "")) ? String(req.query.start) : addDays(todayKey, -2);
  let endDate = ISO_DATE_RE.test(String(req.query.end || "")) ? String(req.query.end) : addDays(startDate, 13);
  if (endDate < startDate || addDays(startDate, MAX_RANGE_DAYS) < endDate) endDate = addDays(startDate, 13);

  try {
    // Periods are fetched for the visible range and today, so a column's
    // Unavailable state is right even when today is off screen.
    const periodStart = todayKey < startDate ? todayKey : startDate;
    const periodEnd = todayKey > endDate ? todayKey : endDate;
    const [cars, bookings, periods, migrationPending] = await Promise.all([
      listLoanCars(),
      listBookingsForSchedule({ startDate, endDate, todayKey }),
      listUnavailability({ startDate: periodStart, endDate: periodEnd }),
      isLoanCarTrackerMigrationPending(),
    ]);

    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({
      success: true,
      data: { startDate, endDate, todayKey, cars, bookings, periods, capabilities, migrationPending },
    });
  } catch (error) {
    sendServerError(res, error, "Unable to load the loan car calendar");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
