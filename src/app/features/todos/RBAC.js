"use client";
import React, { useState } from "react";

// Placeholder roles - will be fetched from backend later
const availableRoles = [
  "Admin",
  "Accounts",
  "Management",
  "Service Reception",
  "Salesman",
  "Vehicle Processing",
  "New Car Buying",
  "Second-Hand Car Buying",
  "Valet",
  "MOT",
  "Smart Repair",
  "Contractors",
  "Parts"
];

export default function RBAC() {
  const [selectedRole, setSelectedRole] = useState("");
  const [permissions, setPermissions] = useState({});

  const handleRoleChange = (e) => {
    setSelectedRole(e.target.value);
    setPermissions({}); // Reset when changing role
  };

  const togglePermission = (feature) => {
    setPermissions((prev) => ({
      ...prev,
      [feature]: !prev[feature]
    }));
  };

  const handleSave = () => {
    console.log("Saving RBAC settings for", selectedRole, permissions);
    alert(`Permissions saved for ${selectedRole} (placeholder)`);
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Role-Based Access Control (RBAC)</h1>
      <p>Assign and manage feature access for each role.</p>

      <label>
        Select Role:
        <select value={selectedRole} onChange={handleRoleChange}>
          <option value="">-- Select a Role --</option>
          {availableRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </label>

      {selectedRole && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Assign Permissions for {selectedRole}</h3>
          <ul>
            {["Dashboard", "Todos", "User Management", "Vehicles", "Parts"].map((feature) => (
              <li key={feature}>
                <label>
                  <input
                    type="checkbox"
                    checked={permissions[feature] || false}
                    onChange={() => togglePermission(feature)}
                  />
                  {feature}
                </label>
              </li>
            ))}
          </ul>

          <button onClick={handleSave} style={{ marginTop: "1rem" }}>
            Save Permissions
          </button>
        </div>
      )}
    </div>
  );
}