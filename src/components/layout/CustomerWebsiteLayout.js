// file location: src/components/layout/CustomerWebsiteLayout.js
// Layout shell for the public customer website (/website routes).
//
// The customer site deliberately opts OUT of the staff app chrome (no
// StaffSidebar, StaffTopbar, status sidebar, or floating notes). Its global
// styling comes from src/styles/custglobal.css, which is scoped to
// `html.website-scope`; _app.js toggles that scope class by path, so this
// component only needs to render the page content without the staff shell.
//
// Usage in a page:
//   import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
//   MyWebsitePage.getLayout = customerWebsiteGetLayout;
//
// Phase 9 (Support & Recovery System) — the public site has no StaffTopbar, so
// it previously had no manual "report a problem" path. A discreet, self-hosting
// SupportReportLauncher is mounted here so a customer can always report an issue
// (same private, sanitised diagnostics snapshot as the staff "?" control). It is
// fixed bottom-left, out of the marketing content flow, and hidden from print.
import React from "react";
import SupportReportLauncher from "@/components/support/SupportReportLauncher";

export default function CustomerWebsiteLayout({ children }) {
  // No staff chrome — the website renders edge-to-edge under website-scope CSS.
  return (
    <>
      {children}
      <div
        // Discreet fixed anchor for the report launcher; kept out of the content
        // flow and never printed. Non-surface wrapper, so no border rules apply.
        className="app-website-support-launcher"
        style={{ position: "fixed", left: "12px", bottom: "12px", zIndex: "var(--z-toast, 60)" }}
      >
        <SupportReportLauncher variant="secondary" label="Report a problem" />
      </div>
    </>
  );
}

// Convenience helper for Next.js `Page.getLayout`.
export const customerWebsiteGetLayout = (page) => (
  <CustomerWebsiteLayout>{page}</CustomerWebsiteLayout>
);
