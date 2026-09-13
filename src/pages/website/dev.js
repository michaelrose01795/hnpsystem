// file location: src/pages/website/dev.js
//
// ─────────────────────────────────────────────────────────────────────────────
//  /website/dev — THE customer design-system showcase
// ─────────────────────────────────────────────────────────────────────────────
//  Renders EVERY family in src/styles/custglobal.css with the real classes and,
//  where they are side-effect free, the real customer components. It is the
//  /website counterpart of /dev/user-diagnostic.
//
//  Rules (enforced by `npm run check:website`, docs/ui/website-design-governance.md):
//    1. custglobal.css is the source of truth. This page follows the stylesheet,
//       never the other way round — a change that only looks right here is not
//       a change.
//    2. Every class custglobal.css declares must be rendered by a section in
//       src/features/website/showcase/sections/. Adding a class without adding
//       it here fails the build.
//    3. Sections come from src/config/websiteDesignSystem.json. A registered
//       section with no <ShowcaseSection id="…"> fails the build.
//    4. No inline visual styling and no raw colours on this page or its
//       sections. Swatches paint var(--token), never a copied value.
//    5. URL-only: not linked from the site. Hidden when dev tools are off.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Head from "next/head";
import { canShowDevPages } from "@/lib/dev-tools/config";
import useWebsiteScope from "@/features/website/hooks/useWebsiteScope";
import WEBSITE_DESIGN from "@/config/websiteDesign.generated.json";
import FoundationShowcase from "@/features/website/showcase/sections/FoundationShowcase";
import ControlsShowcase from "@/features/website/showcase/sections/ControlsShowcase";
import SelectShowcase from "@/features/website/showcase/sections/SelectShowcase";
import PickersShowcase from "@/features/website/showcase/sections/PickersShowcase";
import MarketingShowcase from "@/features/website/showcase/sections/MarketingShowcase";
import StockShowcase from "@/features/website/showcase/sections/StockShowcase";
import ShopShowcase from "@/features/website/showcase/sections/ShopShowcase";
import PartsShowcase from "@/features/website/showcase/sections/PartsShowcase";
import AuthShowcase from "@/features/website/showcase/sections/AuthShowcase";
import ValuationShowcase from "@/features/website/showcase/sections/ValuationShowcase";
import HelpShowcase from "@/features/website/showcase/sections/HelpShowcase";
import PortalShowcase from "@/features/website/showcase/sections/PortalShowcase";
import ReferenceShowcase from "@/features/website/showcase/sections/ReferenceShowcase";

// Section id (src/config/websiteDesignSystem.json) -> component.
const SECTION_COMPONENTS = {
  foundation: FoundationShowcase,
  controls: ControlsShowcase,
  select: SelectShowcase,
  pickers: PickersShowcase,
  marketing: MarketingShowcase,
  stock: StockShowcase,
  shop: ShopShowcase,
  parts: PartsShowcase,
  auth: AuthShowcase,
  valuation: ValuationShowcase,
  help: HelpShowcase,
  portal: PortalShowcase,
  reference: ReferenceShowcase,
};

// The public site ships light-only (useWebsiteTheme), so the showcase opens on
// light. Dark stays available because custglobal.css still carries it for
// /website/profile. "system" resolves to a concrete theme before it is written.
const WEBSITE_THEME_KEY = "hnp-website-theme";
const WEBSITE_THEME_CYCLE = ["light", "dark", "system"];

const resolveWebsiteTheme = (preference) => {
  if (preference !== "system") return preference;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "light";
};

export default function WebsiteDevShowcasePage() {
  useWebsiteScope();

  const [themePreference, setThemePreference] = useState("light");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(WEBSITE_THEME_KEY);
    if (stored && WEBSITE_THEME_CYCLE.includes(stored)) setThemePreference(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = resolveWebsiteTheme(themePreference);
      root.setAttribute("data-website-theme", resolved);
      setTheme(resolved);
    };
    apply();
    let media;
    if (themePreference === "system" && window.matchMedia) {
      media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", apply);
    }
    return () => {
      if (media) media.removeEventListener("change", apply);
      root.removeAttribute("data-website-theme");
    };
  }, [themePreference]);

  const cycleTheme = () => {
    setThemePreference((previous) => {
      const next = WEBSITE_THEME_CYCLE[(WEBSITE_THEME_CYCLE.indexOf(previous) + 1) % WEBSITE_THEME_CYCLE.length];
      window.localStorage.setItem(WEBSITE_THEME_KEY, next);
      return next;
    });
  };

  if (!canShowDevPages()) {
    return (
      <div className="website-dev-locked">
        <h1 className="website-dev-locked__title">Not available</h1>
        <p className="website-dev-locked__body">This page is disabled in the current environment.</p>
      </div>
    );
  }

  const { sections, totals } = WEBSITE_DESIGN;
  const themeLabel = `${themePreference.charAt(0).toUpperCase()}${themePreference.slice(1)}`;

  return (
    <>
      <Head>
        <title>/website/dev — Customer UI Showcase</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="website-dev-shell">
        <header className="website-dev-header">
          <div className="website-dev-header__text">
            <h1 className="website-dev-page-title">Customer UI Showcase</h1>
            <p className="website-dev-page-lead">
              Every family in <code className="website-dev-code">src/styles/custglobal.css</code>, rendered
              with the real classes. Change a token in the stylesheet and this page, and every /website
              route, follows it. <code className="website-dev-code">npm run check:website</code> fails the
              build if anything in the stylesheet is not shown here.
            </p>
            <ul className="website-dev-stats">
              <li className="website-dev-stat">
                <strong>{totals.coveredClasses}</strong> / {totals.classes} classes shown
              </li>
              <li className="website-dev-stat">
                <strong>{totals.tokens}</strong> tokens
              </li>
              <li className="website-dev-stat">
                <strong>{totals.families}</strong> families
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`Theme: ${themePreference}. Click to cycle light, dark, system.`}
          >
            Theme: {themeLabel}
          </button>
        </header>

        <nav className="website-dev-index" aria-label="Showcase sections">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="website-dev-index__link">
              {section.title}
            </a>
          ))}
        </nav>

        {sections.map((section) => {
          const Section = SECTION_COMPONENTS[section.id];
          if (!Section) {
            return (
              <p key={section.id} className="website-dev-missing">
                Section “{section.id}” is registered but has no showcase component.
              </p>
            );
          }
          return <Section key={section.id} section={section} theme={theme} />;
        })}
      </main>
    </>
  );
}

// /website routes render bare — no staff <Layout> shell.
WebsiteDevShowcasePage.getLayout = (page) => page;
