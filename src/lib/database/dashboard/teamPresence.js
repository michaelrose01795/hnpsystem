// file location: src/lib/database/dashboard/teamPresence.js
//
// Live "who's actively working right now" signal for the collaborative top-bar
// workspace (Phase 4.1 presence / 4.3 activity). Like topbarSummary.js this is
// deliberately lean: the top bar polls it for every logged-in user, so it runs a
// single cheap query and returns only the raw live facts. All the department
// scoping, grouping and availability derivation happens client-side in the pure
// registries (buildTeamPresence) against the already-loaded roster — the server
// only supplies the one thing the client cannot know for free: which staff are
// currently clocked into a job.
//
// "Working" = an open row in `job_clocking` (clock_out IS NULL). This is the same
// truthful signal topbarSummary already uses for `techniciansOnJobs`; here we
// return the actual user ids (+ the job they're on) rather than just a count.
// Columns verified against src/lib/database/schema/schemaReference.sql
// (job_clocking: user_id, job_number, clock_out, work_type).

import { supabase } from "@/lib/database/supabaseClient";

// Returns the set of staff currently on a job, newest clock-in wins per user:
//   [{ userId, jobNumber, workType }]
// Never throws — on any error it returns [] so the presence surface degrades to
// roster-only "available" (exactly like the metrics fall back to static copy).
export async function getWorkingStaff() {
  try {
    const { data, error } = await supabase
      .from("job_clocking")
      .select("user_id, job_number, work_type, clock_in")
      .is("clock_out", null)
      .order("clock_in", { ascending: false });

    if (error) throw error;
    if (!Array.isArray(data)) return [];

    // One entry per user (their most recent open clock-in — the query is already
    // newest-first, so the first occurrence wins).
    const seen = new Set();
    const out = [];
    for (const row of data) {
      const userId = row?.user_id;
      if (userId == null || seen.has(userId)) continue;
      seen.add(userId);
      out.push({
        userId,
        jobNumber: row.job_number != null ? String(row.job_number) : null,
        workType: row.work_type || null,
      });
    }
    return out;
  } catch (err) {
    console.error("teamPresence getWorkingStaff failed:", err?.message || err);
    return [];
  }
}

export default getWorkingStaff;
