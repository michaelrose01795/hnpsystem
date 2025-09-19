"use client";
import { useState } from "react";
import ValetForm from "@/components/Valet/ValetForm";

export default function ValetPage() {
  const [jobs, setJobs] = useState([]);

  const handleCreateJob = (job) => {
    setJobs((prev) => [...prev, { ...job, id: Date.now() }]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Valet / Wash Service</h1>
      <ValetForm onSubmit={handleCreateJob} />

      <h2 className="text-xl font-semibold mt-6 mb-2">Existing Jobs</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Job ID</th>
            <th className="border px-2 py-1">Customer</th>
            <th className="border px-2 py-1">Vehicle</th>
            <th className="border px-2 py-1">Staff</th>
            <th className="border px-2 py-1">Service Type</th>
            <th className="border px-2 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="border px-2 py-1">{j.jobId}</td>
              <td className="border px-2 py-1">{j.customer}</td>
              <td className="border px-2 py-1">{j.vehicle}</td>
              <td className="border px-2 py-1">{j.staffAssigned}</td>
              <td className="border px-2 py-1">{j.serviceType}</td>
              <td className="border px-2 py-1">{j.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}