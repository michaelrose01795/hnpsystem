// src/app/dashboard/Dashboard.js
// =================================
// This is the main dashboard page for the DMS system.
// TODO previously: "Populate with live stats + role-based widgets"
// For now: placeholder cards with mock data.

import React from "react";

export default function Dashboard() {
  // Placeholder mock stats
  const stats = [
    { label: "Active Jobs", value: 12 },
    { label: "Cars in Progress", value: 8 },
    { label: "Parts Requests", value: 5 },
    { label: "Sales This Month", value: 14 },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Page header */}
      <h1 className="text-3xl font-bold mb-6">H&P DMS Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded shadow-md p-6 text-center hover:shadow-lg transition"
          >
            <p className="text-gray-500">{item.label}</p>
            <h2 className="text-2xl font-bold mt-2">{item.value}</h2>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="bg-white rounded shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Recent Jobs</h2>
          <ul className="space-y-2 text-gray-700">
            <li>Job #123 - Service Check - In Progress</li>
            <li>Job #124 - MOT - Awaiting Parts</li>
            <li>Job #125 - Valet - Completed</li>
          </ul>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Notifications</h2>
          <ul className="space-y-2 text-gray-700">
            <li>🔧 Technician clocked onto Job #123</li>
            <li>📦 Parts approved for Job #124</li>
            <li>🚗 New car added to stock: Suzuki Swift</li>
          </ul>
        </div>
      </div>
    </div>
  );
}