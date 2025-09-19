"use client";
import { useState } from "react";
import JobCardForm from "@/components/Workshop/JobCardForm";

export default function JobCardsPage() {
  const [jobCards, setJobCards] = useState([
    { id: 1, jobId: "JOB001", customer: "John Smith", vehicle: "Renault Clio", status: "Pending" },
  ]);

  const handleCreateJobCard = (data) => {
    const newCard = { ...data, id: Date.now(), vehicle: `${data.vehicleMake} ${data.vehicleModel}` };
    setJobCards((prev) => [...prev, newCard]);
    // TODO: Save to backend
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Workshop Job Cards</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <JobCardForm onSubmit={handleCreateJobCard} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Existing Job Cards</h2>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-2 py-1">Job ID</th>
                <th className="border px-2 py-1">Customer</th>
                <th className="border px-2 py-1">Vehicle</th>
                <th className="border px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobCards.map((jc) => (
                <tr key={jc.id}>
                  <td className="border px-2 py-1">{jc.jobId}</td>
                  <td className="border px-2 py-1">{jc.customer}</td>
                  <td className="border px-2 py-1">{jc.vehicle}</td>
                  <td className="border px-2 py-1">{jc.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}