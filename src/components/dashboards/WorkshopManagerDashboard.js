// file location: src/components/dashboards/WorkshopManagerDashboard.js
import React, { useEffect, useState } from "react";
import { getJobsByDate } from "../../lib/database/jobs";
import { useClockingContext } from "../../context/ClockingContext";
import dayjs from "dayjs";

export default function WorkshopManagerDashboard() {
  const [pendingJobs, setPendingJobs] = useState([]);
  const { allUsersClocking, fetchAllUsersClocking, loading } = useClockingContext();
  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    const fetchJobs = async () => {
      const jobsToday = await getJobsByDate(today);
      setPendingJobs(jobsToday.filter((j) => j.job.status === "Booked"));
    };
    fetchJobs();
    fetchAllUsersClocking();
  }, [fetchAllUsersClocking, today]);

  if (loading) return <p>Loading dashboard...</p>;

  const techsClockedIn = allUsersClocking.filter((u) => u.roles?.includes("Techs") && u.clockedIn).length;
  const totalTechs = allUsersClocking.filter((u) => u.roles?.includes("Techs")).length;

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#FF4040", marginBottom: "16px" }}>
        Workshop Manager Dashboard
      </h1>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Pending Jobs</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>{pendingJobs.length} vehicles are waiting for inspection.</p>
        </div>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Clocking Overview</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>Technicians clocked in: {techsClockedIn} / {totalTechs}</p>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Important Notices</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>Remember to review workshop safety guidelines.</p>
        </div>
      </section>
    </div>
  );
}