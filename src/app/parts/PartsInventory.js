"use client";
import { useState } from "react";

export default function PartsInventory({ userRole }) {
  const [inventory, setInventory] = useState([
    { id: 1, partNumber: "BRK123", name: "Brake Pads", quantity: 20, location: "Shelf A" },
    { id: 2, partNumber: "OIL456", name: "Engine Oil 5L", quantity: 50, location: "Shelf B" },
    { id: 3, partNumber: "TYR789", name: "Front Tyre 205/55R16", quantity: 15, location: "Shelf C" },
  ]);

  const [requests, setRequests] = useState([
    { id: 1, jobId: "JOB001", part: "Brake Pads", requestedBy: "Alice", status: "Pending" },
  ]);

  const handleRequest = (partName) => {
    if (userRole !== "Technician") return alert("Only technicians can request parts.");
    const newRequest = { id: Date.now(), jobId: "JOB_PLACEHOLDER", part: partName, requestedBy: "TechUser", status: "Pending" };
    setRequests((prev) => [...prev, newRequest]);
    alert(`Requested ${partName}. Placeholder for backend.`);
  };

  const handleApprove = (id) => {
    if (userRole !== "Parts") return alert("Only parts staff can approve requests.");
    setRequests((prev) => prev.map(r => r.id === id ? {...r, status: "Approved"} : r));
    alert("Request approved! Placeholder for backend.");
  };

  const handleDeny = (id) => {
    if (userRole !== "Parts") return alert("Only parts staff can deny requests.");
    setRequests((prev) => prev.map(r => r.id === id ? {...r, status: "Denied"} : r));
    alert("Request denied! Placeholder for backend.");
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Parts Inventory</h2>

      <table className="w-full border-collapse border mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Part Number</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Quantity</th>
            <th className="border px-2 py-1">Location</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((part) => (
            <tr key={part.id}>
              <td className="border px-2 py-1">{part.partNumber}</td>
              <td className="border px-2 py-1">{part.name}</td>
              <td className="border px-2 py-1">{part.quantity}</td>
              <td className="border px-2 py-1">{part.location}</td>
              <td className="border px-2 py-1">
                {userRole === "Technician" && (
                  <button
                    onClick={() => handleRequest(part.name)}
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Request
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xl font-semibold mb-2">Part Requests</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Job ID</th>
            <th className="border px-2 py-1">Part</th>
            <th className="border px-2 py-1">Requested By</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="border px-2 py-1">{r.jobId}</td>
              <td className="border px-2 py-1">{r.part}</td>
              <td className="border px-2 py-1">{r.requestedBy}</td>
              <td className="border px-2 py-1">{r.status}</td>
              <td className="border px-2 py-1">
                {userRole === "Parts" && r.status === "Pending" && (
                  <>
                    <button
                      onClick={() => handleApprove(r.id)}
                      className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 mr-1"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(r.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
                      Deny
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}