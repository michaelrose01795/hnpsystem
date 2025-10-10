// src/pages/job-cards/appointments.js
"use client";

import React, { useState } from "react";
import Layout from "../../components/Layout";
import { useJobs } from "../../context/JobsContext"; // Assuming you have a JobsContext

export default function AppointmentsPage() {
  const { jobs, updateJob } = useJobs(); // get jobs and updater
  const [jobNumber, setJobNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleAddAppointment = () => {
    const job = jobs.find(j => j.jobNumber === jobNumber);
    if (!job) return alert("Job not found");

    updateJob(jobNumber, { ...job, appointment: { date, time }, status: "Booked" });
    alert(`Appointment set for ${jobNumber} on ${date} at ${time}`);

    // reset fields
    setJobNumber("");
    setDate("");
    setTime("");
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
          style={{ width: "100%", padding: "8px", marginBottom: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <label>Time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <button
          onClick={handleAddAppointment}
          style={{ width: "100%", padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold" }}
        >
          Add Appointment
        </button>
      </div>
    </Layout>
  );
}
