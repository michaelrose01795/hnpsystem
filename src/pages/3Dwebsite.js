// file location: src/pages/3Dwebsite.js
// Standalone /3Dwebsite showcase route — a single-scroll 3D walkthrough of the
// H&P dealership workflow. Completely separate from the /website marketing
// pages and from the live DMS: it uses mock data only (no Supabase, no APIs).
//
// Opts out of the dashboard <Layout> / <Sidebar> chrome via a no-op getLayout
// (the same pattern as /website — see _app.js, which honours Component.getLayout).
// The React Three Fiber experience is loaded client-side only.

import Head from "next/head";
import dynamic from "next/dynamic";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

// Branded loading screen shown while the 3D bundle loads (and during SSR).
function RouteLoading() {
  return (
    <div className={styles.loading}>
      <div className={styles.loadingInner}>
        <div className={styles.loadingChip}>H&amp;P</div>
        <div className={styles.loadingTitle}>Loading 3D dealership</div>
        <div className={styles.loadingBarTrack}>
          <div className={styles.loadingBar} />
        </div>
      </div>
    </div>
  );
}

const ThreeDWebsitePage = dynamic(
  () => import("@/features/3Dwebsite/components/ThreeDWebsitePage"),
  { ssr: false, loading: RouteLoading },
);

export default function ThreeDWebsiteRoute() {
  return (
    <>
      <Head>
        <title>3D Dealership Workflow — Humphries &amp; Parks</title>
        <meta
          name="description"
          content="An interactive 3D walkthrough of the Humphries & Parks dealership workflow: booking, sales, workshop, parts, smart repair, valet and collection."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <ThreeDWebsitePage />
    </>
  );
}

// Render bare — no DMS sidebar / topbar. _app.js honours Component.getLayout.
ThreeDWebsiteRoute.getLayout = (page) => page;
