// file location: src/components/layout/StaffTopbar.js
// Staff app top bar (desktop). Extracted verbatim from StaffLayout during the
// layout cleanup so the very large layout shell no longer owns the topbar JSX.
//
// Presentational: all data + handlers arrive as props from StaffLayout, which
// remains the single owner of layout state (viewport, mode, status, clocking).
// The parent renders this only when the chrome is visible (`!hideSidebar`).
//
// 2026-07 layout refinement: the bar was simplified. The Role & Department
// identity block, the Pinned Shortcuts strip and the standalone (screen-reader)
// Notifications region were removed. The remaining capability is laid out, left
// to right, as: Live KPI Widgets → Role-specific Quick Actions (incl. all
// technician controls) → Smart Insight → Continue Where You Left Off → Global
// Search & Help. Height, styling, spacing, tokens and the shell are unchanged;
// only the content and its ordering/width balance moved.
import React from "react";
import Link from "next/link";
import GlobalSearch from "@/components/GlobalSearch";
import NextActionPrompt from "@/components/popups/NextActionPrompt";
import SupportControl from "@/components/support/SupportControl";
import { DropdownField } from "@/components/ui/dropdownAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useRotatingViews } from "@/hooks/useRotatingViews";

// Single-line truncation so a long KPI label or insight never wraps and grows the
// fixed-height bar. Ellipsis only triggers when the text would otherwise overflow.
const TEXT_TRUNCATE = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// Splits a live prompt like "225 VHCs awaiting approval" or "3 jobs overdue —
// needs chasing" into a leading count + trailing label so the Smart Insight can
// use the same stacked count widget as the KPIs. No leading number → whole string
// is the label with no count.
function splitCountLabel(text) {
  const s = (text || "").trim();
  const match = s.match(/^(\d[\d,]*)\s+(.+)$/);
  if (match) return { count: match[1], label: match[2] };
  return { count: null, label: s };
}

// Compact stacked "status count" widget: label on top, count underneath. Two
// short lines fit comfortably inside the bar's fixed height (no height change),
// and stacking keeps each item narrow so several sit side by side without the
// text being clipped. Shared by the Live KPI and Smart Insight sections.
function StatWidget({ label, count, colors, truncate = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1px",
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <span
        title={label}
        style={{
          fontSize: "0.6rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: colors.mutedText,
          lineHeight: 1.15,
          textAlign: "center",
          ...(truncate ? TEXT_TRUNCATE : { whiteSpace: "nowrap" }),
        }}
      >
        {label}
      </span>
      {count != null && count !== "" && (
        <span
          style={{
            fontSize: "1.05rem",
            fontWeight: 700,
            lineHeight: 1,
            color: colors.accent,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export default function StaffTopbar({
  isMobile,
  isTablet,
  isVerticalPhone,
  lockChromeInteraction = {},
  colors,
  // Live KPI widgets (Phase 2.2): resolved descriptors { key, label, value }.
  // Rendered as compact stat widgets in the leftmost section.
  kpis = [],
  // Smart Insight prompts (Phase 2.6): ordered strings rotated in their section.
  insightViews = [],
  isTech,
  status,
  presentationShell = false,
  currentJob,
  onStartJob,
  onStatusChange,
  navigationItems,
  userRoles = [],
  // Continue-Where-You-Left-Off (Phase 2.3): the resume target or null.
  resumeItem = null,
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
  const resolvedKpis = Array.isArray(kpis) ? kpis : [];

  // Smart Insight rotates through the applicable prompts — pauses on hover/focus,
  // content-only, no size change. The current prompt is split into count + label
  // so it renders in the same stacked stat widget as the KPIs.
  const rotating = useRotatingViews(insightViews);
  const insight = splitCountLabel(rotating.current || "");

  // Shared style for the technician workflow control group.
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
          display: "flex",
          alignItems: "center",
          // Gaps grow with the viewport so the sections breathe on wide screens
          // and tighten (without crowding) as the bar narrows.
          gap: isMobile ? "10px" : isTablet ? "12px" : "clamp(14px, 1.6vw, 32px)",
          width: "100%",
          flexWrap: isTablet ? "wrap" : "nowrap",
          overflow: "visible",
        }}
      >
        {/* 1 — Live KPI Widgets (Phase 2.2), from real operational metrics.
            Desktop-only, like the identity line it replaces. Each KPI is a stacked
            count widget (label over count) so the full text always fits. */}
        {!isTablet && resolvedKpis.length > 0 && (
          <div
            aria-label="Live operational KPIs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(12px, 1.4vw, 22px)",
              flex: "1 1 0",
              minWidth: 0,
              overflow: "hidden",
              flexWrap: "nowrap",
            }}
          >
            {resolvedKpis.map((kpi) => (
              <StatWidget key={kpi.key} label={kpi.label} count={kpi.value} colors={colors} />
            ))}
          </div>
        )}

        {/* 2 — Technician workflow controls (Phase 2.4), preserved verbatim for
            the tech role. The old role-specific quick-action links (Create Job
            Card, Appointments, parts actions, …) were removed from the bar — they
            remain reachable via the command palette. Centre-weighted; on tablet it
            spans the full row and scrolls horizontally on a vertical phone. */}
        {isTech && (
          <div
            className="app-topbar-action-scroll"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isVerticalPhone ? "flex-start" : "center",
              gap: isMobile ? "8px" : "12px",
              flexWrap: isVerticalPhone ? "nowrap" : isTablet ? "wrap" : "nowrap",
              // Sized to its content on desktop but allowed to shrink so the
              // flexible KPI/insight sections keep filling the bar; full-row on
              // tablet.
              flex: isTablet ? "1 1 100%" : "0 1 auto",
              width: isTablet ? "100%" : undefined,
              minWidth: 0,
              maxWidth: "100%",
              zIndex: 2,
              // Desktop/tablet controls need visible overflow so their
              // dropdowns/menus are not shaved off. Vertical phone keeps its
              // horizontal scroll behaviour.
              overflowX: isVerticalPhone ? "auto" : "visible",
              overflowY: isVerticalPhone ? "hidden" : "visible",
            }}
          >
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
          </div>
        )}

        {/* 3 — Smart Insight (Phase 2.6), from real operational metrics. Desktop-
            only; rotates through the applicable prompts and renders in the same
            stacked count widget as the KPIs (label over count). */}
        {!isTablet && insight.label && (
          <div
            onMouseEnter={rotating.pause}
            onMouseLeave={rotating.resume}
            onFocus={rotating.pause}
            onBlur={rotating.resume}
            aria-label={`Smart insight: ${rotating.current}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "1 1 0",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <StatWidget label={insight.label} count={insight.count} colors={colors} truncate />
          </div>
        )}

        {/* 4 — Continue Where You Left Off (Phase 2.3). Its own section now, after
            Smart Insight; on tablet it wraps to the next row under the actions. */}
        {resumeItem && (
          <div
            className="app-topbar-action-group"
            style={{
              ...actionGroupStyle,
              flex: isTablet ? "1 1 100%" : "0 1 auto",
              minWidth: 0,
            }}
          >
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

        {/* 5 — Global Search & Help. Hidden on tablet/mobile (search is shown
            below the tab buttons there). Pinned to the far right of the bar. */}
        {!isTablet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              // Internal gap scales with the viewport, like the outer row.
              gap: "clamp(12px, 1.2vw, 24px)",
              minWidth: 0,
              justifyContent: "flex-end",
              // Sits hard-right and can shrink; the KPI/insight sections growing
              // to fill the freed space push it to the edge (no margin hack).
              flex: "0 1 auto",
            }}
          >
            <div
              style={{
                // Search field flexes with the bar: a comfortable basis that
                // grows on wide screens and shrinks (never below usable) as the
                // bar narrows.
                flex: "1 1 auto",
                minWidth: 0,
                width: "clamp(15rem, 20vw, 26rem)",
                maxWidth: "26rem",
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
