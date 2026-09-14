// file location: src/pages/api/shop/simulate-payment.js
//
// POST /api/shop/simulate-payment
//
// In-app TEST payment for the shop while Stripe is switched off. No card is
// charged and the card details are not sent or stored.
//
// Body: { order_number, attempt, method }
//   method: card | apple_pay | google_pay | paypal — informational only; every
//   method is simulated the same way and nothing is ever charged.
//
// The first attempt on an order is declined at random (DECLINE_RATE), so the
// error path can be exercised without it happening every time. Any retry
// (attempt > 1) always succeeds. On success the order is marked paid and stock
// is decremented, exactly as the Stripe webhook does.

import {
  getOrderByNumber,
  markOrderPaid,
  decrementStockForOrder,
} from "@/lib/database/shop";

const DECLINE_RATE = 0.4;

const DECLINE_REASONS = [
  "Your card was declined by the issuing bank.",
  "The payment could not be authorised. Please try again.",
  "Card verification failed. Please try again.",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { order_number: orderNumber, attempt } = req.body || {};
  if (!orderNumber) {
    return res.status(400).json({ success: false, message: "Order reference required." });
  }

  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found." });
  }
  if (order.status === "paid") {
    return res.status(200).json({ success: true, order_number: order.order_number });
  }

  const attemptNo = Math.max(1, parseInt(attempt, 10) || 1);
  if (attemptNo === 1 && Math.random() < DECLINE_RATE) {
    const reason = DECLINE_REASONS[Math.floor(Math.random() * DECLINE_REASONS.length)];
    return res.status(402).json({ success: false, declined: true, message: reason });
  }

  const paid = await markOrderPaid(order.id);
  if (!paid.ok) {
    return res.status(500).json({ success: false, message: paid.error });
  }
  await decrementStockForOrder(order.id);

  return res.status(200).json({ success: true, order_number: order.order_number });
}
