// src/pages/admin/role-management.js
import React, { useState } from "react";

export default function RoleManagement() {
  // Placeholder role data
  const [roles, setRoles] = useState([
    { id: 1, name: "Admin", description: "Full system access" },
    { id: 2, name: "Technician", description: "Workshop tasks & VHC" },
    { id: 3, name: "Service Reception", description: "Booking & job allocation" },
    { id: 4, name: "Salesman", description: "Car sales & customer tracking" },
    { id: 5, name: "Manager", description: "Reports & approvals" },
  ]);

  // Placeholder functions
  const handleAddRole = () => {
    alert("TODO: Implement Add Role form/modal");
  };

  const handleEditRole = (id) => {
    alert(`TODO: Implement Edit Role functionality for role ID ${id}`);
  };

  const handleDeleteRole = (id) => {
    if (confirm("Are you sure you want to delete this role?")) {
      setRoles(roles.filter((role) => role.id !== id));
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Role Management</h1>
      <p>Manage system roles below. (Placeholder data shown)</p>

      {/* Add Role Button */}
      <button
        onClick={handleAddRole}
        style={{
          margin: "1rem 0",
          padding: "0.5rem 1rem",
          backgroundColor: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        ➕ Add Role
      </button>

      {/* Role Table */}
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
            <th style={tableHeader}>Role Name</th>
            <th style={tableHeader}>Description</th>
            <th style={tableHeader}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tableCell}>{role.id}</td>
              <td style={tableCell}>{role.name}</td>
              <td style={tableCell}>{role.description}</td>
              <td style={tableCell}>
                <button
                  onClick={() => handleEditRole(role.id)}
                  style={btnStyle("orange")}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  style={btnStyle("red")}
                >
                  🗑 Delete
                </button>
              </td>
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

// Reusable button style function
const btnStyle = (color) => ({
  marginRight: "0.5rem",
  padding: "0.3rem 0.8rem",
  backgroundColor: color,
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
});