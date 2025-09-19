//src/components/CarBuying/CarBuyingForm.js
"use client";
import { useState } from "react";

export default function CarBuyingForm({ suppliers, onSubmit }) {
  const [form, setForm] = useState({
    purchaseId: "",
    vehicleMake: "",
    vehicleModel: "",
    year: "",
    purchasePrice: "",
    supplier: suppliers[0] || "",
    stockStatus: "Pending"
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    alert("Car purchase recorded! Placeholder for backend.");
    setForm({
      purchaseId: "",
      vehicleMake: "",
      vehicleModel: "",
      year: "",
      purchasePrice: "",
      supplier: suppliers[0] || "",
      stockStatus: "Pending"
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-4">Car Buying Entry</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Purchase ID</label>
        <input name="purchaseId" value={form.purchaseId} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Vehicle Make</label>
        <input name="vehicleMake" value={form.vehicleMake} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Vehicle Model</label>
        <input name="vehicleModel" value={form.vehicleModel} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Year</label>
        <input type="number" name="year" value={form.year} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Purchase Price (£)</label>
        <input type="number" name="purchasePrice" value={form.purchasePrice} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Supplier</label>
        <select name="supplier" value={form.supplier} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          {suppliers.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Stock Status</label>
        <select name="stockStatus" value={form.stockStatus} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Pending</option>
          <option>In Stock</option>
          <option>Sold</option>
        </select>
      </div>

      <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Record Purchase</button>
    </form>
  );
}