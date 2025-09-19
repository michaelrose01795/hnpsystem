"use client";
import React, { useState, useEffect } from "react";

// Placeholder notifications (will later come from backend/websocket)
const mockNotifications = [
  { id: 1, type: "Parts", message: "Parts request #4521 has been approved", timestamp: "2025-09-18 09:45" },
  { id: 2, type: "Workshop", message: "Job #1234 marked as completed", timestamp: "2025-09-18 10:05" },
  { id: 3, type: "MOT", message: "MOT reminder for vehicle ABC123 due soon", timestamp: "2025-09-18 10:20" },
];

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Later connect to backend or WebSocket
    setNotifications(mockNotifications);
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Notification Center</h1>
      <p>All system alerts and updates will appear here.</p>

      <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0 }}>
        {notifications.map((n) => (
          <li
            key={n.id}
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              background: "#f9f9f9",
            }}
          >
            <strong>[{n.type}]</strong> {n.message}
            <div style={{ fontSize: "0.8rem", color: "#666" }}>{n.timestamp}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}