// file location: src/hooks/useJob.js
// SWR-powered hook to fetch a single job card by job number.
// Replaces manual useEffect + useState + fetchJobData patterns.
// Returns cached data instantly on revisit, revalidates in background.

import useSWR from "swr"; // stale-while-revalidate data fetching

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

export function useJob(jobNumber, options = {}) {
  const { archive = false } = options; // whether to fetch from archive
  const params = new URLSearchParams(); // build query string
  if (archive) params.set("archive", "1"); // append archive flag if needed
  const query = params.toString(); // serialise query params
  const key = jobNumber
    ? `/api/jobcards/${encodeURIComponent(jobNumber)}${query ? `?${query}` : ""}` // SWR cache key matches the API URL
    : null; // null key = don't fetch (SWR convention)

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: true, // refresh when user tabs back
    dedupingInterval: 5000, // don't re-fetch within 5 seconds of last fetch
  });

  return {
    jobResponse: data || null, // full API response object
    job: data?.job || data?.jobCard || null, // the job card data
    customer: data?.customer || null, // customer record
    vehicle: data?.vehicle || null, // vehicle record
    sharedNote: data?.sharedNote || null, // latest shared note
    vehicleJobHistory: data?.vehicleJobHistory || [], // customer job history
    error, // SWR error (null when successful)
    isLoading, // true during initial load with no cached data
    isValidating, // true during any revalidation (including background)
    mutate, // function to manually revalidate or update the cache
  };
}
