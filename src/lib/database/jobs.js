// file location: src/lib/database/jobs.js
import { supabase } from "../supabaseClient";

/**
 * Fetch all jobs from the Supabase "jobs" table
 * and map them into the correct frontend format.
 */
export const getAllJobs = async () => {
  const { data, error } = await supabase.from("jobs").select("*");

  if (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }

  // Normalize job data for consistent use in UI
  return data.map((job) => ({
    jobNumber: job.job_number || "",
    customer: job.customer_name || "",
    reg: job.vehicle_reg || "",
    description: job.description || "",
    status: job.status || "",
    appointment: job.appointment_date
      ? { date: job.appointment_date, time: job.appointment_time || "" }
      : null,
  }));
};

/**
 * Fetch a specific job by its job number.
 * Example: const job = await getJobByNumber("J1234");
 */
export const getJobByNumber = async (jobNumber) => {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("job_number", jobNumber)
    .single();

  if (error) {
    console.error("Error fetching job by number:", error);
    return null;
  }

  return {
    jobNumber: data.job_number,
    customer: data.customer_name,
    reg: data.vehicle_reg,
    description: data.description,
    status: data.status,
    appointment: data.appointment_date
      ? { date: data.appointment_date, time: data.appointment_time || "" }
      : null,
  };
};