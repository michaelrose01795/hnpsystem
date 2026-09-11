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
//
// Two catalogues feed the basket (2026-09-11):
//   • public.parts_catalog  — the staff DMS Stock Catalogue, shown at
//     /website/parts-catalog. This is where nearly everything comes from.
//   • public.shop_products  — the older standalone marketing store.
// An id is looked up in the parts catalogue first and falls back to the
// marketing store, so both keep working from one basket.

import {
  getProductsByIds,
  createPendingOrder,
  setStripeSession,
} from "@/lib/database/shop";
import { getPublicPartsByIds } from "@/lib/database/partsCatalogPublic";
import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
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

  // Recompute pricing server-side, from both catalogues.
  const ids = items.map((i) => i.id);
  const [parts, storeProducts] = await Promise.all([
    getPublicPartsByIds(ids),
    getProductsByIds(ids),
  ]);
  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));
  const productMap = Object.fromEntries(storeProducts.map((p) => [p.id, p]));

  const orderItems = [];
  let subtotal = 0;
  for (const it of items) {
    const part = partMap[it.id];
    const product = part || productMap[it.id];
    // Marketing-store rows carry a status; parts-catalogue rows are already
    // filtered to is_active + priced by getPublicPartsByIds.
    if (!product || (!part && product.status !== "published")) {
      return res.status(400).json({
        success: false,
        message: `Item ${it.id} is no longer available.`,
      });
    }
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const line_total = product.price_pence * qty;
    orderItems.push({
      // shop_order_items.product_id points at shop_products. A parts-catalogue
      // line is therefore recorded by part number rather than by id, so the
      // insert cannot break that foreign key. The part number is unique in
      // parts_catalog, so the parts team can still pick the order from it.
      // TODO: add a nullable parts_catalog_id column to shop_order_items and
      // store the real link — see docs note in src/lib/database/schema/shop-carts.sql.
      product_id: part ? null : product.id,
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

  // Attach the order to the signed-in customer when there is one, so it shows
  // up against their account rather than only against the email they typed.
  const customerSession = getCustomerSessionFromReq(req);

  const orderResult = await createPendingOrder({
    customerId: customerSession?.customerId || null,
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
