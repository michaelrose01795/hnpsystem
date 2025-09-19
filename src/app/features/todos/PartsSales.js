"use client";
import React, { useState } from "react";

export default function PartsSales() {
  const [sales, setSales] = useState([
    { id: 1, part: "Air Filter", soldBy: "Parts Person A", qty: 3 },
    { id: 2, part: "Brake Pads", soldBy: "Parts Person B", qty: 2 },
  ]);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Parts Sales Tracking</h1>
      <table border="1" cellPadding="8" style={{ marginTop: "1rem", width: "100%" }}>
        <thead style={{ background: "#f0f0f0" }}>
          <tr>
            <th>ID</th>
            <th>Part</th>
            <th>Sold By</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.part}</td>
              <td>{s.soldBy}</td>
              <td>{s.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}