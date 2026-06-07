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
import { DropdownField } from "@/components/ui/dropdownAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import useAutoHideTopbar from "@/hooks/useAutoHideTopbar";

// Topbar-only quick-action links (previously module constants in Layout.js).
const SERVICE_ACTION_LINKS = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
];

const PARTS_ACTION_LINKS = [
  { label: "Delivery/Collection Planner", href: "/parts/delivery-planner" },
  { label: "Create Order", href: "/parts/create-order" },
  { label: "Goods In", href: "/parts/goods-in" },
];

export default function StaffTopbar({
  isMobile,
  isTablet,
  isVerticalPhone,
  lockChromeInteraction = {},
  firstName,
  availableModes = [],
  selectedMode,
  activeModeLabel,
  onModeSelect,
  colors,
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
  overlay = false,
}) {
  const router = useRouter();

  // Auto-hide / float-on-scroll is a desktop-only affordance. On tablet/mobile
  // the topbar keeps its existing in-flow behaviour (and the portrait z-index
  // rules in staffglobal.css), so we gate the hook to desktop widths. In the
  // fixed-card model (`overlay`) the page no longer scrolls, so we disable the
  // window-scroll hook and instead pin the bar as an always-visible overlay over
  // the card's top — the card's inner content scrolls up behind it.
  const enableAutoHide = !isTablet && !overlay;
  const { wrapperRef, barRef, wrapperStyle, barStyle } = useAutoHideTopbar({
    enabled: enableAutoHide,
  });

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
      style={{ ...wrapperStyle, ...overlayStyle }}
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
        // Frosted-glass topbar: a soft white scrim + backdrop blur so the
        // search / controls never sit on the raw background gradient (matches
        // .app-topbar-shell in staffglobal.css).
        background: "var(--shell-glass-bg)",
        backdropFilter: "var(--shell-glass-blur)",
        WebkitBackdropFilter: "var(--shell-glass-blur)",
        borderRadius: "var(--radius-md)",
        border: "none",
        // Section-defining ring (matches .app-topbar-shell) — a soft frosted edge.
        boxShadow: "var(--shell-section-ring)",
        padding: isMobile ? "10px 12px" : "0 16px",
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "8px" : "12px",
        minHeight: isMobile ? "auto" : "75px",
        justifyContent: "center",
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
        {/* Hide Welcome back and mode section on tablet/mobile */}
        {!isTablet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minWidth: "auto",
              flex: "0 0 auto",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "4px",
              }}
            >
              <h1
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  margin: 0,
                  color: colors.accent,
                  lineHeight: 1.1,
                }}
              >
                Welcome {firstName}
              </h1>
              {availableModes.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: colors.mutedText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Mode:
                  </span>
                  {availableModes.length > 1 ? (
                    <DropdownField
                      className="app-topbar-dropdown app-topbar-dropdown--mode"
                      value={selectedMode || activeModeLabel || ""}
                      onChange={(event) => onModeSelect(event.target.value)}
                    >
                      {availableModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </DropdownField>
                  ) : (
                    <span
                      style={{
                        color: colors.accent,
                        fontWeight: 600,
                      }}
                    >
                      {activeModeLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {(isTech || canUseServiceActions || hasPartsAccess) && (
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
              // Desktop: `clip` keeps the row from overflowing horizontally
              // (no scrollbar) while letting the buttons' liquid-glass focus/
              // hover glow bleed vertically instead of being shaved off by an
              // invisible clipping box. overflow-clip-margin gives the end
              // buttons' glow a little horizontal room too. Vertical phone keeps
              // its horizontal scroll behaviour unchanged.
              overflowX: isVerticalPhone ? "auto" : "clip",
              overflowY: isVerticalPhone ? "hidden" : "visible",
              overflowClipMargin: isVerticalPhone ? undefined : "24px",
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
                    href={`/job-cards/myjobs/${currentJob.jobNumber}`}
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

            {canUseServiceActions && (
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

            {hasPartsAccess && (
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
              <GlobalSearch accentColor={colors.accent} navigationItems={navigationItems} />
            </div>

            <div
              style={{
                flexShrink: 0,
              }}
            >
              <NextActionPrompt />
            </div>

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
