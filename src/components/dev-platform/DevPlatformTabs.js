// file location: src/components/dev-platform/DevPlatformTabs.js
//
// Phase 11.1 — the Developer Platform navigation as a top tab group inside the
// normal staff page shell. Phase 12: the flat 16-area row overflowed the screen,
// so it is now TWO LEVELS built on the SAME canonical tab primitive (TabLinkGroup,
// styled by src/styles/families/tabs.css):
//   • Row 1 — the category groups (DEV_PLATFORM_GROUPS, kept <= 9 so it always
//     fits one screen). Clicking a category opens its FIRST sub-area.
//   • Row 2 — the sub-areas of the active category (hidden for single-area
//     categories like Home).
// The active category is derived from the active area (page-supplied activeKey,
// else the route). Labels only — no icons. CLAUDE.md: Row 1 is a borderless
// LayerSurface; Row 2 is the alternation-correct nested LayerTheme strip.

import React from "react";
import { useRouter } from "next/router";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";
import {
  DEV_PLATFORM_NAV,
  DEV_PLATFORM_GROUPS,
  getDevPlatformGroupChildren,
  getDevPlatformGroupForAreaKey,
} from "@/components/dev-platform/devPlatformNav";

export default function DevPlatformTabs({ activeKey }) {
  const router = useRouter();

  // Resolve the active AREA key: prefer the page-supplied activeKey, otherwise
  // work it out from the current route. Home ("/dev") must match exactly since
  // every /dev/* path starts with it.
  const resolveActiveAreaKey = () => {
    if (activeKey && DEV_PLATFORM_NAV.some((item) => item.key === activeKey)) {
      return activeKey;
    }
    if (router.pathname === "/dev") return "home";
    const match = DEV_PLATFORM_NAV.find(
      (item) => item.href !== "/dev" && (router.pathname === item.href || router.pathname.startsWith(item.href)),
    );
    return match?.key || "home";
  };

  const activeAreaKey = resolveActiveAreaKey();
  const activeGroup = getDevPlatformGroupForAreaKey(activeAreaKey) || DEV_PLATFORM_GROUPS[0];

  // Row 1 — category tabs. Each links to the group's FIRST sub-area (so a click
  // "opens the first sub-area" and reveals the sub-row). A group is active when
  // it owns the active area.
  const groupTabs = DEV_PLATFORM_GROUPS.map((group) => {
    const first = getDevPlatformGroupChildren(group)[0];
    return { href: first?.href || "/dev", label: group.label, groupKey: group.key };
  });
  const isGroupActive = (tab) => tab.groupKey === activeGroup.key;

  // Row 2 — the active group's sub-areas. Hidden for single-area groups (Home).
  const subItems = getDevPlatformGroupChildren(activeGroup);
  const subTabs = subItems.map(({ href, label }) => ({ href, label }));
  const isSubActive = (tab) => {
    const item = DEV_PLATFORM_NAV.find((nav) => nav.href === tab.href);
    return item ? item.key === activeAreaKey : false;
  };

  // No wrapping surface/card — the tab strips sit directly in the page's main
  // section (app-page-stack). Both strips share ONE row: the category strip on
  // the left, the active group's sub-areas pushed to the right (space-between).
  // On narrow screens the row wraps and the sub-strip drops below.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-2)",
        minWidth: 0,
      }}
    >
      <TabLinkGroup items={groupTabs} isActive={isGroupActive} ariaLabel="Developer Platform areas" />
      {subTabs.length > 1 ? (
        <TabLinkGroup items={subTabs} isActive={isSubActive} ariaLabel={`${activeGroup.label} sections`} />
      ) : null}
    </div>
  );
}
