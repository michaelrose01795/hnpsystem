// file location: src/features/website/shop/SuccessPage.js
// /website/shop/success?order=HNP-2026-XXXXXX
// Stripe sends the customer here after a successful checkout. We clear the
// local cart and show an order-number receipt. The webhook (running in the
// background) is what actually marks the order paid.

import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShopShell from "./ShopShell";
import useShopCart from "../hooks/useShopCart";

export default function SuccessPage() {
  const router = useRouter();
  const cart = useShopCart();
  const orderNumber = router.query.order || "";

  useEffect(() => {
    cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ShopShell title="Thank you — order received">
      <div className="ws-card" style={{ padding: 30, textAlign: "center" }}>
        <p style={{ color: "var(--txt-soft)", fontSize: "1.05rem" }}>
          Your payment has been accepted. A confirmation email is on its way.
        </p>
        {orderNumber ? (
          <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Order reference:{" "}
            <span style={{ color: "var(--accentText)" }}>{orderNumber}</span>
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
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
