// file location: src/features/website/shop/ProductCard.js
//
// One product tile, shared by the #shop teaser on /website, the full
// catalogue at /website/parts-catalog and the "you may also need" strip on
// a product page. Keeping one card means the teaser and the real shop
// cannot drift apart visually.
//
// parts_catalog carries no imagery, so a card with no image_url draws a
// typographic placeholder from the part number rather than a broken frame.
//
// Styling: .ws-product-* from custglobal.css (PUBLIC SHOP block).

import Link from "next/link";
import { formatGbp } from "../hooks/useShopCart";

const LOW_STOCK_THRESHOLD = 5;

export function ProductMedia({ product }) {
  if (product.image_url) {
    return (
      <div className="ws-product-media">
        <img src={product.image_url} alt={product.name} loading="lazy" />
      </div>
    );
  }
  const initials = String(product.sku || product.name || "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="ws-product-media ws-product-media--empty" aria-hidden="true">
      <span className="ws-product-media-mark">{initials}</span>
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

export default function ProductCard({ product, href, onAdd, inBasketQty = 0 }) {
  const out = (Number(product.stock_qty) || 0) <= 0;

  const body = (
    <>
      <ProductMedia product={product} />
      <div className="ws-product-body">
        {product.sku ? (
          <span className="ws-product-meta">{product.sku}</span>
        ) : null}
        <h3 className="ws-product-name">{product.name}</h3>
        {product.description ? (
          <p className="ws-product-meta ws-product-desc">{product.description}</p>
        ) : null}
        <p className="ws-product-price">
          {formatGbp(product.price_pence)}
          {product.compare_at_price_pence ? (
            <span className="ws-product-was">
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
        {onAdd ? (
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            onClick={onAdd}
            disabled={out}
          >
            {out
              ? "Enquire"
              : inBasketQty > 0
              ? `In basket (${inBasketQty})`
              : "Add to basket"}
          </button>
        ) : (
          <Link href={href || "/website/parts-catalog"} className="ws-btn ws-btn--ghost">
            View part
          </Link>
        )}
      </div>
    </article>
  );
}
