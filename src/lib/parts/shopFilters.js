// file location: src/lib/parts/shopFilters.js
//
// The public parts shop's filter vocabulary: availability and price bands.
//
// Shared by the catalogue API (src/pages/api/shop/parts-catalog/index.js ->
// src/lib/database/partsCatalogPublic.js), which turns a value into a Postgres
// filter, and by the customer filter bar (src/features/website/shop/
// ShopFilters.js), which renders the same list. A band added here is offered
// and honoured in one edit.
//
// Values are what travel in the URL (?stock=in&price=25-50), so keep them
// stable once shipped — shared links depend on them.

export const AVAILABILITY_OPTIONS = [
  { value: "", label: "Any availability" },
  { value: "in", label: "In stock only" },
  { value: "order", label: "Available to order" },
];

// Pounds, inclusive lower bound, exclusive upper bound.
export const PRICE_BANDS = [
  { value: "", label: "Any price", min: null, max: null },
  { value: "0-25", label: "Under £25", min: null, max: 25 },
  { value: "25-50", label: "£25 to £50", min: 25, max: 50 },
  { value: "50-100", label: "£50 to £100", min: 50, max: 100 },
  { value: "100-250", label: "£100 to £250", min: 100, max: 250 },
  { value: "250-", label: "£250 and over", min: 250, max: null },
];

export const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "price_asc", label: "Price (low to high)" },
  { value: "price_desc", label: "Price (high to low)" },
  { value: "newest", label: "Recently added" },
];

/** The band for a URL value, or null for "any" / unknown values. */
export const priceBandFor = (value) => {
  const band = PRICE_BANDS.find((b) => b.value && b.value === String(value || ""));
  return band || null;
};

/** "in" | "order" | "" — anything else reads as no filter. */
export const availabilityFor = (value) =>
  AVAILABILITY_OPTIONS.some((o) => o.value && o.value === value) ? value : "";
