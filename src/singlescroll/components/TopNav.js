// file location: src/singlescroll/components/TopNav.js
// Sticky top navigation. Uses the canonical TabGroup component so the tabs
// inherit the app's tab styling (and the red accent we force in WebsitePage).
//
// - Tracks active section via IntersectionObserver (useActiveSection).
// - Smoothly scrolls on click via useSmoothScrollTo.
// - "New" / "Used" tabs additionally lift a filter into the gallery (via
//   onFilterChange — owned by WebsitePage).
// - A thin scroll-progress bar sits along the bottom of the nav to give the
//   page a continuous, single-scroll feel.

import { useEffect, useMemo, useState } from "react";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { navTabs } from "../data/navTabs";
import { siteContent } from "../data/siteContent";
import useActiveSection from "../hooks/useActiveSection";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

export default function TopNav({ onFilterChange }) {
  const sectionIds = useMemo(
    () => Array.from(new Set(navTabs.map((t) => t.scrollTo))),
    [],
  );
  const active = useActiveSection(sectionIds);
  const scrollTo = useSmoothScrollTo();

  const tabsById = useMemo(() => {
    const map = new Map();
    navTabs.forEach((t) => map.set(t.id, t));
    return map;
  }, []);

  // Map each tab's id back to whether the active section matches its scroll
  // target — when New & Used both target #cars, both look "non-active" so we
  // keep an internal sticky selection that overrides only for those two.
  const [stickyId, setStickyId] = useState(null);

  const activeTabId = useMemo(() => {
    if (active === "cars" && stickyId && (stickyId === "new" || stickyId === "used")) {
      return stickyId;
    }
    const match = navTabs.find((t) => t.scrollTo === active);
    return match?.id || null;
  }, [active, stickyId]);

  const items = useMemo(
    () => navTabs.map((t) => ({ value: t.id, label: t.label })),
    [],
  );

  // Scroll-progress bar driven by scroll position.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
      setProgress(pct);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleChange = (id) => {
    const tab = tabsById.get(id);
    if (!tab) return;
    if (tab.filter && typeof onFilterChange === "function") {
      onFilterChange(tab.filter);
    }
    setStickyId(tab.filter ? id : null);
    scrollTo(tab.scrollTo);
  };

  return (
    <header className={styles.nav} data-singlescroll-nav>
      <div className={styles.navInner}>
        <a
          href="#top"
          className={styles.navBrand}
          onClick={(e) => { e.preventDefault(); setStickyId(null); scrollTo("top"); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteContent.brand.logoUrl}
            alt={siteContent.brand.name}
            className={styles.navLogo}
          />
          <span className={styles.navBrandText}>
            <span className={styles.navBrandName}>{siteContent.brand.name}</span>
            <span className={styles.navBrandTagline}>{siteContent.brand.tagline}</span>
          </span>
        </a>

        <div className={styles.navTabsWrap}>
          <TabGroup
            items={items}
            value={activeTabId}
            onChange={handleChange}
            ariaLabel="Primary navigation"
            layout="wrap"
          />
        </div>

        <a className={styles.navCta} href={siteContent.contact.phoneHref}>
          {siteContent.contact.phone}
        </a>
      </div>

      <div className={styles.navProgress} aria-hidden="true">
        <div
          className={styles.navProgressBar}
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </header>
  );
}
