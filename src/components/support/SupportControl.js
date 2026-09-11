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
import SymbolButton from "@/components/ui/SymbolButton";

// Lazy, client-only — the popup is never needed during SSR or first paint.
const SupportReportModal = dynamic(() => import("@/components/support/SupportReportModal"), {
  ssr: false,
});

export default function SupportControl() {
  const { isOpen, openSupportReport } = useSupportReport();

  return (
    <>
      <SymbolButton
        symbol="help"
        label="Help and report a problem"
        onClick={() => openSupportReport()} />
      {isOpen && <SupportReportModal />}
    </>
  );
}
