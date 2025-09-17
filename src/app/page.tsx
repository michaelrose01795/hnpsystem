// src/app/page.tsx
"use client";

import { useState } from "react";

interface Job {
  id: number;
  reg: string;
  status: string;
  clockedIn: boolean;
}

export default function HomePage() {
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

  return (
    <div style={{ padding: "30px" }}>
      <h1 style={{ color: "#c00" }}>H&amp;P Dashboard</h1>
      <p>Manage vehicles and technician clocking here.</p>

      <div style={{ marginTop: "20px" }}>
        {jobs.map((job) => (
          <div
            key={job.id}
            style={{
              backgroundColor: "#f2f2f2",
              padding: "15px",
              marginBottom: "10px",
              borderRadius: "8px",
            }}
          >
            <h2 style={{ margin: "0 0 10px" }}>{job.reg}</h2>
            <p>
              Status: <strong>{job.status}</strong>
            </p>
            <button
              onClick={() => toggleClock(job.id)}
              style={{
                backgroundColor: job.clockedIn ? "gray" : "#c00",
                color: "white",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                border: "none",
                marginTop: "10px",
              }}
            >
              {job.clockedIn ? "Clock Out" : "Clock In"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
