// file location: src/components/VHC/vhcModalStyles.js
// Shared style constants for VHC detail modals.
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
  padding: "10px 12px",
  borderRadius: "12px",
  border: `1px solid ${palette.border}`,
  backgroundColor: palette.surface,
  fontSize: "14px",
  color: palette.textPrimary,
  outline: "none",
  boxShadow: "none",
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
  backgroundColor: "rgba(255, 255, 255, 0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "16px",
  zIndex: 10,
  pointerEvents: "none",
};

export const lockedRowBadgeStyle = (isDeclined) => ({
  padding: "8px 16px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  backgroundColor: isDeclined ? "var(--danger-surface)" : "var(--success-surface)",
  color: isDeclined ? "var(--danger)" : "var(--success)",
  border: `1px solid ${isDeclined ? "var(--danger)" : "var(--success)"}`,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});
