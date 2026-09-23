// file location: src/pages/api/tracking/loan-cars/fleet/index.js
//
// POST — add a vehicle to the loan fleet (Manage fleet).

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import { buildCarColumns, insertLoanCar, listLoanCars } from "@/lib/database/loanCars";
import {
  actorFor,
  methodNotAllowed,
  recordLoanCarChange,
  requireCapability,
  sendServerError,
} from "@/lib/loanCars/loanCarApi";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  if (!requireCapability(res, session, "manageFleet")) return;

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const input = body.car && typeof body.car === "object" ? body.car : {};
  const reg = String(input.reg || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!reg) {
    res.status(400).json({ success: false, message: "Enter the loan car registration." });
    return;
  }

  try {
    const cars = await listLoanCars();
    const compact = reg.replace(/\s+/g, "");
    if (cars.some((car) => car.reg.replace(/\s+/g, "") === compact)) {
      res.status(409).json({ success: false, message: `${reg} is already in the loan fleet.` });
      return;
    }

    // New vehicles join at the front of the calendar, where they are noticed.
    const sortOrder = Math.min(0, ...cars.map((car) => Number(car.sortOrder) || 0)) - 1;
    const columns = await buildCarColumns({ ...input, reg, sortOrder, status: input.status || "active" });
    const car = await insertLoanCar(columns);
    const actor = await actorFor(req, res, session);
    await recordLoanCarChange({
      actor,
      loanCarId: car.loanCarId,
      eventType: "loan_car.added",
      summary: `Added ${car.reg}${car.makeModel ? ` (${car.makeModel})` : ""} to the loan fleet`,
      entityType: "loan_car",
      after: car,
    });
    res.status(201).json({ success: true, data: { car } });
  } catch (error) {
    sendServerError(res, error, "Unable to add the loan car");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
