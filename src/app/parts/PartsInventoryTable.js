"use client";
import { useState } from "react";

export default function PartsInventoryTable() {
  const [inventory, setInventory] = useState([
    {
      id: 1,
      partNumber: "BP-456",
      partName: "Brake Pad",
      quantity: 50,
      location: "Shelf A1",
      updatedBy: "John (Parts)",
    },
    {
      id: 2,
      partNumber: "OF-789",
      partName: "Oil Filter",
      quantity: 120,
      location: "Shelf B3",
      updatedBy: "Sarah (Manager)",
    },
  ]);

  const handleUpdateQuantity = (id, change) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: item.quantity + change, updatedBy: "Current User" }
          : item
      )
    );
    // TODO: Sync with backend (database update)
    // TODO: Log update history
  };

  return (
    <div className="p-4 border rounded bg-white shadow-md">
      <h2 className="text-xl font-semibold mb-4">Parts Inventory</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Part Number</th>
            <th className="border px-2 py-1">Part Name</th>
            <th className="border px-2 py-1">Quantity</th>
            <th className="border px-2 py-1">Location</th>
            <th className="border px-2 py-1">Last Updated By</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id}>
              <td className="border px-2 py-1">{item.partNumber}</td>
              <td className="border px-2 py-1">{item.partName}</td>
              <td className="border px-2 py-1">{item.quantity}</td>
              <td className="border px-2 py-1">{item.location}</td>
              <td className="border px-2 py-1">{item.updatedBy}</td>
              <td className="border px-2 py-1 space-x-2">
                <button
                  onClick={() => handleUpdateQuantity(item.id, 1)}
                  className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  +
                </button>
                <button
                  onClick={() => handleUpdateQuantity(item.id, -1)}
                  className="bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                >
                  -
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}