// file location: src/components/dev-platform/DevPlatformLayout.js
//
// Phase 8 shell → Phase 11.1: the Developer Platform now renders inside the
// normal staff <Layout> (the same sidebar + topbar + page card as every other
// staffglobal.css page) instead of a bespoke full-page shell. The platform's
// areas are a top tab group (DevPlatformTabs) at the top of the page content;
// the page's own content renders below it. `withDevPlatformLayout` returns the
// same <Layout> root as the default staff getLayout, so the shell stays mounted
// across navigations.
//
// CLAUDE.md: <Layout> / <Sidebar> are NOT modified — the platform simply opts
// into them. The tab group is a borderless LayerSurface; the page content is
// whatever the /dev/* page renders (LayerSurface/LayerTheme sections), sitting in
// the standard staff page-card / page-stack shell the staff layout provides.

import React from "react";
import Layout from "@/components/Layout";
import DevPlatformTabs from "@/components/dev-platform/DevPlatformTabs";

// Inner shell: the top tab group + the active page content. No page frame of its
// own — the staff <Layout> already provides the sidebar, topbar and page card.
export default function DevPlatformLayout({ children, activeKey }) {
  return (
    <div className="app-dev-platform" style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
      <DevPlatformTabs activeKey={activeKey} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
        {children}
      </div>
    </div>
  );
}

// getLayout factory. Root is the shared <Layout> (identical element type to the
// default staff getLayout), so React keeps the sidebar/topbar mounted across all
// navigations; only `activeKey` + children change inside.
export function withDevPlatformLayout(options = {}) {
  const { activeKey } = options;
  return function getLayout(page) {
    return (
      <Layout>
        <DevPlatformLayout activeKey={activeKey}>{page}</DevPlatformLayout>
      </Layout>
    );
  };
}
