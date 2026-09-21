// file location: src/features/website/shop/PartsCatalogPage.js
//
// /website/parts-catalog — the real shop.
//
// Unlike the #shop teaser on /website (hard-coded mock tiles), every row
// here comes from the staff DMS Stock Catalogue: public.parts_catalog, read
// through /api/shop/parts-catalog. Every filter — search, category, vehicle
// (make / model), availability, price and sort — lives in the URL query so a
// filtered catalogue can be linked, shared and reloaded, and so the browser
// Back button steps through filters the way customers expect. The #shop
// teaser's vehicle finder and search hand over by linking here with the same
// query keys.
//
// Clicking a tile opens /website/parts-catalog/[partId], where the part can
// also be added to the basket.

import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import ShopShell from "./ShopShell";
import ProductCard from "./ProductCard";
import CartDrawer from "./CartDrawer";
import BasketAccountNotice from "./BasketAccountNotice";
import VehicleFinder from "./VehicleFinder";
import ShopFilters from "./ShopFilters";
import ShopServiceInfo from "./ShopServiceInfo";
import useShopCart from "../hooks/useShopCart";
import usePartsCatalog from "../hooks/usePartsCatalog";
import { siteContent } from "../data/siteContent";

const SEARCH_DEBOUNCE_MS = 300;

// Every filter key this page owns in the URL; "Clear filters" empties them.
const FILTER_KEYS = ["search", "category", "make", "model", "stock", "price"];

const queryString = (value) => (Array.isArray(value) ? value[0] : value) || "";

export default function PartsCatalogPage() {
  const router = useRouter();
  const cart = useShopCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // URL is the source of truth for the filters; searchDraft is the local
  // text-box value so typing stays responsive and only settles into the URL
  // once the customer pauses.
  const search = queryString(router.query.search);
  const category = queryString(router.query.category);
  const make = queryString(router.query.make);
  const model = queryString(router.query.model);
  const stock = queryString(router.query.stock);
  const price = queryString(router.query.price);
  const sort = queryString(router.query.sort) || "name";
  const [searchDraft, setSearchDraft] = useState(search);

  // Adopt the URL value when it changes from outside the box (Back button,
  // a shared link, clearing a filter).
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const setQuery = useCallback(
    (patch) => {
      const next = { ...router.query, ...patch };
      Object.keys(next).forEach((key) => {
        if (!next[key]) delete next[key];
      });
      router.replace({ pathname: "/website/parts-catalog", query: next }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router]
  );

  useEffect(() => {
    if (searchDraft === search) return undefined;
    const timer = setTimeout(() => setQuery({ search: searchDraft }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft, search, setQuery]);

  const { items, categories, total, loading, loadingMore, error, hasMore, loadMore } =
    usePartsCatalog({ search, category, sort, make, model, stock, price });

  const activeCategoryName = useMemo(
    () => categories.find((c) => c.id === category)?.name || null,
    [categories, category]
  );

  const vehicleName = [make, model].filter(Boolean).join(" ");
  const hasFilters = FILTER_KEYS.some((key) => queryString(router.query[key]));
  const pageTitle = `Parts & Accessories - ${siteContent.brand.name}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="Genuine Suzuki and Mitsubishi parts and accessories from Humphries & Parks, West Malling. Search the full catalogue and order online."
        />
      </Head>
      <ShopShell
        eyebrow="Parts & Accessories"
        title="The full parts catalogue"
        lead="Genuine factory parts and accessories, straight from our stock catalogue. Find parts for your vehicle, or search by part number, name or OE reference."
      >
        <BasketAccountNotice cart={cart} />

        <div className="ws-shop-front">
          <VehicleFinder
            idPrefix="ws-catalog-finder"
            vehicle={{ make, model }}
            onApply={(vehicle) => setQuery({ make: vehicle.make, model: vehicle.model })}
            onClear={() => setQuery({ make: "", model: "" })}
          />
        </div>

        <ShopFilters
          filters={{ category, make, stock, price, sort }}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          onChange={setQuery}
          categories={categories}
        />

        <div className="ws-catalog-summary">
          <span className="ws-muted">
            {loading
              ? "Searching the catalogue…"
              : `${total} ${total === 1 ? "part" : "parts"}${
                  activeCategoryName ? ` in ${activeCategoryName}` : ""
                }${vehicleName ? ` for ${vehicleName}` : ""}${search ? ` matching “${search}”` : ""}`}
          </span>
          {hasFilters ? (
            <button
              type="button"
              className="ws-catalog-clear"
              onClick={() => setQuery(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])))}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="ws-catalog-empty">
            <p>{error}</p>
            <p className="ws-muted">
              Give the parts team a ring on{" "}
              <a href="tel:01732870711" className="ws-catalog-phone">
                01732 870711
              </a>{" "}
              and we will sort it over the counter.
            </p>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="ws-catalog-empty">
            <p>
              {hasFilters
                ? "No parts match those filters."
                : "The catalogue is being stocked. Check back shortly."}
            </p>
            <p className="ws-muted">
              We can source almost anything for Suzuki and Mitsubishi — call
              the parts team on{" "}
              <a href="tel:01732870711" className="ws-catalog-phone">
                01732 870711
              </a>
              .
            </p>
          </div>
        ) : null}

        <div className="ws-grid--shop" data-presentation="website-catalog-products">
          {items.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              href={`/website/parts-catalog/${p.id}`}
              inBasketQty={cart.qtyFor(p.id)}
              onAdd={() => {
                cart.add(p, 1);
                setDrawerOpen(true);
              }}
            />
          ))}
        </div>

        {hasMore ? (
          <div className="ws-shop-more">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : `Show more (${total - items.length} left)`}
            </button>
          </div>
        ) : null}

        <ShopServiceInfo />

        <CartDrawer
          open={drawerOpen}
          cart={cart}
          onClose={() => setDrawerOpen(false)}
        />
      </ShopShell>
    </>
  );
}
