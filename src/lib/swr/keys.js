// file location: src/lib/swr/keys.js
//
// Canonical SWR cache keys.
//
// The job card is fetched by the page, warmed by hover-prefetch on the jobs
// list, and revalidated after mutations. Those three code paths each used to
// build the URL by hand, so any divergence (a query parameter, a different
// encoding) silently produced a SECOND cache entry: the prefetch warmed one key
// and the page read another, so the "instant open" never happened and the work
// was wasted. Defining the key once removes that class of bug.

/**
 * SWR key (and API URL) for a single job card.
 * @param {string|number|null} jobNumber
 * @param {{ archive?: boolean }} [options]
 * @returns {string|null} null when there is no job number (SWR's "don't fetch")
 */
export function buildJobCardKey(jobNumber, { archive = false } = {}) {
  if (!jobNumber) return null;
  const params = new URLSearchParams();
  if (archive) params.set("archive", "1");
  const query = params.toString();
  return `/api/jobcards/${encodeURIComponent(jobNumber)}${query ? `?${query}` : ""}`;
}

/** SWR key for the bounded workload list behind /jobs. */
export const JOBS_WORKLOAD_KEY = "/api/jobs/workload";

/** SWR key for the combined authenticated shell payload. */
export const SHELL_BOOTSTRAP_KEY = "/api/shell/bootstrap";
