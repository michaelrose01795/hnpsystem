// src/context/JobsContext.js
"use client";

import React, { createContext, useState, useContext } from "react";

// Create the Jobs context
const JobsContext = createContext();

// Hook for using jobs context
export const useJobs = () => useContext(JobsContext);

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([]); // All job cards stored here

  // Default fields for a new job
  const defaultJobFields = {
    jobNumber: "",
    customer: "Unknown",
    reg: "",
    vehicle: "",
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
    address: ""
  };

  // Add a new job OR update if it already exists
  const addJob = (job) => {
    setJobs((prev) => {
      const existingIndex = prev.findIndex(
        (j) => j.jobNumber === job.jobNumber
      );

      const jobWithDefaults = { ...defaultJobFields, ...job };

      if (existingIndex !== -1) {
        // Update existing job if jobNumber matches
        const updatedJobs = [...prev];
        updatedJobs[existingIndex] = { ...prev[existingIndex], ...jobWithDefaults };
        return updatedJobs;
      } else {
        // Add new job
        return [...prev, jobWithDefaults];
      }
    });
  };

  // Explicit update for an existing job
  const updateJob = (updatedJob) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.jobNumber === updatedJob.jobNumber
          ? { ...job, ...updatedJob }
          : job
      )
    );
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
        setJobs,
        addJob,
        updateJob,
        getJobByNumber,
        getJobsByCar,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}
