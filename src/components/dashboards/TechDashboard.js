// file location: src/components/dashboards/TechDashboard.js
import React from "react";
import NewsFeed from "../../pages/newsfeed";
import { useJobs } from "../../context/JobsContext";

export default function TechDashboard() {
  const { jobs } = useJobs();
  const myJobs = jobs.filter((j) => j.technician === "Your Tech Name"); // Replace with dynamic user later

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "16px", color: "#FF4040" }}>
        Technician Dashboard
      </h1>
      <p>Here you can see your jobs, clocking, and updates.</p>

      <section style={{ marginTop: "24px" }}>
        <h2 style={{ fontWeight: "600", marginBottom: "12px" }}>My Jobs</h2>
        {myJobs.length === 0 ? (
          <p>No jobs assigned today.</p>
        ) : (
          <ul>
            {myJobs.map((job) => (
              <li key={job.jobNumber}>
                {job.jobNumber} - {job.reg} ({job.status})
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewsFeed />
    </div>
  );
}