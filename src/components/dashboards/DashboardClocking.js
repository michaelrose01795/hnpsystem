// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/DashboardClocking.js
import React, { useEffect, useState } from "react";
import { useClockingContext } from "@/components/context/ClockingContext";

export default function DashboardClocking() {
  const { allUsersClocking, fetchAllUsersClocking, loading } = useClockingContext();
  const [techs, setTechs] = useState([]);

  useEffect(() => {
    fetchAllUsersClocking();
  }, [fetchAllUsersClocking]);

  useEffect(() => {
    // Filter only technicians from all users
    const techUsers = allUsersClocking.filter((u) => u.roles?.includes("Techs"));
    setTechs(techUsers);
  }, [allUsersClocking]);

  if (loading) return <p>Loading clocking info...</p>;

  return (
    <div style={{ marginTop: "20px" }}>
      <h2 style={{ color: "#FF4040", marginBottom: "16px" }}>Workshop Clocking Overview</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
        }}
      >
        {techs.map((tech, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "#FFF0F0",
              border: "1px solid #FFCCCC",
              borderRadius: "8px",
              padding: "16px",
              textAlign: "center",
              minHeight: "100px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              fontWeight: "500",
              fontSize: "1rem",
              color: "#FF4040",
            }}
          >
            <div>{tech.user}</div>
            <div style={{ marginTop: "10px", color: "#FF8080" }}>
              Status: {tech.clockedIn ? "Clocked In" : "Clocked Out"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}