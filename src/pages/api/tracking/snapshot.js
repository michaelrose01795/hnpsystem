// file location: src/pages/api/tracking/snapshot.js
import { fetchTrackingEntryForJob, fetchTrackingSnapshot } from "@/lib/database/tracking"; // import database helper
import { initialTrackingEntries } from "@/lib/tracking/mockEntries";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { createServerTimer } from "@/lib/perf/serverTiming"; // splits this route's TTFB into database vs handler time

const respondWithMockData = (res, reason = null) => {
  return res.status(200).json({
    success: true,
    data: initialTrackingEntries,
    meta: {
      mocked: true,
      reason: reason || "Supabase credentials unavailable",
    },
  });
};

// Single-job lookup against the same mock list, so the job card and technician
// workspace behave identically to the full list when credentials are absent.
const findMockTrackingEntry = ({ jobId, jobNumber, vehicleReg }) => {
  const wantedJobId = jobId ? String(jobId) : "";
  const wantedJobNumber = String(jobNumber || "").trim().toLowerCase();
  const wantedReg = String(vehicleReg || "").trim().toLowerCase();
  return (
    initialTrackingEntries.find((entry) => {
      if (!entry) return false;
      const entryJobId = entry.jobId !== null && entry.jobId !== undefined ? String(entry.jobId) : "";
      const entryJobNumber = String(entry.jobNumber || "").trim().toLowerCase();
      const entryReg = String(entry.vehicleReg || entry.reg || "").trim().toLowerCase();
      return (
        (wantedJobId && entryJobId === wantedJobId) ||
        (wantedJobNumber && entryJobNumber === wantedJobNumber) ||
        (wantedReg && entryReg === wantedReg)
      );
    }) || null
  );
};

const shouldServeMockTrackingData = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return true;
  }

  const placeholders = ["your-project-id", "your-anon-key-here", "your-service-role-key"];
  return [supabaseUrl, anonKey, serviceKey].some((value) =>
    placeholders.some((token) => value.toLowerCase().includes(token))
  );
};

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // Single-job mode.
  //
  // The job card and the technician workspace used to call
  // `fetchTrackingSnapshot()` / `fetchTrackingEntryForJob()` straight from the
  // browser under the public anon key — the last thing keeping
  // key_tracking_events and vehicle_tracking_events readable by anon. Both now
  // read through this route, so those tables can be closed to PostgREST
  // entirely (supabase/migrations/20260826120000_tracking_events_server_only.sql)
  // while staff access keeps running through the same session + RBAC guard as
  // every other tracking API.
  const { jobId, jobNumber, vehicleReg } = req.query || {};
  const isSingleJobRequest = Boolean(jobId || jobNumber || vehicleReg);

  if (shouldServeMockTrackingData()) {
    if (isSingleJobRequest) {
      return res.status(200).json({
        success: true,
        data: findMockTrackingEntry({ jobId, jobNumber, vehicleReg }),
        meta: { mocked: true, reason: "Supabase credentials unavailable" },
      });
    }
    return respondWithMockData(res);
  }

  // This is now the only read path for the /tracking list — the page used to
  // query Supabase directly from the browser, so the route had no server-side
  // timing at all. `db` is the two tracking-event queries plus their
  // job/customer/vehicle joins; `app` is the merge into display entries.
  const timer = createServerTimer();

  try {
    if (isSingleJobRequest) {
      const entry = await timer.db("tracking-entry", () =>
        fetchTrackingEntryForJob({
          jobId: jobId ?? null,
          jobNumber: jobNumber || "",
          vehicleReg: vehicleReg || "",
        })
      );
      timer.applyTo(res);
      if (!entry.success) {
        return res
          .status(500)
          .json({ success: false, message: entry.error?.message || "Failed to load tracking" });
      }
      return res.status(200).json({ success: true, data: entry.data });
    }

    const result = await timer.db("tracking-snapshot", () => fetchTrackingSnapshot());
    timer.applyTo(res);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to load tracking" });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Tracking snapshot API error", error);
    timer.applyTo(res);
    return res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}

export default withRoleGuard(handler);
