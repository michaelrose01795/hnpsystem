// file location: src/styles/appTheme.js 
// Centralised styling tokens for the VHC workspace and broader app shell.

const palette = {
  accent: "var(--primary)",
  accentHover: "var(--primary-dark)",
  accentSoft: "var(--surface-light)",
  accentSurface: "var(--surface-light)",
  backgroundGradient: "var(--surface)",
  modalGradient: "var(--surface)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surface-light)",
  border: "var(--border)",
  textPrimary: "var(--text-primary)",
  textMuted: "var(--text-secondary)",
  overlay: "var(--overlay)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

const radii = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "24px",
  pill: "999px",
};

const shadows = {
  sm: "0 4px 12px rgba(var(--shadow-rgb), 0.08)",
  md: "0 8px 20px rgba(var(--shadow-rgb), 0.12)",
  lg: "0 16px 36px rgba(var(--shadow-rgb), 0.16)",
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
    color: "var(--grey-accent-dark)",
    border: "var(--border)",
  },
};

export const createVhcButtonStyle = (variant = "primary", { disabled = false } = {}) => {
  const base = {
    padding: "12px 24px",
    borderRadius: radii.pill,
    fontSize: "14px",
    fontWeight: "600",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
    boxShadow: disabled ? "none" : shadows.sm,
  };

  if (variant === "secondary") {
    return {
      ...base,
      backgroundColor: palette.surface,
      color: palette.accent,
      border: `1px solid ${palette.accent}`,
    };
  }

  if (variant === "ghost") {
    return {
      ...base,
      backgroundColor: "transparent",
      color: palette.accent,
      border: `1px solid ${palette.border}`,
      boxShadow: "none",
    };
  }

  return {
    ...base,
    backgroundColor: disabled ? "var(--surface-light)" : palette.accent,
    color: disabled ? palette.textMuted : "var(--text-inverse)",
  };
};

export const vhcLayoutStyles = {
  page: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "12px 16px",
    gap: "16px",
    background: palette.backgroundGradient,
  },
  headerCard: {
    background: palette.modalGradient,
    border: `1px solid ${palette.border}`,
    borderRadius: radii.xl,
    padding: "24px",
    boxShadow: shadows.sm,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  headerTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px",
  },
  headerTitleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  headerTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: palette.accent,
    margin: 0,
  },
  headerSubtitle: {
    fontSize: "14px",
    color: palette.textMuted,
    margin: 0,
  },
  progressWrapper: {
    minWidth: "220px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  progressLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: palette.textMuted,
  },
  progressTrack: {
    width: "100%",
    height: "10px",
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    background: "var(--primary)",
    transition: "width 0.3s ease",
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "16px",
  },
  metaItem: {
    backgroundColor: palette.accentSurface,
    borderRadius: radii.lg,
    padding: "16px",
    border: `1px solid ${palette.border}`,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  metaLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "var(--danger-dark)",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: "16px",
    fontWeight: "600",
    color: palette.textPrimary,
  },
  mainCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "24px",
    borderRadius: "24px",
    border: `1px solid ${palette.border}`,
    background: "var(--surface)",
    boxShadow: shadows.sm,
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: palette.accent,
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: "13px",
    color: palette.textMuted,
    margin: 0,
  },
  sectionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  sectionCard: {
    position: "relative",
    textAlign: "left",
    border: `1px solid ${palette.border}`,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: "20px",
    boxShadow: shadows.sm,
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionCardHover: {
    transform: "translateY(-3px)",
    boxShadow: shadows.md,
    borderColor: palette.accent,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: palette.textPrimary,
    margin: 0,
  },
  cardSubtitle: {
    fontSize: "13px",
    color: palette.textMuted,
    margin: 0,
    lineHeight: 1.4,
  },
  badge: {
    alignSelf: "flex-start",
    padding: "4px 12px",
    borderRadius: radii.pill,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    border: "1px solid transparent",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    justifyContent: "flex-end",
    paddingTop: "12px",
    borderTop: `2px solid ${palette.border}`,
  },
};

export const vhcModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: palette.overlay,
    backdropFilter: "blur(10px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1100,
    padding: "24px",
  },
  container: ({ width = "1080px", height = "640px" } = {}) => ({
    width,
    maxWidth: "96vw",
    height,
    maxHeight: "92vh",
    background: palette.modalGradient,
    borderRadius: radii.xl,
    border: `1px solid ${palette.border}`,
    boxShadow: shadows.lg,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  }),
  header: {
    padding: "20px 24px 12px",
    borderBottom: `1px solid ${palette.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  },
  headerTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: palette.accent,
    margin: 0,
  },
  headerSubtitle: {
    fontSize: "13px",
    color: palette.textMuted,
    margin: 0,
  },
  body: {
    flex: 1,
    padding: "20px 24px 24px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minHeight: 0,
  },
  footer: {
    padding: "16px 24px",
    borderTop: `1px solid ${palette.border}`,
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    backgroundColor: palette.surface,
  },
};

export const vhcModalContentStyles = {
  contentWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    minHeight: 0,
  },
  summaryCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: radii.lg,
    border: `1px solid ${palette.border}`,
    background: palette.accentSurface,
    boxShadow: "0 6px 16px rgba(var(--primary-rgb),0.12)",
  },
  summaryTextBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
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
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: radii.pill,
    fontSize: "12px",
    fontWeight: 600,
    backgroundColor: palette.accentSurface,
    border: `1px solid ${palette.border}`,
    color: palette.accent,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "18px",
  },
  baseCard: {
    position: "relative",
    textAlign: "left",
    border: `1px solid ${palette.border}`,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: "20px",
    boxShadow: shadows.sm,
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    transform: "translateY(0)",
  },
  baseCardHover: {
    transform: "translateY(-3px)",
    boxShadow: shadows.md,
    borderColor: palette.accent,
  },
};

export const popupOverlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(8, 9, 14, 0.78)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1200,
};

export const popupCardStyles = {
  width: "min(640px, 100%)",
  maxHeight: "90vh",
  background: palette.modalGradient,
  borderRadius: radii.xl,
  border: `1px solid ${palette.border}`,
  boxShadow: "0 28px 68px rgba(var(--shadow-rgb), 0.28)",
  color: palette.textPrimary,
  overflowY: "auto",
};

export const appShellTheme = {
  palette,
  radii,
  shadows,
  light: {
    background: "var(--surface)",
    mainBg: "var(--surface)",
    sidebarBg: "var(--surface-light)",
    sidebarBorder: "var(--border)",
    sidebarText: "var(--text-primary)",
    accent: "var(--primary)",
    headerBg: "var(--surface)",
    cardBg: "var(--surface-light)",
    text: "var(--text-primary)",
    mutedText: "var(--text-secondary)",
  },
  dark: {
    background: "var(--background)",
    mainBg: "var(--background)",
    sidebarBg: "var(--surface)",
    sidebarBorder: "var(--border)",
    sidebarText: "var(--text-primary)",
    accent: "var(--primary)",
    headerBg: "var(--surface-light)",
    cardBg: "var(--surface)",
    text: "var(--text-primary)",
    mutedText: "var(--text-secondary)",
  },
};

export default {
  palette,
  radii,
  shadows,
};
