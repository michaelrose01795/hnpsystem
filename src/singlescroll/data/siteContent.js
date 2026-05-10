// file location: src/singlescroll/data/siteContent.js
// Plain content store for the public single-scroll site. Edit copy here without touching components.

export const siteContent = {
  brand: {
    name: "Humphries & Parks",
    tagline: "Est. 1947",
    logoUrl:
      "https://images.67degreescdn.co.uk/a06qnEEaPN3JqRsIC9dAXhbh5PQ=/150x/filters:no_upscale()/144/1/humphries-and-parks-main-logo-8000px.png",
    logoWhiteUrl:
      "https://images.67degreescdn.co.uk/Pch_yGOme1JpijxgRa9u-kkc9Ko=/150x/filters:no_upscale()/144/1/171379060966265e9165aac_humphries-and-parks-main-logo-all-white.png",
  },

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

  trustPoints: [
    { value: "75+", label: "Years in business" },
    { value: "5.0★", label: "97 reviews" },
    { value: "120-pt", label: "Inspection on every car" },
    { value: "6+ mo.", label: "Warranty & MOT minimum" },
    { value: "EV", label: "Approved retailer" },
    { value: "Award", label: "AutoTrader Retailer Awards" },
  ],

  ratings: [
    { source: "AutoTrader", score: "4.8 / 5" },
    { source: "JudgeService", score: "4.8 / 5" },
    { source: "Google", score: "4.6 / 5" },
  ],

  about: {
    eyebrow: "About Us",
    title: "A Kent dealership built on three generations of trust",
    body: [
      "Humphries & Parks was established in 1947 and has been family-run ever since. Treating customers and team members as part of the H&P family is integral to our ethos.",
      "We're a multi-award-winning dealership recognised by the AutoTrader Retailer Awards, certified Electric Vehicle Approved by the Office for Low Emission Vehicles, and proud authorised retailers for Suzuki, KGM and Mitsubishi.",
      "Whether you're buying new, choosing a quality used car, arranging a Motability vehicle, booking a service, or selling your current car — we're here to make it simple.",
    ],
    imageUrl:
      "https://images.67degreescdn.co.uk/8frG0OWBndXZg4XkXeCTxoZDnqQ=/479x479/smart/144/6/17041871276593d4f70761f_h-p-homepage-second-image.jpeg",
  },

  serviceAndParts: {
    eyebrow: "Service & Parts",
    title: "Looked after by people who know your car",
    body: [
      "Authorised service agents for Suzuki, KGM and Mitsubishi. Genuine parts, manufacturer-trained technicians, and access to a state-of-the-art bodyshop facility.",
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

  motability: {
    eyebrow: "Motability",
    title: "The Motability Scheme made simple",
    body: [
      "Five dedicated Motability specialists on staff to help you choose the right vehicle, arrange any adaptations, and look after the maintenance for the life of your lease.",
      "Available across the Suzuki and KGM ranges — including the new electric e-Vitara.",
    ],
    payments: "From £299 per month",
    rangeBrands: [
      { brand: "Suzuki", models: ["Swift", "Vitara", "S-Cross", "Across", "e-Vitara"] },
      { brand: "KGM", models: ["Tivoli", "Torres", "Korando"] },
    ],
    cta: { label: "Speak to a specialist", href: "tel:01732870711" },
  },

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
    cta: { label: "Get your free valuation", href: "#contact" },
  },

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
      { label: "YouTube", href: "https://www.youtube.com/@humphriesandparks" },
    ],
  },

  footer: {
    fcaReg: "FCA Registration No. 310734",
    creditDisclosure:
      "Humphries & Parks Limited acts as a credit broker, not a lender. We have a panel of lenders including Suzuki Financial Services, CA Auto Finance, and Santander Consumer Finance. Lenders may pay us a fixed commission for introducing you. The amount of commission is available on request.",
    legal: ["Privacy Policy", "Cookie Policy", "Terms & Conditions", "Complaints"],
  },
};
