"use client";
import { useState } from "react";
import CarBuyingForm from "@/components/CarBuying/CarBuyingForm";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useUser } from "@/context/UserContext";
import { useNotifications } from "@/context/NotificationsContext";

export default function CarBuyingPage() {
  const { roles } = useUser();
  const { addNotification } = useNotifications();

  const suppliers = ["Supplier A", "Supplier B", "Supplier C"]; // Example suppliers
  const [cars, setCars] = useState([]);

  const handleAddCar = (car) => {
    setCars(prev => [...prev, { ...car, id: Date.now() }]);
    addNotification(`New car purchase recorded: ${car.vehicleMake} ${car.vehicleModel}`, "success");
  };

  return (
    <ProtectedRoute allowedRoles={[roles.ADMIN, roles.SALES, roles.WORKSHOP]}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Car Buying Module</h1>

        {/* Car purchase form */}
        <CarBuyingForm suppliers={suppliers} onSubmit={handleAddCar} />

        {/* Purchases table */}
        <h2 className="text-xl font-semibold mt-6 mb-2">Recorded Purchases</h2>
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1">ID</th>
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
            {cars.length === 0 ? (
              <tr>
                <td className="border px-2 py-1 text-center" colSpan={8}>No purchases recorded yet.</td>
              </tr>
            ) : (
              cars.map(car => (
                <tr key={car.id}>
                  <td className="border px-2 py-1">{car.id}</td>
                  <td className="border px-2 py-1">{car.purchaseId}</td>
                  <td className="border px-2 py-1">{car.vehicleMake}</td>
                  <td className="border px-2 py-1">{car.vehicleModel}</td>
                  <td className="border px-2 py-1">{car.year}</td>
                  <td className="border px-2 py-1">{car.purchasePrice}</td>
                  <td className="border px-2 py-1">{car.supplier}</td>
                  <td className="border px-2 py-1">{car.stockStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ProtectedRoute>
  );
}