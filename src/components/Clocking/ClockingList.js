// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Clocking/ClockingList.js
import React, { useEffect } from "react";
import { useClockingContext } from "@/context/ClockingContext";

export default function ClockingList() {
  const { allUsersClocking = [], fetchAllUsersClocking, loading } = useClockingContext(); // default to empty array

  // Fetch all users clocking data when component mounts
  useEffect(() => {
    fetchAllUsersClocking();
  }, [fetchAllUsersClocking]);

  if (loading) return <p>Loading users clocking info...</p>;

  return (
    <div className="p-6 bg-white shadow rounded w-full max-w-3xl">
      <h2 className="text-xl font-bold mb-4">All Users Clocking</h2>
      <table className="w-full table-auto border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-4 py-2">User</th>
            <th className="border px-4 py-2">Status</th>
            <th className="border px-4 py-2">Hours Worked</th>
          </tr>
        </thead>
        <tbody>
          {allUsersClocking.length > 0 ? (
            allUsersClocking.map((u) => (
              <tr key={u.user}>
                <td className="border px-4 py-2">{u.user}</td>
                <td className="border px-4 py-2">{u.clockedIn ? "In" : "Out"}</td>
                <td className="border px-4 py-2">{u.hoursWorked.toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="border px-4 py-2 text-center">
                No clocking data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}