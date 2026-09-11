// file location: src/features/website/stock/AvailableStockPage.js
// /website/available-stock — the full vehicle search.
//
// Every car comes from the DMS vehicle stock (src/lib/stock/vehicleStock.js);
// this page only filters, sorts and presents it. The filter work itself lives
// in that module so the home page teaser, this search and any future stock
// feed all agree on what "used, under £20,000, automatic" means.
//
// ENTRY FILTER
// ------------
// The Cars block on /website links here with ?filter=new | used | all, taken
// from whichever tab the visitor had open. That choice is applied before the
// first paint of the results, so the page opens on the stock they were already
// looking at rather than resetting them to everything.
//
// Styling is entirely custglobal.css: the shared .ws-* families plus the
// .ws-stock-* rules added for this page. No inline visual styling.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import StockShell from "./StockShell";
import VehicleCard from "../components/VehicleCard";
import WebsiteNativeSelect from "../components/WebsiteNativeSelect";
import { FEATURED_VEHICLE_LIMIT } from "../data/vehicles";
import {
  listStock,
  filterStock,
  sortStock,
  stockFacets,
  priceLabel,
  mileageLabel,
  stockHref,
  PRICE_BANDS,
  MILEAGE_BANDS,
  SORT_OPTIONS,
} from "@/lib/stock/vehicleStock";

const CONDITION_TABS = [
  { id: "all", label: "All cars" },
  { id: "new", label: "New" },
  { id: "used", label: "Used" },
];

const EMPTY_FILTERS = {
  condition: "all",
  query: "",
  model: "",
  fuel: "",
  transmission: "",
  bodyStyle: "",
  priceBand: "",
  mileageBand: "",
};

// ?filter= accepts only the three tab ids; anything else means "all" rather
// than an empty result set the visitor cannot explain.
const readCondition = (value) => {
  const v = Array.isArray(value) ? value[0] : value;
  return CONDITION_TABS.some((t) => t.id === v) ? v : "all";
};

const first = (value) => (Array.isArray(value) ? value[0] : value) || "";

// Turns the query string handed over by getServerSideProps into filter state.
// The inverse lives in syncUrl below — keep the two in step.
const filtersFromQuery = (q = {}) => ({
  condition: readCondition(q.filter ?? q.condition),
  query: first(q.q),
  model: first(q.model),
  fuel: first(q.fuel),
  transmission: first(q.transmission),
  bodyStyle: first(q.body),
  priceBand: first(q.price),
  mileageBand: first(q.mileage),
});

const sortFromQuery = (q = {}) => {
  const value = first(q.sort);
  return SORT_OPTIONS.some((o) => o.value === value) ? value : "newest";
};

const asOptions = (values, placeholder) => [
  { value: "", label: placeholder },
  ...values.map((v) => ({ value: v, label: v })),
];

const bandOptions = (bands, placeholder) => [
  { value: "", label: placeholder },
  ...bands.map((b) => ({ value: b.value, label: b.label })),
];

export default function AvailableStockPage({ initialQuery = {} }) {
  const router = useRouter();

  const allStock = useMemo(() => listStock(), []);
  const facets = useMemo(() => stockFacets(allStock), [allStock]);

  // Seeded from the server-rendered query so the New / Used tab the visitor
  // chose on the home page is already applied in the first paint.
  const [filters, setFilters] = useState(() => filtersFromQuery(initialQuery));
  const [sort, setSort] = useState(() => sortFromQuery(initialQuery));
  const [filtersOpen, setFiltersOpen] = useState(false);

  // There is deliberately no effect re-reading router.query. Every arrival at
  // this route — a fresh load, a <Link> from the Cars block, an edited URL —
  // re-runs getServerSideProps and remounts this component, so `initialQuery`
  // above is always current. The only other query changes are the shallow
  // writes syncUrl makes below; adopting those back into state would fight the
  // search box, because router.replace resolves a keystroke behind the input.

  // Keep the URL in step so a filtered view can be shared or bookmarked.
  // Shallow so Next does not re-run data fetching for a filter change.
  const syncUrl = useCallback(
    (nextFilters, nextSort) => {
      if (!router.isReady) return;
      const query = {};
      if (nextFilters.condition && nextFilters.condition !== "all") query.filter = nextFilters.condition;
      if (nextFilters.query) query.q = nextFilters.query;
      if (nextFilters.model) query.model = nextFilters.model;
      if (nextFilters.fuel) query.fuel = nextFilters.fuel;
      if (nextFilters.transmission) query.transmission = nextFilters.transmission;
      if (nextFilters.bodyStyle) query.body = nextFilters.bodyStyle;
      if (nextFilters.priceBand) query.price = nextFilters.priceBand;
      if (nextFilters.mileageBand) query.mileage = nextFilters.mileageBand;
      if (nextSort && nextSort !== "newest") query.sort = nextSort;
      router.replace({ pathname: "/website/available-stock", query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

  const update = useCallback(
    (patch) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        syncUrl(next, sort);
        return next;
      });
    },
    [sort, syncUrl],
  );

  const changeSort = useCallback(
    (value) => {
      setSort(value);
      syncUrl(filters, value);
    },
    [filters, syncUrl],
  );

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSort("newest");
    syncUrl(EMPTY_FILTERS, "newest");
  }, [syncUrl]);

  const results = useMemo(
    () => sortStock(filterStock(allStock, filters), sort),
    [allStock, filters, sort],
  );

  // Counts on the tabs ignore the condition filter but respect everything
  // else, so switching tab shows the number the visitor is about to get.
  const tabCounts = useMemo(() => {
    const withoutCondition = filterStock(allStock, { ...filters, condition: "all" });
    return {
      all: withoutCondition.length,
      new: withoutCondition.filter((v) => v.condition === "new").length,
      used: withoutCondition.filter((v) => v.condition === "used").length,
    };
  }, [allStock, filters]);

  // The chips are the only honest summary of an eight-control filter panel on
  // a phone, where the panel itself is collapsed.
  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.query) chips.push({ key: "query", label: `“${filters.query}”`, patch: { query: "" } });
    if (filters.model) chips.push({ key: "model", label: filters.model, patch: { model: "" } });
    if (filters.priceBand) {
      const band = PRICE_BANDS.find((b) => b.value === filters.priceBand);
      chips.push({ key: "priceBand", label: band?.label || "Price", patch: { priceBand: "" } });
    }
    if (filters.mileageBand) {
      const band = MILEAGE_BANDS.find((b) => b.value === filters.mileageBand);
      chips.push({ key: "mileageBand", label: band?.label || "Mileage", patch: { mileageBand: "" } });
    }
    if (filters.fuel) chips.push({ key: "fuel", label: filters.fuel, patch: { fuel: "" } });
    if (filters.transmission)
      chips.push({ key: "transmission", label: filters.transmission, patch: { transmission: "" } });
    if (filters.bodyStyle) chips.push({ key: "bodyStyle", label: filters.bodyStyle, patch: { bodyStyle: "" } });
    return chips;
  }, [filters]);

  const cards = results.map((v) => ({
    id: v.stockNumber,
    type: v.condition,
    brand: v.make,
    model: `${v.model} ${v.derivative}`,
    year: v.year,
    price: priceLabel(v),
    miles: mileageLabel(v),
    badge: v.badge || null,
    image: v.images?.[0] || null,
    reg: v.reg,
    stockNumber: v.stockNumber,
    href: stockHref(v),
  }));

  return (
    <StockShell
      title="Available stock — Humphries & Parks"
      description="Search every new and used car in stock at Humphries & Parks in West Malling, Kent. Filter by price, mileage, fuel, transmission and body style."
    >
      <section className="ws-section ws-stock-hero">
        <div className="ws-container">
          <span className="ws-eyebrow">Available stock</span>
          <h1 className="ws-h1">Find your next car</h1>
          <p className="ws-lead">
            Every car below is on site at West Malling and ready to view. Prices include our
            pre-delivery inspection, a fresh MOT on every used car and a full valet.
          </p>
        </div>
      </section>

      <section className="ws-section ws-stock-body">
        <div className="ws-container">
          {/* Tabs, count, sort and the mobile filter toggle sit ABOVE the two
              columns on purpose: on a phone the filter panel then opens
              directly beneath the button that opened it, rather than above
              the toolbar where it would shove the results out of view. */}
          <div className="ws-stock-head">
            <div className="ws-tabs" role="tablist" aria-label="New or used">
              {CONDITION_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filters.condition === tab.id}
                  className={filters.condition === tab.id ? "ws-tab ws-tab--active" : "ws-tab"}
                  onClick={() => update({ condition: tab.id })}
                >
                  {tab.label}
                  <span className="ws-tab-count">{tabCounts[tab.id]}</span>
                </button>
              ))}
            </div>

            <div className="ws-stock-toolbar">
              <p className="ws-stock-count">
                <strong>{results.length}</strong> {results.length === 1 ? "car" : "cars"} in stock
              </p>
              <div className="ws-stock-toolbar-controls">
                <button
                  type="button"
                  className="ws-stock-filters-toggle"
                  onClick={() => setFiltersOpen((v) => !v)}
                  aria-expanded={filtersOpen}
                  aria-controls="stock-filters"
                >
                  {filtersOpen ? "Hide filters" : "Filters"}
                  {activeChips.length ? <span className="ws-tab-count">{activeChips.length}</span> : null}
                </button>
                <div className="ws-stock-sort">
                  <span className="ws-stock-label" id="stock-sort-label">
                    Sort by
                  </span>
                  <WebsiteNativeSelect
                    value={sort}
                    onChange={changeSort}
                    options={SORT_OPTIONS}
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            {activeChips.length ? (
              <div className="ws-chips ws-stock-chips">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="ws-chip ws-chip--clear"
                    onClick={() => update(chip.patch)}
                  >
                    {chip.label}
                    <span aria-hidden="true">×</span>
                    <span className="ws-sr-only">Remove filter</span>
                  </button>
                ))}
                <button type="button" className="ws-chip ws-chip--clear" onClick={clearAll}>
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          <div className="ws-stock-layout">
          {/* ---------------- Filter rail ---------------- */}
          <aside
            id="stock-filters"
            className="ws-stock-filters"
            data-open={filtersOpen ? "true" : "false"}
            aria-label="Filter stock"
          >
            <div className="ws-stock-filters-head">
              <h2 className="ws-stock-filters-title">Filters</h2>
              {activeChips.length ? (
                <button type="button" className="ws-stock-clear" onClick={clearAll}>
                  Clear all
                </button>
              ) : null}
            </div>

            <div className="ws-stock-field">
              <label className="ws-stock-label" htmlFor="stock-search">
                Search
              </label>
              <input
                id="stock-search"
                type="search"
                className="ws-stock-input"
                placeholder="Model, colour, registration…"
                value={filters.query}
                onChange={(e) => update({ query: e.target.value })}
              />
            </div>

            <div className="ws-stock-field">
              <span className="ws-stock-label">Model</span>
              <WebsiteNativeSelect
                value={filters.model}
                onChange={(value) => update({ model: value })}
                options={asOptions(facets.models, "Any model")}
                placeholder=""
              />
            </div>

            <div className="ws-stock-field">
              <span className="ws-stock-label">Price</span>
              <WebsiteNativeSelect
                value={filters.priceBand}
                onChange={(value) => update({ priceBand: value })}
                options={bandOptions(PRICE_BANDS, "Any price")}
                placeholder=""
              />
            </div>

            <div className="ws-stock-field">
              <span className="ws-stock-label">Mileage</span>
              <WebsiteNativeSelect
                value={filters.mileageBand}
                onChange={(value) => update({ mileageBand: value })}
                options={bandOptions(MILEAGE_BANDS, "Any mileage")}
                placeholder=""
              />
            </div>

            <div className="ws-stock-field">
              <span className="ws-stock-label">Fuel</span>
              <WebsiteNativeSelect
                value={filters.fuel}
                onChange={(value) => update({ fuel: value })}
                options={asOptions(facets.fuels, "Any fuel")}
                placeholder=""
              />
            </div>

            <div className="ws-stock-field">
              <span className="ws-stock-label">Transmission</span>
              <WebsiteNativeSelect
                value={filters.transmission}
                onChange={(value) => update({ transmission: value })}
                options={asOptions(facets.transmissions, "Any transmission")}
                placeholder=""
              />
            </div>

            <div className="ws-stock-field">
              <span className="ws-stock-label">Body style</span>
              <WebsiteNativeSelect
                value={filters.bodyStyle}
                onChange={(value) => update({ bodyStyle: value })}
                options={asOptions(facets.bodyStyles, "Any body style")}
                placeholder=""
              />
            </div>

            <button
              type="button"
              className="ws-stock-filters-done"
              onClick={() => setFiltersOpen(false)}
            >
              Show {results.length} {results.length === 1 ? "car" : "cars"}
            </button>
          </aside>

          {/* ---------------- Results ---------------- */}
          <div className="ws-stock-results">
            {results.length ? (
              <div className="ws-grid ws-grid--cards">
                {cards.map((card, idx) => (
                  <VehicleCard key={card.id} vehicle={card} priority={idx < FEATURED_VEHICLE_LIMIT} />
                ))}
              </div>
            ) : (
              <div className="ws-card ws-stock-empty">
                <h2 className="ws-h3">Nothing matches those filters</h2>
                <p className="ws-muted">
                  We move around 30 cars a month, so it is worth telling us what you are after — we
                  will call you when the right one lands.
                </p>
                <div className="ws-stock-empty-actions">
                  <button type="button" className="ws-stock-empty-btn" onClick={clearAll}>
                    Clear filters
                  </button>
                  <Link href="/website#contact" className="ws-btn ws-btn--ghost">
                    Tell us what you want
                  </Link>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </section>
    </StockShell>
  );
}
