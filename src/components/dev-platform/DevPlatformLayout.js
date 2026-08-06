// file location: src/components/dev-platform/DevPlatformLayout.js
//
// Phase 8 shell → Phase 12: the Developer Platform renders inside the normal
// staff <Layout> (the same sidebar + topbar + page card as every other staff
// page). Developer areas are first-class pages in the shared Developer sidebar
// module, so this wrapper only supplies the common page-content stack.
//
// AGENTS.md: <Layout> / <Sidebar> are NOT modified — the platform simply opts
// into them. Page content keeps its existing LayerSurface/LayerTheme hierarchy
// inside the standard staff page-card / page-stack shell.

import React from "react";
import Layout from "@/components/Layout";

// No page frame of its own: the staff <Layout> already provides the sidebar,
// topbar and page card.
export default function DevPlatformLayout({ children }) {
  return (
    <div className="app-dev-platform" style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 12px)" }}>
        {children}
      </div>
    </div>
  );
}

// getLayout factory. Root is the shared <Layout> (identical element type to the
// default staff getLayout), so React keeps the sidebar/topbar mounted across all
// Developer-page navigations.
export function withDevPlatformLayout() {
  return function getLayout(page) {
    return (
      <Layout>
        <DevPlatformLayout>{page}</DevPlatformLayout>
      </Layout>
    );
  };
}
