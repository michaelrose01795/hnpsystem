import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();

const JOB_FIELDS = [
  "id",
  "status",
  "tech_completion_status",
  "waiting_status",
  "updated_at",
  "workshop_started_at",
  "completed_at",
].join(", ");

const CLOCKING_FIELDS = [
  "id",
  "job_id",
  "request_id",
  "clock_in",
  "clock_out",
  "work_type",
  "created_at",
  "updated_at",
].join(", ");

const HISTORY_FIELDS = [
  "id",
  "job_id",
  "from_status",
  "to_status",
  "changed_at",
  "reason",
].join(", ");

const chunk = (values = [], size = 100) => {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const uniqueJobIds = (jobIds = []) =>
  Array.from(
    new Set(
      (Array.isArray(jobIds) ? jobIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );

const mapJobRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
    const jobId = Number(row?.id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return accumulator;
    }
    accumulator[jobId] = {
      jobId,
      status: row?.status || null,
      techCompletionStatus: row?.tech_completion_status || null,
      waitingStatus: row?.waiting_status || null,
      updatedAt: row?.updated_at || null,
      workshopStartedAt: row?.workshop_started_at || null,
      completedAt: row?.completed_at || null,
      clockingRows: [],
      historyRows: [],
    };
    return accumulator;
  }, {});

const ensureJobBucket = (mapping, jobId) => {
  if (!mapping[jobId]) {
    mapping[jobId] = {
      jobId,
      status: null,
      techCompletionStatus: null,
      waitingStatus: null,
      updatedAt: null,
      workshopStartedAt: null,
      completedAt: null,
      clockingRows: [],
      historyRows: [],
    };
  }
  return mapping[jobId];
};

export const getValetEtaSignals = async (jobIds = []) => {
  const ids = uniqueJobIds(jobIds);
  if (ids.length === 0) {
    return {};
  }

  const idChunks = chunk(ids, 100);

  const [jobResponses, clockingResponses, historyResponses] = await Promise.all([
    Promise.all(
      idChunks.map((idChunk) =>
        db.from("jobs").select(JOB_FIELDS).in("id", idChunk)
      )
    ),
    Promise.all(
      idChunks.map((idChunk) =>
        db
          .from("job_clocking")
          .select(CLOCKING_FIELDS)
          .in("job_id", idChunk)
          .order("clock_in", { ascending: true })
      )
    ),
    Promise.all(
      idChunks.map((idChunk) =>
        db
          .from("job_status_history")
          .select(HISTORY_FIELDS)
          .in("job_id", idChunk)
          .order("changed_at", { ascending: true })
      )
    ),
  ]);

  jobResponses.forEach((response) => {
    if (response?.error) {
      throw response.error;
    }
  });
  clockingResponses.forEach((response) => {
    if (response?.error) {
      throw response.error;
    }
  });
  historyResponses.forEach((response) => {
    if (response?.error) {
      throw response.error;
    }
  });

  const mapping = mapJobRows(jobResponses.flatMap((response) => response?.data || []));

  clockingResponses.flatMap((response) => response?.data || []).forEach((row) => {
    const jobId = Number(row?.job_id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return;
    }
    const bucket = ensureJobBucket(mapping, jobId);
    bucket.clockingRows.push({
      id: row?.id ?? null,
      jobId,
      requestId: row?.request_id ?? null,
      clockIn: row?.clock_in || null,
      clockOut: row?.clock_out || null,
      workType: row?.work_type || null,
      createdAt: row?.created_at || null,
      updatedAt: row?.updated_at || null,
    });
  });

  historyResponses.flatMap((response) => response?.data || []).forEach((row) => {
    const jobId = Number(row?.job_id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return;
    }
    const bucket = ensureJobBucket(mapping, jobId);
    bucket.historyRows.push({
      id: row?.id ?? null,
      jobId,
      fromStatus: row?.from_status || null,
      toStatus: row?.to_status || null,
      changedAt: row?.changed_at || null,
      reason: row?.reason || null,
    });
  });

  ids.forEach((jobId) => {
    ensureJobBucket(mapping, jobId);
  });

  return mapping;
};

export default getValetEtaSignals;
