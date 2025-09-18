// src/pages/workshop/JobCard.js
// ==============================
// This is the Job Card page for the Workshop module.
// TODO previously: "Link to real job system, integrate parts + VHC"
// For now: placeholder job card with mock data and form inputs.

import React, { useState } from "react";

export default function JobCard() {
  // Placeholder job data (later will be fetched from backend)
  const [job, setJob] = useState({
    jobId: "J123",
    reg: "AB12 CDE",
    make: "Mitsubishi",
    model: "Outlander",
    mileage: "42,000",
    technician: "John Smith",
    status: "In Progress",
    notes: "Customer reports knocking sound when turning left.",
  });

  const handleChange = (e) => {
    setJob({
      ...job,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    console.log("Saving job:", job);
    alert("Job saved (placeholder only)");
  };

  const handleComplete = () => {
    console.log("Completing job:", job.jobId);
    alert("Job marked as completed (placeholder only)");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Job Card #{job.jobId}</h1>

      <div className="bg-white rounded shadow-md p-6 space-y-4">
        {/* Vehicle details */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Vehicle Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium">Registration</label>
              <input
                name="reg"
                value={job.reg}
                onChange={handleChange}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block font-medium">Mileage</label>
              <input
                name="mileage"
                value={job.mileage}
                onChange={handleChange}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block font-medium">Make</label>
              <input
                name="make"
                value={job.make}
                onChange={handleChange}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block font-medium">Model</label>
              <input
                name="model"
                value={job.model}
                onChange={handleChange}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          </div>
        </div>

        {/* Technician + status */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Workshop Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium">Technician</label>
              <input
                name="technician"
                value={job.technician}
                onChange={handleChange}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block font-medium">Status</label>
              <select
                name="status"
                value={job.status}
                onChange={handleChange}
                className="w-full border rounded px-2 py-1"
              >
                <option>In Progress</option>
                <option>Awaiting Parts</option>
                <option>Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Notes</h2>
          <textarea
            name="notes"
            value={job.notes}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={handleComplete}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Complete Job
          </button>
        </div>
      </div>
    </div>
  );
}