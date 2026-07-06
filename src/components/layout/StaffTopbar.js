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

// Topbar-only quick-action links (previously module constants in Layout.js).
const SERVICE_ACTION_LINKS = [
  { label: "Create Job Card", href: "/new-job" },
  { label: "Appointments", href: "/job-cards/appointments" },
];

const PARTS_ACTION_LINKS = [
  { label: "Delivery/Collection Planner", href: "/delivery-planner" },
  { label: "Create Order", href: "/new-order" },
  { label: "Goods In", href: "/goods-in" },
];

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
  departmentStatus = "",
  isTech,
  canUseServiceActions,
  hasPartsAccess,
  status,
  presentationShell = false,
  currentJob,
  onStartJob,
  onStatusChange,
  navigationItems,
  userRoles = [],
  quickActions = null,
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
  const usesManifestQuickActions = Array.isArray(quickActions);
  const hasManifestQuickActions = usesManifestQuickActions && quickActions.length > 0;

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
                departmentStatus
                  ? `Signed in as ${primaryRoleLabel}. ${departmentStatus}.`
                  : `Signed in as ${primaryRoleLabel}.`
              }
              style={{
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
              {departmentStatus && (
                <div
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
                    title={departmentStatus}
                    style={{
                      color: colors.mutedText,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      ...IDENTITY_TRUNCATE,
                    }}
                  >
                    {departmentStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {(isTech || hasManifestQuickActions || (!usesManifestQuickActions && (canUseServiceActions || hasPartsAccess))) && (
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
            {isTech && (
              <div
                className="app-topbar-action-group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isVerticalPhone ? "flex-start" : "center",
                  gap: isMobile ? "8px" : "12px",
                  flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
                  width: isVerticalPhone ? "max-content" : isTablet ? "100%" : undefined,
                  minWidth: 0,
                }}
              >
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
                  <button
                    type="button"
                    disabled
                    className="app-btn app-btn--secondary"
                  >
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

            {hasManifestQuickActions && (
              <div
                className="app-topbar-action-group"
                style={{
                  display: "flex",
                  flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
                  gap: isMobile ? "8px" : "12px",
                  justifyContent: isVerticalPhone ? "flex-start" : "center",
                  alignItems: "center",
                  width: isVerticalPhone ? "max-content" : isTablet ? "100%" : undefined,
                  minWidth: 0,
                }}
              >
                {quickActions.map((action) => {
                  const active =
                    router.pathname === action.href ||
                    router.pathname.startsWith(`${action.href}/`);
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      prefetch={false}
                      className={`app-btn app-btn--secondary${active ? " is-active" : ""}`}
                    >
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {!usesManifestQuickActions && canUseServiceActions && (
              <div
                className="app-topbar-action-group"
                style={{
                  display: "flex",
                  flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
                  gap: isMobile ? "8px" : "12px",
                  justifyContent: isVerticalPhone ? "flex-start" : "center",
                  alignItems: "center",
                  width: isVerticalPhone ? "max-content" : isTablet ? "100%" : undefined,
                  minWidth: 0,
                }}
              >
                {SERVICE_ACTION_LINKS.map((action) => {
                  const active =
                    router.pathname === action.href ||
                    router.pathname.startsWith(`${action.href}/`);
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      prefetch={false}
                      className={`app-btn app-btn--secondary${active ? " is-active" : ""}`}
                    >
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {!usesManifestQuickActions && hasPartsAccess && (
              <div
                className="app-topbar-action-group"
                style={{
                  display: "flex",
                  flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
                  gap: isMobile ? "8px" : "12px",
                  justifyContent: isVerticalPhone ? "flex-start" : "center",
                  alignItems: "center",
                  textAlign: "center",
                  width: isVerticalPhone ? "max-content" : isTablet ? "100%" : undefined,
                  minWidth: 0,
                }}
              >
                {PARTS_ACTION_LINKS.map((action) => {
                  const active =
                    router.pathname === action.href ||
                    router.pathname.startsWith(`${action.href}/`);
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      prefetch={false}
                      className={`app-btn app-btn--secondary${active ? " is-active" : ""}`}
                    >
                      {action.label}
                    </Link>
                  );
                })}
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
