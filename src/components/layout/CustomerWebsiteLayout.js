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
import React from "react";

export default function CustomerWebsiteLayout({ children }) {
  // No staff chrome — the website renders edge-to-edge under website-scope CSS.
  return <>{children}</>;
}

// Convenience helper for Next.js `Page.getLayout`.
export const customerWebsiteGetLayout = (page) => (
  <CustomerWebsiteLayout>{page}</CustomerWebsiteLayout>
);
