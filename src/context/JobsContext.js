// ✅ Imports converted to use absolute alias "@/"
// file location: src/context/JobsContext.js
"use client";

import React, { createContext, useState, useContext, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import {
  getAllJobs,
  addJobToDatabase,
  updateJobStatus,
  getJobByNumberOrReg,
} from "@/lib/database/jobs"; // database helper functions

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
      const data = await getAllJobs();
      setJobs(data || []);
    } catch (err) {
      console.error("❌ Error fetching jobs:", err.message);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const { user } = useUser() || {};

  useEffect(() => {
    // Only fetch jobs when a logged-in user exists (prevents unauth'd requests on public pages)
    if (user) {
      fetchJobs();
    } else {
      setJobs([]);
      setLoading(false);
      console.debug("JobsProvider: skipped fetch (no user)");
    }
  }, [user]);

  // Add a new job
  const addJob = async (job) => {
    const jobWithDefaults = { ...defaultJobFields, ...job };

    try {
      const { success, data, error } = await addJobToDatabase(jobWithDefaults);
      if (!success) throw error;

      setJobs((prev) => [...prev, data]);
    } catch (err) {
      console.error("❌ Error adding job:", err.message);
    }
  };

  // Update existing job
  const updateJob = async (updatedJob) => {
    try {
      const { success, data, error } = await updateJobStatus(
        updatedJob.id,
        updatedJob.status
      );
      if (!success) throw error;

      setJobs((prev) =>
        prev.map((job) => (job.id === data.id ? { ...job, ...data } : job))
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