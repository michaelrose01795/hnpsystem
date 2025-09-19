// src/pages/admin/logs.js
import React, { useState } from "react";

export default function SystemLogs() {
  // Placeholder log data
  const [logs] = useState([
    { id: 1, user: "John Doe", action: "Created Job Card", timestamp: "2025-09-18 10:32" },
    { id: 2, user: "Jane Smith", action: "Approved Parts Request", timestamp: "2025-09-18 11:05" },
    { id: 3, user: "Admin User", action: "Updated User Role", timestamp: "2025-09-17 16:20" },
    { id: 4, user: "Technician Mike", action: "Clocked Out", timestamp: "2025-09-17 18:02" },
  ]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>System Logs</h1>
      <p>Audit log of user actions. (Placeholder data shown)</p>

      {/* Logs Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "1rem",
        }}
      >
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={tableHeader}>ID</th>
            <th style={tableHeader}>User</th>
            <th style={tableHeader}>Action</th>
            <th style={tableHeader}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tableCell}>{log.id}</td>
              <td style={tableCell}>{log.user}</td>
              <td style={tableCell}>{log.action}</td>
              <td style={tableCell}>{log.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Table header/cell styles
const tableHeader = {
  padding: "0.75rem",
  textAlign: "left",
  borderBottom: "2px solid #ddd",
};

const tableCell = {
  padding: "0.75rem",
};