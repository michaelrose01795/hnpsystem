// file location: src/features/website/shop/PartsCatalogPage.js
//
// /website/parts-catalog — the real shop.
//
// Unlike the #shop teaser on /website (8 hard-coded mock tiles), every row
// here comes from the staff DMS Stock Catalogue: public.parts_catalog, read
// through /api/shop/parts-catalog. Search, category and sort live in the URL
// query so a filtered catalogue can be linked, shared and reloaded, and so
// the browser Back button steps through filters the way customers expect.
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
import useShopCart from "../hooks/useShopCart";
import usePartsCatalog from "../hooks/usePartsCatalog";
import WebsiteNativeSelect from "../components/WebsiteNativeSelect";
import { siteContent } from "../data/siteContent";

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "price_asc", label: "Price (low to high)" },
  { value: "price_desc", label: "Price (high to low)" },
  { value: "newest", label: "Recently added" },
];

const SEARCH_DEBOUNCE_MS = 300;

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
    usePartsCatalog({ search, category, sort });

  const activeCategoryName = useMemo(
    () => categories.find((c) => c.id === category)?.name || null,
    [categories, category]
  );

  // The category list is a dropdown rather than a row of chips: the stock
  // catalogue carries dozens of categories, which wrapped into several
  // lines of pills and pushed the products themselves below the fold.
  // Counts ride along as the option hint, which only the open menu shows.
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All parts" },
      ...categories.map((c) => ({
        value: c.id,
        label: c.name,
        hint: String(c.count),
      })),
    ],
    [categories]
  );

  const hasFilters = Boolean(search || category);
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
        lead="Genuine factory parts and accessories, straight from our stock catalogue. Search by part number, name or OE reference."
        navActions={
          <button
            type="button"
            className="ws-shop-cartbutton"
            onClick={() => setDrawerOpen(true)}
          >
            Basket
            <span className="ws-shop-cartbutton-count">{cart.totals.count}</span>
          </button>
        }
      >
        <BasketAccountNotice cart={cart} />

        <div className="ws-catalog-controls" data-presentation="website-catalog-controls">
          <div className="ws-catalog-search">
            <label className="ws-sr-only" htmlFor="ws-catalog-search-input">
              Search parts
            </label>
            <input
              id="ws-catalog-search-input"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search part number, name or OE reference"
              autoComplete="off"
            />
          </div>
          <div className="ws-catalog-category">
            <label className="ws-sr-only" htmlFor="ws-catalog-category-select">
              Category
            </label>
            <WebsiteNativeSelect
              id="ws-catalog-category-select"
              value={category}
              onChange={(value) => setQuery({ category: value })}
              options={categoryOptions}
              placeholder=""
              disabled={categories.length === 0}
            />
          </div>
          <div className="ws-catalog-sort">
            <label className="ws-sr-only" htmlFor="ws-catalog-sort-select">
              Sort by
            </label>
            {/* The customer site's own select control (custglobal.css), not
                the staff DropdownField — /website is a separate design
                system and must never pull in staff chrome. */}
            <WebsiteNativeSelect
              id="ws-catalog-sort-select"
              value={sort}
              onChange={(value) => setQuery({ sort: value })}
              options={SORT_OPTIONS}
              placeholder=""
            />
          </div>
        </div>

        <div className="ws-catalog-summary">
          <span className="ws-muted">
            {loading
              ? "Searching the catalogue…"
              : `${total} ${total === 1 ? "part" : "parts"}${
                  activeCategoryName ? ` in ${activeCategoryName}` : ""
                }${search ? ` matching “${search}”` : ""}`}
          </span>
          {hasFilters ? (
            <button
              type="button"
              className="ws-catalog-clear"
              onClick={() => setQuery({ search: "", category: "" })}
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
                ? "No parts match that search."
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

        <CartDrawer
          open={drawerOpen}
          cart={cart}
          onClose={() => setDrawerOpen(false)}
        />
      </ShopShell>
    </>
  );
}
