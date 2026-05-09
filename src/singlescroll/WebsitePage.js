// file location: src/singlescroll/WebsitePage.js
// Top-level composition for the public single-scroll marketing site.
//
// Owns:
// - The gallery filter state (top-nav New/Used + in-gallery filter tabs).
// - A theme override forcing red accent + light mode.
// - The global scroll progress ref (passed into the 3D scene + camera rig).
// - Capability detection — picks between the heavy 3D hero and a static
//   poster on low-power / no-WebGL devices.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useTheme } from "@/styles/themeProvider";

import TopNav from "./components/TopNav";
import Hero from "./components/Hero";
import TrustBar from "./components/TrustBar";
import BrandStrip from "./components/BrandStrip";
import Storyteller from "./components/Storyteller";
import VehicleGallery from "./components/VehicleGallery";
import Offers from "./components/Offers";
import SellYourCar from "./components/SellYourCar";
import ServiceAndParts from "./components/ServiceAndParts";
import Motability from "./components/Motability";
import AboutUs from "./components/AboutUs";
import Blog from "./components/Blog";
import ContactUs from "./components/ContactUs";
import Footer from "./components/Footer";

import useScrollAnimations from "./hooks/useScrollAnimations";
import useScrollProgress from "./hooks/useScrollProgress";
import useIs3DCapable from "./hooks/useIs3DCapable";
import useReducedMotion from "./hooks/useReducedMotion";
import { siteContent } from "./data/siteContent";
import styles from "./styles/singlescroll.module.css";

// The 3D canvas is heavy (Three.js + drei + postprocessing). Lazy-load it so
// the page above-the-fold can paint immediately and we never ship the bundle
// to visitors whose browsers can't run it.
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

  // Brand red + light theme for the public marketing page (mirrors
  // /presentation). Cleans up on unmount.
  useEffect(() => {
    setTemporaryOverride({ mode: "light", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  useScrollAnimations(rootRef);

  const show3D = capable && !reduced;

  return (
    <>
      <Head>
        <title>{siteContent.brand.name} — Family-run Suzuki, KGM & Mitsubishi dealer in Kent</title>
        <meta
          name="description"
          content="Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing and MOTs."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div ref={rootRef} className={styles.page}>
        <TopNav onFilterChange={setGalleryFilter} />

        <main>
          <Hero>
            {show3D && <SceneCanvas scrollRef={scrollRef} lowQuality={lowQuality} />}
          </Hero>

          <TrustBar />
          <BrandStrip />

          <Storyteller />

          <VehicleGallery
            filter={galleryFilter}
            onFilterChange={setGalleryFilter}
          />

          <Offers />
          <SellYourCar />
          <ServiceAndParts />
          <Motability />
          <AboutUs />
          <Blog />
          <ContactUs />
        </main>

        <Footer />
      </div>
    </>
  );
}
