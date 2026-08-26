// ✅ Imports converted to use absolute alias "@/"
// file location: src/context/JobsContext.js
"use client";

import React, { createContext, useContext, useMemo } from "react"; // React primitives
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext"; // access current user
import { useJobsList } from "@/hooks/useJobsList"; // SWR-powered jobs list with caching and auto-refresh
import { revalidateAllJobs } from "@/lib/swr/mutations"; // SWR cache invalidation helper

// Loaded on demand.
//
// JobsProvider sits in StaffProviders, so anything it imports statically lands in
// the first-load bundle of every route in the app. @/lib/database/jobs resolves
// @/lib/database/client, which re-exports the Supabase browser client — 213 kB of
// @supabase/supabase-js (postgrest + realtime + GoTrue). StaffLayout and
// useMessagesBadge were already deferred for exactly this reason; this edge was
// missed.
//
// Neither function is needed to render anything: both run only from inside the
// addJob / updateJob handlers below, i.e. after a user click. Deferring the
// import changes nothing observable — the request still starts on the same tick
// the handler runs.
const loadJobMutations = () => import("@/lib/database/jobs");

// Create the Jobs context
const JobsContext = createContext();

// Routes whose components actually READ `jobs` off this context.
//
// It is currently empty, and that is deliberate. The two routes previously
// listed here do not consume the list:
//   * /new-job destructures only `fetchJobs` (new-job/index.js:118) and never
//     touches `jobs` — it was paying for the whole list to trigger a revalidation.
//   * /tech/dashboard calls getAllJobs() itself (tech/dashboard.js:11) and does
//     not use this context at all.
// The one component that did read `jobs` (components/dashboards/TechDashboard.js)
// is not imported anywhere.
//
// fetchJobs() below still works with no local subscription: revalidateAllJobs()
// goes through SWR's global mutate on the shared "jobs:all" key, so a save on
// /new-job still refreshes /appointments and /jobs exactly as before.
//
// Add a pathname back here the moment a page needs `jobs` from this provider.
const JOBS_CONTEXT_ROUTES = new Set([]);

// Hook for using jobs context
export const useJobs = () => useContext(JobsContext);

// Default fields for a new job
const defaultJobFields = {
  jobNumber: "",
  customer: "Unknown",
  reg: "",
  vehicle: null,
  reason: "",
  appointment: null,
  status: "Booked",
  totalTime: 0,
  timeOnJob: 0,
  waiting: false,
  collection: false,
  loanCar: false,
  MOT: false,
  wash: false,
  address: "",
};

export function JobsProvider({ children }) {
  const router = useRouter();
  const { user } = useUser() || {}; // get current user
  const jobsContextEnabled = Boolean(user) && JOBS_CONTEXT_ROUTES.has(router.pathname);
  const { jobs, isLoading: loading, mutate: mutateJobs } = useJobsList({ enabled: jobsContextEnabled }); // fetch only where this context is consumed

  // Add a new job to the database and refresh the cache
  const addJob = async (job) => {
    const jobWithDefaults = { ...defaultJobFields, ...job }; // merge defaults with provided fields

    try {
      const { addJobToDatabase } = await loadJobMutations(); // deferred — click-time only
      const { success, data, error } = await addJobToDatabase(jobWithDefaults); // insert into database
      if (!success) throw error; // throw on failure
      // Optimistically add the new job to the SWR cache
      mutateJobs(
        (prev) => [...(prev || []), data], // append to cache
        { revalidate: true } // also refetch from server
      );
    } catch (err) {
      console.error("❌ Error adding job:", err.message); // log error
    }
  };

  // Update existing job status in the database and refresh the cache
  const updateJob = async (updatedJob) => {
    try {
      const { updateJobStatus } = await loadJobMutations(); // deferred — click-time only
      const { success, data, error } = await updateJobStatus(
        updatedJob.id, // job id
        updatedJob.status // new status
      );
      if (!success) throw error; // throw on failure
      // Optimistically update the job in the SWR cache
      mutateJobs(
        (prev) =>
          (prev || []).map((job) => (job.id === data.id ? { ...job, ...data } : job)), // replace matching job
        { revalidate: true } // also refetch from server
      );
    } catch (err) {
      console.error("❌ Error updating job:", err.message); // log error
    }
  };

  // Get a single job by job number from the cached list
  const getJobByNumber = (jobNumber) => {
    return jobs.find((job) => job.jobNumber === jobNumber) || null; // find in cache
  };

  // Get all jobs linked to the same car (by reg or chassis)
  const getJobsByCar = (vehicle) => {
    if (!vehicle) return []; // guard against empty vehicle
    return jobs.filter(
      (job) =>
        job.vehicle?.reg === vehicle.reg || // match by registration
        job.vehicle?.chassis === vehicle.chassis // or by chassis
    );
  };

  // Trigger SWR revalidation (replaces manual fetchJobs)
  const fetchJobs = () => {
    revalidateAllJobs(); // invalidate queryCache + revalidate SWR
    return mutateJobs(); // return the promise for callers that await it
  };

  const contextValue = useMemo(() => ({
    jobs, // all jobs array (from SWR cache)
    loading, // true during initial load
    setJobs: mutateJobs, // backwards-compatible alias for direct cache updates
    addJob, // add a new job
    updateJob, // update a job's status
    getJobByNumber, // find a job by number
    getJobsByCar, // find jobs by vehicle
    fetchJobs, // trigger refresh
  }), [jobs, loading, mutateJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <JobsContext.Provider value={contextValue}>
      {children}
    </JobsContext.Provider>
  );
}
