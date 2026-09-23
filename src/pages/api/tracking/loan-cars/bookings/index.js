// file location: src/pages/api/tracking/loan-cars/bookings/index.js
//
// POST — create a loan booking (New loan booking and Quick add both land here).
// Refuses overlapping bookings with a 409 that lists the clash and the cars
// that are free for the same window.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import { validateBookingWindow } from "@/features/loanCars/loanCarModel";
import { buildBookingColumns, getLoanCar, insertBooking, withBookingActor } from "@/lib/database/loanCars";
import { EDITABLE_BOOKING_KEYS, describeBooking, pickKeys } from "@/lib/loanCars/bookingInput";
import {
  actorFor,
  checkBookingAvailability,
  methodNotAllowed,
  recordLoanCarChange,
  requireCapability,
  sendConflict,
  sendServerError,
} from "@/lib/loanCars/loanCarApi";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  if (!requireCapability(res, session, "book")) return;

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const input = pickKeys(body.booking || {}, EDITABLE_BOOKING_KEYS);
  if (!input.endDate) input.endDate = input.startDate;

  const invalid = validateBookingWindow(input);
  if (invalid) {
    res.status(400).json({ success: false, message: invalid });
    return;
  }

  try {
    const car = await getLoanCar(input.loanCarId);
    if (!car) {
      res.status(404).json({ success: false, message: "That loan car no longer exists." });
      return;
    }

    const availability = await checkBookingAvailability(input);
    if (availability.conflicts.length > 0) {
      sendConflict(res, availability);
      return;
    }

    const actor = await actorFor(req, res, session);
    const columns = await withBookingActor(await buildBookingColumns({ ...input, status: "reserved" }), actor.actorUserId, {
      creating: true,
    });
    const booking = await insertBooking(columns);

    await recordLoanCarChange({
      actor,
      bookingId: booking.bookingId,
      loanCarId: booking.loanCarId,
      eventType: "loan_booking.created",
      summary: `Booked ${describeBooking(booking, car)}`,
      detail: { source: body.source === "quick_add" ? "quick_add" : "form", externalReference: booking.externalReference || null },
      after: booking,
    });

    res.status(201).json({ success: true, data: { booking } });
  } catch (error) {
    sendServerError(res, error, "Unable to save the loan booking");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
