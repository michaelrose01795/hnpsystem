// file location: src/features/website/shop/CancelPage.js
// /website/shop/cancel?order=HNP-2026-XXXXXX
// Reached when the customer dismisses the Stripe Checkout. We leave the cart
// intact so they can try again.

import { useRouter } from "next/router";
import Link from "next/link";
import ShopShell from "./ShopShell";

export default function CancelPage() {
  const router = useRouter();
  const orderNumber = router.query.order || "";
  return (
    <ShopShell title="Checkout cancelled">
      <div className="ws-card ws-shop-state">
        <p className="ws-shop-state-lead">
          No payment was taken{orderNumber ? ` — order ${orderNumber} is on hold` : ""}.
          Your cart is still saved so you can finish later.
        </p>
        <div className="ws-shop-state-actions">
          <Link href="/website/shop/cart" className="ws-btn ws-btn--primary">
            Return to cart
          </Link>
          <Link href="/website#shop" className="ws-btn ws-btn--ghost">
            Continue shopping
          </Link>
        </div>
      </div>
    </ShopShell>
  );
}
