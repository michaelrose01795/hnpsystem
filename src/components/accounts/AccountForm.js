// file location: src/components/accounts/AccountForm.js // header comment per requirement
import React, { useEffect, useState } from "react"; // import React and hooks for component logic
import PropTypes from "prop-types";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES, DEFAULT_ACCOUNT_FORM_VALUES } from "@/config/accounts";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { fieldGroupStyles, labelStyles } from "@/styles/formStyles";
const fieldDefinitions = [
  { name: "customer_id", label: "Customer ID", type: "text" },
  { name: "account_type", label: "Account Type", type: "select", options: ACCOUNT_TYPES },
  { name: "balance", label: "Balance", type: "number" },
  { name: "credit_limit", label: "Credit Limit", type: "number" },
  { name: "credit_terms", label: "Credit Terms (Days)", type: "number" },
  { name: "status", label: "Status", type: "select", options: ACCOUNT_STATUSES },
];
const billingFields = [
  { name: "billing_name", label: "Billing Name", type: "text" },
  { name: "billing_email", label: "Billing Email", type: "email" },
  { name: "billing_phone", label: "Billing Phone", type: "tel" },
  { name: "billing_address_line1", label: "Address Line 1", type: "text" },
  { name: "billing_address_line2", label: "Address Line 2", type: "text" },
  { name: "billing_city", label: "City", type: "text" },
  { name: "billing_postcode", label: "Postcode", type: "text" },
  { name: "billing_country", label: "Country", type: "text" },
];
export default function AccountForm({ initialValues, onSubmit, isSubmitting, readOnly, onCancel, hideSectionDescriptions = false }) {
  const [formValues, setFormValues] = useState({ ...DEFAULT_ACCOUNT_FORM_VALUES, ...initialValues });
  useEffect(() => {
    setFormValues((prev) => ({ ...prev, ...initialValues }));
  }, [initialValues]);
  const handleChange = (event) => {
    const { name, value, type } = event.target;
    if (!name) return;
    const parsedValue = type === "number" ? Number(value) : value;
    setFormValues((prev) => ({ ...prev, [name]: parsedValue }));
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onSubmit === "function") {
      onSubmit(formValues);
    }
  };
  const isFrozen = (formValues.status || "").toLowerCase() === "frozen";
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <section style={fieldGroupStyles}>
        <header style={{ flexBasis: "100%" }}>
          <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Core Account Details</h2>
          {!hideSectionDescriptions && (
            <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "0.9rem" }}>Maintain account type, balance, and status.</p>
          )}
        </header>
        {fieldDefinitions.map((field) => (
          <label key={field.name} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyles}>{field.label}</span>
            {field.type === "select" ? (
              <DropdownField
                name={field.name}
                value={formValues[field.name] || ""}
                onChange={handleChange}
                disabled={readOnly || (field.name === "account_type" && !!formValues.account_id)}
                options={(field.options || []).map((option) => ({ label: option, value: option }))}
                placeholder={`Select ${field.label.toLowerCase()}`}
              />
            ) : (
              <input className="app-input" name={field.name} type={field.type} value={formValues[field.name] ?? ""} onChange={handleChange} disabled={readOnly && field.name !== "status"} step={field.type === "number" ? "0.01" : undefined} />
            )}
          </label>
        ))}
        <label style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={labelStyles}>Internal Notes</span>
          <textarea className="app-input" name="notes" value={formValues.notes || ""} onChange={handleChange} disabled={readOnly} placeholder="Credit control notes, reminders, or manual adjustments." />
        </label>
        {isFrozen && (
          <div style={{ flexBasis: "100%", background: "rgba(var(--warning-rgb), 0.15)", border: "none", borderRadius: "var(--radius-sm)", padding: "14px" }}>
            <strong style={{ display: "block", color: "var(--warning-text)", marginBottom: "4px" }}>Frozen Account</strong>
            <p style={{ margin: 0, color: "var(--warning-text)", fontSize: "0.9rem" }}>New invoices cannot be assigned to frozen accounts until status changes back to Active.</p>
          </div>
        )}
      </section>
      <section style={fieldGroupStyles}>
        <header style={{ flexBasis: "100%" }}>
          <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Billing Contact</h2>
          {!hideSectionDescriptions && (
            <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "0.9rem" }}>Keep invoicing information up to date for statements.</p>
          )}
        </header>
        {billingFields.map((field) => (
          <label key={field.name} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyles}>{field.label}</span>
            <input className="app-input" name={field.name} type={field.type} value={formValues[field.name] ?? ""} onChange={handleChange} disabled={readOnly} />
          </label>
        ))}
      </section>
      {!readOnly && (
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting} style={{ minWidth: "160px" }}>
            {isSubmitting ? "Saving…" : "Save Account"}
          </Button>
        </div>
      )}
    </form>
  );
}
AccountForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  readOnly: PropTypes.bool,
  onCancel: PropTypes.func,
  hideSectionDescriptions: PropTypes.bool,
};
AccountForm.defaultProps = {
  initialValues: DEFAULT_ACCOUNT_FORM_VALUES,
  isSubmitting: false,
  readOnly: false,
  onCancel: undefined,
  hideSectionDescriptions: false,
};
