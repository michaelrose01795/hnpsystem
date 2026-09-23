// file location: src/pages/api/tracking/loan-cars/bookings/[bookingId].js
//
//   GET                               the booking and its activity trail
//   PATCH { action: "update", booking }    edit details           (book)
//   PATCH { action: "adjust", booking }    drag dates on calendar (adjust)
//   PATCH { action: "handover", payload }  mark the car out       (handover)
//   PATCH { action: "return", payload }    quick return           (handover)
//   PATCH { action: "reopen" }             undo a mistaken return (handover)
//   DELETE                            remove the booking     (remove)
//
// Every accepted change writes the activity trail and the platform audit log.
// A deleted booking's trail is kept (the events table has no FK to bookings).

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import {
  BOOKING_STATUS,
  formatBookingWindow,
  fuelLevelDisplayLabel,
  normaliseDateKey,
  normaliseTime,
  toDateKey,
  toTimeKey,
  unavailableReasonLabel,
  validateBookingWindow,
} from "@/features/loanCars/loanCarModel";
import {
  buildBookingColumns,
  buildCarColumns,
  deleteBooking,
  getBooking,
  getLoanCar,
  insertUnavailability,
  isLoanCarTrackerMigrationPending,
  listBookingEvents,
  updateBooking,
  updateLoanCar,
  withBookingActor,
} from "@/lib/database/loanCars";
import {
  ADJUST_BOOKING_KEYS,
  EDITABLE_BOOKING_KEYS,
  describeBooking,
  pickKeys,
  touchesWindow,
} from "@/lib/loanCars/bookingInput";
import {
  UUID_RE,
  actorFor,
  capabilitiesFor,
  checkBookingAvailability,
  methodNotAllowed,
  recordLoanCarChange,
  sendConflict,
  sendServerError,
} from "@/lib/loanCars/loanCarApi";

const ACTION_CAPABILITY = {
  update: "book",
  adjust: "adjust",
  handover: "handover",
  return: "handover",
  reopen: "handover",
};

// Actions that need the tracker migration's lifecycle columns.
const LIFECYCLE_ACTIONS = new Set(["handover", "return", "reopen"]);

const FIELD_LABELS = {
  loanCarId: "Loan car",
  startDate: "Start date",
  endDate: "End date",
  startTime: "Start time",
  endTime: "End time",
  externalReference: "External reference",
  jobNumber: "Job",
  customerName: "Customer",
  customerPhone: "Phone",
  customerEmail: "Email",
  customerAddress: "Address",
  customerPostcode: "Postcode",
  vehicleReg: "Customer vehicle",
  vehicleMakeModel: "Customer vehicle model",
  mileage: "Customer vehicle mileage",
  insuranceProvider: "Insurance provider",
  insurancePolicyNumber: "Policy number",
  licenceNumber: "Licence number",
  dateOfBirth: "Date of birth",
  notes: "Notes",
};

const changedFieldLabels = (before, after, keys) =>
  keys
    .filter((key) => FIELD_LABELS[key] && String(before[key] ?? "") !== String(after[key] ?? ""))
    .map((key) => FIELD_LABELS[key]);

const readingText = (mileage, fuel) =>
  [mileage !== "" && mileage != null ? `${mileage} mi` : "", fuel !== "" && fuel != null ? `fuel ${fuelLevelDisplayLabel(fuel)}` : ""]
    .filter(Boolean)
    .join(", ");

async function handleUpdate({ res, before, input, action }) {
  const merged = { ...before, ...input };
  if (!merged.endDate) merged.endDate = merged.startDate;
  const invalid = validateBookingWindow(merged);
  if (invalid) return { error: [400, invalid] };

  if (touchesWindow(input)) {
    const availability = await checkBookingAvailability(merged);
    if (availability.conflicts.length > 0) {
      sendConflict(res, availability);
      return { handled: true };
    }
  }

  const columns = await buildBookingColumns(input);
  const changed = changedFieldLabels(before, merged, Object.keys(input));
  const summary =
    action === "adjust"
      ? `Duration changed to ${formatBookingWindow(merged)}`
      : changed.length > 0
        ? `Updated ${changed.join(", ")}`
        : "Booking saved (no changes)";
  return { columns, summary, eventType: action === "adjust" ? "loan_booking.adjusted" : "loan_booking.updated" };
}

function handleHandover({ before, payload, car }) {
  if (before.status === BOOKING_STATUS.RETURNED) return { error: [409, "This loan has already been returned."] };
  const mileage = payload.loanMileageOut ?? car?.mileage ?? "";
  const fuel = payload.loanFuelOut ?? car?.fuelLevel ?? "";
  const now = new Date();
  const input = {
    status: BOOKING_STATUS.OUT,
    loanMileageOut: mileage,
    loanFuelOut: fuel,
    handedOverAt: now.toISOString(),
  };
  // Record the actual collection time when the booking had none.
  if (!before.startTime && before.startDate === toDateKey(now)) input.startTime = toTimeKey(now);
  const reading = readingText(mileage, fuel);
  return { input, summary: `Handed over${reading ? ` · ${reading}` : ""}`, eventType: "loan_booking.handed_over" };
}

function handleReturn({ before, payload }) {
  if (before.status === BOOKING_STATUS.RETURNED) return { error: [409, "This loan has already been returned."] };
  const now = new Date();
  const returnedDate = normaliseDateKey(payload.returnedDate) || toDateKey(now);
  const returnedTime = normaliseTime(payload.returnedTime) || toTimeKey(now);
  if (returnedDate < before.startDate) return { error: [400, "The return date cannot be before the loan started."] };
  const hasDamage = payload.hasDamage === true;
  const returnNotes = String(payload.returnNotes || "").trim();
  if (hasDamage && !returnNotes) return { error: [400, "Describe the damage or issue before recording the return."] };
  const input = {
    status: BOOKING_STATUS.RETURNED,
    returnedDate,
    returnedTime,
    loanMileageIn: payload.loanMileageIn ?? "",
    loanFuelIn: payload.loanFuelIn ?? "",
    hasDamage,
    returnNotes,
  };
  const reading = readingText(input.loanMileageIn, input.loanFuelIn);
  const summary = [`Returned ${returnedDate} ${returnedTime}`, reading, hasDamage ? `damage: ${returnNotes}` : ""]
    .filter(Boolean)
    .join(" · ");
  return { input, summary, eventType: "loan_booking.returned" };
}

function handleReopen({ before }) {
  if (before.status !== BOOKING_STATUS.RETURNED) return { error: [409, "Only a returned loan can be reopened."] };
  return {
    input: {
      status: BOOKING_STATUS.OUT,
      returnedDate: null,
      returnedTime: null,
      loanMileageIn: null,
      loanFuelIn: null,
      hasDamage: false,
      returnNotes: null,
    },
    summary: "Return undone — loan reopened",
    eventType: "loan_booking.reopened",
  };
}

async function handler(req, res, session) {
  const bookingId = String(req.query.bookingId || "");
  if (!UUID_RE.test(bookingId)) {
    res.status(400).json({ success: false, message: "Invalid booking id" });
    return;
  }

  const capabilities = capabilitiesFor(session);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }

  try {
    if (req.method === "GET") {
      const [booking, events] = await Promise.all([getBooking(bookingId), listBookingEvents(bookingId)]);
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found" });
        return;
      }
      res.status(200).json({ success: true, data: { booking, events } });
      return;
    }

    if (req.method === "DELETE") {
      if (!capabilities.remove) {
        res.status(403).json({ success: false, message: "Your role cannot delete loan bookings." });
        return;
      }
      const before = await getBooking(bookingId);
      if (!before) {
        res.status(404).json({ success: false, message: "Booking not found" });
        return;
      }
      const car = await getLoanCar(before.loanCarId);
      const actor = await actorFor(req, res, session);
      await deleteBooking(bookingId);
      await recordLoanCarChange({
        actor,
        bookingId,
        loanCarId: before.loanCarId,
        eventType: "loan_booking.deleted",
        summary: `Deleted ${describeBooking(before, car)}`,
        // The row is gone; keep enough of it that the trail still reads.
        detail: { snapshot: before },
        before,
      });
      res.status(200).json({ success: true });
      return;
    }

    if (req.method !== "PATCH") {
      methodNotAllowed(res, "GET, PATCH, DELETE");
      return;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = String(body.action || "update");
    const capability = ACTION_CAPABILITY[action];
    if (!capability) {
      res.status(400).json({ success: false, message: `Unknown action "${action}".` });
      return;
    }
    if (capabilities[capability] !== true) {
      res.status(403).json({ success: false, message: "Your role cannot make this loan car change." });
      return;
    }
    if (LIFECYCLE_ACTIONS.has(action) && (await isLoanCarTrackerMigrationPending())) {
      res.status(503).json({
        success: false,
        message: "Hand-over and returns need the loan car tracker database update. Ask an administrator to apply it.",
      });
      return;
    }

    const before = await getBooking(bookingId);
    if (!before) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    const car = await getLoanCar(before.loanCarId);
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

    let result;
    if (action === "update" || action === "adjust") {
      const keys = action === "adjust" ? ADJUST_BOOKING_KEYS : EDITABLE_BOOKING_KEYS;
      const input = pickKeys(body.booking || {}, keys);
      if (Object.keys(input).length === 0) {
        res.status(400).json({ success: false, message: "Nothing to change" });
        return;
      }
      if (before.status === BOOKING_STATUS.RETURNED && touchesWindow(input)) {
        res.status(409).json({ success: false, message: "A returned loan's dates can no longer be changed." });
        return;
      }
      result = await handleUpdate({ res, before, input, action });
      if (result.handled) return;
    } else {
      const handlers = { handover: handleHandover, return: handleReturn, reopen: handleReopen };
      result = handlers[action]({ before, payload, car });
      if (!result.error) result.columns = await buildBookingColumns(result.input);
    }

    if (result.error) {
      res.status(result.error[0]).json({ success: false, message: result.error[1] });
      return;
    }

    const actor = await actorFor(req, res, session);
    const after = await updateBooking(bookingId, await withBookingActor(result.columns, actor.actorUserId));

    // Readings taken at hand-over / return are the car's latest readings too.
    const notes = [];
    if (car && (action === "handover" || action === "return")) {
      const mileage = action === "return" ? after.loanMileageIn : after.loanMileageOut;
      const fuel = action === "return" ? after.loanFuelIn : after.loanFuelOut;
      const carInput = {};
      if (mileage !== "" && mileage != null) carInput.mileage = mileage;
      if (fuel !== "" && fuel != null) carInput.fuelLevel = fuel;
      if (Object.keys(carInput).length > 0) await updateLoanCar(car.loanCarId, await buildCarColumns(carInput));
    }

    // Damage reported at return can take the car off the road straight away.
    if (action === "return" && after.hasDamage && payload.markUnavailable === true) {
      const period = await insertUnavailability({
        loanCarId: after.loanCarId,
        startDate: after.returnedDate,
        endDate: after.returnedDate,
        reason: "damage",
        notes: after.returnNotes,
        createdBy: actor.actorUserId,
      });
      notes.push(`${car?.reg || "Vehicle"} marked unavailable (${unavailableReasonLabel(period.reason)})`);
    }

    await recordLoanCarChange({
      actor,
      bookingId,
      loanCarId: after.loanCarId,
      eventType: result.eventType,
      summary: [result.summary, ...notes].join(" · "),
      detail: { action },
      before,
      after,
    });

    const events = await listBookingEvents(bookingId);
    res.status(200).json({ success: true, data: { booking: after, events } });
  } catch (error) {
    sendServerError(res, error, "Unable to update the loan booking");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
