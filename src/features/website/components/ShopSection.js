// file location: src/features/website/components/ShopSection.js
//
// The #shop block on /website: the shop front, not the shop.
//
// It gives a visitor three ways in, all of which hand over to the real,
// DB-backed catalogue at /website/parts-catalog (public.parts_catalog):
//   - Find parts for my vehicle (registration or make / model)
//   - a part search
//   - the curated tiles below
// alongside a clear basket summary and the delivery / collection / help strip.
//
// The tiles are exactly the hard-coded rows in data/shopProducts.js, capped at
// SHOP_TEASER_LIMIT, so the marketing page is always full and always fast and
// never shows an empty grid because the parts counter ran the stock down.
// Because those rows have no parts_catalog id behind them they do not add to
// the basket — a mock id would fail re-pricing at checkout — so each tile links
// through to the catalogue, where the real item carries Add to basket.
//
// Styling: .ws-shop-* / .ws-product-* / .ws-basket-summary-* / .ws-finder-*
// from custglobal.css (@family shop), plus the shared .ws-tabs.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import useShopCart from "../hooks/useShopCart";
import {
  shopProducts,
  shopCategories,
  SHOP_TEASER_LIMIT,
} from "../data/shopProducts";
import ProductCard from "../shop/ProductCard";
import CartDrawer from "../shop/CartDrawer";
import BasketSummary from "../shop/BasketSummary";
import VehicleFinder from "../shop/VehicleFinder";
import ShopServiceInfo from "../shop/ShopServiceInfo";

const CATALOG_HREF = "/website/parts-catalog";

export default function ShopSection() {
  const router = useRouter();
  const cart = useShopCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");

  // Always capped at the teaser limit, whatever the filter selects.
  const visible = useMemo(() => {
    const pool =
      activeCat === "all"
        ? shopProducts
        : shopProducts.filter((p) => p.category_id === activeCat);
    return pool.slice(0, SHOP_TEASER_LIMIT);
  }, [activeCat]);

  const openCatalogue = (query) => {
    const clean = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
    router.push({ pathname: CATALOG_HREF, query: clean });
  };

  const tabs = [{ id: "all", name: "All" }, ...shopCategories];

  return (
    <>
      <div className="ws-shop-front">
        <VehicleFinder idPrefix="ws-shop-finder" onApply={({ make, model }) => openCatalogue({ make, model })} />
        <div className="ws-shop-side">
          <BasketSummary cart={cart} onOpen={() => setDrawerOpen(true)} />
          <form
            className="ws-card ws-panel ws-shop-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              openCatalogue({ search: search.trim() });
            }}
          >
            <label className="ws-stock-field" htmlFor="ws-shop-search-input">
              <span className="ws-stock-label">Search parts</span>
              <input
                id="ws-shop-search-input"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Part name, number or OE reference"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="ws-btn ws-btn--primary">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="ws-tabs" role="tablist" aria-label="Filter parts" data-presentation="website-shop-filters">
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={activeCat === c.id}
            className={activeCat === c.id ? "ws-tab ws-tab--active" : "ws-tab"}
            onClick={() => setActiveCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="ws-grid--shop" data-presentation="website-shop-products">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} href={CATALOG_HREF} />
        ))}
      </div>

      <ShopServiceInfo />

      <div className="ws-shop-more" data-presentation="website-shop-more">
        <p className="ws-muted">
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
