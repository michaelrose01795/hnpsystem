// file location: src/features/website/components/ShopSection.js
//
// The #shop teaser on /website. A curated preview, not the shop.
//
// It renders exactly SHOP_TEASER_LIMIT (8) items of hard-coded mock data
// from data/shopProducts.js, so the marketing page is always full and
// always fast, and never shows an empty grid because the parts counter
// happened to run the stock down. "Show all parts & accessories" hands
// over to /website/parts-catalog, which is the real, DB-backed shop
// reading the staff DMS Stock Catalogue (public.parts_catalog).
//
// Because these tiles are mock rows with no parts_catalog id behind them,
// they do not add to the basket — a mock id would fail re-pricing at
// checkout. Each tile links through to the catalogue instead, where the
// real item can be basketed. The basket button stays in the toolbar so
// the drawer is reachable from the homepage.
//
// Styling: every class is .ws-* / .ws-shop-* / .ws-product-* from
// custglobal.css under the PUBLIC SHOP block.

import { useMemo, useState } from "react";
import Link from "next/link";
import useShopCart from "../hooks/useShopCart";
import {
  shopProducts,
  shopCategories,
  SHOP_TEASER_LIMIT,
} from "../data/shopProducts";
import ProductCard from "../shop/ProductCard";
import CartDrawer from "../shop/CartDrawer";

const CATALOG_HREF = "/website/parts-catalog";

export default function ShopSection() {
  const cart = useShopCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCat, setActiveCat] = useState("all");

  // Always capped at the teaser limit, whatever the filter selects.
  const visible = useMemo(() => {
    const pool =
      activeCat === "all"
        ? shopProducts
        : shopProducts.filter((p) => p.category_id === activeCat);
    return pool.slice(0, SHOP_TEASER_LIMIT);
  }, [activeCat]);

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
          {shopCategories.map((c) => (
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
          Basket
          <span className="ws-shop-cartbutton-count">{cart.totals.count}</span>
        </button>
      </div>

      <div className="ws-grid--shop" data-presentation="website-shop-products">
        {visible.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            href={CATALOG_HREF}
          />
        ))}
      </div>

      <div className="ws-shop-more" data-presentation="website-shop-more">
        <p className="ws-muted" style={{ margin: 0 }}>
          A selection of what we stock — the full catalogue runs to thousands of
          genuine Suzuki and Mitsubishi parts.
        </p>
        <Link href={CATALOG_HREF} className="ws-btn ws-btn--primary">
          Show all parts &amp; accessories
        </Link>
      </div>

      <CartDrawer
        open={drawerOpen}
        cart={cart}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
