"use client";
import React, { useState } from "react";

export default function PartsInventory() {
  const [parts, setParts] = useState([
    { id: 1, name: "Oil Filter", number: "OF123", qty: 20 },
    { id: 2, name: "Brake Pads", number: "BP456", qty: 10 },
    { id: 3, name: "Air Filter", number: "AF789", qty: 15 },
  ]);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Parts Inventory</h1>
      <table border="1" cellPadding="8" style={{ marginTop: "1rem", width: "100%" }}>
        <thead style={{ background: "#f0f0f0" }}>
          <tr>
            <th>ID</th>
            <th>Part Name</th>
            <th>Part Number</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.id}>
              <td>{part.id}</td>
              <td>{part.name}</td>
              <td>{part.number}</td>
              <td>{part.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}