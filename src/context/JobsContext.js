// ✅ Imports converted to use absolute alias "@/"
// file location: src/context/JobsContext.js
"use client";

import React, { createContext, useState, useContext, useEffect } from "react";
import {
  fetchJobcards,
  createJobcard,
  updateJobcard,
} from "@/lib/api/jobcards"; // client API helpers

// Create the Jobs context
const JobsContext = createContext();

// Hook for using jobs context
export const useJobs = () => useContext(JobsContext);

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([]); // All job cards stored here
  const [loading, setLoading] = useState(true);

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

  // Fetch all jobs from database
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const payload = await fetchJobcards();
      const jobCards = Array.isArray(payload?.jobCards)
        ? payload.jobCards
        : [];
      setJobs(jobCards);
    } catch (err) {
      console.error("❌ Error fetching jobs:", err.message);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Add a new job
  const addJob = async (job) => {
    const jobWithDefaults = { ...defaultJobFields, ...job };

    try {
      const payload = await createJobcard(jobWithDefaults);
      const createdJob = payload?.jobCard || null;
      if (!createdJob) {
        throw new Error("Job card payload missing from response");
      }
      setJobs((prev) => [...prev, createdJob]);
    } catch (err) {
      console.error("❌ Error adding job:", err.message);
    }
  };

  // Update existing job
  const updateJob = async (updatedJob) => {
    try {
      const resolvedJobNumber =
        updatedJob?.jobNumber ||
        updatedJob?.job_number ||
        updatedJob?.jobNo ||
        null;
      if (!resolvedJobNumber) {
        throw new Error("Job number is required to update a job card");
      }

      const payload = await updateJobcard(resolvedJobNumber, {
        status: updatedJob.status,
      });
      const updated = payload?.jobCard || payload?.job || null;
      if (!updated) {
        throw new Error("Job card update response missing payload");
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.jobNumber === resolvedJobNumber ||
          job.job_number === resolvedJobNumber
            ? { ...job, ...updated }
            : job
        )
      );
    } catch (err) {
      console.error("❌ Error updating job:", err.message);
    }
  };

  // Get a single job by job number
  const getJobByNumber = (jobNumber) => {
    return jobs.find((job) => job.jobNumber === jobNumber) || null;
  };

  // Get all jobs linked to the same car (by reg or chassis)
  const getJobsByCar = (vehicle) => {
    if (!vehicle) return [];
    return jobs.filter(
      (job) =>
        job.vehicle?.reg === vehicle.reg ||
        job.vehicle?.chassis === vehicle.chassis
    );
  };

  return (
    <JobsContext.Provider
      value={{
        jobs,
        loading,
        setJobs,
        addJob,
        updateJob,
        getJobByNumber,
        getJobsByCar,
        fetchJobs,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}
