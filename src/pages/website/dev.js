// file location: src/pages/website/dev.js
//
// ─────────────────────────────────────────────────────────────────────────────
//  /website/dev — THE customer design-system showcase
// ─────────────────────────────────────────────────────────────────────────────
//  A compact, full-width catalogue of every family in src/styles/custglobal.css,
//  rendered with the real classes and, where they are side-effect free, the real
//  customer components. It is the /website counterpart of /dev/user-diagnostic.
//
//  Rules (enforced by `npm run check:website`, docs/ui/website-design-governance.md):
//    1. custglobal.css is the source of truth. This page follows the stylesheet,
//       never the other way round.
//    2. Every class custglobal.css declares must be rendered by a section in
//       src/features/website/showcase/sections/.
//    3. Every section registered in src/config/websiteDesignSystem.json needs a
//       <ShowcaseSection id="…">. Registered sections missing from
//       PAGE_SECTIONS below are flagged on the page.
//    4. No inline visual styling and no raw colours. Swatches paint var(--token).
//    5. URL-only: not linked from the site. Hidden when dev tools are off.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { canShowDevPages } from "@/lib/dev-tools/config";
import useWebsiteScope from "@/features/website/hooks/useWebsiteScope";
import useCustomerSession from "@/features/website/hooks/useCustomerSession";
import WebsiteTopBar from "@/features/website/components/WebsiteTopBar";
import WEBSITE_DESIGN from "@/config/websiteDesign.generated.json";
import FoundationShowcase from "@/features/website/showcase/sections/FoundationShowcase";
import ButtonsShowcase from "@/features/website/showcase/sections/ButtonsShowcase";
import ControlsShowcase from "@/features/website/showcase/sections/ControlsShowcase";
import SelectShowcase from "@/features/website/showcase/sections/SelectShowcase";
import PickersShowcase from "@/features/website/showcase/sections/PickersShowcase";
import SurfacesShowcase from "@/features/website/showcase/sections/SurfacesShowcase";
import MarketingShowcase from "@/features/website/showcase/sections/MarketingShowcase";
import StockShowcase from "@/features/website/showcase/sections/StockShowcase";
import ShopShowcase from "@/features/website/showcase/sections/ShopShowcase";
import PartsShowcase from "@/features/website/showcase/sections/PartsShowcase";
import AuthShowcase from "@/features/website/showcase/sections/AuthShowcase";
import ValuationShowcase from "@/features/website/showcase/sections/ValuationShowcase";
import HelpShowcase from "@/features/website/showcase/sections/HelpShowcase";
import PortalShowcase from "@/features/website/showcase/sections/PortalShowcase";
import ReferenceShowcase from "@/features/website/showcase/sections/ReferenceShowcase";

// Page order. `id` is the anchor and the <ShowcaseSection id>; an id that is a
// registered section also picks up its family / class data from the manifest.
// "half" sections pair up side by side on wide screens, so keep them adjacent.
const PAGE_SECTIONS = [
  { id: "foundation", title: "Foundation", span: "full", Component: FoundationShowcase },
  { id: "buttons", title: "Buttons", span: "half", Component: ButtonsShowcase },
  { id: "controls", title: "Form controls", span: "half", Component: ControlsShowcase },
  { id: "select", title: "Selects & dropdowns", span: "half", Component: SelectShowcase },
  { id: "pickers", title: "Date & time", span: "half", Component: PickersShowcase },
  { id: "surfaces", title: "Cards & surfaces", span: "full", Component: SurfacesShowcase },
  { id: "marketing", title: "Marketing", span: "full", Component: MarketingShowcase },
  { id: "stock", title: "Stock", span: "full", Component: StockShowcase },
  { id: "shop", title: "Shop", span: "full", Component: ShopShowcase },
  { id: "parts", title: "Parts", span: "full", Component: PartsShowcase },
  { id: "auth", title: "Sign-in", span: "full", Component: AuthShowcase },
  { id: "valuation", title: "Valuation", span: "full", Component: ValuationShowcase },
  { id: "help", title: "Help", span: "full", Component: HelpShowcase },
  { id: "portal", title: "Portal", span: "full", Component: PortalShowcase },
  { id: "reference", title: "Reference", span: "full", Component: ReferenceShowcase },
];

// The public site ships light-only (useWebsiteTheme), so the showcase opens on
// light. Dark stays available because custglobal.css still carries it for
// /website/profile. "system" resolves to a concrete theme before it is written.
const WEBSITE_THEME_KEY = "hnp-website-theme";
const WEBSITE_THEME_OPTIONS = ["light", "dark", "system"];
const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" };

const resolveWebsiteTheme = (preference) => {
  if (preference !== "system") return preference;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "light";
};

export default function WebsiteDevShowcasePage() {
  useWebsiteScope();
  const { loading: sessionLoading, customer } = useCustomerSession();

  const [themePreference, setThemePreference] = useState("light");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(WEBSITE_THEME_KEY);
    if (stored && WEBSITE_THEME_OPTIONS.includes(stored)) setThemePreference(stored);
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

  const chooseTheme = (next) => {
    window.localStorage.setItem(WEBSITE_THEME_KEY, next);
    setThemePreference(next);
  };

  const topBar = (
    <WebsiteTopBar sessionLoading={sessionLoading} customer={customer}>
      <Link href="/website" className="ws-nav-link">
        Back to site
      </Link>
    </WebsiteTopBar>
  );

  if (!canShowDevPages()) {
    return (
      <div className="ws-page">
        {topBar}
        <div className="website-dev-locked">
          <h1 className="website-dev-locked__title">Not available</h1>
          <p className="website-dev-locked__body">This page is disabled in the current environment.</p>
        </div>
      </div>
    );
  }

  const { sections, totals } = WEBSITE_DESIGN;
  const manifestById = new Map(sections.map((section) => [section.id, section]));
  const placedIds = new Set(PAGE_SECTIONS.map((section) => section.id));
  const unplaced = sections.filter((section) => !placedIds.has(section.id));

  return (
    <>
      <Head>
        <title>/website/dev — Customer UI</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="ws-page">
      {topBar}
      <main className="website-dev-shell">
        <div className="website-dev-intro">
          <h1 className="website-dev-page-title">Customer UI</h1>
          <p className="website-dev-page-lead">
            Every class in custglobal.css, rendered with the real components. Switch the theme to check light and dark.
          </p>
          <ul className="website-dev-stats">
            <li className="website-dev-stat">
              <strong>{totals.coveredClasses}</strong> / {totals.classes} classes
            </li>
            <li className="website-dev-stat">
              <strong>{totals.tokens}</strong> tokens
            </li>
            <li className="website-dev-stat">
              <strong>{totals.families}</strong> families
            </li>
          </ul>
        </div>

        <header className="website-dev-header">
          <div className="website-dev-theme" role="group" aria-label={`Theme (showing ${theme})`}>
            {WEBSITE_THEME_OPTIONS.map((option) => {
              const active = option === themePreference;
              return (
                <button
                  key={option}
                  type="button"
                  className={active ? "app-btn" : undefined}
                  aria-pressed={active}
                  onClick={() => chooseTheme(option)}
                >
                  {THEME_LABELS[option]}
                </button>
              );
            })}
          </div>
          <nav className="website-dev-index" aria-label="Showcase sections">
            {PAGE_SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="website-dev-index__link">
                {section.title}
              </a>
            ))}
          </nav>
        </header>

        <div className="website-dev-sections">
          {PAGE_SECTIONS.map(({ id, title, span, Component }) => (
            <Component key={id} section={{ ...(manifestById.get(id) || {}), id, title, span }} theme={theme} />
          ))}
          {unplaced.map((section) => (
            <p key={section.id} className="website-dev-missing">
              Registered section “{section.title}” ({section.id}) is not placed on this page. Add it to PAGE_SECTIONS in
              src/pages/website/dev.js.
            </p>
          ))}
        </div>
      </main>
      </div>
    </>
  );
}

// /website routes render bare — no staff <Layout> shell.
WebsiteDevShowcasePage.getLayout = (page) => page;
