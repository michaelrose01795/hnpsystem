// file location: src/lib/jobCards/writeUpTasks.js
//
// Pure write-up task helpers, with no database dependency.
//
// These normalise and summarise task lists that have already been fetched - no
// I/O, no client, no session. They lived in src/lib/database/jobs.js, and that
// co-location had a real cost: /tech/[jobNumber] calls summarizeWriteUpTasks()
// synchronously during render (inside a useMemo, so it cannot be deferred behind
// a dynamic import), which pulled the whole jobs module - and with it the
// Supabase browser client, 213 KB of @supabase/supabase-js - into that route's
// first load.
//
// The implementations are unchanged, and src/lib/database/jobs.js re-exports the
// two public names so every existing import keeps working.

// ✅ Normalise stored task status values
export const sanitiseTaskStatus = (status) =>
  status === true
    ? "complete"
    : status === false
    ? "additional_work"
    : status === "complete" || status === "inprogress"
    ? status
    : "additional_work";

export const normalizeRequestTaskLabel = (value = "") =>
  String(value || "")
    .replace(/^Request\s*\d+\s*:\s*/i, "")
    .trim()
    .toLowerCase();

export const isCompleteRequestStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "complete" || normalized === "completed" || normalized === "done";
};

export const normalizeSearchValue = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const isMotRequestLike = (request = {}) => {
  const haystack = [
    request?.description,
    request?.jobType,
    request?.job_type,
    request?.serviceType,
    request?.service_type,
    request?.requestSource,
    request?.request_source,
    request?.label,
    request?.raw,
    request?.noteText,
    request?.note_text,
  ]
    .map((value) => normalizeSearchValue(value))
    .filter(Boolean)
    .join(" ");

  return haystack.includes("mot");
};

export const isTaskComplete = (task = {}) =>
  typeof task?.checked === "boolean" ? task.checked : sanitiseTaskStatus(task?.status) === "complete";

export const summarizeWriteUpTasks = (tasks = []) => {
  const normalizedTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && typeof task === "object")
    .map((task) => {
      const source = String(task?.source || "request").trim().toLowerCase();
      const checked = isTaskComplete(task);
      const isMot = Boolean(task?.isMot) || (source === "request" && isMotRequestLike(task));

      return {
        source,
        sourceKey: task?.sourceKey || task?.source_key || `${source}-${task?.label || "task"}`,
        label: (task?.label || "").toString().trim(),
        checked,
        status: checked ? "complete" : "additional_work",
        isMot,
        requestId:
          task?.requestId !== null && task?.requestId !== undefined
            ? Number(task.requestId)
            : task?.request_id !== null && task?.request_id !== undefined
            ? Number(task.request_id)
            : null,
        sortOrder:
          task?.sortOrder !== null && task?.sortOrder !== undefined
            ? Number(task.sortOrder)
            : task?.sort_order !== null && task?.sort_order !== undefined
            ? Number(task.sort_order)
            : null,
      };
    });

  const pendingTasks = normalizedTasks.filter((task) => !task.checked);
  const pendingMotTasks = pendingTasks.filter((task) => task.isMot);
  const pendingNonMotTasks = pendingTasks.filter((task) => !task.isMot);

  return {
    totalCount: normalizedTasks.length,
    allTasksComplete: normalizedTasks.length > 0 && pendingTasks.length === 0,
    technicianTasksComplete: normalizedTasks.length > 0 && pendingNonMotTasks.length === 0,
    hasPendingMotOnly: pendingMotTasks.length > 0 && pendingNonMotTasks.length === 0,
    pendingCount: pendingTasks.length,
    pendingMotCount: pendingMotTasks.length,
    pendingNonMotCount: pendingNonMotTasks.length,
    pendingTasks,
    pendingMotTasks,
    pendingNonMotTasks,
  };
};
