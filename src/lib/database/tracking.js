// file location: src/lib/database/tracking.js
import { getDatabaseClient } from "@/lib/database/client"; // import supabase service client

const supabase = getDatabaseClient(); // create singleton client

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
  return {
    jobNumber: join.job_number || "",
    vehicleReg: join.vehicle_reg || "",
    customer: join.customer || "",
    serviceType: join.type || "",
    makeModel: join.vehicle_make_model || "",
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
      status: incoming.status,
      vehicleLocation: incoming.vehicleLocation || null,
      keyLocation: incoming.keyLocation || null,
      keyNotes: incoming.keyNotes || null,
      notes: incoming.notes || null,
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
    status: incoming.status || existing.status,
    vehicleLocation: incoming.vehicleLocation || existing.vehicleLocation,
    keyLocation: incoming.keyLocation || existing.keyLocation,
    keyNotes: incoming.keyNotes || existing.keyNotes,
    notes: incoming.notes || existing.notes,
    updatedAt: new Date(Math.max(new Date(existing.updatedAt || 0).getTime(), new Date(incoming.updatedAt || 0).getTime())).toISOString(),
  });
};

export const fetchTrackingSnapshot = async () => {
  const [{ data: keyEvents, error: keyError }, { data: vehicleEvents, error: vehicleError }] = await Promise.all([
    supabase
      .from("key_tracking_events")
      .select(
        "key_event_id, job_id, vehicle_id, action, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type, vehicle_make_model)"
      )
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("vehicle_tracking_events")
      .select(
        "event_id, job_id, vehicle_id, status, location, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type, vehicle_make_model)"
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
    mergeEntry(entryMap, event.job_id || `vehicle-${event.event_id}`, {
      jobId: event.job_id || null,
      jobNumber: join.jobNumber,
      vehicleReg: join.vehicleReg,
      customer: join.customer,
      serviceType: join.serviceType,
      makeModel: join.makeModel,
      status: event.status || join.serviceType || "In Progress",
      vehicleLocation: event.location || null,
      keyLocation: null,
      keyNotes: null,
      notes: event.notes || null,
      updatedAt: event.occurred_at,
    });
  });

  (keyEvents || []).forEach((event) => {
    const join = normaliseJobJoin(event.jobs);
    mergeEntry(entryMap, event.job_id || `key-${event.key_event_id}`, {
      jobId: event.job_id || null,
      jobNumber: join.jobNumber,
      vehicleReg: join.vehicleReg,
      customer: join.customer,
      serviceType: join.serviceType,
      makeModel: join.makeModel,
      status: statusLabelForAction("job_complete"),
      vehicleLocation: null,
      keyLocation: event.action || null,
      keyNotes: event.notes || null,
      notes: event.notes || null,
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
