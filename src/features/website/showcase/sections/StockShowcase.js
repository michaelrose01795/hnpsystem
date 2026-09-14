// file location: src/features/website/showcase/sections/StockShowcase.js
//
// /website/dev — @family stock: /website/available-stock and /website/stock/[reg].
// Markup mirrors src/features/website/stock/AvailableStockPage.js and
// StockDetailPage.js; VehicleCard and WebsiteNativeSelect are the real components.

import { useState } from "react";
import VehicleCard from "@/features/website/components/VehicleCard";
import VehicleSearchFilters from "@/features/website/components/VehicleSearchFilters";
import VehicleCompareBar from "@/features/website/components/VehicleCompareBar";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import useStockSearch, { CONDITION_TABS } from "@/features/website/hooks/useStockSearch";
import { vehicles } from "@/features/website/data/vehicles";
import { Frame, Row, ShowcaseSection, Stage } from "../ShowcasePrimitives";

// Mirrors the Our Cars block in src/features/website/WebsitePage.js, driven by
// the real search hook so the counts, chips and toggles behave as on the page.
function OurCarsSearch() {
  const search = useStockSearch({ pageSize: 2 });
  return (
    <div className="ws-page">
      <div className="ws-cars-search">
        <div className="ws-cars-search-head">
          <div className="ws-tabs" role="tablist" aria-label="New or used">
            {CONDITION_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={search.filters.condition === tab.id}
                className={search.filters.condition === tab.id ? "ws-tab ws-tab--active" : "ws-tab"}
                onClick={() => search.update({ condition: tab.id })}
              >
                {tab.label}
                <span className="ws-tab-count">{search.tabCounts[tab.id]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ws-cars-filters" data-open="true">
          <VehicleSearchFilters search={search} idPrefix="dev-cars" />
        </div>
      </div>
      <div className="ws-stock-toolbar ws-cars-toolbar">
        <p className="ws-stock-count">
          <strong>{search.total}</strong> vehicles found
        </p>
      </div>
      <div className="ws-grid ws-grid--cards">
        {search.shownCards.map((card) => (
          <VehicleCard key={card.id} vehicle={card} />
        ))}
      </div>
      <div className="ws-cars-end">
        <p className="ws-section-more-note">
          Showing {search.shownCards.length} of {search.total} vehicles
        </p>
        <div className="ws-cars-end-actions">
          <button type="button" onClick={search.loadMore}>
            Load more vehicles
          </button>
          <a href="#stock" className="ws-btn ws-btn--primary">
            View all cars
          </a>
        </div>
      </div>
      <div className="ws-card ws-cars-enquiry">
        <div>
          <h3 className="ws-h3">Can’t find the right car?</h3>
          <p className="ws-muted">Tell us what you are after and we will find it.</p>
        </div>
        <a href="#stock" className="ws-btn ws-btn--ghost">
          Make an enquiry
        </a>
      </div>
    </div>
  );
}

const SORTS = [
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "newest", label: "Newest first" },
];

export default function StockShowcase({ section }) {
  const [sort, setSort] = useState("price-asc");
  const vehicle = vehicles[0] || {};
  const photo = vehicle.image || null;

  return (
    <ShowcaseSection id="stock" section={section}>
      <Row label="Our Cars search" hint="filters · toggles · count · VehicleCard · list end · enquiry" size="wide">
        <Frame padded>
          <OurCarsSearch />
        </Frame>
      </Row>

      <Row label="Compare tray" hint="VehicleCompareBar · pinned to the viewport on the site" size="wide">
        <Stage>
          <div className="ws-page">
            <VehicleCompareBar previewIds={vehicles.slice(0, 3).map((v) => v.id)} defaultOpen />
          </div>
        </Stage>
      </Row>

      <Row label="Search page" note="hero · tabs with counts · toolbar · sort · active chips">
        <Frame>
          <div className="ws-page">
            <section className="ws-section ws-stock-hero">
              <div className="ws-container">
                <span className="ws-eyebrow">Available stock</span>
                <h3 className="ws-h1">Find your next car</h3>
                <p className="ws-lead">Every car here is on the forecourt today.</p>
              </div>
            </section>
            <section className="ws-section ws-stock-body">
              <div className="ws-container">
                <div className="ws-stock-head">
                  <div className="ws-tabs" role="tablist" aria-label="New or used">
                    <button type="button" role="tab" aria-selected="true" className="ws-tab ws-tab--active">
                      All
                      <span className="ws-tab-count">24</span>
                    </button>
                    <button type="button" role="tab" aria-selected="false" className="ws-tab">
                      Used
                      <span className="ws-tab-count">18</span>
                    </button>
                  </div>
                  <div className="ws-stock-toolbar">
                    <p className="ws-stock-count">
                      <strong>24</strong> cars
                    </p>
                    <div className="ws-stock-toolbar-controls">
                      <button type="button" className="ws-stock-filters-toggle">
                        Filters
                        <span className="ws-tab-count">2</span>
                      </button>
                      <div className="ws-stock-sort">
                        <span className="ws-stock-label">Sort</span>
                        <WebsiteNativeSelect value={sort} onChange={setSort} options={SORTS} />
                      </div>
                    </div>
                  </div>
                  <div className="ws-chips">
                    <button type="button" className="ws-chip ws-chip--clear">
                      Suzuki
                      <span aria-hidden="true">×</span>
                      <span className="ws-sr-only">Remove filter</span>
                    </button>
                    <button type="button" className="ws-chip ws-chip--clear">
                      Clear all
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Filter rail and results" note=".ws-stock-layout · .ws-stock-filters · VehicleCard">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-stock-layout">
              <aside className="ws-stock-filters" data-open="true" aria-label="Filters">
                <div className="ws-stock-filters-head">
                  <h3 className="ws-stock-filters-title">Filters</h3>
                  <button type="button" className="ws-stock-clear">
                    Clear
                  </button>
                </div>
                <div className="ws-stock-field">
                  <label className="ws-stock-label" htmlFor="dev-stock-search">
                    Search
                  </label>
                  <input id="dev-stock-search" type="search" className="ws-stock-input" placeholder="Make, model or reg" />
                </div>
                <div className="ws-stock-field">
                  <span className="ws-stock-label">Model</span>
                  <WebsiteNativeSelect value="" onChange={() => {}} options={SORTS} placeholder="Any model" />
                </div>
                <button type="button" className="ws-stock-filters-done">
                  Show 24 cars
                </button>
              </aside>
              <div className="ws-grid ws-grid--cards">
                {vehicles.slice(0, 2).map((card) => (
                  <VehicleCard key={card.id} vehicle={card} />
                ))}
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Similar vehicles" note=".ws-stock-similar · VehicleCard · .ws-section-more">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-stock-similar">
              <h3 className="ws-h2">Similar vehicles</h3>
              <div className="ws-grid ws-grid--cards">
                {vehicles.slice(0, 4).map((card) => (
                  <VehicleCard key={card.id} vehicle={card} />
                ))}
              </div>
              <div className="ws-section-more">
                <button type="button">View more similar vehicles</button>
                <span className="ws-section-more-note">Showing 4 of 8</span>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Empty state and show more" note=".ws-stock-empty · .ws-section-more">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-card ws-stock-empty">
              <h3 className="ws-h3">Nothing matches those filters</h3>
              <p className="ws-muted">Try removing a filter or call the sales team.</p>
              <div className="ws-stock-empty-actions">
                <button type="button">Clear filters</button>
                <a href="#contact" className="ws-btn ws-btn--ghost">
                  Contact us
                </a>
              </div>
            </div>
            <div className="ws-section-more">
              <a href="#stock" className="ws-btn ws-btn--primary">
                Show all cars
              </a>
              <span className="ws-section-more-note">Showing 8 of 24</span>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Detail page" note="breadcrumb · gallery · thumbs · buying panel · facts">
        <Frame padded>
          <div className="ws-page">
            <nav className="ws-stock-breadcrumb" aria-label="Breadcrumb">
              <a href="#stock">Available stock</a>
              <span aria-hidden="true">/</span>
              <span>{vehicle.model || "Vehicle"}</span>
            </nav>
            <div className="ws-stock-detail-layout">
              <div className="ws-stock-gallery">
                <div className="ws-stock-gallery-main">
                  {photo ? <img src={photo} alt={vehicle.model || "Vehicle"} /> : null}
                  <span className="ws-badge">Just arrived</span>
                  <span className="ws-vehicle-condition">Used</span>
                </div>
                <div className="ws-stock-thumbs">
                  {[0, 1, 2].map((index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === 0 ? "ws-stock-thumb ws-stock-thumb--active" : "ws-stock-thumb"}
                      aria-label={`Photo ${index + 1}`}
                    >
                      {photo ? <img src={photo} alt="" /> : null}
                    </button>
                  ))}
                </div>
              </div>
              <aside className="ws-card ws-stock-buy">
                <span className="ws-vehicle-brand">{vehicle.brand || "Suzuki"}</span>
                <h3 className="ws-h3">{vehicle.model || "Swift"}</h3>
                <p className="ws-stock-price">{vehicle.price || "£14,995"}</p>
                <p className="ws-stock-monthly">
                  From <strong>£219</strong> a month
                </p>
                <dl className="ws-stock-facts">
                  {[
                    ["Mileage", vehicle.miles || "12,000"],
                    ["Year", vehicle.year || "2023"],
                    ["Fuel", "Hybrid"],
                  ].map(([label, value]) => (
                    <div key={label} className="ws-stock-fact">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="ws-stock-actions">
                  <a href="#contact" className="ws-btn ws-btn--primary">
                    Reserve this car
                  </a>
                  <a href="#contact" className="ws-btn ws-btn--ghost">
                    Book a test drive
                  </a>
                </div>
                <p className="ws-stock-stockno">
                  Stock no. <strong>{vehicle.stockNumber || "HP1234"}</strong>
                </p>
              </aside>
            </div>
            <div className="ws-stock-detail-body">
              <div className="ws-card ws-stock-panel" data-expanded="false">
                <div className="ws-stock-panel-body">
                  <h3 className="ws-h3">Equipment</h3>
                  <ul className="ws-ticks">
                    {Array.from({ length: 16 }, (_, index) => (
                      <li key={index}>Equipment item {index + 1}</li>
                    ))}
                  </ul>
                </div>
                <button type="button" className="ws-stock-panel-toggle" aria-expanded="false">
                  Show more
                </button>
              </div>
              <div className="ws-card ws-stock-panel">
                <h3 className="ws-h3">Specification</h3>
                <table className="ws-stock-spec">
                  <tbody>
                    <tr>
                      <th scope="row">Engine</th>
                      <td>1.2 Hybrid</td>
                    </tr>
                    <tr>
                      <th scope="row">Gearbox</th>
                      <td>Manual</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
