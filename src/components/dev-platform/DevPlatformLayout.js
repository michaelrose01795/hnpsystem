// file location: src/components/dev-platform/DevPlatformLayout.js
//
// Phase 8 — the shared shell for the internal Developer Platform. Every /dev/*
// surface opts into it via `Page.getLayout = withDevPlatformLayout({ activeKey })`
// so the shell (topbar + nav rail) stays mounted while only the inner content
// swaps — the same persistent-shell pattern as the staff <Layout>.
//
// CLAUDE.md compliance:
//   - the outer frame is the plain `.app-page-shell` layout container (NOT a
//     card), so the topbar / nav rail / page content are sibling surfaces that
//     each start fresh at <LayerSurface> — no two-consecutive-surface bug;
//   - every card/panel is <LayerSurface> / <LayerTheme> (borderless, tokens);
//   - nav links are 44px touch targets; the rail reflows to a horizontal strip
//     on mobile via useIsMobile.

import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import useIsMobile from "@/hooks/useIsMobile";
import { useUser } from "@/context/UserContext";
import { DEV_PLATFORM_NAV } from "@/components/dev-platform/devPlatformNav";
import DevHealthPill from "@/components/dev-platform/DevHealthPill";
import { toneTint } from "@/components/support/dev/supportDevUi";

function NavLink({ item, active }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minHeight: 44,
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        fontSize: "var(--text-body-sm)",
        fontWeight: active ? 700 : 600,
        whiteSpace: "nowrap",
        color: active ? "var(--accentText)" : "var(--text-1)",
        // Selected state is a tinted background (no surface border — Border Law).
        background: active ? toneTint("accentText", 14) : "transparent",
      }}
    >
      <span aria-hidden style={{ fontSize: "16px", lineHeight: 1 }}>{item.icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
    </Link>
  );
}

export default function DevPlatformLayout({ children, activeKey }) {
  const isMobile = useIsMobile(900);
  const router = useRouter();
  const { user, logout } = useUser();

  const resolvedKey =
    activeKey ||
    DEV_PLATFORM_NAV.find(
      (item) => item.href !== "/dev" && router.asPath.startsWith(item.href)
    )?.key ||
    "home";

  const userLabel = user?.username || user?.name || "Developer";

  return (
    <div
      className="app-page-shell"
      style={{
        // Match the app's page gutter (CLAUDE.md §3.5).
        padding: "8px 8px 32px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--page-stack-gap, 12px)",
      }}
    >
      {/* Topbar (sibling surface) */}
      <LayerSurface
        as="header"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "var(--text-h3, 18px)", color: "var(--accentText)" }}>
              Developer Platform
            </strong>
            <DevHealthPill />
          </div>
          <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
            Internal engineering tooling · signed in as {userLabel}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <Link
            href="/newsfeed"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: "var(--text-1)",
              background: toneTint("text-1", 10),
            }}
          >
            Exit to app
          </Link>
          <button
            type="button"
            onClick={() => logout?.()}
            className="app-btn app-btn--ghost"
            style={{
              minHeight: 44,
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--accentText)",
              background: toneTint("accentText", 10),
            }}
          >
            Sign out
          </button>
        </div>
      </LayerSurface>

      {/* Body: nav rail (sibling surface) + page content */}
      <div
        style={{
          display: isMobile ? "flex" : "grid",
          flexDirection: isMobile ? "column" : undefined,
          gridTemplateColumns: isMobile ? undefined : "minmax(200px, 240px) 1fr",
          gap: "var(--page-stack-gap, 12px)",
          alignItems: "start",
        }}
      >
        <LayerSurface
          as="nav"
          aria-label="Developer Platform"
          style={{
            gap: "4px",
            position: isMobile ? "static" : "sticky",
            top: isMobile ? undefined : "8px",
            flexDirection: isMobile ? "row" : "column",
            flexWrap: isMobile ? "wrap" : undefined,
            overflowX: isMobile ? "auto" : undefined,
          }}
        >
          {DEV_PLATFORM_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={item.key === resolvedKey} />
          ))}
        </LayerSurface>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// getLayout factory. Returning the SAME <DevPlatformLayout> element type across
// dev routes keeps the shell mounted; only `activeKey` + children change.
export function withDevPlatformLayout(options = {}) {
  const { activeKey } = options;
  return function getLayout(page) {
    return <DevPlatformLayout activeKey={activeKey}>{page}</DevPlatformLayout>;
  };
}
