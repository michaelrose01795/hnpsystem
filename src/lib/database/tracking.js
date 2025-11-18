// file location: src/lib/database/tracking.js
import { getDatabaseClient } from "@/lib/database/client"; // import supabase service client

const supabase = getDatabaseClient(); // create singleton client

const statusLabelForAction = (actionType) => {
  if (actionType === "job_checked_in") return "Awaiting Workshop";
  if (actionType === "vhc_complete") return "Awaiting Advisor";
  if (actionType === "job_complete") return "Ready For Collection";
  return "Ready For Collection";
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
    action: keyLocation
      ? `${actionType === "job_checked_in" ? "Keys received" : "Keys hung"} – ${keyLocation}`
      : "Keys updated",
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

const normaliseJobJoin = (join) => {
  if (!join) return {};
  return {
    jobNumber: join.job_number || "",
    vehicleReg: join.vehicle_reg || "",
    customer: join.customer || "",
    serviceType: join.type || "",
  };
};

const mergeEntry = (entryMap, baseKey, incoming) => {
  if (!entryMap.has(baseKey)) {
    entryMap.set(baseKey, {
      jobId: incoming.jobId,
      jobNumber: incoming.jobNumber,
      vehicleReg: incoming.vehicleReg,
      customer: incoming.customer,
      serviceType: incoming.serviceType,
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
    customer: existing.customer || incoming.customer,
    serviceType: existing.serviceType || incoming.serviceType,
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
        "key_event_id, job_id, vehicle_id, action, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type)"
      )
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("vehicle_tracking_events")
      .select(
        "event_id, job_id, vehicle_id, status, location, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type)"
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
