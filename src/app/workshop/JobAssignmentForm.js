"use client";
import { useState } from "react";

export default function JobAssignmentForm({ jobs, technicians, onAssign }) {
  const [selectedJob, setSelectedJob] = useState(jobs[0]?.id || "");
  const [selectedTech, setSelectedTech] = useState(technicians[0] || "");

  const handleAssign = () => {
    if (onAssign) onAssign(selectedJob, selectedTech);
    alert(`Job ${selectedJob} assigned to ${selectedTech} (placeholder)`);
  };

  return (
    <div className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-2">Assign Job to Technician</h2>
      <div className="mb-2">
        <label className="block text-sm font-medium">Select Job</label>
        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          className="w-full border px-2 py-1 rounded"
        >
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.jobId} - {job.customer}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2">
        <label className="block text-sm font-medium">Select Technician</label>
        <select
          value={selectedTech}
          onChange={(e) => setSelectedTech(e.target.value)}
          className="w-full border px-2 py-1 rounded"
        >
          {technicians.map((tech) => (
            <option key={tech} value={tech}>
              {tech}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleAssign}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Assign Job
      </button>
    </div>
  );
}