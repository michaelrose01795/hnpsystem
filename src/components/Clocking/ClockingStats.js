// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Clocking/ClockingStats.js
import React from "react";
import { useUser } from "@/context/UserContext";

export default function ClockingStats() {
  const { user, status } = useUser();

  if (!user || !user.roles?.includes("TECHS")) return null;

  return (
    <div
      style={{
        padding: "10px 16px",
        border: "1px solid var(--primary)",
        borderRadius: "8px",
        marginTop: "10px",
        backgroundColor: "var(--surface-light)",
        color: "var(--primary)",
        fontWeight: "bold",
        display: "inline-block",
      }}
    >
      Current Status: {status}
    </div>
  );
}