// file location: src/features/website/components/VehicleSearchFilters.js
// The vehicle search fields: keyword, manufacturer, model, price, monthly
// payment, fuel, transmission, mileage (and body style on the full search),
// plus the three one-press filters — photos only, electric / hybrid and
// automatic.
//
// Renders the fields only. The caller supplies the surface around them: the
// Our Cars block lays them out as a grid bar (.ws-cars-filters), the search
// page as its sticky rail (.ws-stock-filters). State comes from
// useStockSearch, so both places filter identically.
//
// Every select is WebsiteNativeSelect and every field reuses the existing
// .ws-stock-field / .ws-stock-label rhythm from custglobal.css @family stock.

import WebsiteNativeSelect from "./WebsiteNativeSelect";
import { PRICE_BANDS, MONTHLY_BANDS, MILEAGE_BANDS } from "@/lib/stock/vehicleStock";

const asOptions = (values, placeholder) => [
  { value: "", label: placeholder },
  ...values.map((v) => ({ value: v, label: v })),
];

const bandOptions = (bands, placeholder) => [
  { value: "", label: placeholder },
  ...bands.map((b) => ({ value: b.value, label: b.label })),
];

const TOGGLES = [
  { key: "photosOnly", label: "With photos" },
  { key: "electrified", label: "Electric / hybrid" },
  { key: "automatic", label: "Automatic" },
];

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="ws-stock-field">
      <span className="ws-stock-label" aria-hidden="true">
        {label}
      </span>
      <WebsiteNativeSelect value={value} onChange={onChange} options={options} placeholder="" aria-label={label} />
    </div>
  );
}

export default function VehicleSearchFilters({ search, idPrefix = "vehicle-search", showBodyStyle = false }) {
  const { filters, facets, update } = search;

  return (
    <>
      <div className="ws-stock-field">
        <label className="ws-stock-label" htmlFor={`${idPrefix}-keyword`}>
          Search
        </label>
        <input
          id={`${idPrefix}-keyword`}
          type="search"
          className="ws-stock-input"
          placeholder="Model, colour, keyword…"
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
        />
      </div>

      <SelectField
        label="Manufacturer"
        value={filters.make}
        options={asOptions(facets.makes, "Any manufacturer")}
        onChange={(value) => update({ make: value })}
      />
      <SelectField
        label="Model"
        value={filters.model}
        options={asOptions(facets.models, "Any model")}
        onChange={(value) => update({ model: value })}
      />
      <SelectField
        label="Price"
        value={filters.priceBand}
        options={bandOptions(PRICE_BANDS, "Any price")}
        onChange={(value) => update({ priceBand: value })}
      />
      <SelectField
        label="Monthly payment"
        value={filters.monthlyBand}
        options={bandOptions(MONTHLY_BANDS, "Any monthly")}
        onChange={(value) => update({ monthlyBand: value })}
      />
      <SelectField
        label="Fuel type"
        value={filters.fuel}
        options={asOptions(facets.fuels, "Any fuel")}
        onChange={(value) => update({ fuel: value })}
      />
      <SelectField
        label="Transmission"
        value={filters.transmission}
        options={asOptions(facets.transmissions, "Any transmission")}
        onChange={(value) => update({ transmission: value })}
      />
      <SelectField
        label="Mileage"
        value={filters.mileageBand}
        options={bandOptions(MILEAGE_BANDS, "Any mileage")}
        onChange={(value) => update({ mileageBand: value })}
      />
      {showBodyStyle ? (
        <SelectField
          label="Body style"
          value={filters.bodyStyle}
          options={asOptions(facets.bodyStyles, "Any body style")}
          onChange={(value) => update({ bodyStyle: value })}
        />
      ) : null}

      {/* On/off filters are pressed buttons, not checkboxes: each one is a
          single "show me only…" action and reads as a chip in the design. */}
      <div className="ws-filter-toggles" role="group" aria-label="Quick filters">
        {TOGGLES.map((toggle) => (
          <button
            key={toggle.key}
            type="button"
            className="ws-filter-toggle"
            aria-pressed={filters[toggle.key] ? "true" : "false"}
            onClick={() => update({ [toggle.key]: !filters[toggle.key] })}
          >
            {toggle.label}
          </button>
        ))}
      </div>
    </>
  );
}
