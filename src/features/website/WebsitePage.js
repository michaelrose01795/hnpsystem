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
import ShopSection from "./components/ShopSection";
import VehicleCard from "./components/VehicleCard";
import HelpArticleModal from "./components/HelpArticleModal";
import { designToCssVars } from "./data/siteDesign";
import { FEATURED_VEHICLE_LIMIT } from "./data/vehicles";

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

function SectionHead({ eyebrow, title, lead, center }) {
  if (!eyebrow && !title && !lead) return null;
  return (
    <header className={center ? "ws-head ws-head--center" : "ws-head"}>
      {eyebrow ? <span className="ws-eyebrow">{eyebrow}</span> : null}
      {title ? <h2 className="ws-h2">{title}</h2> : null}
      {lead ? <p className="ws-lead">{lead}</p> : null}
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

const legalLinksOut = (legal) =>
  (Array.isArray(legal) ? legal : [])
    .map((entry) =>
      typeof entry === "string"
        ? { label: entry, href: "#top" }
        : { label: entry?.label || "", href: entry?.href || "#top" },
    )
    .filter((entry) => entry.label);

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

function Stars({ rating }) {
  return (
    <span className="ws-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "ws-star ws-star--on" : "ws-star"}>
          ★
        </span>
      ))}
    </span>
  );
}

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
    vehicles,
    offers,
    reviews,
    team,
    teamDepartments,
    timeline,
    brands,
    blogPosts,
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
    footer = {},
  } = siteContent;

  // The customer site is light-only — see useWebsiteTheme.
  useWebsiteTheme();

  // Design settings reach every `.ws-*` rule as custom properties on the page
  // root. Custom properties are not visual style declarations in their own
  // right, so this stays clear of the inline-styling ban (CLAUDE.md §3.0b).
  const designVars = useMemo(() => designToCssVars(design), [design]);

  const [menuOpen, setMenuOpen] = useState(false);
  // A section embed can pin the Cars filter up front (the manager's New and
  // Used tabs are the same block with a different starting filter).
  const [carFilter, setCarFilter] = useState(sectionPreview?.carFilter || "all");
  const [activeId, setActiveId] = useState("top");
  // Which Help & Advice card has its "More info" popup open. Held as an id
  // rather than the article object so a content refresh cannot leave a stale
  // copy of an article on screen.
  const [openArticleId, setOpenArticleId] = useState(null);
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

  // The Cars block is a teaser, not the stock list: at most
  // FEATURED_VEHICLE_LIMIT cards on any tab, with "Show more" handing off to
  // the full /website/available-stock search carrying the same filter.
  const matchingVehicles = useMemo(
    () =>
      carFilter === "all"
        ? asList(vehicles)
        : asList(vehicles).filter((v) => v.type === carFilter),
    [carFilter, vehicles],
  );
  const shownVehicles = useMemo(
    () => matchingVehicles.slice(0, FEATURED_VEHICLE_LIMIT),
    [matchingVehicles],
  );

  // The Help & Advice article whose popup is open, resolved fresh from the
  // current content. An id that no longer exists reads as nothing open.
  const openArticle = useMemo(
    () => asList(blogPosts).find((p) => p.id === openArticleId) || null,
    [blogPosts, openArticleId],
  );

  // Only blocks that both have a layout row AND a renderer are drawn. The
  // brand strip carries an extra design switch on top of its layout status.
  const visibleBlocks = useMemo(
    () =>
      (Array.isArray(sectionLayout) ? sectionLayout : []).filter((row) => {
        if (!row || !BLOCK_KEYS.has(row.id)) return false;
        if (row.id === "brands" && design?.showBrandStrip === false) return false;
        // A section embed draws its named blocks only. The brand-strip and
        // layout rules above still apply, so a block hidden on the live site
        // stays hidden in the manager too.
        if (sectionPreview && !sectionPreview.blocks.includes(row.id)) return false;
        return true;
      }),
    [sectionLayout, design?.showBrandStrip, sectionPreview],
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

  const closeMenu = () => setMenuOpen(false);

  const handleNavClick = (link) => () => {
    if (link.filter) setCarFilter(link.filter);
    closeMenu();
  };

  const customerFirstName =
    (authState.customer?.firstname || "").trim() ||
    (authState.customer?.name || "").trim().split(" ")[0] ||
    "Account";

  const year = new Date().getFullYear();

  /* ---------------------------------------------------------------- */
  /* Block renderers — one per layout row id.                          */
  /* `row` supplies the anchor, tint and heading copy; anything the     */
  /* row leaves empty falls back to the section's own content record.   */
  /* ---------------------------------------------------------------- */
  const BLOCK_RENDERERS = {
    hero: (row) => (
      <PreviewClickTarget key={row.id} {...click("hero", "Hero banner")}>
        <section id={row.anchor || "top"} data-presentation="website-hero" className="ws-hero">
          <div className="ws-container ws-hero-inner">
            <div className="ws-hero-text">
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
            </div>
            {hero.backgroundUrl ? (
              <div className="ws-hero-media">
                <img src={hero.backgroundUrl} alt={`${brand.name || "Dealership"} showroom`} loading="eager" />
              </div>
            ) : null}
          </div>

          {asList(trustPoints).length ? (
            <PreviewClickTarget {...click("trust-points", "Trust highlights")}>
              <div className="ws-container">
                <ul className="ws-trust">
                  {asList(trustPoints).map((t) => (
                    <li key={t.label} className="ws-trust-item">
                      <span className="ws-trust-value">{t.value}</span>
                      <span className="ws-trust-label">{t.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </PreviewClickTarget>
          ) : null}
        </section>
      </PreviewClickTarget>
    ),

    // Remove every logo from data/brands.js and the strip disappears rather
    // than leaving a label with nothing after it.
    brands: (row) =>
      asList(brands).length ? (
        <PreviewClickTarget key={row.id} {...click("partner-brands", "Partner brand strip")}>
          <section
            id={row.anchor || "brands"}
            className={row.tint ? "ws-section ws-section--tint ws-brands" : "ws-section ws-brands"}
          >
            <div className="ws-container ws-brands-inner">
              <span className="ws-brands-label">{row.title || "Authorised retailer for"}</span>
              <ul className="ws-brands-list">
                {asList(brands).map((b) => (
                  <li key={b.name}>
                    <img src={b.logo} alt={b.name} loading="lazy" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </PreviewClickTarget>
      ) : null,

    cars: (row) => (
      <PreviewClickTarget key={row.id} {...click("vehicles", "Featured vehicles")}>
        <Section id={row.anchor || "cars"} tint={row.tint}>
          <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} />
          <div className="ws-tabs" role="tablist" aria-label="Filter cars">
            {[
              { id: "all", label: "All cars" },
              { id: "new", label: "New" },
              { id: "used", label: "Used" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={carFilter === tab.id}
                className={carFilter === tab.id ? "ws-tab ws-tab--active" : "ws-tab"}
                onClick={() => setCarFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {shownVehicles.length ? (
            <div className="ws-grid ws-grid--cards">
              {shownVehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          ) : (
            // Stock comes from the DMS, so "none" is a real answer — on the
            // New / Used tabs especially. Say so rather than show an empty grid.
            <p className="ws-muted">
              {carFilter === "all"
                ? "There are no vehicles in stock right now. Please check back soon or call us."
                : `No ${carFilter} vehicles in stock right now — try the other tabs, or call us.`}
            </p>
          )}
          {/* Hands the visitor's current tab to the search page so the New /
              Used choice they made here is already applied when it opens. */}
          <div className="ws-section-more">
            <Link
              href={{ pathname: "/website/available-stock", query: { filter: carFilter } }}
              className="ws-btn ws-btn--primary"
            >
              Show more
            </Link>
            <span className="ws-section-more-note">
              {matchingVehicles.length > shownVehicles.length
                ? `Showing ${shownVehicles.length} of ${matchingVehicles.length} vehicles in stock`
                : `${matchingVehicles.length} vehicle${matchingVehicles.length === 1 ? "" : "s"} in stock`}
            </span>
          </div>
        </Section>
      </PreviewClickTarget>
    ),

    // Delete the last card from data/offers.js and the whole Offers section
    // comes off the page — no heading over an empty grid.
    offers: (row) =>
      asList(offers).length ? (
        <PreviewClickTarget key={row.id} {...click("offers", "Manufacturer offers")}>
          <Section id={row.anchor || "offers"} tint={row.tint}>
            <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} />
            <div className="ws-grid ws-grid--cards">
              {asList(offers).map((o) => (
                <article key={o.id} className="ws-card ws-offer">
                  {o.image ? (
                    <div className="ws-offer-media">
                      <img src={o.image} alt={o.title} loading="lazy" />
                    </div>
                  ) : null}
                  <div className="ws-card-body">
                    {o.title ? <span className="ws-eyebrow">{o.title}</span> : null}
                    {o.headline ? <h3 className="ws-card-title">{o.headline}</h3> : null}
                    {o.body ? <p className="ws-muted">{o.body}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </Section>
        </PreviewClickTarget>
      ) : null,

    shop: (row) => (
      <Section key={row.id} id={row.anchor || "shop"} tint={row.tint}>
        <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} />
        <ShopSection />
      </Section>
    ),

    sell: (row) => {
      if (isBlank(sellYourCar)) return null;
      const steps = asList(sellYourCar.steps);
      const benefits = asList(sellYourCar.benefits);
      const cta = sellYourCar.cta;
      return (
        <PreviewClickTarget key={row.id} {...click("sell-your-car", "Sell Your Car")}>
          <Section id={row.anchor || "sell"} tint={row.tint}>
            <SectionHead
              eyebrow={row.eyebrow || sellYourCar.eyebrow}
              title={row.title || sellYourCar.title}
              lead={row.lead}
            />
            {steps.length ? (
              <div className="ws-grid ws-grid--steps">
                {steps.map((s) => (
                  <article key={s.n} className="ws-card ws-step">
                    {s.n ? <span className="ws-step-n">{s.n}</span> : null}
                    {s.title ? <h3 className="ws-card-title">{s.title}</h3> : null}
                    {s.body ? <p className="ws-muted">{s.body}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}
            {/* The tick list and the valuation button share one panel, so the
                panel itself only appears while at least one of them is left in
                siteContent.sellYourCar. */}
            {benefits.length || cta?.label ? (
              <div className="ws-card ws-panel ws-sell-panel">
                {benefits.length ? (
                  <ul className="ws-ticks">
                    {benefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
                {/* The CTA points at /website/valuation, but the href is set in
                    siteContent.sellYourCar.cta and may equally be an on-page
                    anchor or a tel: link. Route it through <Link> only when it
                    is an internal path, so the valuation wizard opens as a
                    client navigation rather than a full reload. */}
                {cta?.label ? (
                  String(cta.href || "").startsWith("/") ? (
                    <Link href={cta.href} className="ws-btn ws-btn--primary">
                      {cta.label}
                    </Link>
                  ) : (
                    <a href={cta.href || "#top"} className="ws-btn ws-btn--primary">
                      {cta.label}
                    </a>
                  )
                ) : null}
              </div>
            ) : null}
          </Section>
        </PreviewClickTarget>
      );
    },

    service: (row) => {
      if (isBlank(serviceAndParts)) return null;
      return (
        <PreviewClickTarget key={row.id} {...click("service-parts", "Service & Parts")}>
          <Section id={row.anchor || "service"} tint={row.tint}>
            {/* Drop the image and the text column takes the full width — the
                split only splits while there are two halves to split. */}
            <div className="ws-split">
              {serviceAndParts.imageUrl ? (
                <div className="ws-split-media">
                  <img src={serviceAndParts.imageUrl} alt="Service workshop and waiting area" loading="lazy" />
                </div>
              ) : null}
              <div className="ws-split-text">
                <SectionHead
                  eyebrow={row.eyebrow || serviceAndParts.eyebrow}
                  title={row.title || serviceAndParts.title}
                  lead={row.lead}
                />
                {asList(serviceAndParts.body).map((p) => (
                  <p key={p} className="ws-muted">
                    {p}
                  </p>
                ))}
                <HoursTable caption="Service hours" rows={serviceAndParts.hours} />
              </div>
            </div>
          </Section>
        </PreviewClickTarget>
      );
    },

    motability: (row) => {
      if (isBlank(motability)) return null;
      const ranges = rangeBrandsOut(motability.rangeBrands);
      const cta = motability.cta;
      return (
        <PreviewClickTarget key={row.id} {...click("motability", "Motability")}>
          <Section id={row.anchor || "motability"} tint={row.tint}>
            <div className="ws-split ws-split--reverse">
              <div className="ws-split-text">
                <SectionHead
                  eyebrow={row.eyebrow || motability.eyebrow}
                  title={row.title || motability.title}
                  lead={row.lead}
                />
                {asList(motability.body).map((p) => (
                  <p key={p} className="ws-muted">
                    {p}
                  </p>
                ))}
                {motability.payments ? (
                  <p className="ws-price-line">{motability.payments}</p>
                ) : null}
                {cta?.label ? (
                  <a href={cta.href || "#contact"} className="ws-btn ws-btn--primary">
                    {cta.label}
                  </a>
                ) : null}
              </div>
              {/* Remove a brand — or every model under it — from
                  siteContent.motability.rangeBrands and the card or chip row
                  goes with it. */}
              {ranges.length ? (
                <div className="ws-split-side">
                  {ranges.map((rb) => (
                    <div key={rb.brand} className="ws-card ws-range">
                      <h3 className="ws-card-title">{rb.brand}</h3>
                      {rb.models.length ? (
                        <ul className="ws-chips">
                          {rb.models.map((m) => (
                            <li key={m} className="ws-chip">
                              {m}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Section>
        </PreviewClickTarget>
      );
    },

    about: (row) => {
      const milestones = asList(timeline);
      if (isBlank(about) && !milestones.length) return null;
      return (
        <PreviewClickTarget key={row.id} {...click("about", "About Us")}>
          <Section id={row.anchor || "about"} tint={row.tint}>
            <div className="ws-split">
              <div className="ws-split-text">
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
              </div>
              {about.imageUrl ? (
                <div className="ws-split-media">
                  <img src={about.imageUrl} alt={`The ${brand.name || "dealership"} showroom`} loading="lazy" />
                </div>
              ) : null}
            </div>

            {/* Empty the timeline in data/timeline.js and its heading goes too;
                the About copy above stays. */}
            {milestones.length ? (
              <PreviewClickTarget {...click("timeline", "Timeline")}>
                <div className="ws-subhead">
                  <h3 className="ws-h3">Our story since 1947</h3>
                </div>
                <ol className="ws-timeline">
                  {milestones.map((t) => (
                    <li key={t.year} className="ws-card ws-milestone">
                      <span className="ws-milestone-year">{t.year}</span>
                      <h4 className="ws-card-title">{t.title}</h4>
                      <p className="ws-muted">{t.body}</p>
                    </li>
                  ))}
                </ol>
              </PreviewClickTarget>
            ) : null}
          </Section>
        </PreviewClickTarget>
      );
    },

    reviews: (row) => {
      const ratingList = asList(ratings);
      const reviewList = asList(reviews);
      // Ratings, quotes and the "Leave a review" strip are three separate
      // lists in code — the block only disappears when all three are gone.
      if (!ratingList.length && !reviewList.length && !reviewCta?.href) return null;
      return (
      <PreviewClickTarget key={row.id} {...click("reviews", "Customer reviews")}>
        <Section id={row.anchor || "reviews"} tint={row.tint}>
          <SectionHead eyebrow={row.eyebrow} title={row.title} lead={row.lead} center />
          {ratingList.length ? (
            <PreviewClickTarget {...click("ratings", "Review ratings")}>
              <ul className="ws-ratings">
                {ratingList.map((r) => (
                  <li key={r.source} className="ws-rating">
                    <span className="ws-rating-score">{r.score}</span>
                    <span className="ws-muted">{r.source}</span>
                  </li>
                ))}
              </ul>
            </PreviewClickTarget>
          ) : null}
          {reviewList.length ? (
            <div className="ws-grid ws-grid--reviews">
              {reviewList.map((rv) => (
                <article key={rv.id} className="ws-card ws-review">
                  <Stars rating={rv.rating} />
                  <p className="ws-review-quote">“{rv.quote}”</p>
                  <div className="ws-review-meta">
                    <span className="ws-review-name">{rv.name}</span>
                    <span className="ws-muted">
                      {rv.source} · {rv.date}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {/* Same "Show more" strip the vehicle teaser uses, so the reviews the
              visitor just read and the invitation to add one sit together. */}
          {reviewCta?.href ? (
            <div className="ws-section-more">
              <a
                href={reviewCta.href}
                target="_blank"
                rel="noreferrer"
                className="ws-btn ws-btn--primary"
              >
                {reviewCta.label || "Leave a review"}
              </a>
              {reviewCta.note ? (
                <span className="ws-section-more-note">{reviewCta.note}</span>
              ) : null}
            </div>
          ) : null}
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
          {departments.map((dep) => (
            <div key={dep.id} className="ws-team-group">
              <h3 className="ws-h3">{dep.label}</h3>
              <div className="ws-grid ws-grid--team">
                {dep.members.map((m) => (
                  <article key={m.id} className="ws-card ws-member">
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
            <div className="ws-grid ws-grid--cards">
              {asList(blogPosts).map((post) => (
                <article key={post.id} className="ws-card ws-help">
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
                        {/* `app-btn` is the /website secondary-action pill
                            (custglobal.css "Secondary action") — on a real
                            <button> it outranks .ws-btn--ghost, so use it
                            rather than fight it. */}
                        <button
                          type="button"
                          className="app-btn ws-help-more"
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
          </Section>
        </PreviewClickTarget>
      ) : null,

    contact: (row) => {
      if (isBlank(contact)) return null;
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
            {/* Phone, address, hours, socials and the map are five independent
                entries in siteContent.contact — each block only renders while
                its own content is still there, so removing one does not leave
                a labelled but empty panel behind. */}
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
                  <div className="ws-contact-block">
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
          <header className="ws-nav" data-presentation="website-nav">
            <div className="ws-nav-inner">
              <a href="#top" className="ws-brand" onClick={closeMenu}>
                <img className="ws-logo ws-logo--dark" src={brand.logoWhiteUrl} alt={brand.name} />
                <img className="ws-logo ws-logo--light" src={brand.logoUrl} alt={brand.name} />
              </a>

              <nav className={menuOpen ? "ws-nav-links ws-nav-links--open" : "ws-nav-links"} aria-label="Primary">
                {navLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    className={
                      activeId && link.href === `#${activeId}` ? "ws-nav-link ws-nav-link--active" : "ws-nav-link"
                    }
                    onClick={handleNavClick(link)}
                  >
                    {link.label}
                  </a>
                ))}
                {design?.showNavPhone === false || !contact.phone ? null : (
                  <a
                    href={contact.phoneHref || `tel:${contact.phone}`}
                    className="ws-nav-phone"
                    onClick={closeMenu}
                  >
                    {contact.phone}
                  </a>
                )}
                {design?.showNavAccount === false || authState.loading ? null : authState.customer ? (
                  <Link href="/website/profile" className="ws-nav-account ws-nav-account--profile" onClick={closeMenu}>
                    <span className="ws-nav-account-avatar" aria-hidden="true">
                      {(customerFirstName[0] || "A").toUpperCase()}
                    </span>
                    <span>{customerFirstName}</span>
                  </Link>
                ) : (
                  <Link href="/website/login" className="ws-nav-account" onClick={closeMenu}>
                    Login
                  </Link>
                )}
              </nav>

              <button
                type="button"
                className="ws-nav-toggle"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </header>
        )}

        <main>{visibleBlocks.map((row) => BLOCK_RENDERERS[row.id](row))}</main>

        {/* ---------------- Footer ---------------- */}
        {sectionPreview ? null : (
          <PreviewClickTarget {...click("footer", "Footer", null, "div")}>
          <footer className="ws-footer">
            <div className="ws-container ws-footer-inner">
              <div className="ws-footer-top">
                <img className="ws-logo ws-logo--dark" src={brand.logoWhiteUrl} alt={brand.name} />
                <img className="ws-logo ws-logo--light" src={brand.logoUrl} alt={brand.name} />
                {legalLinksOut(footer.legal).length ? (
                  <ul className="ws-footer-links">
                    {legalLinksOut(footer.legal).map((l) => (
                      <li key={l.label}>
                        <a href={l.href}>{l.label}</a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {footer.fcaReg ? <p className="ws-footer-legal">{footer.fcaReg}</p> : null}
              {footer.creditDisclosure ? (
                <p className="ws-footer-legal">{footer.creditDisclosure}</p>
              ) : null}
              <p className="ws-footer-copy">
                © {year} {brand.name} Limited. All rights reserved.
              </p>
            </div>
          </footer>
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
  "brands",
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
