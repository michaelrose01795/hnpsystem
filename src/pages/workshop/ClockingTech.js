// file location: src/pages/workshop/ClockingTech.js
// Technician Clocking page (clock themselves in/out)

import React from "react";
import useClocking from "../../hooks/useClocking";
import { useUser } from "../../context/UserContext";

export default function ClockingTech() {
  const { user } = useUser();
  const { clockingData, clockIn, clockOut, isClockedIn } = useClocking();

  const mechanic = user?.username || "Unknown";

  const handleToggle = () => {
    if (isClockedIn(mechanic)) {
      clockOut(mechanic);
    } else {
      clockIn(mechanic);
    }
  };

  const myEntries = clockingData.filter((e) => e.mechanic === mechanic);

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ color: "#FF4040" }}>My Clocking</h1>

      <button
        onClick={handleToggle}
        style={{
          padding: "12px 20px",
          fontSize: "1rem",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          backgroundColor: isClockedIn(mechanic) ? "#FF8080" : "#FF4040",
          color: "white",
          marginBottom: "20px",
        }}
      >
        {isClockedIn(mechanic) ? "Clock OUT" : "Clock IN"}
      </button>

      <h2>Today’s Entries</h2>
      <ul>
        {myEntries.map((entry, i) => (
          <li key={i}>
            Clock IN: {new Date(entry.in).toLocaleTimeString()}{" "}
            {entry.out && <>| Clock OUT: {new Date(entry.out).toLocaleTimeString()}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
