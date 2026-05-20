// file location: src/pages/api/shop/checkout-session.js
//
// POST /api/shop/checkout-session
//
// Creates a pending shop_orders row from the supplied cart, then a Stripe
// Checkout Session whose success_url returns the customer to /website/shop/success.
// The session id is stored on the order so the webhook can mark it paid.
//
// Body shape:
//   {
//     items: [{ id, qty }, ...],
//     email, name, phone,
//     address: { line1, line2, city, postcode, country }
//   }
//
// Cart line totals are recomputed server-side from the current published
// product prices so the client cannot tamper with prices.

import { getProductsByIds, createPendingOrder, setStripeSession } from "@/lib/database/shop";
import { getStripe, siteUrl } from "@/lib/payments/stripe";

const SHIPPING_FLAT_PENCE = 595;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { items, email, name, phone, address } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Cart is empty." });
  }
  if (!email || !name) {
    return res.status(400).json({ success: false, message: "Name and email required." });
  }

  // Recompute pricing server-side.
  const ids = items.map((i) => i.id);
  const products = await getProductsByIds(ids);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const orderItems = [];
  let subtotal = 0;
  for (const it of items) {
    const product = productMap[it.id];
    if (!product || product.status !== "published") {
      return res.status(400).json({
        success: false,
        message: `Item ${it.id} is no longer available.`,
      });
    }
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const line_total = product.price_pence * qty;
    orderItems.push({
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      qty,
      unit_price_pence: product.price_pence,
      line_total_pence: line_total,
    });
    subtotal += line_total;
  }

  const shipping = subtotal === 0 ? 0 : SHIPPING_FLAT_PENCE;
  const total = subtotal + shipping;

  const orderResult = await createPendingOrder({
    contactEmail: email,
    contactPhone: phone,
    shippingAddress: { name, ...address },
    items: orderItems,
    subtotalPence: subtotal,
    shippingPence: shipping,
    taxPence: 0,
    totalPence: total,
  });
  if (!orderResult.ok) {
    return res.status(500).json({ success: false, message: orderResult.error });
  }
  const order = orderResult.data;

  // Build Stripe Checkout session.
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: err.message,
      order_number: order.order_number,
    });
  }

  const line_items = orderItems.map((it) => ({
    quantity: it.qty,
    price_data: {
      currency: "gbp",
      unit_amount: it.unit_price_pence,
      product_data: {
        name: it.name,
        ...(it.sku ? { metadata: { sku: it.sku } } : {}),
      },
    },
  }));
  if (shipping > 0) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: shipping,
        product_data: { name: "Shipping" },
      },
    });
  }

  try {
    const base = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items,
      success_url: `${base}/website/shop/success?order=${order.order_number}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/website/shop/cancel?order=${order.order_number}`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
      },
    });
    await setStripeSession(order.id, session.id);
    return res.status(200).json({
      success: true,
      url: session.url,
      order_number: order.order_number,
    });
  } catch (err) {
    console.error("[checkout-session] stripe error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
