"use client";
import { useState } from "react";

export default function SalesReports() {
  const [sales] = useState([
    { id: 1, car: "Renault Clio 1.3L", salesperson: "Alice", date: "2025-09-15", price: 15000 },
    { id: 2, car: "Suzuki Swift 1.2L", salesperson: "Bob", date: "2025-09-16", price: 13000 },
    { id: 3, car: "Mitsubishi ASX", salesperson: "Alice", date: "2025-09-17", price: 18000 },
  ]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.price, 0);
  const totalCars = sales.length;

  const totalsPerSalesperson = sales.reduce((acc, s) => {
    acc[s.salesperson] = (acc[s.salesperson] || 0) + s.price;
    return acc;
  }, {});

  return (
    <div className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Sales Reports</h2>

      <div className="mb-4">
        <p><strong>Total Cars Sold:</strong> {totalCars}</p>
        <p><strong>Total Revenue:</strong> £{totalRevenue.toLocaleString()}</p>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">Revenue Per Salesperson</h3>
        <ul>
          {Object.entries(totalsPerSalesperson).map(([person, total]) => (
            <li key={person}>
              <strong>{person}:</strong> £{total.toLocaleString()}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Sales Details</h3>
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1">Date</th>
              <th className="border px-2 py-1">Car</th>
              <th className="border px-2 py-1">Salesperson</th>
              <th className="border px-2 py-1">Price (£)</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="border px-2 py-1">{s.date}</td>
                <td className="border px-2 py-1">{s.car}</td>
                <td className="border px-2 py-1">{s.salesperson}</td>
                <td className="border px-2 py-1">{s.price.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}