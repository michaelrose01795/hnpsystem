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

// Motability vehicle cards. `rangeBrands` below is DERIVED from this list, so
// the help chat and the Website Manager keep reading the { brand, models }
// shape they always have while this stays the one place a model is added.
//
// Fields: id, brand, model, powertrain, automatic ("Automatic only" /
// "Automatic available" / "Manual only"), advancePayment, image (optional —
// a card without one shows the brand name in the photo slot).
//
// MOCK: powertrains and advance payments are placeholders until the current
// Motability Operations price list is confirmed. Check every figure before
// go-live — advance payments change each quarter.
const motabilityModels = [
  {
    id: "suzuki-swift", brand: "Suzuki", model: "Swift", powertrain: "1.2 Mild Hybrid",
    automatic: "Automatic available", advancePayment: "£0",
    image: "https://images.67degreescdn.co.uk/TFK7QKvuB5vSgQ8a4JwwCH48hzA=/459x/144/6/0e11e749a4f9f7b8c0d0_q2-2026-uk-swift_web_banner_1920x873px_v2.jpg",
  },
  {
    id: "suzuki-vitara", brand: "Suzuki", model: "Vitara", powertrain: "Mild or Full Hybrid",
    automatic: "Automatic available", advancePayment: "£395",
    image: "https://images.67degreescdn.co.uk/gyEfuN1I3-fOixzTQvMqg37i_HU=/459x/144/6/a0d5bf05ac46154454fe_q2-2026-uk-vitara_facelift-web_1920x873px.jpg",
  },
  {
    id: "suzuki-s-cross", brand: "Suzuki", model: "S-Cross", powertrain: "Mild or Full Hybrid",
    automatic: "Automatic available", advancePayment: "£495",
    image: "https://images.67degreescdn.co.uk/hBhV9Gbp44dEsw52VTga7T9Pjrw=/459x/144/6/9c10a56552d3b2795a73_q2-2026-uk-s-cross_web-1920x873px_v2.jpg",
  },
  {
    id: "suzuki-across", brand: "Suzuki", model: "Across", powertrain: "Plug-in Hybrid",
    automatic: "Automatic only", advancePayment: "£1,995",
  },
  {
    id: "suzuki-e-vitara", brand: "Suzuki", model: "e-Vitara", powertrain: "Electric",
    automatic: "Automatic only", advancePayment: "£0",
    image: "https://images.67degreescdn.co.uk/afZfv58mznDRosA8FiLaIkM49fY=/459x/144/6/c8c7152a46ab73307016_q2-2026-uk-e-vitara_web-banner_1920x873px.jpg",
  },
  {
    id: "mitsubishi-asx", brand: "Mitsubishi", model: "ASX", powertrain: "Mild or Full Hybrid",
    automatic: "Automatic available", advancePayment: "£295",
    image: "https://images.67degreescdn.co.uk/zrxy_fgbORQAS7JSPJho1KSZ08E=/459x/144/6/c44b894d19350f8e8f29_mitsubishi-banner.jpg",
  },
  {
    id: "mitsubishi-colt", brand: "Mitsubishi", model: "Colt", powertrain: "Petrol or Full Hybrid",
    automatic: "Automatic available", advancePayment: "£0",
    image: "https://images.67degreescdn.co.uk/zrxy_fgbORQAS7JSPJho1KSZ08E=/459x/144/6/c44b894d19350f8e8f29_mitsubishi-banner.jpg",
  },
  {
    id: "mitsubishi-eclipse-cross", brand: "Mitsubishi", model: "Eclipse Cross", powertrain: "Electric",
    automatic: "Automatic only", advancePayment: "£995",
    image: "https://images.67degreescdn.co.uk/zrxy_fgbORQAS7JSPJho1KSZ08E=/459x/144/6/c44b894d19350f8e8f29_mitsubishi-banner.jpg",
  },
  {
    id: "mitsubishi-outlander", brand: "Mitsubishi", model: "Outlander", powertrain: "Plug-in Hybrid",
    automatic: "Automatic only", advancePayment: "£2,495",
    image: "https://images.67degreescdn.co.uk/zrxy_fgbORQAS7JSPJho1KSZ08E=/459x/144/6/c44b894d19350f8e8f29_mitsubishi-banner.jpg",
  },
  {
    id: "mitsubishi-grandis", brand: "Mitsubishi", model: "Grandis", powertrain: "Mild or Full Hybrid",
    automatic: "Automatic available", advancePayment: "£495",
    image: "https://images.67degreescdn.co.uk/zrxy_fgbORQAS7JSPJho1KSZ08E=/459x/144/6/c44b894d19350f8e8f29_mitsubishi-banner.jpg",
  },
];

// { brand, models: [name] } in first-seen brand order.
const brandsFrom = (models) =>
  models.reduce((out, m) => {
    const group = out.find((g) => g.brand === m.brand);
    if (group) group.models.push(m.model);
    else out.push({ brand: m.brand, models: [m.model] });
    return out;
  }, []);

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
  // `rating` and `location` are the compact trust card laid over the image
  // (under the copy when there is no image). Delete either and it goes; delete
  // both and the card goes.
  hero: {
    eyebrow: "Suzuki & Mitsubishi · West Malling, Kent",
    headline: "Family-run in Kent since 1947",
    subhead:
      "New and used cars, servicing, MOTs and fair valuations — from people who treat you like family.",
    backgroundUrl:
      "https://images.67degreescdn.co.uk/OxvrVgI7NLjSg9hGumadDgUC4eM=/459x500/smart/144/6/1738080472679900d86a1f5_p1123308-edit.jpg",
    ctas: [],
    rating: { score: "5.0", note: "97 verified reviews", href: "#reviews" },
    location: { title: "West Malling, Kent", note: "120 London Road · Open Mon–Sat", href: "#contact" },
  },

  // The trust indicators under the hero. `icon` is a glyph name from
  // components/WebsiteIcon.js; leave it off for a text-only tile. Any number
  // of them; empty the array and the band goes.
  trustPoints: [
    { icon: "family", value: "Since 1947", label: "Family-run in Kent" },
    { icon: "star", value: "5.0 rated", label: "97 verified reviews" },
    { icon: "inspect", value: "120-point", label: "Inspection on every car" },
    { icon: "shield", value: "6 months", label: "Minimum warranty & MOT" },
    { icon: "bolt", value: "EV approved", label: "Electric Vehicle Approved retailer" },
    { icon: "award", value: "Award-winning", label: "AutoTrader Retailer Awards" },
  ],

  // The rating summary above the review quotes (data/reviews.js): one card per
  // platform, and the overall score is the average of every `score` given.
  // `score` is optional — a platform without one shows how many of its reviews
  // are featured instead, and is left out of the average.
  ratings: [
    { source: "AutoTrader", score: "4.8 / 5" },
    { source: "JudgeService", score: "4.8 / 5" },
    { source: "Google", score: "4.6 / 5" },
    // No published Trustpilot score recorded yet — add `score: "x.x / 5"`.
    { source: "Trustpilot" },
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

  // About Us. `body` is one <p> per entry; `highlights` are the compact trust
  // cards under it ({ id, icon, title, body } — components/BenefitCards.js,
  // icon names from components/WebsiteIcon.js).
  about: {
    eyebrow: "About Us",
    title: "Three generations of trust, right here in Kent",
    body: [
      "Family-run since 1947, we treat every customer and every colleague as part of the H&P family — whether you're buying new or used, choosing a Motability car, booking a service or selling your current car.",
    ],
    highlights: [
      { id: "since-1947", icon: "family", title: "Family-run since 1947", body: "Over 75 years of family ownership in Kent." },
      { id: "award", icon: "award", title: "Award-winning", body: "AutoTrader Retailer Awards 2022 — Customer Experience." },
      { id: "authorised", icon: "badge", title: "Authorised retailer", body: "Official Suzuki and Mitsubishi sales and service." },
      { id: "ev-approved", icon: "bolt", title: "EV Approved", body: "Accredited by the Office for Low Emission Vehicles." },
    ],
    imageUrl:
      "https://images.67degreescdn.co.uk/8frG0OWBndXZg4XkXeCTxoZDnqQ=/479x479/smart/144/6/17041871276593d4f70761f_h-p-homepage-second-image.jpeg",
  },

  // Service & Parts. `hours` renders as the opening-times table; empty it and
  // the table goes. `body` stays the intro copy (the help chat reads it too).
  //
  // `services`  one action card each. `request` prefills "What do you need?"
  //             on /website/request-appointment; `href` sends the card
  //             somewhere else instead (Parts goes to the catalogue).
  // `highlights` the benefit cards beside the workshop photo.
  // `booking`   the workshop booking panel. Its "Required work" choices are
  //             the `services` that book through the workshop.
  serviceAndParts: {
    eyebrow: "Service & Parts",
    title: "Looked after by people who know your car",
    body: [
      "Authorised service agents for Suzuki and Mitsubishi. Genuine parts, manufacturer-trained technicians, and access to a state-of-the-art bodyshop facility.",
      "MOTs · Servicing · Warranty work · Tyres · Repairs · Diagnostics · Bodyshop",
    ],
    services: [
      { id: "service", icon: "wrench", title: "Service", body: "Manufacturer-schedule servicing that protects your warranty.", request: "Service", cta: "Book a service" },
      { id: "mot", icon: "clipboard", title: "MOT", body: "Class 4 MOT testing, with any advisories explained clearly.", request: "MOT", cta: "Book an MOT" },
      { id: "repairs", icon: "gauge", title: "Repairs & diagnostics", body: "Warning lights, noises and faults traced with dealer diagnostics.", request: "Repairs & diagnostics", cta: "Book a check" },
      { id: "tyres", icon: "tyre", title: "Tyres", body: "Tyres supplied, fitted and balanced, plus wheel alignment.", request: "Tyres", cta: "Book tyres" },
      { id: "parts", icon: "box", title: "Parts & accessories", body: "Genuine Suzuki and Mitsubishi parts, over the counter or online.", href: "/website/parts-catalog", cta: "Browse parts" },
      { id: "smart-repair", icon: "sparkle", title: "SMART repair", body: "Scuffs, chips and small dents repaired without a full respray.", request: "SMART repair", cta: "Book a repair" },
      { id: "health-check", icon: "inspect", title: "Vehicle health check", body: "Tyres, brakes, battery and fluids checked for added peace of mind.", request: "Vehicle health check", cta: "Book a health check" },
      { id: "warranty", icon: "shield", title: "Warranty work", body: "Get help with a warranty concern and advice on the next steps.", request: "Warranty work", cta: "Book a warranty check" },
    ],
    highlights: [
      { id: "technicians", icon: "badge", title: "Manufacturer-trained technicians", body: "Suzuki and Mitsubishi trained, using the latest dealer equipment and software." },
      { id: "courtesy-car", icon: "key", title: "Courtesy cars", body: "Keep moving while we work — ask for a courtesy car when you book." },
    ],
    booking: {
      title: "Book your workshop visit",
      body: "Tell us what you need and when suits you. We will confirm a time.",
      cta: "Book workshop",
    },
    hours: [
      { days: "Mon – Fri", time: "8:00 – 18:00" },
      { days: "Saturday", time: "8:30 – 12:30" },
      { days: "Sunday", time: "Closed" },
    ],
    imageUrl:
      "https://images.67degreescdn.co.uk/kWdMmJColsQoohYLdV5U2GoGoA0=/479x479/smart/144/6/1719341105667b10312bd98_waiting.jpg",
  },

  // Motability. `models` is one vehicle card each (see motabilityModels
  // above); `rangeBrands` is derived from it for older readers.
  // `schemeBenefits` are the benefit cards; `specialist` is the "speak to a
  // specialist" panel — `teamIds` are ids from data/team.js whose photos are
  // shown (confirm these are the Motability specialists).
  motability: {
    eyebrow: "Motability",
    title: "The Motability Scheme made simple",
    body: [
      "Five dedicated Motability specialists on staff to help you choose the right vehicle, arrange any adaptations, and look after the maintenance for the life of your lease.",
      "Available across the Suzuki and Mitsubishi ranges — including the new electric e-Vitara.",
    ],
    payments: "From £299 per month",
    models: motabilityModels,
    rangeBrands: brandsFrom(motabilityModels),
    schemeBenefits: [
      { id: "adaptations", icon: "sliders", title: "Adaptations", body: "Many driving and access adaptations can be fitted at no extra cost." },
      { id: "insurance", icon: "shield", title: "Insurance included", body: "Fully comprehensive cover for up to three named drivers." },
      { id: "servicing", icon: "wrench", title: "Servicing & breakdown", body: "Servicing, maintenance and RAC breakdown cover are all included." },
      { id: "tyres", icon: "tyre", title: "Tyres & windscreens", body: "Tyre replacement and windscreen repair for the life of the lease." },
    ],
    specialist: {
      title: "Talk it through with a Motability specialist",
      body: "Our specialists will help you check eligibility, compare models, try a car with any adaptations you need and handle the paperwork from start to finish.",
      teamIds: ["melissa-post", "bradley-hood", "graham-hayward", "richard-stockwell", "mark-copping"],
    },
    cta: { label: "Speak to a specialist", href: "tel:01732870711" },
  },

  // Sell Your Car. `steps` is the compact numbered list beside the valuation
  // form. `benefits` stays a list of strings (the valuation page and the help
  // chat read it); `benefitCards` is the card row shown on the home page.
  // `cta` is the valuation form's submit label and destination.
  sellYourCar: {
    eyebrow: "Sell Your Car",
    title: "Sell to us in three simple steps",
    lead: "Get a free, no-obligation valuation in minutes. We buy any make, any age and any mileage.",
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
    benefitCards: [
      { id: "collection", icon: "truck", title: "Free collection", body: "We collect from your home or work at no cost." },
      { id: "fees", icon: "tag", title: "No hidden fees", body: "No admin fees, no deductions on the day." },
      { id: "finance", icon: "bank", title: "Finance settled", body: "We settle outstanding finance with your lender." },
      { id: "payment", icon: "bolt", title: "Fast payment", body: "Paid by bank transfer, the same day." },
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
    // The "Plan your visit" band at the top of the block (components/VisitCta.js).
    // One `variant: "primary"` action; the rest render as ghost buttons.
    visit: {
      eyebrow: "Plan your visit",
      title: "Come and see us in West Malling",
      lead: "Browse the forecourt, arrange a test drive or talk to our workshop team — we're on London Road, just off the A20.",
      actions: [
        { label: "Call 01732 870711", href: "tel:01732870711", variant: "primary" },
        { label: "Get directions", href: "https://www.google.com/maps/dir/?api=1&destination=Humphries+%26+Parks+West+Malling+ME19+5AN" },
        { label: "Book a service", href: "/website/request-appointment" },
        { label: "Value my car", href: "/website/valuation" },
      ],
    },
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

  // "Our promise" — the row of benefit cards at the top of the Contact block
  // (components/BenefitCards.js). Empty `items` and the row goes.
  promise: {
    eyebrow: "Why choose us",
    title: "Our promise to you",
    items: [
      { id: "inspection", icon: "inspect", title: "120-point inspection", body: "Every car is checked thoroughly before it reaches you." },
      { id: "warranty", icon: "shield", title: "Warranty & MOT as standard", body: "At least six months of each on every car we sell." },
      { id: "motability", icon: "key", title: "Motability specialists", body: "Five dedicated specialists, from choosing to adaptations." },
      { id: "same-day", icon: "pound", title: "Paid the same day", body: "Sell to us with free collection and no admin fees." },
      { id: "genuine-parts", icon: "wrench", title: "Genuine parts", body: "Manufacturer-trained technicians and genuine parts." },
    ],
  },

  // The "Useful links" column in the footer on every /website page
  // (components/WebsiteFooter.js). Internal paths only need to start with "/".
  customerLinks: [
    { label: "Available stock", href: "/website/available-stock" },
    { label: "Sell your car", href: "/website/valuation" },
    { label: "Book a service", href: "/website/request-appointment" },
    { label: "Parts & accessories", href: "/website/parts-catalog" },
    { label: "Motability", href: "/website#motability" },
    { label: "Help & advice", href: "/website#blog" },
    { label: "My account", href: "/website/profile" },
  ],

  footer: {
    fcaReg: "FCA Registration No. 310734",
    creditDisclosure:
      "Humphries & Parks Limited acts as a credit broker, not a lender. We have a panel of lenders including Suzuki Financial Services, CA Auto Finance, and Santander Consumer Finance. Lenders may pay us a fixed commission for introducing you. The amount of commission is available on request.",
    legal: ["Privacy Policy", "Cookie Policy", "Terms & Conditions", "Complaints"],
  },
};
