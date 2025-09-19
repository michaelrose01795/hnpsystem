import PartsInventoryTable from "@/components/Parts/PartsInventoryTable";

export default function PartsInventoryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Parts Inventory Management</h1>
      <PartsInventoryTable />
    </div>
  );
}