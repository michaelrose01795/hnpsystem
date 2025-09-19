"use client";
import { useState } from "react";

export default function CarStockTable() {
  const [cars, setCars] = useState([
    {
      id: 1,
      type: "New",
      make: "Renault",
      model: "Clio 1.3L",
      year: 2023,
      price: 17000,
      location: "Showroom",
      status: "Available",
    },
    {
      id: 2,
      type: "Used",
      make: "Suzuki",
      model: "Swift 1.2L",
      year: 2021,
      price: 12000,
      location: "Lot B",
      status: "Available",
    },
    {
      id: 3,
      type: "Used",
      make: "Mitsubishi",
      model: "ASX 1.6L",
      year: 2020,
      price: 14500,
      location: "Lot A",
      status: "Reserved",
    },
  ]);

  return (
    <div className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Car Stock Overview</h2>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Type</th>
            <th className="border px-2 py-1">Make</th>
            <th className="border px-2 py-1">Model</th>
            <th className="border px-2 py-1">Year</th>
            <th className="border px-2 py-1">Price (£)</th>
            <th className="border px-2 py-1">Location</th>
            <th className="border px-2 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.id}>
              <td className="border px-2 py-1">{car.type}</td>
              <td className="border px-2 py-1">{car.make}</td>
              <td className="border px-2 py-1">{car.model}</td>
              <td className="border px-2 py-1">{car.year}</td>
              <td className="border px-2 py-1">{car.price.toLocaleString()}</td>
              <td className="border px-2 py-1">{car.location}</td>
              <td className="border px-2 py-1">{car.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}