// file location: src/lib/database/partsInventory.js
import { supabase } from "@/lib/database/supabaseClient";

export const OPEN_PART_DEMAND_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
  "booked",
  "pre_picked",
  "stock",
  "allocated",
  "picked",
  "loaded",
  "unavailable",
];

const OPEN_REQUEST_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
];

const CLOSED_JOB_STATUSES = new Set([
  "cancelled",
  "collected",
  "complete",
  "completed",
  "delivered to customer",
]);

export const isOpenPartsJob = (job) => {
  if (!job || job.completed_at) return false;
  return !CLOSED_JOB_STATUSES.has(String(job.status || "").trim().toLowerCase());
};

export function summarizePartDemand(linkedJobs = {}) {
  const jobCounts = {};
  const requirementCounts = {};
  const demandQuantities = {};

  Object.entries(linkedJobs).forEach(([partId, links]) => {
    jobCounts[partId] = new Set(links.map((link) => link.job_id)).size;
    requirementCounts[partId] = links.length;
    demandQuantities[partId] = links.reduce(
      (total, link) => total + Math.max(0, Number(link.quantity) || 0),
      0
    );
  });

  return { jobCounts, requirementCounts, demandQuantities };
}

export function filterUnpromotedPartRequests(jobItems = [], requests = []) {
  const promotedRequestIds = new Set(
    jobItems.map((item) => item.source_request_id).filter(Boolean)
  );
  return requests.filter((request) => !promotedRequestIds.has(request.request_id));
}

export async function getPartDemandMaps(partIds = []) {
  const ids = [...new Set((partIds || []).filter(Boolean))];
  if (ids.length === 0) {
    return { linkedJobs: {}, jobCounts: {}, requirementCounts: {}, demandQuantities: {} };
  }

  const [{ data: jobItems, error: jobItemsError }, { data: requestRows, error: requestError }] =
    await Promise.all([
      supabase
        .from("parts_job_items")
        .select("part_id, job_id, status, origin, quantity_requested, source_request_id")
        .in("part_id", ids)
        .in("status", OPEN_PART_DEMAND_STATUSES),
      supabase
        .from("parts_requests")
        .select("request_id, job_id, part_id, status, quantity, source, fulfilled_by")
        .in("part_id", ids)
        .in("status", OPEN_REQUEST_STATUSES)
        .is("fulfilled_by", null),
    ]);

  if (jobItemsError) throw jobItemsError;
  if (requestError) throw requestError;

  // A request promoted into parts_job_items is represented by that job item only.
  // This prevents the same database demand from being counted twice while legacy
  // rows are still waiting for parts_requests.fulfilled_by to be populated.
  const unfulfilledRequests = filterUnpromotedPartRequests(jobItems || [], requestRows || []);

  const jobIds = [...new Set([
    ...(jobItems || []).map((item) => item.job_id),
    ...unfulfilledRequests.map((request) => request.job_id),
  ].filter(Boolean))];

  let jobMap = new Map();
  if (jobIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, job_number, waiting_status, status, completed_at")
      .in("id", jobIds);

    if (jobsError) throw jobsError;
    jobMap = new Map((jobs || []).filter(isOpenPartsJob).map((job) => [job.id, job]));
  }

  const linkedJobs = {};
  const pushLink = (partId, entry) => {
    if (!partId || !entry?.job_id || !jobMap.has(entry.job_id)) return;
    if (!linkedJobs[partId]) linkedJobs[partId] = [];
    linkedJobs[partId].push(entry);
  };

  (jobItems || []).forEach((item) => {
    const job = jobMap.get(item.job_id);
    if (!job) return;
    pushLink(item.part_id, {
      type: "job_item",
      job_id: item.job_id,
      job_number: job.job_number || `#${item.job_id}`,
      job_waiting_status: job.waiting_status || job.status || null,
      status: item.status,
      source: item.origin || "manual",
      quantity: Number(item.quantity_requested) || 1,
      source_request_id: item.source_request_id || null,
    });
  });

  unfulfilledRequests.forEach((request) => {
    const job = jobMap.get(request.job_id);
    if (!job) return;
    pushLink(request.part_id, {
      type: "request",
      job_id: request.job_id,
      job_number: job.job_number || `#${request.job_id}`,
      job_waiting_status: job.waiting_status || job.status || null,
      status: request.status || "waiting_authorisation",
      source: request.source || "tech_request",
      quantity: Number(request.quantity) || 1,
      request_id: request.request_id,
    });
  });

  const { jobCounts, requirementCounts, demandQuantities } = summarizePartDemand(linkedJobs);

  return { linkedJobs, jobCounts, requirementCounts, demandQuantities };
}
