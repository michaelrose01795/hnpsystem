// file location: src/context/JobsContext.js
"use client";

import React, { createContext, useState, useContext, useEffect } from "react";
import { supabase } from "../lib/supabaseClient"; // your Supabase client

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
    address: ""
  };

  // Fetch all jobs from database
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error("Error fetching jobs:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Add a new job OR update if it already exists in DB
  const addJob = async (job) => {
    const jobWithDefaults = { ...defaultJobFields, ...job };

    // Check if job already exists locally
    const existingIndex = jobs.findIndex((j) => j.jobNumber === jobWithDefaults.jobNumber);

    try {
      if (existingIndex !== -1) {
        // Update existing job in DB
        const { error } = await supabase
          .from("jobs")
          .update(jobWithDefaults)
          .eq("jobNumber", jobWithDefaults.jobNumber);
        if (error) throw error;

        // Update local state
        const updatedJobs = [...jobs];
        updatedJobs[existingIndex] = { ...updatedJobs[existingIndex], ...jobWithDefaults };
        setJobs(updatedJobs);
      } else {
        // Insert new job in DB
        const { data, error } = await supabase.from("jobs").insert([jobWithDefaults]).select();
        if (error) throw error;

        // Add to local state
        setJobs((prev) => [...prev, data[0]]);
      }
    } catch (err) {
      console.error("Error adding/updating job:", err.message);
    }
  };

  // Explicit update for an existing job
  const updateJob = async (updatedJob) => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update(updatedJob)
        .eq("jobNumber", updatedJob.jobNumber);
      if (error) throw error;

      setJobs((prev) =>
        prev.map((job) =>
          job.jobNumber === updatedJob.jobNumber ? { ...job, ...updatedJob } : job
        )
      );
    } catch (err) {
      console.error("Error updating job:", err.message);
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
        fetchJobs
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}