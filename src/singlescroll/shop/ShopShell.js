// file location: src/singlescroll/shop/ShopShell.js
// Minimal shell for the shop sub-pages: applies the .ws-page scope (so
// custglobal .ws-* / .ws-shop-* tokens resolve) and renders a tiny header
// linking back to the main /website page.

import useWebsiteScope from "../hooks/useWebsiteScope";
import useWebsiteTheme from "../hooks/useWebsiteTheme";

export default function ShopShell({ title, children }) {
  useWebsiteScope();
  useWebsiteTheme();
  return (
    <div className="ws-page">
      <header className="ws-nav">
        <div className="ws-nav-inner">
          <a href="/website" className="ws-brand">
            <span className="ws-h3" style={{ margin: 0 }}>
              Humphries &amp; Parks
            </span>
          </a>
          <nav className="ws-nav-links" aria-label="Shop nav">
            <a href="/website#shop" className="ws-nav-link">
              Continue shopping
            </a>
            <a href="/website/shop/cart" className="ws-nav-link">
              Cart
            </a>
          </nav>
        </div>
      </header>
      <main>
        <section className="ws-section">
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
