// file location: src/pages/api/shop/webhook.js
//
// Stripe webhook handler. Configure the endpoint in the Stripe dashboard to:
//   POST https://your-domain/api/shop/webhook
//   subscribing to `checkout.session.completed` at minimum.
//
// Body parsing must be disabled for signature verification - we read the raw
// stream below and pass the Buffer to constructEvent().

import { Buffer } from "node:buffer";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/payments/stripe";
import {
  getOrderByStripeSession,
  markOrderPaid,
  decrementStockForOrder,
} from "@/lib/database/shop";

export const config = {
  api: { bodyParser: false },
};

const readRaw = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[shop/webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).send("webhook secret missing");
  }

  const sig = req.headers["stripe-signature"];
  let raw;
  try {
    raw = await readRaw(req);
  } catch (err) {
    return res.status(400).send(`read error: ${err.message}`);
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return res.status(500).send(err.message);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`signature failed: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const order = await getOrderByStripeSession(session.id);
      if (order && order.status !== "paid") {
        await markOrderPaid(order.id, {
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
        });
        await decrementStockForOrder(order.id);
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[shop/webhook] processing error:", err);
    return res.status(500).send(err.message);
  }
}
