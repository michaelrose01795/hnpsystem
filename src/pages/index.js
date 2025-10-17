// file location: src/pages/index.js
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAllJobs, getJobsByDate } from "../lib/database/jobs"; // DB functions

export default function HomePage() {
  const [totalJobs, setTotalJobs] = useState(0);
  const [newJobs, setNewJobs] = useState(0);
  const [inProgressJobs, setInProgressJobs] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState([]);

  // Get today's date in YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch all jobs
      const jobs = await getAllJobs();
      setTotalJobs(jobs.length);
      setNewJobs(jobs.filter(j => j.status === "New").length);
      setInProgressJobs(jobs.filter(j => j.status === "In Progress").length);

      // Fetch today's appointments
      const appointments = await getJobsByDate(today);
      setTodayAppointments(appointments);
    };

    fetchDashboardData();
  }, [today]);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Welcome to H&P DMS</h1>
      <p>This is your dashboard overview.</p>

      <div style={{ display: "flex", gap: "2rem", marginTop: "1rem" }}>
        <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h2>Total Jobs</h2>
          <p>{totalJobs}</p>
        </div>
        <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h2>New Jobs</h2>
          <p>{newJobs}</p>
        </div>
        <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h2>In Progress</h2>
          <p>{inProgressJobs}</p>
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2>Today's Appointments</h2>
        {todayAppointments.length > 0 ? (
          <ul>
            {todayAppointments.map((a) => (
              <li key={a.appointmentId}>
                {a.scheduledTime} - {a.job?.jobNumber} ({a.job?.reg} - {a.job?.make} {a.job?.model})
              </li>
            ))}
          </ul>
        ) : (
          <p>No appointments scheduled for today.</p>
        )}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <Link href="/login" legacyBehavior>
          <button style={{ padding: "0.5rem 1rem", background: "#d40000", color: "#fff", border: "none", borderRadius: "6px" }}>
            Go to Login
          </button>
        </Link>
      </div>
    </div>
  );
}