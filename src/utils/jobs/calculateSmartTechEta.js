import { normalizeRequests } from "@/lib/jobCards/utils";
import { getJobRequests } from "@/lib/canonical/fields";
import { resolveMainStatusId, resolveSubStatusId } from "@/lib/status/statusFlow";

const COMPLETE_REQUEST_STATUSES = new Set(["complete", "completed", "done"]);
const TECH_COMPLETE_HINTS = new Set(["tech_complete", "complete", "completed"]);
const IGNORED_CLOCKING_TYPES = new Set(["valet"]);
const BLOCKING_SUB_STATUSES = new Set(["waiting_for_parts"]);
const RESUME_SUB_STATUSES = new Set(["parts_ready", "technician_started"]);
const REQUEST_HISTORY_PATTERN = /^Request\s+(\d+)\s+(Complete|Uncompleted)$/i;

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoString = (value) => {
  const date = value instanceof Date ? value : toDate(value);
  return date ? date.toISOString() : null;
};

const getMinutesDifference = (later, earlier) => {
  if (!(later instanceof Date) || !(earlier instanceof Date)) return null;
  const diffMs = later.getTime() - earlier.getTime();
  if (Number.isNaN(diffMs)) return null;
  return Math.max(Math.floor(diffMs / 60000), 0);
};

const normaliseRequestStatus = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return COMPLETE_REQUEST_STATUSES.has(normalized) ? "complete" : "inprogress";
};

const parseAllocatedMinutes = (hoursValue) => {
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 60);
};

const normaliseRequestRows = (job = {}) => {
  const sourceRows = getJobRequests(job);

  return (Array.isArray(sourceRows) ? sourceRows : []).map((row, index) => ({
    requestId: row?.requestId ?? row?.request_id ?? null,
    sortOrder:
      row?.sortOrder ?? row?.sort_order ?? (Number.isInteger(index) ? index + 1 : null),
    description: row?.description ?? row?.text ?? "",
    status: normaliseRequestStatus(row?.status),
    requestSource: row?.requestSource ?? row?.request_source ?? "customer_request",
    hours: row?.hours ?? row?.time ?? null,
    allocatedMinutes: parseAllocatedMinutes(row?.hours ?? row?.time ?? null),
    createdAt: row?.createdAt ?? row?.created_at ?? null,
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
  }));
};

const normaliseClockingRows = (etaSignals = {}) =>
  (Array.isArray(etaSignals?.clockingRows) ? etaSignals.clockingRows : [])
    .map((row) => ({
      id: row?.id ?? null,
      requestId: row?.requestId ?? row?.request_id ?? null,
      workType: String(row?.workType ?? row?.work_type ?? "").trim().toLowerCase(),
      clockIn: row?.clockIn ?? row?.clock_in ?? null,
      clockOut: row?.clockOut ?? row?.clock_out ?? null,
      createdAt: row?.createdAt ?? row?.created_at ?? null,
      updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
    }))
    .sort((left, right) => {
      const leftTime = toDate(left?.clockIn)?.getTime() || 0;
      const rightTime = toDate(right?.clockIn)?.getTime() || 0;
      return leftTime - rightTime;
    });

const normaliseHistoryRows = (etaSignals = {}) =>
  (Array.isArray(etaSignals?.historyRows) ? etaSignals.historyRows : [])
    .map((row) => ({
      id: row?.id ?? null,
      toStatus: row?.toStatus ?? row?.to_status ?? null,
      fromStatus: row?.fromStatus ?? row?.from_status ?? null,
      changedAt: row?.changedAt ?? row?.changed_at ?? null,
      reason: row?.reason ?? null,
    }))
    .sort((left, right) => {
      const leftTime = toDate(left?.changedAt)?.getTime() || 0;
      const rightTime = toDate(right?.changedAt)?.getTime() || 0;
      return leftTime - rightTime;
    });

const getRequestCompletionHistory = (requests = [], historyRows = []) => {
  const requestBySortOrder = new Map();

  requests.forEach((request) => {
    const sortOrder = Number(request?.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder <= 0) return;
    if (!requestBySortOrder.has(String(sortOrder))) {
      requestBySortOrder.set(String(sortOrder), request);
    }
  });

  const historyByRequestKey = new Map();

  historyRows.forEach((row) => {
    const label = String(row?.toStatus || "").trim();
    const match = label.match(REQUEST_HISTORY_PATTERN);
    if (!match) return;

    const request = requestBySortOrder.get(String(Number(match[1])));
    if (!request) return;

    const requestKey =
      request?.requestId !== null && request?.requestId !== undefined
        ? `request:${request.requestId}`
        : `sort:${request.sortOrder}`;

    historyByRequestKey.set(requestKey, {
      changedAt: row?.changedAt || null,
      isComplete: String(match[2] || "").toLowerCase() === "complete",
      source: "history",
    });
  });

  return historyByRequestKey;
};

const getRequestClockingSummary = (requests = [], clockingRows = [], nowDate) => {
  const requestClockingMap = new Map();

  requests.forEach((request) => {
    const requestId = Number(request?.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) return;

    const matchingRows = clockingRows.filter(
      (row) =>
        !IGNORED_CLOCKING_TYPES.has(row?.workType) &&
        Number(row?.requestId) === requestId
    );

    if (matchingRows.length === 0) return;

    let trackedMinutes = 0;
    let startedAt = null;
    let completedAt = null;
    let hasOpenSegment = false;

    matchingRows.forEach((row) => {
      const clockInDate = toDate(row?.clockIn);
      if (clockInDate && (!startedAt || clockInDate < startedAt)) {
        startedAt = clockInDate;
      }

      const clockOutDate = toDate(row?.clockOut);
      if (!clockOutDate) {
        hasOpenSegment = true;
        return;
      }

      if (!completedAt || clockOutDate > completedAt) {
        completedAt = clockOutDate;
      }

      const endDate = clockOutDate || nowDate;
      const minutes = getMinutesDifference(endDate, clockInDate);
      if (minutes !== null) {
        trackedMinutes += minutes;
      }
    });

    requestClockingMap.set(String(requestId), {
      startedAt: toIsoString(startedAt),
      completedAt: toIsoString(completedAt),
      trackedMinutes: trackedMinutes > 0 ? trackedMinutes : null,
      hasOpenSegment,
    });
  });

  return requestClockingMap;
};

const resolveJobTechComplete = ({ job = {}, etaSignals = {}, historyRows = [], requests = [] }) => {
  const rawStatus = String(job?.rawStatus || etaSignals?.status || job?.status || "")
    .trim()
    .toLowerCase();
  const mainStatusId = resolveMainStatusId(job?.rawStatus || etaSignals?.status || job?.status);
  const techCompletionStatus = String(
    job?.techCompletionStatus || etaSignals?.techCompletionStatus || ""
  )
    .trim()
    .toLowerCase();

  if (TECH_COMPLETE_HINTS.has(techCompletionStatus)) {
    return true;
  }

  if (
    rawStatus.includes("technician_work_completed") ||
    rawStatus.includes("tech_complete") ||
    rawStatus === "complete" ||
    rawStatus === "completed"
  ) {
    return true;
  }

  if (mainStatusId === "released") {
    return true;
  }

  const latestTechComplete = [...historyRows]
    .reverse()
    .find((row) => resolveSubStatusId(row?.toStatus) === "technician_work_completed");
  const latestRestart = [...historyRows]
    .reverse()
    .find((row) => {
      const normalized = resolveSubStatusId(row?.toStatus);
      return normalized === "technician_started" || REQUEST_HISTORY_PATTERN.test(String(row?.toStatus || "").trim());
    });

  const latestTechCompleteAt = toDate(latestTechComplete?.changedAt);
  const latestRestartAt = toDate(latestRestart?.changedAt);
  if (latestTechCompleteAt && (!latestRestartAt || latestTechCompleteAt >= latestRestartAt)) {
    return true;
  }

  const activeRequests = requests.filter((request) => request && request.description !== "");
  return activeRequests.length > 0 && activeRequests.every((request) => request.status === "complete");
};

const resolveStartSignal = ({ job = {}, etaSignals = {}, clockingRows = [], historyRows = [] }) => {
  const workshopStartedAt = toDate(job?.workshopStartedAt || etaSignals?.workshopStartedAt);
  if (workshopStartedAt) {
    return {
      startTimeUsed: workshopStartedAt,
      source: "workshop_started_at",
    };
  }

  const firstActiveClockIn = clockingRows.find(
    (row) => !IGNORED_CLOCKING_TYPES.has(row?.workType) && toDate(row?.clockIn)
  );
  if (firstActiveClockIn) {
    return {
      startTimeUsed: toDate(firstActiveClockIn.clockIn),
      source: "job_clocking",
    };
  }

  const firstTechStartHistory = historyRows.find(
    (row) => resolveSubStatusId(row?.toStatus) === "technician_started" && toDate(row?.changedAt)
  );
  if (firstTechStartHistory) {
    return {
      startTimeUsed: toDate(firstTechStartHistory.changedAt),
      source: "status_history",
    };
  }

  const firstRequestActivity = historyRows.find((row) => {
    const label = String(row?.toStatus || "").trim();
    return REQUEST_HISTORY_PATTERN.test(label) && toDate(row?.changedAt);
  });
  if (firstRequestActivity) {
    return {
      startTimeUsed: toDate(firstRequestActivity.changedAt),
      source: "request_activity",
    };
  }

  return {
    startTimeUsed: null,
    source: null,
  };
};

const resolveBlockedByWorkflow = ({ job = {}, historyRows = [], clockingRows = [] }) => {
  const rawStatus = String(job?.rawStatus || job?.status || "").trim().toLowerCase();
  const waitingStatus = String(job?.waitingStatus || "").trim().toLowerCase();
  const hasActiveClocking = clockingRows.some(
    (row) => !IGNORED_CLOCKING_TYPES.has(row?.workType) && !toDate(row?.clockOut)
  );

  const latestBlockingEvent = [...historyRows]
    .reverse()
    .find((row) => BLOCKING_SUB_STATUSES.has(resolveSubStatusId(row?.toStatus)));
  const latestResumeEvent = [...historyRows]
    .reverse()
    .find((row) => RESUME_SUB_STATUSES.has(resolveSubStatusId(row?.toStatus)));

  if (hasActiveClocking) {
    return false;
  }

  const latestBlockingAt = toDate(latestBlockingEvent?.changedAt);
  const latestResumeAt = toDate(latestResumeEvent?.changedAt);
  if (latestBlockingAt && (!latestResumeAt || latestBlockingAt > latestResumeAt)) {
    return true;
  }

  return (
    rawStatus.includes("waiting_for_parts") ||
    rawStatus.includes("retail_parts_on_order") ||
    rawStatus.includes("warranty_parts_on_order") ||
    waitingStatus.includes("part") ||
    waitingStatus.includes("delay")
  );
};

const formatPredictedFinish = (value, nowDate) => {
  const finishDate = value instanceof Date ? value : toDate(value);
  if (!finishDate || !nowDate) return "Awaiting timing data";

  const timeLabel = finishDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isSameDay =
    finishDate.getFullYear() === nowDate.getFullYear() &&
    finishDate.getMonth() === nowDate.getMonth() &&
    finishDate.getDate() === nowDate.getDate();

  if (isSameDay) {
    return `Today, ${timeLabel}`;
  }

  const tomorrow = new Date(nowDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isTomorrow =
    finishDate.getFullYear() === tomorrow.getFullYear() &&
    finishDate.getMonth() === tomorrow.getMonth() &&
    finishDate.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return `Tomorrow, ${timeLabel}`;
  }

  const dayLabel = finishDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

  return `${dayLabel}, ${timeLabel}`;
};

const buildResult = ({
  status,
  predictedFinishAt = null,
  predictedRemainingMinutes = null,
  confidence = null,
  displayText,
  reasoning,
}) => ({
  status,
  predictedFinishAt,
  predictedRemainingMinutes,
  confidence,
  displayText,
  reasoning,
});

export const calculateSmartTechEta = (job = {}, options = {}) => {
  const etaSignals = options?.etaSignals || job?.etaSignals || job?.smartEtaSignals || {};
  const nowDate = toDate(options?.now) || new Date();
  const requests = normaliseRequestRows(job);
  const clockingRows = normaliseClockingRows(etaSignals);
  const historyRows = normaliseHistoryRows(etaSignals);
  const startSignal = resolveStartSignal({ job, etaSignals, clockingRows, historyRows });
  const requestHistoryMap = getRequestCompletionHistory(requests, historyRows);
  const requestClockingMap = getRequestClockingSummary(requests, clockingRows, nowDate);
  const blockedByWorkflow = resolveBlockedByWorkflow({ job, historyRows, clockingRows });

  const requestBreakdown = requests.map((request) => {
    const requestKey =
      request?.requestId !== null && request?.requestId !== undefined
        ? `request:${request.requestId}`
        : `sort:${request.sortOrder}`;
    const historySignal = requestHistoryMap.get(requestKey) || null;
    const clockingSignal =
      request?.requestId !== null && request?.requestId !== undefined
        ? requestClockingMap.get(String(request.requestId)) || null
        : null;

    const reliableCompletionAt =
      historySignal?.isComplete && historySignal?.changedAt
        ? historySignal.changedAt
        : clockingSignal?.completedAt || null;

    return {
      ...request,
      isComplete: request.status === "complete",
      reliableCompletionAt,
      reliableCompletionSource:
        historySignal?.isComplete && historySignal?.changedAt
          ? "history"
          : clockingSignal?.completedAt
          ? "request_clocking"
          : null,
      trackedMinutes: clockingSignal?.trackedMinutes || null,
      clockingStartedAt: clockingSignal?.startedAt || null,
      clockingCompletedAt: clockingSignal?.completedAt || null,
    };
  });

  const activeRequests = requestBreakdown.filter((request) => {
    const description = String(request?.description || "").trim();
    return description.length > 0 || request?.requestId !== null;
  });
  const completedRequests = activeRequests.filter((request) => request.isComplete);
  const unfinishedRequests = activeRequests.filter((request) => !request.isComplete);
  const totalAllocatedMinutes = activeRequests.reduce(
    (total, request) => total + request.allocatedMinutes,
    0
  );
  const completedAllocatedMinutes = completedRequests.reduce(
    (total, request) => total + request.allocatedMinutes,
    0
  );
  const remainingAllocatedMinutes = Math.max(
    totalAllocatedMinutes - completedAllocatedMinutes,
    0
  );
  const validAllocatedRequestCount = activeRequests.filter(
    (request) => request.allocatedMinutes > 0
  ).length;
  const missingAllocatedRequestCount = Math.max(
    activeRequests.length - validAllocatedRequestCount,
    0
  );
  const majorityHoursMissing =
    activeRequests.length > 0 && missingAllocatedRequestCount > activeRequests.length / 2;

  const elapsedMinutes =
    startSignal.startTimeUsed instanceof Date
      ? getMinutesDifference(nowDate, startSignal.startTimeUsed)
      : 0;

  const hasReliableCompletionSignal = completedRequests.some(
    (request) => Boolean(request.reliableCompletionAt)
  );

  const reasoningBase = {
    startTimeUsed: toIsoString(startSignal.startTimeUsed),
    startSource: startSignal.source,
    totalAllocatedMinutes,
    completedAllocatedMinutes,
    remainingAllocatedMinutes,
    elapsedMinutes,
    efficiencyRatioRaw: null,
    efficiencyRatioSmoothed: null,
    progressRatio: null,
    blockedByWorkflow,
    validAllocatedRequestCount,
    missingAllocatedRequestCount,
    majorityHoursMissing,
    completedRequestCount: completedRequests.length,
    unfinishedRequestCount: unfinishedRequests.length,
    reliableCompletionSignalCount: completedRequests.filter(
      (request) => Boolean(request.reliableCompletionAt)
    ).length,
    recentAdjustmentMinutes: 0,
    recentAdjustmentType: null,
  };

  const jobIsExplicitlyComplete = resolveJobTechComplete({
    job,
    etaSignals,
    historyRows,
    requests: activeRequests,
  });

  if (jobIsExplicitlyComplete) {
    return buildResult({
      status: "completed",
      predictedFinishAt: null,
      predictedRemainingMinutes: null,
      confidence: null,
      displayText: "Completed",
      reasoning: reasoningBase,
    });
  }

  if (!startSignal.startTimeUsed) {
    if (totalAllocatedMinutes > 0) {
      return buildResult({
        status: "not_started",
        predictedFinishAt: null,
        predictedRemainingMinutes: null,
        confidence: null,
        displayText: "Not started",
        reasoning: reasoningBase,
      });
    }

    return buildResult({
      status: "awaiting_data",
      predictedFinishAt: null,
      predictedRemainingMinutes: null,
      confidence: null,
      displayText: "Awaiting timing data",
      reasoning: reasoningBase,
    });
  }

  if (blockedByWorkflow) {
    return buildResult({
      status: "awaiting_data",
      predictedFinishAt: null,
      predictedRemainingMinutes: null,
      confidence: "low",
      displayText: "Awaiting timing data",
      reasoning: reasoningBase,
    });
  }

  if (totalAllocatedMinutes <= 0) {
    return buildResult({
      status: "awaiting_data",
      predictedFinishAt: null,
      predictedRemainingMinutes: null,
      confidence: null,
      displayText: "Awaiting timing data",
      reasoning: reasoningBase,
    });
  }

  if (majorityHoursMissing) {
    return buildResult({
      status: "awaiting_data",
      predictedFinishAt: null,
      predictedRemainingMinutes: null,
      confidence: null,
      displayText: "Awaiting timing data",
      reasoning: reasoningBase,
    });
  }

  if (unfinishedRequests.length > 0 && unfinishedRequests.every((request) => request.allocatedMinutes <= 0)) {
    return buildResult({
      status: "awaiting_data",
      predictedFinishAt: null,
      predictedRemainingMinutes: null,
      confidence: null,
      displayText: "Awaiting timing data",
      reasoning: reasoningBase,
    });
  }

  let predictedRemainingMinutes = null;
  let efficiencyRatioRaw = null;
  let efficiencyRatioSmoothed = null;
  let progressRatio = totalAllocatedMinutes > 0
    ? clamp(completedAllocatedMinutes / totalAllocatedMinutes, 0, 1)
    : null;
  let usedFallbackConfidence = null;

  // No completed allocated work yet: use the stable baseline based on job start + allocation.
  if (completedAllocatedMinutes <= 0) {
    if (elapsedMinutes < 15) {
      const initialFinish = new Date(
        startSignal.startTimeUsed.getTime() + totalAllocatedMinutes * 60000
      );
      predictedRemainingMinutes = Math.max(
        getMinutesDifference(initialFinish, nowDate) ?? totalAllocatedMinutes,
        5
      );
    } else {
      let baseRemainingMinutes = Math.max(totalAllocatedMinutes - elapsedMinutes, 0);

      if (elapsedMinutes > totalAllocatedMinutes) {
        const overrunMinutes = elapsedMinutes - totalAllocatedMinutes;
        baseRemainingMinutes = Math.min(
          Math.max(Math.round(overrunMinutes * 0.35), 10),
          45
        );
      }

      predictedRemainingMinutes = Math.max(baseRemainingMinutes, 5);
    }

    usedFallbackConfidence = "low";
  } else {
    // Completed work gives us a real pace signal. Blend it with neutral pace to avoid wild swings.
    efficiencyRatioRaw = elapsedMinutes > 0
      ? elapsedMinutes / completedAllocatedMinutes
      : null;

    const efficiencyRatioClamped =
      efficiencyRatioRaw !== null ? clamp(efficiencyRatioRaw, 0.65, 1.6) : 1;
    const paceWeight = clamp(progressRatio ?? 0, 0.2, 0.85);
    efficiencyRatioSmoothed = (1 * (1 - paceWeight)) + (efficiencyRatioClamped * paceWeight);

    predictedRemainingMinutes = Math.round(
      remainingAllocatedMinutes * efficiencyRatioSmoothed
    );

    if (unfinishedRequests.length > 0) {
      predictedRemainingMinutes = Math.max(predictedRemainingMinutes, 5);
    }

    if (elapsedMinutes > totalAllocatedMinutes) {
      predictedRemainingMinutes = Math.min(
        predictedRemainingMinutes,
        Math.round(remainingAllocatedMinutes * 1.75)
      );
    }

    predictedRemainingMinutes = clamp(predictedRemainingMinutes, 0, 720);

    const latestCompletedWithTrackedTime = completedRequests
      .filter(
        (request) =>
          request.allocatedMinutes > 0 &&
          Number.isFinite(request.trackedMinutes) &&
          request.trackedMinutes > 0 &&
          request.reliableCompletionAt
      )
      .sort((left, right) => {
        const leftTime = toDate(left.reliableCompletionAt)?.getTime() || 0;
        const rightTime = toDate(right.reliableCompletionAt)?.getTime() || 0;
        return rightTime - leftTime;
      })[0] || null;

    let recentAdjustmentMinutes = 0;
    let recentAdjustmentType = null;

    if (latestCompletedWithTrackedTime) {
      const completionRatio =
        latestCompletedWithTrackedTime.trackedMinutes /
        latestCompletedWithTrackedTime.allocatedMinutes;

      if (completionRatio < 0.7) {
        recentAdjustmentMinutes = Math.min(
          Math.round(predictedRemainingMinutes * 0.05),
          20
        );
        predictedRemainingMinutes = Math.max(
          predictedRemainingMinutes - recentAdjustmentMinutes,
          5
        );
        recentAdjustmentType = "fast_completion_bonus";
      } else if (completionRatio > 1.3) {
        recentAdjustmentMinutes = Math.min(
          Math.round(predictedRemainingMinutes * 0.05),
          20
        );
        predictedRemainingMinutes += recentAdjustmentMinutes;
        recentAdjustmentType = "slow_completion_penalty";
      }
    }

    if (unfinishedRequests.length === 1 && remainingAllocatedMinutes > 0) {
      predictedRemainingMinutes = Math.min(
        predictedRemainingMinutes,
        Math.round(remainingAllocatedMinutes * 1.25)
      );
    }

    predictedRemainingMinutes = clamp(predictedRemainingMinutes, 0, 720);

    reasoningBase.recentAdjustmentMinutes = recentAdjustmentMinutes;
    reasoningBase.recentAdjustmentType = recentAdjustmentType;

    if (
      startSignal.startTimeUsed &&
      progressRatio >= 0.6 &&
      hasReliableCompletionSignal &&
      !majorityHoursMissing
    ) {
      usedFallbackConfidence = "high";
    } else {
      usedFallbackConfidence = "medium";
    }

    if (!hasReliableCompletionSignal) {
      usedFallbackConfidence = "medium";
    }

    if (unfinishedRequests.length === 1 && hasReliableCompletionSignal) {
      usedFallbackConfidence =
        usedFallbackConfidence === "low" ? "medium" : usedFallbackConfidence;
    }
  }

  const predictedFinishDate = new Date(nowDate.getTime() + predictedRemainingMinutes * 60000);

  return buildResult({
    status: "predicted",
    predictedFinishAt: predictedFinishDate.toISOString(),
    predictedRemainingMinutes,
    confidence: usedFallbackConfidence,
    displayText: formatPredictedFinish(predictedFinishDate, nowDate),
    reasoning: {
      ...reasoningBase,
      efficiencyRatioRaw,
      efficiencyRatioSmoothed,
      progressRatio,
    },
  });
};

export default calculateSmartTechEta;
