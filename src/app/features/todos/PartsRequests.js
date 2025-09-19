"use client";
import React, { useState } from "react";

export default function PartsRequests() {
  const [requests, setRequests] = useState([
    { id: 1, part: "Brake Pads", requestedBy: "Technician A", status: "Pending" },
    { id: 2, part: "Oil Filter", requestedBy: "Technician B", status: "Approved" },
  ]);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Parts Requests</h1>
      <table border="1" cellPadding="8" style={{ marginTop: "1rem", width: "100%" }}>
        <thead style={{ background: "#f0f0f0" }}>
          <tr>
            <th>ID</th>
            <th>Part</th>
            <th>Requested By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.part}</td>
              <td>{r.requestedBy}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}