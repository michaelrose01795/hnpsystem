"use client";
import React, { useState, useEffect } from "react";

// Placeholder logs - later these will come from backend API
const mockLogs = [
  { id: 1, user: "Admin", action: "Created new user John", timestamp: "2025-09-18 09:15" },
  { id: 2, user: "Service Reception", action: "Updated vehicle status to 'In Progress'", timestamp: "2025-09-18 09:25" },
  { id: 3, user: "Parts", action: "Approved parts request #4521", timestamp: "2025-09-18 09:40" },
  { id: 4, user: "Admin", action: "Changed RBAC settings for Salesman", timestamp: "2025-09-18 09:55" },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Later replace with API call
    setLogs(mockLogs);
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Audit Logs</h1>
      <p>Track all user actions and system events.</p>

      <table border="1" cellPadding="8" style={{ marginTop: "1rem", width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f0f0f0" }}>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Action</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.id}</td>
              <td>{log.user}</td>
              <td>{log.action}</td>
              <td>{log.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}