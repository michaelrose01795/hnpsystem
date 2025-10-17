// src/pages/job-cards/appointments.js
"use client";

import React, { useState } from "react";
import Layout from "../../components/Layout";
import { supabase } from "../../lib/supabaseClient";

export default function AppointmentsPage() {
  const [jobNumber, setJobNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddAppointment = async () => {
    if (!jobNumber || !date || !time) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      // Check if job exists
      const { data: job, error: findError } = await supabase
        .from("jobs")
        .select("*")
        .eq("job_number", jobNumber)
        .single();

      if (findError || !job) {
        alert("Job not found");
        setLoading(false);
        return;
      }

      // Update job with appointment data
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          appointment_date: date,
          appointment_time: time,
          status: "Booked",
        })
        .eq("job_number", jobNumber);

      if (updateError) throw updateError;

      alert(`Appointment set for Job ${jobNumber} on ${date} at ${time}`);

      // reset fields
      setJobNumber("");
      setDate("");
      setTime("");
    } catch (error) {
      console.error("Error updating appointment:", error.message);
      alert("Failed to add appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "16px" }}>Add Appointment</h1>

        <label>Job Number</label>
        <input
          type="text"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Enter existing job number"
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />

        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />

        <label>Time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />

        <button
          onClick={handleAddAppointment}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? "#aaa" : "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : "Add Appointment"}
        </button>
      </div>
    </Layout>
  );
}