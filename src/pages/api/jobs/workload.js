// file location: src/pages/api/jobs/workload.js
//
// Server-owned job list for the /jobs screen.
//
// The jobs list used to call getAllJobs() straight from the browser: an
// unbounded PostgREST select over every job ever created, with 14 nested
// relations (vehicle→customer, parts_job_items→parts_catalog,
// goods_in_items→goods_in, plus the full text of every note, write-up, request
// and file). It then rendered about 30 fields per row.
//
// This route runs the narrow, bounded getJobsWorkload() query instead — same row
// shape (it goes through the same formatJobData), only the columns the list
// actually reads, and a row cap. Running it server-side also means the payload
// crosses the network once, from a function that sits next to the database,
// rather than being assembled by PostgREST for each browser tab.
//
// Guard matches the other job-card routes: any authenticated staff session.
import {
  getJobsWorkload,
  getJobWorkloadRow,
  JOBS_WORKLOAD_DEFAULT_LIMIT,
} from "@/lib/database/jobs";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { createServerTimer } from "@/lib/perf/serverTiming";

// Hard ceiling so a crafted `limit` cannot ask for the unbounded query back.
const MAX_LIMIT = 1000;

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const timer = createServerTimer();
  res.setHeader("Cache-Control", "private, no-store");

  // Single-row mode: the list asks for exactly the job a realtime event named,
  // so a change to one job does not re-download the whole workload.
  if (req.query.jobId) {
    try {
      const job = await timer.db("jobWorkloadRow", () => getJobWorkloadRow(req.query.jobId, { throwOnError: true }));
      timer.applyTo(res);
      return res.status(200).json({ success: true, data: job });
    } catch (error) {
      console.error("❌ GET /api/jobs/workload?jobId error:", error);
      return res
        .status(500)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  const requestedLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
      : JOBS_WORKLOAD_DEFAULT_LIMIT;

  try {
    // `fresh=1` bypasses the short server-side dedupe window; the list uses it
    // for realtime-triggered refetches so a change is never masked by the cache.
    const jobs = await getJobsWorkload({
      limit,
      throwOnError: true,
      noCache: req.query.fresh === "1",
    });
    return res.status(200).json({ success: true, data: jobs, limit });
  } catch (error) {
    console.error("❌ GET /api/jobs/workload error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
}

export default withRoleGuard(handler);
