// file location: src/pages/website.js
// Public customer website marketing site at /website. Opts out of the dashboard
// <Layout> / <Sidebar> chrome by exporting a no-op getLayout — _app.js honours
// Component.getLayout when present (see _app.js lines ~169-185).

import dynamic from "next/dynamic";

// Dynamically import so GSAP / IntersectionObserver code never runs during SSR.
const WebsitePage = dynamic(() => import("@/features/website/WebsitePage"), {
  ssr: false,
});

export default function Website() {
  return <WebsitePage />;
}

Website.getLayout = (page) => page;
