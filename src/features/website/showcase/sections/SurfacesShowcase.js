// file location: src/features/website/showcase/sections/SurfacesShowcase.js
//
// /website/dev — the customer surface ladder in one place: the glass card, the
// floating panel (cookie consent), the basket drawer, the solid popup card
// (Help "More info") and the pinned support launcher. position:fixed surfaces
// open inside a <Stage>. The popup is static markup because HelpArticleModal
// locks page scroll and grabs focus.
//
// CartDrawer is the real component, and for the same reason it now starts
// CLOSED and opens from a Basket button. It is a native <dialog> opened with
// showModal(), so it renders in the browser's top layer, which no ancestor can
// contain - a Stage included. Rendered with `open` hard-coded, it covered the
// whole of /website/dev on load and locked page scroll.

import { useState } from "react";
import CartDrawer from "@/features/website/shop/CartDrawer";
import { formatGbp } from "@/features/website/hooks/useShopCart";
import { shopProducts } from "@/features/website/data/shopProducts";
import { blogPosts } from "@/features/website/data/blogPosts";
import { Frame, Row, ShowcaseSection, Stage } from "../ShowcasePrimitives";

const noop = () => {};

export default function SurfacesShowcase({ section }) {
  const [basketOpen, setBasketOpen] = useState(false);
  const drawerItems = shopProducts.slice(0, 2).map((product) => ({ ...product, qty: 1 }));
  const subtotalPence = drawerItems.reduce((sum, item) => sum + item.price_pence * item.qty, 0);
  // Static cart shape CartDrawer / BasketAccountNotice read — no storage, no fetch.
  const mockCart = {
    items: drawerItems,
    totals: { count: drawerItems.length, subtotal: formatGbp(subtotalPence), subtotal_pence: subtotalPence },
    sessionLoading: false,
    signedIn: false,
    updateQty: noop,
    remove: noop,
  };

  const post = blogPosts[0] || { id: "demo", title: "Help article", category: "Servicing", detail: {} };
  const detail = post.detail || {};
  const firstSection = (detail.sections || [])[0];
  const checklist = detail.checklist;

  return (
    <ShowcaseSection id="surfaces" section={section}>
      <Row label="Glass card" hint=".ws-card">
        <Frame padded>
          <div className="ws-page">
            <article className="ws-card">
              <div className="ws-card-body">
                <span className="ws-eyebrow">Servicing</span>
                <h3 className="ws-card-title">Fixed-price plans</h3>
                <p className="ws-muted">Spread the cost with a monthly plan.</p>
              </div>
            </article>
          </div>
        </Frame>
      </Row>

      <Row label="Pinned launcher" hint=".ws-support-launcher">
        <Stage size="mini">
          <div className="ws-support-launcher">
            <button type="button" className="ws-support-launcher__button">
              Report a problem
            </button>
          </div>
        </Stage>
      </Row>

      <Row label="Floating panel" hint=".ws-consent" size="md">
        <Stage size="compact">
          <div className="ws-consent" role="dialog" aria-label="Cookie consent preview">
            <h2 className="ws-consent-title">Cookies on this site</h2>
            <p className="ws-consent-text">
              We use essential cookies to make the site work. With your permission we&apos;d also like to use other cookies.
            </p>
            <div className="ws-consent-actions">
              <button type="button">Customise</button>
              <button type="button">Reject All</button>
              <button type="button" className="app-btn">
                Accept All
              </button>
            </div>
          </div>
        </Stage>
      </Row>

      <Row label="Basket drawer" hint="CartDrawer · opens from the Basket button" size="md">
        <Frame padded>
          <div className="ws-page">
            <button
              type="button"
              className="ws-shop-cartbutton"
              onClick={() => setBasketOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={basketOpen}
              aria-label="Basket"
            >
              <span className="ws-shop-cartbutton-icon" aria-hidden="true" />
              <span className="ws-shop-cartbutton-count">{mockCart.totals.count}</span>
            </button>
            <CartDrawer open={basketOpen} cart={mockCart} onClose={() => setBasketOpen(false)} />
          </div>
        </Frame>
      </Row>

      <Row label="Solid popup card" hint="Help · More info" size="md">
        <Stage>
          <div className="ws-page">
            <div className="ws-article-backdrop">
              <div className="ws-article-scrim" />
              <div className="ws-article-card" role="dialog" aria-label="Help article preview">
                <header className="ws-article-header">
                  <h3 className="ws-article-title">{post.title}</h3>
                  <div className="ws-article-header-actions">
                    <button type="button" className="ws-article-close" aria-label="Close">
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </header>
                <div className="ws-article-body">
                  {post.image ? (
                    <div className="ws-article-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.image} alt={post.title} />
                    </div>
                  ) : null}
                  <div className="ws-article-meta-row">
                    <span className="ws-chip ws-chip--accent">{post.category}</span>
                    <span className="ws-article-meta">{[post.date, post.readTime].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="ws-article-prose">
                    <p className="ws-article-lead">{detail.lead || post.excerpt}</p>
                    {firstSection ? (
                      <section className="ws-article-section">
                        <h4 className="ws-article-h3">{firstSection.heading}</h4>
                        {(firstSection.body || []).slice(0, 1).map((paragraph) => (
                          <p key={paragraph} className="ws-muted">
                            {paragraph}
                          </p>
                        ))}
                      </section>
                    ) : null}
                    {checklist ? (
                      <aside className="ws-article-checklist">
                        <h4 className="ws-article-h3">{checklist.heading}</h4>
                        <ul className="ws-ticks">
                          {(checklist.items || []).slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </aside>
                    ) : null}
                  </div>
                </div>
                <footer className="ws-article-footer">
                  <p className="ws-article-note">{detail.cta?.note || "Our service team can help."}</p>
                  <a href="#help" className="ws-btn ws-btn--primary">
                    {detail.cta?.label || "Book a service"}
                  </a>
                </footer>
              </div>
            </div>
          </div>
        </Stage>
      </Row>
    </ShowcaseSection>
  );
}
