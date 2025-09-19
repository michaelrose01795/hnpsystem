"use client";
import { useState } from "react";

export default function MOTForm({ onSubmit }) {
  const [form, setForm] = useState({
    bookingId: "",
    customer: "",
    vehicle: "",
    date: "",
    result: "Pending",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    alert(`MOT booking created! Placeholder for backend.`);
    setForm({ bookingId: "", customer: "", vehicle: "", date: "", result: "Pending" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-4">MOT Booking</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Booking ID</label>
        <input name="bookingId" value={form.bookingId} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
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
        <label className="block text-sm font-medium">Date</label>
        <input type="date" name="date" value={form.date} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Result</label>
        <select name="result" value={form.result} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Pending</option>
          <option>Pass</option>
          <option>Fail</option>
        </select>
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Create Booking</button>
    </form>
  );
}