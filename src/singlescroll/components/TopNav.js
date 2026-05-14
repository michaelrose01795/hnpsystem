// file location: src/singlescroll/components/TopNav.js
// Sticky top navigation for the public single-scroll site.
//
// Renders the primary nav as a row of liquid-glass pill buttons that
// share the same visual language as the hero "View Cars →" CTA — a
// frosted capsule rail with the active tab promoted to the red
// gradient pill, plus a matching primary phone CTA on desktop.
//
// - Tracks the active section via IntersectionObserver (useActiveSection).
// - Smoothly scrolls on click via useSmoothScrollTo.
// - "New" / "Used" tabs additionally lift a filter into the gallery
//   (via onFilterChange — owned by WebsitePage).
// - A thin scroll-progress bar sits along the bottom of the nav so
//   the page reads as one continuous, linked scroll.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

  // New / Used both target #cars, so once the user has clicked one we
  // keep the choice "sticky" until they navigate away.
  const [stickyId, setStickyId] = useState(null);

  const activeTabId = useMemo(() => {
    if (active === "cars" && (stickyId === "new" || stickyId === "used")) {
      return stickyId;
    }
    const match = navTabs.find((t) => t.scrollTo === active);
    return match?.id || null;
  }, [active, stickyId]);

  // Customer auth status — drives the top-right Login/Profile pill.
  const [authState, setAuthState] = useState({
    loading: true,
    customer: null,
  });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/website/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setAuthState({
          loading: false,
          customer: data?.customer || null,
        });
      })
      .catch(() => {
        if (!cancelled) setAuthState({ loading: false, customer: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const customerFirstName =
    (authState.customer?.firstname || "").trim() ||
    (authState.customer?.name || "").trim().split(" ")[0] ||
    "Account";

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

  const handleClick = (id) => {
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
          onClick={(e) => {
            e.preventDefault();
            setStickyId(null);
            scrollTo("top");
          }}
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

        <nav className={styles.navTabsWrap} aria-label="Primary">
          <ul className={styles.navTabsList} role="tablist">
            {navTabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    /* `app-btn` opts out of the project-wide
                       `button:not(.app-btn)` rule in staffglobal.css so the
                       nav pill keeps the same liquid-glass look as the
                       hero CTAs instead of inheriting the dashboard
                       button skin. */
                    className={`app-btn ${styles.navTab} ${isActive ? styles.navTabActive : ""}`}
                    onClick={() => handleClick(tab.id)}
                  >
                    <span>{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.navAccountSlot}>
          {authState.loading ? null : authState.customer ? (
            <Link
              href="/website/profile"
              className={`app-btn ${styles.navAccountBtn} ${styles.navAccountBtnFilled}`}
            >
              <span className={styles.navAccountAvatar} aria-hidden="true">
                {(customerFirstName[0] || "A").toUpperCase()}
              </span>
              <span>{customerFirstName}</span>
            </Link>
          ) : (
            <Link
              href="/website/login"
              className={`app-btn ${styles.navAccountBtn}`}
            >
              <span>Login</span>
            </Link>
          )}
        </div>

        <a className={styles.navCta} href={siteContent.contact.phoneHref}>
          <span>{siteContent.contact.phone}</span>
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
