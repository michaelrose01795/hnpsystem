// file location: src/features/website/WebsitePage.js
// Public marketing site at /website — full rebuild (2026-05-15).
//
// A plain, accessible, customer website marketing page. No 3D scene, no scroll
// animation library. Every visual style lives in src/styles/custglobal.css
// under `html.website-scope` (the `.ws-*` class family). The site is
// light-only: useWebsiteTheme pins `data-website-theme="light"` onto <html>,
// and _document.js paints the same before hydration so there is no flash.
// This component only supplies markup and a little local state (nav menu,
// vehicle filter, scroll-spy).
//
// Where the content comes from (2026-09-11)
// -----------------------------------------
// Every SECTION on this page is code-owned: hero, trust points, brand strip,
// cars, offers, shop, sell your car, service & parts, motability, about,
// timeline, ratings, reviews, team, blog and contact all render from the
// modules in ./data, and the database is deliberately out of the loop for them
// (register: ./data/codeOwnedContent.js). Changing a section — adding a card,
// removing one, swapping an image URL, rewording a line — is an edit to that
// one file and nothing else. Every list here is safe to empty: a block with
// nothing left in it returns null instead of drawing an empty grid.
//
// Site-builder wiring (2026-09-01)
// --------------------------------
// The site CHROME is the exception and stays staff-editable in
// /website-manager: the top bar, the running order / visibility of the page
// blocks and their heading copy, the visual design, plus brand identity and
// the footer. Those come from the content bundle:
//
//   content.navLinks      website_nav             -> the top-bar links
//   content.sectionLayout website_section_layout  -> which blocks render, in
//                                                    what order, with what
//                                                    heading copy and tint
//   content.design        website_design          -> CSS custom properties
//                                                    applied to `.ws-page`
//
// so a change saved in /website-manager repaints this page. BLOCK_RENDERERS
// below is the one place that maps a layout row's `id` to actual markup: a row
// whose id has no renderer is skipped, and a renderer with no row never shows.

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";

import useWebsiteScope from "./hooks/useWebsiteScope";
import useWebsiteTheme from "./hooks/useWebsiteTheme";
import useWebsiteContent from "./hooks/useWebsiteContent";
import useWebsitePreviewMode from "./hooks/useWebsitePreviewMode";
import PreviewClickTarget from "./components/PreviewClickTarget";
import WebsiteTopBar, { WebsiteNavGroup } from "./components/WebsiteTopBar";
import ShopSection from "./components/ShopSection";
import OffersSection, { liveOffers } from "./components/OffersSection";
import QuickActions from "./components/QuickActions";
import VehicleCard from "./components/VehicleCard";
import HelpArticleModal from "./components/HelpArticleModal";
import BenefitCards from "./components/BenefitCards";
import SellValuationPanel from "./components/SellValuationPanel";
import WorkshopBookingPanel from "./components/WorkshopBookingPanel";
import MotabilityModelCard from "./components/MotabilityModelCard";
import WebsiteIcon from "./components/WebsiteIcon";
import VehicleCompareBar from "./components/VehicleCompareBar";
import WebsiteNativeSelect from "./components/WebsiteNativeSelect";
import useStockSearch, { CONDITION_TABS } from "./hooks/useStockSearch";
import { designToCssVars, groupNavLinks, HOME_NAV_LINK } from "./data/siteDesign";
import { FEATURED_VEHICLE_LIMIT } from "./data/vehicles";
import { SORT_OPTIONS } from "@/lib/stock/vehicleStock";
import Stars from "./components/Stars";
import ReviewsPanel from "./components/ReviewsPanel";
import HistoryTimeline from "./components/HistoryTimeline";
import VisitCta from "./components/VisitCta";
import WebsiteFooter from "./components/WebsiteFooter";
import { FEATURED_REVIEW_LIMIT, reviewTopics } from "./data/reviews";

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Section({ id, tint, children }) {
  return (
    <section id={id} data-presentation={`website-${id}`} className={tint ? "ws-section ws-section--tint" : "ws-section"}>
      <div className="ws-container">{children}</div>
    </section>
  );
}

// Decorative photography for the section heads whose copy leaves the right
// half of the row empty on a wide screen. Purely presentational: the <img> is
// alt="" behind aria-hidden, and the figure is display:none under 1024px
// (@family marketing in custglobal.css) so a phone keeps the whole width for
// the copy. Files are CC0 — see public/images/website/section-heads/CREDITS.md.
const SECTION_HEAD_MEDIA = {
  cars: "/images/website/section-heads/cars.webp",
  offers: "/images/website/section-heads/offers.webp",
  shop: "/images/website/section-heads/shop.webp",
  service: "/images/website/section-heads/service.webp",
  motability: "/images/website/section-heads/motability.webp",
};

function SectionHead({ eyebrow, title, lead, center, media }) {
  if (!eyebrow && !title && !lead) return null;
  // A centred head has no empty side to fill, so it never takes the photo.
  const withMedia = Boolean(media) && !center;
  const copy = (
    <>
      {eyebrow ? <span className="ws-eyebrow">{eyebrow}</span> : null}
      {title ? <h2 className="ws-h2">{title}</h2> : null}
      {lead ? <p className="ws-lead">{lead}</p> : null}
    </>
  );
  if (!withMedia) {
    return <header className={center ? "ws-head ws-head--center" : "ws-head"}>{copy}</header>;
  }
  return (
    <header className="ws-head ws-head--media">
      <div className="ws-head-copy">{copy}</div>
      <div className="ws-head-figure" aria-hidden="true">
        <img className="ws-head-img" src={media} alt="" loading="lazy" decoding="async" />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Live-content shape guards                                           */
/* ------------------------------------------------------------------ */
// Two content slots reach this page in a different shape depending on whether
// the static fallback or the live database is in play, and rendering the live
// shape blindly throws and takes the WHOLE page down through the route
// boundary — the Cars, Offers and Contact blocks included.
//
//   motability.rangeBrands  static: [{ brand, models: [] }]   live: ["Suzuki", …]
//   footer.legal            static: ["Privacy Policy", …]     live: [{ href, label }]
//
// Normalising here rather than in useWebsiteContent keeps the fix next to the
// markup that depends on the shape. The real fix is to make website_motability
// and website_footer agree with the static modules; until then the page must
// not die over it.
const rangeBrandsOut = (rangeBrands) =>
  (Array.isArray(rangeBrands) ? rangeBrands : []).map((rb) =>
    typeof rb === "string"
      ? { brand: rb, models: [] }
      : { brand: rb?.brand || "", models: Array.isArray(rb?.models) ? rb.models : [] },
  );

// footer.legal is normalised inside components/WebsiteFooter.js (resolveLegalLinks),
// which also keeps every link on the customer site.

/* ------------------------------------------------------------------ */
/* Removable-content guards                                            */
/* ------------------------------------------------------------------ */
// Every section on this page is drawn from a code module under
// src/features/website/data (see codeOwnedContent.js), and every entry in
// those modules is meant to be deletable — delete the object, the card is
// gone. So "empty" is a legitimate state for any list or slot here, and the
// page has to read well in it: no empty grid with section padding around it,
// no heading over nothing, and no crash reading a field of a record that was
// removed.
//
//   asList()  anything missing / malformed reads as an empty list
//   isBlank() a content slot with nothing left in it
//
// A block whose content is entirely gone returns null from its renderer, so
// the section, its anchor and its scroll-spy entry all disappear together.
const asList = (v) => (Array.isArray(v) ? v : []);
const isBlank = (slot) =>
  !slot ||
  Object.values(slot).every(
    (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0)
  );

function HoursTable({ caption, rows }) {
  const hours = asList(rows);
  // Delete every line of opening hours and the caption goes with the table,
  // rather than leaving a heading over an empty box.
  if (!hours.length) return null;
  return (
    <div className="ws-hours">
      {caption ? <p className="ws-hours-caption">{caption}</p> : null}
      <table className="ws-hours-table">
        <tbody>
          {hours.map((r) => (
            <tr key={r.days}>
              <th scope="row">{r.days}</th>
              <td>{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WebsitePage() {
  useWebsiteScope();

  // Source of truth: starts as the static modules, swaps to the live DB
  // content (via /api/website/content) once the fetch resolves. Edits made
  // in /website-manager appear here after the page is re-loaded.
  // When ?preview=editor is set we are inside the staff Live Preview iframe;
  // useWebsiteContent additionally accepts postMessage patches so staff edits
  // appear instantly as they type.
  const { content } = useWebsiteContent();
  // sectionPreview is set when the page is embedded by the website-manager
  // Preview tab as `?preview=section&block=…`: only those blocks render, and
  // the site chrome is left off, so the staff tab shows the real section
  // content inline under its own tab row.
  const { isPreview, highlightedSection, sectionPreview } = useWebsitePreviewMode();
  const click = (sectionKey, sectionLabel, rowId, as) => ({
    isPreview,
    isHighlighted: highlightedSection === sectionKey,
    sectionKey,
    sectionLabel,
    rowId,
    as,
  });
  const {
    siteContent,
    offers,
    reviews,
    team,
    teamDepartments,
    timeline,
    blogPosts,
    brands: brandLogos,
    navLinks,
    sectionLayout,
    design,
  } = content;
  // Defaults for the singleton slots: a slot that has been emptied out in
  // src/features/website/data/siteContent.js reads as {} here rather than
  // undefined, so the blocks below can ask what is left in it without
  // guarding every single field access.
  const {
    brand = {},
    hero = {},
    trustPoints,
    ratings,
    reviewCta,
    about = {},
    serviceAndParts = {},
    motability = {},
    sellYourCar = {},
    contact = {},
    promise = {},
    customerLinks,
    footer = {},
  } = siteContent;

  // The customer site is light-only — see useWebsiteTheme.
  useWebsiteTheme();

  // Design settings reach every `.ws-*` rule as custom properties on the page
  // root. Custom properties are not visual style declarations in their own
  // right, so this stays clear of the inline-styling ban (CLAUDE.md §3.0b).
  const designVars = useMemo(() => designToCssVars(design), [design]);

  // The top bar always opens with "Home" (the hero). The live website_nav rows
  // predate it, so it is prepended unless a "#top" link is already present.
  const topBarLinks = useMemo(() => {
    const list = Array.isArray(navLinks) ? navLinks : [];
    return list.some((link) => link?.href === HOME_NAV_LINK.href) ? list : [HOME_NAV_LINK, ...list];
  }, [navLinks]);
  // The same links folded into the Buy / Servicing / About dropdowns
  // (NAV_GROUPS in data/siteDesign.js). Unlisted links stay top-level.
  const navItems = useMemo(() => groupNavLinks(topBarLinks), [topBarLinks]);
  // Which top-bar dropdown is open (a NAV_GROUPS id), or null. A press outside
  // the open group or Escape closes it; Escape hands focus back to its trigger.
  const [openNavGroup, setOpenNavGroup] = useState(null);
  useEffect(() => {
    if (!openNavGroup) return undefined;
    const selector = `[data-nav-group="${openNavGroup}"]`;
    const onPointerDown = (event) => {
      if (!event.target.closest?.(selector)) setOpenNavGroup(null);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpenNavGroup(null);
      document.querySelector(`${selector} > button`)?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openNavGroup]);

  const [menuOpen, setMenuOpen] = useState(false);
  // Our Cars search. Reads the DMS stock directly (src/lib/stock/vehicleStock.js)
  // through the same hook as /website/available-stock, so a filter means the
  // same thing on both. A section embed can pin the condition up front (the
  // manager's New and Used tabs are the same block with a different start).
  // The block is a teaser: a single row of up to FEATURED_VEHICLE_LIMIT cards
  // (the grid hides the ones that do not fit the width), and "View all cars"
  // hands the current filters to the search page.
  const carSearch = useStockSearch({
    initialFilters: { condition: sectionPreview?.carFilter || "all" },
    pageSize: FEATURED_VEHICLE_LIMIT,
  });
  // The filter grid is collapsed behind a toggle on narrow screens only.
  const [activeId, setActiveId] = useState("top");
  // Brand filter over the Motability vehicle cards ("all" or a brand name).
  const [motabilityBrand, setMotabilityBrand] = useState("all");
  const [visibleMotabilityCount, setVisibleMotabilityCount] = useState(5);
  // Which Help & Advice card has its "More info" popup open. Held as an id
  // rather than the article object so a content refresh cannot leave a stale
  // copy of an article on screen.
  const [openArticleId, setOpenArticleId] = useState(null);
  const [visibleGuideCount, setVisibleGuideCount] = useState(5);
  const [authState, setAuthState] = useState({
    loading: true,
    customer: null,
  });

  // A department with every member removed is dropped rather than rendered as
  // an empty heading — departments are a grouping of the team list, not
  // content of their own.
  const departments = useMemo(
    () =>
      asList(teamDepartments)
        .map((d) => ({ ...d, members: asList(team).filter((m) => m.department === d.id) }))
        .filter((d) => d.members.length),
    [team, teamDepartments],
  );

  // The Help & Advice article whose popup is open, resolved fresh from the
  // current content. An id that no longer exists reads as nothing open.
  const openArticle = useMemo(
    () => asList(blogPosts).find((p) => p.id === openArticleId) || null,
    [blogPosts, openArticleId],
  );

  // Only blocks that both have a layout row AND a renderer are drawn.
  const visibleBlocks = useMemo(
    () =>
      (Array.isArray(sectionLayout) ? sectionLayout : []).filter((row) => {
        if (!row || !BLOCK_KEYS.has(row.id)) return false;
        // A section embed draws its named blocks only. The brand-strip and
        // layout rules above still apply, so a block hidden on the live site
        // stays hidden in the manager too.
        if (sectionPreview && !sectionPreview.blocks.includes(row.id)) return false;
        return true;
      }),
    [sectionLayout, sectionPreview],
  );

  // Scroll-spy — highlight the nav entry for the section in view. Derived from
  // the layout so hiding or adding a block keeps the spy in step.
  const spyIds = useMemo(
    () => visibleBlocks.map((row) => row.anchor || row.id),
    [visibleBlocks],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const els = spyIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [spyIds]);

  // Customer auth status drives the header Login/Profile pill.
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

  const closeMenu = () => {
    setMenuOpen(false);
    setOpenNavGroup(null);
  };

  // Top-bar link: accent pill + aria-current while its section is in view.
  // Called at render, after handleNavClick below is defined.
  const isActiveNavLink = (link) => Boolean(activeId) && link?.href === `#${activeId}`;
  const renderNavLink = (link) => (
    <a
      key={link.id}
      href={link.href}
      className={isActiveNavLink(link) ? "ws-nav-link ws-nav-link--active" : "ws-nav-link"}
      aria-current={isActiveNavLink(link) ? "location" : undefined}
      onClick={handleNavClick(link)}
    >
      {link.label}
    </a>
  );

  const handleNavClick = (link) => () => {
    if (link.filter) carSearch.update({ condition: link.filter });
    closeMenu();
  };

  // Staff names in review quotes link to their Meet the Team card — only while
  // that block is actually on the page to link to.
  const staffLinksOn = departments.length > 0 && visibleBlocks.some((row) => row.id === "team");

  /* ---------------------------------------------------------------- */
  /* Block renderers — one per layout row id.                          */
  /* `row` supplies the anchor, tint and heading copy; anything the     */
  /* row leaves empty falls back to the section's own content record.   */
  /* ---------------------------------------------------------------- */
  const BLOCK_RENDERERS = {
    hero: (row) => {
      const rating = hero.rating || {};
      const location = hero.location || {};
      // The compact trust card: review score and where to find us. Laid over
      // the dealership photo, or under the intro copy when there is no photo.
      // Delete siteContent.hero.rating / .location and each item goes.
      const proof =
        rating.score || location.title ? (
          <div className={hero.backgroundUrl ? "ws-hero-proof" : "ws-hero-proof ws-hero-proof--inline"}>
            {rating.score ? (
              <a href={rating.href || "#reviews"} className="ws-hero-proof-item">
                <span className="ws-icon-badge">
                  <WebsiteIcon name="star" />
                </span>
                <span className="ws-hero-proof-text">
                  <span className="ws-hero-proof-title">
                    {rating.score}
                    <Stars rating={Math.round(Number(rating.score)) || 5} />
                  </span>
                  {rating.note ? <span className="ws-hero-proof-note">{rating.note}</span> : null}
                </span>
              </a>
            ) : null}
            {location.title ? (
              <a href={location.href || "#contact"} className="ws-hero-proof-item">
                <span className="ws-icon-badge">
                  <WebsiteIcon name="pin" />
                </span>
                <span className="ws-hero-proof-text">
                  <span className="ws-hero-proof-title">{location.title}</span>
                  {location.note ? <span className="ws-hero-proof-note">{location.note}</span> : null}
                </span>
              </a>
            ) : null}
          </div>
        ) : null;
      return (
        <PreviewClickTarget key={row.id} {...click("hero", "Hero banner")}>
          <section id={row.anchor || "top"} data-presentation="website-hero" className="ws-hero">
            <div className="ws-container ws-hero-inner">
              {/* Intro copy sits level with the top of the photo; the three
                  customer actions (find a car / book workshop / value my car)
                  fill the column beneath it. */}
              <div className="ws-hero-copy">
                <div className="ws-hero-intro">
                  {hero.eyebrow ? <span className="ws-eyebrow">{hero.eyebrow}</span> : null}
                  {hero.headline ? <h1 className="ws-h1">{hero.headline}</h1> : null}
                  {hero.subhead ? <p className="ws-lead">{hero.subhead}</p> : null}
                  {/* Remove a button from siteContent.hero.ctas and it goes; remove
                      them all and the row goes with them. */}
                  {asList(hero.ctas).length ? (
                    <div className="ws-hero-ctas">
                      {asList(hero.ctas).map((cta) => (
                        <a
                          key={cta.label}
                          href={cta.href}
                          className={cta.variant === "primary" ? "ws-btn ws-btn--primary" : "ws-btn ws-btn--ghost"}
                        >
                          {cta.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {hero.backgroundUrl ? null : proof}
                </div>
                <QuickActions />
              </div>
              {hero.backgroundUrl ? (
                <div className="ws-hero-media">
                  <img src={hero.backgroundUrl} alt={`${brand.name || "Dealership"} showroom`} loading="eager" />
                  {proof}
                </div>
              ) : null}
            </div>

            {asList(trustPoints).length ? (
              <PreviewClickTarget {...click("trust-points", "Trust highlights")}>
                <div className="ws-container">
                  <ul className="ws-trust">
                    {asList(trustPoints).map((t) => (
                      <li key={t.label} className="ws-trust-item">
                        {t.icon ? (
                          <span className="ws-icon-badge">
                            <WebsiteIcon name={t.icon} />
                          </span>
                        ) : null}
                        <span className="ws-trust-text">
                          <span className="ws-trust-value">{t.value}</span>
                          <span className="ws-trust-label">{t.label}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </PreviewClickTarget>
            ) : null}
          </section>
        </PreviewClickTarget>
      );
    },

    cars: (row) => (
      <PreviewClickTarget key={row.id} {...click("vehicles", "Featured vehicles")}>
        <Section id={row.anchor || "cars"} tint={row.tint}>
          <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} media={SECTION_HEAD_MEDIA.cars} />

          {/* ---- New / used quick view (full filters live on /website/available-stock) ---- */}
          <div className="ws-cars-search">
            <div className="ws-cars-search-head">
              <div className="ws-segmented" role="tablist" aria-label="New or used">
                {CONDITION_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={carSearch.filters.condition === tab.id}
                    className={carSearch.filters.condition === tab.id ? "ws-segmented-tab ws-segmented-tab--active" : "ws-segmented-tab"}
                    onClick={() => carSearch.update({ condition: tab.id })}
                  >
                    {tab.label}
                    <span className="ws-tab-count">{carSearch.tabCounts[tab.id]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---- Live count and sort ---- */}
          <div className="ws-stock-toolbar ws-cars-toolbar">
            <p className="ws-stock-count" aria-live="polite">
              <strong>{carSearch.total}</strong> {carSearch.total === 1 ? "vehicle" : "vehicles"} found
            </p>
            <div className="ws-stock-sort">
              <span className="ws-stock-label" aria-hidden="true">
                Sort by
              </span>
              <WebsiteNativeSelect
                value={carSearch.sort}
                onChange={carSearch.setSort}
                options={SORT_OPTIONS}
                placeholder=""
                aria-label="Sort vehicles"
              />
            </div>
          </div>

          {carSearch.shownCards.length ? (
            <div className="ws-grid ws-grid--cars-row">
              {carSearch.shownCards.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          ) : (
            // Stock comes from the DMS, so "none" is a real answer. Say so and
            // offer the way out rather than show an empty grid.
            <div className="ws-card ws-stock-empty">
              <h3 className="ws-h3">No cars match those filters</h3>
              <p className="ws-muted">Try removing a filter, or tell us what you are after below.</p>
              <div className="ws-stock-empty-actions">
                <button type="button" onClick={carSearch.clearAll}>
                  Clear filters
                </button>
              </div>
            </div>
          )}

          {/* ---- End of the stock list ---- */}
          {carSearch.total ? (
            <div className="ws-cars-end">
              <p className="ws-section-more-note">
                A selection of our {carSearch.total}{" "}
                {carSearch.total === 1 ? "vehicle" : "vehicles"} in stock
              </p>
              <div className="ws-cars-end-actions">
                {/* Carries every filter and the sort to the full search. */}
                <Link
                  href={{ pathname: "/website/available-stock", query: carSearch.query }}
                  className="ws-btn ws-btn--primary"
                >
                  View all cars
                </Link>
              </div>
            </div>
          ) : null}

          <div className="ws-card ws-cars-enquiry">
            <div>
              <h3 className="ws-h3">Can’t find the right car?</h3>
              <p className="ws-muted">
                Tell us the model, budget and must-haves, and our sales team will look through new
                arrivals and part-exchanges for you.
              </p>
            </div>
            <a href="#contact" className="ws-btn ws-btn--ghost">
              Make an enquiry
            </a>
          </div>
        </Section>
      </PreviewClickTarget>
    ),

    // Delete the last card from data/offers.js (or let them all expire) and
    // the whole Offers section comes off the page — no heading over an empty
    // grid. Filters and cards live in components/OffersSection.js.
    offers: (row) =>
      liveOffers(offers).length ? (
        <PreviewClickTarget key={row.id} {...click("offers", "Manufacturer offers")}>
          <Section id={row.anchor || "offers"} tint={row.tint}>
            <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} media={SECTION_HEAD_MEDIA.offers} />
            <OffersSection offers={offers} />
          </Section>
        </PreviewClickTarget>
      ) : null,

    shop: (row) => (
      <Section key={row.id} id={row.anchor || "shop"} tint={row.tint}>
        <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} media={SECTION_HEAD_MEDIA.shop} />
        <ShopSection />
      </Section>
    ),

    // Lead-focused: the heading and a compact three-step list sit beside the
    // valuation form, with the benefit cards underneath. Every part is its own
    // entry in siteContent.sellYourCar and drops out on its own when removed.
    sell: (row) => {
      if (isBlank(sellYourCar)) return null;
      const steps = asList(sellYourCar.steps);
      const cta = sellYourCar.cta;
      // The form hands its answers to an internal route (the valuation wizard).
      // If the CTA has been pointed at a tel: link or an anchor instead, a
      // plain button is the honest control.
      const internalCta = String(cta?.href || "").startsWith("/");
      return (
        <PreviewClickTarget key={row.id} {...click("sell-your-car", "Sell Your Car")}>
          <Section id={row.anchor || "sell"} tint={row.tint}>
            <div className="ws-sell-layout">
              <div className="ws-sell-intro">
                <SectionHead
                  eyebrow={row.eyebrow || sellYourCar.eyebrow}
                  title={row.title || sellYourCar.title}
                  lead={row.lead || sellYourCar.lead}
                />
                {steps.length ? (
                  <ol className="ws-steps-compact">
                    {steps.map((s) => (
                      <li key={s.n || s.title} className="ws-step-compact">
                        {s.n ? (
                          <span className="ws-step-compact-n" aria-hidden="true">
                            {s.n}
                          </span>
                        ) : null}
                        <div>
                          {s.title ? <h3 className="ws-card-title">{s.title}</h3> : null}
                          {s.body ? <p className="ws-muted">{s.body}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
              {cta?.label && internalCta ? (
                <SellValuationPanel ctaLabel={cta.label} href={cta.href} />
              ) : cta?.label ? (
                <a href={cta.href || "#contact"} className="ws-btn ws-btn--primary">
                  {cta.label}
                </a>
              ) : null}
            </div>
            <div className="ws-section-block">
              <BenefitCards items={sellYourCar.benefitCards} compact />
            </div>
          </Section>
        </PreviewClickTarget>
      );
    },

    // Action cards for each workshop and parts service beside the booking
    // panel, then the workshop photo with the technician / courtesy-car cards.
    service: (row) => {
      if (isBlank(serviceAndParts)) return null;
      // A service that books through the workshop links to the appointment
      // page with its request prefilled; one with its own href goes there.
      const services = asList(serviceAndParts.services).map((s) => ({
        ...s,
        href:
          s.href ||
          (s.request ? `/website/request-appointment?request=${encodeURIComponent(s.request)}` : null),
      }));
      const highlights = asList(serviceAndParts.highlights);
      const booking = serviceAndParts.booking || {};
      return (
        <PreviewClickTarget key={row.id} {...click("service-parts", "Service & Parts")}>
          <Section id={row.anchor || "service"} tint={row.tint}>
            <SectionHead
              eyebrow={row.eyebrow || serviceAndParts.eyebrow}
              title={row.title || serviceAndParts.title}
              lead={row.lead || asList(serviceAndParts.body)[0]}
              media={SECTION_HEAD_MEDIA.service}
            />
            <div className="ws-service-layout">
              <BenefitCards items={services} />
              <WorkshopBookingPanel
                services={services}
                title={booking.title}
                body={booking.body}
                ctaLabel={booking.cta}
              >
                <HoursTable caption="Service hours" rows={serviceAndParts.hours} />
              </WorkshopBookingPanel>
            </div>
            {serviceAndParts.imageUrl || highlights.length ? (
              <div className="ws-section-block ws-service-highlights">
                {serviceAndParts.imageUrl ? (
                  <div className="ws-split-media">
                    <img src={serviceAndParts.imageUrl} alt="Service workshop and waiting area" loading="lazy" />
                  </div>
                ) : null}
                {highlights.length ? <BenefitCards items={highlights} compact /> : null}
              </div>
            ) : null}
          </Section>
        </PreviewClickTarget>
      );
    },

    // Vehicle cards (filterable by brand), the scheme benefits, then the
    // specialist panel with team photos and the call-to-action.
    motability: (row) => {
      if (isBlank(motability)) return null;
      // siteContent.motability.models is the card list. rangeBrands (either
      // shape — see rangeBrandsOut) stands in as name-only cards if it is gone.
      const listed = asList(motability.models).filter((m) => m?.model);
      const models = listed.length
        ? listed
        : rangeBrandsOut(motability.rangeBrands).flatMap((rb) =>
            rb.models.map((m) => ({ id: `${rb.brand}-${m}`, brand: rb.brand, model: m })),
          );
      const brands = Array.from(new Set(models.map((m) => m.brand).filter(Boolean)));
      const shownModels =
        motabilityBrand === "all" || !brands.includes(motabilityBrand)
          ? models
          : models.filter((m) => m.brand === motabilityBrand);
      const specialist = motability.specialist || {};
      const specialistTeam = asList(specialist.teamIds)
        .map((id) => asList(team).find((m) => m.id === id))
        .filter((m) => m?.photo);
      const cta = motability.cta;
      return (
        <PreviewClickTarget key={row.id} {...click("motability", "Motability")}>
          <Section id={row.anchor || "motability"} tint={row.tint}>
            <SectionHead
              eyebrow={row.eyebrow || motability.eyebrow}
              title={row.title || motability.title}
              lead={row.lead || asList(motability.body)[1]}
              media={SECTION_HEAD_MEDIA.motability}
            />

            {models.length ? (
              <>
                {brands.length > 1 ? (
                  <div className="ws-segmented" role="tablist" aria-label="Filter Motability vehicles by brand">
                    {["all", ...brands].map((b) => (
                      <button
                        key={b}
                        type="button"
                        role="tab"
                        aria-selected={motabilityBrand === b}
                        className={motabilityBrand === b ? "ws-segmented-tab ws-segmented-tab--active" : "ws-segmented-tab"}
                        onClick={() => {
                          setMotabilityBrand(b);
                          setVisibleMotabilityCount(5);
                        }}
                      >
                        {b === "all" ? "All models" : b}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div
                  className="ws-grid ws-grid--models"
                  // Local five-column cap matches the ws-grid gap and stacks on smaller screens.
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(220px, calc((100% - 4 * clamp(16px, 2vw, 24px)) / 5))), 1fr))" }}
                >
                  {shownModels.slice(0, visibleMotabilityCount).map((m) => (
                    <MotabilityModelCard key={m.id || `${m.brand}-${m.model}`} model={m} />
                  ))}
                </div>
                {visibleMotabilityCount < shownModels.length ? (
                  <div className="ws-section-more">
                    <button
                      type="button"
                      className="ws-btn ws-btn--secondary"
                      onClick={() => setVisibleMotabilityCount((count) => count + 5)}
                    >
                      Show more
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {asList(motability.schemeBenefits).length ? (
              <>
                <div className="ws-subhead">
                  <h3 className="ws-h3">Included with the Motability Scheme</h3>
                </div>
                <BenefitCards items={motability.schemeBenefits} headingLevel={4} />
              </>
            ) : null}

            {specialist.title || cta?.label ? (
              <div className="ws-section-block ws-card ws-panel ws-specialist">
                {specialistTeam.length ? (
                  <ul className="ws-specialist-photos" aria-label="Our Motability team">
                    {specialistTeam.map((m) => (
                      <li key={m.id} className="ws-specialist-photo">
                        <img src={m.photo} alt={m.name} loading="lazy" />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="ws-specialist-copy">
                  <span className="ws-eyebrow">Motability specialists</span>
                  {specialist.title ? <h3 className="ws-h3">{specialist.title}</h3> : null}
                  {specialist.body || asList(motability.body)[0] ? (
                    <p className="ws-muted">{specialist.body || asList(motability.body)[0]}</p>
                  ) : null}
                  {motability.payments ? <p className="ws-price-line">{motability.payments}</p> : null}
                  <div className="ws-specialist-actions">
                    {cta?.label ? (
                      <a href={cta.href || "#contact"} className="ws-btn ws-btn--primary">
                        <WebsiteIcon name="phone" />
                        {cta.label}
                      </a>
                    ) : null}
                    <a href="#contact" className="ws-btn ws-btn--ghost">
                      Visit the showroom
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </Section>
        </PreviewClickTarget>
      );
    },

    // A short copy card with compact trust points beside the team photograph,
    // then the history timeline. Body, highlights, photo and milestones each
    // drop out on their own when removed from code.
    about: (row) => {
      const milestones = asList(timeline);
      if (isBlank(about) && !milestones.length) return null;
      return (
        <PreviewClickTarget key={row.id} {...click("about", "About Us")}>
          <Section id={row.anchor || "about"} tint={row.tint}>
            {isBlank(about) ? null : (
              <div className="ws-split ws-about">
                <div className="ws-card ws-panel ws-split-text ws-about-copy">
                  <SectionHead
                    eyebrow={row.eyebrow || about.eyebrow}
                    title={row.title || about.title}
                    lead={row.lead}
                  />
                  {asList(about.body).map((p) => (
                    <p key={p} className="ws-muted">
                      {p}
                    </p>
                  ))}
                  <BenefitCards items={about.highlights} compact />
                </div>
                {about.imageUrl ? (
                  <div className="ws-split-media">
                    <img src={about.imageUrl} alt={`The ${brand.name || "dealership"} team`} loading="lazy" />
                  </div>
                ) : null}
              </div>
            )}

            {/* Empty the timeline in data/timeline.js and its heading goes too;
                the About card above stays. */}
            {milestones.length ? (
              <PreviewClickTarget {...click("timeline", "Timeline")}>
                <HistoryTimeline milestones={milestones} />
              </PreviewClickTarget>
            ) : null}
          </Section>
        </PreviewClickTarget>
      );
    },

    // Overall rating beside per-platform cards, topic filters and a carousel of
    // featured quotes — all in components/ReviewsPanel.js. Ratings, quotes and
    // the "Leave a review" button are separate lists in code; the block only
    // disappears when all three are gone.
    reviews: (row) => {
      const ratingList = asList(ratings);
      const reviewList = asList(reviews);
      if (!ratingList.length && !reviewList.length && !reviewCta?.href) return null;
      return (
        <PreviewClickTarget key={row.id} {...click("reviews", "Customer reviews")}>
          <Section id={row.anchor || "reviews"} tint={row.tint}>
            <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} center />
            <ReviewsPanel
              ratings={ratingList}
              reviews={reviewList}
              topics={reviewTopics}
              team={team}
              reviewCta={reviewCta}
              featuredLimit={FEATURED_REVIEW_LIMIT}
              linkStaff={staffLinksOn}
            />
          </Section>
        </PreviewClickTarget>
      );
    },

    // Every member removed from data/team.js takes the block with them.
    team: (row) =>
      departments.length ? (
      <PreviewClickTarget key={row.id} {...click("team-members", "Team members")}>
        <Section id={row.anchor || "team"} tint={row.tint}>
          <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} center />
          {/* Departments sit side by side across the full width. */}
          <div className="ws-team-groups">
          {departments.map((dep) => (
            <div key={dep.id} className="ws-team-group">
              <h3 className="ws-h3">{dep.label}</h3>
              <div className="ws-grid ws-grid--team">
                {dep.members.map((m) => (
                  <article key={m.id} id={`team-member-${m.id}`} className="ws-card ws-member">
                    {m.photo ? (
                      <div className="ws-member-photo">
                        <img src={m.photo} alt={m.name} loading="lazy" />
                      </div>
                    ) : null}
                    <div className="ws-card-body">
                      <h4 className="ws-card-title">{m.name}</h4>
                      {m.role ? <span className="ws-muted">{m.role}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
          </div>
        </Section>
      </PreviewClickTarget>
      ) : null,

    // Help & Advice. Each card answers one question customers actually ask and
    // opens the full answer in HelpArticleModal, so the grid stays scannable.
    // Delete the last entry from data/blogPosts.js and the block goes.
    blog: (row) =>
      asList(blogPosts).length ? (
        <PreviewClickTarget key={row.id} {...click("blog-posts", "Help & advice")}>
          <Section id={row.anchor || "blog"} tint={row.tint}>
            <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} />
            <div
              className="ws-grid ws-grid--cards"
              // Local five-column cap matches the ws-grid gap and stacks on smaller screens.
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(220px, calc((100% - 4 * clamp(16px, 2vw, 24px)) / 5))), 1fr))" }}
            >
              {asList(blogPosts).slice(0, visibleGuideCount).map((post) => (
                <article key={post.id} className="ws-card">
                  {post.image ? (
                    <div className="ws-help-media">
                      <img src={post.image} alt={post.title} loading="lazy" />
                      {post.category ? (
                        <span className="ws-chip ws-chip--accent ws-help-category">
                          {post.category}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="ws-card-body ws-help-body">
                    {post.date || post.readTime ? (
                      <span className="ws-muted ws-help-meta">
                        {[post.date, post.readTime].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    <h3 className="ws-card-title">{post.title}</h3>
                    {post.excerpt ? <p className="ws-muted">{post.excerpt}</p> : null}
                    {/* Only a card with `detail` has anything to show in the
                        popup — one without it stays a plain card. */}
                    {post.detail ? (
                      <div className="ws-help-actions">
                        {/* A raw <button> is the /website secondary control
                            (custglobal.css @family controls); `.app-btn` is
                            reserved for the one primary action per view. */}
                        <button
                          type="button"
                          className="ws-help-more"
                          onClick={() => setOpenArticleId(post.id)}
                          aria-haspopup="dialog"
                        >
                          More info
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            {visibleGuideCount < asList(blogPosts).length ? (
              <div className="ws-section-more">
                <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setVisibleGuideCount((count) => count + 5)}>
                  Show more
                </button>
              </div>
            ) : null}
          </Section>
        </PreviewClickTarget>
      ) : null,

    // Our promise, the visit call-to-action, then the contact details and map.
    contact: (row) => {
      const promiseItems = asList(promise.items);
      if (isBlank(contact) && !promiseItems.length) return null;
      const address = asList(contact.address);
      const salesHours = asList(contact.salesHours);
      const serviceHours = asList(contact.serviceHours);
      const socials = asList(contact.socials);
      return (
        <PreviewClickTarget key={row.id} {...click("contact", "Contact details")}>
          <Section id={row.anchor || "contact"} tint={row.tint}>
            <SectionHead
              eyebrow={row.eyebrow || contact.eyebrow}
              title={row.title || contact.title}
              lead={row.lead}
              center
            />
            {promiseItems.length ? (
              <div className="ws-promise">
                <div className="ws-promise-head">
                  {promise.eyebrow ? <span className="ws-eyebrow">{promise.eyebrow}</span> : null}
                  {promise.title ? <h3 className="ws-h3">{promise.title}</h3> : null}
                </div>
                <BenefitCards items={promiseItems} headingLevel={4} />
              </div>
            ) : null}
            <VisitCta visit={contact.visit} />
            {/* Phone, address, hours, socials and the map are five independent
                entries in siteContent.contact — each block only renders while
                its own content is still there, so removing one does not leave
                a labelled but empty panel behind. */}
            {isBlank(contact) ? null : (
            <div className="ws-contact">
              <div className="ws-card ws-panel ws-contact-details">
                {contact.phone ? (
                  <div className="ws-contact-block">
                    <span className="ws-eyebrow">Call us</span>
                    <a href={contact.phoneHref || `tel:${contact.phone}`} className="ws-contact-phone">
                      {contact.phone}
                    </a>
                  </div>
                ) : null}
                {address.length ? (
                  <div className="ws-contact-block">
                    <span className="ws-eyebrow">Visit us</span>
                    <address className="ws-contact-address">
                      {address.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </address>
                  </div>
                ) : null}
                {salesHours.length || serviceHours.length ? (
                  <div className="ws-contact-block ws-contact-block--wide">
                    <span className="ws-eyebrow">Opening Times</span>
                    <div className="ws-contact-hours">
                      <HoursTable caption="Sales hours" rows={salesHours} />
                      <HoursTable caption="Service hours" rows={serviceHours} />
                    </div>
                  </div>
                ) : null}
                {socials.length ? (
                  <div className="ws-socials">
                    {socials.map((s) => (
                      <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="ws-btn ws-btn--ghost">
                        {s.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              {contact.mapEmbed ? (
                <div className="ws-card ws-contact-map">
                  <iframe
                    title={`${brand.name || "Dealership"} location`}
                    src={contact.mapEmbed}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}
            </div>
            )}
          </Section>
        </PreviewClickTarget>
      );
    },
  };

  return (
    <>
      <Head>
        <title>{brand.name} — Family-run Suzuki &amp; Mitsubishi dealer in Kent</title>
        <meta
          name="description"
          content="Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing, MOTs and parts."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="ws-page" data-presentation="website-home" style={designVars}>
        {/* ---------------- Top navigation ---------------- */}
        {/* Section embeds are one block on their own — no nav, no footer. */}
        {sectionPreview ? null : (
          <WebsiteTopBar
            label="Primary"
            brandHref="#top"
            brandAlt={brand.name || "Humphries & Parks"}
            contact={contact}
            design={design}
            sessionLoading={authState.loading}
            customer={authState.customer}
            onNavigate={closeMenu}
            className="ws-nav--grouped"
            menu={{ open: menuOpen, onToggle: () => setMenuOpen((v) => !v) }}
          >
            {navItems.map((item) =>
              item.type === "group" ? (
                <WebsiteNavGroup
                  key={`group-${item.group.id}`}
                  id={item.group.id}
                  label={item.group.label}
                  active={item.links.some(isActiveNavLink)}
                  open={openNavGroup === item.group.id}
                  onToggle={() => setOpenNavGroup((v) => (v === item.group.id ? null : item.group.id))}
                >
                  {item.links.map(renderNavLink)}
                </WebsiteNavGroup>
              ) : (
                renderNavLink(item.link)
              ),
            )}
          </WebsiteTopBar>
        )}

        <main>{visibleBlocks.map((row) => BLOCK_RENDERERS[row.id](row))}</main>

        {/* Pinned compare tray — renders nothing until a card is added. */}
        {sectionPreview ? null : <VehicleCompareBar />}

        {/* ---------------- Footer ---------------- */}
        {sectionPreview ? null : (
          <PreviewClickTarget {...click("footer", "Footer", null, "div")}>
            <WebsiteFooter
              brand={brand}
              contact={contact}
              footer={footer}
              brands={brandLogos}
              links={customerLinks}
            />
          </PreviewClickTarget>
        )}

        {/* One dialog for the whole Help & Advice grid — it renders nothing
            until a card's "More info" is pressed. */}
        <HelpArticleModal article={openArticle} onClose={() => setOpenArticleId(null)} />
      </div>
    </>
  );
}

// Every block this page knows how to draw. Kept outside the component so the
// visibility filter can consult it without re-creating the renderer closures.
// Adding a block = add a renderer above AND its key here AND a row in
// website_section_layout.
const BLOCK_KEYS = new Set([
  "hero",
  "cars",
  "offers",
  "shop",
  "sell",
  "service",
  "motability",
  "about",
  "reviews",
  "team",
  "blog",
  "contact",
]);
