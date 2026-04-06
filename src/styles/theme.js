// file location: src/styles/theme.js
// Thin compatibility layer that mirrors the semantic CSS token system.

// Expose the light theme through CSS variables so older context consumers stay harmless.
export const lightTheme = {
  // Keep the original shape but point every value at the real semantic tokens.
  name: "light",
  background: "var(--background)",
  surface: "var(--surfaceMain)",
  surfaceLight: "var(--surfaceHover)",
  border: "var(--border)",
  textPrimary: "var(--surfaceText)",
  textSecondary: "var(--surfaceTextMuted)",
  primaryColor: "var(--accentMain)",
  primaryColorLight: "var(--accentHover)",
  primaryColorDark: "var(--accentPressed)",
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
  info: "var(--accentMain)",
  infoMuted: "var(--accentSurfaceSubtle)",
  infoDark: "var(--accentPressed)",
  accentPurple: "var(--accentMain)",
  accentPurpleMuted: "var(--accentSurfaceSubtle)",
  accentBlue: "var(--accentMain)",
  accentBlueMuted: "var(--accentSurfaceSubtle)",
  accentOrange: "var(--accentMain)",
  accentOrangeMuted: "var(--accentSurfaceSubtle)",
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
