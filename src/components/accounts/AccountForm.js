// file location: src/components/accounts/AccountForm.js // header comment per requirement
import React, { useEffect, useState } from "react"; // import React and hooks for component logic
import PropTypes from "prop-types";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES, DEFAULT_ACCOUNT_FORM_VALUES } from "@/config/accounts";
import { fieldGroupStyles, inputStyles, labelStyles, textareaStyles } from "@/styles/formStyles";
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
export default function AccountForm({ initialValues, onSubmit, isSubmitting, readOnly, onCancel }) {
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
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Maintain account type, balance, and status.</p>
        </header>
        {fieldDefinitions.map((field) => (
          <label key={field.name} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyles}>{field.label}</span>
            {field.type === "select" ? (
              <select name={field.name} value={formValues[field.name] || ""} onChange={handleChange} disabled={readOnly || (field.name === "account_type" && !!formValues.account_id)} style={inputStyles}>
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input name={field.name} type={field.type} value={formValues[field.name] ?? ""} onChange={handleChange} disabled={readOnly && field.name !== "status"} style={inputStyles} step={field.type === "number" ? "0.01" : undefined} />
            )}
          </label>
        ))}
        <label style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={labelStyles}>Internal Notes</span>
          <textarea name="notes" style={textareaStyles} value={formValues.notes || ""} onChange={handleChange} disabled={readOnly} placeholder="Credit control notes, reminders, or manual adjustments." />
        </label>
        {isFrozen && (
          <div style={{ flexBasis: "100%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "12px", padding: "14px" }}>
            <strong style={{ display: "block", color: "#92400e", marginBottom: "4px" }}>Frozen Account</strong>
            <p style={{ margin: 0, color: "#92400e", fontSize: "0.9rem" }}>New invoices cannot be assigned to frozen accounts until status changes back to Active.</p>
          </div>
        )}
      </section>
      <section style={fieldGroupStyles}>
        <header style={{ flexBasis: "100%" }}>
          <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Billing Contact</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Keep invoicing information up to date for statements.</p>
        </header>
        {billingFields.map((field) => (
          <label key={field.name} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyles}>{field.label}</span>
            <input name={field.name} type={field.type} value={formValues[field.name] ?? ""} onChange={handleChange} disabled={readOnly} style={inputStyles} />
          </label>
        ))}
      </section>
      {!readOnly && (
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ borderRadius: "10px", padding: "10px 16px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", color: "var(--text-secondary)", fontWeight: 600 }}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={isSubmitting} style={{ borderRadius: "10px", padding: "10px 18px", border: "none", background: "var(--primary)", color: "white", fontWeight: 700, minWidth: "160px", cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? "Saving…" : "Save Account"}
          </button>
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
};
AccountForm.defaultProps = {
  initialValues: DEFAULT_ACCOUNT_FORM_VALUES,
  isSubmitting: false,
  readOnly: false,
  onCancel: undefined,
};
