// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Clocking/ClockingCard.js
import React from "react";
import { useClocking } from "@/hooks/useClocking";
import { Button, Card } from "@/components/ui";

export default function ClockingCard() {
  const { clockedIn, hoursWorked, loading, clockIn, clockOut } = useClocking();

  if (loading) return <p>Loading clocking info...</p>;

  return (
    <Card
      title="Your Clocking Status"
      style={{ width: "100%", maxWidth: "32rem" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <p>Status: {clockedIn ? "Clocked In" : "Clocked Out"}</p>
        <p>Hours Worked Today: {hoursWorked.toFixed(2)}</p>
      </div>
      {clockedIn ? (
        <Button
          onClick={clockOut}
          variant="ghost"
          style={{
            background: "var(--danger)",
            borderColor: "var(--danger)",
            color: "var(--text-inverse)",
            alignSelf: "flex-start",
          }}
        >
          Clock Out
        </Button>
      ) : (
        <Button
          onClick={clockIn}
          style={{
            background: "var(--success)",
            borderColor: "var(--success)",
            color: "var(--text-inverse)",
            alignSelf: "flex-start",
          }}
        >
          Clock In
        </Button>
      )}
    </Card>
  );
}
