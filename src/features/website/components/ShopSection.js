// file location: src/features/website/components/ShopSection.js
//
// Public shop section embedded in WebsitePage at #shop. Renders a product
// grid + category filter and exposes a cart drawer.
//
// Styling: every class is .ws-* / .ws-shop-* / .ws-product-* from custglobal.css
// under the PUBLIC SHOP block.

import { useMemo, useState } from "react";
import Link from "next/link";
import useShopProducts from "../hooks/useShopProducts";
import useShopCart, { formatGbp } from "../hooks/useShopCart";

export default function ShopSection() {
  const { products, categories, loading } = useShopProducts();
  const cart = useShopCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCat, setActiveCat] = useState("all");

  const filtered = useMemo(() => {
    if (activeCat === "all") return products;
    return products.filter((p) => p.category_id === activeCat);
  }, [products, activeCat]);

  return (
    <>
      <div className="ws-shop-toolbar" data-presentation="website-shop-filters">
        <div className="ws-shop-filters">
          <button
            type="button"
            className={
              "ws-shop-filter" +
              (activeCat === "all" ? " ws-shop-filter--active" : "")
            }
            onClick={() => setActiveCat("all")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={
                "ws-shop-filter" +
                (activeCat === c.id ? " ws-shop-filter--active" : "")
              }
              onClick={() => setActiveCat(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ws-shop-cartbutton"
          onClick={() => setDrawerOpen(true)}
        >
          Cart
          <span className="ws-shop-cartbutton-count">{cart.totals.count}</span>
        </button>
      </div>

      {loading && (
        <div style={{ color: "var(--txt-mute)", padding: "20px 0" }}>
          Loading products…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ color: "var(--txt-mute)", padding: "20px 0" }}>
          The shop is currently being stocked. Check back soon, or call us on
          01732 870711 for parts enquiries.
        </div>
      )}

      <div className="ws-grid--shop" data-presentation="website-shop-products">
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onAdd={() => {
              cart.add(p, 1);
              setDrawerOpen(true);
            }}
          />
        ))}
      </div>

      <CartDrawer
        open={drawerOpen}
        cart={cart}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

function ProductCard({ product, onAdd }) {
  const out = product.stock_qty <= 0;
  const low = !out && product.stock_qty < 5;
  return (
    <article className="ws-product">
      <div className="ws-product-media">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" />
        ) : null}
      </div>
      <div className="ws-product-body">
        {product.sku ? (
          <span className="ws-product-meta">SKU {product.sku}</span>
        ) : null}
        <h3 className="ws-product-name">{product.name}</h3>
        {product.description ? (
          <p className="ws-product-meta" style={{ margin: 0 }}>
            {product.description}
          </p>
        ) : null}
        <p className="ws-product-price">
          {formatGbp(product.price_pence)}
          {product.compare_at_price_pence ? (
            <span
              style={{
                marginLeft: 8,
                textDecoration: "line-through",
                color: "var(--txt-mute)",
                fontWeight: 500,
                fontSize: "0.85rem",
              }}
            >
              {formatGbp(product.compare_at_price_pence)}
            </span>
          ) : null}
        </p>
        <p
          className={
            "ws-product-stock" +
            (out ? " ws-product-stock--out" : low ? " ws-product-stock--low" : "")
          }
        >
          {out
            ? "Out of stock"
            : low
            ? `Only ${product.stock_qty} left`
            : "In stock"}
        </p>
        <div className="ws-product-add">
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            onClick={onAdd}
            disabled={out}
          >
            {out ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ open, cart, onClose }) {
  return (
    <>
      <div
        className={"ws-cart-backdrop" + (open ? " ws-cart-backdrop--open" : "")}
        onClick={onClose}
      />
      <aside
        data-presentation="website-shop-cart-drawer"
        className={"ws-cart-drawer" + (open ? " ws-cart-drawer--open" : "")}
        aria-hidden={!open}
      >
        <div className="ws-cart-head">
          <h3 className="ws-cart-title">Your cart</h3>
          <button
            type="button"
            className="ws-cart-close"
            onClick={onClose}
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="ws-cart-empty">Your cart is empty.</div>
        ) : (
          <div className="ws-cart-items">
            {cart.items.map((it) => (
              <div key={it.id} className="ws-cart-item">
                <div className="ws-cart-item-media">
                  {it.image_url ? <img src={it.image_url} alt="" /> : null}
                </div>
                <div className="ws-cart-item-body">
                  <span className="ws-cart-item-name">{it.name}</span>
                  <span className="ws-cart-item-meta">
                    {formatGbp(it.price_pence)} each
                  </span>
                  <div className="ws-cart-item-controls">
                    <button
                      type="button"
                      className="ws-cart-qty"
                      onClick={() => cart.updateQty(it.id, it.qty - 1)}
                    >
                      −
                    </button>
                    <span style={{ minWidth: 24, textAlign: "center" }}>
                      {it.qty}
                    </span>
                    <button
                      type="button"
                      className="ws-cart-qty"
                      onClick={() => cart.updateQty(it.id, it.qty + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ws-cart-item-remove"
                      onClick={() => cart.remove(it.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>
                  {formatGbp(it.price_pence * it.qty)}
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.items.length > 0 && (
          <div className="ws-cart-foot">
            <div className="ws-cart-totals">
              <span>Subtotal</span>
              <span>{cart.totals.subtotal}</span>
            </div>
            <Link href="/website/shop/checkout" className="ws-btn ws-btn--primary">
              Checkout
            </Link>
            <Link href="/website/shop/cart" className="ws-btn ws-btn--ghost">
              View cart
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
