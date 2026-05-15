// file location: src/singlescroll/WebsitePage.js
// Top-level composition for the public single-scroll marketing site.
//
// The 3D layer is now handled by <Website3DScene> — a single fullscreen
// canvas with four real Suzuki glTF models that the camera + cars
// reposition per section via GSAP ScrollTrigger. Sections themselves
// are rendered above it as translucent chapters that reveal the scene
// behind them.
//
// Scroll behaviour: free-flowing. The earlier viewport-sized scroll-
// snap has been removed so the 3D scene can transition between
// presets continuously rather than jumping section-to-section.

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";

import TopNav from "./components/TopNav";
import Hero from "./components/Hero";
import BrandStrip from "./components/BrandStrip";
import Marquee from "./components/Marquee";
import Storyteller from "./components/Storyteller";
import VehicleGallery from "./components/VehicleGallery";
import Offers from "./components/Offers";
import SellYourCar from "./components/SellYourCar";
import ServiceAndParts from "./components/ServiceAndParts";
import Motability from "./components/Motability";
import TimelineHistory from "./components/TimelineHistory";
import MeetTheTeam from "./components/MeetTheTeam";
import ReviewsSection from "./components/ReviewsSection";
import Blog from "./components/Blog";
import ContactUs from "./components/ContactUs";
import Footer from "./components/Footer";

import useScrollAnimations from "./hooks/useScrollAnimations";
import useIs3DCapable from "./hooks/useIs3DCapable";
import useReducedMotion from "./hooks/useReducedMotion";
import useWebsiteScope from "./hooks/useWebsiteScope";
import useWebsiteTheme from "./hooks/useWebsiteTheme";
import { siteContent } from "./data/siteContent";
import styles from "./styles/singlescroll.module.css";

const STORY_MARQUEE = [
  "Established 1947",
  "Three generations · One family",
  "West Malling, Kent",
  "Suzuki · KGM · Mitsubishi",
  "Approved EV retailer",
  "AutoTrader Award winners",
  "120-point inspection · 6-month warranty",
];

// Lazy-load the 3D scene only after the parent page has confirmed the
// device/network can afford it. Weak phones and poor connections never fetch
// this Three.js chunk or the glTF model files.
const Website3DScene = dynamic(
  () => import("./components/Website3DScene"),
  { ssr: false, loading: () => null },
);

export default function WebsitePage() {
  const rootRef = useRef(null);
  const [galleryFilter, setGalleryFilter] = useState("all");
  const reducedMotion = useReducedMotion();
  const { ready: checked3D, capable: canLoad3D, lowQuality } = useIs3DCapable();

  // Dark cinematic default for anonymous visitors; once logged in, /website
  // follows the colour mode the user picked for their account. Brand-red
  // accent either way. Unwinds cleanly when the visitor leaves /website.
  useWebsiteTheme();
  useWebsiteScope();
  useScrollAnimations(rootRef);

  return (
    <>
      <Head>
        <title>{siteContent.brand.name} — Family-run Suzuki, KGM &amp; Mitsubishi dealer in Kent</title>
        <meta
          name="description"
          content="Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing, MOTs, parts."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {checked3D && canLoad3D && !reducedMotion && (
        <Website3DScene
          galleryFilter={galleryFilter}
          lowQuality={lowQuality}
          reduced={reducedMotion}
        />
      )}

      <div ref={rootRef} className={styles.page}>
        <TopNav onFilterChange={setGalleryFilter} />

        <main className={styles.pageMain}>
          {/* Chapter 0 — opener. */}
          <Hero />
          <BrandStrip />

          {/* Chapter 1–5 — the buying & owning story. */}
          <VehicleGallery
            filter={galleryFilter}
            onFilterChange={setGalleryFilter}
          />
          <Offers />
          <SellYourCar />
          <ServiceAndParts />
          <Motability />

          <Marquee items={STORY_MARQUEE} speed={42} />

          {/* Chapter 6 — About Us. The Storyteller diorama is the master
              visual reference; Timeline / Reviews / Team continue under
              the same anchor as one cohesive about chapter. */}
          <div className={styles.aboutChapter}>
            <Storyteller />
            <TimelineHistory />
            <ReviewsSection />
            <MeetTheTeam />
          </div>

          {/* Chapter 7–8 — read & contact. */}
          <Blog />
          <ContactUs />
        </main>

        <Footer />
      </div>
    </>
  );
}
