"use client";
import { useState } from "react";

export default function CarSalesTracking() {
  const [sales, setSales] = useState([
    { id: 1, car: "Renault Clio 1.3L", salesperson: "Alice", date: "2025-09-15", price: 15000 },
    { id: 2, car: "Suzuki Swift 1.2L", salesperson: "Bob", date: "2025-09-16", price: 13000 },
    { id: 3, car: "Mitsubishi ASX", salesperson: "Alice", date: "2025-09-17", price: 18000 },
  ]);

  // Calculate total sales per salesperson
  const totals = sales.reduce((acc, s) => {
    acc[s.salesperson] = (acc[s.salesperson] || 0) + s.price;
    return acc;
  }, {});

  const totalRevenue = sales.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Car Sales Tracking</h1>

      <table className="w-full border-collapse border mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Date</th>
            <th className="border px-2 py-1">Car</th>
            <th className="border px-2 py-1">Salesperson</th>
            <th className="border px-2 py-1">Price (£)</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td className="border px-2 py-1">{sale.date}</td>
              <td className="border px-2 py-1">{sale.car}</td>
              <td className="border px-2 py-1">{sale.salesperson}</td>
              <td className="border px-2 py-1">{sale.price.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Totals Per Salesperson</h2>
        <ul>
          {Object.entries(totals).map(([person, total]) => (
            <li key={person}>
              <strong>{person}:</strong> £{total.toLocaleString()}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-right font-bold text-lg">
        Total Revenue: £{totalRevenue.toLocaleString()}
      </div>
    </div>
  );
}