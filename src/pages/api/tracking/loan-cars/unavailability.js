// file location: src/pages/api/tracking/loan-cars/unavailability.js
//
// Vehicle unavailable periods (service, MOT, repair, damage, other).
//
//   POST   { period }                  add        (manageFleet)
//   PATCH  ?periodId=… { period }      edit       (manageFleet)
//   DELETE ?periodId=…                 remove     (manageFleet)
//
// A period that would cover existing bookings is refused with a 409 listing
// them, unless the request says `allowBookingClash: true` (the drawer's "Save
// anyway") — a car can genuinely break down while someone is booked on it.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import {
  UNAVAILABLE_REASONS,
  customerSurname,
  formatShortDate,
  normaliseDateKey,
  unavailableReasonLabel,
} from "@/features/loanCars/loanCarModel";
import {
  deleteUnavailability,
  getLoanCar,
  getUnavailability,
  insertUnavailability,
  isLoanCarTrackerMigrationPending,
  listBookingsTouching,
  updateUnavailability,
} from "@/lib/database/loanCars";
import {
  UUID_RE,
  actorFor,
  methodNotAllowed,
  recordLoanCarChange,
  requireCapability,
  sendServerError,
} from "@/lib/loanCars/loanCarApi";

const REASONS = new Set(UNAVAILABLE_REASONS.map((reason) => reason.value));

const readPeriod = (body) => {
  const input = body?.period && typeof body.period === "object" ? body.period : {};
  const startDate = normaliseDateKey(input.startDate);
  const endDate = normaliseDateKey(input.endDate) || startDate;
  return {
    loanCarId: String(input.loanCarId || ""),
    startDate,
    endDate,
    reason: REASONS.has(input.reason) ? input.reason : "other",
    notes: input.notes || "",
  };
};

const describePeriod = (period, car) =>
  `${car?.reg || "Vehicle"} unavailable (${unavailableReasonLabel(period.reason)}) ${formatShortDate(period.startDate)} – ${formatShortDate(period.endDate)}`;

async function handler(req, res, session) {
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
    methodNotAllowed(res, "POST, PATCH, DELETE");
    return;
  }
  if (!requireCapability(res, session, "manageFleet")) return;

  try {
    if (await isLoanCarTrackerMigrationPending()) {
      res.status(503).json({
        success: false,
        message: "Unavailable periods need the loan car tracker database update. Ask an administrator to apply it.",
      });
      return;
    }

    const actor = await actorFor(req, res, session);
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (req.method === "DELETE") {
      const periodId = String(req.query.periodId || "");
      const before = UUID_RE.test(periodId) ? await getUnavailability(periodId) : null;
      if (!before) {
        res.status(404).json({ success: false, message: "Unavailable period not found" });
        return;
      }
      const car = await getLoanCar(before.loanCarId);
      await deleteUnavailability(periodId);
      await recordLoanCarChange({
        actor,
        loanCarId: before.loanCarId,
        eventType: "loan_car.unavailability_removed",
        summary: `Cleared: ${describePeriod(before, car)}`,
        entityType: "loan_car_unavailability",
        entityId: periodId,
        before,
      });
      res.status(200).json({ success: true });
      return;
    }

    const period = readPeriod(body);
    const existing = req.method === "PATCH" ? await getUnavailability(String(req.query.periodId || "")) : null;
    if (req.method === "PATCH" && !existing) {
      res.status(404).json({ success: false, message: "Unavailable period not found" });
      return;
    }
    if (existing) period.loanCarId = existing.loanCarId;
    if (!UUID_RE.test(period.loanCarId)) {
      res.status(400).json({ success: false, message: "Choose a vehicle." });
      return;
    }
    if (!period.startDate || period.endDate < period.startDate) {
      res.status(400).json({ success: false, message: "Enter a start date, and an end date on or after it." });
      return;
    }

    const car = await getLoanCar(period.loanCarId);
    if (!car) {
      res.status(404).json({ success: false, message: "Loan car not found" });
      return;
    }

    if (body.allowBookingClash !== true) {
      const clashes = (await listBookingsTouching(period)).filter(
        (booking) => booking.loanCarId === period.loanCarId && booking.status !== "returned"
      );
      if (clashes.length > 0) {
        res.status(409).json({
          success: false,
          code: "loan_car_unavailability_clash",
          message: `${car.reg} has ${clashes.length} booking${clashes.length === 1 ? "" : "s"} in that period.`,
          conflicts: clashes.map((booking) => ({
            id: booking.bookingId,
            description: `${customerSurname(booking.customerName) || "Booking"}${booking.jobNumber ? ` #${booking.jobNumber}` : ""} ${formatShortDate(booking.startDate)} – ${formatShortDate(booking.endDate)}`,
          })),
        });
        return;
      }
    }

    const saved = existing
      ? await updateUnavailability(existing.periodId, period)
      : await insertUnavailability({ ...period, createdBy: actor.actorUserId });

    await recordLoanCarChange({
      actor,
      loanCarId: saved.loanCarId,
      eventType: existing ? "loan_car.unavailability_updated" : "loan_car.unavailability_added",
      summary: describePeriod(saved, car) + (saved.notes ? ` · ${saved.notes}` : ""),
      entityType: "loan_car_unavailability",
      entityId: saved.periodId,
      before: existing,
      after: saved,
    });

    res.status(existing ? 200 : 201).json({ success: true, data: { period: saved } });
  } catch (error) {
    sendServerError(res, error, "Unable to save the unavailable period");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
