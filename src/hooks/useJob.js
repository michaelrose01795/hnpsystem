// file location: src/hooks/useJob.js
// SWR-powered hook to fetch a single job card by job number.
// Replaces manual useEffect + useState + fetchJobData patterns.
// Returns cached data instantly on revisit, revalidates in background.

import useSWR from "swr"; // stale-while-revalidate data fetching
import { buildJobCardKey } from "@/lib/swr/keys";

// Fetcher that calls the job card API route and throws on non-OK responses
const fetcher = async (url) => {
  const res = await fetch(url); // call the Next.js API route
  if (!res.ok) {
    const body = await res.json().catch(() => ({})); // attempt to parse error body
    const err = new Error(body.message || "Failed to fetch job"); // create descriptive error
    err.status = res.status; // attach HTTP status for callers
    throw err; // SWR will catch and expose via the error return
  }
  return res.json(); // return parsed JSON response
};

// Re-exported so existing importers of this hook keep working; the definition
// lives in lib/swr/keys.js alongside the prefetch and revalidation helpers that
// must agree with it.
export { buildJobCardKey };

/**
 * @param {string} jobNumber
 * @param {{ archive?: boolean, revalidateOnMount?: boolean }} [options]
 *   revalidateOnMount — pass false when the CALLER owns the initial fetch and
 *   seeds this cache itself. The hook then still returns anything already in the
 *   SWR cache (a prefetch on hover, or a previous visit) for an instant paint,
 *   and `mutate` still works, but it does not issue a request of its own.
 *
 *   The job-card page needs this: it loads the card through fetchJobData() and
 *   writes the result back with mutate(..., { revalidate: false }). Because that
 *   uses a plain fetch() rather than going through SWR, SWR's dedupingInterval
 *   could not collapse the two, so a cold visit fired /api/jobcards/[jobNumber]
 *   TWICE about 100ms apart — and every request that depends on the loaded job
 *   (status snapshot, parts on order, invoices, messages) doubled with it.
 */
export function useJob(jobNumber, options = {}) {
  const { archive = false, revalidateOnMount } = options; // whether to fetch from archive
  const key = buildJobCardKey(jobNumber, { archive }); // null key = don't fetch (SWR convention)

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    ...(revalidateOnMount === undefined ? {} : { revalidateOnMount }),
    revalidateOnFocus: true, // refresh when user tabs back
    dedupingInterval: 5000, // don't re-fetch within 5 seconds of last fetch
    // Stale-while-revalidate. SWR's cache is keyed per job, so reopening a card
    // (or switching back to one) renders the previous response immediately and
    // refreshes underneath.
    //
    // Deliberately NOT `keepPreviousData`: that returns the LAST KEY's data
    // while a new key loads, which on this hook means rendering the previously
    // opened job's data under the new job's URL.
    revalidateIfStale: true,
  });

  return {
    jobResponse: data || null, // full API response object
    job: data?.job || data?.jobCard || null, // the job card data
    customer: data?.customer || null, // customer record
    vehicle: data?.vehicle || null, // vehicle record
    sharedNote: data?.sharedNote || null, // latest shared note
    notes: data?.notes || [], // full notes list (was a separate client query)
    vehicleJobHistory: data?.vehicleJobHistory || [], // customer job history
    error, // SWR error (null when successful)
    isLoading, // true during initial load with no cached data
    isValidating, // true during any revalidation (including background)
    mutate, // function to manually revalidate or update the cache
  };
}
