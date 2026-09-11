// file location: src/features/website/data/shopProducts.js
//
// Mock parts & accessories shown in the #shop teaser on /website.
//
// Deliberately hard-coded: the marketing page shows a curated, always-
// populated preview that never depends on what happens to be in stock.
// The real, DB-backed catalogue lives at /website/parts-catalog and reads
// public.parts_catalog (the staff DMS Stock Catalogue) — see
// src/lib/database/partsCatalogPublic.js.
//
// Prices are in pence to match the cart / order money format used by
// useShopCart and shop_orders.

export const SHOP_TEASER_LIMIT = 8;

export const shopCategories = [
  { id: "servicing", name: "Servicing" },
  { id: "brakes", name: "Brakes" },
  { id: "accessories", name: "Accessories" },
  { id: "styling", name: "Styling" },
  { id: "care", name: "Car Care" },
];

// Exactly SHOP_TEASER_LIMIT items — the teaser renders all of them.
export const shopProducts = [
  {
    id: "mock-service-kit-swift",
    sku: "SZ-SVC-SWIFT",
    name: "Swift Hybrid Service Kit",
    brand: "Suzuki",
    category_id: "servicing",
    description: "Genuine oil filter, air filter, sump plug and washer for the 1.2 Hybrid.",
    price_pence: 6495,
    compare_at_price_pence: 7450,
    stock_qty: 18,
    image_url: null,
  },
  {
    id: "mock-brake-pads-vitara",
    sku: "SZ-BRK-VIT-F",
    name: "Vitara Front Brake Pads",
    brand: "Suzuki",
    category_id: "brakes",
    description: "Genuine front pad set. Fitting available while you wait.",
    price_pence: 8900,
    compare_at_price_pence: null,
    stock_qty: 11,
    image_url: null,
  },
  {
    id: "mock-wiper-set",
    sku: "HNP-WIP-SET",
    name: "Aero Wiper Blade Pair",
    brand: "Suzuki",
    category_id: "servicing",
    description: "Front pair, vehicle-specific fit. Fitted free at the parts counter.",
    price_pence: 3250,
    compare_at_price_pence: null,
    stock_qty: 42,
    image_url: null,
  },
  {
    id: "mock-towbar-electrics",
    sku: "MIT-TOW-13P",
    name: "13-Pin Towing Electrics Kit",
    brand: "Mitsubishi",
    category_id: "accessories",
    description: "Dedicated wiring loom with trailer stability control support.",
    price_pence: 21500,
    compare_at_price_pence: null,
    stock_qty: 3,
    image_url: null,
  },
  {
    id: "mock-roof-bars",
    sku: "SZ-ACC-ROOF",
    name: "S-Cross Roof Bar Set",
    brand: "Suzuki",
    category_id: "accessories",
    description: "Lockable aluminium bars, 75kg dynamic load rating.",
    price_pence: 18999,
    compare_at_price_pence: 21000,
    stock_qty: 4,
    image_url: null,
  },
  {
    id: "mock-mud-flaps",
    sku: "SZ-STY-MUD",
    name: "Jimny Mud Flap Set",
    brand: "Suzuki",
    category_id: "styling",
    description: "Front and rear set, colour-matched fixings included.",
    price_pence: 5450,
    compare_at_price_pence: null,
    stock_qty: 0,
    image_url: null,
  },
  {
    id: "mock-care-kit",
    sku: "HNP-CARE-01",
    name: "Humphries & Parks Car Care Kit",
    brand: "Humphries & Parks",
    category_id: "care",
    description: "Shampoo, ceramic detailer, glass cleaner, microfibre cloths.",
    price_pence: 3995,
    compare_at_price_pence: 4500,
    stock_qty: 27,
    image_url: null,
  },
];
