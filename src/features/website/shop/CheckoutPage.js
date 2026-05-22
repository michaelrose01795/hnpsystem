// file location: src/features/website/shop/CheckoutPage.js
// /website/shop/checkout  -- contact + shipping form, then redirect to Stripe.

import { useState } from "react";
import Link from "next/link";
import ShopShell from "./ShopShell";
import useShopCart, { formatGbp } from "../hooks/useShopCart";

const SHIPPING_PENCE = 595;

export default function CheckoutPage() {
  const cart = useShopCart();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const totalEst = cart.totals.subtotal_pence + (cart.items.length ? SHIPPING_PENCE : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/shop/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({ id: i.id, qty: i.qty })),
          email: form.email,
          name: form.name,
          phone: form.phone,
          address: {
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            postcode: form.postcode,
            country: form.country,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Checkout failed");
      }
      // Redirect to Stripe-hosted checkout. The success URL clears the cart.
      window.location.href = json.url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <ShopShell title="Checkout">
        <div className="ws-card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--txt-mute)" }}>
            Your cart is empty — nothing to check out.
          </p>
          <Link href="/website#shop" className="ws-btn ws-btn--primary">
            Back to the shop
          </Link>
        </div>
      </ShopShell>
    );
  }

  return (
    <ShopShell title="Checkout">
      <form onSubmit={handleSubmit} className="ws-checkout-grid">
        <div className="ws-card" style={{ padding: 20 }}>
          <h3 className="ws-h3" style={{ marginTop: 0 }}>
            Contact
          </h3>
          <div className="ws-form-row">
            <label>Full name</label>
            <input type="text" required value={form.name} onChange={set("name")} />
          </div>
          <div className="ws-form-grid-2">
            <div className="ws-form-row">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={set("email")} />
            </div>
            <div className="ws-form-row">
              <label>Phone</label>
              <input type="tel" value={form.phone} onChange={set("phone")} />
            </div>
          </div>

          <h3 className="ws-h3">Shipping address</h3>
          <div className="ws-form-row">
            <label>Address line 1</label>
            <input type="text" required value={form.line1} onChange={set("line1")} />
          </div>
          <div className="ws-form-row">
            <label>Address line 2</label>
            <input type="text" value={form.line2} onChange={set("line2")} />
          </div>
          <div className="ws-form-grid-2">
            <div className="ws-form-row">
              <label>City</label>
              <input type="text" required value={form.city} onChange={set("city")} />
            </div>
            <div className="ws-form-row">
              <label>Postcode</label>
              <input type="text" required value={form.postcode} onChange={set("postcode")} />
            </div>
          </div>
          <div className="ws-form-row">
            <label>Country</label>
            <input type="text" required value={form.country} onChange={set("country")} />
          </div>

          {error ? (
            <p style={{ color: "var(--warning-base)", fontWeight: 600 }}>{error}</p>
          ) : null}

          <button
            type="submit"
            className="ws-btn ws-btn--primary"
            disabled={busy}
            style={{ marginTop: 12 }}
          >
            {busy ? "Redirecting to payment…" : "Pay with Stripe"}
          </button>
          <p style={{ fontSize: "0.8rem", color: "var(--txt-mute)", marginTop: 10 }}>
            Card details are handled securely by Stripe. Your card is never
            stored by Humphries &amp; Parks.
          </p>
        </div>

        <aside className="ws-order-summary">
          <h3 className="ws-h3" style={{ marginTop: 0 }}>
            Order summary
          </h3>
          {cart.items.map((it) => (
            <div key={it.id} className="ws-order-line">
              <span>
                {it.name} × {it.qty}
              </span>
              <span>{formatGbp(it.price_pence * it.qty)}</span>
            </div>
          ))}
          <div className="ws-order-line" style={{ marginTop: 8 }}>
            <span>Subtotal</span>
            <span>{cart.totals.subtotal}</span>
          </div>
          <div className="ws-order-line">
            <span>Shipping</span>
            <span>{formatGbp(SHIPPING_PENCE)}</span>
          </div>
          <div className="ws-order-line ws-order-line--strong">
            <span>Total</span>
            <span>{formatGbp(totalEst)}</span>
          </div>
        </aside>
      </form>
    </ShopShell>
  );
}
