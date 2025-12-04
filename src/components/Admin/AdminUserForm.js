// file location: src/components/Admin/AdminUserForm.js
import React, { useState } from "react";

const defaultForm = {
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  role: "employee",
  phone: "",
};

const roles = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr manager", label: "HR Manager" },
  { value: "admin manager", label: "Admin Manager" },
];

const departments = ["Workshop", "Service", "Sales", "Valet", "Parts", "Admin"];

export default function AdminUserForm({ onCreated }) {
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          role: form.role,
          phone: form.phone,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to create user");
      }

      setMessage({ type: "success", text: `Created ${payload.data.firstName} ${payload.data.lastName}` });
      setForm(defaultForm);
      onCreated?.(payload.data);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Unable to create user" });
    } finally {
      setSubmitting(false);
    }
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
        boxShadow: "0 16px 32px rgba(var(--accent-purple-rgb), 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-purple)" }}>
          Create Platform User
        </h2>
        <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
          Provision employees with access to the DMS. Uses the admin API to insert directly into Supabase.
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
          <select name="department" value={form.department} onChange={handleChange} style={inputStyle}>
            <option value="">Select department (optional)</option>
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
        <Field label="Phone">
          <input
            name="phone"
            type="tel"
            value={form.phone || ""}
            onChange={handleChange}
            style={inputStyle}
          />
        </Field>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px" }}>
          <button type="submit" style={primaryButtonStyle}>
            {submitting ? "Creating…" : "Create user"}
          </button>
          <button type="button" onClick={handleReset} style={secondaryButtonStyle}>
            Reset form
          </button>
        </div>
      </form>

      {message && (
        <div
          style={{
            background:
              message.type === "error"
                ? "rgba(var(--primary-rgb), 0.1)"
                : message.type === "success"
                ? "rgba(var(--info-rgb), 0.12)"
                : "rgba(var(--accent-purple-rgb), 0.1)",
            border:
              message.type === "error"
                ? "1px solid rgba(var(--primary-rgb), 0.3)"
                : message.type === "success"
                ? "1px solid rgba(var(--info-rgb), 0.3)"
                : "1px solid rgba(var(--accent-purple-rgb), 0.2)",
            borderRadius: "12px",
            padding: "12px",
            color:
              message.type === "error"
                ? "var(--danger)"
                : message.type === "success"
                ? "var(--info-dark)"
                : "var(--accent-purple)",
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
  color: "var(--info-dark)",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  padding: "10px 12px",
  fontWeight: 500,
  color: "var(--accent-purple)",
  background: "var(--surface)",
};

const primaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple)",
  background: "white",
  color: "var(--accent-purple)",
  fontWeight: 600,
  cursor: "pointer",
};
