// file location: src/pages/api/tracking/loan-cars/fleet/[loanCarId].js
//
//   GET     the vehicle, its unavailable periods, fuel / mileage readings and
//           activity (view)
//   PATCH   edit the vehicle (manageFleet)
//   DELETE  remove a vehicle that has never been booked (manageFleet). A car
//           with booking history is retired (status "inactive") instead, so
//           the history — and any future reporting on it — survives.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import {
  buildCarColumns,
  countBookingsForCar,
  deleteLoanCar,
  getLoanCar,
  listCarEvents,
  listFuelHistory,
  listLoanCars,
  listUnavailabilityForCar,
  updateLoanCar,
} from "@/lib/database/loanCars";
import {
  UUID_RE,
  actorFor,
  capabilitiesFor,
  methodNotAllowed,
  recordLoanCarChange,
  sendServerError,
} from "@/lib/loanCars/loanCarApi";

const CAR_LABELS = {
  reg: "Registration",
  makeModel: "Make / model",
  colour: "Colour",
  mileage: "Mileage",
  fuelLevel: "Fuel",
  status: "Active state",
  notes: "Notes",
  transmission: "Transmission",
  fuelType: "Fuel type",
  motDue: "MOT due",
  serviceDue: "Service due",
  serviceDueMileage: "Service due mileage",
};

async function handler(req, res, session) {
  const loanCarId = String(req.query.loanCarId || "");
  if (!UUID_RE.test(loanCarId)) {
    res.status(400).json({ success: false, message: "Invalid loan car id" });
    return;
  }

  const capabilities = capabilitiesFor(session);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }

  try {
    const before = await getLoanCar(loanCarId);
    if (!before) {
      res.status(404).json({ success: false, message: "Loan car not found" });
      return;
    }

    if (req.method === "GET") {
      const [periods, fuelHistory, events] = await Promise.all([
        listUnavailabilityForCar(loanCarId),
        listFuelHistory(loanCarId),
        listCarEvents(loanCarId),
      ]);
      res.status(200).json({ success: true, data: { car: before, periods, fuelHistory, events } });
      return;
    }

    if (!capabilities.manageFleet) {
      res.status(403).json({ success: false, message: "Your role cannot manage the loan fleet." });
      return;
    }

    const actor = await actorFor(req, res, session);

    if (req.method === "DELETE") {
      const bookingCount = await countBookingsForCar(loanCarId);
      if (bookingCount > 0) {
        res.status(409).json({
          success: false,
          message: `${before.reg} has ${bookingCount} booking${bookingCount === 1 ? "" : "s"} on record. Set it to inactive instead so its history is kept.`,
        });
        return;
      }
      await deleteLoanCar(loanCarId);
      await recordLoanCarChange({
        actor,
        loanCarId: null,
        eventType: "loan_car.deleted",
        summary: `Removed ${before.reg} from the loan fleet`,
        detail: { snapshot: before },
        entityType: "loan_car",
        entityId: loanCarId,
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
    const input = body.car && typeof body.car === "object" ? { ...body.car } : {};
    if (Object.prototype.hasOwnProperty.call(input, "reg")) {
      input.reg = String(input.reg || "").replace(/\s+/g, " ").trim().toUpperCase();
      if (!input.reg) {
        res.status(400).json({ success: false, message: "Enter the loan car registration." });
        return;
      }
      const compact = input.reg.replace(/\s+/g, "");
      const cars = await listLoanCars();
      if (cars.some((car) => car.loanCarId !== loanCarId && car.reg.replace(/\s+/g, "") === compact)) {
        res.status(409).json({ success: false, message: `${input.reg} is already in the loan fleet.` });
        return;
      }
    }

    const columns = await buildCarColumns(input);
    if (Object.keys(columns).length === 0) {
      res.status(400).json({ success: false, message: "Nothing to change" });
      return;
    }
    const car = await updateLoanCar(loanCarId, columns);
    const changed = Object.keys(CAR_LABELS).filter(
      (key) => Object.prototype.hasOwnProperty.call(input, key) && String(before[key] ?? "") !== String(car[key] ?? "")
    );
    if (changed.length > 0) {
      await recordLoanCarChange({
        actor,
        loanCarId,
        eventType: before.status !== car.status ? `loan_car.${car.status === "inactive" ? "retired" : "reactivated"}` : "loan_car.updated",
        summary: `${car.reg}: updated ${changed.map((key) => CAR_LABELS[key]).join(", ")}`,
        entityType: "loan_car",
        before,
        after: car,
      });
    }
    res.status(200).json({ success: true, data: { car } });
  } catch (error) {
    sendServerError(res, error, "Unable to update the loan car");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
