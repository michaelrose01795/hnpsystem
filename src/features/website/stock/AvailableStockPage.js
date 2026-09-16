// file location: src/features/website/stock/AvailableStockPage.js
// /website/available-stock — the full vehicle search.
//
// Every car comes from the DMS vehicle stock (src/lib/stock/vehicleStock.js);
// this page only filters, sorts and presents it. Filter state, counts, chips
// and paging live in useStockSearch, which the Our Cars block on /website
// also uses, so both agree on what "used, under £300 a month, automatic"
// means. The fields are the shared VehicleSearchFilters.
//
// ENTRY FILTER
// ------------
// The Cars block on /website links here with its whole search in the query
// string ("View all cars"). getServerSideProps hands that over, so it is
// applied before the first paint of the results rather than resetting the
// visitor to everything.
//
// Styling is entirely custglobal.css: the shared .ws-* families plus the
// .ws-stock-* rules for this page. No inline visual styling.

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import StockShell from "./StockShell";
import VehicleCard from "../components/VehicleCard";
import VehicleSearchFilters from "../components/VehicleSearchFilters";
import WebsiteNativeSelect from "../components/WebsiteNativeSelect";
import useStockSearch, {
  CONDITION_TABS,
  filtersFromQuery,
  filtersToQuery,
  sortFromQuery,
} from "../hooks/useStockSearch";
import { SORT_OPTIONS } from "@/lib/stock/vehicleStock";

// Cards per "Load more vehicles" step: three rows on a wide screen.
const STOCK_PAGE_SIZE = 24;

export default function AvailableStockPage({ initialQuery = {} }) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // There is deliberately no effect re-reading router.query. Every arrival at
  // this route re-runs getServerSideProps and remounts this component, so
  // `initialQuery` is always current. The only other query changes are the
  // shallow writes below; adopting those back into state would fight the
  // search box, because router.replace resolves a keystroke behind the input.
  //
  // Keep the URL in step so a filtered view can be shared or bookmarked.
  // Shallow so Next does not re-run data fetching for a filter change.
  const syncUrl = useCallback(
    (filters, sort) => {
      if (!router.isReady) return;
      router.replace(
        { pathname: "/website/available-stock", query: filtersToQuery(filters, sort) },
        undefined,
        { shallow: true, scroll: false },
      );
    },
    [router],
  );

  const search = useStockSearch({
    initialFilters: filtersFromQuery(initialQuery),
    initialSort: sortFromQuery(initialQuery),
    pageSize: STOCK_PAGE_SIZE,
    onChange: syncUrl,
  });
  const { filters, total, shownCards, activeChips } = search;

  return (
    <StockShell
      title="Available stock — Humphries & Parks"
      description="Search every new and used car in stock at Humphries & Parks in West Malling, Kent. Filter by manufacturer, price, monthly payment, mileage, fuel and transmission."
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
            <div className="ws-segmented" role="tablist" aria-label="New or used">
              {CONDITION_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filters.condition === tab.id}
                  className={filters.condition === tab.id ? "ws-segmented-tab ws-segmented-tab--active" : "ws-segmented-tab"}
                  onClick={() => search.update({ condition: tab.id })}
                >
                  {tab.label}
                  <span className="ws-tab-count">{search.tabCounts[tab.id]}</span>
                </button>
              ))}
            </div>

            <div className="ws-stock-toolbar">
              <p className="ws-stock-count" aria-live="polite">
                <strong>{total}</strong> {total === 1 ? "car" : "cars"} in stock
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
                  <span className="ws-stock-label" aria-hidden="true">
                    Sort by
                  </span>
                  <WebsiteNativeSelect
                    value={search.sort}
                    onChange={search.setSort}
                    options={SORT_OPTIONS}
                    placeholder=""
                    aria-label="Sort vehicles"
                  />
                </div>
              </div>
            </div>

            {activeChips.length ? (
              <div className="ws-chips">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="ws-chip ws-chip--clear"
                    onClick={() => search.update(chip.patch)}
                  >
                    {chip.label}
                    <span aria-hidden="true">×</span>
                    <span className="ws-sr-only">Remove filter</span>
                  </button>
                ))}
                <button type="button" className="ws-chip ws-chip--clear" onClick={search.clearAll}>
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
                  <button type="button" className="ws-stock-clear" onClick={search.clearAll}>
                    Clear all
                  </button>
                ) : null}
              </div>

              <VehicleSearchFilters search={search} idPrefix="stock" showBodyStyle />

              <button
                type="button"
                className="ws-stock-filters-done"
                onClick={() => setFiltersOpen(false)}
              >
                Show {total} {total === 1 ? "car" : "cars"}
              </button>
            </aside>

            {/* ---------------- Results ---------------- */}
            <div>
              {total ? (
                <div className="ws-grid ws-grid--cards">
                  {shownCards.map((card, idx) => (
                    <VehicleCard key={card.id} vehicle={card} priority={idx < 8} />
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
                    <button type="button" onClick={search.clearAll}>
                      Clear filters
                    </button>
                    <Link href="/website#contact" className="ws-btn ws-btn--ghost">
                      Tell us what you want
                    </Link>
                  </div>
                </div>
              )}

              {total ? (
                <div className="ws-cars-end">
                  <p className="ws-section-more-note">
                    Showing {shownCards.length} of {total} {total === 1 ? "vehicle" : "vehicles"}
                  </p>
                  {search.hasMore ? (
                    <div className="ws-cars-end-actions">
                      <button type="button" onClick={search.loadMore}>
                        Load more vehicles
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {total ? (
                <div className="ws-card ws-cars-enquiry">
                  <div>
                    <h2 className="ws-h3">Can’t find the right car?</h2>
                    <p className="ws-muted">
                      Tell us the model, budget and must-haves, and our sales team will look through
                      new arrivals and part-exchanges for you.
                    </p>
                  </div>
                  <Link href="/website#contact" className="ws-btn ws-btn--ghost">
                    Make an enquiry
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </StockShell>
  );
}
