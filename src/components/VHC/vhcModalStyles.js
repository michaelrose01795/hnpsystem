// file location: src/components/VHC/vhcModalStyles.js
// Shared style constants for VHC detail modal FIELD-LEVEL elements (inputs, labels, selects, etc.).
// NOTE: This is NOT the same as the vhcModalStyles export in src/styles/appTheme.js.
//   - THIS file: field/input styles used by individual VHC detail modals (WheelsTyres, Brakes, External, etc.)
//   - appTheme.js vhcModalStyles: modal SHELL layout styles (overlay, container, header, body, footer)
//   Both serve different purposes and should not be confused or merged.
import themeConfig from "@/styles/appTheme";

const palette = themeConfig.palette;

export { palette };

export const STATUS_OPTIONS = ["Red", "Amber", "Green"];

export const fieldLabelStyle = {
  margin: 0,
  color: "var(--text-1)",
  textTransform: "uppercase",
  fontSize: "var(--text-label)",
  letterSpacing: "var(--tracking-caps)",
};

// Inputs and selects now inherit the global control styling defined in
// globals.css (input / select / .dropdown-api__control rules). These exports
// remain so existing spread patterns (`{ ...inputStyle, width: "8ch" }`) keep
// working — they contribute no inline style of their own.
export const inputStyle = { width: "100%" };

export const statusSelectStyle = { width: "auto" };

export const lockedRowOverlayStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(var(--surface-rgb), 0.78)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-md)",
  zIndex: 10,
  pointerEvents: "none",
};

export const lockedRowBadgeStyle = (isDeclined) => ({
  padding: "var(--space-sm) var(--space-md)",
  borderRadius: "var(--radius-xs)",
  fontSize: "13px",
  fontWeight: 600,
  backgroundColor: isDeclined ? "var(--danger-surface)" : "var(--success-surface)",
  color: isDeclined ? "var(--dangerMain)" : "var(--successMain)",
  border: "none",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});
