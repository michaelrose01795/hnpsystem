// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/status/getHistory.js
import { createClient } from "@supabase/supabase-js"; // Import Supabase factory for privileged server access
import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Import shared Supabase client as fallback
import {
  getMainStatusMetadata,
  getSubStatusMetadata,
  resolveMainStatusId,
  resolveSubStatusId,
  normalizeStatusId,
} from "@/lib/status/statusFlow"; // Import status metadata map for enrichment

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Read Supabase project URL from environment
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Read optional service role key for elevated permissions
const dbClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : browserSupabase; // Prefer service role client when available for unrestricted reads

const normalizeJobIdentifier = (raw) => {
  const trimmed = typeof raw === "string" ? raw.trim() : raw; // Trim whitespace from incoming identifiers
  if (trimmed === null || typeof trimmed === "undefined" || trimmed === "") {
    return { type: "invalid", value: null }; // Flag missing identifiers as invalid
  }

  const numericValue = Number(trimmed); // Attempt to coerce into numeric job ID
  if (Number.isInteger(numericValue) && !Number.isNaN(numericValue)) {
    return { type: "id", value: numericValue }; // Treat numeric values as primary key IDs
  }

  return { type: "job_number", value: String(trimmed) }; // Otherwise treat as external job number string
};

const ensureIsoString = (value, fallback = null) => {
  if (!value) return fallback || new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback || new Date().toISOString();
  }
  return parsed.toISOString();
};

const buildStatusPayload = (statusText) => {
  const subStatusId = resolveSubStatusId(statusText);
  if (subStatusId) {
    const subConfig = getSubStatusMetadata(statusText) || {};
    return {
      id: subStatusId,
      label: subConfig?.label || statusText || subStatusId,
      color: subConfig?.color || null,
      department: subConfig?.department || null,
      pausesTime: true,
      kind: "event",
      eventType: subConfig?.category || "sub_status",
      isSubStatus: true,
    };
  }

  const mainStatusId = resolveMainStatusId(statusText);
  if (mainStatusId) {
    const statusConfig = getMainStatusMetadata(statusText) || {};
    return {
      id: mainStatusId,
      label: statusConfig?.label || statusText || mainStatusId,
      color: statusConfig?.color || null,
      department: statusConfig?.department || null,
      pausesTime: Boolean(statusConfig?.pausesTime),
      kind: "status",
      isSubStatus: false,
    };
  }

  const normalizedFallback = normalizeStatusId(statusText);
  return {
    id: normalizedFallback,
    label: statusText || normalizedFallback || null,
    color: null,
    department: null,
    pausesTime: true,
    kind: "event",
    eventType: "status_update",
    isSubStatus: true,
  };
};

const MAX_INT32 = 2147483647;
const isValidUserId = (value) =>
  Number.isSafeInteger(value) && value > 0 && value <= MAX_INT32;

const attachDurations = (entries, nowIso) => {
  const nowMs = new Date(nowIso).getTime(); // Convert reference timestamp to milliseconds
  return entries.map((entry, index) => {
    const currentStart = new Date(entry.timestamp).getTime(); // Convert entry timestamp into milliseconds
    const nextStart =
      index < entries.length - 1
        ? new Date(entries[index + 1].timestamp).getTime()
        : nowMs; // Determine end boundary using next entry or "now"

    const hasValidRange = Number.isFinite(currentStart) && Number.isFinite(nextStart) && nextStart >= currentStart; // Check for valid times
    const durationSeconds = hasValidRange
      ? Math.floor((nextStart - currentStart) / 1000)
      : 0; // Compute duration in seconds when valid

    return {
      ...entry,
      duration: durationSeconds,
    }; // Merge duration into entry payload
  });
};

const buildClockingSummary = (clockingRows = []) => {
  const activeClockIns = [];
  const completedSeconds = (clockingRows || []).reduce((total, row) => {
    if (!row?.clock_in) return total;
    const clockInIso = ensureIsoString(row.clock_in, null);
    if (!clockInIso) return total;
    const clockInMs = new Date(clockInIso).getTime();
    if (Number.isNaN(clockInMs)) return total;

    if (row.clock_out) {
      const clockOutIso = ensureIsoString(row.clock_out, null);
      const clockOutMs = clockOutIso ? new Date(clockOutIso).getTime() : NaN;
      if (!Number.isNaN(clockOutMs) && clockOutMs >= clockInMs) {
        return total + Math.floor((clockOutMs - clockInMs) / 1000);
      }
      return total;
    }

    activeClockIns.push(clockInIso);
    return total;
  }, 0);

  return {
    completedSeconds,
    activeClockIns,
  };
};

const fetchJobActionEvents = async (jobId) => {
  if (!jobId) return { entries: [], clockingSummary: buildClockingSummary() };

  const keyEventsPromise = dbClient
    .from("key_tracking_events")
    .select(
      "key_event_id, action, notes, performed_by, occurred_at, user:performed_by (name, first_name, last_name)"
    )
    .eq("job_id", jobId)
    .order("occurred_at", { ascending: true });

  const vehicleEventsPromise = dbClient
    .from("vehicle_tracking_events")
    .select(
      "event_id, status, location, notes, created_by, occurred_at, user:created_by (name, first_name, last_name)"
    )
    .eq("job_id", jobId)
    .order("occurred_at", { ascending: true });

  const clockingPromise = dbClient
    .from("job_clocking")
    .select(
      "id, user_id, clock_in, clock_out, work_type, user:user_id (name, first_name, last_name)"
    )
    .eq("job_id", jobId)
    .order("clock_in", { ascending: true });

  const partsPromise = dbClient
    .from("parts_requests")
    .select(
      "request_id, status, description, pre_pick_location, created_at, updated_at, requester:requested_by (name, first_name, last_name)"
    )
    .eq("job_id", jobId)
    .order("updated_at", { ascending: true });

  const [keyRes, vehicleRes, clockingRes, partsRes] = await Promise.all([
    keyEventsPromise,
    vehicleEventsPromise,
    clockingPromise,
    partsPromise,
  ]);

  const actionEntries = [];
  const getUserName = (user) => {
    if (!user) return null;
    if (user.name) return user.name;
    const parts = [user.first_name, user.last_name].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  };

  if (keyRes.error) {
    console.error("Failed to load key tracking events", keyRes.error);
  } else {
    (keyRes.data || []).forEach((row, index) => {
      if (!row.occurred_at) return;
      const label =
        index === 0
          ? "Added to parking & key tracking"
          : row.action || "Keys updated";
      actionEntries.push({
        id: `key-${row.key_event_id}`,
        kind: "event",
        eventType: index === 0 ? "tracking_registered" : "key_tracking",
        label,
        timestamp: ensureIsoString(row.occurred_at),
        userId: row.performed_by || null,
        description: row.notes || null,
        color: "var(--accent-purple)",
        department: "Parking & Keys",
        icon: "🔑",
        meta: {
          action: row.action || null,
          notes: row.notes || null,
          userName: getUserName(row.user),
        },
        userName: getUserName(row.user) || null,
      });
    });
  }

  if (vehicleRes.error) {
    console.error("Failed to load vehicle tracking events", vehicleRes.error);
  } else {
    (vehicleRes.data || []).forEach((row) => {
      if (!row.occurred_at) return;
      const locationLabel = row.location
        ? `Parking updated: ${row.location}`
        : `Vehicle status: ${row.status}`;
      actionEntries.push({
        id: `vehicle-${row.event_id}`,
        kind: "event",
        eventType: "vehicle_tracking",
        label: locationLabel,
        timestamp: ensureIsoString(row.occurred_at),
        userId: row.created_by || null,
        description: row.notes || null,
        color: "var(--accent-purple)",
        department: "Parking & Keys",
        icon: "🚗",
        meta: {
          status: row.status,
          location: row.location,
          userName: getUserName(row.user),
        },
        userName: getUserName(row.user) || null,
      });
    });
  }

  let clockingSummary = buildClockingSummary();
  if (clockingRes.error) {
    console.error("Failed to load job clocking entries", clockingRes.error);
  } else {
    const clockingRows = clockingRes.data || [];
    clockingSummary = buildClockingSummary(clockingRows);
    clockingRows.forEach((row) => {
      if (!row.clock_in) return;
      const workLabel = row.work_type
        ? row.work_type.replace(/_/g, " ")
        : "Technician clocked on";
      const clockInIso = ensureIsoString(row.clock_in, null);
      const clockOutIso = row.clock_out ? ensureIsoString(row.clock_out, null) : null;
      actionEntries.push({
        id: `clock-${row.id}`,
        kind: "event",
        eventType: "clocking",
        label: `${workLabel}`.trim(),
        timestamp: clockInIso || ensureIsoString(row.clock_in),
        userId: row.user_id || null,
        description: null,
        color: "var(--info)",
        department: "Workshop",
        icon: "🛠️",
        meta: {
          workType: row.work_type || null,
          clockIn: clockInIso,
          clockOut: clockOutIso,
          userName: getUserName(row.user),
        },
        userName: getUserName(row.user) || null,
      });
    });
  }

  if (partsRes.error) {
    console.error("Failed to load parts request entries", partsRes.error);
  } else {
    (partsRes.data || []).forEach((row) => {
      const status = (row.status || "").toLowerCase();
      const isOnOrder =
        status === "ordered" || row.pre_pick_location === "on_order";
      if (!isOnOrder) return;
      actionEntries.push({
        id: `parts-${row.request_id}`,
        kind: "event",
        eventType: "parts_on_order",
        label: "Parts on order",
        timestamp: ensureIsoString(row.updated_at || row.created_at),
        userId: null,
        description: row.description || null,
        color: "var(--danger)",
        department: "Parts",
        icon: "📦",
        meta: {
          status: row.status,
          prePickLocation: row.pre_pick_location,
          userName: getUserName(row.requester),
        },
        userName: getUserName(row.requester) || null,
      });
    });
  }

  return {
    entries: actionEntries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
    clockingSummary,
  };
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" }); // Enforce GET-only semantics for history endpoint
  }

  const { jobId: rawJobId } = req.query; // Extract job identifier from query parameters
  const jobIdentifier = normalizeJobIdentifier(rawJobId); // Determine lookup mode for job records

  if (jobIdentifier.type === "invalid") {
    return res.status(400).json({ error: "Missing jobId parameter" }); // Fail fast when identifier is absent
  }

  try {
    const jobQuery = dbClient
      .from("jobs")
      .select(
        `id, job_number, status, status_updated_at, status_updated_by, created_at, updated_at`
      ); // Prepare base query for job metadata

    if (jobIdentifier.type === "id") {
      jobQuery.eq("id", jobIdentifier.value); // Filter by primary key ID when numeric identifier provided
    } else {
      jobQuery.eq("job_number", jobIdentifier.value); // Otherwise match against job number column
    }

    jobQuery.limit(1); // Restrict to single job row for determinism

    const { data: jobRow, error: jobError } = await jobQuery.maybeSingle(); // Execute lookup with graceful handling of empty results

    if (jobError && jobError.code !== "PGRST116") {
      throw jobError; // Bubble up unexpected database errors
    }

    if (!jobRow) {
      return res.status(404).json({ error: "Job not found" }); // Inform caller when job is missing
    }

    const { data: historyRows, error: historyError } = await dbClient
      .from("job_status_history")
      .select("id, from_status, to_status, changed_by, reason, changed_at")
      .eq("job_id", jobRow.id)
      .order("changed_at", { ascending: true }); // Retrieve ordered status history entries

    if (historyError) {
      throw historyError; // Surface history query issues
    }

    const collectedUserIds = new Set();
    const collectUserId = (value) => {
      const parsed = Number(value);
      if (isValidUserId(parsed)) {
        collectedUserIds.add(parsed);
      }
    };

    (historyRows || []).forEach((row) => collectUserId(row.changed_by));
    collectUserId(jobRow.status_updated_by);

    const userNameById = new Map();
    if (collectedUserIds.size > 0) {
      const { data: userRows, error: userError } = await dbClient
        .from("users")
        .select("user_id, first_name, last_name, email")
        .in("user_id", Array.from(collectedUserIds));

      if (userError) {
        console.error("Failed to load status history users", userError);
      } else {
        (userRows || []).forEach((user) => {
          const parts = [user.first_name, user.last_name].filter(Boolean);
          const name = parts.join(" ").trim() || user.email || "Unknown user";
          userNameById.set(user.user_id, name);
        });
      }
    }

    const resolveHistoryUserName = (value) => {
      if (!value) return null;
      const text = String(value).trim();
      if (!text) return null;
      const parsed = Number(text);
      if (isValidUserId(parsed)) {
        return userNameById.get(parsed) || "Unknown user";
      }
      return /^system/i.test(text) ? "System" : text;
    };

    const statusEntries = [];
    const subStatusEntries = [];

    (historyRows || []).forEach((row) => {
      const statusPayload = buildStatusPayload(row.to_status || row.from_status);
      const baseEntry = {
        id: row.id,
        status: statusPayload.id,
        statusLabel: statusPayload.label,
        timestamp: row.changed_at,
        userId: row.changed_by || null,
        userName: resolveHistoryUserName(row.changed_by),
        reason: row.reason || null,
        color: statusPayload.color,
        department: statusPayload.department,
        pausesTime: statusPayload.pausesTime,
      };

      if (statusPayload.isSubStatus) {
        subStatusEntries.push({
          ...baseEntry,
          kind: statusPayload.kind || "event",
          eventType: statusPayload.eventType || "sub_status",
          label: statusPayload.label || "Update",
        });
      } else {
        statusEntries.push({
          ...baseEntry,
          kind: "status",
          label: statusPayload.label || "Status",
        });
      }
    });

    if (statusEntries.length === 0 && jobRow.status) {
      const mainId = resolveMainStatusId(jobRow.status);
      const mainMeta = getMainStatusMetadata(jobRow.status) || {};
      statusEntries.push({
        id: null,
        status: mainId,
        statusLabel: mainMeta?.label || jobRow.status,
        timestamp:
          jobRow.status_updated_at ||
          jobRow.updated_at ||
          jobRow.created_at ||
          new Date().toISOString(),
        userId: jobRow.status_updated_by || null,
        userName: resolveHistoryUserName(jobRow.status_updated_by),
        reason: null,
        color: mainMeta?.color || null,
        department: mainMeta?.department || null,
        pausesTime: Boolean(mainMeta?.pausesTime),
        kind: "status",
        label: mainMeta?.label || jobRow.status || "Status",
      });
    }

    const referenceNow = new Date().toISOString(); // Capture reference timestamp for duration calculations
    const timelineEntries = attachDurations(statusEntries, referenceNow); // Attach computed durations to each entry

    const totalRecordedSeconds = timelineEntries.reduce(
      (total, entry) => total + (entry.duration || 0),
      0
    ); // Calculate total recorded seconds across all statuses

    const totalActiveSeconds = timelineEntries.reduce((total, entry) => {
      if (entry.pausesTime === false) {
        return total + (entry.duration || 0); // Sum durations only for statuses where time is active
      }
      return total;
    }, 0);

    const { entries: actionEvents, clockingSummary } = await fetchJobActionEvents(jobRow.id);
    const combinedHistory = [...timelineEntries, ...subStatusEntries, ...actionEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const currentMainId = resolveMainStatusId(jobRow.status);
    const currentMainMeta = getMainStatusMetadata(jobRow.status) || {};
    const currentStatusPayload = {
      id: currentMainId,
      label: currentMainMeta?.label || jobRow.status || null,
      color: currentMainMeta?.color || null,
      department: currentMainMeta?.department || null,
      pausesTime: Boolean(currentMainMeta?.pausesTime),
    }; // Prepare metadata for the job's current status

    return res.status(200).json({
      success: true,
      jobId: jobRow.id,
      jobNumber: jobRow.job_number,
      currentStatus: currentStatusPayload.id,
      currentStatusLabel: currentStatusPayload.label,
      history: combinedHistory,
      totalTime: totalActiveSeconds,
      totalRecordedTime: totalRecordedSeconds,
      clockingSummary,
      generatedAt: referenceNow,
    }); // Respond with structured timeline data for UI consumption
  } catch (error) {
    console.error("Error fetching status history:", error); // Log server-side error for observability
    return res.status(500).json({ error: "Internal server error" }); // Mask underlying error details from caller
  }
}
