"use client";
import { useState } from "react";

export default function VehicleForm({ onSubmit }) {
  const [form, setForm] = useState({
    vehicleId: "",
    make: "",
    model: "",
    year: "",
    status: "Received",
    assignedTo: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    alert("Vehicle processed! Placeholder for backend.");
    setForm({ vehicleId: "", make: "", model: "", year: "", status: "Received", assignedTo: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-4">Vehicle Processing</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Vehicle ID</label>
        <input name="vehicleId" value={form.vehicleId} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Make</label>
        <input name="make" value={form.make} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Model</label>
        <input name="model" value={form.model} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Year</label>
        <input type="number" name="year" value={form.year} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={form.status} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Received</option>
          <option>In Workshop</option>
          <option>Valet / Wash</option>
          <option>MOT</option>
          <option>Ready for Sale</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Assigned To</label>
        <input name="assignedTo" value={form.assignedTo} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add Vehicle</button>
    </form>
  );
}