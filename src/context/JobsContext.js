// src/context/JobsContext.js
"use client";

import React, { createContext, useState, useContext } from "react";

const JobsContext = createContext();

export const useJobs = () => useContext(JobsContext);

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([]); // start with empty array

  const addJob = (job) => {
    setJobs((prev) => [...prev, job]);
  };

  const updateJob = (updatedJob) => {
    setJobs((prev) =>
      prev.map((job) => (job.jobNumber === updatedJob.jobNumber ? updatedJob : job))
    );
  };

  return (
    <JobsContext.Provider value={{ jobs, setJobs, addJob, updateJob }}>
      {children}
    </JobsContext.Provider>
  );
}
