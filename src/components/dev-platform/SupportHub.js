// file location: src/components/dev-platform/SupportHub.js
//
// Phase 11 — the Support hub. Groups the support-related developer areas into a
// single page with top-left in-page tabs (Overview, Reports, Investigations,
// Health, Notifications, Activity, Settings) instead of scattering them across
// the platform nav rail. Each tab renders the SAME component the standalone
// /dev/* page renders, so there is one source of truth per area. Only the active
// tab mounts, so only that view fetches.
//
// CLAUDE.md: the tab bar is a borderless LayerSurface; the active tab is a
// tinted background (never a border — Border Law); tabs are 44px targets, keyboard
// operable, and reflow/scroll on mobile. The current tab is reflected in ?tab= so
// it is deep-linkable (e.g. the support email links to a report; a dev can also
// bookmark ?tab=health).

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { toneTint } from "@/components/support/dev/supportDevUi";
import {
  SUPPORT_SECTION_TABS,
  resolveSupportTab,
} from "@/lib/dev-platform/supportSectionTabs";

import SupportOverviewSection from "@/components/dev-platform/sections/SupportOverviewSection";
import SupportWorkspace from "@/components/support/dev/SupportWorkspace";
import InvestigationsSection from "@/components/dev-platform/sections/InvestigationsSection";
import HealthSection from "@/components/dev-platform/sections/HealthSection";
import NotificationsSection from "@/components/dev-platform/sections/NotificationsSection";
import ActivitySection from "@/components/dev-platform/sections/ActivitySection";
import PreferencesSection from "@/components/dev-platform/sections/PreferencesSection";

function TabButton({ tab, active, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab.key)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        minHeight: 44,
        padding: "8px 14px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontSize: "var(--text-body-sm)",
        fontWeight: active ? 700 : 600,
        color: active ? "var(--accentText)" : "var(--text-1)",
        // Active state is a tinted background — no surface border (Border Law).
        background: active ? toneTint("accentText", 14) : "transparent",
        // Non-surface control: transparent placeholder outline is layout-only, allowed.
        border: "1px solid transparent",
      }}
    >
      <span aria-hidden style={{ fontSize: "16px", lineHeight: 1 }}>{tab.icon}</span>
      <span>{tab.label}</span>
    </button>
  );
}

export default function SupportHub() {
  const router = useRouter();
  const queryTab = Array.isArray(router.query?.tab) ? router.query.tab[0] : router.query?.tab;
  const [active, setActive] = useState(() => resolveSupportTab(queryTab));

  // Keep in sync if the URL tab changes (e.g. back/forward or a deep link).
  const resolvedQueryTab = useMemo(() => resolveSupportTab(queryTab), [queryTab]);
  React.useEffect(() => {
    setActive(resolvedQueryTab);
  }, [resolvedQueryTab]);

  const selectTab = useCallback(
    (key) => {
      const next = resolveSupportTab(key);
      setActive(next);
      // Reflect in the URL without a full navigation (shallow) so the tab is
      // shareable/bookmarkable but the shell + data hooks stay mounted.
      router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: next } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  const renderActive = () => {
    switch (active) {
      case "reports":
        return <SupportWorkspace />;
      case "investigations":
        return <InvestigationsSection />;
      case "health":
        return <HealthSection />;
      case "notifications":
        return <NotificationsSection />;
      case "activity":
        return <ActivitySection />;
      case "settings":
        return <PreferencesSection />;
      case "overview":
      default:
        return <SupportOverviewSection onSelectTab={selectTab} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
      <LayerSurface
        as="div"
        role="tablist"
        aria-label="Support areas"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "4px",
          overflowX: "auto",
        }}
      >
        {SUPPORT_SECTION_TABS.map((tab) => (
          <TabButton key={tab.key} tab={tab} active={tab.key === active} onSelect={selectTab} />
        ))}
      </LayerSurface>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
        {renderActive()}
      </div>
    </div>
  );
}
