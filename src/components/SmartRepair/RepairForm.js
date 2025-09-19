"use client";
import { useState } from "react";

export default function RepairForm({ contractors, onSubmit }) {
  const [form, setForm] = useState({
    jobId: "",
    customer: "",
    vehicle: "",
    contractor: contractors[0] || "",
    repairType: "Dent",
    status: "Pending",
    cost: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    alert(`Smart repair job created! Placeholder for backend.`);
    setForm({ jobId: "", customer: "", vehicle: "", contractor: contractors[0] || "", repairType: "Dent", status: "Pending", cost: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-4">Smart Repair / Contractor Job</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Job ID</label>
        <input name="jobId" value={form.jobId} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Customer Name</label>
        <input name="customer" value={form.customer} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Vehicle</label>
        <input name="vehicle" value={form.vehicle} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Contractor</label>
        <select name="contractor" value={form.contractor} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          {contractors.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Repair Type</label>
        <select name="repairType" value={form.repairType} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Dent</option>
          <option>Wheel Repair</option>
          <option>Paintwork</option>
          <option>Glass</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Cost (£)</label>
        <input type="number" name="cost" value={form.cost} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={form.status} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Pending</option>
          <option>In Progress</option>
          <option>Completed</option>
        </select>
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Create Job</button>
    </form>
  );
}