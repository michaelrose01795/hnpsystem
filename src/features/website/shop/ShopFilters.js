// file location: src/features/website/shop/ShopFilters.js
//
// The parts catalogue filter bar: search, category, manufacturer,
// availability, price and sort.
//
// Fully controlled. The page owns the values (the catalogue keeps them in the
// URL) and receives each change as a patch through onChange; the search box
// reports its draft through onSearchDraft so the page can debounce it. The
// option lists come from src/lib/parts/shopFilters.js and vehicleFitment.js,
// the same modules the API reads, so a choice offered here is always one the
// server understands.
//
// Styling: .ws-catalog-controls / .ws-catalog-search (@family parts) and the
// shared .ws-stock-field / .ws-stock-label field rhythm.

import WebsiteNativeSelect from "../components/WebsiteNativeSelect";
import { PARTS_MAKES } from "@/lib/parts/vehicleFitment";
import { AVAILABILITY_OPTIONS, PRICE_BANDS, SORT_OPTIONS } from "@/lib/parts/shopFilters";

const MAKE_OPTIONS = [
  { value: "", label: "All manufacturers" },
  ...PARTS_MAKES.map((m) => ({ value: m.make, label: m.make })),
];
const PRICE_OPTIONS = PRICE_BANDS.map((b) => ({ value: b.value, label: b.label }));

export default function ShopFilters({
  filters = {},
  searchDraft = "",
  onSearchDraft,
  onChange,
  categories = [],
  idPrefix = "ws-catalog",
}) {
  // The catalogue has dozens of free-text categories, so this is a dropdown
  // rather than a row of chips; counts ride along as the option hint.
  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name, hint: String(c.count) })),
  ];

  const field = (key, label, options, extra = {}) => (
    <div className="ws-stock-field">
      <label className="ws-stock-label" htmlFor={`${idPrefix}-${key}`}>
        {label}
      </label>
      <WebsiteNativeSelect
        id={`${idPrefix}-${key}`}
        value={filters[key] || ""}
        onChange={(value) => onChange?.({ [key]: value, ...(extra.alsoClear || {}) })}
        options={options}
        placeholder=""
        disabled={extra.disabled}
      />
    </div>
  );

  return (
    <div className="ws-catalog-controls" data-presentation="website-catalog-controls">
      <div className="ws-stock-field ws-catalog-search">
        <label className="ws-stock-label" htmlFor={`${idPrefix}-search`}>
          Search parts
        </label>
        <input
          id={`${idPrefix}-search`}
          type="search"
          value={searchDraft}
          onChange={(e) => onSearchDraft?.(e.target.value)}
          placeholder="Part name, part number or OE reference"
          autoComplete="off"
        />
      </div>
      {field("category", "Category", categoryOptions, { disabled: categories.length === 0 })}
      {/* A model belongs to one make, so changing the make drops the model. */}
      {field("make", "Manufacturer", MAKE_OPTIONS, { alsoClear: { model: "" } })}
      {field("stock", "Availability", AVAILABILITY_OPTIONS)}
      {field("price", "Price", PRICE_OPTIONS)}
      {field("sort", "Sort by", SORT_OPTIONS)}
    </div>
  );
}
