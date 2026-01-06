// file location: src/components/companyAccounts/CompanyAccountForm.js // shared form for new/edit company accounts
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  linked_account_label: "",
  notes: "",
};

const BULK_FIELD_MAP = [
  { key: "account_number", label: "Account Number" },
  { key: "company_name", label: "Company Name" },
  { key: "trading_name", label: "Trading Name" },
  { key: "contact_name", label: "Primary Contact" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Contact Phone" },
  { key: "linked_account_label", label: "Linked Ledger Account" },
  { key: "billing_address_line1", label: "Address Line 1" },
  { key: "billing_address_line2", label: "Address Line 2" },
  { key: "billing_city", label: "City" },
  { key: "billing_postcode", label: "Postcode" },
];

export default function CompanyAccountForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  autoGenerateAccountNumber = false,
}) {
  const normalizedInitialValues = useMemo(() => {
    if (!initialValues) return null;
    if (!initialValues.linked_account_label && initialValues.linked_account_id) {
      return { ...initialValues, linked_account_label: initialValues.linked_account_id };
    }
    return initialValues;
  }, [initialValues]);
  const baseValues = useMemo(() => ({ ...DEFAULT_VALUES, ...(normalizedInitialValues || {}) }), [normalizedInitialValues]);
  const [values, setValues] = useState(baseValues);
  const [fetchingNumber, setFetchingNumber] = useState(false);
  const [formError, setFormError] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

  useEffect(() => {
    setValues(baseValues);
    setBulkInput("");
    setBulkFeedback("");
  }, [baseValues]);

  const fetchNextAccountNumber = useCallback(
    async (options = {}) => {
      const { signal } = options;
      const response = await fetch("/api/company-accounts/next-number", signal ? { signal } : undefined);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to reserve next account number");
      }
      return payload.accountNumber;
    },
    []
  );

  useEffect(() => {
    if (!autoGenerateAccountNumber) return;
    if (initialValues?.account_number) return;
    const controller = new AbortController();
    const loadNextNumber = async () => {
      setFetchingNumber(true);
      try {
        const accountNumber = await fetchNextAccountNumber({ signal: controller.signal });
        setValues((prev) => ({ ...prev, account_number: accountNumber }));
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
  }, [autoGenerateAccountNumber, initialValues?.account_number, fetchNextAccountNumber]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    let submissionValues = values;
    if (!submissionValues.account_number?.trim()) {
      setFetchingNumber(true);
      try {
        const accountNumber = await fetchNextAccountNumber();
        submissionValues = { ...submissionValues, account_number: accountNumber };
        setValues(submissionValues);
      } catch (error) {
        setFormError(error.message || "Unable to reserve next account number");
        setFetchingNumber(false);
        return;
      }
      setFetchingNumber(false);
    }
    try {
      await onSubmit(submissionValues);
    } catch (error) {
      setFormError(error.message || "Failed to save company account");
    }
  };

  const applyBulkInput = () => {
    const lines = bulkInput
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      setBulkFeedback("No data found to apply.");
      return;
    }
    while (lines.length && ["code", "account number"].includes(lines[0].toLowerCase())) {
      lines.shift();
    }
    const updates = {};
    let filled = 0;
    const firstValue = lines[0] || "";
    const accountPattern = /^CA-?\d{3,}$/i;
    const hasAccountNumber = accountPattern.test(firstValue);
    let valueIndex = 0;
    BULK_FIELD_MAP.forEach((field) => {
      if (field.key === "account_number" && !hasAccountNumber) {
        return;
      }
      const value = lines[valueIndex];
      valueIndex += 1;
      if (typeof value === "string" && value.length) {
        updates[field.key] = value;
        filled += 1;
      }
    });
    if (!filled) {
      setBulkFeedback("Unable to map bulk data to any fields.");
      return;
    }
    setValues((prev) => ({ ...prev, ...updates }));
    const extraNotice = lines.length > BULK_FIELD_MAP.length ? " Extra lines were ignored." : "";
    setBulkFeedback(`Filled ${filled} field${filled === 1 ? "" : "s"} from bulk data.${extraNotice}`);
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
      <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
        <span style={{ fontWeight: 600 }}>Bulk data entry</span>
        <textarea
          value={bulkInput}
          onChange={(event) => setBulkInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              applyBulkInput();
            }
          }}
          rows={8}
          placeholder={[
            "Paste values in this order then press Tab:",
            "Account Number, Company Name, Trading Name, Primary Contact,",
            "Contact Email, Contact Phone, Linked Ledger Account,",
            "Address Line 1, Address Line 2, City, Postcode.",
          ].join(" ")}
          style={{
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            padding: "12px 14px",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={applyBulkInput}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--surface-light)",
              background: "white",
              fontWeight: 600,
            }}
          >
            Apply data
          </button>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Press Tab in the box or click Apply to fill the form.</span>
        </div>
        {bulkFeedback && (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{bulkFeedback}</p>
        )}
      </label>
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
        {textInput("linked_account_label", "Linked Ledger Account")}
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
            border: "1px solid var(--surface-border, var(--surface-light))",
            background: "var(--surface-light)",
            color: "var(--text-primary)",
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
