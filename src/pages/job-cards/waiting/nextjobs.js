// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../../components/Layout";
import { useUser } from "../../../context/UserContext"; // to get logged-in username
import { usersByRole } from "../../../config/users"; // role-to-users mapping

// Dynamically generate techsList from usersByRole
const techsList = (usersByRole["Techs"] || []).map((name, index) => ({
  id: index + 1,
  name,
}));

const initialJobs = [
  {
    jobNumber: "JN001",
    customer: "John Smith",
    car: "Ford Fiesta",
    description: "Brake replacement",
    status: "Waiting",
    assignedTech: null,
  },
  {
    jobNumber: "JN002",
    customer: "Jane Doe",
    car: "VW Golf",
    description: "Oil change",
    status: "Loan Car",
    assignedTech: null,
  },
];

export default function NextJobsPage() {
  const { user } = useUser(); // get logged-in user
  const [jobs, setJobs] = useState(initialJobs); // all jobs
  const [selectedJob, setSelectedJob] = useState(null); // job popup
  const [techPopup, setTechPopup] = useState(false); // show tech selection

  // Determine if current user is allowed
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole["Workshop Manager"] || []),
    ...(usersByRole["Service Manager"] || []),
  ];

  if (!allowedUsers.includes(username)) {
    return (
      <Layout>
        <p className="p-4 text-red-600 font-bold">
          You do not have access to Next Jobs.
        </p>
      </Layout>
    );
  }

  // Assign tech to a job
  const assignTechToJob = (tech) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.jobNumber === selectedJob.jobNumber
          ? { ...job, assignedTech: tech }
          : job
      )
    );
    setTechPopup(false);
    setSelectedJob(null);
  };

  // Filter jobs by assignment
  const unassignedJobs = jobs.filter((job) => !job.assignedTech);
  const assignedJobs = techsList.map((tech) => ({
    ...tech,
    jobs: jobs.filter((job) => job.assignedTech?.id === tech.id),
  }));

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Next Jobs</h1>

        {/* Unassigned Jobs at top */}
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Unassigned Jobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedJobs.map((job) => (
              <div
                key={job.jobNumber}
                className="border p-4 rounded shadow hover:cursor-pointer hover:bg-gray-100"
                onClick={() => setSelectedJob(job)}
              >
                <p>
                  <strong>Job:</strong> {job.jobNumber}
                </p>
                <p>
                  <strong>Customer:</strong> {job.customer || "N/A"}
                </p>
                <p>
                  <strong>Car:</strong> {job.car || "N/A"}
                </p>
                <p>
                  <strong>Description:</strong> {job.description || "N/A"}
                </p>
                <p>
                  <strong>Status:</strong> {job.status || "N/A"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Techs Grid */}
        <div>
          <h2 className="font-semibold mb-2">Technicians</h2>
          <div className="grid grid-cols-3 gap-4">
            {assignedJobs.map((tech) => (
              <div
                key={tech.id}
                className="border rounded p-2 flex flex-col items-center"
              >
                <p className="font-semibold mb-2">{tech.name}</p>
                <div className="space-y-2 w-full">
                  {tech.jobs.length === 0 ? (
                    <p className="text-gray-400 text-sm">No jobs assigned</p>
                  ) : (
                    tech.jobs.map((job) => (
                      <div
                        key={job.jobNumber}
                        className="border p-2 rounded shadow hover:cursor-pointer hover:bg-gray-100"
                        onClick={() => setSelectedJob(job)}
                      >
                        <p>
                          <strong>Job:</strong> {job.jobNumber}
                        </p>
                        <p>
                          <strong>Customer:</strong> {job.customer || "N/A"}
                        </p>
                        <p>
                          <strong>Car:</strong> {job.car || "N/A"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Job Card Popup */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-96 relative">
              <h3 className="text-lg font-bold mb-2">
                Job Card: {selectedJob.jobNumber}
              </h3>
              <p>
                <strong>Customer:</strong> {selectedJob.customer || "N/A"}
              </p>
              <p>
                <strong>Car:</strong> {selectedJob.car || "N/A"}
              </p>
              <p>
                <strong>Description:</strong> {selectedJob.description || "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {selectedJob.status || "N/A"}
              </p>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="bg-gray-800 text-white px-3 py-1 rounded"
                  onClick={() => setTechPopup(true)}
                >
                  Assign Tech
                </button>
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded"
                  onClick={() => setSelectedJob(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tech Selection Popup */}
        {techPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-96 relative">
              <h3 className="text-lg font-bold mb-4">Select Technician</h3>
              <div className="grid grid-cols-1 gap-2">
                {techsList.map((tech) => (
                  <button
                    key={tech.id}
                    className="border p-2 rounded hover:bg-gray-100 text-left"
                    onClick={() => assignTechToJob(tech)}
                  >
                    {tech.name}
                  </button>
                ))}
              </div>
              <button
                className="bg-red-600 text-white px-3 py-1 rounded mt-4"
                onClick={() => setTechPopup(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
