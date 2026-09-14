// file location: src/features/website/data/offers.js
//
// Offer cards for the /website Offers section.
//
// This section is 100% code-owned: the array below is the ONE place the cards
// come from. The public page does not read offers out of the database - see
// the register in src/features/website/data/codeOwnedContent.js -
// so what is written here is exactly what renders, every time, with no DB
// round-trip and nothing to publish.
//
// These entries are MOCK data standing in until the real campaign list is
// agreed. Changing them is a code edit and nothing else:
//
//   - add a card     append an object to the array
//   - remove a card  delete its object
//   - reorder        move the objects - they render top-left to bottom-right
//   - retitle        edit `title` / `headline` / `body`
//
// Page content carries the offer, not the picture. Manufacturer campaign
// banners bake the headline, APR and small print into the artwork, which gets
// cropped, cannot be read by a screen reader and goes stale separately from the
// copy. So `image` is a CLEAN photo of the car or the workshop, and every word
// the customer needs is in the fields below.
//
// Each photo is chosen by hand for the card it sits on: a front three-quarter
// view of the model being offered, uncluttered, with no other brand's signage
// in shot, and no two cards sharing a photo. They are Wikimedia Commons files
// (CC BY / CC BY-SA - the file name is the attribution key on
// commons.wikimedia.org), the same host and 960px thumbnail form as the stock
// photos in src/lib/stock/vehicleStock.js. The first stock photo of a model is
// not always a good card (some open on a rear or partly hidden shot), which is
// why these are picked here rather than taken from the stock list.
//
// The card art is cropped to 16/10 with object-fit: cover (.ws-offer-media in
// src/styles/custglobal.css), so any aspect ratio is safe - but keep the
// subject near the centre of the frame.
//
// Fields:
//   id            stable unique key for React - kebab-case, never reused
//   manufacturer  "Suzuki", "Mitsubishi", or "Humphries & Parks" for our own
//   categories    any of: new, used, finance, servicing, motability - these
//                 drive the filter tabs (OFFER_FILTERS below); the first one is
//                 the badge on the photo
//   title         the offer's name (also the image alt text)
//   headline      the headline saving or finance figure
//   body          one short sentence of supporting copy
//   expires       ISO date the offer ends (inclusive), or null for ongoing.
//                 An expired offer drops off the page by itself.
//   href          where "View offer" goes - an existing /website route
//   image         clean photo URL (dealer CDN, /public path or stock photo)
//
// title / headline / body / image keep their original meaning: the help chat
// (helpChat/helpKnowledge.js) and the Website Manager adapter read them.

// The filter tabs, in order. `id` matches the values allowed in `categories`.
export const OFFER_FILTERS = [
  { id: "all", label: "All offers" },
  { id: "new", label: "New cars" },
  { id: "used", label: "Used cars" },
  { id: "finance", label: "Finance" },
  { id: "servicing", label: "Servicing" },
  { id: "motability", label: "Motability" },
];

// "e/e8/File_name.jpg" -> the 960px Commons thumbnail of that file.
const commons = (path) => {
  const file = path.split("/").pop();
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/960px-${file}`;
};

const PHOTOS = {
  swift: commons("3/30/Suzuki_Swift_%282024%29_hybrid_DSC_7922.jpg"),
  vitara: commons("8/8f/2023_Suzuki_Vitara_hybrid_in_White%2C_front_right%2C_06-06-2025.jpg"),
  sCross: commons("6/64/Suzuki_S-Cross_1.5_Dualjet_Hybrid_Comfort_%28II%29_%E2%80%93_f_17042025.jpg"),
  eVitara: commons("1/1d/2025_Suzuki_e_Vitara_front_view.jpg"),
  jimny: commons("5/53/2019_Suzuki_Jimny_SZ5_4X4_Automatic_1.5_%281%29.jpg"),
  across: commons("3/33/Suzuki_Across_%28XA50%29_1X7A6320.jpg"),
  ignis: commons("2/2b/Suzuki_Ignis_%28third_generation%29_Facelift_IMG_3656.jpg"),
  outlander: commons("6/68/2025_Mitsubishi_Outlander_PHEV_%28fourth_generation%29_IMG_3128.jpg"),
  oilCheck: commons("c/c9/Person_checking_engine_oil_level_in_a_car_hood_at_home_in_daylight.jpg"),
  engineService: commons(
    "d/d7/Mechanic_works_on_car_engine_performing_routine_maintenance_and_inspections_on_vehicle_parts.jpg",
  ),
};

export const offers = [
  {
    id: "mock-swift-apr",
    manufacturer: "Suzuki",
    categories: ["new", "finance"],
    title: "New Suzuki Swift",
    headline: "0% APR Representative",
    body: "Hybrid efficiency, premium kit and 0% finance across selected Swift models.",
    expires: "2026-12-31",
    href: "/website/available-stock?filter=new&model=Swift",
    image: PHOTOS.swift,
  },
  {
    id: "mock-vitara-pcp",
    manufacturer: "Suzuki",
    categories: ["new", "finance"],
    title: "Suzuki Vitara",
    headline: "0% PCP available",
    body: "The all-rounder SUV - practical, hybrid, and now on 0% PCP.",
    expires: "2026-12-31",
    href: "/website/available-stock?filter=new&model=Vitara",
    image: PHOTOS.vitara,
  },
  {
    id: "mock-scross-saving",
    manufacturer: "Suzuki",
    categories: ["new"],
    title: "Suzuki S-Cross",
    headline: "£3,050 customer saving",
    body: "Full hybrid with ALLGRIP available, and £3,050 off selected stock.",
    expires: "2026-12-31",
    href: "/website/available-stock?filter=new&model=S-Cross",
    image: PHOTOS.sCross,
  },
  {
    id: "mock-evitara-pch",
    manufacturer: "Suzuki",
    categories: ["new", "finance"],
    title: "Suzuki e-Vitara",
    headline: "Personal Contract Hire from £299",
    body: "Suzuki's first all-electric SUV, on flexible PCH terms with servicing included.",
    expires: "2026-12-31",
    href: "/website/available-stock?filter=new&model=e-Vitara",
    image: PHOTOS.eVitara,
  },
  {
    id: "mock-used-warranty",
    manufacturer: "Humphries & Parks",
    categories: ["used"],
    title: "Approved used cars",
    headline: "6 months' warranty included",
    body: "Every used car gets a 120-point inspection, at least 6 months' MOT and 6 months' warranty.",
    expires: null,
    href: "/website/available-stock?filter=used",
    image: PHOTOS.jimny,
  },
  {
    id: "mock-motability-across",
    manufacturer: "Suzuki",
    categories: ["motability"],
    title: "Motability Scheme",
    headline: "From £299 per month",
    body: "Swift, Vitara, S-Cross, Across and e-Vitara on the Motability Scheme, with insurance and servicing included.",
    expires: "2026-12-31",
    href: "/website#motability",
    image: PHOTOS.across,
  },
  {
    id: "mock-warranty-ten-year",
    manufacturer: "Suzuki",
    categories: ["servicing"],
    title: "10-Year Warranty",
    headline: "Up to 10 years' cover",
    body: "Service with us each year and Suzuki extends your cover up to 10 years.",
    expires: null,
    href: "/website/request-appointment",
    image: PHOTOS.ignis,
  },
  {
    id: "mock-mitsubishi-retailer",
    manufacturer: "Mitsubishi",
    categories: ["new"],
    title: "Mitsubishi is back in Kent",
    headline: "Authorised Mitsubishi retailer",
    body: "We're a proud authorised retailer for the returning Mitsubishi range.",
    expires: null,
    href: "/website#contact",
    image: PHOTOS.outlander,
  },
  {
    id: "mock-winter-health-check",
    manufacturer: "Humphries & Parks",
    categories: ["servicing"],
    title: "Winter health check",
    headline: "Free 28-point check",
    body: "Tyres, brakes, battery and fluids checked before the cold sets in.",
    expires: "2027-02-28",
    href: "/website/request-appointment",
    image: PHOTOS.oilCheck,
  },
  {
    id: "mock-mot-service-bundle",
    manufacturer: "Humphries & Parks",
    categories: ["servicing"],
    title: "MOT and service together",
    headline: "Save £40",
    body: "Book both together and we'll take £40 off, with a courtesy car on request.",
    expires: "2026-11-30",
    href: "/website/request-appointment",
    image: PHOTOS.engineService,
  },
];
