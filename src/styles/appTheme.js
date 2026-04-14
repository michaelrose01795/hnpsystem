// file location: src/styles/appTheme.js
// Shared JS-facing theme aliases that point directly at the semantic CSS token system.

const palette = {
  accent: "var(--accentMain)",
  accentBase: "var(--accentSurface)",
  accentHover: "var(--accentHover)",
  accentPressed: "var(--accentPressed)",
  accentSoft: "var(--accentSurfaceSubtle)",
  accentSurface: "var(--accentSurface)",
  accentSurfaceHover: "var(--accentSurfaceHover)",
  backgroundGradient: "var(--surfaceMain)",
  modalGradient: "var(--surfaceMain)",
  surface: "var(--surfaceMain)",
  surfaceAlt: "var(--surfaceHover)",
  surfaceMuted: "var(--surfaceMutedToken)",
  border: "var(--border)",
  accentBorder: "var(--accentBorder)",
  accentBorderStrong: "var(--accentBorderStrong)",
  textPrimary: "var(--surfaceText)",
  textMuted: "var(--surfaceTextMuted)",
  overlay: "var(--overlay)",
  overlayMuted: "var(--overlay-muted)",
  onAccent: "var(--onAccentText)",
  success: "var(--successMain)",
  warning: "var(--warningMain)",
  danger: "var(--dangerMain)",
  info: "var(--accentMain)",
};

const radii = {
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  pill: "var(--radius-pill)",
};

const shadows = {
  sm: "none",
  md: "none",
  lg: "none",
};

export const vhcCardStates = {
  complete: {
    label: "Complete",
    background: "var(--success-surface)",
    color: "var(--success-dark)",
    border: "var(--success)",
  },
  inProgress: {
    label: "In Progress",
    background: "var(--warning-surface)",
    color: "var(--warning-dark)",
    border: "var(--warning)",
  },
  pending: {
    label: "Not Started",
    background: "var(--surface-light)",
    color: "var(--text-secondary)",
    border: "var(--border)",
  },
};

export const createVhcButtonStyle = (variant = "primary", { disabled = false } = {}) => {
  const base = {
    minHeight: "var(--control-height-sm)",
    padding: "var(--control-padding-sm)",
    borderRadius: "var(--control-radius)",
    fontSize: "var(--control-font-size)",
    fontWeight: "600",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background-color 0.18s ease, color 0.18s ease, opacity 0.18s ease",
    boxShadow: "none",
    opacity: disabled ? 0.5 : 1,
  };

  if (variant === "secondary") {
    return {
      ...base,
      backgroundColor: "var(--control-bg)",
      color: palette.accent,
    };
  }

  if (variant === "ghost") {
    return {
      ...base,
      backgroundColor: "var(--control-bg)",
      color: palette.accent,
    };
  }

  return {
    ...base,
    backgroundColor: disabled ? "var(--control-bg)" : palette.accent,
    color: disabled ? palette.textMuted : palette.onAccent,
  };
};

export const dropdownTriggerButtonStyle = {
  minHeight: "var(--dropdown-trigger-height)",
  padding: "var(--dropdown-trigger-padding)",
  borderRadius: "var(--dropdown-trigger-radius)",
  lineHeight: 1,
  boxShadow: "none",
};

// vhcLayoutStyles removed — moved inline to src/pages/job-cards/myjobs/[jobNumber].js
// (it was the only consumer of this export)

// NOTE on naming: this export is vhcModalStyles but it controls the SHELL layout of VHC modals
// (overlay backdrop, container dimensions, header/body/footer flex structure).
// It is NOT the same as src/components/VHC/vhcModalStyles.js which holds FIELD-LEVEL input styles.
// Both exist and serve different purposes. Do not rename or merge without updating all consumers.
export const vhcModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: palette.overlay,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: "clamp(10px, 2.5vw, 20px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  container: ({ width = "1080px", height = "640px" } = {}) => ({
    width,
    maxWidth: "calc(100vw - clamp(10px, 2.5vw, 20px) * 2)",
    height,
    maxHeight: "calc(100dvh - clamp(10px, 2.5vw, 20px) * 2)",
    background: palette.modalGradient,
    borderRadius: radii.xl,
    border: "none",
    boxShadow: "none",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  }),
  header: {
    padding: "var(--space-6) var(--space-lg) var(--space-3)",
    borderBottom: "none",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "var(--space-md)",
  },
  headerTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "var(--primary)",
    margin: 0,
  },
  headerSubtitle: {
    fontSize: "13px",
    color: palette.textMuted,
    margin: 0,
  },
  body: {
    flex: 1,
    padding: "var(--space-6) var(--space-lg) var(--space-lg)",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-md)",
    minHeight: 0,
  },
  footer: {
    padding: "var(--space-md) var(--space-lg)",
    borderTop: "none",
    display: "flex",
    justifyContent: "flex-end",
    gap: "var(--space-3)",
    backgroundColor: "transparent",
  },
};

export const vhcModalContentStyles = {
  contentWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-5)",
    minHeight: 0,
  },
  summaryCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "var(--space-md) var(--space-6)",
    borderRadius: "var(--section-card-radius)",
    border: "none",
    background: "var(--control-bg)",
    boxShadow: "none",
  },
  summaryTextBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-xs)",
  },
  summaryTitle: {
    fontSize: "13px",
    color: palette.textMuted,
    fontWeight: 600,
    letterSpacing: "0.2px",
  },
  summaryMetric: {
    fontSize: "20px",
    fontWeight: 700,
    color: palette.textPrimary,
  },
  summaryBadges: {
    display: "flex",
    gap: "var(--space-3)",
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-1)",
    padding: "var(--space-1) var(--space-3)",
    borderRadius: "var(--radius-pill)",
    fontSize: "12px",
    fontWeight: 600,
    backgroundColor: "var(--accent-surface)",
    border: "none",
    color: "var(--primary)",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "var(--space-5)",
  },
  baseCard: {
    position: "relative",
    textAlign: "left",
    border: "none",
    backgroundColor: "var(--control-bg)",
    borderRadius: "var(--section-card-radius)",
    padding: "var(--space-6)",
    boxShadow: "none",
    cursor: "pointer",
    transition: "transform 0.2s ease, background-color 0.2s ease",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    transform: "translateY(0)",
  },
  baseCardHover: {
    transform: "translateY(-3px)",
    boxShadow: "none",
    backgroundColor: "var(--control-bg-hover)",
  },
};

export const popupOverlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: palette.overlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(10px, 2.5vw, 20px)",
  zIndex: 9999,
  overflowY: "auto",
  overscrollBehavior: "contain",
};

export const popupCardStyles = {
  width: "min(640px, 100%)",
  maxWidth: "calc(100vw - clamp(10px, 2.5vw, 20px) * 2)",
  maxHeight: "calc(100dvh - clamp(10px, 2.5vw, 20px) * 2)",
  background: palette.modalGradient,
  borderRadius: radii.xl,
  border: `1px solid ${palette.border}`,
  boxShadow: "none",
  color: palette.textPrimary,
  overflowY: "auto",
  overscrollBehavior: "contain",
};

export const appShellTheme = {
  palette,
  radii,
  shadows,
  light: {
    background: "var(--accent-base)",
    mainBg: "var(--accent-base)",
    sidebarBg: "var(--accent-base)",
    sidebarBorder: "var(--border)",
    sidebarText: "var(--text-primary)",
    accent: "var(--accent-strong)",
    headerBg: "var(--accent-base)",
    cardBg: "var(--surface)",
    text: "var(--text-primary)",
    mutedText: "var(--text-secondary)",
  },
  dark: {
    background: "var(--accent-base)",
    mainBg: "var(--accent-base)",
    sidebarBg: "var(--accent-base)",
    sidebarBorder: "var(--border)",
    sidebarText: "var(--text-primary)",
    accent: "var(--accent-strong)",
    headerBg: "var(--accent-base)",
    cardBg: "var(--surface)",
    text: "var(--text-primary)",
    mutedText: "var(--text-secondary)",
  },
};

const appTheme = {
  palette,
  radii,
  shadows,
};

export default appTheme;
