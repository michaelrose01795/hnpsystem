// file location: src/features/website/data/codeOwnedContent.js
//
// The register of /website content that is owned by CODE, not by the database.
//
// Background. Every block of the public page used to be able to come from two
// places: the modules in this folder (the first-paint fallback) and the
// website_* tables behind /api/website/content (what the site builder saves).
// Two sources for one block means the page can disagree with the file you are
// reading, and an editor in the Website Manager can save a row that never
// renders. Offers and Vehicles were moved to code first; this module finishes
// the job for the rest of the page sections.
//
// What is code-owned (this file's lists):
//   every SECTION of the page — hero, trust points, partner brands, cars,
//   offers, sell your car, service & parts, motability, parts & accessories,
//   about, timeline, ratings, reviews, team, blog, contact.
//
// What is NOT, and is still edited in the Website Manager:
//   the site CHROME — brand identity (name + logos), the footer legal block,
//   the top-bar links (website_nav), the block running order / heading copy
//   (website_section_layout) and the visual design (website_design). Those are
//   settings about the site rather than content inside a section, they have
//   working editors, and nothing about them is per-item marketing copy.
//
// Consumers:
//   src/features/website/hooks/useWebsiteContent.js  discards the API payload
//     for these keys and ignores Live Preview patches aimed at them.
//   src/features/websiteManager/panels/LivePreviewPanel.js
//   src/features/websiteManager/panels/PageContentPanel.js
//     replace the editor for these sections with a note naming the file to
//     edit, so staff are never given a form whose Save does nothing.
//
// This module lives on the public-site side on purpose: the website feature
// must not import from the manager feature, and the manager already imports
// these data modules.

/* ---------------------------------------------------------------- */
/* Section register                                                  */
/* ---------------------------------------------------------------- */
// Keyed by the schema section key used throughout the Website Manager
// (src/features/websiteManager/editors/sectionSchemas.js) and by the Live
// Preview patch messages.
//
//   label  human name, for the "set in code" notice
//   file   the module a developer edits to change this section
//   export what to look for inside that file
export const CODE_OWNED_SECTIONS = {
  hero: {
    label: "Hero banner",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.hero",
  },
  "trust-points": {
    label: "Trust highlights",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.trustPoints",
  },
  "partner-brands": {
    label: "Partner brand strip",
    file: "src/features/website/data/brands.js",
    export: "brands",
  },
  vehicles: {
    label: "Featured vehicles",
    file: "src/features/website/data/vehicles.js",
    export: "vehicles (a view of the DMS stock — edit the car in the DMS)",
  },
  offers: {
    label: "Manufacturer offers",
    file: "src/features/website/data/offers.js",
    export: "offers",
  },
  "sell-your-car": {
    label: "Sell Your Car",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.sellYourCar",
  },
  "service-parts": {
    label: "Service & Parts",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.serviceAndParts",
  },
  motability: {
    label: "Motability",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.motability",
  },
  "parts-content": {
    label: "Parts & Accessories",
    file: "src/features/website/data/partsContent.js",
    export: "partsContent",
  },
  about: {
    label: "About Us",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.about",
  },
  timeline: {
    label: "Timeline",
    file: "src/features/website/data/timeline.js",
    export: "timeline",
  },
  ratings: {
    label: "Review ratings",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.ratings",
  },
  reviews: {
    label: "Customer reviews",
    file: "src/features/website/data/reviews.js",
    export: "reviews",
  },
  "team-departments": {
    label: "Team departments",
    file: "src/features/website/data/team.js",
    export: "teamDepartments",
  },
  "team-members": {
    label: "Team members",
    file: "src/features/website/data/team.js",
    export: "team",
  },
  "blog-posts": {
    label: "Help & advice cards",
    file: "src/features/website/data/blogPosts.js",
    export: "blogPosts",
  },
  contact: {
    label: "Contact details",
    file: "src/features/website/data/siteContent.js",
    export: "siteContent.contact",
  },
};

export const isCodeOwnedSection = (sectionKey) =>
  Boolean(sectionKey && CODE_OWNED_SECTIONS[sectionKey]);

/* ---------------------------------------------------------------- */
/* Content-tree keys                                                 */
/* ---------------------------------------------------------------- */
// The same sections, addressed the way useWebsiteContent holds them.
// Top-level collections on the content object.
export const CODE_OWNED_COLLECTIONS = [
  "vehicles",
  "offers",
  "reviews",
  "team",
  "teamDepartments",
  "timeline",
  "brands",
  "blogPosts",
];

// Slots under content.siteContent.
export const CODE_OWNED_SITE_CONTENT = [
  "hero",
  "trustPoints",
  "ratings",
  "reviewCta",
  "about",
  "sellYourCar",
  "serviceAndParts",
  "motability",
  "partsContent",
  "contact",
];

