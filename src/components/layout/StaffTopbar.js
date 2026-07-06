// file location: src/components/layout/StaffTopbar.js
// Staff app top bar (desktop). Extracted verbatim from StaffLayout during the
// layout cleanup so the very large layout shell no longer owns the topbar JSX.
//
// Presentational: all data + handlers arrive as props from StaffLayout, which
// remains the single owner of layout state (viewport, mode, status, clocking).
// The parent renders this only when the chrome is visible (`!hideSidebar`).
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import GlobalSearch from "@/components/GlobalSearch";
import NextActionPrompt from "@/components/popups/NextActionPrompt";
import SupportControl from "@/components/support/SupportControl";
import { DropdownField } from "@/components/ui/dropdownAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useRotatingViews } from "@/hooks/useRotatingViews";

// Visually-hidden style for the screen-reader-only notification live region.
const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// Single-line truncation for the identity text so a long role label / status /
// name never wraps and grows the fixed-height bar. Applied to the role line and
// the status line; normal-length copy is unaffected (ellipsis only triggers when
// it would otherwise overflow).
const IDENTITY_TRUNCATE = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function StaffTopbar({
  isMobile,
  isTablet,
  isVerticalPhone,
  lockChromeInteraction = {},
  colors,
  // Identity (computed centrally in StaffLayout): the user's primary role label
  // and the reusable live department status line. The bar just renders them.
  primaryRoleLabel = "Staff",
  // Rotating status line (Phase 2.1/2.2/2.6): summary → KPIs → insights.
  statusViews = [],
  // Role-aware notifications (Phase 2.7): { items, high, count, top }.
  notifications = null,
  isTech,
  status,
  presentationShell = false,
  currentJob,
  onStartJob,
  onStatusChange,
  navigationItems,
  userRoles = [],
  // Configurable role-specific quick actions (Phase 2.4), resolved in StaffLayout.
  quickActions = [],
  // Continue-Where-You-Left-Off (Phase 2.3): the resume target or null.
  resumeItem = null,
  // Pinned shortcuts (Phase 2.5).
  pins = [],
  onTogglePin,
  isPinned,
  currentPageItem = null,
  canPin = false,
  overlay = false,
  // Bubbled up so StaffLayout can lock the auto-hide topbar open while the global
  // search is in use (focused or its results list showing).
  onSearchActiveChange,
  // Auto-hide/fold geometry is owned by StaffLayout (via useAutoHideTopbar) so
  // the page card can react to the bar's folded state. The refs + computed
  // styles arrive here as props; this component is purely presentational.
  wrapperRef = null,
  barRef = null,
  wrapperStyle = undefined,
  barStyle = undefined,
}) {
  const router = useRouter();
  const resolvedQuickActions = Array.isArray(quickActions) ? quickActions : [];
  const resolvedPins = Array.isArray(pins) ? pins : [];

  // Rotating status line — pauses on hover/focus; content-only, no size change.
  const rotating = useRotatingViews(statusViews);
  const statusLine = rotating.current || "";
  const summaryLine = statusViews[0] || ""; // stable line for the aria-label
  const notificationMessage = notifications?.top?.message || null;
  const notificationCount = notifications?.count || 0;

  const isActionHref = (href) =>
    router.pathname === href || router.pathname.startsWith(`${href}/`);

  const showPinToggle = canPin && Boolean(currentPageItem) && typeof onTogglePin === "function";
  const currentPinned =
    showPinToggle && typeof isPinned === "function" ? isPinned(currentPageItem.href) : false;

  const hasStrip =
    isTech ||
    resolvedQuickActions.length > 0 ||
    resolvedPins.length > 0 ||
    Boolean(resumeItem) ||
    showPinToggle;

  // Shared style for every action group in the centre strip (Phase 2.8 cleanup).
  const actionGroupStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: isVerticalPhone ? "flex-start" : "center",
    gap: isMobile ? "8px" : "12px",
    flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
    width: isVerticalPhone ? "max-content" : isTablet ? "100%" : undefined,
    minWidth: 0,
  };

  // Fixed-card scroll model: the bar overlays the top of the page card (aligned
  // to the card's gutters) and stays put while the card's content scrolls behind
  // it. Outside that model it keeps its in-flow / window-scroll-float behaviour.
  const overlayStyle = overlay
    ? {
        position: "absolute",
        top: "var(--page-gutter-y)",
        left: "var(--page-gutter-x)",
        right: "var(--page-gutter-x)",
        zIndex: 3300,
      }
    : {};

  return (
    <div
      ref={wrapperRef}
      className="app-topbar-dock"
      style={{ overflow: "visible", ...wrapperStyle, ...overlayStyle }}
    >
    <DevLayoutSection
      as="section"
      ref={barRef}
      sectionKey="app-layout-topbar"
      parentKey="app-layout-main-column"
      sectionType="toolbar"
      shell
      backgroundToken="app-topbar-shell"
      className="app-topbar-shell"
      {...lockChromeInteraction}
      style={{
        // Solid surface topbar shell (pre-glass design).
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        border: "none",
        boxShadow: "none",
        padding: isMobile ? "10px 12px" : "0 16px",
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "8px" : "12px",
        minHeight: isMobile ? "auto" : "75px",
        justifyContent: "center",
        overflow: "visible",
        // Float-on-scroll positioning (desktop): fixes the bar in place, mirrors
        // the in-flow spacer's geometry and drives the fold-away animation.
        // Empty (undefined) while docked, so the bar keeps its normal flow.
        ...(barStyle || {}),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: !isTablet ? "minmax(0, 1fr) auto minmax(0, 1fr)" : "1fr",
          alignItems: "center",
          gap: isMobile ? "10px" : "14px",
          overflow: "visible",
          width: "100%",
        }}
      >
        {/* Left identity block: current role + contextual department status.
            Hidden on tablet/mobile (identity is surfaced via the sidebar Profile
            button there), same as the greeting it replaces. `minWidth: 0` lets
            long text truncate instead of pushing the centred action strip. */}
        {!isTablet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minWidth: 0,
              flex: "0 1 auto",
            }}
          >
            <div
              aria-label={
                summaryLine
                  ? `Signed in as ${primaryRoleLabel}. ${summaryLine}.`
                  : `Signed in as ${primaryRoleLabel}.`
              }
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "4px",
                minWidth: 0,
              }}
            >
              <h1
                title={primaryRoleLabel}
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  margin: 0,
                  color: colors.accent,
                  lineHeight: 1.1,
                  ...IDENTITY_TRUNCATE,
                }}
              >
                {primaryRoleLabel}
              </h1>
              {statusLine && (
                <div
                  onMouseEnter={rotating.pause}
                  onMouseLeave={rotating.resume}
                  onFocus={rotating.pause}
                  onBlur={rotating.resume}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    minWidth: 0,
                    maxWidth: "100%",
                  }}
                >
                  <span
                    title={statusLine}
                    style={{
                      color: colors.mutedText,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      ...IDENTITY_TRUNCATE,
                    }}
                  >
                    {statusLine}
                  </span>
                </div>
              )}
              {/* Role-aware notifications (Phase 2.7): announced to assistive
                  tech without any visual change to the bar. */}
              {notificationMessage && (
                <span role="status" aria-live="polite" style={SR_ONLY}>
                  {`${notificationCount} notification${notificationCount === 1 ? "" : "s"}: ${notificationMessage}`}
                </span>
              )}
            </div>
          </div>
        )}

        {hasStrip && (
          <div
            className="app-topbar-action-scroll"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isVerticalPhone ? "flex-start" : "center",
              gap: isMobile ? "8px" : "12px",
              whiteSpace: isVerticalPhone ? "nowrap" : isTablet ? "normal" : "nowrap",
              flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
              width: isTablet ? "100%" : undefined,
              minWidth: 0,
              maxWidth: "100%",
              zIndex: 2,
              justifySelf: "center",
              // Desktop/tablet controls need visible overflow so their
              // dropdowns/menus are not shaved off by the action strip.
              // Vertical phone keeps its horizontal scroll behaviour.
              overflowX: isVerticalPhone ? "auto" : "visible",
              overflowY: isVerticalPhone ? "hidden" : "visible",
            }}
          >
            {/* Technician workflow controls — preserved exactly (Phase 2.4). */}
            {isTech && (
              <div className="app-topbar-action-group" style={actionGroupStyle}>
                <DropdownField
                  className="app-topbar-dropdown app-topbar-dropdown--status"
                  value={presentationShell ? "Waiting for Job" : status}
                  onChange={(e) => {
                    if (presentationShell) return; // demo deck — don't mutate real session
                    onStatusChange(e.target.value);
                  }}
                >
                  <option>Waiting for Job</option>
                  <option>In Progress</option>
                  <option>Tea Break</option>
                </DropdownField>
                {!presentationShell && currentJob?.jobNumber ? (
                  <Link
                    href={`/tech/${currentJob.jobNumber}`}
                    prefetch={false}
                    className="app-btn app-btn--primary"
                  >
                    {`Open Job ${currentJob.jobNumber}`}
                  </Link>
                ) : (
                  <button type="button" disabled className="app-btn app-btn--secondary">
                    No Current Job
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (presentationShell) return;
                    onStartJob();
                  }}
                  className="app-btn app-btn--secondary"
                >
                  Start Job
                </button>
              </div>
            )}

            {/* Continue Where You Left Off (Phase 2.3). */}
            {resumeItem && (
              <div className="app-topbar-action-group" style={actionGroupStyle}>
                <Link
                  href={resumeItem.href}
                  prefetch={false}
                  className="app-btn app-btn--secondary"
                  title={`Resume ${resumeItem.type}: ${resumeItem.label}`}
                >
                  {`Resume: ${resumeItem.label}`}
                </Link>
              </div>
            )}

            {/* Configurable role-specific quick actions (Phase 2.4). */}
            {resolvedQuickActions.length > 0 && (
              <div className="app-topbar-action-group" style={actionGroupStyle}>
                {resolvedQuickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    prefetch={false}
                    className={`app-btn app-btn--secondary${isActionHref(action.href) ? " is-active" : ""}`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Pinned shortcuts + pin-this-page toggle (Phase 2.5). */}
            {(resolvedPins.length > 0 || showPinToggle) && (
              <div className="app-topbar-action-group" style={actionGroupStyle}>
                {resolvedPins.map((pin) => (
                  <Link
                    key={pin.href}
                    href={pin.href}
                    prefetch={false}
                    className={`app-btn app-btn--secondary${isActionHref(pin.href) ? " is-active" : ""}`}
                    title={pin.label}
                  >
                    {pin.label}
                  </Link>
                ))}
                {showPinToggle && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(currentPageItem)}
                    className="app-btn app-btn--ghost"
                    aria-pressed={currentPinned}
                    aria-label={currentPinned ? "Unpin this page" : "Pin this page"}
                    title={currentPinned ? "Unpin this page" : "Pin this page"}
                  >
                    {currentPinned ? "★" : "☆"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hide search section on tablet/mobile - shown below tab buttons instead */}
        {!isTablet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              minWidth: 0,
              justifyContent: "flex-end",
              marginLeft: "auto",
              justifySelf: "end",
            }}
          >
            <div
              style={{
                flex: "0 1 auto",
                minWidth: "22ch",
                width: "clamp(18rem, 20vw, 24rem)",
                maxWidth: "24rem",
                position: "relative",
              }}
            >
              <GlobalSearch
                accentColor={colors.accent}
                navigationItems={navigationItems}
                onActiveChange={onSearchActiveChange}
              />
            </div>

            <div
              style={{
                flexShrink: 0,
              }}
            >
              <NextActionPrompt />
            </div>

            {/* Help & Diagnostics ("?") — hidden in the presentation deck so the
                demo shell doesn't file real reports. */}
            {!presentationShell && (
              <div style={{ flexShrink: 0 }}>
                <SupportControl />
              </div>
            )}

            {userRoles.includes("admin manager") && (
              <Link
                href="/admin/users"
                prefetch={false}
                className="app-btn app-btn--primary"
              >
                Create User
              </Link>
            )}
          </div>
        )}
      </div>
    </DevLayoutSection>
    </div>
  );
}
