import Link from "next/link";

export default function SalesDashboard() {
  const salesFeatures = [
    { name: "Car Sales Tracking", path: "/sales/tracking" },
    { name: "Customer Database", path: "/sales/customers" },
    { name: "Video Creation", path: "/sales/videos" },
    { name: "Car Stock Overview", path: "/sales/stock" },
    { name: "Sales Reports", path: "/sales/reports" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sales Department Dashboard</h1>
      <p className="mb-6">
        Manage sales performance, customers, and stock from here:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {salesFeatures.map((feature, index) => (
          <Link key={index} href={feature.path}>
            <div className="p-6 bg-gray-100 rounded-lg shadow hover:bg-gray-200 cursor-pointer transition">
              <h2 className="text-xl font-semibold">{feature.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import VehicleForm from "@/components/VehicleProcessing/VehicleForm";

export default function VehicleProcessingPage() {
  const [vehicles, setVehicles] = useState([]);

  const handleAddVehicle = (vehicle) => {
    setVehicles(prev => [...prev, { ...vehicle, id: Date.now() }]);
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
          {vehicles.map(v => (
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

"use client";
import { useState } from "react";
import SalesForm from "@/components/Sales/SalesForm";

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const salespeople = ["Alice", "Bob", "Charlie", "David"]; // Example sales staff

  // Function to add a new sale
  const handleAddSale = (sale) => {
    setSales(prev => [...prev, { ...sale, id: Date.now() }]); // Adds a unique ID
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sales Module</h1>

      {/* Sales entry form */}
      <SalesForm salespeople={salespeople} onSubmit={handleAddSale} />

      {/* Sales records table */}
      <h2 className="text-xl font-semibold mt-6 mb-2">Sales Records</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Sale ID</th>
            <th className="border px-2 py-1">Vehicle ID</th>
            <th className="border px-2 py-1">Customer</th>
            <th className="border px-2 py-1">Price (£)</th>
            <th className="border px-2 py-1">Salesperson</th>
            <th className="border px-2 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {sales.length === 0 ? (
            <tr>
              <td className="border px-2 py-1 text-center" colSpan={6}>No sales recorded yet.</td>
            </tr>
          ) : (
            sales.map((s) => (
              <tr key={s.id}>
                <td className="border px-2 py-1">{s.saleId}</td>
                <td className="border px-2 py-1">{s.vehicleId}</td>
                <td className="border px-2 py-1">{s.customer}</td>
                <td className="border px-2 py-1">{s.price}</td>
                <td className="border px-2 py-1">{s.salesperson}</td>
                <td className="border px-2 py-1">{s.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}