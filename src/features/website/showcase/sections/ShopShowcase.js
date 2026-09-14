// file location: src/features/website/showcase/sections/ShopShowcase.js
//
// /website/dev — @family shop: the #shop teaser, product tiles, the basket
// drawer, cart, checkout and the order status cards. ProductCard and CartDrawer
// are the real shared components.
//
// The basket drawer starts CLOSED and opens from its Basket button, exactly as
// it does on the live shop. It used to be rendered with `open` hard-coded inside
// a Stage, which worked while the drawer was position: fixed. CartDrawer is now
// a native <dialog> opened with showModal(), and a modal dialog lives in the
// browser's top layer - no ancestor can contain it, a Stage included. Rendered
// open, it covered the whole of /website/dev on load and locked page scroll.

import { useState } from "react";
import ProductCard from "@/features/website/shop/ProductCard";
import CartDrawer from "@/features/website/shop/CartDrawer";
import BasketSummary from "@/features/website/shop/BasketSummary";
import VehicleFinder from "@/features/website/shop/VehicleFinder";
import ShopServiceInfo from "@/features/website/shop/ShopServiceInfo";
import { formatGbp } from "@/features/website/hooks/useShopCart";
import { shopCategories, shopProducts } from "@/features/website/data/shopProducts";
import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

const noop = () => {};

export default function ShopShowcase({ section }) {
  const [basketOpen, setBasketOpen] = useState(false);
  const [first, second, third] = shopProducts;
  const lowStock = second ? { ...second, stock_qty: 3 } : null;
  const outOfStock = third ? { ...third, stock_qty: 0 } : null;
  // A part that names no vehicle, for the quieter "check fitment" line.
  const unknownFit = first ? { ...first, id: "dev-unknown-fit", name: "Microfibre Cloth Pack", brand: null, description: null, compare_at_price_pence: null } : null;
  const emptyCart = { items: [], totals: { count: 0, subtotal: formatGbp(0), subtotal_pence: 0 } };
  const drawerItems = [first, second].filter(Boolean).map((product) => ({ ...product, qty: 1 }));
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

  return (
    <ShowcaseSection id="shop" section={section}>
      <Row label="Shop front" note=".ws-shop-front · .ws-shop-side · VehicleFinder (vehicle applied) · BasketSummary (empty) · form.ws-shop-search">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-shop-front">
              <VehicleFinder idPrefix="dev-shop-finder" vehicle={{ make: "Suzuki", model: "Swift" }} onApply={noop} onClear={noop} />
              <div className="ws-shop-side">
                <BasketSummary cart={emptyCart} onOpen={noop} />
                <form className="ws-card ws-panel ws-shop-search" role="search" onSubmit={(event) => event.preventDefault()}>
                  <label className="ws-stock-field" htmlFor="dev-shop-search">
                    <span className="ws-stock-label">Search parts</span>
                    <input id="dev-shop-search" type="search" placeholder="Part name, number or OE reference" />
                  </label>
                  <button type="submit" className="ws-btn ws-btn--primary">
                    Search
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Registration result" note=".ws-finder-result · .ws-val-plate · .ws-finder-result-text · .ws-finder-lead (the state after a DVLA lookup)">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-card ws-panel ws-finder">
              <div className="ws-finder-result">
                <span className="ws-val-plate">AB12 CDE</span>
                <span className="ws-finder-result-text">2019 · Suzuki · 1373cc · Petrol</span>
                <p className="ws-muted ws-finder-lead">Choose the model below to see parts that fit.</p>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Teaser category tabs" note=".ws-tabs · button.ws-tab (--active) — filters the curated tiles">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-tabs" role="tablist" aria-label="Filter parts">
              <button type="button" role="tab" aria-selected className="ws-tab ws-tab--active">
                All
              </button>
              {shopCategories.slice(0, 3).map((category) => (
                <button key={category.id} type="button" role="tab" aria-selected={false} className="ws-tab">
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Product tiles" note="ProductCard · saving badge + was price · fits · check fitment · low stock · out of stock (Enquire)">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid--shop">
              {first ? <ProductCard product={first} href="#parts" /> : null}
              {lowStock ? <ProductCard product={lowStock} onAdd={noop} inBasketQty={1} /> : null}
              {unknownFit ? <ProductCard product={unknownFit} onAdd={noop} /> : null}
              {outOfStock ? <ProductCard product={outOfStock} onAdd={noop} /> : null}
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Delivery, collection and help" note="ShopServiceInfo · .ws-shop-info · -item · -title">
        <Frame padded>
          <div className="ws-page">
            <ShopServiceInfo />
          </div>
        </Frame>
      </Row>

      <Row label="Basket summary + drawer" note="BasketSummary (count, total, View basket, Checkout) · CartDrawer (real) · Esc, × or the backdrop closes it">
        <Frame padded>
          <div className="ws-page">
            <BasketSummary cart={mockCart} onOpen={() => setBasketOpen(true)} />
            <CartDrawer open={basketOpen} cart={mockCart} onClose={() => setBasketOpen(false)} />
          </div>
        </Frame>
      </Row>

      <Row label="Empty basket" note=".ws-cart-empty">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-cart-empty">
              <p>Your basket is empty.</p>
              <a href="#parts" className="ws-btn ws-btn--ghost">
                Browse parts
              </a>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Basket page" note=".ws-cart-item--page · .ws-cart-qty-value · .ws-cart-item-total · .ws-order-cta">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-checkout-grid">
              <div>
                {drawerItems.map((item) => (
                  <div key={item.id} className="ws-cart-item ws-cart-item--page">
                    <div className="ws-cart-item-media">
                      <span className="ws-cart-item-mark">{String(item.sku || "").slice(0, 3)}</span>
                    </div>
                    <div className="ws-cart-item-body">
                      <span className="ws-cart-item-name">{item.name}</span>
                      <span className="ws-cart-item-meta">{formatGbp(item.price_pence)} each</span>
                      <div className="ws-cart-item-controls">
                        <button type="button" className="ws-cart-qty" aria-label="Decrease">
                          −
                        </button>
                        <span className="ws-cart-qty-value">{item.qty}</span>
                        <button type="button" className="ws-cart-qty" aria-label="Increase">
                          +
                        </button>
                        <button type="button" className="ws-cart-item-remove">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="ws-cart-item-total">{formatGbp(item.price_pence * item.qty)}</div>
                  </div>
                ))}
              </div>
              <aside className="ws-order-summary">
                <h3 className="ws-h3">Order summary</h3>
                <div className="ws-order-line">
                  <span>Subtotal ({drawerItems.length} items)</span>
                  <span>{formatGbp(subtotalPence)}</span>
                </div>
                <div className="ws-order-line ws-order-line--strong">
                  <span>Total estimate</span>
                  <span>{formatGbp(subtotalPence)}</span>
                </div>
                <a href="#shop" className="ws-btn ws-btn--primary ws-order-cta">
                  Checkout
                </a>
              </aside>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Checkout" note=".ws-checkout-panel · .ws-form-row (type=email) · .ws-form-error · .ws-checkout-actions · .ws-checkout-submit · .ws-order-line--first">
        <Frame padded>
          <div className="ws-page">
            <form className="ws-checkout-grid" onSubmit={(event) => event.preventDefault()}>
              <div className="ws-card ws-checkout-panel">
                <h3 className="ws-h3">Contact</h3>
                <div className="ws-form-row">
                  <label htmlFor="dev-checkout-name">Full name</label>
                  <input id="dev-checkout-name" type="text" />
                </div>
                <div className="ws-form-grid-2">
                  <div className="ws-form-row">
                    <label htmlFor="dev-checkout-email">Email</label>
                    <input id="dev-checkout-email" type="email" autoComplete="off" />
                  </div>
                  <div className="ws-form-row">
                    <label htmlFor="dev-checkout-phone">Phone</label>
                    <input id="dev-checkout-phone" type="tel" />
                  </div>
                </div>
                <p className="ws-form-error">Checkout failed — please try again.</p>
                <div className="ws-checkout-actions">
                  <button type="submit" className="ws-btn ws-btn--primary ws-checkout-submit">
                    Payment
                  </button>
                  <button type="button">Back to basket</button>
                </div>
                <p className="ws-checkout-fineprint">Test payment — no real card is charged.</p>
              </div>
              <aside className="ws-order-summary">
                <h3 className="ws-h3">Order summary</h3>
                <div className="ws-order-line">
                  <span>Service kit × 1</span>
                  <span>£64.95</span>
                </div>
                <div className="ws-order-line ws-order-line--first">
                  <span>Subtotal</span>
                  <span>£64.95</span>
                </div>
                <div className="ws-order-line">
                  <span>Shipping</span>
                  <span>£5.95</span>
                </div>
                <div className="ws-order-line ws-order-line--strong">
                  <span>Total</span>
                  <span>£70.90</span>
                </div>
              </aside>
            </form>
          </div>
        </Frame>
      </Row>

      <Row label="Order status cards" note=".ws-shop-state · .ws-shop-note · .ws-shop-state-lead · .ws-shop-order-ref · .ws-shop-state-actions">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-card ws-shop-state">
              <p className="ws-shop-state-lead">Your payment has been accepted. A confirmation email is on its way.</p>
              <p className="ws-shop-order-ref">
                Order reference: <strong>HNP-2026-000123</strong>
              </p>
              <div className="ws-shop-state-actions">
                <a href="#shop" className="ws-btn ws-btn--primary">
                  Keep shopping
                </a>
                <a href="#marketing" className="ws-btn ws-btn--ghost">
                  Back to home
                </a>
              </div>
            </div>
            <div className="ws-card ws-shop-state">
              <p className="ws-shop-note">Your basket is empty.</p>
              <a href="#parts" className="ws-btn ws-btn--primary">
                Browse the parts catalogue
              </a>
            </div>
          </div>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
