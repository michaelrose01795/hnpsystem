// file location: src/features/website/showcase/sections/ShopShowcase.js
//
// /website/dev — @family shop: the #shop teaser, product tiles, the basket
// drawer, cart, checkout and the order status cards. ProductCard and CartDrawer
// are the real shared components; the drawer is rendered open inside a Stage
// because it is position:fixed.

import ProductCard from "@/features/website/shop/ProductCard";
import CartDrawer from "@/features/website/shop/CartDrawer";
import { formatGbp } from "@/features/website/hooks/useShopCart";
import { shopCategories, shopProducts } from "@/features/website/data/shopProducts";
import { Frame, Row, ShowcaseSection, Stage } from "../ShowcasePrimitives";

const noop = () => {};

export default function ShopShowcase({ section }) {
  const [first, second, third] = shopProducts;
  const lowStock = second ? { ...second, stock_qty: 3 } : null;
  const outOfStock = third ? { ...third, stock_qty: 0 } : null;
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
      <Row label="Teaser toolbar" note=".ws-shop-toolbar · button.ws-shop-filter (--active) · button.ws-shop-cartbutton (primary)">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-shop-toolbar">
              <div className="ws-shop-filters">
                <button type="button" className="ws-shop-filter ws-shop-filter--active">
                  All
                </button>
                {shopCategories.slice(0, 3).map((category) => (
                  <button key={category.id} type="button" className="ws-shop-filter">
                    {category.name}
                  </button>
                ))}
              </div>
              <button type="button" className="ws-shop-cartbutton">
                Basket
                <span className="ws-shop-cartbutton-count">3</span>
              </button>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Product tiles" note="ProductCard · in stock · low stock · out of stock">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid--shop">
              {first ? <ProductCard product={first} href="#parts" /> : null}
              {lowStock ? <ProductCard product={lowStock} onAdd={noop} inBasketQty={1} /> : null}
              {outOfStock ? <ProductCard product={outOfStock} onAdd={noop} /> : null}
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Basket drawer" note="CartDrawer (real) · .ws-cart-drawer--open · .ws-cart-backdrop--open (position: fixed)">
        <Stage>
          <div className="ws-page">
            <CartDrawer open cart={mockCart} onClose={noop} />
          </div>
        </Stage>
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

      <Row label="Checkout" note=".ws-checkout-panel · .ws-form-row (type=email) · .ws-form-error · .ws-checkout-submit · .ws-order-line--first">
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
                <button type="submit" className="ws-btn ws-btn--primary ws-checkout-submit">
                  Pay with Stripe
                </button>
                <p className="ws-checkout-fineprint">Card details are handled securely by Stripe.</p>
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
