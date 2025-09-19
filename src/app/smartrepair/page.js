"use client";
import { useState } from "react";
import RepairForm from "@/components/SmartRepair/RepairForm";

export default function SmartRepairPage() {
  const [jobs, setJobs] = useState([]);
  const contractors = ["Wheel Repair Co", "DentMan Ltd", "PaintWorks", "GlassFix"];

  const handleCreateJob = (job) => {
    setJobs((prev) => [...prev, { ...job, id: Date.now() }]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Smart Repair / Contractors</h1>
      <RepairForm contractors={contractors} onSubmit={handleCreateJob} />

      <h2 className="text-xl font-semibold mt-6 mb-2">Existing Jobs</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Job ID</th>
            <th className="border px-2 py-1">Customer</th>
            <th className="border px-2 py-1">Vehicle</th>
            <th className="border px-2 py-1">Contractor</th>
            <th className="border px-2 py-1">Repair Type</th>
            <th className="border px-2 py-1">Cost (£)</th>
            <th className="border px-2 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="border px-2 py-1">{j.jobId}</td>
              <td className="border px-2 py-1">{j.customer}</td>
              <td className="border px-2 py-1">{j.vehicle}</td>
              <td className="border px-2 py-1">{j.contractor}</td>
              <td className="border px-2 py-1">{j.repairType}</td>
              <td className="border px-2 py-1">{j.cost}</td>
              <td className="border px-2 py-1">{j.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}