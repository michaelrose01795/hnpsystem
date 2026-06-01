// file location: src/components/layout/PublicLayout.js
// Minimal shell for truly public, chrome-free staff-side pages (e.g. /login,
// /unauthorized, /loginPresentation). These render under `html.staff-scope`
// CSS but without the StaffSidebar / StaffTopbar navigation chrome.
//
// NOTE (adoption status): today /login and /unauthorized still flow through
// StaffLayout, which hides its own chrome on those routes (see `hideSidebar`
// in StaffLayout). This component is the designated home for that "no chrome"
// concern going forward — migrating those pages onto PublicLayout is a safe
// follow-up that further shrinks StaffLayout's branching. Until then it is
// available for any new public page that should not inherit the staff shell.
import React from "react";

export default function PublicLayout({ children }) {
  return (
    <div className="app-public-shell">
      {children}
    </div>
  );
}

// Convenience helper for Next.js `Page.getLayout`.
export const publicGetLayout = (page) => <PublicLayout>{page}</PublicLayout>;
