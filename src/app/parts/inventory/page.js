import PartsInventoryTable from "@/components/Parts/PartsInventoryTable";

export default function PartsInventoryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Parts Inventory Management</h1>
      <PartsInventoryTable />
    </div>
  );
}

"use client";
import { useState } from "react";
import PartsInventory from "@/components/Parts/PartsInventory";

export default function PartsPage() {
  const [userRole] = useState("Technician"); // Change to "Parts" to see approve/deny buttons

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Parts Management</h1>
      <PartsInventory userRole={userRole} />
    </div>
  );
}