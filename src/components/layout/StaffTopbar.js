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
// technician controls) → Smart Insight → Continue Where You Left Off → Most-Used
// Pages → Global Search & Help. Height, styling, spacing, tokens and the shell
// are unchanged; only the content and its ordering/width balance moved.
//
// Most-Used Pages: the Live KPI + Smart Insight "stats" no longer flex-grow apart
// — they sit together at the left. Two quick-access buttons for the user's two
// most-used pages (learned by the behaviour model) are pushed to the right, just
// before the Global Search field.
import React from "react";
import Link from "next/link";
import GlobalSearch from "@/components/GlobalSearch";
import NextActionPrompt from "@/components/popups/NextActionPrompt";
import SupportControl from "@/components/support/SupportControl";
import { DropdownField } from "@/components/ui/dropdownAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useRotatingViews } from "@/hooks/useRotatingViews";
import { formatKpiTooltip } from "@/config/topbar/departmentKpis";

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
//
// `tooltip` (optional): a richer multi-line hover string (e.g. the free techs'
// names) shown by GlobalTooltip. It's set on the widget root so hovering anywhere
// on the widget shows it; the label's own title= is suppressed when present so it
// doesn't shadow the richer tooltip (closest() would otherwise match the label).
function StatWidget({ label, count, colors, truncate = false, tooltip = null }) {
  return (
    <div
      title={tooltip || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1px",
        minWidth: 0,
        maxWidth: "100%",
        cursor: tooltip ? "help" : undefined,
      }}
    >
      <span
        title={tooltip ? undefined : label}
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
  // Most-used pages: up to two { href, label } resolved from the behaviour model.
  // Rendered as quick-access buttons on the right of the bar (desktop only).
  topPages = [],
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
    // Uniform 10px spacing between everything in the bar (symmetry).
    gap: "10px",
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
        // Uniform 10px spacing between everything in the bar (symmetry).
        gap: "10px",
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
          // Uniform 10px spacing between every section in the bar (symmetry).
          gap: "10px",
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
              // Uniform 10px spacing between each KPI widget (symmetry).
              gap: "10px",
              // Content-sized (was flex: 1 1 0) so the KPIs and the Smart Insight
              // sit together as one "stats" block at the left instead of the two
              // stretching to opposite ends of the bar.
              flex: "0 1 auto",
              minWidth: 0,
              overflow: "hidden",
              flexWrap: "nowrap",
            }}
          >
            {resolvedKpis.map((kpi) => (
              <StatWidget key={kpi.key} label={kpi.label} count={kpi.value} colors={colors} tooltip={formatKpiTooltip(kpi)} />
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
              // Uniform 10px spacing between everything in the bar (symmetry).
              gap: "10px",
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
              // Left-aligned + content-sized (was centred, flex: 1 1 0) so it sits
              // directly beside the KPIs as part of the same left "stats" block.
              justifyContent: "flex-start",
              flex: "0 1 auto",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <StatWidget
              label={insight.label}
              count={insight.count}
              colors={colors}
              truncate
              tooltip={rotating.current || null}
            />
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

        {/* 5 — Most-Used Pages + Global Search & Help. Hidden on tablet/mobile
            (search is shown below the tab buttons there). The whole cluster is
            pushed hard-right via marginLeft:auto — the "stats" sections no longer
            grow, so this replaces the previous grow-to-fill behaviour and keeps
            the bar right-aligned even before any pages are learned. */}
        {!isTablet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              // Uniform 10px spacing between everything in the bar (symmetry).
              gap: "10px",
              minWidth: 0,
              justifyContent: "flex-end",
              // Pins the cluster to the right edge. The KPI/insight/resume sections
              // are content-sized (no longer flex-grow), so an explicit auto margin
              // — not a growing neighbour — is what holds this to the far right.
              marginLeft: "auto",
              flex: "0 1 auto",
            }}
          >
            {/* Most-used pages (behaviour model): up to two quick-access buttons,
                sitting to the right of the stats block and to the left of the
                search field. Only renders once the model has learned pages. */}
            {topPages.length > 0 && (
              <div
                aria-label="Most used pages"
                style={{
                  display: "flex",
                  alignItems: "center",
                  // Uniform 10px spacing between the two page buttons (symmetry).
                  gap: "10px",
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                {topPages.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    prefetch={false}
                    className="app-btn app-btn--secondary"
                    title={`Frequently used: ${page.label}`}
                    style={{
                      maxWidth: "12rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {page.label}
                  </Link>
                ))}
              </div>
            )}

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
