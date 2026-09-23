// file location: src/lib/loanCars/loanCarApi.js
//
// Shared plumbing for the /api/tracking/loan-cars/* routes: capability
// resolution, the acting user, conflict checking and the two records every
// accepted change writes — a row on tracking_loan_car_events (the trail the
// page renders) and a hash-chained platform audit entry via writeAuditLog.

import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext, shallowDiff } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { resolveLoanCarCapabilities } from "@/features/loanCars/loanCarAccess";
import {
  describeConflict,
  findAlternativeCars,
  findBookingConflicts,
} from "@/features/loanCars/loanCarModel";
import {
  listBookingsTouching,
  listLoanCars,
  listUnavailability,
  recordLoanCarEvent,
} from "@/lib/database/loanCars";

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const capabilitiesFor = (session) => {
  const roles = normalizeRoles(session?.user?.roles ?? []);
  return resolveLoanCarCapabilities(roles, hasAllAccessRole(roles));
};

/**
 * Stop the request with a 403 unless the session holds `capability`.
 * @returns {object|null} The capabilities, or null when the response was sent.
 */
export function requireCapability(res, session, capability) {
  const capabilities = capabilitiesFor(session);
  if (capabilities[capability] !== true) {
    res.status(403).json({ success: false, message: "Your role cannot make this loan car change." });
    return null;
  }
  return capabilities;
}

export async function actorFor(req, res, session) {
  const auditContext = await getAuditContext(req, res);
  return {
    auditContext,
    actorUserId: auditContext.actorUserId,
    actorName: session?.user?.name || session?.user?.email || null,
  };
}

/**
 * Conflicts for a candidate booking, and — when there are any — the other
 * cars that are free for the same window.
 */
export async function checkBookingAvailability(candidate) {
  const window = { startDate: candidate.startDate, endDate: candidate.endDate || candidate.startDate };
  const [bookings, periods, cars] = await Promise.all([
    listBookingsTouching(window),
    listUnavailability(window),
    listLoanCars(),
  ]);
  const conflicts = findBookingConflicts(candidate, { bookings, periods });
  if (conflicts.length === 0) return { conflicts: [], alternatives: [] };
  const alternatives = findAlternativeCars(candidate, { cars, bookings, periods }).map((car) => ({
    loanCarId: car.loanCarId,
    reg: car.reg,
    makeModel: car.makeModel,
  }));
  return { conflicts, alternatives };
}

/** The 409 body the booking form turns into "taken — try one of these". */
export function sendConflict(res, { conflicts, alternatives }) {
  res.status(409).json({
    success: false,
    code: "loan_car_booking_conflict",
    message: describeConflict(conflicts[0]) || "That loan car is not free for those dates.",
    conflicts: conflicts.map((conflict) => ({
      type: conflict.type,
      description: describeConflict(conflict),
      id: conflict.item.bookingId || conflict.item.periodId || null,
    })),
    alternatives,
  });
}

/** Write the page-facing trail row and the platform audit entry. */
export async function recordLoanCarChange({
  actor,
  bookingId = null,
  loanCarId = null,
  eventType,
  summary,
  detail = {},
  entityType = "loan_car_booking",
  entityId = null,
  before = null,
  after = null,
}) {
  await recordLoanCarEvent({
    bookingId,
    loanCarId,
    eventType,
    summary,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    detail,
  });
  await writeAuditLog({
    ...actor.auditContext,
    action: eventType.replace(/\./g, "_"),
    entityType,
    entityId: entityId || bookingId || loanCarId,
    diff: before && after ? shallowDiff(before, after) : null,
    reason: summary || null,
  });
}

export function sendServerError(res, error, fallback) {
  console.error(fallback, error);
  res.status(500).json({ success: false, message: error?.message || fallback });
}

export const methodNotAllowed = (res, allow) => {
  res.setHeader("Allow", allow);
  res.status(405).json({ success: false, message: "Method not allowed" });
};
