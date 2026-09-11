// file location: src/features/website/shop/ShopShell.js
// Shell for the shop sub-pages (/website/parts-catalog, .../cart,
// .../checkout): applies the .ws-page scope (so custglobal .ws-* /
// .ws-shop-* tokens resolve) and renders the shop top bar.
//
// The top bar is one layout on every shop page (.ws-nav--shop):
//   left   — the brand logo, back to /website
//   middle — the links and controls for the page the customer is on,
//            including whatever the page passes as `navActions` (the
//            basket button, in practice)
//   right  — the account button: the customer's profile when signed in,
//            otherwise Sign in
//
// `breadcrumb` is used by the product page to get back to the catalogue.

import Link from "next/link";
import { useRouter } from "next/router";
import BrandLogo from "@/components/BrandLogo";
import useWebsiteScope from "../hooks/useWebsiteScope";
import useWebsiteTheme from "../hooks/useWebsiteTheme";
import useCustomerSession from "../hooks/useCustomerSession";

export default function ShopShell({
  title,
  eyebrow = "Shop",
  lead,
  navActions,
  breadcrumb,
  children,
}) {
  useWebsiteScope();
  useWebsiteTheme();
  const router = useRouter();
  const { loading: sessionLoading, customer } = useCustomerSession();

  // asPath keeps any query/hash, so ?next= returns to the exact page.
  const next = encodeURIComponent(router.asPath || "/website/parts-catalog");
  const firstName = customer?.firstname || customer?.name || "Account";

  return (
    <div className="ws-page" data-presentation="website-shop-page">
      <header className="ws-nav ws-nav--shop" data-presentation="website-shop-nav">
        <div className="ws-nav-inner">
          <Link href="/website" className="ws-brand">
            <BrandLogo className="ws-logo" alt="Humphries & Parks" priority />
          </Link>
          <nav className="ws-nav-links" aria-label="Shop nav">
            <Link href="/website/parts-catalog" className="ws-nav-link">
              Parts catalogue
            </Link>
            <Link href="/website#shop" className="ws-nav-link">
              Back to site
            </Link>
            {/* Pages that own a basket drawer pass their own button here;
                the rest keep a plain link so the basket is always reachable. */}
            {navActions || (
              <Link href="/website/shop/cart" className="ws-nav-link">
                Basket
              </Link>
            )}
          </nav>
          <div className="ws-nav-actions">
            {sessionLoading ? null : customer ? (
              <Link
                href="/website/profile"
                className="ws-nav-account ws-nav-account--profile"
              >
                <span className="ws-nav-account-avatar" aria-hidden="true">
                  {(firstName[0] || "A").toUpperCase()}
                </span>
                <span>{firstName}</span>
              </Link>
            ) : (
              <Link href={`/website/login?next=${next}`} className="ws-nav-account">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main>
        <section className="ws-section" data-presentation="website-shop-content">
          <div className="ws-container">
            {breadcrumb ? (
              <nav className="ws-breadcrumb" aria-label="Breadcrumb">
                {breadcrumb}
              </nav>
            ) : null}
            <header className="ws-head ws-shop-head">
              <div>
                {eyebrow ? <span className="ws-eyebrow">{eyebrow}</span> : null}
                <h1 className="ws-h2">{title}</h1>
                {lead ? <p className="ws-lead">{lead}</p> : null}
              </div>
            </header>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
