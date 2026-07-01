// file location: src/components/dev-platform/DevPlatformTabs.js
//
// Phase 11.1 — the Developer Platform navigation as a top tab group inside the
// normal staff page shell (replacing the old left nav rail). Built on the SAME
// canonical tab primitive as the HR tab bar (TabLinkGroup, styled by
// src/styles/families/tabs.css) inside a LayerSurface — so it looks and behaves
// exactly like every other staffglobal.css page tab bar. Labels only (no icons).

import React from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";
import { DEV_PLATFORM_NAV } from "@/components/dev-platform/devPlatformNav";

// Labels only — the icons are intentionally dropped from the tab group.
const TABS = DEV_PLATFORM_NAV.map(({ href, label }) => ({ href, label }));

export default function DevPlatformTabs({ activeKey }) {
  const router = useRouter();
  const activeItem = activeKey ? DEV_PLATFORM_NAV.find((item) => item.key === activeKey) : null;

  // Prefer the page-supplied activeKey; otherwise resolve from the route. Home
  // ("/dev") must match exactly, since every /dev/* path starts with it.
  const isActive = (tab) => {
    if (activeItem) return tab.href === activeItem.href;
    if (tab.href === "/dev") return router.pathname === "/dev";
    return router.pathname === tab.href || router.pathname.startsWith(tab.href);
  };

  return (
    <LayerSurface as="div" style={{ padding: "var(--space-4)" }}>
      <TabLinkGroup items={TABS} isActive={isActive} ariaLabel="Developer Platform" />
    </LayerSurface>
  );
}
