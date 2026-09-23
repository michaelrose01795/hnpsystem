// file location: src/components/Deliveries/deliveryStyles.js
//
// Layout geometry for the delivery diary.
//
// Everything visual — surfaces, badges, buttons, tables, inputs, empty states —
// comes from the shared staff system (LayerSurface/LayerTheme, .app-badge--*,
// .app-btn, .app-summary-*, .app-empty-state, .app-input, DropdownField). This
// module holds only the grid/flex geometry those shared pieces are arranged in,
// expressed in design tokens, kept in one place so the header, the row, the
// detail panel and the route panel line up.
//
// No colour, font or radius is invented here; where a token is referenced it is
// an existing one from theme.css.

// NOTE on flexDirection: LayerSurface and LayerTheme set `flexDirection:
// "column"` on their own base style and spread the consumer's `style` over it.
// A style object here that means "a row" must therefore say so explicitly —
// omitting it inherits the column, which silently stacks a toolbar and turns a
// `flex: 1 1 320px` basis into 320px of vertical dead space.

// A stop is a drag handle plus everything else. The information cells inside
// "everything else" are an auto-fit grid rather than fixed tracks: with the
// detail panel open the list column is only ~600px wide, and fixed minimums
// overflowed the card into the panel.
export const DELIVERY_ROW_COLUMNS = "44px minmax(0, 1fr)";

export const deliveryStyles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--page-stack-gap)",
    width: "100%",
    minWidth: 0,
  },

  // --- day header -----------------------------------------------------------
  headerCard: {
    gap: "var(--space-sm)",
  },
  headerTopRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-sm)",
    width: "100%",
    minWidth: 0,
  },
  deliverySummaryRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "var(--space-sm)",
    width: "100%",
    minWidth: 0,
  },
  // The day controls row now lives in staffglobal.css as
  // .app-delivery-day-controls — the previous/next stepper was removed and the
  // month picker is the only day control.
  dayLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: "0 0 auto",
    minWidth: 0,
  },
  viewControls: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "var(--space-sm)",
    flexWrap: "nowrap",
    flex: "0 0 auto",
    minWidth: 0,
  },

  // --- filter toolbar -------------------------------------------------------
  filterRow: {
    display: "grid",
    gridTemplateColumns: "minmax(200px, 2fr) repeat(3, minmax(150px, 1fr)) auto auto",
    gap: "var(--space-sm)",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
  },
  filterRowMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "var(--space-sm)",
    width: "100%",
  },

  // --- list / detail split --------------------------------------------------
  workspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)",
    gap: "var(--page-stack-gap)",
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },
  workspaceStacked: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "var(--page-stack-gap)",
    width: "100%",
    minWidth: 0,
  },
  listCard: {
    gap: "var(--space-sm)",
    minWidth: 0,
  },
  listScroll: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    width: "100%",
    minWidth: 0,
  },

  // --- a route row ----------------------------------------------------------
  rowGrid: {
    display: "grid",
    gridTemplateColumns: DELIVERY_ROW_COLUMNS,
    gap: "var(--space-sm)",
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },
  rowBody: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-sm)",
    minWidth: 0,
    width: "100%",
  },
  rowCells: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "var(--space-sm)",
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },
  rowCellsStacked: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "var(--space-sm)",
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  cellInline: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "var(--space-sm)",
    flexWrap: "wrap",
    minWidth: 0,
  },
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  stopColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    minWidth: 0,
  },
  rowActions: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "var(--space-sm)",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  rowActionsStacked: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "var(--space-sm)",
    justifyContent: "flex-start",
    width: "100%",
  },
  badgeStrip: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "var(--space-sm)",
    alignItems: "center",
    minWidth: 0,
  },

  // --- detail panel ---------------------------------------------------------
  detailCard: {
    gap: "var(--space-2)",
    position: "sticky",
    top: "var(--space-2)",
    minWidth: 0,
  },
  detailCardStacked: {
    gap: "var(--space-2)",
    minWidth: 0,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "var(--space-sm)",
    width: "100%",
    minWidth: 0,
  },
  detailActions: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "var(--space-sm)",
    width: "100%",
  },
  detailScroll: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    maxHeight: "calc(100vh - 280px)",
    overflowY: "auto",
    minWidth: 0,
  },
  fieldStack: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-sm)",
    width: "100%",
    minWidth: 0,
  },
  fieldPair: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "var(--space-sm)",
    width: "100%",
  },
  // Item lines in the detail panel. The row rule is --separating-line, the one
  // line the border rules allow inside a list (CLAUDE.md §3.0a).
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    listStyle: "none",
    margin: 0,
    padding: 0,
    width: "100%",
    minWidth: 0,
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "center",
    columnGap: "var(--space-sm)",
    minHeight: "var(--table-action-btn-height)",
    borderBottom: "var(--separating-line)",
    minWidth: 0,
  },
  eventList: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-sm)",
    maxHeight: "220px",
    overflowY: "auto",
    minWidth: 0,
  },

  // --- route map ------------------------------------------------------------
  // The route runs the full width of the detail panel, above everything else,
  // rather than sitting behind a view switch. 4:3 gives a Kent-shaped run
  // enough height to read without pushing the stop's details off the card.
  routeMapCard: {
    width: "100%",
    minWidth: 0,
  },
  // The tile grid is absolutely positioned inside this box, so it establishes
  // the containing block and clips whatever overhangs the fitted view. The
  // background is what shows through when tiles are still loading or cannot be
  // reached — a tinted surface, never a black hole.
  routeMapViewport: {
    position: "relative",
    width: "100%",
    aspectRatio: "4 / 3",
    minHeight: "220px",
    overflow: "hidden",
    borderRadius: "var(--radius-sm)",
    background: "var(--theme)",
    isolation: "isolate",
  },
  // Markers and legs sit above the tiles in the same pixel space.
  routeMapOverlay: {
    position: "absolute",
    inset: 0,
    display: "block",
  },
  // The parts desk, marked with the brand logo instead of a labelled square.
  // Centred on its projected point by a translate rather than a negative margin
  // so the mark can be resized in one place without the offset drifting.
  routeMapOriginMark: {
    position: "absolute",
    width: "30px",
    height: "30px",
    transform: "translate(-50%, -50%)",
  },
  routeMapOriginMarkImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  // OpenStreetMap attribution, bottom-right over the tiles as the tile usage
  // policy requires. The chip keeps it legible over any map feature.
  routeMapAttribution: {
    position: "absolute",
    right: "4px",
    bottom: "4px",
    padding: "1px 6px",
    borderRadius: "var(--radius-xs)",
    background: "var(--surface)",
    color: "var(--text-1)",
    opacity: 0.78,
    fontSize: "var(--text-caption)",
    pointerEvents: "none",
  },

  // --- week strip -----------------------------------------------------------
  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "var(--space-sm)",
    width: "100%",
  },
  weekDayButton: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-start",
    width: "100%",
    minHeight: "var(--control-height)",
    cursor: "pointer",
  },

  // --- modals ---------------------------------------------------------------
  modalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    width: "min(560px, 92vw)",
    maxHeight: "82vh",
    overflowY: "auto",
    minWidth: 0,
  },
  modalBodyWide: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--layout-card-gap)",
    width: "100%",
    maxHeight: "82vh",
    overflow: "hidden",
    minWidth: 0,
  },
  modalScroll: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--page-stack-gap)",
    overflowY: "auto",
    minWidth: 0,
  },
  routeSettingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "var(--layout-card-gap)",
    width: "100%",
    minWidth: 0,
  },
  toggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-sm)",
    minHeight: "44px",
    cursor: "pointer",
  },
  modalHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "var(--space-sm)",
    width: "100%",
  },
  modalActions: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "var(--space-sm)",
    justifyContent: "flex-end",
    width: "100%",
  },
  signaturePad: {
    width: "100%",
    height: "160px",
    touchAction: "none",
    display: "block",
    cursor: "crosshair",
  },
};

// Text roles, expressed only through existing type + colour tokens. Held as
// constants rather than inline objects so the same label never renders at two
// different sizes across the page.
export const deliveryText = {
  label: {
    fontSize: "var(--text-label)",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--grey-accent)",
    lineHeight: 1.2,
  },
  value: {
    fontSize: "var(--text-body-sm)",
    fontWeight: 600,
    color: "var(--text-1)",
    lineHeight: 1.3,
  },
  valueStrong: {
    fontSize: "var(--text-body)",
    fontWeight: 700,
    color: "var(--text-1)",
    lineHeight: 1.3,
  },
  muted: {
    fontSize: "var(--text-body-sm)",
    color: "var(--text-1)",
    opacity: 0.7,
    lineHeight: 1.3,
  },
  caption: {
    fontSize: "var(--text-caption)",
    color: "var(--text-1)",
    opacity: 0.7,
    lineHeight: 1.2,
  },
  accent: {
    fontSize: "var(--text-body-sm)",
    fontWeight: 700,
    color: "var(--accentText)",
    lineHeight: 1.3,
  },
  danger: {
    fontSize: "var(--text-body-sm)",
    fontWeight: 600,
    color: "var(--danger-dark)",
    lineHeight: 1.3,
  },
  stopNumber: {
    fontSize: "var(--text-body)",
    fontWeight: 700,
    color: "var(--accentText)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  link: {
    fontSize: "var(--text-body-sm)",
    fontWeight: 600,
    color: "var(--accentText)",
    textDecoration: "none",
  },
};

export default deliveryStyles;
