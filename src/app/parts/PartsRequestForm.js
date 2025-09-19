"use client";
import { useState } from "react";

export default function PartsRequestForm({ onSubmit }) {
  const [form, setForm] = useState({
    jobId: "",
    partName: "",
    partNumber: "",
    quantity: 1,
    notes: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(form);
    }
    alert("Parts request submitted! Placeholder for backend integration.");
    setForm({ jobId: "", partName: "", partNumber: "", quantity: 1, notes: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Parts Request Form</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Job ID</label>
        <input
          type="text"
          name="jobId"
          value={form.jobId}
          onChange={handleChange}
          required
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Part Name</label>
        <input
          type="text"
          name="partName"
          value={form.partName}
          onChange={handleChange}
          required
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Part Number</label>
        <input
          type="text"
          name="partNumber"
          value={form.partNumber}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Quantity</label>
        <input
          type="number"
          name="quantity"
          value={form.quantity}
          onChange={handleChange}
          min="1"
          className="w-full border px-2 py-1 rounded"
        />
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
        Submit Request
      </button>
    </form>
  );
}