// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Clocking/ClockingCard.js
import React from "react";
import { useClocking } from "@/hooks/useClocking";

export default function ClockingCard() {
  const { clockedIn, hoursWorked, loading, clockIn, clockOut } = useClocking();

  if (loading) return <p>Loading clocking info...</p>;

  return (
    <div className="p-6 bg-white rounded w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Your Clocking Status</h2>
      <p className="mb-2">Status: {clockedIn ? "Clocked In" : "Clocked Out"}</p>
      <p className="mb-4">Hours Worked Today: {hoursWorked.toFixed(2)}</p>
      {clockedIn ? (
        <button
          onClick={clockOut}
          className="px-4 py-2 text-white rounded transition-colors"
          style={{ backgroundColor: "var(--danger)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--danger-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--danger)"; }}
        >
          Clock Out
        </button>
      ) : (
        <button
          onClick={clockIn}
          className="px-4 py-2 text-white rounded transition-colors"
          style={{ backgroundColor: "var(--success)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--success-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--success)"; }}
        >
          Clock In
        </button>
      )}
    </div>
  );
}
