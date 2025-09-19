"use client";
import { useState } from "react";

export default function PartsSalesTable() {
  const [sales, setSales] = useState([
    {
      id: 1,
      partNumber: "BP-456",
      partName: "Brake Pad",
      quantity: 2,
      price: 35.0,
      soldBy: "John (Parts)",
      customer: "Workshop - JOB123",
      date: "2025-09-18",
    },
    {
      id: 2,
      partNumber: "OF-789",
      partName: "Oil Filter",
      quantity: 1,
      price: 15.0,
      soldBy: "Sarah (Parts)",
      customer: "Retail - Walk-in",
      date: "2025-09-17",
    },
  ]);

  // Calculate total revenue
  const totalRevenue = sales.reduce(
    (sum, s) => sum + s.price * s.quantity,
    0
  );

  return (
    <div className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Parts Sales Tracking</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Date</th>
            <th className="border px-2 py-1">Part Number</th>
            <th className="border px-2 py-1">Part Name</th>
            <th className="border px-2 py-1">Qty</th>
            <th className="border px-2 py-1">Price (£)</th>
            <th className="border px-2 py-1">Customer</th>
            <th className="border px-2 py-1">Sold By</th>
            <th className="border px-2 py-1">Total (£)</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td className="border px-2 py-1">{s.date}</td>
              <td className="border px-2 py-1">{s.partNumber}</td>
              <td className="border px-2 py-1">{s.partName}</td>
              <td className="border px-2 py-1">{s.quantity}</td>
              <td className="border px-2 py-1">{s.price.toFixed(2)}</td>
              <td className="border px-2 py-1">{s.customer}</td>
              <td className="border px-2 py-1">{s.soldBy}</td>
              <td className="border px-2 py-1">
                {(s.price * s.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-right font-bold text-lg">
        Total Revenue: £{totalRevenue.toFixed(2)}
      </div>
    </div>
  );
}