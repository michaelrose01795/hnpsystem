// file location: src/styles/theme.js
// Thin compatibility layer that mirrors the semantic CSS token system.

// Expose the light theme through CSS variables so older context consumers stay harmless.
export const lightTheme = {
  // Keep the original shape but point every value at the real semantic tokens.
  name: "light",
  background: "var(--surface)",
  surface: "var(--surface)",
  surfaceLight: "var(--surfaceHover)",
  border: "var(--primary-border)",
  textPrimary: "var(--text-1)",
  textSecondary: "var(--text-1)",
  primaryColor: "var(--primary)",
  primaryColorLight: "var(--primary-hover)",
  primaryColorDark: "var(--primary-pressed)",
  greyAccent: "var(--grey-accent)",
  greyAccentLight: "var(--grey-accent-light)",
  greyAccentDark: "var(--grey-accent-dark)",
  success: "var(--successMain)",
  successMuted: "var(--success-surface)",
  successDark: "var(--success-dark)",
  warning: "var(--warningMain)",
  warningMuted: "var(--warning-surface)",
  warningDark: "var(--warning-dark)",
  danger: "var(--dangerMain)",
  dangerMuted: "var(--danger-surface)",
  dangerDark: "var(--danger-dark)",
  info: "var(--info)",
  infoMuted: "var(--theme-status)",
  infoDark: "var(--info-dark)",
  accentPurple: "var(--primary)",
  accentPurpleMuted: "var(--theme)",
  accentBlue: "var(--primary)",
  accentBlueMuted: "var(--theme)",
  accentOrange: "var(--primary)",
  accentOrangeMuted: "var(--theme)",
  overlay: "var(--overlay)",
  shadowRgb: "var(--accentMainRgb)",
};

// Expose the dark theme through the same semantic CSS variables.
export const darkTheme = {
  // The token references remain identical because the actual values come from theme.css + runtime assignment.
  ...lightTheme,
  name: "dark",
};

// Preserve the historic `themes` export used by ThemeProvider.
export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

// Keep the default export for compatibility with any legacy imports.
export default themes;
