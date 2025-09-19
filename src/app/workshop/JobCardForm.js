"use client";
import { useState } from "react";

export default function JobCardForm({ onSubmit }) {
  const [form, setForm] = useState({
    jobId: "",
    customer: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    registration: "",
    assignedTechnician: "",
    status: "Pending",
    notes: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    alert("Job Card created! Placeholder for backend.");
    setForm({
      jobId: "",
      customer: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      registration: "",
      assignedTechnician: "",
      status: "Pending",
      notes: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Create Job Card</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Job ID</label>
        <input
          type="text"
          name="jobId"
          value={form.jobId}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Customer Name</label>
        <input
          type="text"
          name="customer"
          value={form.customer}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
          required
        />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm font-medium">Vehicle Make</label>
          <input
            type="text"
            name="vehicleMake"
            value={form.vehicleMake}
            onChange={handleChange}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Model</label>
          <input
            type="text"
            name="vehicleModel"
            value={form.vehicleModel}
            onChange={handleChange}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Year</label>
          <input
            type="number"
            name="vehicleYear"
            value={form.vehicleYear}
            onChange={handleChange}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Registration</label>
        <input
          type="text"
          name="registration"
          value={form.registration}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Assigned Technician</label>
        <input
          type="text"
          name="assignedTechnician"
          value={form.assignedTechnician}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Status</label>
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        >
          <option>Pending</option>
          <option>In Progress</option>
          <option>Completed</option>
          <option>Waiting Parts</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Create Job Card
      </button>
    </form>
  );
}