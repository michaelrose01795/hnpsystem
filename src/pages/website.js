// file location: src/pages/website.js
// Public customer website marketing site at /website. Opts out of the staff
// <StaffLayout> / <StaffSidebar> chrome via CustomerWebsiteLayout — _app.js
// honours Component.getLayout when present (see _app.js getLayout pattern).

import dynamic from "next/dynamic";
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";

// Dynamically import so GSAP / IntersectionObserver code never runs during SSR.
const WebsitePage = dynamic(() => import("@/features/website/WebsitePage"), {
  ssr: false,
});

export default function Website() {
  return <WebsitePage />;
}

Website.getLayout = customerWebsiteGetLayout;
