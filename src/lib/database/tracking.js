// file location: src/lib/database/tracking.js
import { getDatabaseClient } from "@/lib/database/client"; // import supabase service client

const supabase = getDatabaseClient(); // create singleton client

const normaliseDateKey = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const toNullableInteger = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

// Fuel is stored on a 0–8 scale (Empty … Full in eighths), matching the
// eight-segment FuelGauge and the tracking_loan_cars_fuel_level_check constraint.
const normalizeFuelLevel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(8, Math.max(0, Math.round(parsed)));
};

const normalizeLoanCar = (row) => ({
  id: row.loan_car_id,
  loanCarId: row.loan_car_id,
  reg: row.reg || "",
  name: row.name || row.reg || "Loan car",
  makeModel: row.make_model || "",
  colour: row.colour || "",
  mileage: row.mileage ?? "",
  fuelLevel: normalizeFuelLevel(row.fuel_level),
  status: row.status || "active",
  sortOrder: row.sort_order ?? 0,
  notes: row.notes || "",
  lastVehicleUpdateAt: row.last_vehicle_update_at || row.updated_at || "",
});

const normalizeLoanCarFuelHistory = (row) => ({
  id: row.history_id,
  historyId: row.history_id,
  loanCarId: row.loan_car_id,
  reg: row.reg || "",
  fuelLevel: normalizeFuelLevel(row.fuel_level),
  mileage: row.mileage ?? "",
  recordedAt: row.recorded_at || "",
});

const normalizeLoanCarBooking = (row) => ({
  id: row.booking_id,
  bookingId: row.booking_id,
  loanCarId: row.loan_car_id,
  date: row.start_date,
  startDate: row.start_date,
  endDate: row.end_date,
  jobId: row.job_id || null,
  jobNumber: row.job_number || "",
  customer: row.customer_name || "",
  customerName: row.customer_name || "",
  customerEmail: row.customer_email || "",
  customerPhone: row.customer_phone || "",
  customerAddress: row.customer_address || "",
  customerPostcode: row.customer_postcode || "",
  reg: row.vehicle_reg || "",
  vehicleReg: row.vehicle_reg || "",
  vehicleMakeModel: row.vehicle_make_model || "",
  mileage: row.mileage || "",
  insuranceProvider: row.insurance_provider || "",
  insurancePolicyNumber: row.insurance_policy_number || "",
  licenceNumber: row.licence_number || "",
  dateOfBirth: row.date_of_birth || "",
  notes: row.notes || "",
});

const loanCarPayload = (car) => ({
  reg: String(car.reg || "").trim().toUpperCase(),
  name: String(car.name || "").trim() || String(car.reg || "").trim().toUpperCase(),
  make_model: String(car.makeModel ?? car.make_model ?? "").trim() || null,
  colour: String(car.colour ?? "").trim() || null,
  mileage: toNullableInteger(car.mileage),
  fuel_level: normalizeFuelLevel(car.fuelLevel ?? car.fuel_level),
  last_vehicle_update_at:
    car.updateVehicleState || car.mileage !== undefined || car.fuelLevel !== undefined || car.makeModel !== undefined || car.colour !== undefined
      ? new Date().toISOString()
      : car.lastVehicleUpdateAt || null,
  status: car.status || "active",
  sort_order: Number(car.sortOrder ?? car.sort_order ?? 0),
  notes: car.notes || null,
});

const bookingPayload = (booking) => ({
  loan_car_id: booking.loanCarId,
  start_date: booking.startDate || booking.date,
  end_date: booking.endDate || booking.startDate || booking.date,
  job_id: booking.jobId || null,
  job_number: booking.jobNumber || null,
  customer_name: booking.customerName || booking.customer || null,
  customer_email: booking.customerEmail || null,
  customer_phone: booking.customerPhone || null,
  customer_address: booking.customerAddress || null,
  customer_postcode: booking.customerPostcode || null,
  vehicle_reg: booking.vehicleReg || booking.reg || null,
  vehicle_make_model: booking.vehicleMakeModel || null,
  mileage: toNullableInteger(booking.mileage),
  insurance_provider: booking.insuranceProvider || null,
  insurance_policy_number: booking.insurancePolicyNumber || null,
  licence_number: booking.licenceNumber || null,
  date_of_birth: booking.dateOfBirth || null,
  notes: booking.notes || null,
});

const statusLabelForAction = (actionType) => {
  if (actionType === "job_checked_in") return "Awaiting Workshop";
  if (actionType === "vhc_complete") return "Awaiting Advisor";
  if (actionType === "job_complete") return "Ready For Collection";
  return "Ready For Collection";
};

const buildKeyActionLabel = (actionType, keyLocation) => {
  if (!keyLocation) return "Keys updated";
  if (actionType === "job_checked_in") return `Keys received – ${keyLocation}`;
  if (actionType === "location_update") return `Keys updated – ${keyLocation}`;
  return `Keys hung – ${keyLocation}`;
};

const buildKeyNotes = ({ jobNumber, vehicleReg, notes }) => {
  const parts = [];
  if (jobNumber) parts.push(`Job ${jobNumber}`);
  if (vehicleReg) parts.push(`Reg ${vehicleReg}`);
  if (notes) parts.push(notes);
  return parts.join(" • ");
};

const buildVehicleNotes = ({ notes }) => {
  return notes ? notes : null;
};

export const logNextActionEvents = async ({
  actionType,
  jobId,
  jobNumber,
  vehicleId,
  vehicleReg,
  keyLocation,
  vehicleLocation,
  notes,
  performedBy,
  vehicleStatus,
}) => {
  const keyPayload = {
    job_id: jobId || null,
    vehicle_id: vehicleId || null,
    action: buildKeyActionLabel(actionType, keyLocation),
    notes: buildKeyNotes({ jobNumber, vehicleReg, notes }),
    performed_by: performedBy || null,
  };

  const vehiclePayload = {
    job_id: jobId || null,
    vehicle_id: vehicleId || null,
    status: vehicleStatus || statusLabelForAction(actionType),
    location: vehicleLocation || null,
    notes: buildVehicleNotes({ notes }),
    created_by: performedBy || null,
  };

  const [{ data: keyEvent, error: keyError }, { data: vehicleEvent, error: vehicleError }] = await Promise.all([
    supabase.from("key_tracking_events").insert(keyPayload).select().single(),
    supabase.from("vehicle_tracking_events").insert(vehiclePayload).select().single(),
  ]);

  if (keyError || vehicleError) {
    console.error("Failed to log next action", keyError || vehicleError);
    return {
      success: false,
      error: keyError || vehicleError,
    };
  }

  return {
    success: true,
    data: {
      keyEvent,
      vehicleEvent,
    },
  };
};

export const getLoanCarScheduleBookings = async ({ startDate, endDate } = {}) => {
  const { data, error } = await supabase
    .from("tracking_loan_car_bookings")
    .select("*")
    .lte("start_date", endDate || normaliseDateKey(new Date()))
    .gte("end_date", startDate || normaliseDateKey(new Date()))
    .order("start_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch loan car schedule bookings", error);
    return [];
  }

  return (data || []).map(normalizeLoanCarBooking);
};

export const getLoanCars = async () => {
  const { data, error } = await supabase
    .from("tracking_loan_cars")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("reg", { ascending: true });

  if (error) {
    console.error("Failed to fetch loan cars", error);
    return [];
  }

  return (data || []).map(normalizeLoanCar);
};

export const getLoanCarFuelHistory = async (loanCarId, { limit = 50 } = {}) => {
  if (!loanCarId) return [];
  const { data, error } = await supabase
    .from("tracking_loan_car_fuel_history")
    .select("*")
    .eq("loan_car_id", loanCarId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch loan car fuel history", error);
    return [];
  }

  return (data || []).map(normalizeLoanCarFuelHistory);
};

export const saveLoanCar = async (car) => {
  const payload = loanCarPayload(car);
  const query = car.loanCarId || car.id
    ? supabase.from("tracking_loan_cars").update(payload).eq("loan_car_id", car.loanCarId || car.id)
    : supabase.from("tracking_loan_cars").insert(payload);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Failed to save loan car", error);
    return { success: false, error };
  }

  return { success: true, data: normalizeLoanCar(data) };
};

export const deleteLoanCar = async (loanCarId) => {
  const { error } = await supabase.from("tracking_loan_cars").delete().eq("loan_car_id", loanCarId);
  if (error) {
    console.error("Failed to delete loan car", error);
    return { success: false, error };
  }
  return { success: true };
};

export const saveLoanCarBooking = async (booking) => {
  const payload = bookingPayload(booking);
  const query = booking.bookingId || booking.id
    ? supabase.from("tracking_loan_car_bookings").update(payload).eq("booking_id", booking.bookingId || booking.id)
    : supabase.from("tracking_loan_car_bookings").insert(payload);
  const { data, error } = await query.select().single();

  if (error) {
    console.error("Failed to save loan car booking", error);
    return { success: false, error };
  }

  return { success: true, data: normalizeLoanCarBooking(data) };
};

export const deleteLoanCarBooking = async (bookingId) => {
  const { error } = await supabase.from("tracking_loan_car_bookings").delete().eq("booking_id", bookingId);
  if (error) {
    console.error("Failed to delete loan car booking", error);
    return { success: false, error };
  }
  return { success: true };
};

export const searchLoanCarBookingTargets = async (searchTerm) => {
  const term = String(searchTerm || "").trim();
  if (term.length < 2) return [];

  const escaped = term.replace(/[%_,()]/g, "");
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      customer,
      vehicle_reg,
      vehicle_make_model,
      milage,
      waiting_status,
      customer_ref:customer_id(
        firstname,
        lastname,
        email,
        mobile,
        telephone,
        address,
        postcode
      ),
      vehicle:vehicle_id(
        registration,
        reg_number,
        make,
        model,
        make_model,
        mileage,
        insurance_provider,
        insurance_policy_number
      )
    `)
    .or(`job_number.ilike.%${escaped}%,vehicle_reg.ilike.%${escaped}%,customer.ilike.%${escaped}%`)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Failed to search loan car booking targets", error);
    return [];
  }

  return (data || []).map((job) => {
    const customer = job.customer_ref || {};
    const vehicle = job.vehicle || {};
    const customerName =
      job.customer ||
      [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() ||
      "";
    return {
      jobId: job.id,
      jobNumber: job.job_number || "",
      customerName,
      customerEmail: customer.email || "",
      customerPhone: customer.mobile || customer.telephone || "",
      customerAddress: customer.address || "",
      customerPostcode: customer.postcode || "",
      vehicleReg: job.vehicle_reg || vehicle.registration || vehicle.reg_number || "",
      vehicleMakeModel:
        job.vehicle_make_model ||
        vehicle.make_model ||
        [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() ||
        "",
      mileage: job.milage ?? vehicle.mileage ?? "",
      insuranceProvider: vehicle.insurance_provider || "",
      insurancePolicyNumber: vehicle.insurance_policy_number || "",
      waitingStatus: job.waiting_status || "",
    };
  });
};

const fetchLatestEvent = async (table, idField, idValue, selectFields) => {
  if (!idValue) return { data: null, error: null };
  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .eq(idField, idValue)
    .order("occurred_at", { ascending: false })
    .limit(1);
  return { data: data?.[0] || null, error };
};

export const updateTrackingLocations = async ({
  actionType,
  jobId,
  jobNumber,
  vehicleId,
  vehicleReg,
  keyLocation,
  vehicleLocation,
  notes,
  performedBy,
  vehicleStatus,
}) => {
  const timestamp = new Date().toISOString();
  const targetJobId = jobId || null;
  const targetVehicleId = vehicleId || null;
  const filterField = targetJobId ? "job_id" : "vehicle_id";
  const filterValue = targetJobId || targetVehicleId;

  if (!filterValue) {
    return { success: false, error: { message: "Missing jobId or vehicleId for tracking update" } };
  }

  const nextKeyAction = buildKeyActionLabel(actionType, keyLocation);
  const nextVehicleStatus = vehicleStatus || statusLabelForAction(actionType);

  const keyPayload =
    keyLocation !== undefined
      ? {
          action: nextKeyAction,
          notes: buildKeyNotes({ jobNumber, vehicleReg, notes }),
          performed_by: performedBy || null,
          occurred_at: timestamp,
        }
      : null;
  const vehiclePayload =
    vehicleLocation !== undefined
      ? {
          status: nextVehicleStatus,
          location: vehicleLocation || null,
          notes: buildVehicleNotes({ notes }),
          created_by: performedBy || null,
          occurred_at: timestamp,
        }
      : null;

  let keyResult = { data: null, error: null };
  let vehicleResult = { data: null, error: null };

  if (keyPayload) {
    const { data, error } = await supabase
      .from("key_tracking_events")
      .update(keyPayload)
      .eq(filterField, filterValue)
      .select();
    if (error) {
      console.error("Failed to update key tracking entries", error);
      return { success: false, error };
    }
    if (!data || data.length === 0) {
      const insertRes = await supabase
        .from("key_tracking_events")
        .insert({
          job_id: targetJobId,
          vehicle_id: targetVehicleId,
          action: nextKeyAction,
          notes: buildKeyNotes({ jobNumber, vehicleReg, notes }),
          performed_by: performedBy || null,
        })
        .select()
        .single();
      keyResult = insertRes;
    } else {
      keyResult = { data: data[0], error: null };
    }
  }

  if (vehiclePayload) {
    const { data, error } = await supabase
      .from("vehicle_tracking_events")
      .update(vehiclePayload)
      .eq(filterField, filterValue)
      .select();
    if (error) {
      console.error("Failed to update vehicle tracking entries", error);
      return { success: false, error };
    }
    if (!data || data.length === 0) {
      const insertRes = await supabase
        .from("vehicle_tracking_events")
        .insert({
          job_id: targetJobId,
          vehicle_id: targetVehicleId,
          status: nextVehicleStatus,
          location: vehicleLocation || null,
          notes: buildVehicleNotes({ notes }),
          created_by: performedBy || null,
        })
        .select()
        .single();
      vehicleResult = insertRes;
    } else {
      vehicleResult = { data: data[0], error: null };
    }
  }

  if (keyResult.error || vehicleResult.error) {
    console.error("Failed to update tracking entries", keyResult.error || vehicleResult.error);
    return { success: false, error: keyResult.error || vehicleResult.error };
  }

  // Debug logs removed after troubleshooting.
  return {
    success: true,
    data: {
      keyEvent: keyResult.data || null,
      vehicleEvent: vehicleResult.data || null,
    },
  };
};

const normaliseJobJoin = (join) => {
  if (!join) return {};
  const customerJoin = join.customer_ref || null;
  const vehicleJoin = join.vehicle_ref || null;
  const customerFromJoin =
    customerJoin?.name ||
    [customerJoin?.firstname, customerJoin?.lastname].filter(Boolean).join(" ").trim() ||
    "";
  const makeModelFromJoin =
    vehicleJoin?.make_model ||
    [vehicleJoin?.make, vehicleJoin?.model].filter(Boolean).join(" ").trim() ||
    "";
  const colourFromJoin = vehicleJoin?.colour || "";
  return {
    jobNumber: join.job_number || "",
    vehicleReg: join.vehicle_reg || "",
    customer: join.customer || customerFromJoin,
    serviceType: join.type || "",
    makeModel: join.vehicle_make_model || makeModelFromJoin,
    colour: colourFromJoin,
    assignedTo: join.assigned_to ?? null, // propagate technician assignment for tracking-page prioritisation
  };
};

const mergeEntry = (entryMap, baseKey, incoming) => {
  if (!entryMap.has(baseKey)) {
    entryMap.set(baseKey, {
      jobId: incoming.jobId,
      jobNumber: incoming.jobNumber,
      vehicleReg: incoming.vehicleReg,
      reg: incoming.vehicleReg,
      customer: incoming.customer,
      serviceType: incoming.serviceType,
      makeModel: incoming.makeModel,
      colour: incoming.colour || "",
      status: incoming.status,
      jobStatus: incoming.jobStatus || null,
      assignedTo: incoming.assignedTo ?? null,
      vehicleLocation: incoming.vehicleLocation || null,
      keyLocation: incoming.keyLocation || null,
      keyNotes: incoming.keyNotes || null,
      notes: incoming.notes || null,
      maintenanceInfo: incoming.maintenanceInfo || {},
      checkedInAt: incoming.checkedInAt || null,
      appointmentAt: incoming.appointmentAt || null,
      washState: incoming.washState || null,
      washUpdatedAt: incoming.washUpdatedAt || null,
      updatedAt: incoming.updatedAt,
    });
    return;
  }

  const existing = entryMap.get(baseKey);
  entryMap.set(baseKey, {
    ...existing,
    jobNumber: existing.jobNumber || incoming.jobNumber,
    vehicleReg: existing.vehicleReg || incoming.vehicleReg,
    reg: existing.reg || incoming.vehicleReg,
    customer: existing.customer || incoming.customer,
    serviceType: existing.serviceType || incoming.serviceType,
    makeModel: existing.makeModel || incoming.makeModel,
    colour: existing.colour || incoming.colour || "",
    assignedTo: existing.assignedTo ?? incoming.assignedTo ?? null,
    status: incoming.status || existing.status,
    jobStatus: incoming.jobStatus || existing.jobStatus,
    vehicleLocation: incoming.vehicleLocation || existing.vehicleLocation,
    keyLocation: incoming.keyLocation || existing.keyLocation,
    keyNotes: incoming.keyNotes || existing.keyNotes,
    notes: incoming.notes || existing.notes,
    maintenanceInfo:
      (incoming.maintenanceInfo && Object.keys(incoming.maintenanceInfo).length > 0)
        ? incoming.maintenanceInfo
        : existing.maintenanceInfo || {},
    checkedInAt: existing.checkedInAt || incoming.checkedInAt || null,
    appointmentAt: existing.appointmentAt || incoming.appointmentAt || null,
    washState: incoming.washState || existing.washState || null,
    washUpdatedAt:
      incoming.washUpdatedAt ||
      existing.washUpdatedAt ||
      null,
    updatedAt: new Date(Math.max(new Date(existing.updatedAt || 0).getTime(), new Date(incoming.updatedAt || 0).getTime())).toISOString(),
  });
};

export const fetchTrackingSnapshot = async () => {
  const [{ data: keyEvents, error: keyError }, { data: vehicleEvents, error: vehicleError }] = await Promise.all([
    supabase
      .from("key_tracking_events")
      .select(
        "key_event_id, job_id, vehicle_id, action, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type, status, vehicle_make_model, maintenance_info, checked_in_at, assigned_to, customer_ref:customer_id(name, firstname, lastname), vehicle_ref:vehicle_id(make_model, make, model, colour), appointments(scheduled_time)), vehicle:vehicle_id(make_model, make, model, colour)"
      )
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("vehicle_tracking_events")
      .select(
        "event_id, job_id, vehicle_id, status, location, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type, status, vehicle_make_model, maintenance_info, checked_in_at, assigned_to, customer_ref:customer_id(name, firstname, lastname), vehicle_ref:vehicle_id(make_model, make, model, colour), appointments(scheduled_time)), vehicle:vehicle_id(make_model, make, model, colour)"
      )
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  if (keyError || vehicleError) {
    console.error("Failed to fetch tracking snapshot", keyError || vehicleError);
    return { success: false, error: keyError || vehicleError };
  }

  const entryMap = new Map();

  (vehicleEvents || []).forEach((event) => {
    const join = normaliseJobJoin(event.jobs);
    const fallbackMakeModel =
      event.vehicle?.make_model ||
      [event.vehicle?.make, event.vehicle?.model].filter(Boolean).join(" ").trim() ||
      "";
    mergeEntry(entryMap, event.job_id || `vehicle-${event.event_id}`, {
      jobId: event.job_id || null,
      jobNumber: join.jobNumber,
      vehicleReg: join.vehicleReg,
      customer: join.customer,
      serviceType: join.serviceType,
      makeModel: join.makeModel || fallbackMakeModel,
      colour: join.colour || event.vehicle?.colour || "",
      status: event.status || join.serviceType || "In Progress",
      jobStatus: event.jobs?.status || null,
      assignedTo: join.assignedTo ?? null,
      vehicleLocation: event.location || null,
      keyLocation: null,
      keyNotes: null,
      notes: event.notes || null,
      maintenanceInfo: event.jobs?.maintenance_info || {},
      checkedInAt: event.jobs?.checked_in_at || null,
      appointmentAt: event.jobs?.appointments?.[0]?.scheduled_time || null,
      washState:
        event.jobs?.maintenance_info?.valetChecklist?.washState ||
        (event.jobs?.maintenance_info?.valetChecklist?.wash ? "complete" : null),
      washUpdatedAt: event.jobs?.maintenance_info?.valetChecklist?.updatedAt || null,
      updatedAt: event.occurred_at,
    });
  });

  (keyEvents || []).forEach((event) => {
    const join = normaliseJobJoin(event.jobs);
    const fallbackMakeModel =
      event.vehicle?.make_model ||
      [event.vehicle?.make, event.vehicle?.model].filter(Boolean).join(" ").trim() ||
      "";
    mergeEntry(entryMap, event.job_id || `key-${event.key_event_id}`, {
      jobId: event.job_id || null,
      jobNumber: join.jobNumber,
      vehicleReg: join.vehicleReg,
      customer: join.customer,
      serviceType: join.serviceType,
      makeModel: join.makeModel || fallbackMakeModel,
      colour: join.colour || event.vehicle?.colour || "",
      status: statusLabelForAction("job_complete"),
      jobStatus: event.jobs?.status || null,
      assignedTo: join.assignedTo ?? null,
      vehicleLocation: null,
      keyLocation: event.action || null,
      keyNotes: event.notes || null,
      notes: event.notes || null,
      maintenanceInfo: event.jobs?.maintenance_info || {},
      checkedInAt: event.jobs?.checked_in_at || null,
      appointmentAt: event.jobs?.appointments?.[0]?.scheduled_time || null,
      washState:
        event.jobs?.maintenance_info?.valetChecklist?.washState ||
        (event.jobs?.maintenance_info?.valetChecklist?.wash ? "complete" : null),
      washUpdatedAt: event.jobs?.maintenance_info?.valetChecklist?.updatedAt || null,
      updatedAt: event.occurred_at,
    });
  });

  const entries = Array.from(entryMap.values()).sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );

  return {
    success: true,
    data: entries,
  };
};
