// file location: src/styles/formStyles.js
// Shared form style objects used across AccountForm, CompanyAccountForm, etc.

export const fieldGroupStyles = {
  background: "var(--section-card-bg)",
  border: "var(--section-card-border)",
  borderRadius: "var(--section-card-radius)",
  padding: "var(--section-card-padding)",
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-md)",
};

export const inputStyles = {
  width: "100%",
  padding: "var(--input-padding)",
  borderRadius: "var(--input-radius)",
  border: "var(--input-border)",
  background: "var(--input-bg)",
};

export const labelStyles = {
  fontSize: "0.85rem",
  fontWeight: 600,
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  letterSpacing: "0.05em",
};

export const textareaStyles = {
  ...inputStyles,
  minHeight: "100px",
};
