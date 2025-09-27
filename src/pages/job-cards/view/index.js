// file location: src/pages/job-cards/view/index.js
"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../../components/Layout";
import { useRouter } from "next/router";

// Dummy data for initial display
const initialJobs = [
  { jobNumber: "JN001", customer: "John Smith", status: "Checked In" },
  { jobNumber: "JN002", customer: "Jane Doe", status: "Checked In" },
  { jobNumber: "JN003", customer: "Mike Johnson", status: "Checked In" },
];

export default function ViewJobCards() {
  const [jobs, setJobs] = useState([]);
  const router = useRouter();

  useEffect(() => {
    // For now, all jobs start in Checked In
    setJobs(initialJobs);
  }, []);

  // Function to navigate to job card detail page
  const goToJobCard = (jobNumber) => {
    router.push(`/job-cards/${jobNumber}`);
  };

  // Function to filter jobs by status
  const getJobsByStatus = (status) => {
    return jobs.filter((job) => job.status === status);
  };

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">View Job Cards</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Sections */}
          {["Booked", "Checked In", "Workshop/MOT", "Waiting for Parts", "Being Washed", "Complete"].map(
            (section) => (
              <div
                key={section}
                className="bg-white shadow-md rounded-md p-4 flex flex-col"
              >
                <h2 className="font-semibold text-lg mb-4">{section}</h2>
                <div className="flex flex-col gap-2">
                  {getJobsByStatus(section).length > 0 ? (
                    getJobsByStatus(section).map((job) => (
                      <button
                        key={job.jobNumber}
                        onClick={() => goToJobCard(job.jobNumber)}
                        className="text-left p-2 border rounded hover:bg-gray-100"
                      >
                        {job.jobNumber} - {job.customer}
                      </button>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">No jobs</p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </Layout>
  );
}
