// file location: src/lib/payments/stripe.js
//
// Lazy server-side Stripe client. Requires:
//   STRIPE_SECRET_KEY        sk_test_... / sk_live_...
//   STRIPE_WEBHOOK_SECRET    whsec_...        (verifies webhook signatures)
//   NEXT_PUBLIC_SITE_URL     e.g. https://hnpsystem.example.com
//
// If STRIPE_SECRET_KEY is missing, getStripe() throws so the checkout endpoint
// returns a clear error instead of silently failing.

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY not set - shop checkout is unavailable until it is configured."
    );
  }
  // Defer require so the bundler does not blow up if stripe isn't installed
  // in a development branch.
  // eslint-disable-next-line global-require
  const Stripe = require("stripe");
  _stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  return _stripe;
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}
