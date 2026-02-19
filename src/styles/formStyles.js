// file location: src/styles/formStyles.js
// Shared form style objects used across AccountForm, CompanyAccountForm, etc.

export const fieldGroupStyles = {
  background: "var(--surface)",
  border: "1px solid var(--surface-light)",
  borderRadius: "16px",
  padding: "20px",
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
};

export const inputStyles = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--surface-light)",
  background: "var(--surface-light)",
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
