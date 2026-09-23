// file location: src/features/website/shop/BasketAccountNotice.js
//
// The line the basket shows about where it is being kept.
//
//   signed out -> "Your basket is saved on this device" + a Sign in link
//                 that returns the customer to where they were.
//   signed in  -> confirmation that it is saved to the account.
//
// Signing in is never required to shop: the basket already works from
// localStorage, so this prompts rather than blocks.
//
// Styling: .ws-basket-notice from custglobal.css (PUBLIC SHOP block).

import Link from "next/link";
import { useRouter } from "next/router";

export default function BasketAccountNotice({ cart, compact = false }) {
  const router = useRouter();

  if (cart.sessionLoading) return null;

  if (cart.signedIn) {
    const name = cart.customer?.firstname || cart.customer?.name;
    return (
      <p className="ws-basket-notice ws-basket-notice--ok">
        {cart.savedToAccount
          ? `Saved to your account${name ? `, ${name}` : ""} — pick it up on any device.`
          : "Signed in. Your basket is kept on this device."}
      </p>
    );
  }

  // asPath keeps any query/hash, so ?next= returns to the exact page.
  const next = encodeURIComponent(router.asPath || "/website/parts-catalog");

  return (
    <div className={"ws-basket-notice" + (compact ? " ws-basket-notice--compact" : "")}>
      <span>
        Your basket is saved on this device.{" "}
        <strong>Sign in to keep it</strong> and check out faster.
      </span>
      <Link href={`/website/login?next=${next}`} className="ws-btn ws-btn--ghost">
        Sign in
      </Link>
    </div>
  );
}
