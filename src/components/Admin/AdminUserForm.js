// file location: src/components/Admin/AdminUserForm.js
// Reference implementation for the Phase 8 validation framework.
// Uses useFormValidation for inline, accessible field errors (no HTML5-only
// guards), a grouped summary, focus-on-first-invalid, live re-validation after
// the first submit, a busy submit button (Phase 6), and reporting via the
// Phase 3/5 helpers (reportSuccess / reportApiError).
import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import FieldError from "@/components/ui/FieldError";
import FormErrorSummary from "@/components/ui/FormErrorSummary";
import useFormValidation from "@/hooks/useFormValidation";
import { required, email as emailRule, phone as phoneRule } from "@/lib/validation/rules";
import { reportSuccess, reportApiError } from "@/lib/notifications/report";
import { roleCategories } from "@/config/users";

const roles = Array.from(
  new Set([...roleCategories.Retail, ...roleCategories.Sales, ...roleCategories.Mobile])
).map((role) => ({ value: role.toLowerCase(), label: role }));

const departments = Object.keys(roleCategories);
const defaultRole = roles[0]?.value || "";

const defaultForm = {
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  role: defaultRole,
  phone: "",
};

// Configurable rules (module scope → stable identity for the hook).
const USER_SCHEMA = {
  firstName: required("First name is required"),
  lastName: required("Last name is required"),
  email: [required("Email is required"), emailRule()],
  role: required("Select a role"),
  phone: phoneRule(), // optional — format-checked only when provided
};

const FIELD_ORDER = ["firstName", "lastName", "email", "role", "phone"];

export default function AdminUserForm({
  onCreated,
  parentSectionKey = "admin-users-page-stack",
  sectionKey = "admin-users-create-user-card",
}) {
  const form = useFormValidation({
    initialValues: defaultForm,
    schema: USER_SCHEMA,
    fieldOrder: FIELD_ORDER,
    onSubmit: async (values, { setFieldError, reset }) => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            role: values.role,
            phone: values.phone,
          }),
        });

        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          // Prefer an inline, field-level server error where we can attribute it.
          if (response.status === 409 || /email/i.test(payload?.message || "")) {
            setFieldError("email", payload?.message || "That email is already in use.");
            return;
          }
          const err = new Error(payload?.message || "Failed to create user");
          err.status = response.status;
          throw err;
        }

        reportSuccess(`Created ${payload.data.firstName} ${payload.data.lastName}.`);
        reset();
        onCreated?.(payload.data);
      } catch (err) {
        // Phase 5 friendly-key mapping; raw message stays in devInfo only.
        reportApiError(err, { endpoint: "/api/admin/users", action: "admin.createUser" });
      }
    },
  });

  return (
    <LayerTheme
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
          Provision employees with access to the DMS.
        </p>
      </div>

      {form.summaryErrors.length > 0 && (
        <FormErrorSummary errors={form.summaryErrors} onFocusField={form.focusField} />
      )}

      <form
        onSubmit={form.handleSubmit}
        noValidate
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--layout-card-gap)",
        }}
      >
        <InputField
          label="First name"
          type="text"
          required
          placeholder="Amelia"
          error={form.errors.firstName}
          {...form.getFieldProps("firstName")}
        />
        <InputField
          label="Last name"
          type="text"
          required
          placeholder="Hart"
          error={form.errors.lastName}
          {...form.getFieldProps("lastName")}
        />
        <InputField
          label="Email"
          type="email"
          required
          placeholder="amelia.hart@example.test"
          error={form.errors.email}
          {...form.getFieldProps("email")}
        />

        <label style={labelStyle}>
          <span>Department</span>
          <select className="app-input" {...form.getFieldProps("department")}>
            <option value="">Select department (optional)</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          <span>
            Role
            <span className="app-field-required" aria-hidden="true">{" *"}</span>
          </span>
          <select className="app-input" {...form.getFieldProps("role")}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <FieldError id="field-role-error">{form.errors.role}</FieldError>
        </label>

        <InputField
          label="Phone"
          type="tel"
          placeholder="01732 000 301"
          hint="Optional — UK format."
          error={form.errors.phone}
          {...form.getFieldProps("phone")}
        />

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Button type="submit" variant="primary" busy={form.submitting}>
            {form.submitting ? "Creating…" : "Create user"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => form.reset()}>
            Reset form
          </Button>
        </div>
      </form>
    </LayerTheme>
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
