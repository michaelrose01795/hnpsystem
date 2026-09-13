// file location: src/features/website/shop/CartPage.js
// /website/shop/cart  -- review the cart and proceed to checkout.

import Link from "next/link";
import ShopShell from "./ShopShell";
import BasketAccountNotice from "./BasketAccountNotice";
import useShopCart, { formatGbp } from "../hooks/useShopCart";

export default function CartPage() {
  const cart = useShopCart();

  if (cart.items.length === 0) {
    return (
      <ShopShell title="Your basket">
        <div className="ws-card ws-shop-state">
          <p className="ws-shop-note">Your basket is empty.</p>
          <Link href="/website/parts-catalog" className="ws-btn ws-btn--primary">
            Browse the parts catalogue
          </Link>
        </div>
      </ShopShell>
    );
  }

  return (
    <ShopShell title="Your basket">
      <BasketAccountNotice cart={cart} />
      <div className="ws-checkout-grid">
        <div>
          {cart.items.map((it) => (
            <div key={it.id} className="ws-cart-item ws-cart-item--page">
              <div className="ws-cart-item-media">
                {it.image_url ? <img src={it.image_url} alt="" /> : null}
              </div>
              <div className="ws-cart-item-body">
                <span className="ws-cart-item-name">{it.name}</span>
                <span className="ws-cart-item-meta">{formatGbp(it.price_pence)} each</span>
                <div className="ws-cart-item-controls">
                  <button
                    type="button"
                    className="ws-cart-qty"
                    onClick={() => cart.updateQty(it.id, it.qty - 1)}
                  >
                    −
                  </button>
                  <span className="ws-cart-qty-value">{it.qty}</span>
                  <button
                    type="button"
                    className="ws-cart-qty"
                    onClick={() => cart.updateQty(it.id, it.qty + 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ws-cart-item-remove"
                    onClick={() => cart.remove(it.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="ws-cart-item-total">
                {formatGbp(it.price_pence * it.qty)}
              </div>
            </div>
          ))}
        </div>

        <aside className="ws-order-summary">
          <h3 className="ws-h3">Order summary</h3>
          <div className="ws-order-line">
            <span>Subtotal ({cart.totals.count} items)</span>
            <span>{cart.totals.subtotal}</span>
          </div>
          <div className="ws-order-line">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <div className="ws-order-line ws-order-line--strong">
            <span>Total estimate</span>
            <span>{cart.totals.subtotal}</span>
          </div>
          <Link
            href="/website/shop/checkout"
            className="ws-btn ws-btn--primary ws-order-cta"
          >
            Checkout
          </Link>
        </aside>
      </div>
    </ShopShell>
  );
}
