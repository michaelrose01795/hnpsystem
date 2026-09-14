// file location: src/features/website/hooks/useStockSearch.js
// Filter, sort and paging state for a customer vehicle search.
//
// Shared by the Our Cars block on /website and the full search on
// /website/available-stock, so both agree on what every filter means, how the
// counts are worked out and which query string carries a search between them
// ("View all cars" hands the home-page filters to the search page).
//
// The filtering itself stays in src/lib/stock/vehicleStock.js — this hook only
// holds state and derives what the page draws from it.

import { useCallback, useMemo, useState } from "react";

import {
  listStock,
  filterStock,
  sortStock,
  stockFacets,
  PRICE_BANDS,
  MONTHLY_BANDS,
  MILEAGE_BANDS,
  SORT_OPTIONS,
} from "@/lib/stock/vehicleStock";
import { toVehicleCard } from "../data/vehicles";

export const CONDITION_TABS = [
  { id: "all", label: "All cars" },
  { id: "new", label: "New" },
  { id: "used", label: "Used" },
];

export const EMPTY_FILTERS = Object.freeze({
  condition: "all",
  query: "",
  make: "",
  model: "",
  fuel: "",
  transmission: "",
  bodyStyle: "",
  priceBand: "",
  monthlyBand: "",
  mileageBand: "",
  photosOnly: false,
  electrified: false,
  automatic: false,
});

export const DEFAULT_SORT = "newest";

// filter key -> query-string key. `filter` (condition) and `sort` are handled
// separately; the three on/off filters are written as `=1`.
const TEXT_PARAMS = {
  query: "q",
  make: "make",
  model: "model",
  fuel: "fuel",
  transmission: "transmission",
  bodyStyle: "body",
  priceBand: "price",
  monthlyBand: "monthly",
  mileageBand: "mileage",
};
const FLAG_PARAMS = { photosOnly: "photos", electrified: "electrified", automatic: "auto" };

const first = (value) => (Array.isArray(value) ? value[0] : value) || "";

/** Query string (as Next hands it over) -> filter state. Inverse of filtersToQuery. */
export const filtersFromQuery = (q = {}) => {
  const condition = first(q.filter ?? q.condition);
  const out = {
    ...EMPTY_FILTERS,
    // Only the three tab ids; anything else means "all" rather than an empty
    // result set the visitor cannot explain.
    condition: CONDITION_TABS.some((t) => t.id === condition) ? condition : "all",
  };
  Object.entries(TEXT_PARAMS).forEach(([key, param]) => {
    out[key] = first(q[param]);
  });
  Object.entries(FLAG_PARAMS).forEach(([key, param]) => {
    out[key] = first(q[param]) === "1";
  });
  return out;
};

export const sortFromQuery = (q = {}) => {
  const value = first(q.sort);
  return SORT_OPTIONS.some((o) => o.value === value) ? value : DEFAULT_SORT;
};

/** Filter state -> the smallest query string that reproduces it. */
export const filtersToQuery = (filters = EMPTY_FILTERS, sort = DEFAULT_SORT) => {
  const query = {};
  if (filters.condition && filters.condition !== "all") query.filter = filters.condition;
  Object.entries(TEXT_PARAMS).forEach(([key, param]) => {
    if (filters[key]) query[param] = filters[key];
  });
  Object.entries(FLAG_PARAMS).forEach(([key, param]) => {
    if (filters[key]) query[param] = "1";
  });
  if (sort && sort !== DEFAULT_SORT) query.sort = sort;
  return query;
};

const bandLabel = (bands, value, fallback) => bands.find((b) => b.value === value)?.label || fallback;

/**
 * @param {object}   options
 * @param {object}   options.initialFilters  partial filter state to start from
 * @param {string}   options.initialSort
 * @param {number}   options.pageSize        cards per "Load more" step; 0 shows everything
 * @param {function} options.onChange        (filters, sort) after every change — URL sync
 */
export default function useStockSearch({
  initialFilters,
  initialSort = DEFAULT_SORT,
  pageSize = 0,
  onChange,
} = {}) {
  const allStock = useMemo(() => listStock(), []);

  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, ...initialFilters }));
  const [sort, setSortState] = useState(initialSort);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const facets = useMemo(() => stockFacets(allStock, { make: filters.make }), [allStock, filters.make]);

  const apply = useCallback(
    (nextFilters, nextSort) => {
      setFilters(nextFilters);
      setSortState(nextSort);
      // A new search starts again from the first page.
      setVisibleCount(pageSize);
      onChange?.(nextFilters, nextSort);
    },
    [onChange, pageSize],
  );

  const update = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      // Changing manufacturer drops a model that manufacturer does not make.
      if ("make" in patch && next.model && next.make) {
        const stillMade = allStock.some((v) => v.make === next.make && v.model === next.model);
        if (!stillMade) next.model = "";
      }
      apply(next, sort);
    },
    [allStock, apply, filters, sort],
  );

  const setSort = useCallback((value) => apply(filters, value), [apply, filters]);

  const clearAll = useCallback(() => apply({ ...EMPTY_FILTERS }, DEFAULT_SORT), [apply]);

  const results = useMemo(() => sortStock(filterStock(allStock, filters), sort), [allStock, filters, sort]);
  const cards = useMemo(() => results.map(toVehicleCard), [results]);
  const shownCards = useMemo(
    () => (pageSize ? cards.slice(0, visibleCount) : cards),
    [cards, pageSize, visibleCount],
  );

  const loadMore = useCallback(() => setVisibleCount((n) => n + pageSize), [pageSize]);

  // Tab counts ignore the condition filter but respect everything else, so a
  // tab shows the number the visitor is about to get.
  const tabCounts = useMemo(() => {
    const withoutCondition = filterStock(allStock, { ...filters, condition: "all" });
    return {
      all: withoutCondition.length,
      new: withoutCondition.filter((v) => v.condition === "new").length,
      used: withoutCondition.filter((v) => v.condition === "used").length,
    };
  }, [allStock, filters]);

  // The honest summary of a many-control filter panel, and the only one on a
  // phone where the panel is collapsed.
  const activeChips = useMemo(() => {
    const chips = [];
    const add = (key, label, patch) => chips.push({ key, label, patch });
    if (filters.query) add("query", `“${filters.query}”`, { query: "" });
    if (filters.make) add("make", filters.make, { make: "", model: "" });
    if (filters.model) add("model", filters.model, { model: "" });
    if (filters.priceBand) add("priceBand", bandLabel(PRICE_BANDS, filters.priceBand, "Price"), { priceBand: "" });
    if (filters.monthlyBand)
      add("monthlyBand", bandLabel(MONTHLY_BANDS, filters.monthlyBand, "Monthly"), { monthlyBand: "" });
    if (filters.mileageBand)
      add("mileageBand", bandLabel(MILEAGE_BANDS, filters.mileageBand, "Mileage"), { mileageBand: "" });
    if (filters.fuel) add("fuel", filters.fuel, { fuel: "" });
    if (filters.transmission) add("transmission", filters.transmission, { transmission: "" });
    if (filters.bodyStyle) add("bodyStyle", filters.bodyStyle, { bodyStyle: "" });
    if (filters.photosOnly) add("photosOnly", "With photos", { photosOnly: false });
    if (filters.electrified) add("electrified", "Electric / hybrid", { electrified: false });
    if (filters.automatic) add("automatic", "Automatic", { automatic: false });
    return chips;
  }, [filters]);

  return {
    filters,
    sort,
    facets,
    update,
    setSort,
    clearAll,
    results,
    cards,
    shownCards,
    total: cards.length,
    hasMore: shownCards.length < cards.length,
    loadMore,
    tabCounts,
    activeChips,
    query: filtersToQuery(filters, sort),
  };
}
