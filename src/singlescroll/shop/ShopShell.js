// file location: src/singlescroll/shop/ShopShell.js
// Minimal shell for the shop sub-pages: applies the .ws-page scope (so
// custglobal .ws-* / .ws-shop-* tokens resolve) and renders a tiny header
// linking back to the main /website page.

import useWebsiteScope from "../hooks/useWebsiteScope";
import useWebsiteTheme from "../hooks/useWebsiteTheme";
import Link from "next/link";

export default function ShopShell({ title, children }) {
  useWebsiteScope();
  useWebsiteTheme();
  return (
    <div className="ws-page" data-presentation="website-shop-page">
      <header className="ws-nav" data-presentation="website-shop-nav">
        <div className="ws-nav-inner">
          <Link href="/website" className="ws-brand">
            <span className="ws-h3" style={{ margin: 0 }}>
              Humphries &amp; Parks
            </span>
          </Link>
          <nav className="ws-nav-links" aria-label="Shop nav">
            <Link href="/website#shop" className="ws-nav-link">
              Continue shopping
            </Link>
            <Link href="/website/shop/cart" className="ws-nav-link">
              Cart
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="ws-section" data-presentation="website-shop-content">
          <div className="ws-container">
            <header className="ws-head">
              <span className="ws-eyebrow">Shop</span>
              <h1 className="ws-h2">{title}</h1>
            </header>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
