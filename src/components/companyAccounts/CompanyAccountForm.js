// file location: src/components/companyAccounts/CompanyAccountForm.js // shared form for new/edit company accounts
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

const DEFAULT_VALUES = {
  account_number: "",
  company_name: "",
  trading_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_city: "",
  billing_postcode: "",
  billing_country: "United Kingdom",
  linked_account_id: "",
  notes: "",
};

export default function CompanyAccountForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  autoGenerateAccountNumber = false,
}) {
  const baseValues = useMemo(() => ({ ...DEFAULT_VALUES, ...(initialValues || {}) }), [initialValues]);
  const [values, setValues] = useState(baseValues);
  const [fetchingNumber, setFetchingNumber] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setValues(baseValues);
  }, [baseValues]);

  useEffect(() => {
    if (!autoGenerateAccountNumber) return;
    if (initialValues?.account_number) return;
    const controller = new AbortController();
    const loadNextNumber = async () => {
      setFetchingNumber(true);
      try {
        const response = await fetch("/api/company-accounts/next-number", { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to reserve next account number");
        }
        setValues((prev) => ({ ...prev, account_number: payload.accountNumber }));
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Unable to prefetch company account number", error);
        setFormError(error.message || "Unable to reserve next account number");
      } finally {
        setFetchingNumber(false);
      }
    };
    loadNextNumber();
    return () => controller.abort();
  }, [autoGenerateAccountNumber, initialValues?.account_number]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    try {
      await onSubmit(values);
    } catch (error) {
      setFormError(error.message || "Failed to save company account");
    }
  };

  const disabled = isSubmitting || fetchingNumber;

  const textInput = (name, label, props = {}) => {
    const { style: customStyle, disabled: propDisabled, ...rest } = props;
    const isAccountNumberField = name === "account_number";
    const computedDisabled = Boolean(propDisabled || (isAccountNumberField && disabled));
    return (
      <label key={name} style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <input
          name={name}
          value={values[name] || ""}
          onChange={handleChange}
          disabled={computedDisabled}
          {...rest}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            background: computedDisabled ? "var(--surface-light)" : "white",
            ...customStyle,
          }}
        />
      </label>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        borderRadius: "16px",
        border: "1px solid var(--surface-light)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {textInput("account_number", "Account Number", { required: true, disabled: autoGenerateAccountNumber })}
        {textInput("company_name", "Company Name", { required: true })}
        {textInput("trading_name", "Trading Name")}
        {textInput("contact_name", "Primary Contact")}
        {textInput("contact_email", "Contact Email", { type: "email" })}
        {textInput("contact_phone", "Contact Phone")}
        {textInput("linked_account_id", "Linked Ledger Account")}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {textInput("billing_address_line1", "Address Line 1")}
        {textInput("billing_address_line2", "Address Line 2")}
        {textInput("billing_city", "City")}
        {textInput("billing_postcode", "Postcode")}
        {textInput("billing_country", "Country")}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
        <span style={{ fontWeight: 600 }}>Notes</span>
        <textarea
          name="notes"
          value={values.notes || ""}
          onChange={handleChange}
          rows={5}
          style={{
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            padding: "10px 14px",
            resize: "vertical",
          }}
        />
      </label>
      {formError && (
        <p style={{ margin: 0, color: "var(--danger, #b45309)" }}>{formError}</p>
      )}
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            background: "transparent",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: "var(--primary)",
            color: "white",
            fontWeight: 700,
            opacity: disabled ? 0.7 : 1,
          }}
        >
          {isSubmitting ? "Saving…" : "Save Company"}
        </button>
      </div>
    </form>
  );
}

CompanyAccountForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isSubmitting: PropTypes.bool,
  autoGenerateAccountNumber: PropTypes.bool,
};

CompanyAccountForm.defaultProps = {
  initialValues: null,
  onCancel: () => {},
  isSubmitting: false,
  autoGenerateAccountNumber: false,
};
