//src/app/vehicle-processing/page.js
"use client";
import { useState } from "react";
import VehicleForm from "@/components/VehicleProcessing/VehicleForm";

export default function VehicleProcessingPage() {
  const [vehicles, setVehicles] = useState([]);

  const handleAddVehicle = (vehicle) => {
    setVehicles((prev) => [...prev, { ...vehicle, id: Date.now() }]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vehicle Processing</h1>
      <VehicleForm onSubmit={handleAddVehicle} />

      <h2 className="text-xl font-semibold mt-6 mb-2">Existing Vehicles</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Vehicle ID</th>
            <th className="border px-2 py-1">Make</th>
            <th className="border px-2 py-1">Model</th>
            <th className="border px-2 py-1">Year</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Assigned To</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id}>
              <td className="border px-2 py-1">{v.vehicleId}</td>
              <td className="border px-2 py-1">{v.make}</td>
              <td className="border px-2 py-1">{v.model}</td>
              <td className="border px-2 py-1">{v.year}</td>
              <td className="border px-2 py-1">{v.status}</td>
              <td className="border px-2 py-1">{v.assignedTo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}