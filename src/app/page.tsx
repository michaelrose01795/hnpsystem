"use client";

import { useState } from "react";
import AuthWrapper from "./AuthWrapper";

interface Job {
  id: number;
  reg: string;
  status: string;
  clockedIn: boolean;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([
    { id: 1, reg: "AB12 CDE", status: "Workshop", clockedIn: false },
    { id: 2, reg: "FG34 HIJ", status: "Valeting", clockedIn: true },
    { id: 3, reg: "KL56 MNO", status: "MOT", clockedIn: false },
  ]);

  const toggleClock = (id: number) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === id ? { ...job, clockedIn: !job.clockedIn } : job
      )
    );
  };

  const totalJobs = jobs.length;
  const activeClockedIn = jobs.filter((j) => j.clockedIn).length;

  return (
    <AuthWrapper>
      <div style={{ padding: "30px", fontFamily: "sans-serif" }}>
        {/* Header */}
        <header style={{ marginBottom: "30px" }}>
          <h1 style={{ color: "#c00", margin: 0 }}>H&P System Dashboard</h1>
          <p>Manage vehicles and technician clocking efficiently</p>
        </header>

        {/* Stats cards */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
          <div style={cardStyle}>
            <h2>Total Jobs</h2>
            <p style={statStyle}>{totalJobs}</p>
          </div>
          <div style={cardStyle}>
            <h2>Active Clocked In</h2>
            <p style={statStyle}>{activeClockedIn}</p>
          </div>
          <div style={cardStyle}>
            <h2>Jobs in Workshop</h2>
            <p style={statStyle}>
              {jobs.filter((j) => j.status === "Workshop").length}
            </p>
          </div>
        </div>

        {/* Job list */}
        <div>
          {jobs.map((job) => (
            <div key={job.id} style={jobCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ margin: "0 0 5px" }}>{job.reg}</h3>
                  <p style={{ margin: 0 }}>
                    Status: <strong>{job.status}</strong>
                  </p>
                </div>
                <button
                  onClick={() => toggleClock(job.id)}
                  style={{
                    backgroundColor: job.clockedIn ? "gray" : "#c00",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: "none",
                    alignSelf: "center",
                  }}
                >
                  {job.clockedIn ? "Clock Out" : "Clock In"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AuthWrapper>
  );
}

// Styles
const cardStyle: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "10px",
  flex: 1,
  textAlign: "center",
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};

const statStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  margin: "10px 0 0",
};

const jobCardStyle: React.CSSProperties = {
  backgroundColor: "#f2f2f2",
  padding: "15px 20px",
  marginBottom: "10px",
  borderRadius: "10px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};
