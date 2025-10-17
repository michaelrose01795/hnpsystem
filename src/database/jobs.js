// src/database/jobs.js
import { supabase } from "../lib/supabaseClient";

// Get all jobs
export async function getAllJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

// Get jobs for a specific date (for “Booked” section)
export async function getJobsByDate(date) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("date", date)
    .order("time", { ascending: true });

  if (error) throw error;
  return data;
}