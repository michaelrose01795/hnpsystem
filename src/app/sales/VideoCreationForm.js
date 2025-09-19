"use client";
import { useState } from "react";

export default function VideoCreationForm({ cars }) {
  const [form, setForm] = useState({
    carId: cars?.[0]?.id || "",
    title: "",
    description: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Video created for car ID ${form.carId} with title "${form.title}"`);
    setForm({ carId: cars?.[0]?.id || "", title: "", description: "" });
    // TODO: Integrate actual video generation backend
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Create Marketing Video</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Select Car</label>
        <select
          name="carId"
          value={form.carId}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        >
          {cars?.map((car) => (
            <option key={car.id} value={car.id}>
              {car.make} {car.model} ({car.year})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Video Title</label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Generate Video
      </button>
    </form>
  );
}