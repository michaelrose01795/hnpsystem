// file location: src/features/website/WebsitePage.js
// Public marketing site at /website — full rebuild (2026-05-15).
//
// A plain, accessible, customer website marketing page. No 3D scene, no scroll
// animation library. Every visual style lives in src/styles/custglobal.css
// under `html.website-scope` (the `.ws-*` class family) and follows the
// light / dark choice via the `data-website-theme` attribute that
// useWebsiteTheme writes onto <html>. This component only supplies markup
// and a little local state (nav menu, vehicle filter, scroll-spy).

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";

import useWebsiteScope from "./hooks/useWebsiteScope";
import useWebsiteTheme from "./hooks/useWebsiteTheme";
import useWebsiteContent from "./hooks/useWebsiteContent";
import useWebsitePreviewMode from "./hooks/useWebsitePreviewMode";
import PreviewClickTarget from "./components/PreviewClickTarget";
import ShopSection from "./components/ShopSection";

// Primary navigation. "New" / "Used" jump to the cars section and also set
// the vehicle filter; the rest are plain anchor jumps.
const NAV_LINKS = [
  { label: "New", href: "#cars", filter: "new" },
  { label: "Used", href: "#cars", filter: "used" },
  { label: "Offers", href: "#offers" },
  { label: "Shop", href: "#shop" },
  { label: "Sell Your Car", href: "#sell" },
  { label: "Service & Parts", href: "#service" },
  { label: "Motability", href: "#motability" },
  { label: "About Us", href: "#about" },
  { label: "Blog", href: "#blog" },
  { label: "Contact Us", href: "#contact" },
];

// Section ids tracked by the scroll-spy so the nav can highlight the
// chapter currently in view.
const SPY_IDS = ["top", "cars", "offers", "shop", "sell", "service", "motability", "about", "blog", "contact"];

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
  return (
    <header className={center ? "ws-head ws-head--center" : "ws-head"}>
      {eyebrow ? <span className="ws-eyebrow">{eyebrow}</span> : null}
      <h2 className="ws-h2">{title}</h2>
      {lead ? <p className="ws-lead">{lead}</p> : null}
    </header>
  );
}

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
  return (
    <div className="ws-hours">
      {caption ? <p className="ws-hours-caption">{caption}</p> : null}
      <table className="ws-hours-table">
        <tbody>
          {rows.map((r) => (
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
  useWebsiteTheme();

  // Source of truth: starts as the static modules, swaps to the live DB
  // content (via /api/website/content) once the fetch resolves. Edits made
  // in /staff/website-manager appear here after the page is re-loaded.
  // When ?preview=editor is set we are inside the staff Live Preview iframe;
  // useWebsiteContent additionally accepts postMessage patches so staff edits
  // appear instantly as they type.
  const { content } = useWebsiteContent();
  const { isPreview, highlightedSection } = useWebsitePreviewMode();
  const click = (sectionKey, sectionLabel, rowId, as) => ({
    isPreview,
    isHighlighted: highlightedSection === sectionKey,
    sectionKey,
    sectionLabel,
    rowId,
    as,
  });
  const { siteContent, vehicles, offers, reviews, team, teamDepartments, timeline, brands, blogPosts } = content;
  const { brand, hero, trustPoints, ratings, about, serviceAndParts, motability, sellYourCar, contact, footer } =
    siteContent;

  const [menuOpen, setMenuOpen] = useState(false);
  const [carFilter, setCarFilter] = useState("all");
  const [activeId, setActiveId] = useState("top");
  const [authState, setAuthState] = useState({
    loading: true,
    customer: null,
  });

  const departments = useMemo(
    () => teamDepartments.map((d) => ({ ...d, members: team.filter((m) => m.department === d.id) })),
    [team, teamDepartments],
  );

  const shownVehicles = useMemo(
    () => (carFilter === "all" ? vehicles : vehicles.filter((v) => v.type === carFilter)),
    [carFilter, vehicles],
  );

  // Scroll-spy — highlight the nav entry for the section in view.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const els = SPY_IDS.map((id) => document.getElementById(id)).filter(Boolean);
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
  }, []);

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

  return (
    <>
      <Head>
        <title>{brand.name} — Family-run Suzuki, KGM &amp; Mitsubishi dealer in Kent</title>
        <meta
          name="description"
          content="Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing, MOTs and parts."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="ws-page" data-presentation="website-home">
        {/* ---------------- Top navigation ---------------- */}
        <header className="ws-nav" data-presentation="website-nav">
          <div className="ws-nav-inner">
            <a href="#top" className="ws-brand" onClick={closeMenu}>
              <img className="ws-logo ws-logo--dark" src={brand.logoWhiteUrl} alt={brand.name} />
              <img className="ws-logo ws-logo--light" src={brand.logoUrl} alt={brand.name} />
            </a>

            <nav className={menuOpen ? "ws-nav-links ws-nav-links--open" : "ws-nav-links"} aria-label="Primary">
              {NAV_LINKS.map((link, i) => (
                <a
                  key={`${link.label}-${i}`}
                  href={link.href}
                  className={activeId && link.href === `#${activeId}` ? "ws-nav-link ws-nav-link--active" : "ws-nav-link"}
                  onClick={handleNavClick(link)}
                >
                  {link.label}
                </a>
              ))}
              <a href={contact.phoneHref} className="ws-nav-phone" onClick={closeMenu}>
                {contact.phone}
              </a>
              {authState.loading ? null : authState.customer ? (
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

        <main>
          {/* ---------------- Hero ---------------- */}
          <PreviewClickTarget {...click("hero", "Hero banner")}>
            <section id="top" data-presentation="website-hero" className="ws-hero">
              <div className="ws-container ws-hero-inner">
                <div className="ws-hero-text">
                  <span className="ws-eyebrow">{hero.eyebrow}</span>
                  <h1 className="ws-h1">{hero.headline}</h1>
                  <p className="ws-lead">{hero.subhead}</p>
                  <div className="ws-hero-ctas">
                    {hero.ctas.map((cta) => (
                      <a
                        key={cta.label}
                        href={cta.href}
                        className={cta.variant === "primary" ? "ws-btn ws-btn--primary" : "ws-btn ws-btn--ghost"}
                      >
                        {cta.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="ws-hero-media">
                  <img src={hero.backgroundUrl} alt="Humphries & Parks showroom" loading="eager" />
                </div>
              </div>

              <PreviewClickTarget {...click("trust-points", "Trust highlights")}>
                <div className="ws-container">
                  <ul className="ws-trust">
                    {trustPoints.map((t) => (
                      <li key={t.label} className="ws-trust-item">
                        <span className="ws-trust-value">{t.value}</span>
                        <span className="ws-trust-label">{t.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </PreviewClickTarget>
            </section>
          </PreviewClickTarget>

          {/* ---------------- Brands ---------------- */}
          <PreviewClickTarget {...click("partner-brands", "Partner brand strip")}>
            <section className="ws-section ws-section--tint ws-brands">
              <div className="ws-container ws-brands-inner">
                <span className="ws-brands-label">Authorised retailer for</span>
                <ul className="ws-brands-list">
                  {brands.map((b) => (
                    <li key={b.name}>
                      <img src={b.logo} alt={b.name} loading="lazy" />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </PreviewClickTarget>

          {/* ---------------- Vehicles ---------------- */}
          <PreviewClickTarget {...click("vehicles", "Featured vehicles")}>
          <Section id="cars">
            <SectionHead
              eyebrow="Our Cars"
              title="Find your next car at Humphries & Parks"
              lead="Every used car arrives with a 120-point inspection, a minimum 6-month MOT and a free 6-month warranty. New Suzuki, KGM and Mitsubishi available with manufacturer offers."
            />
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
            <div className="ws-grid ws-grid--cards">
              {shownVehicles.map((v) => (
                <article key={v.id} className="ws-card ws-vehicle">
                  <div className="ws-vehicle-media">
                    <img src={v.image} alt={`${v.brand} ${v.model}`} loading="lazy" />
                    {v.badge ? <span className="ws-badge">{v.badge}</span> : null}
                  </div>
                  <div className="ws-card-body">
                    <span className="ws-vehicle-brand">
                      {v.brand} · {v.year}
                    </span>
                    <h3 className="ws-card-title">{v.model}</h3>
                    <p className="ws-vehicle-price">{v.price}</p>
                  </div>
                </article>
              ))}
            </div>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Offers ---------------- */}
          <PreviewClickTarget {...click("offers", "Manufacturer offers")}>
          <Section id="offers" tint>
            <SectionHead
              eyebrow="Latest Offers"
              title="Current manufacturer offers"
              lead="Finance and savings available across the Suzuki range — speak to the team for full terms."
            />
            <div className="ws-grid ws-grid--cards">
              {offers.map((o) => (
                <article key={o.id} className="ws-card ws-offer">
                  <div className="ws-offer-media">
                    <img src={o.image} alt={o.title} loading="lazy" />
                  </div>
                  <div className="ws-card-body">
                    <span className="ws-eyebrow">{o.title}</span>
                    <h3 className="ws-card-title">{o.headline}</h3>
                    <p className="ws-muted">{o.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Shop ---------------- */}
          <Section id="shop" tint>
            <SectionHead
              eyebrow="Shop"
              title="Parts & accessories"
              lead="Genuine Suzuki, KGM and Mitsubishi parts and accessories — shipped UK-wide. Add to cart and checkout in minutes."
            />
            <ShopSection />
          </Section>

          {/* ---------------- Sell your car ---------------- */}
          <PreviewClickTarget {...click("sell-your-car", "Sell Your Car")}>
          <Section id="sell">
            <SectionHead
              eyebrow={sellYourCar.eyebrow}
              title={sellYourCar.title}
              lead="We buy any car — any age, any mileage, any make — with free home collection and instant payment."
            />
            <div className="ws-grid ws-grid--steps">
              {sellYourCar.steps.map((s) => (
                <article key={s.n} className="ws-card ws-step">
                  <span className="ws-step-n">{s.n}</span>
                  <h3 className="ws-card-title">{s.title}</h3>
                  <p className="ws-muted">{s.body}</p>
                </article>
              ))}
            </div>
            <div className="ws-card ws-panel ws-sell-panel">
              <ul className="ws-ticks">
                {sellYourCar.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <a href={sellYourCar.cta.href} className="ws-btn ws-btn--primary">
                {sellYourCar.cta.label}
              </a>
            </div>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Service & parts ---------------- */}
          <PreviewClickTarget {...click("service-parts", "Service & Parts")}>
          <Section id="service" tint>
            <div className="ws-split">
              <div className="ws-split-media">
                <img src={serviceAndParts.imageUrl} alt="Service workshop and waiting area" loading="lazy" />
              </div>
              <div className="ws-split-text">
                <SectionHead eyebrow={serviceAndParts.eyebrow} title={serviceAndParts.title} />
                {serviceAndParts.body.map((p) => (
                  <p key={p} className="ws-muted">
                    {p}
                  </p>
                ))}
                <HoursTable caption="Service hours" rows={serviceAndParts.hours} />
              </div>
            </div>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Motability ---------------- */}
          <PreviewClickTarget {...click("motability", "Motability")}>
          <Section id="motability">
            <div className="ws-split ws-split--reverse">
              <div className="ws-split-text">
                <SectionHead eyebrow={motability.eyebrow} title={motability.title} />
                {motability.body.map((p) => (
                  <p key={p} className="ws-muted">
                    {p}
                  </p>
                ))}
                <p className="ws-price-line">{motability.payments}</p>
                <a href={motability.cta.href} className="ws-btn ws-btn--primary">
                  {motability.cta.label}
                </a>
              </div>
              <div className="ws-split-side">
                {motability.rangeBrands.map((rb) => (
                  <div key={rb.brand} className="ws-card ws-range">
                    <h3 className="ws-card-title">{rb.brand}</h3>
                    <ul className="ws-chips">
                      {rb.models.map((m) => (
                        <li key={m} className="ws-chip">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- About ---------------- */}
          <PreviewClickTarget {...click("about", "About Us")}>
          <Section id="about" tint>
            <div className="ws-split">
              <div className="ws-split-text">
                <SectionHead eyebrow={about.eyebrow} title={about.title} />
                {about.body.map((p) => (
                  <p key={p} className="ws-muted">
                    {p}
                  </p>
                ))}
              </div>
              <div className="ws-split-media">
                <img src={about.imageUrl} alt="The Humphries & Parks showroom" loading="lazy" />
              </div>
            </div>

            <PreviewClickTarget {...click("timeline", "Timeline")}>
              <div className="ws-subhead">
                <h3 className="ws-h3">Our story since 1947</h3>
              </div>
              <ol className="ws-timeline">
                {timeline.map((t) => (
                  <li key={t.year} className="ws-card ws-milestone">
                    <span className="ws-milestone-year">{t.year}</span>
                    <h4 className="ws-card-title">{t.title}</h4>
                    <p className="ws-muted">{t.body}</p>
                  </li>
                ))}
              </ol>
            </PreviewClickTarget>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Reviews ---------------- */}
          <PreviewClickTarget {...click("reviews", "Customer reviews")}>
          <Section id="reviews">
            <SectionHead
              eyebrow="Reviews"
              title="Why families across Kent keep coming back"
              lead="Independently verified reviews from AutoTrader, JudgeService, Google and Trustpilot."
              center
            />
            <PreviewClickTarget {...click("ratings", "Review ratings")}>
              <ul className="ws-ratings">
                {ratings.map((r) => (
                  <li key={r.source} className="ws-rating">
                    <span className="ws-rating-score">{r.score}</span>
                    <span className="ws-muted">{r.source}</span>
                  </li>
                ))}
              </ul>
            </PreviewClickTarget>
            <div className="ws-grid ws-grid--reviews">
              {reviews.map((rv) => (
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
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Team ---------------- */}
          <PreviewClickTarget {...click("team-members", "Team members")}>
          <Section id="team" tint>
            <SectionHead
              eyebrow="Meet the Team"
              title="The people behind Humphries & Parks"
              lead="Three generations of family ownership and a team that treats every customer as one of our own."
              center
            />
            {departments.map((dep) => (
              <div key={dep.id} className="ws-team-group">
                <h3 className="ws-h3">{dep.label}</h3>
                <div className="ws-grid ws-grid--team">
                  {dep.members.map((m) => (
                    <article key={m.id} className="ws-card ws-member">
                      <div className="ws-member-photo">
                        <img src={m.photo} alt={m.name} loading="lazy" />
                      </div>
                      <div className="ws-card-body">
                        <h4 className="ws-card-title">{m.name}</h4>
                        <span className="ws-muted">{m.role}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Blog ---------------- */}
          <PreviewClickTarget {...click("blog-posts", "Blog posts")}>
          <Section id="blog">
            <SectionHead
              eyebrow="Blog"
              title="Helpful guides for car buyers in Kent"
              lead="Practical, plain-English advice from the showroom floor."
            />
            <div className="ws-grid ws-grid--cards">
              {blogPosts.map((post) => (
                <article key={post.id} className="ws-card ws-blog">
                  <div className="ws-blog-media">
                    <img src={post.image} alt={post.title} loading="lazy" />
                  </div>
                  <div className="ws-card-body">
                    <span className="ws-muted">{post.date}</span>
                    <h3 className="ws-card-title">{post.title}</h3>
                    <p className="ws-muted">{post.excerpt}</p>
                  </div>
                </article>
              ))}
            </div>
          </Section>
          </PreviewClickTarget>

          {/* ---------------- Contact ---------------- */}
          <PreviewClickTarget {...click("contact", "Contact details")}>
          <Section id="contact" tint>
            <SectionHead eyebrow={contact.eyebrow} title={contact.title} center />
            <div className="ws-contact">
              <div className="ws-card ws-panel ws-contact-details">
                <div className="ws-contact-block">
                  <span className="ws-eyebrow">Call us</span>
                  <a href={contact.phoneHref} className="ws-contact-phone">
                    {contact.phone}
                  </a>
                </div>
                <div className="ws-contact-block">
                  <span className="ws-eyebrow">Visit us</span>
                  <address className="ws-contact-address">
                    {contact.address.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </address>
                </div>
                <div className="ws-contact-hours">
                  <HoursTable caption="Sales hours" rows={contact.salesHours} />
                  <HoursTable caption="Service hours" rows={contact.serviceHours} />
                </div>
                <div className="ws-socials">
                  {contact.socials.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="ws-btn ws-btn--ghost">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="ws-card ws-contact-map">
                <iframe
                  title="Humphries & Parks location"
                  src={contact.mapEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </Section>
          </PreviewClickTarget>
        </main>

        {/* ---------------- Footer ---------------- */}
        <PreviewClickTarget {...click("footer", "Footer", null, "div")}>
        <footer className="ws-footer">
          <div className="ws-container ws-footer-inner">
            <div className="ws-footer-top">
              <img className="ws-logo ws-logo--dark" src={brand.logoWhiteUrl} alt={brand.name} />
              <img className="ws-logo ws-logo--light" src={brand.logoUrl} alt={brand.name} />
              <ul className="ws-footer-links">
                {footer.legal.map((l) => (
                  <li key={l}>
                    <a href="#top">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
            <p className="ws-footer-legal">{footer.fcaReg}</p>
            <p className="ws-footer-legal">{footer.creditDisclosure}</p>
            <p className="ws-footer-copy">
              © {year} {brand.name} Limited. All rights reserved.
            </p>
          </div>
        </footer>
        </PreviewClickTarget>
      </div>
    </>
  );
}
