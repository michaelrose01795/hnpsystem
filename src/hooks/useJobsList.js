// file location: src/hooks/useJobsList.js
// SWR-powered hook to fetch the active jobs list.
//
// This used to call getAllJobs() directly from the browser: an unbounded
// PostgREST select over every job ever created with 14 nested relations. Against
// production that was a 1,010 kB response taking 1,865 ms on /new-job and
// 1,153 ms on /appointments — the single slowest request on both pages, and the
// main source of their blocking time, because a megabyte of JSON still has to be
// parsed and mapped through formatJobData on the main thread. With
// refreshInterval at 30 s it then repeated for as long as the tab stayed open.
//
// It now reads /api/jobs/workload, which runs the narrow, bounded
// getJobsWorkload() query next to the database and returns the SAME row shape
// (both go through formatJobData). Measured on /jobs: 75 kB / 683 ms.
//
// Two things are deliberately preserved:
//   * The SWR key stays "jobs:all" so revalidateAllJobs() / revalidateJob() in
//     lib/swr/mutations.js keep invalidating this list exactly as before.
//   * The return shape is unchanged, so every existing caller is untouched.
//
// Importing getAllJobs here was also what anchored @supabase/supabase-js (213 kB)
// in the first-load bundle of all 162 routes: _app → StaffProviders →
// JobsContext → useJobsList → lib/database/jobs → lib/database/client. Fetching
// over HTTP instead removes that edge from the graph.

import useSWR from "swr"; // stale-while-revalidate data fetching

// Jobs the list screens render. Matches JOBS_WORKLOAD_DEFAULT_LIMIT server-side;
// passing it explicitly keeps the cap visible at the call site.
export const JOBS_LIST_LIMIT = 400;

/**
 * Fetch the bounded workload list.
 *
 * Exported because the technician screens need the same request with a scope,
 * from inside their own effects, without adopting this hook's SWR lifecycle.
 * Keeping one fetcher means the endpoint, the limit and the error handling
 * cannot drift between callers.
 *
 * @param {{ fresh?: boolean, assignedTo?: number|null, limit?: number }} [options]
 *   assignedTo — restrict to one technician's jobs (jobs.assigned_to).
 *   limit      — row cap; defaults to the list limit. A scoped caller can raise
 *                it because it is counting a single technician's jobs, not the
 *                whole workshop's.
 */
export const fetchJobsWorkload = async ({
  fresh = false,
  assignedTo = null,
  limit = JOBS_LIST_LIMIT,
} = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (fresh) params.set("fresh", "1");
  if (assignedTo !== null && assignedTo !== undefined) {
    params.set("assignedTo", String(assignedTo));
  }

  const response = await fetch(`/api/jobs/workload?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Jobs list request failed (${response.status})`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload?.success) {
    throw new Error(payload?.message || "Jobs list request failed");
  }

  return Array.isArray(payload.data) ? payload.data : [];
};

export function useJobsList(options = {}) {
  const { enabled = true } = options; // allow callers to disable fetching

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    enabled ? "jobs:all" : null, // null key disables fetching
    () => fetchJobsWorkload(),
    {
      revalidateOnFocus: true, // refetch when the user tabs back
      dedupingInterval: 10000, // 10 second dedup for the shared list
      // 30 seconds, deliberately unchanged from the original.
      //
      // This was raised to 180s on the assumption that realtime carried changes
      // between the polls. It does not: Supabase Realtime is currently
      // delivering NO postgres_changes events to the browser client in this
      // project. Verified two ways — a job row was updated with the service key
      // while /jobs and /appointments were open and neither refetched within 30s,
      // and a bare anon-key channel subscribed successfully to jobs,
      // job_clocking, appointments, vhc_checks, job_files and floating_notes,
      // then received nothing at all for a live update.
      //
      // So the poll is the ONLY way one user sees another user's change, and
      // 180s meant a booking taking up to three minutes to appear on the
      // controller's screen. The bandwidth argument for a longer interval is
      // also gone: the payload is already ~10x smaller than it was
      // (1,010 kB -> 98 kB), so 30s now costs less than 180s used to.
      //
      // Raise this only once realtime is actually delivering — the
      // subscriptions are already wired and will start working on their own when
      // the tables are added to the supabase_realtime publication.
      refreshInterval: 30000,
      keepPreviousData: true, // no flash back to empty while revalidating
    }
  );

  return {
    jobs: data || [], // array of jobs, empty array as fallback
    error, // SWR error (null when successful)
    isLoading, // true during initial load with no cached data
    isValidating, // true during any revalidation
    mutate, // manually revalidate or optimistically update
  };
}
