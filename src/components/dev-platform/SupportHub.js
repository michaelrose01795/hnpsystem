// file location: src/components/dev-platform/SupportHub.js
//
// Phase 11 → Phase 12 — the Support hub. It no longer uses in-page tabs: every
// support area now renders stacked on ONE page, in order — Overview, Reports,
// Investigations, Health, Notifications, Activity, Settings. Each area is the
// SAME component the standalone /dev/* page renders, so there is one source of
// truth per area. The Overview's tiles act as a table of contents that
// smooth-scrolls down to each section (each section has an id anchor), and a
// ?tab= deep link scrolls to that section on load.
//
// CLAUDE.md: no bespoke surfaces — each section renders its own borderless
// LayerSurface/LayerTheme panels; the wrappers here are plain anchor divs.

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { resolveSupportTab } from "@/lib/dev-platform/supportSectionTabs";

import SupportOverviewSection from "@/components/dev-platform/sections/SupportOverviewSection";
import SupportWorkspace from "@/components/support/dev/SupportWorkspace";
import InvestigationsSection from "@/components/dev-platform/sections/InvestigationsSection";
import HealthSection from "@/components/dev-platform/sections/HealthSection";
import NotificationsSection from "@/components/dev-platform/sections/NotificationsSection";
import ActivitySection from "@/components/dev-platform/sections/ActivitySection";
import PreferencesSection from "@/components/dev-platform/sections/PreferencesSection";

// Anchor id for a section key — used by the Overview table-of-contents and the
// ?tab= deep-link scroll.
const sectionId = (key) => `support-${key}`;

export default function SupportHub() {
  const router = useRouter();
  const didDeepLinkScroll = useRef(false);

  const scrollToSection = useCallback((key) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(sectionId(key));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // On first load, if a valid ?tab= is present, scroll to that section (keeps
  // old deep links / bookmarks working now that the areas are stacked).
  const queryTab = Array.isArray(router.query?.tab) ? router.query.tab[0] : router.query?.tab;
  useEffect(() => {
    if (didDeepLinkScroll.current) return;
    if (!queryTab) return;
    const key = resolveSupportTab(queryTab);
    if (key && key !== "overview") {
      didDeepLinkScroll.current = true;
      // Defer to the next frame so the target section has mounted.
      const id = window.requestAnimationFrame(() => scrollToSection(key));
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [queryTab, scrollToSection]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)", minWidth: 0 }}>
      <div id={sectionId("overview")} style={{ minWidth: 0 }}>
        <SupportOverviewSection onSelectTab={scrollToSection} />
      </div>
      <div id={sectionId("reports")} style={{ minWidth: 0 }}>
        <SupportWorkspace />
      </div>
      <div id={sectionId("investigations")} style={{ minWidth: 0 }}>
        <InvestigationsSection />
      </div>
      <div id={sectionId("health")} style={{ minWidth: 0 }}>
        <HealthSection />
      </div>
      <div id={sectionId("notifications")} style={{ minWidth: 0 }}>
        <NotificationsSection />
      </div>
      <div id={sectionId("activity")} style={{ minWidth: 0 }}>
        <ActivitySection />
      </div>
      <div id={sectionId("settings")} style={{ minWidth: 0 }}>
        <PreferencesSection />
      </div>
    </div>
  );
}
