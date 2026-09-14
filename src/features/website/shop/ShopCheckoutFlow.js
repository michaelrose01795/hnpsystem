// file location: src/features/website/shop/ShopCheckoutFlow.js
// /website/shop  -- the whole basket-to-receipt journey on one page.
//
// Replaces the separate cart / checkout / success / cancel pages. The journey
// is a row of checkpoints:
//
//   basket   -> review lines and quantities
//   details  -> contact + shipping form
//   payment  -> in-app TEST payment against the pending order (no Stripe)
//   success  -> payment accepted            (?step=success&order=…)
//   cancelled-> payment abandoned           (?step=cancelled&order=…)
//
// Payment is simulated: the card form is auto-filled with random test details
// and /api/shop/simulate-payment declines the first attempt at random, while
// any retry always succeeds — so both paths can be tested.
//
// Each checkpoint reached is saved to localStorage under
// "hnp_shop_checkout_v1" together with the details typed so far, so a reload
// (or coming back later) lands the customer on their last checkpoint with
// everything still filled in. The basket itself is already persisted by
// useShopCart. A `?step=` in the URL wins over the saved checkpoint.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShopShell from "./ShopShell";
import BasketAccountNotice from "./BasketAccountNotice";
import useShopCart, { formatGbp } from "../hooks/useShopCart";

const SHIPPING_PENCE = 595;
const STORAGE_KEY = "hnp_shop_checkout_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const STEPS = [
  { id: "basket", title: "Basket" },
  { id: "details", title: "Your details" },
  { id: "payment", title: "Payment" },
  { id: "done", title: "Confirmation" },
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
};

// Well-known test card numbers — nothing is ever charged.
const TEST_CARDS = [
  "4242 4242 4242 4242",
  "5555 5555 5555 4444",
  "4000 0566 5566 5556",
  "2223 0031 2200 3222",
];

// Ways to pay. All of them are simulated — no wallet sheet is opened, no
// card or wallet details leave the browser and no money is ever taken.
const PAYMENT_METHODS = [
  { id: "card", label: "Card", hint: "Visa, Mastercard or Amex" },
  { id: "apple_pay", label: "Apple Pay", hint: "Pay with Face ID or Touch ID" },
  { id: "google_pay", label: "Google Pay", hint: "Pay with a card saved to Google" },
  { id: "paypal", label: "PayPal", hint: "Log in to PayPal to pay" },
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const randomCard = (name) => {
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const year = String((new Date().getFullYear() + 1 + Math.floor(Math.random() * 4)) % 100).padStart(2, "0");
  return {
    holder: name || pick(["Alex Morgan", "Sam Taylor", "Jordan Lee", "Chris Parker"]),
    number: pick(TEST_CARDS),
    expiry: `${month}/${year}`,
    cvc: String(100 + Math.floor(Math.random() * 900)),
  };
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TITLES = {
  basket: "Your basket",
  details: "Checkout",
  payment: "Checkout",
  success: "Thank you — order received",
  cancelled: "Checkout cancelled",
};

const readCheckpoint = () => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCheckpoint = (value) => {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...value, savedAt: Date.now() })
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* quota / private-mode - ignore */
  }
};

// Index into STEPS for the progress row.
const progressIndex = (step) => {
  if (step === "success" || step === "cancelled") return 3;
  return Math.max(0, STEPS.findIndex((s) => s.id === step));
};

// `initialStep` lets the legacy /website/shop/{cart,checkout,success,cancel}
// routes open the flow at their checkpoint; a `?step=` in the URL still wins.
export default function ShopCheckoutFlow({ initialStep = "" }) {
  const router = useRouter();
  const cart = useShopCart();
  const [step, setStep] = useState(null); // null until restored
  const [form, setForm] = useState(EMPTY_FORM);
  const [order, setOrder] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [card, setCard] = useState(() => randomCard(""));
  const [attempt, setAttempt] = useState(1);
  const [method, setMethod] = useState("card");
  const prefilled = useRef(false);

  // Restore: URL step (Stripe return) first, then the saved checkpoint.
  useEffect(() => {
    if (!router.isReady || step !== null) return;
    const saved = readCheckpoint();
    const urlStep =
      typeof router.query.step === "string" ? router.query.step : initialStep;
    const urlOrder = typeof router.query.order === "string" ? router.query.order : "";

    if (saved?.form) setForm({ ...EMPTY_FORM, ...saved.form });

    if (urlStep === "success" || urlStep === "cancelled") {
      setOrder(urlOrder || saved?.order || "");
      setStep(urlStep);
      return;
    }
    if (urlStep === "basket" || urlStep === "details") {
      setStep(urlStep);
      return;
    }
    if (saved?.step === "payment") {
      // Reloaded on the payment step: the pending order still exists, so
      // pick up where they left off. Without an order, go back to details.
      setOrder(saved.order || "");
      setCard(randomCard(saved.form?.name || ""));
      setStep(saved.order ? "payment" : "details");
      return;
    }
    if (saved?.step === "details" || saved?.step === "cancelled") {
      setOrder(saved.order || "");
      setStep(saved.step);
      return;
    }
    setStep("basket");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Save every checkpoint (and the details typed on it). A finished order
  // clears the saved journey so the next basket starts fresh.
  useEffect(() => {
    if (step === null) return;
    if (step === "success") {
      writeCheckpoint(null);
      return;
    }
    writeCheckpoint({ step, form, order });
  }, [step, form, order]);

  // Paid: empty the basket once.
  useEffect(() => {
    if (step === "success") cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Keep the URL on the plain route so a reload restores from storage rather
  // than replaying a Stripe return.
  const goTo = useCallback(
    (next) => {
      setError(null);
      setNotice(null);
      setStep(next);
      if (router.query.step || router.query.order) {
        router.replace("/website/shop", undefined, { shallow: true });
      }
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router]
  );

  // Prefill from the signed-in customer, once, and only into empty fields.
  useEffect(() => {
    const customer = cart.customer;
    if (!customer || prefilled.current || step === null) return;
    prefilled.current = true;
    setForm((prev) => ({
      ...prev,
      name:
        prev.name ||
        [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
        customer.name ||
        "",
      email: prev.email || customer.email || "",
      phone: prev.phone || customer.mobile || customer.telephone || "",
      line1: prev.line1 || customer.address || "",
      postcode: prev.postcode || customer.postcode || "",
    }));
  }, [cart.customer, step]);

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
      setOrder(json.order_number || "");
      setCard(randomCard(form.name));
      setAttempt(1);
      setBusy(false);
      goTo("payment");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  // Simulated in-app payment. The server declines the first attempt at random;
  // a retry always goes through.
  const handlePay = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await wait(1200); // feels like a real authorisation
      const res = await fetch("/api/shop/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the chosen method is sent — never the card details.
        body: JSON.stringify({ order_number: order, attempt, method }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setAttempt((n) => n + 1);
        throw new Error(json?.message || "Payment failed");
      }
      setBusy(false);
      goTo("success");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (step === null) {
    return <ShopShell title="Your basket">{null}</ShopShell>;
  }

  const current = progressIndex(step);
  const progress = (
    <div className="ws-val-progress">
      <ol className="ws-val-steps">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className="ws-val-step"
            data-state={i === current ? "current" : i < current ? "done" : "todo"}
          >
            <span className="ws-val-step-n" aria-hidden="true">
              {i < current || (i === current && step === "success") ? "✓" : i + 1}
            </span>
            <span className="ws-val-step-label">{s.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  const orderSummary = (
    <aside className="ws-order-summary">
      <h3 className="ws-h3">Order summary</h3>
      {cart.items.map((it) => (
        <div key={it.id} className="ws-order-line">
          <span>
            {it.name} × {it.qty}
          </span>
          <span>{formatGbp(it.price_pence * it.qty)}</span>
        </div>
      ))}
      <div className="ws-order-line ws-order-line--first">
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
  );

  /* ------------------------------------------------------------ success -- */
  if (step === "success") {
    return (
      <ShopShell title={TITLES.success}>
        {progress}
        <div className="ws-card ws-shop-state">
          <p className="ws-shop-state-lead">
            Your payment has been accepted. A confirmation email is on its way.
          </p>
          {order ? (
            <p className="ws-shop-order-ref">
              Order reference: <strong>{order}</strong>
            </p>
          ) : null}
          <div className="ws-shop-state-actions">
            <Link href="/website#shop" className="ws-btn ws-btn--primary">
              Keep shopping
            </Link>
            <Link href="/website" className="ws-btn ws-btn--ghost">
              Back to home
            </Link>
          </div>
        </div>
      </ShopShell>
    );
  }

  /* ---------------------------------------------------------- cancelled -- */
  if (step === "cancelled") {
    return (
      <ShopShell title={TITLES.cancelled}>
        {progress}
        <div className="ws-card ws-shop-state">
          <p className="ws-shop-state-lead">
            No payment was taken{order ? ` — order ${order} is on hold` : ""}.
            Your basket and details are still saved so you can finish later.
          </p>
          <div className="ws-shop-state-actions">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              onClick={() => goTo(cart.items.length ? "details" : "basket")}
            >
              Try payment again
            </button>
            <button type="button" className="ws-btn ws-btn--ghost" onClick={() => goTo("basket")}>
              Return to basket
            </button>
          </div>
        </div>
      </ShopShell>
    );
  }

  /* -------------------------------------------------------------- empty -- */
  if (cart.items.length === 0) {
    return (
      <ShopShell title={TITLES.basket}>
        {progress}
        <div className="ws-card ws-shop-state">
          <p className="ws-shop-note">Your basket is empty.</p>
          <Link href="/website/parts-catalog" className="ws-btn ws-btn--primary">
            Browse the parts catalogue
          </Link>
        </div>
      </ShopShell>
    );
  }

  /* ------------------------------------------------------------ payment -- */
  if (step === "payment" && order) {
    const setCardField = (k) => (e) => setCard((prev) => ({ ...prev, [k]: e.target.value }));
    return (
      <ShopShell title={TITLES.payment}>
        {progress}
        <form onSubmit={handlePay} className="ws-checkout-grid">
          <div className="ws-card ws-checkout-panel">
            <h3 className="ws-h3">Payment method</h3>
            <p className="ws-shop-order-ref">
              Order reference: <strong>{order}</strong>
            </p>
            <div className="ws-val-options" data-columns="two" role="radiogroup">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.id}
                  className="ws-val-option"
                  data-selected={method === m.id ? "true" : "false"}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => {
                      setMethod(m.id);
                      setError(null);
                    }}
                  />
                  <span className="ws-val-option-body">
                    <span className="ws-val-option-label">{m.label}</span>
                    <span className="ws-val-option-hint">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {method === "card" ? (<>
            <h3 className="ws-h3">Card details</h3>
            <div className="ws-form-row">
              <label>Name on card</label>
              <input type="text" required value={card.holder} onChange={setCardField("holder")} />
            </div>
            <div className="ws-form-row">
              <label>Card number</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={card.number}
                onChange={setCardField("number")}
              />
            </div>
            <div className="ws-form-grid-2">
              <div className="ws-form-row">
                <label>Expiry (MM/YY)</label>
                <input type="text" required value={card.expiry} onChange={setCardField("expiry")} />
              </div>
              <div className="ws-form-row">
                <label>CVC</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={card.cvc}
                  onChange={setCardField("cvc")}
                />
              </div>
            </div>
            </>) : null}

            {error ? <p className="ws-form-error">{error}</p> : null}

            <div className="ws-checkout-actions">
              <button
                type="submit"
                className="ws-btn ws-btn--primary ws-checkout-submit"
                disabled={busy}
              >
                {busy
                  ? "Processing payment…"
                  : error
                    ? "Retry payment"
                    : method === "card"
                      ? `Pay ${formatGbp(totalEst)}`
                      : `Pay ${formatGbp(totalEst)} with ${
                          PAYMENT_METHODS.find((m) => m.id === method)?.label
                        }`}
              </button>
              <button type="button" onClick={() => goTo("details")} disabled={busy}>
                Back to details
              </button>
            </div>
            <p className="ws-checkout-fineprint">
              Your card is never stored by Humphries &amp; Parks. Test mode —
              no real payment is taken with any method.
            </p>
          </div>
          {orderSummary}
        </form>
      </ShopShell>
    );
  }

  /* ------------------------------------------------------------ details -- */
  if (step === "details" || step === "payment") {
    return (
      <ShopShell title={TITLES.details}>
        {progress}
        <BasketAccountNotice cart={cart} />
        <form onSubmit={handleSubmit} className="ws-checkout-grid">
          <div className="ws-card ws-checkout-panel">
            {notice ? <p className="ws-form-error">{notice}</p> : null}
            <h3 className="ws-h3">Contact</h3>
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

            {error ? <p className="ws-form-error">{error}</p> : null}

            <div className="ws-checkout-actions">
              <button
                type="submit"
                className="ws-btn ws-btn--primary ws-checkout-submit"
                disabled={busy}
              >
                {busy ? "Preparing payment…" : "Payment"}
              </button>
              <button type="button" onClick={() => goTo("basket")} disabled={busy}>
                Back to basket
              </button>
            </div>
          </div>
          {orderSummary}
        </form>
      </ShopShell>
    );
  }

  /* ------------------------------------------------------------- basket -- */
  return (
    <ShopShell title={TITLES.basket}>
      {progress}
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
          <button
            type="button"
            className="ws-btn ws-btn--primary ws-order-cta"
            onClick={() => goTo("details")}
          >
            Checkout
          </button>
        </aside>
      </div>
    </ShopShell>
  );
}
