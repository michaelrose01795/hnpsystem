// file location: src/features/website/shop/CartDrawer.js
//
// The slide-in basket, shared by the #shop teaser and the full catalogue.
// Extracted from ShopSection so both entry points show one basket with one
// behaviour.
//
// Styling: .ws-cart-* from custglobal.css (PUBLIC SHOP block).

import { useEffect } from "react";
import Link from "next/link";
import { formatGbp } from "../hooks/useShopCart";
import BasketAccountNotice from "./BasketAccountNotice";

export default function CartDrawer({ open, cart, onClose }) {
  // Escape closes the drawer — it is a modal-ish surface over the page.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={"ws-cart-backdrop" + (open ? " ws-cart-backdrop--open" : "")}
        onClick={onClose}
      />
      <aside
        data-presentation="website-shop-cart-drawer"
        className={"ws-cart-drawer" + (open ? " ws-cart-drawer--open" : "")}
        aria-hidden={!open}
        aria-label="Your basket"
      >
        <div className="ws-cart-head">
          <h3 className="ws-cart-title">Your basket</h3>
          <button
            type="button"
            className="ws-cart-close"
            onClick={onClose}
            aria-label="Close basket"
          >
            ×
          </button>
        </div>

        <BasketAccountNotice cart={cart} compact />

        {cart.items.length === 0 ? (
          <div className="ws-cart-empty">
            <p style={{ marginTop: 0 }}>Your basket is empty.</p>
            <Link href="/website/parts-catalog" className="ws-btn ws-btn--ghost">
              Browse parts
            </Link>
          </div>
        ) : (
          <div className="ws-cart-items">
            {cart.items.map((it) => (
              <div key={it.id} className="ws-cart-item">
                <div className="ws-cart-item-media">
                  {it.image_url ? (
                    <img src={it.image_url} alt="" />
                  ) : (
                    <span className="ws-cart-item-mark">
                      {String(it.sku || it.name || "?")
                        .replace(/[^A-Za-z0-9]/g, "")
                        .slice(0, 3)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="ws-cart-item-body">
                  <span className="ws-cart-item-name">{it.name}</span>
                  <span className="ws-cart-item-meta">
                    {formatGbp(it.price_pence)} each
                  </span>
                  <div className="ws-cart-item-controls">
                    <button
                      type="button"
                      className="ws-cart-qty"
                      onClick={() => cart.updateQty(it.id, it.qty - 1)}
                      aria-label={`Reduce quantity of ${it.name}`}
                    >
                      −
                    </button>
                    <span style={{ minWidth: 24, textAlign: "center" }}>
                      {it.qty}
                    </span>
                    <button
                      type="button"
                      className="ws-cart-qty"
                      onClick={() => cart.updateQty(it.id, it.qty + 1)}
                      aria-label={`Increase quantity of ${it.name}`}
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
                <div style={{ fontWeight: 700 }}>
                  {formatGbp(it.price_pence * it.qty)}
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.items.length > 0 && (
          <div className="ws-cart-foot">
            <div className="ws-cart-totals">
              <span>Subtotal</span>
              <span>{cart.totals.subtotal}</span>
            </div>
            <Link href="/website/shop/checkout" className="ws-btn ws-btn--primary">
              Checkout
            </Link>
            <Link href="/website/shop/cart" className="ws-btn ws-btn--ghost">
              View basket
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
