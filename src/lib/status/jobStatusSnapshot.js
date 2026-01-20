// file location: src/lib/status/jobStatusSnapshot.js
import { getDatabaseClient } from "@/lib/database/client";
import {
  getMainStatusMetadata,
  getSubStatusMetadata,
  normalizeStatusId,
  resolveMainStatusId,
  resolveSubStatusId,
} from "@/lib/status/statusFlow";
import { NORMALIZE as NORMALIZE_TECH, STATUSES as TECH_STATUSES } from "@/lib/status/catalog/tech";

const db = getDatabaseClient();

const normalizeJobIdentifier = (raw) => {
  const trimmed = typeof raw === "string" ? raw.trim() : raw;
  if (trimmed === null || typeof trimmed === "undefined" || trimmed === "") {
    return { type: "invalid", value: null };
  }
  const numericValue = Number(trimmed);
  if (Number.isInteger(numericValue) && !Number.isNaN(numericValue)) {
    return { type: "id", value: numericValue };
  }
  return { type: "job_number", value: String(trimmed) };
};

const ensureIsoString = (value, fallback = null) => {
  if (!value) return fallback || new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback || new Date().toISOString();
  }
  return parsed.toISOString();
};

const buildStatusPayload = (statusText, addWarning) => {
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
  if (addWarning && statusText) {
    const rawValue = typeof statusText === "string" ? statusText.trim() : String(statusText);
    if (rawValue) {
      addWarning(
        `Unknown status value "${rawValue}"${normalizedFallback ? ` normalized to "${normalizedFallback}"` : ""}.`
      );
    }
  }
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

const resolveTechStatus = ({ status, techCompletionStatus }) => {
  const completionStatus = NORMALIZE_TECH(techCompletionStatus);
  if (completionStatus === TECH_STATUSES.COMPLETE) {
    return completionStatus;
  }
  return NORMALIZE_TECH(status) || TECH_STATUSES.IN_PROGRESS;
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

const getUserName = (user) => {
  if (!user) return null;
  if (user.name) return user.name;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
};

const resolveActorName = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return null;
  return trimmed;
};

const buildVhcStatus = ({ required, completedAt, sentAt, authorisedAt, declinedAt, hasChecks }) => {
  if (!required) return "not_required";
  if (declinedAt) return "declined";
  if (authorisedAt) return "authorised";
  if (sentAt) return "sent";
  if (completedAt) return "completed";
  if (hasChecks) return "in_progress";
  return "pending";
};

const buildPartsSummary = (rows = []) => {
  const summary = {
    totalItems: rows.length,
    waiting: 0,
    onOrder: 0,
    prePicked: 0,
    ready: 0,
  };

  rows.forEach((row) => {
    const normalized = String(row.status || "").toLowerCase();
    if (["waiting_authorisation", "pending", "awaiting_stock"].includes(normalized)) {
      summary.waiting += 1;
    } else if (normalized === "on_order") {
      summary.onOrder += 1;
    } else if (["pre_picked", "picked"].includes(normalized)) {
      summary.prePicked += 1;
    } else if (["stock", "allocated", "fitted"].includes(normalized)) {
      summary.ready += 1;
    }
  });

  return summary;
};

const buildPartsStatus = (summary) => {
  if (!summary || summary.totalItems === 0) return "none";
  if (summary.waiting > 0 || summary.onOrder > 0) return "blocked";
  if (summary.prePicked > 0) return "pre_picked";
  if (summary.ready > 0) return "ready";
  return "in_progress";
};

const buildBlockingReasons = ({
  jobRow,
  invoiceRow,
  vhcRequired,
  vhcCompletedAt,
  partsSummary,
  writeUpStatus,
}) => {
  const reasons = [];

  if (vhcRequired && !vhcCompletedAt) {
    reasons.push({
      code: "VHC_INCOMPLETE",
      message: "Vehicle health check is required before the job can progress.",
      workflowKey: "vhc",
    });
  }

  if (!invoiceRow?.id && resolveMainStatusId(jobRow?.status) === "complete") {
    reasons.push({
      code: "INVOICE_MISSING",
      message: "An invoice is required before the job can be completed.",
      workflowKey: "invoice",
    });
  }

  if (partsSummary && (partsSummary.waiting > 0 || partsSummary.onOrder > 0)) {
    reasons.push({
      code: "PARTS_BLOCKING",
      message: "Parts are still waiting or on order.",
      workflowKey: "parts",
    });
  }

  if (jobRow?.job_source === "Warranty" && writeUpStatus === "missing") {
    reasons.push({
      code: "WRITE_UP_MISSING",
      message: "Warranty jobs require a completed write-up.",
      workflowKey: "writeUp",
    });
  }

  return reasons;
};

export const buildJobStatusSnapshot = async ({ jobId, jobNumber }) => {
  const identifier = normalizeJobIdentifier(jobId ?? jobNumber);
  if (identifier.type === "invalid") {
    return { success: false, error: "Missing job identifier" };
  }

  const normalizationWarnings = new Set();
  const addWarning = (message) => {
    if (message) {
      normalizationWarnings.add(message);
    }
  };

  const jobQuery = db
    .from("jobs")
    .select(
      `id, job_number, vehicle_reg, status, tech_completion_status, waiting_status, updated_at, status_updated_at, status_updated_by, vhc_required, vhc_completed_at, vhc_sent_at, additional_work_authorized_at, job_source`
    )
    .limit(1);

  if (identifier.type === "id") {
    jobQuery.eq("id", identifier.value);
  } else {
    jobQuery.eq("job_number", identifier.value);
  }

  const { data: jobRow, error: jobError } = await jobQuery.maybeSingle();
  if (jobError) {
    return { success: false, error: jobError.message || "Failed to load job" };
  }
  if (!jobRow) {
    return { success: false, error: "Job not found", status: 404 };
  }

  const jobIdValue = jobRow.id;

  const [
    historyRes,
    vhcChecksRes,
    vhcAuthRes,
    vhcDeclineRes,
    invoiceRes,
    partsRes,
    bookingRes,
    keyRes,
    vehicleRes,
    writeUpRes,
    clockingRes,
  ] = await Promise.all([
    db
      .from("job_status_history")
      .select("id, from_status, to_status, changed_by, reason, changed_at")
      .eq("job_id", jobIdValue)
      .order("changed_at", { ascending: true }),
    db
      .from("vhc_checks")
      .select("vhc_id", { count: "exact", head: true })
      .eq("job_id", jobIdValue),
    db
      .from("vhc_authorizations")
      .select("authorized_at")
      .eq("job_id", jobIdValue)
      .order("authorized_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("vhc_declinations")
      .select("declined_at")
      .eq("job_id", jobIdValue)
      .order("declined_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("invoices")
      .select("id, invoice_id, created_at, payment_status")
      .eq("job_id", jobIdValue)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("parts_job_items")
      .select("status")
      .eq("job_id", jobIdValue),
    db
      .from("job_booking_requests")
      .select("status, updated_at")
      .eq("job_id", jobIdValue)
      .maybeSingle(),
    db
      .from("key_tracking_events")
      .select(
        "key_event_id, action, notes, performed_by, occurred_at, user:performed_by (name, first_name, last_name)"
      )
      .eq("job_id", jobIdValue)
      .order("occurred_at", { ascending: false })
      .limit(10),
    db
      .from("vehicle_tracking_events")
      .select(
        "event_id, status, location, notes, created_by, occurred_at, user:created_by (name, first_name, last_name)"
      )
      .eq("job_id", jobIdValue)
      .order("occurred_at", { ascending: false })
      .limit(10),
    db
      .from("job_writeups")
      .select("completion_status, updated_at")
      .eq("job_id", jobIdValue)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("job_clocking")
      .select("id, user_id, clock_in, clock_out, work_type, user:user_id (name, first_name, last_name)")
      .eq("job_id", jobIdValue)
      .order("clock_in", { ascending: true }),
  ]);

  const statusEntries = [];
  const subStatusEntries = [];

  if (historyRes.error) {
    console.error("Failed to load job status history", historyRes.error);
  } else {
    (historyRes.data || []).forEach((row) => {
      const statusPayload = buildStatusPayload(row.to_status, addWarning);
      const baseEntry = {
        id: row.id,
        status: statusPayload.id,
        statusLabel: statusPayload.label,
        timestamp: ensureIsoString(row.changed_at),
        userId: row.changed_by || null,
        userName: resolveActorName(row.changed_by),
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
  }

  if (statusEntries.length === 0 && jobRow.status) {
    const mainId = resolveMainStatusId(jobRow.status);
    const mainMeta = getMainStatusMetadata(jobRow.status) || {};
    if (!mainId && jobRow.status) {
      addWarning(`Unknown main status \"${jobRow.status}\".`);
    }
    statusEntries.push({
      id: null,
      status: mainId,
      statusLabel: mainMeta?.label || jobRow.status,
      timestamp:
        jobRow.status_updated_at ||
        jobRow.updated_at ||
        new Date().toISOString(),
      userId: jobRow.status_updated_by || null,
      userName: resolveActorName(jobRow.status_updated_by),
      reason: null,
      color: mainMeta?.color || null,
      department: mainMeta?.department || null,
      pausesTime: Boolean(mainMeta?.pausesTime),
      kind: "status",
      label: mainMeta?.label || jobRow.status || "Status",
    });
  }

  const actionEntries = [];
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

  const timelineEntries = [...statusEntries, ...subStatusEntries, ...actionEntries]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((entry) => ({
      id: entry.id,
      at: entry.timestamp,
      actorId: entry.userId || null,
      actorName: entry.userName || null,
      type: entry.kind === "status" ? "status_change" : entry.eventType ? "workflow_event" : "sub_status",
      from: entry.reason || entry.statusLabel || entry.label || null,
      to: entry.statusLabel || entry.label || null,
      metadata: {
        kind: entry.kind,
        label: entry.label,
        status: entry.status,
        color: entry.color,
        department: entry.department,
        eventType: entry.eventType,
        description: entry.description,
        icon: entry.icon,
        meta: entry.meta || {},
      },
      status: entry.status,
      label: entry.label,
      color: entry.color,
      department: entry.department,
      kind: entry.kind,
      eventType: entry.eventType,
      description: entry.description,
      timestamp: entry.timestamp,
      userId: entry.userId,
      userName: entry.userName,
    }));

  const partsSummary = buildPartsSummary(partsRes.data || []);
  const partsStatus = buildPartsStatus(partsSummary);
  const latestKeyEvent = keyRes?.data?.[0] || null;
  const latestVehicleEvent = vehicleRes?.data?.[0] || null;
  const lastTrackingAt = latestVehicleEvent?.occurred_at || latestKeyEvent?.occurred_at || null;
  const latestWriteUp = writeUpRes?.data || null;
  const writeUpStatus = latestWriteUp?.completion_status || "missing";
  const activeClocking =
    (clockingRes.data || []).filter((row) => !row.clock_out).slice(-1)[0] || null;

  const jobStatusMeta = getMainStatusMetadata(jobRow.status) || {};
  const overallStatus = resolveMainStatusId(jobRow.status);
  if (!overallStatus && jobRow.status) {
    addWarning(`Unknown main status \"${jobRow.status}\".`);
  }
  const techStatus = resolveTechStatus({
    status: jobRow.status,
    techCompletionStatus: jobRow.tech_completion_status,
  });

  const vhcRequired = Boolean(jobRow.vhc_required);
  const vhcCompletedAt = jobRow.vhc_completed_at || null;
  const vhcSentAt = jobRow.vhc_sent_at || null;
  const vhcAuthorisedAt =
    jobRow.additional_work_authorized_at ||
    vhcAuthRes?.data?.authorized_at ||
    null;
  const vhcDeclinedAt = vhcDeclineRes?.data?.declined_at || null;

  const snapshot = {
    job: {
      id: jobRow.id,
      jobNumber: jobRow.job_number,
      reg: jobRow.vehicle_reg || null,
      status: jobRow.status || null,
      overallStatus,
      statusLabel: jobStatusMeta?.label || jobRow.status || null,
      statusMeta: {
        color: jobStatusMeta?.color || null,
        department: jobStatusMeta?.department || null,
        pausesTime: Boolean(jobStatusMeta?.pausesTime),
      },
      waitingStatus: jobRow.waiting_status || null,
      updatedAt:
        jobRow.status_updated_at || jobRow.updated_at || new Date().toISOString(),
      updatedBy: jobRow.status_updated_by || null,
    },
    tech: {
      status: techStatus || null,
    },
    workflows: {
      vhc: {
        required: vhcRequired,
        status: buildVhcStatus({
          required: vhcRequired,
          completedAt: vhcCompletedAt,
          sentAt: vhcSentAt,
          authorisedAt: vhcAuthorisedAt,
          declinedAt: vhcDeclinedAt,
          hasChecks: (vhcChecksRes?.count || 0) > 0,
        }),
        completedAt: vhcCompletedAt,
        sentAt: vhcSentAt,
        authorisedAt: vhcAuthorisedAt,
        declinedAt: vhcDeclinedAt,
      },
      invoice: {
        status: invoiceRes?.data?.payment_status || (invoiceRes?.data ? "Draft" : "missing"),
        invoiceId: invoiceRes?.data?.invoice_id || null,
        invoicedAt: invoiceRes?.data?.created_at || null,
      },
      parts: {
        status: partsStatus,
        blocking: partsStatus === "blocked",
        summary: partsSummary,
      },
      bookingRequest: {
        status: bookingRes?.data?.status || null,
        lastUpdatedAt: bookingRes?.data?.updated_at || null,
      },
      tracking: {
        vehicleStatus: latestVehicleEvent?.status || null,
        keyStatus: latestKeyEvent?.action || null,
        lastEventAt: lastTrackingAt ? ensureIsoString(lastTrackingAt, null) : null,
      },
      writeUp: {
        status: writeUpStatus,
        updatedAt: latestWriteUp?.updated_at || null,
      },
      clocking: {
        active: Boolean(activeClocking),
        activeTechUserId: activeClocking?.user_id || null,
        startedAt: activeClocking?.clock_in || null,
      },
    },
    timeline: timelineEntries,
    blockingReasons: buildBlockingReasons({
      jobRow,
      invoiceRow: invoiceRes?.data,
      vhcRequired,
      vhcCompletedAt,
      partsSummary,
      writeUpStatus,
    }),
    clockingSummary,
    normalizationWarnings: Array.from(normalizationWarnings),
    generatedAt: new Date().toISOString(),
  };

  return { success: true, data: snapshot };
};

export default buildJobStatusSnapshot;
