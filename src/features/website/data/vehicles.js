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

import { listStock, priceLabel, mileageLabel, stockHref } from "@/lib/stock/vehicleStock";

// How many cards the Cars block shows before the "Show more" button. Applies
// to each tab, so "All cars" never runs past eight either.
export const FEATURED_VEHICLE_LIMIT = 8;

// Card shape. The first six fields are the historic contract the Live Preview
// mapper and website_vehicles both speak; reg / stockNumber / href are the new
// stock link.
const toCard = (v) => ({
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
});

export const vehicles = listStock().map(toCard);

export default vehicles;
