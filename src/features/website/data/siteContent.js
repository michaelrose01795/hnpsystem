// file location: src/features/website/data/siteContent.js
//
// The copy for every "one of a kind" section of the public /website — the
// parts that are a block of words and pictures rather than a list of cards.
// The card lists live in their own modules alongside this one (offers.js,
// vehicles.js, reviews.js, team.js, timeline.js, brands.js, blogPosts.js).
//
// Code-owned. Every slot below EXCEPT `brand` and `footer` is the ONE place
// its section comes from: the public page discards whatever the database
// returns for them, and the Website Manager shows a "Set in code" note
// pointing back here instead of an editor. The register is
// ./codeOwnedContent.js. So an edit to this file IS the change — nothing to
// publish, nothing that can disagree with it.
//
// `brand` (name + logos) and `footer` (legal links, FCA registration, credit
// disclosure) are the exception: they are site chrome, they keep their
// Website Manager editors, and the values here are the fallback used before
// the live content arrives and whenever the database is unreachable.
//
// Editing, in every slot:
//   - reword               edit the string in place
//   - add / remove an item append to, or delete from, any array
//   - remove a whole part  delete the key (or empty the array) — the page
//                          drops that piece rather than drawing an empty one,
//                          and a slot with nothing left in it takes its whole
//                          section off the page
//
// Images are plain strings that go straight into an <img src>: a dealer CDN
// URL (what the entries below use), or a file dropped into /public referenced
// from the site root, e.g. "/website/about/showroom.jpg".

export const siteContent = {
  // SITE CHROME, still editable in /website-manager → Website tab.
  // Used as the fallback until the live row loads.
  brand: {
    name: "Humphries & Parks",
    tagline: "Est. 1947",
    logoUrl:
      "https://images.67degreescdn.co.uk/a06qnEEaPN3JqRsIC9dAXhbh5PQ=/150x/filters:no_upscale()/144/1/humphries-and-parks-main-logo-8000px.png",
    logoWhiteUrl:
      "https://images.67degreescdn.co.uk/Pch_yGOme1JpijxgRa9u-kkc9Ko=/150x/filters:no_upscale()/144/1/171379060966265e9165aac_humphries-and-parks-main-logo-all-white.png",
  },

  // Hero banner. `ctas` is the button row — delete a button to remove it,
  // empty the array to drop the row. No backgroundUrl = text-only hero.
  hero: {
    eyebrow: "Family run since 1947",
    headline: "Providing quality customer service for over 75 years",
    subhead:
      "A trustworthy, stress-free approach to buying, selling and servicing your car — proudly family-run in the heart of Kent.",
    backgroundUrl:
      "https://images.67degreescdn.co.uk/OxvrVgI7NLjSg9hGumadDgUC4eM=/459x500/smart/144/6/1738080472679900d86a1f5_p1123308-edit.jpg",
    ctas: [
      { label: "View Cars", href: "#cars", variant: "primary" },
      { label: "Book a Service", href: "#service", variant: "ghost" },
      { label: "Sell Your Car", href: "#sell", variant: "ghost" },
      { label: "Contact Us", href: "#contact", variant: "ghost" },
    ],
  },

  // The strip of headline figures under the hero. Any number of them; empty
  // the array and the strip goes.
  trustPoints: [
    { value: "75+", label: "Years in business" },
    { value: "5.0★", label: "97 reviews" },
    { value: "120-pt", label: "Inspection on every car" },
    { value: "6+ mo.", label: "Warranty & MOT minimum" },
    { value: "EV", label: "Approved retailer" },
    { value: "Award", label: "AutoTrader Retailer Awards" },
  ],

  // The rating summary above the review quotes (data/reviews.js).
  ratings: [
    { source: "AutoTrader", score: "4.8 / 5" },
    { source: "JudgeService", score: "4.8 / 5" },
    { source: "Google", score: "4.6 / 5" },
  ],

  // "Leave a review" CTA rendered under the reviews grid. Opens Google in a
  // new tab. Once we have the Google Place ID for the West Malling listing,
  // swap `href` for the direct write-review deep link:
  //   https://search.google.com/local/writereview?placeid=<PLACE_ID>
  // Until then this lands on the business listing, where "Write a review" is
  // one click away — and it works without us guessing an ID.
  reviewCta: {
    label: "Leave a review",
    href: "https://www.google.com/search?q=Humphries+%26+Parks+West+Malling+reviews",
    note: "Bought or serviced with us? Tell us how we did on Google.",
  },

  // About Us. `body` is one <p> per entry.
  about: {
    eyebrow: "About Us",
    title: "A Kent dealership built on three generations of trust",
    body: [
      "Humphries & Parks was established in 1947 and has been family-run ever since. Treating customers and team members as part of the H&P family is integral to our ethos.",
      "We're a multi-award-winning dealership recognised by the AutoTrader Retailer Awards, certified Electric Vehicle Approved by the Office for Low Emission Vehicles, and proud authorised retailers for Suzuki and Mitsubishi.",
      "Whether you're buying new, choosing a quality used car, arranging a Motability vehicle, booking a service, or selling your current car — we're here to make it simple.",
    ],
    imageUrl:
      "https://images.67degreescdn.co.uk/8frG0OWBndXZg4XkXeCTxoZDnqQ=/479x479/smart/144/6/17041871276593d4f70761f_h-p-homepage-second-image.jpeg",
  },

  // Service & Parts. `hours` renders as the opening-times table; empty it and
  // the table goes. No imageUrl = full-width text column.
  serviceAndParts: {
    eyebrow: "Service & Parts",
    title: "Looked after by people who know your car",
    body: [
      "Authorised service agents for Suzuki and Mitsubishi. Genuine parts, manufacturer-trained technicians, and access to a state-of-the-art bodyshop facility.",
      "MOTs · Servicing · Warranty work · Tyres · Repairs · Diagnostics · Bodyshop",
    ],
    hours: [
      { days: "Mon – Fri", time: "8:00 – 18:00" },
      { days: "Saturday", time: "8:30 – 12:30" },
      { days: "Sunday", time: "Closed" },
    ],
    imageUrl:
      "https://images.67degreescdn.co.uk/kWdMmJColsQoohYLdV5U2GoGoA0=/479x479/smart/144/6/1719341105667b10312bd98_waiting.jpg",
  },

  // Motability. `rangeBrands` is one card per brand, `models` the chips in it.
  motability: {
    eyebrow: "Motability",
    title: "The Motability Scheme made simple",
    body: [
      "Five dedicated Motability specialists on staff to help you choose the right vehicle, arrange any adaptations, and look after the maintenance for the life of your lease.",
      "Available across the Suzuki and Mitsubishi ranges — including the new electric e-Vitara.",
    ],
    payments: "From £299 per month",
    rangeBrands: [
      { brand: "Suzuki", models: ["Swift", "Vitara", "S-Cross", "Across", "e-Vitara"] },
      { brand: "Mitsubishi", models: ["ASX", "Colt", "Eclipse Cross", "Outlander", "Grandis"] },
    ],
    cta: { label: "Speak to a specialist", href: "tel:01732870711" },
  },

  // Sell Your Car. `steps` is the numbered row, `benefits` the tick list;
  // the panel holding the tick list and the button only appears while one of
  // them is still here.
  sellYourCar: {
    eyebrow: "Sell Your Car",
    title: "Sell to us in three simple steps",
    steps: [
      { n: "01", title: "Enter your details", body: "Registration and mileage — that's all we need to start." },
      { n: "02", title: "Get your valuation", body: "We'll come back with a fair, no-obligation quote." },
      { n: "03", title: "Get paid", body: "Free collection. Bank transfer the same day. No admin fees." },
    ],
    benefits: [
      "Free collection from your home",
      "No admin fees or hidden charges",
      "Outstanding finance settled directly with the lender",
      "Instant payment by bank transfer",
      "Any age, any mileage, any make or model",
    ],
    cta: { label: "Get your free valuation", href: "/website/valuation" },
  },

  // Contact. Phone, address, hours, socials and the map are independent —
  // delete any one of them and only that block goes.
  contact: {
    eyebrow: "Contact Us",
    title: "Come and say hello",
    address: ["Humphries & Parks", "120 London Road", "West Malling", "Maidstone", "Kent", "ME19 5AN"],
    phone: "01732 870711",
    phoneHref: "tel:01732870711",
    salesHours: [
      { days: "Mon – Fri", time: "8:30 – 18:00" },
      { days: "Saturday", time: "8:30 – 17:00" },
      { days: "Sunday", time: "Closed" },
    ],
    serviceHours: [
      { days: "Mon – Fri", time: "8:00 – 18:00" },
      { days: "Saturday", time: "8:30 – 12:30" },
      { days: "Sunday", time: "Closed" },
    ],
    mapEmbed:
      "https://www.google.com/maps?q=Humphries+%26+Parks+West+Malling+ME19+5AN&output=embed",
    socials: [
      { label: "Facebook", href: "https://www.facebook.com/humphriesandparks" },
      { label: "Instagram", href: "https://www.instagram.com/humphriesandparks" },
      { label: "YouTube", href: "https://www.youtube.com/@humphriesandparks1947" },
    ],
  },

  footer: {
    fcaReg: "FCA Registration No. 310734",
    creditDisclosure:
      "Humphries & Parks Limited acts as a credit broker, not a lender. We have a panel of lenders including Suzuki Financial Services, CA Auto Finance, and Santander Consumer Finance. Lenders may pay us a fixed commission for introducing you. The amount of commission is available on request.",
    legal: ["Privacy Policy", "Cookie Policy", "Terms & Conditions", "Complaints"],
  },
};
