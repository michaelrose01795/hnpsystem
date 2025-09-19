"use client";
import { useState } from "react";
import CustomerForm from "@/components/Sales/CustomerForm";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([
    { id: 1, name: "John Smith", phone: "0123456789", email: "john@example.com", notes: "Interested in Suzuki Swift" },
    { id: 2, name: "Alice Johnson", phone: "0987654321", email: "alice@example.com", notes: "Requested finance info" },
  ]);

  const handleSaveCustomer = (data) => {
    const newCustomer = { ...data, id: Date.now() };
    setCustomers((prev) => [...prev, newCustomer]);
    // TODO: Save to backend database
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Customer Database</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <CustomerForm onSubmit={handleSaveCustomer} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Customer List</h2>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">Phone</th>
                <th className="border px-2 py-1">Email</th>
                <th className="border px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="border px-2 py-1">{c.name}</td>
                  <td className="border px-2 py-1">{c.phone}</td>
                  <td className="border px-2 py-1">{c.email}</td>
                  <td className="border px-2 py-1">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}