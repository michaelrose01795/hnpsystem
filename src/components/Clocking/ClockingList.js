// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Clocking/ClockingList.js
import React, { useEffect } from "react";
import { useClockingContext } from "@/context/ClockingContext";
import { Card } from "@/components/ui";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

export default function ClockingList() {
  const { allUsersClocking = [], fetchAllUsersClocking, loading } = useClockingContext(); // default to empty array

  // Fetch all users clocking data when component mounts
  useEffect(() => {
    fetchAllUsersClocking();
  }, [fetchAllUsersClocking]);

  if (loading) {
    // Structured table skeleton: preserves card header + column layout so users
    // see the final shape immediately instead of a plain text loader.
    return (
      <Card title="All Users Clocking" style={{ width: "100%", maxWidth: "48rem" }}>
        <SkeletonKeyframes />
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 0.8fr 0.8fr",
                gap: "12px",
                padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--skeleton-border, rgba(0,0,0,0.06))",
              }}
            >
              <SkeletonBlock width="70%" height="12px" />
              <SkeletonBlock width="50%" height="12px" />
              <SkeletonBlock width="40%" height="12px" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

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
