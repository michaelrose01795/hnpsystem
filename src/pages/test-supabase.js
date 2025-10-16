// file location: src/pages/test-supabase.js
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // ✅ fixed path

export default function TestSupabase() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      const { data, error } = await supabase.from("jobs").select("*");
      if (error) {
        console.error("Supabase error:", error);
      } else {
        setJobs(data);
      }
      setLoading(false);
    }
    fetchJobs();
  }, []);

  if (loading) return <p>Loading jobs...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Supabase Jobs Test</h1>
      {jobs.length === 0 && <p>No jobs found</p>}
      {jobs.map((job) => (
        <div
          key={job.id}
          style={{
            border: "1px solid #ccc",
            margin: "10px 0",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          <p><strong>Job Number:</strong> {job.job_number}</p>
          <p><strong>Customer:</strong> {job.customer_name}</p>
          <p><strong>Vehicle:</strong> {job.vehicle}</p>
          <p><strong>Date:</strong> {job.date}</p>
          <p><strong>Status:</strong> {job.status}</p>
        </div>
      ))}
    </div>
  );
}
