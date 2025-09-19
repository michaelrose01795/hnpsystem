"use client";
import { useState } from "react";
import MOTForm from "@/components/MOT/MOTForm";

export default function MOTPage() {
  const [bookings, setBookings] = useState([]);

  const handleCreateBooking = (booking) => {
    setBookings((prev) => [...prev, { ...booking, id: Date.now() }]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">MOT Management</h1>
      <MOTForm onSubmit={handleCreateBooking} />

      <h2 className="text-xl font-semibold mt-6 mb-2">Existing MOT Bookings</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Booking ID</th>
            <th className="border px-2 py-1">Customer</th>
            <th className="border px-2 py-1">Vehicle</th>
            <th className="border px-2 py-1">Date</th>
            <th className="border px-2 py-1">Result</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="border px-2 py-1">{b.bookingId}</td>
              <td className="border px-2 py-1">{b.customer}</td>
              <td className="border px-2 py-1">{b.vehicle}</td>
              <td className="border px-2 py-1">{b.date}</td>
              <td className="border px-2 py-1">{b.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}