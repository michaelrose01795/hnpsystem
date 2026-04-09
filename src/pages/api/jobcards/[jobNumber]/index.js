// file location: src/pages/api/jobcards/[jobNumber]/index.js
import { getJobByNumber } from "@/lib/database/jobs";
import { getNotesByJob } from "@/lib/database/notes";
import { getCustomerJobs } from "@/lib/database/customers";
import { mapCustomerJobsToHistory, normalizeRequests } from "@/lib/jobcards/utils";
import { supabaseService } from "@/lib/supabaseClient";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const buildArchiveCandidates = (input) => {
  const token = String(input || "").trim();
  if (!token) return [];
  const noHash = token.replace(/^#/, "");
  const upper = noHash.toUpperCase();
  const candidates = new Set([noHash, upper]);
  if (/^\d+$/.test(noHash)) {
    const parsed = Number.parseInt(noHash, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      candidates.add(String(parsed));
      candidates.add(String(parsed).padStart(5, "0"));
    }
  }
  return Array.from(candidates);
};

const loadArchivedJob = async (jobNumberIdentifier) => {
  if (!supabaseService) {
    return { error: { message: "Service role key not configured" } };
  }

  const candidates = buildArchiveCandidates(jobNumberIdentifier);
  if (candidates.length === 0) {
    return { error: { message: "Archived job not found" } };
  }

  const { data, error } = await supabaseService
    .from("job_archive")
    .select("snapshot")
    .in("job_number", candidates)
    .order("completed_at", { ascending: false })
    .limit(1);

  const first = Array.isArray(data) ? data[0] : null;
  if (error || !first?.snapshot) {
    return { error: { message: "Archived job not found" } };
  }

  const snapshot = first.snapshot || {};
  const jobCard = snapshot.jobCard || snapshot.job || null;
  return {
    data: {
      jobCard,
      customer: snapshot.customer || null,
      vehicle: snapshot.vehicle || null,
      sharedNote: snapshot.sharedNote || null,
      vehicleJobHistory: snapshot.vehicleJobHistory || [],
    },
    error: null,
  };
};

const HOT_CACHE_HEADER = "private, max-age=10, stale-while-revalidate=60";

const loadLiveJob = async (jobNumber, { force = false } = {}) => {
  if (!jobNumber) {
    return { data: null, error: { message: "Job number is required" } };
  }

  return getJobByNumber(jobNumber, { noCache: force });
};

async function handler(req, res, session) {
  const { jobNumber: rawJobNumber, archive, force } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  if (!rawJobNumber || typeof rawJobNumber !== "string") {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    const requestForce = String(force || "") === "1";
    const requestArchive = String(archive || "") === "1";
    const identity = await resolveJobIdentity({
      client: supabaseService,
      identifier: rawJobNumber,
      select: "id, job_number",
    });
    const rawJobNumberTrimmed = String(rawJobNumber).trim();
    const canonicalJobNumber = identity?.job_number || rawJobNumberTrimmed;
    const liveLookupCandidates = Array.from(
      new Set([canonicalJobNumber, rawJobNumberTrimmed, ...buildArchiveCandidates(rawJobNumberTrimmed)])
    ).filter(Boolean);

    if (requestArchive) {
      const { data, error } = await loadArchivedJob(canonicalJobNumber);
      if (error || !data?.jobCard) {
        return res
          .status(404)
          .json({ message: `Archived job card ${rawJobNumber} not found` });
      }

      res.setHeader("Cache-Control", requestForce ? "no-store, max-age=0, must-revalidate" : HOT_CACHE_HEADER);
      return res.status(200).json({
        job: data.jobCard,
        customer: data.customer || null,
        vehicle: data.vehicle || null,
        sharedNote: data.sharedNote || null,
        vehicleJobHistory: data.vehicleJobHistory || [],
      });
    }

    let liveResult = null;
    for (const candidate of liveLookupCandidates) {
      // Retry the underlying lookup across raw and padded variants before failing the request.
      const attempt = await loadLiveJob(candidate, { force: requestForce });
      if (attempt?.data?.jobCard) {
        liveResult = attempt;
        break;
      }
    }

    if (!liveResult?.data?.jobCard) {
      const archived = await loadArchivedJob(canonicalJobNumber);
      if (archived?.data?.jobCard) {
        res.setHeader("Cache-Control", requestForce ? "no-store, max-age=0, must-revalidate" : HOT_CACHE_HEADER);
        return res.status(200).json({
          job: archived.data.jobCard,
          customer: archived.data.customer || null,
          vehicle: archived.data.vehicle || null,
          sharedNote: archived.data.sharedNote || null,
          vehicleJobHistory: archived.data.vehicleJobHistory || [],
        });
      }
      return res
        .status(404)
        .json({ message: `Job card ${rawJobNumber} not found` });
    }

    const { data } = liveResult;
    const { jobCard, customer, vehicle } = data;
    // Fetch notes and customer history in parallel to reduce response time
    const [notes, customerJobs] = await Promise.all([
      jobCard.id ? getNotesByJob(jobCard.id) : [], // fetch job notes
      jobCard.customerId ? getCustomerJobs(jobCard.customerId) : [], // fetch customer job history
    ]);
    const sharedNote = notes[0] || null;
    const vehicleJobHistory = mapCustomerJobsToHistory(customerJobs, jobCard.reg);

    // Serve hot cache for fast reloads; callers can bypass with force=1.
    res.setHeader("Cache-Control", requestForce ? "no-store, max-age=0, must-revalidate" : HOT_CACHE_HEADER);

    return res.status(200).json({
      job: jobCard,
      customer,
      vehicle,
      sharedNote,
      vehicleJobHistory
    });
  } catch (error) {
    console.error("❌ Unexpected error fetching job card:", error);
    return res
      .status(500)
      .json({ message: "Unexpected error fetching job card" });
  }
}

export default withRoleGuard(handler);
