// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Clocking/ClockingList.js
import React, { useEffect } from "react";
import { useClockingContext } from "@/context/ClockingContext";
import { Card } from "@/components/ui";

export default function ClockingList() {
  const { allUsersClocking = [], fetchAllUsersClocking, loading } = useClockingContext(); // default to empty array

  // Fetch all users clocking data when component mounts
  useEffect(() => {
    fetchAllUsersClocking();
  }, [fetchAllUsersClocking]);

  if (loading) return <p>Loading users clocking info...</p>;

  return (
    <Card title="All Users Clocking" style={{ width: "100%", maxWidth: "48rem" }}>
      <table className="app-data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Hours Worked</th>
          </tr>
        </thead>
        <tbody>
          {allUsersClocking.length > 0 ? (
            allUsersClocking.map((u) => (
              <tr key={u.user}>
                <td>{u.user}</td>
                <td>{u.clockedIn ? "In" : "Out"}</td>
                <td>{u.hoursWorked.toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} style={{ textAlign: "center" }}>
                No clocking data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
