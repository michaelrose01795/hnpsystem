// file location: src/features/website/data/vehicles.js
// Featured vehicles for the Cars block on /website.
//
// This used to be nine hand-written marketing rows that had nothing to do with
// what was on the forecourt. It is now a thin adapter over the DMS vehicle
// stock (src/lib/stock/vehicleStock.js): every card here is a real stock
// record, carries its registration and stock number, and links through to
// /website/stock/<reg>. A car that is not in stock cannot appear on the site.
//
// `vehicles` is registered as code-owned in
// src/features/website/data/codeOwnedContent.js, so the website_vehicles
// table is deliberately out of the loop — stock is edited in the DMS, not in
// the site builder.

import {
  listStock,
  priceLabel,
  mileageLabel,
  formatPrice,
  stockBadges,
  stockHref,
} from "@/lib/stock/vehicleStock";

// How many cards the Cars block shows before "Load more vehicles". Also the
// step each press of that button adds.
export const FEATURED_VEHICLE_LIMIT = 8;

// Card shape — the ONE builder every VehicleCard on the customer site reads
// (the Cars block, /website/available-stock and the detail page's similar
// vehicles). The first six fields are the historic contract the Live Preview
// mapper and website_vehicles both speak; reg / stockNumber / href are the
// stock link. `reg` and `stockNumber` stay in the shape for the staff-side
// consumers but are deliberately NOT drawn on the listing card.
export const toVehicleCard = (v) => ({
  id: v.stockNumber,
  type: v.condition, // "new" | "used" — the Cars block filter reads this
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
  // Listing-card hierarchy: name, derivative, cash price, monthly finance,
  // then mileage / transmission / fuel.
  name: [v.make, v.model].filter(Boolean).join(" "),
  derivative: v.derivative || null,
  monthly: v.monthly != null && Number.isFinite(Number(v.monthly)) ? formatPrice(v.monthly) : null,
  transmission: v.transmission || null,
  fuel: v.fuel || null,
  images: Array.isArray(v.images) ? v.images : [],
  badges: stockBadges(v),
});

export const vehicles = listStock().map(toVehicleCard);

export default vehicles;
