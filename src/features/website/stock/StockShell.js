// file location: src/features/website/stock/StockShell.js
// Chrome for the /website sub-pages that are not the single-scroll home page:
// /website/available-stock, /website/stock/<reg> and /website/valuation.
//
// Follows the established sub-page pattern from ShopShell: apply the
// html.website-scope class so custglobal.css resolves, wrap everything in
// .ws-page so the --ws-* tokens exist, then a compact nav and the site footer
// so a visitor who lands here from a search engine still has the phone number
// and a way back into the site. Every class is an existing custglobal .ws-*
// class — this file introduces no styling of its own.

import Head from "next/head";
import Link from "next/link";

import BrandLogo from "@/components/BrandLogo";
import useWebsiteScope from "../hooks/useWebsiteScope";
import useWebsiteTheme from "../hooks/useWebsiteTheme";
import useWebsiteContent from "../hooks/useWebsiteContent";

/* ------------------------------------------------------------------ */
/* Live-content shape guards                                           */
/* ------------------------------------------------------------------ */
// Two content slots reach this component in a different shape depending on
// whether the static fallback or the live database is in play. The same guards
// exist in WebsitePage.js — see the longer note there for why, and for the
// real fix (make the DB rows and the static modules agree).

// The brand singleton is the one slot getWebsiteContent passes through raw
// (`brand: brand || {}`), so live content arrives as the snake_case DB row
// while the static fallback is camelCase.
//
// The MARK itself no longer comes from that row: nav and footer render
// <BrandLogo>, the same local wordmark (/images/logo/Logo.png) the staff
// sidebar shows in its expanded state, theme-recoloured to the active accent.
// Only the name is still read from content, as the logo's alt text and in the
// copyright line.
const brandName = (brand) => brand?.name || "Humphries & Parks";

// footer.legal is plain strings from the static fallback and { href, label }
// rows from website_footer. Rendering the object form straight into JSX throws
// "Objects are not valid as a React child" and takes the whole page down.
const legalLinks = (footer) =>
  (footer?.legal || [])
    .map((entry) =>
      typeof entry === "string"
        ? { label: entry, href: "/website" }
        : { label: entry?.label || "", href: entry?.href || "/website" },
    )
    .filter((entry) => entry.label);

// `backToSite` collapses the two nav links into a single "Back to site" link.
// Used by /website/valuation, where "Sell your car" points at the page the
// visitor is already on — a link to nowhere sat beside the phone button.
export default function StockShell({ title, description, backToSite = false, children }) {
  useWebsiteScope();

  const { content } = useWebsiteContent();
  const { brand, contact, footer } = content.siteContent;
  const name = brandName(brand);
  const { design } = content;

  useWebsiteTheme();

  const year = new Date().getFullYear();

  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="ws-page ws-page--stock" data-presentation="website-stock-page">
        <header className="ws-nav" data-presentation="website-stock-nav">
          <div className="ws-nav-inner">
            <Link href="/website" className="ws-brand">
              <BrandLogo className="ws-logo" alt={name} priority />
            </Link>
            <nav className="ws-nav-links" aria-label="Site">
              {backToSite ? (
                <Link href="/website" className="ws-nav-link">
                  Back to site
                </Link>
              ) : (
                <>
                  <Link href="/website/available-stock" className="ws-nav-link">
                    Available stock
                  </Link>
                  <Link href="/website/valuation" className="ws-nav-link">
                    Sell your car
                  </Link>
                </>
              )}
              {/* No "Contact" link here on purpose — the phone button beside
                  it IS the contact route, and two of them read as a choice
                  the visitor does not have to make. The footer still links
                  back into the site. */}
              {design?.showNavPhone === false ? null : (
                <a href={contact.phoneHref} className="ws-nav-phone">
                  {contact.phone}
                </a>
              )}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="ws-footer">
          <div className="ws-container ws-footer-inner">
            <div className="ws-footer-top">
              <BrandLogo className="ws-logo" alt={name} />
              <ul className="ws-footer-links">
                {legalLinks(footer).map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="ws-footer-legal">{footer?.fcaReg}</p>
            <p className="ws-footer-legal">{footer?.creditDisclosure}</p>
            <p className="ws-footer-copy">
              © {year} {name} Limited. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
