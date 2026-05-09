// file location: src/singlescroll/WebsitePage.js
// Top-level composition for the public single-scroll marketing site.
//
// The 3D canvas (SceneCanvas) is now mounted ONCE at the page root as a
// fixed-position fullscreen layer. As the user scrolls, the camera moves
// continuously — sections with semi-transparent backgrounds reveal the
// canvas, sections with solid backgrounds cover it. This is what produces
// the "the same 3D object is being dragged from section to section" feel.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useTheme } from "@/styles/themeProvider";

import TopNav from "./components/TopNav";
import Hero from "./components/Hero";
import TrustBar from "./components/TrustBar";
import BrandStrip from "./components/BrandStrip";
import Marquee from "./components/Marquee";
import Storyteller from "./components/Storyteller";
import VehicleGallery from "./components/VehicleGallery";
import Offers from "./components/Offers";
import SellYourCar from "./components/SellYourCar";
import ServiceAndParts from "./components/ServiceAndParts";
import PartsAndAccessories from "./components/PartsAndAccessories";
import Motability from "./components/Motability";
import TimelineHistory from "./components/TimelineHistory";
import MeetTheTeam from "./components/MeetTheTeam";
import ReviewsSection from "./components/ReviewsSection";
import Blog from "./components/Blog";
import ContactUs from "./components/ContactUs";
import Footer from "./components/Footer";

const TRUST_MARQUEE = [
  "Family run since 1947",
  "Three generations",
  "120-point inspection",
  "6-month warranty",
  "Approved EV retailer",
  "AutoTrader Award winners",
  "Suzuki · KGM · Mitsubishi",
  "01732 870711",
];

const STORY_MARQUEE = [
  "Established 1947",
  "Charles Humphries · Arthur Parks",
  "Marcus Joy",
  "Sam · Bruno · Soren Kingsland-Joy",
  "West Malling, Kent",
  "Three generations · One promise",
];

import useScrollAnimations from "./hooks/useScrollAnimations";
import useScrollProgress from "./hooks/useScrollProgress";
import useIs3DCapable from "./hooks/useIs3DCapable";
import useReducedMotion from "./hooks/useReducedMotion";
import { siteContent } from "./data/siteContent";
import styles from "./styles/singlescroll.module.css";

// Lazy-load the 3D canvas — Three.js + drei + postprocessing is a heavy
// chunk and not all visitors will need it (no-WebGL / reduced-motion users
// see the page without it).
const SceneCanvas = dynamic(() => import("./three/SceneCanvas"), {
  ssr: false,
  loading: () => null,
});

export default function WebsitePage() {
  const rootRef = useRef(null);
  const [galleryFilter, setGalleryFilter] = useState("all");
  const { setTemporaryOverride } = useTheme();
  const { ref: scrollRef } = useScrollProgress();
  const { capable, lowQuality } = useIs3DCapable();
  const reduced = useReducedMotion();

  // Razorpay Sprint-style: dark cinematic base with the brand red as accent.
  // The override unwinds cleanly when the visitor leaves /website.
  useEffect(() => {
    setTemporaryOverride({ mode: "dark", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  // Enable viewport-sized scroll-snap ONLY while /website is mounted.
  // We inject the global rule via a <style> tag rather than putting it in
  // the CSS module because Next.js's CSS-module pure-selector rule forbids
  // ":global(html…)" — it has no local class to anchor to. Injecting at
  // runtime gives us the same scoping (mount = on, unmount = off) without
  // tripping the build error.
  useEffect(() => {
    if (typeof document === "undefined" || reduced) return;

    const STYLE_ID = "hp-website-snap-style";
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        html.hp-website-snap {
          scroll-snap-type: y proximity;
          scroll-padding-top: 64px;
          scroll-behavior: smooth;
        }
      `;
      document.head.appendChild(styleEl);
    }
    document.documentElement.classList.add("hp-website-snap");

    return () => {
      document.documentElement.classList.remove("hp-website-snap");
      styleEl?.remove();
    };
  }, [reduced]);

  useScrollAnimations(rootRef);

  const show3D = capable && !reduced;

  return (
    <>
      <Head>
        <title>{siteContent.brand.name} — Family-run Suzuki, KGM & Mitsubishi dealer in Kent</title>
        <meta
          name="description"
          content="Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing, MOTs, parts."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* Persistent 3D canvas — fixed-position behind everything else.
          One mount, drives the whole page's immersive flow. */}
      {show3D && <SceneCanvas scrollRef={scrollRef} lowQuality={lowQuality} />}

      <div ref={rootRef} className={styles.page}>
        <TopNav onFilterChange={setGalleryFilter} />

        <main className={styles.pageMain}>
          <Hero />
          <TrustBar />
          <BrandStrip />

          <Marquee items={TRUST_MARQUEE} speed={36} />

          <Storyteller />

          <VehicleGallery
            filter={galleryFilter}
            onFilterChange={setGalleryFilter}
          />

          <Offers />
          <SellYourCar />

          <Marquee items={TRUST_MARQUEE} speed={32} reverse />

          <ServiceAndParts />
          <PartsAndAccessories />
          <Motability />

          <TimelineHistory />

          <Marquee items={STORY_MARQUEE} speed={40} />

          <MeetTheTeam />
          <ReviewsSection />

          <Blog />
          <ContactUs />
        </main>

        <Footer />
      </div>
    </>
  );
}
