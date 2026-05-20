// file location: src/components/Admin/AdminUserForm.js
import React, { useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";

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

export default function AdminUserForm({
  onCreated,
  parentSectionKey = "admin-users-page-stack",
  sectionKey = "admin-users-create-user-card",
}) {
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
    <LayerTheme
      className="app-section-card"
      sectionKey={sectionKey}
      parentKey={parentSectionKey}
      sectionType="content-card"
      padding="var(--section-card-padding)"
      gap="var(--layout-card-gap)"
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
          gap: "var(--layout-card-gap)",
        }}
      >
        <Field label="First name">
          <input className="app-input" name="firstName" type="text" value={form.firstName} onChange={handleChange} required />
        </Field>
        <Field label="Last name">
          <input className="app-input" name="lastName" type="text" value={form.lastName} onChange={handleChange} required />
        </Field>
        <Field label="Email">
          <input className="app-input" name="email" type="email" value={form.email} onChange={handleChange} required />
        </Field>
        <Field label="Department">
          <select className="app-input" name="department" value={form.department} onChange={handleChange}>
            <option value="">Select department (optional)</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select className="app-input" name="role" value={form.role} onChange={handleChange}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phone">
          <input
            className="app-input"
            name="phone"
            type="tel"
            value={form.phone || ""}
            onChange={handleChange}
          />
        </Field>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="submit" className="app-btn app-btn--primary">
            {submitting ? "Creating..." : "Create user"}
          </button>
          <button type="button" onClick={handleReset} className="app-btn app-btn--secondary">
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
            borderRadius: "var(--radius-sm)",
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
    </LayerTheme>
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
