// file location: src/features/website/shop/BasketSummary.js
//
// The basket, stated plainly: how many items, what they come to, and the two
// things to do next. Replaces the old icon-and-number basket button, which sat
// detached in a toolbar and said nothing about the total.
//
// Reads the same useShopCart object every shop surface already holds, so the
// count and total are the hook's own totals — nothing is recalculated here.
// `onOpen` opens that page's CartDrawer; without it "View basket" goes to the
// basket step of /website/shop instead.
//
// Styling: .ws-basket-summary-* in custglobal.css (@family shop).

import Link from "next/link";
import WebsiteIcon from "@/features/website/components/WebsiteIcon";

export function BasketButton({ count = 0, onNavigate }) {
  return (
    <Link href="/website/shop?step=basket" className="ws-nav-basket" onClick={onNavigate}
      aria-label={`Your basket, ${count} ${count === 1 ? "item" : "items"}`}>
      <WebsiteIcon name="basket" />
      {count > 0 ? <span className="ws-nav-basket-count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}

export default function BasketSummary({ cart, onOpen }) {
  const count = cart?.totals?.count || 0;
  return (
    <div className="ws-basket-summary">
      <span className="ws-basket-summary-icon" aria-hidden="true" />
      <div className="ws-basket-summary-text" aria-live="polite">
        <span className="ws-basket-summary-title">Your basket</span>
        <span className="ws-basket-summary-meta">
          {count ? `${count} ${count === 1 ? "item" : "items"} · ${cart.totals.subtotal}` : "No items yet"}
        </span>
      </div>
      <div className="ws-basket-summary-actions">
        {onOpen ? (
          <button type="button" onClick={onOpen} aria-haspopup="dialog">
            View basket
          </button>
        ) : (
          <Link href="/website/shop?step=basket" className="ws-btn ws-btn--ghost">
            View basket
          </Link>
        )}
        {count ? (
          <Link href="/website/shop?step=details" className="ws-btn ws-btn--primary">
            Checkout
          </Link>
        ) : null}
      </div>
    </div>
  );
}
