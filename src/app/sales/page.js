"use client";
import { useState } from "react";
import SalesForm from "@/components/Sales/SalesForm";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useUser } from "@/context/UserContext";

export default function SalesPage() {
  const { roles } = useUser();
  const [sales, setSales] = useState([]);
  const salespeople = ["Alice", "Bob", "Charlie", "David"];

  const handleAddSale = (sale) => setSales(prev => [...prev, { ...sale, id: Date.now() }]);

  return (
    <ProtectedRoute allowedRoles={[roles.ADMIN, roles.SALES]}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Sales Module</h1>
        <SalesForm salespeople={salespeople} onSubmit={handleAddSale} />

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
              sales.map(s => (
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
    </ProtectedRoute>
  );
}