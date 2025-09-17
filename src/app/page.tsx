// src/app/page.tsx
"use client"; // indicates this file is a client-side React component

import { useState } from "react"; // import React hook for state management
import Layout from "../components/Layout"; // import a layout wrapper component (check path is correct)

interface Job { // define a TypeScript interface for Job objects
  id: number; // unique identifier for the job
  reg: string; // registration number of the vehicle
  status: string; // current status of the job (e.g., Workshop, MOT)
  clockedIn: boolean; // whether the technician is clocked in for this job
}

export default function DashboardPage() { // main functional component for the dashboard page
  const [jobs, setJobs] = useState<Job[]>([ // define state for jobs, initially an array of Job objects
    { id: 1, reg: "AB12 CDE", status: "Workshop", clockedIn: false }, // example job 1
    { id: 2, reg: "FG34 HIJ", status: "Valeting", clockedIn: true }, // example job 2
    { id: 3, reg: "KL56 MNO", status: "MOT", clockedIn: false }, // example job 3
  ]);

  const toggleClock = (id: number) => { // function to toggle clockedIn status of a job
    setJobs((prev) => // update jobs state
      prev.map((job) => // map over existing jobs
        job.id === id ? { ...job, clockedIn: !job.clockedIn } : job // toggle clockedIn if job matches id
      )
    );
  };

  const totalJobs = jobs.length; // calculate total number of jobs
  const activeClockedIn = jobs.filter((j) => j.clockedIn).length; // calculate number of active clocked-in jobs

  return (
    <Layout> {/* wrap page in Layout component */}
      <div style={{ padding: "30px" }}> {/* main container with padding */}
        {/* Header */}
        <header style={{ marginBottom: "30px" }}> {/* header section with bottom margin */}
          <h1 style={{ color: "#c00", margin: 0 }}></h1> {/* main title (empty now) */}
          <p></p> {/* subtitle or description (empty now) */}
        </header>

        {/* Stats cards */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}> {/* flex container for stats cards */}
          <div style={cardStyle}> {/* individual card for total jobs */}
            <h2>Total Jobs</h2> {/* card title */}
            <p style={statStyle}>{totalJobs}</p> {/* display total jobs */}
          </div>
          <div style={cardStyle}> {/* card for active clocked-in jobs */}
            <h2>Active Clocked In</h2>
            <p style={statStyle}>{activeClockedIn}</p>
          </div>
          <div style={cardStyle}> {/* card for jobs in Workshop */}
            <h2>Jobs in Workshop</h2>
            <p style={statStyle}>
              {jobs.filter((j) => j.status === "Workshop").length} {/* count jobs with status "Workshop" */}
            </p>
          </div>
        </div>

        {/* Job list */}
        <div> {/* container for job list */}
          {jobs.map((job) => ( // iterate over jobs array
            <div key={job.id} style={jobCardStyle}> {/* individual job card */}
              <div style={{ display: "flex", justifyContent: "space-between" }}> {/* flex for content and button */}
                <div> {/* left side: job details */}
                  <h3 style={{ margin: "0 0 5px" }}>{job.reg}</h3> {/* vehicle registration */}
                  <p style={{ margin: 0 }}>
                    Status: <strong>{job.status}</strong> {/* job status */}
                  </p>
                </div>
                <button
                  onClick={() => toggleClock(job.id)} // toggle clockedIn status on click
                  style={{ // inline button styling
                    backgroundColor: job.clockedIn ? "gray" : "#c00", // gray if clocked in, red if not
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: "none",
                    alignSelf: "center",
                  }}
                >
                  {job.clockedIn ? "Clock Out" : "Clock In"} {/* button text changes based on clockedIn */}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

// Styles
const cardStyle: React.CSSProperties = { // style object for stats cards
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "10px",
  flex: 1, // take equal width in flex container
  textAlign: "center",
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)", // subtle shadow
};

const statStyle: React.CSSProperties = { // style object for stats numbers
  fontSize: "24px",
  fontWeight: "bold",
  margin: "10px 0 0",
};

const jobCardStyle: React.CSSProperties = { // style object for job cards
  backgroundColor: "#f2f2f2",
  padding: "15px 20px",
  marginBottom: "10px",
  borderRadius: "10px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};
