// file location: src/components/Admin/AdminUserForm.js
import React, { useState } from "react";

const defaultForm = {
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  role: "employee",
  hourlyRate: "",
  overtimeRate: "",
};

const roles = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr manager", label: "HR Manager" },
  { value: "admin manager", label: "Admin Manager" },
];

const departments = ["Workshop", "Service", "Sales", "Valet", "Parts", "Admin"];

/**
 * Placeholder admin form for creating platform users.
 * TODO: Wire submission to Supabase + Keycloak provisioning service.
 */
export default function AdminUserForm() {
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Replace with API call to create user in Supabase + Keycloak.
    setMessage({
      type: "info",
      text:
        "User creation flow is a placeholder. Integrate with Keycloak and Supabase mutation before go-live.",
    });
  };

  const handleReset = () => {
    setForm(defaultForm);
    setMessage(null);
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>
          Create Platform User
        </h2>
        <p style={{ margin: "4px 0 0", color: "#6B7280" }}>
          Provision employees with access to the DMS. Form currently stores data locally for testing.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <Field label="First name">
          <input name="firstName" type="text" value={form.firstName} onChange={handleChange} style={inputStyle} required />
        </Field>
        <Field label="Last name">
          <input name="lastName" type="text" value={form.lastName} onChange={handleChange} style={inputStyle} required />
        </Field>
        <Field label="Email">
          <input name="email" type="email" value={form.email} onChange={handleChange} style={inputStyle} required />
        </Field>
        <Field label="Department">
          <select name="department" value={form.department} onChange={handleChange} style={inputStyle} required>
            <option value="" disabled>
              Select department
            </option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hourly rate (£)">
          <input
            name="hourlyRate"
            type="number"
            min="0"
            step="0.01"
            value={form.hourlyRate}
            onChange={handleChange}
            style={inputStyle}
          />
        </Field>
        <Field label="Overtime rate (£)">
          <input
            name="overtimeRate"
            type="number"
            min="0"
            step="0.01"
            value={form.overtimeRate}
            onChange={handleChange}
            style={inputStyle}
          />
        </Field>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px" }}>
          <button type="submit" style={primaryButtonStyle}>
            Create user (placeholder)
          </button>
          <button type="button" onClick={handleReset} style={secondaryButtonStyle}>
            Reset form
          </button>
        </div>
      </form>

      {message && (
        <div
          style={{
            background: "rgba(37, 99, 235, 0.1)",
            border: "1px solid rgba(37, 99, 235, 0.2)",
            borderRadius: "12px",
            padding: "12px",
            color: "#1D4ED8",
            fontWeight: 600,
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={labelStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  color: "#374151",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  padding: "10px 12px",
  fontWeight: 500,
  color: "#111827",
  background: "#FFFFFF",
};

const primaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#1D4ED8",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #CBD5F5",
  background: "white",
  color: "#1D4ED8",
  fontWeight: 600,
  cursor: "pointer",
};
