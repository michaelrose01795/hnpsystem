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
  fontSize: "12px",
  fontWeight: 600,
  color: palette.textMuted,
  letterSpacing: "0.3px",
};

export const inputStyle = {
  width: "100%",
  minHeight: "var(--control-height)",
  padding: "var(--control-padding)",
  borderRadius: "var(--control-radius)",
  border: "none",
  backgroundColor: "var(--control-bg)",
  fontSize: "var(--control-font-size)",
  fontWeight: "var(--control-font-weight)",
  color: "var(--text-primary)",
  outline: "none",
  boxShadow: "none",
  transition: "background-color 0.18s ease, box-shadow 0.18s ease",
};

export const statusSelectStyle = {
  ...inputStyle,
  width: "auto",
};

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
