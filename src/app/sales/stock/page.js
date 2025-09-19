import CarStockTable from "@/components/Sales/CarStockTable";

export default function CarStockPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Car Stock Overview</h1>
      <CarStockTable />
    </div>
  );
}