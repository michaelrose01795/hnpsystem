// file location: src/features/website/data/offers.js
//
// Promotional banner data for the /website Offers section.
//
// This section is 100% code-owned: the array below is the ONE place the cards
// come from. The public page does not read offers out of the database - see
// the register in src/features/website/data/codeOwnedContent.js -
// so what is written here is exactly what renders, every time, with no DB
// round-trip and nothing to publish.
//
// These eight entries are MOCK data standing in until the real campaign list
// is agreed. Changing them is a code edit and nothing else:
//
//   - add a card     append an object to the array
//   - remove a card  delete its object
//   - reorder        move the objects - they render top-left to bottom-right
//   - retitle        edit `title` / `headline` / `body`
//
// Images: `image` is a plain string that goes straight into the card's
// <img src>, so anything the browser can load works -
//
//   - an absolute URL on the dealer CDN (what the entries below use), or
//   - a file dropped into /public, referenced from the site root,
//     e.g. "/website/offers/spring-service.jpg"
//
// The card art is cropped to 16/10 with object-fit: cover
// (.ws-offer-media in src/styles/custglobal.css), so any aspect ratio is safe -
// landscape banners around 1920x873 crop best. `title` doubles as the image's
// alt text, so keep it descriptive.
//
// Fields, all required, all strings:
//   id        stable unique key for React - kebab-case, never reused
//   title     small eyebrow line above the headline (and the img alt text)
//   headline  the card's main line - the actual offer
//   body      one sentence of supporting copy

export const offers = [
  {
    id: "mock-swift-apr",
    title: "New Suzuki Swift",
    headline: "0% APR Representative",
    body: "Hybrid efficiency, premium kit and 0% finance across selected Swift models.",
    image:
      "https://images.67degreescdn.co.uk/TFK7QKvuB5vSgQ8a4JwwCH48hzA=/459x/144/6/0e11e749a4f9f7b8c0d0_q2-2026-uk-swift_web_banner_1920x873px_v2.jpg",
  },
  {
    id: "mock-vitara-pcp",
    title: "Suzuki Vitara",
    headline: "0% PCP available",
    body: "The all-rounder SUV - practical, hybrid, and now on 0% PCP.",
    image:
      "https://images.67degreescdn.co.uk/gyEfuN1I3-fOixzTQvMqg37i_HU=/459x/144/6/a0d5bf05ac46154454fe_q2-2026-uk-vitara_facelift-web_1920x873px.jpg",
  },
  {
    id: "mock-scross-saving",
    title: "Suzuki S-Cross",
    headline: "£3,050 customer saving",
    body: "Full hybrid with ALLGRIP available, and £3,050 off selected stock.",
    image:
      "https://images.67degreescdn.co.uk/hBhV9Gbp44dEsw52VTga7T9Pjrw=/459x/144/6/9c10a56552d3b2795a73_q2-2026-uk-s-cross_web-1920x873px_v2.jpg",
  },
  {
    id: "mock-evitara-pch",
    title: "Suzuki e-Vitara",
    headline: "Personal Contract Hire from £299",
    body: "Suzuki's first all-electric SUV, on flexible PCH terms with servicing included.",
    image:
      "https://images.67degreescdn.co.uk/afZfv58mznDRosA8FiLaIkM49fY=/459x/144/6/c8c7152a46ab73307016_q2-2026-uk-e-vitara_web-banner_1920x873px.jpg",
  },
  {
    id: "mock-warranty-ten-year",
    title: "10-Year Warranty",
    headline: "Service Activated Warranty",
    body: "Service with us each year and Suzuki extends your cover up to 10 years.",
    image:
      "https://images.67degreescdn.co.uk/9C9qPWP7uR_qH56rdN03cOyRz6w=/459x/144/6/f6302b9b2fd4c2e931e0_21782_10_year_web-banners-v1-1920x873px.jpg",
  },
  {
    id: "mock-mitsubishi-retailer",
    title: "Mitsubishi",
    headline: "Mitsubishi is back in Kent",
    body: "We're a proud authorised retailer for the returning Mitsubishi range.",
    image:
      "https://images.67degreescdn.co.uk/zrxy_fgbORQAS7JSPJho1KSZ08E=/459x/144/6/c44b894d19350f8e8f29_mitsubishi-banner.jpg",
  },
  {
    id: "mock-winter-health-check",
    title: "Aftersales",
    headline: "Free winter health check",
    body: "A 28-point check on tyres, brakes, battery and fluids before the cold sets in.",
    image:
      "https://images.67degreescdn.co.uk/kWdMmJColsQoohYLdV5U2GoGoA0=/479x479/smart/144/6/1719341105667b10312bd98_waiting.jpg",
  },
  {
    id: "mock-mot-service-bundle",
    title: "Servicing",
    headline: "Save £40 on MOT and service",
    body: "Book both together and we'll take £40 off, with a courtesy car on request.",
    image:
      "https://images.67degreescdn.co.uk/8frG0OWBndXZg4XkXeCTxoZDnqQ=/479x479/smart/144/6/17041871276593d4f70761f_h-p-homepage-second-image.jpeg",
  },
];
