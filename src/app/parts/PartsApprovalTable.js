"use client";
import { useState } from "react";

export default function PartsApprovalTable() {
  // Placeholder requests list
  const [requests, setRequests] = useState([
    {
      id: 1,
      jobId: "JOB123",
      partName: "Brake Pad",
      partNumber: "BP-456",
      quantity: 2,
      notes: "Front axle",
      status: "Pending",
    },
    {
      id: 2,
      jobId: "JOB124",
      partName: "Oil Filter",
      partNumber: "OF-789",
      quantity: 1,
      notes: "Service replacement",
      status: "Pending",
    },
  ]);

  const handleAction = (id, action) => {
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: action } : req
      )
    );
    alert(`Request ${action}`);
    // TODO: Connect to backend to persist approval/denial
    // TODO: Send notification to technician
  };

  return (
    <div className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Parts Requests Approval</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Job ID</th>
            <th className="border px-2 py-1">Part Name</th>
            <th className="border px-2 py-1">Part Number</th>
            <th className="border px-2 py-1">Qty</th>
            <th className="border px-2 py-1">Notes</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td className="border px-2 py-1">{req.jobId}</td>
              <td className="border px-2 py-1">{req.partName}</td>
              <td className="border px-2 py-1">{req.partNumber}</td>
              <td className="border px-2 py-1">{req.quantity}</td>
              <td className="border px-2 py-1">{req.notes}</td>
              <td className="border px-2 py-1">{req.status}</td>
              <td className="border px-2 py-1 space-x-2">
                <button
                  onClick={() => handleAction(req.id, "Approved")}
                  className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(req.id, "Denied")}
                  className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                >
                  Deny
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}