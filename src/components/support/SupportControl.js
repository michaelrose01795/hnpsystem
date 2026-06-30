// file location: src/components/support/SupportControl.js
//
// Phase 3 — the text-only "?" control that lives in the StaffTopbar right column
// and opens the Help & Diagnostics ("support") report popup.
//
// Opening the popup takes the diagnostics snapshot at that moment (handled inside
// SupportReportContext.openSupportReport from Phase 2). The modal itself is
// lazy-loaded via next/dynamic so neither the form nor the screenshot/canvas code
// is fetched until a user actually clicks "?".

import React from "react";
import dynamic from "next/dynamic";
import { useSupportReport } from "@/context/SupportReportContext";

// Lazy, client-only — the popup is never needed during SSR or first paint.
const SupportReportModal = dynamic(() => import("@/components/support/SupportReportModal"), {
  ssr: false,
});

export default function SupportControl() {
  const { isOpen, openSupportReport } = useSupportReport();

  return (
    <>
      <button
        type="button"
        className="app-btn app-btn--ghost"
        onClick={() => openSupportReport()}
        aria-label="Help and report a problem"
        title="Help / report a problem"
        style={{
          // Square, 44px touch target with the "?" glyph centred.
          minWidth: "44px",
          minHeight: "44px",
          width: "44px",
          height: "44px",
          padding: 0,
          fontSize: "1.1rem",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {isOpen && <SupportReportModal />}
    </>
  );
}
