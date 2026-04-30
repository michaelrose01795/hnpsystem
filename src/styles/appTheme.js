// file location: src/styles/appTheme.js
// Shared JS-facing theme aliases that point directly at the semantic CSS token system.

const palette = {
  accent: "var(--primary)",
  accentBase: "var(--secondary)",
  accentHover: "var(--primary-hover)",
  accentPressed: "var(--primary-pressed)",
  accentSoft: "var(--theme)",
  accentSurface: "var(--secondary)",
  accentSurfaceHover: "var(--secondary-hover)",
  backgroundGradient: "var(--surface)",
  modalGradient: "var(--surface)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surfaceHover)",
  surfaceMuted: "var(--surfaceMutedToken)",
  border: "var(--primary-border)",
  accentBorder: "var(--primary-border)",
  accentBorderStrong: "var(--primary-border)",
  textPrimary: "var(--text-1)",
  textMuted: "var(--text-1)",
  overlay: "var(--overlay)",
  overlayMuted: "var(--overlay-muted)",
  onAccent: "var(--onAccentText)",
  success: "var(--successMain)",
  warning: "var(--warningMain)",
  danger: "var(--dangerMain)",
  info: "var(--info)",
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
    border: "none",
  },
  inProgress: {
    label: "In Progress",
    background: "var(--warning-surface)",
    color: "var(--warning-dark)",
    border: "none",
  },
  pending: {
    label: "Not Started",
    background: "var(--surface)",
    color: "var(--text-1)",
    border: "var(--primary-border)",
  },
};

// createVhcButtonStyle() removed — VHC modals now use the global <Button> component
// (variant="primary"|"secondary"|"ghost"|"danger", size="sm"). The global Button is
// the single source of truth for button appearance; do not reintroduce per-domain
// button factories.

export const dropdownTriggerButtonStyle = {
  height: "var(--dropdown-trigger-height)",
  minHeight: "var(--dropdown-trigger-height)",
  maxHeight: "var(--dropdown-trigger-height)",
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
    borderRadius: "var(--section-card-radius)",
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
  padding: "var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px))",
  zIndex: 9999,
  overflowY: "auto",
  overscrollBehavior: "contain",
};

export const popupCardStyles = {
  width: "min(640px, 100%)",
  maxWidth: "calc(100vw - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2))",
  maxHeight: "calc(100dvh - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2))",
  background: "var(--surface)",
  borderRadius: "var(--radius-lg)",
  border: "none",
  boxShadow: "none",
  color: "var(--text-1)",
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
    sidebarBorder: "var(--primary-border)",
    sidebarText: "var(--text-1)",
    accent: "var(--accent-strong)",
    headerBg: "var(--accent-base)",
    cardBg: "var(--surface)",
    text: "var(--text-1)",
    mutedText: "var(--text-1)",
  },
  dark: {
    background: "var(--accent-base)",
    mainBg: "var(--accent-base)",
    sidebarBg: "var(--accent-base)",
    sidebarBorder: "var(--primary-border)",
    sidebarText: "var(--text-1)",
    accent: "var(--accent-strong)",
    headerBg: "var(--accent-base)",
    cardBg: "var(--surface)",
    text: "var(--text-1)",
    mutedText: "var(--text-1)",
  },
};

const appTheme = {
  palette,
  radii,
  shadows,
};

export default appTheme;
