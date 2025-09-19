"use client";
import { useState } from "react";
import CarBuyingForm from "@/components/CarBuying/CarBuyingForm";

export default function CarBuyingPage() {
  const [purchases, setPurchases] = useState([]);
  const suppliers = ["AutoTrader Ltd", "Local Dealer", "Private Seller"]; // Example suppliers

  const handleAddPurchase = (purchase) => {
    setPurchases(prev => [...prev, { ...purchase, id: Date.now() }]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Car Buying Module</h1>
      <CarBuyingForm suppliers={suppliers} onSubmit={handleAddPurchase} />

      <h2 className="text-xl font-semibold mt-6 mb-2">Purchase Records</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Purchase ID</th>
            <th className="border px-2 py-1">Make</th>
            <th className="border px-2 py-1">Model</th>
            <th className="border px-2 py-1">Year</th>
            <th className="border px-2 py-1">Price (£)</th>
            <th className="border px-2 py-1">Supplier</th>
            <th className="border px-2 py-1">Stock Status</th>
          </tr>
        </thead>
        <tbody>
          {purchases.length === 0 ? (
            <tr>
              <td className="border px-2 py-1 text-center" colSpan={7}>No car purchases recorded yet.</td>
            </tr>
          ) : (
            purchases.map(p => (
              <tr key={p.id}>
                <td className="border px-2 py-1">{p.purchaseId}</td>
                <td className="border px-2 py-1">{p.vehicleMake}</td>
                <td className="border px-2 py-1">{p.vehicleModel}</td>
                <td className="border px-2 py-1">{p.year}</td>
                <td className="border px-2 py-1">{p.purchasePrice}</td>
                <td className="border px-2 py-1">{p.supplier}</td>
                <td className="border px-2 py-1">{p.stockStatus}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}