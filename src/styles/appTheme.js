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
  border: "none",
  accentBorder: "none",
  accentBorderStrong: "none",
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
    border: "none",
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
  // `overlay` removed. VHCModalShell now renders through PopupModal, so the
  // backdrop is the canonical `.popup-backdrop` from staffglobal.css — which
  // carries the accent-tinted scrim and the 10px backdrop blur this bespoke
  // object never had. Viewport gap, z-index and scroll containment come from
  // there too.
  //
  // `container` is layout only: the popup card's surface (background, radius,
  // shadow, max-width / max-height against --popup-viewport-gap) belongs to
  // `.popup-card`.
  container: ({ width = "1080px", height = "640px" } = {}) => ({
    width,
    height,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    minHeight: 0,
    // The shell's own header / body / footer carry the modal padding and
    // spacing, so whichever surface it lands on (.popup-card in modal mode,
    // .app-section-card inline) contributes none of its own.
    padding: 0,
    gap: 0,
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
  // summaryCard / summaryTextBlock / summaryTitle / summaryMetric / summaryBadges
  // removed — they had no consumers left and re-declared the section-card surface
  // in JS. Any future summary strip uses the global `.app-section-card` class.
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "var(--space-5)",
  },
  // Layout only. The card surface — background, radius, padding, gap, shadow —
  // comes from the global `.app-section-card` class in staffglobal.css, which
  // every call site now carries. Clickable cards additionally carry `.vhc-card`
  // (src/styles/features/vhc.css) for the cursor and the hover lift, so the
  // former JS `baseCardHover` object and its onMouseEnter/Leave handlers are
  // gone: hover is a CSS concern and is now identical to the VHC section cards
  // on the job-card page.
  baseCard: {
    position: "relative",
    textAlign: "left",
  },
};

// popupOverlayStyles / popupCardStyles removed. They were a second, JS-side
// implementation of the popup chrome that staffglobal.css already owns, and
// they drifted from it: no backdrop blur, no accent tint on the scrim, and a
// card that re-declared background / radius / max-size by hand. Every consumer
// now carries the canonical `.popup-backdrop` / `.popup-card` classes (or goes
// through PopupModal in src/components/popups/popupStyleApi.js) and passes only
// geometry inline.

export const appShellTheme = {
  palette,
  radii,
  shadows,
  light: {
    background: "var(--accent-base)",
    mainBg: "var(--accent-base)",
    sidebarBg: "var(--accent-base)",
    sidebarBorder: "none",
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
    sidebarBorder: "none",
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
