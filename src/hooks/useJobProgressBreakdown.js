// file location: src/hooks/useJobProgressBreakdown.js
// Pure derivation of a job's request-progress breakdown for the Scheduling
// dashboard → Job Progress section (circular ring + legend) and the
// Alerts & Reminders section. Keeps business logic out of the components
// (CLAUDE.md §4 — logic belongs in hooks, not components).
//
// Buckets each customer/job request into one of four states:
//   complete      → green  (--success)
//   inProgress    → amber  (--warning)
//   awaitingParts → red    (--danger)   (open request blocked on a part)
//   notStarted    → grey   (--grey-accent)
import { useMemo } from "react";
import { normalizeRequests } from "@/lib/jobCards/utils";

const COMPLETE_STATUSES = new Set(["complete", "completed", "done"]);
const NOT_STARTED_STATUSES = new Set(["not_started", "notstarted", "not started"]);
// parts_job_items statuses that mean the part has not yet arrived/been fitted.
const AWAITING_PART_STATUSES = new Set([
  "pending",
  "waiting_authorisation",
  "awaiting_stock",
  "on_order",
  "booked",
]);

const norm = (value) => String(value || "").trim().toLowerCase();

export default function useJobProgressBreakdown(jobData) {
  return useMemo(() => {
    // Prefer the structured jobRequests array; fall back to the normalized
    // legacy `requests` blob so the ring still renders for older jobs.
    const structured = Array.isArray(jobData?.jobRequests) ? jobData.jobRequests : [];
    const requests =
      structured.length > 0
        ? structured
        : normalizeRequests(jobData?.requests).map((req, index) => ({
            requestId: req.requestId ?? req.id ?? index,
            status: req.status,
          }));

    const partsItems = Array.isArray(jobData?.parts_job_items)
      ? jobData.parts_job_items
      : [];

    // requestId → true when it has at least one part still awaiting.
    const awaitingByRequest = new Set();
    partsItems.forEach((item) => {
      if (AWAITING_PART_STATUSES.has(norm(item?.status))) {
        const reqId = item?.allocated_to_request_id;
        if (reqId != null) awaitingByRequest.add(reqId);
      }
    });

    let complete = 0;
    let inProgress = 0;
    let awaitingParts = 0;
    let notStarted = 0;

    requests.forEach((req) => {
      const status = norm(req?.status);
      if (COMPLETE_STATUSES.has(status)) {
        complete += 1;
      } else if (awaitingByRequest.has(req?.requestId)) {
        awaitingParts += 1;
      } else if (NOT_STARTED_STATUSES.has(status)) {
        notStarted += 1;
      } else {
        inProgress += 1;
      }
    });

    const total = requests.length;
    const percentComplete = total > 0 ? Math.round((complete / total) * 100) : 0;

    const segments = [
      { key: "complete", label: "Complete", count: complete, token: "var(--success)" },
      { key: "inProgress", label: "In progress", count: inProgress, token: "var(--warning)" },
      { key: "awaitingParts", label: "Awaiting parts", count: awaitingParts, token: "var(--danger)" },
      { key: "notStarted", label: "Not started", count: notStarted, token: "var(--grey-accent)" },
    ];

    return {
      total,
      complete,
      inProgress,
      awaitingParts,
      notStarted,
      percentComplete,
      segments,
    };
  }, [jobData?.jobRequests, jobData?.requests, jobData?.parts_job_items]);
}
