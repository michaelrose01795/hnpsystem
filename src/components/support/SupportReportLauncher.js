// file location: src/components/support/SupportReportLauncher.js
//
// Phase 9 (Support & Recovery System) — a self-hosting "Report a problem" entry
// point for any surface that renders OUTSIDE the StaffTopbar, where the topbar's
// SupportControl "?" button (and its modal host) is not present:
//
//   • the public customer website (/website) and its CustomerWebsiteLayout,
//   • customer-facing VHC views (/vhc/customer-view, /vhc/customer-preview),
//   • any bespoke tech / kiosk surface with its own chrome.
//
// It opens the same Help & Diagnostics report popup (SupportReportContext →
// SupportReportModal) used everywhere else — same private, sanitised diagnostics
// snapshot, same server ingest — and HOSTS the modal itself (the topbar can't).
// So a customer/website user gets a manual report path with a reference-code-
// linked snapshot, consistent with the rest of the app.
//
// Presentation is intentionally minimal and token-styled; pass `variant` to pick
// a button family, `label` to override the text, and `prefill` to seed the
// report (e.g. a reference code from a recovery screen). It renders nothing but a
// button + (when open) the lazy modal, so it is safe to drop into any layout.

import React from "react";
import dynamic from "next/dynamic";
import { useSupportReport } from "@/context/SupportReportContext";

// Lazy, client-only — the popup/screenshot/canvas code is never fetched until a
// user actually clicks the launcher.
const SupportReportModal = dynamic(() => import("@/components/support/SupportReportModal"), {
  ssr: false,
});

const VARIANT_CLASS = {
  primary: "app-btn app-btn--primary",
  secondary: "app-btn app-btn--secondary",
  ghost: "app-btn app-btn--ghost",
};

export default function SupportReportLauncher({
  label = "Report a problem",
  variant = "ghost",
  prefill = null,
  className,
  style,
}) {
  const { isOpen, openSupportReport } = useSupportReport();

  return (
    <>
      <button
        type="button"
        className={className || VARIANT_CLASS[variant] || VARIANT_CLASS.ghost}
        onClick={() => openSupportReport(prefill ? { prefill } : {})}
        aria-label="Report a problem"
        // 44px touch target (CLAUDE.md §3.6).
        style={{ minHeight: "44px", ...style }}
      >
        {label}
      </button>
      {/* This launcher is the modal host on surfaces with no StaffTopbar. */}
      {isOpen && <SupportReportModal />}
    </>
  );
}
