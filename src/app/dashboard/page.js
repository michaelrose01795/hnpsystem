"use client";
import { useState } from "react";
import StatCard from "@/components/Dashboard/StatCard";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  // Example state data
  const [vehicles, setVehicles] = useState([
    { id: 1, status: "Received" },
    { id: 2, status: "In Workshop" },
    { id: 3, status: "Ready for Sale" }
  ]);
  const [sales, setSales] = useState([
    { id: 1, status: "Completed" },
    { id: 2, status: "Pending" }
  ]);
  const [purchases, setPurchases] = useState([
    { id: 1, stockStatus: "In Stock" },
    { id: 2, stockStatus: "Pending" }
  ]);

  // Counts
  const vehicleCount = vehicles.length;
  const salesCount = sales.length;
  const purchaseCount = purchases.length;

  // Quick navigation
  const goTo = (path) => router.push(path);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">DMS Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Vehicles Processed" count={vehicleCount} color="bg-blue-500"/>
        <StatCard title="Sales Completed" count={salesCount} color="bg-green-500"/>
        <StatCard title="Car Purchases" count={purchaseCount} color="bg-purple-500"/>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="text-2xl font-semibold mb-2">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => goTo("/vehicle-processing")} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Process Vehicle</button>
          <button onClick={() => goTo("/sales")} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Record Sale</button>
          <button onClick={() => goTo("/car-buying")} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Add Purchase</button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mt-6">
        <h2 className="text-2xl font-semibold mb-2">Progress Overview</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Vehicles in Workshop: {vehicles.filter(v => v.status === "In Workshop").length}</li>
          <li>Vehicles Ready for Sale: {vehicles.filter(v => v.status === "Ready for Sale").length}</li>
          <li>Sales Pending: {sales.filter(s => s.status === "Pending").length}</li>
          <li>Purchases Pending: {purchases.filter(p => p.stockStatus === "Pending").length}</li>
        </ul>
      </div>
    </div>
  );
}