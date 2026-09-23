// file location: src/features/website/shop/ProductCard.js
//
// One product tile, shared by the #shop teaser on /website, the full
// catalogue at /website/parts-catalog and the "you may also need" strip on
// a product page. Keeping one card means the teaser and the real shop
// cannot drift apart visually.
//
// A tile answers what a buyer checks first: what it is, whether it fits the
// car, what it costs (and what it cost before), whether it is on the shelf,
// and the button to buy it. Compatibility comes from product.fitment (set by
// the catalogue read layer) or is inferred the same way for code-owned rows
// (src/lib/parts/vehicleFitment.js).
//
// parts_catalog carries no imagery, so a card with no image_url draws a
// typographic placeholder from the part number rather than a broken frame.
//
// Styling: .ws-product-* from custglobal.css (PUBLIC SHOP block).

import Link from "next/link";
import { formatGbp } from "../hooks/useShopCart";
import { fitmentFor } from "@/lib/parts/vehicleFitment";

const LOW_STOCK_THRESHOLD = 5;

export function ProductMedia({ product, badge }) {
  if (product.image_url) {
    return (
      <div className="ws-product-media">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {badge ? <span className="ws-badge">{badge}</span> : null}
      </div>
    );
  }
  const initials = String(product.sku || product.name || "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="ws-product-media ws-product-media--empty">
      <span className="ws-product-media-mark" aria-hidden="true">{initials}</span>
      {badge ? <span className="ws-badge">{badge}</span> : null}
    </div>
  );
}

export function StockLine({ product }) {
  const qty = Number(product.stock_qty) || 0;
  const out = qty <= 0;
  const low = !out && qty < LOW_STOCK_THRESHOLD;
  return (
    <p
      className={
        "ws-product-stock" +
        (out
          ? " ws-product-stock--out"
          : low
          ? " ws-product-stock--low"
          : "")
      }
    >
      {out ? "Available to order" : low ? `Only ${qty} left` : "In stock"}
    </p>
  );
}

export function FitmentLine({ product }) {
  const label = (product.fitment || fitmentFor(product)).label;
  return (
    <p className={label ? "ws-product-fit" : "ws-product-fit ws-product-fit--unknown"}>
      {label || "Check fitment with our parts team"}
    </p>
  );
}

export default function ProductCard({ product, href, onAdd, inBasketQty = 0 }) {
  const out = (Number(product.stock_qty) || 0) <= 0;
  const saving = (Number(product.compare_at_price_pence) || 0) - (Number(product.price_pence) || 0);

  const body = (
    <>
      <ProductMedia product={product} badge={saving > 0 ? `Save ${formatGbp(saving)}` : null} />
      <div className="ws-product-body">
        {product.sku ? (
          <span className="ws-product-meta">{product.sku}</span>
        ) : null}
        <h3 className="ws-product-name">{product.name}</h3>
        <FitmentLine product={product} />
        <p className="ws-product-price">
          {formatGbp(product.price_pence)}
          {saving > 0 ? (
            <span className="ws-product-was">
              <span className="ws-sr-only">Was </span>
              {formatGbp(product.compare_at_price_pence)}
            </span>
          ) : null}
        </p>
        <StockLine product={product} />
      </div>
    </>
  );

  return (
    <article className="ws-product">
      {href ? (
        <Link href={href} className="ws-product-link">
          {body}
        </Link>
      ) : (
        body
      )}
      <div className="ws-product-add">
        {onAdd && !out ? (
          <button type="button" className="ws-btn ws-btn--primary" onClick={onAdd}>
            {inBasketQty > 0 ? `Add another (${inBasketQty} in basket)` : "Add to basket"}
          </button>
        ) : onAdd && out ? (
          // Nothing on the shelf: the product page offers the phone order.
          href ? (
            <Link href={href} className="ws-btn ws-btn--ghost">
              Enquire
            </Link>
          ) : (
            <button type="button" className="ws-btn ws-btn--ghost" disabled>
              Enquire
            </button>
          )
        ) : (
          <Link href={href || "/website/parts-catalog"} className="ws-btn ws-btn--ghost">
            View part
          </Link>
        )}
      </div>
    </article>
  );
}
