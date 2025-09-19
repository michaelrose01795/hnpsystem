"use client";
import { useState } from "react";

export default function SalesForm({ onSubmit, salespeople }) {
  const [form, setForm] = useState({
    saleId: "",
    vehicleId: "",
    customer: "",
    price: "",
    salesperson: salespeople[0] || "",
    status: "Pending",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    alert("Sale recorded! Placeholder for backend.");
    setForm({ saleId: "", vehicleId: "", customer: "", price: "", salesperson: salespeople[0] || "", status: "Pending" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-4">Sales Entry</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Sale ID</label>
        <input name="saleId" value={form.saleId} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Vehicle ID</label>
        <input name="vehicleId" value={form.vehicleId} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Customer Name</label>
        <input name="customer" value={form.customer} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Price (£)</label>
        <input type="number" name="price" value={form.price} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Salesperson</label>
        <select name="salesperson" value={form.salesperson} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          {salespeople.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={form.status} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Pending</option>
          <option>Completed</option>
        </select>
      </div>

      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Record Sale</button>
    </form>
  );
}

"use client";
import { useState } from "react";

export default function SalesForm({ salespeople, onSubmit }) {
  const [form, setForm] = useState({
    saleId: "",
    vehicleId: "",
    customer: "",
    price: "",
    salesperson: salespeople[0] || "",
    status: "Pending"
  });

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    if(onSubmit) onSubmit(form);
    alert("Sale recorded! Placeholder for backend.");
    setForm({ saleId: "", vehicleId: "", customer: "", price: "", salesperson: salespeople[0] || "", status: "Pending" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-4">Sales Entry</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Sale ID</label>
        <input name="saleId" value={form.saleId} onChange={handleChange} className="w-full border px-2 py-1 rounded" required/>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Vehicle ID</label>
        <input name="vehicleId" value={form.vehicleId} onChange={handleChange} className="w-full border px-2 py-1 rounded"/>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Customer Name</label>
        <input name="customer" value={form.customer} onChange={handleChange} className="w-full border px-2 py-1 rounded"/>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Price (£)</label>
        <input type="number" name="price" value={form.price} onChange={handleChange} className="w-full border px-2 py-1 rounded"/>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Salesperson</label>
        <select name="salesperson" value={form.salesperson} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          {salespeople.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={form.status} onChange={handleChange} className="w-full border px-2 py-1 rounded">
          <option>Pending</option>
          <option>Completed</option>
        </select>
      </div>

      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Record Sale</button>
    </form>
  );
}