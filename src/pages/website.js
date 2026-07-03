// file location: src/pages/website.js
// Public customer website marketing site at /website. Opts out of the staff
// <StaffLayout> / <StaffSidebar> chrome via CustomerWebsiteLayout — _app.js
// honours Component.getLayout when present (see _app.js getLayout pattern).

import dynamic from "next/dynamic";
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import { RouteBoundary } from "@/components/support/SupportErrorBoundary";

// Dynamically import so GSAP / IntersectionObserver code never runs during SSR.
const WebsitePage = dynamic(() => import("@/features/website/WebsitePage"), {
  ssr: false,
});

// Phase 9 — a customer-variant route boundary gives the public site a graceful,
// non-technical recovery screen (and hosts its own report popup, since there is
// no StaffTopbar here) instead of a blank page if a leaf crashes.
export default function Website() {
  return (
    <RouteBoundary variant="customer" homeHref="/website" hostSupportModal>
      <WebsitePage />
    </RouteBoundary>
  );
}

Website.getLayout = customerWebsiteGetLayout;
