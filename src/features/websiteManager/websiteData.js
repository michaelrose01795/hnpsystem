// file location: src/features/websiteManager/websiteData.js
// Real-data adapter for the staff-side Website Manager.
//
// This is NOT mock data. Every page, content block, media asset and SEO entry
// below is derived directly from the live content that the public /website
// single-scroll page actually renders — the data modules in
// src/singlescroll/data/* (the same modules imported by
// src/singlescroll/WebsitePage.js).
//
// The public site is a single-scroll page, so its "pages" are really the nav
// chapters (#cars, #offers, #about, …). This adapter maps each chapter to a
// manageable "page" and turns each real content record into an editable block.
//
// Edits made in the Website Manager currently update in-memory React state
// only — there is no write-back yet.
//   TODO: persist edits by writing back to the src/singlescroll/data modules
//         (or, preferably, move that content into Supabase tables behind
//         /api/website/* and have both WebsitePage.js and this tool read it).
//
// Fields the live content does not yet record (per-block edit author/time,
// draft state, file sizes, an audit trail) are intentionally left null/empty
// rather than invented — they populate for real once a backend exists.

import { siteContent } from "@/singlescroll/data/siteContent";
import { vehicles } from "@/singlescroll/data/vehicles";
import { offers } from "@/singlescroll/data/offers";
import { reviews } from "@/singlescroll/data/reviews";
import { team, teamDepartments } from "@/singlescroll/data/team";
import { timeline } from "@/singlescroll/data/timeline";
import { brands } from "@/singlescroll/data/brands";
import { blogPosts } from "@/singlescroll/data/blogPosts";
import { partsContent } from "@/singlescroll/data/partsContent";

const { brand, hero, trustPoints, ratings, about, serviceAndParts, motability, sellYourCar, contact } =
  siteContent;

// Block types offered in the Page Content editor — the full set actually used
// by the live /website page.
export const BLOCK_TYPES = [
  "Hero Banner",
  "Text Section",
  "Image Gallery",
  "Call To Action",
  "Card Grid",
  "Feature List",
  "Promo Banner",
  "Vehicle Listing",
  "Blog Post",
  "Review",
  "Team Member",
  "Timeline Entry",
  "Embedded Form",
];

// Derive a readable filename from a CDN image URL (strips the hash prefix the
// 67degrees CDN adds, e.g. "163828..._marcusjoy.jpg" -> "marcusjoy.jpg").
function fileNameFromUrl(url) {
  if (!url) return "asset";
  const path = String(url).split("?")[0];
  const seg = path.substring(path.lastIndexOf("/") + 1) || path;
  return seg.replace(/^[0-9a-f]{12,}_/i, "");
}

// Every content block carries the same shape. Live website content has no
// edit-author/timestamp metadata yet, so those start null and only populate
// when the block is edited inside this tool.
function block(id, title, type, summary) {
  return {
    id,
    title,
    type,
    summary,
    status: "published", // everything currently on /website is live
    lastEditedBy: null,
    lastEditedAt: null,
  };
}

const deptLabel = (deptId) =>
  teamDepartments.find((d) => d.id === deptId)?.label || deptId;

/* ------------------------------------------------------------------ */
/* Pages — one per public /website nav chapter                         */
/* ------------------------------------------------------------------ */

const PAGE_DEFS = [
  { key: "home", name: "Homepage", route: "/website" },
  { key: "new-cars", name: "New Cars", route: "/website#cars" },
  { key: "used-cars", name: "Used Cars", route: "/website#cars" },
  { key: "offers", name: "Offers", route: "/website#offers" },
  { key: "sell-your-car", name: "Sell Your Car", route: "/website#sell" },
  { key: "service-parts", name: "Service & Parts", route: "/website#service" },
  { key: "motability", name: "Motability", route: "/website#motability" },
  { key: "about", name: "About Us", route: "/website#about" },
  { key: "blog", name: "Blog", route: "/website#blog" },
  { key: "contact", name: "Contact Us", route: "/website#contact" },
];

export const WEBSITE_PAGES = PAGE_DEFS.map((d) => ({
  ...d,
  status: "published",
  lastEditedBy: null,
  lastEditedAt: null,
}));

/* ------------------------------------------------------------------ */
/* Content blocks — built from the real /website data modules          */
/* ------------------------------------------------------------------ */

const newVehicles = vehicles.filter((v) => v.type === "new");
const usedVehicles = vehicles.filter((v) => v.type === "used");

const vehicleBlock = (v) =>
  block(
    `vehicle-${v.id}`,
    `${v.brand} ${v.model}`,
    "Vehicle Listing",
    `${v.year} · ${v.price}${v.badge ? ` · ${v.badge}` : ""}`
  );

export const PAGE_CONTENT = {
  home: [
    block("home-hero", `Hero banner — “${hero.headline}”`, "Hero Banner", hero.subhead),
    block(
      "home-hero-ctas",
      "Hero call-to-action buttons",
      "Call To Action",
      hero.ctas.map((c) => c.label).join("  ·  ")
    ),
    block(
      "home-trust",
      "Trust highlights bar",
      "Feature List",
      trustPoints.map((t) => `${t.value} ${t.label}`).join("  ·  ")
    ),
    block(
      "home-brands",
      "Authorised brand strip",
      "Image Gallery",
      brands.map((b) => b.name).join(", ")
    ),
    block(
      "home-ratings",
      "Review ratings strip",
      "Feature List",
      ratings.map((r) => `${r.source}: ${r.score}`).join("  ·  ")
    ),
    ...reviews.map((r) =>
      block(
        `home-review-${r.id}`,
        `Customer review — ${r.name}`,
        "Review",
        `${r.rating}★ · ${r.source}, ${r.date} — “${r.quote}”`
      )
    ),
  ],

  "new-cars": newVehicles.map(vehicleBlock),
  "used-cars": usedVehicles.map(vehicleBlock),

  offers: offers.map((o) =>
    block(`offer-${o.id}`, `${o.title} — ${o.headline}`, "Promo Banner", o.body)
  ),

  "sell-your-car": [
    block("sell-intro", sellYourCar.title, "Text Section", `Section eyebrow: ${sellYourCar.eyebrow}`),
    ...sellYourCar.steps.map((s) =>
      block(`sell-step-${s.n}`, `Step ${s.n} — ${s.title}`, "Feature List", s.body)
    ),
    block(
      "sell-benefits",
      "Why sell to Humphries & Parks",
      "Feature List",
      sellYourCar.benefits.join("  ·  ")
    ),
    block(
      "sell-cta",
      `Call to action — ${sellYourCar.cta.label}`,
      "Call To Action",
      `Links to ${sellYourCar.cta.href}`
    ),
  ],

  "service-parts": [
    block("svc-intro", serviceAndParts.title, "Text Section", serviceAndParts.body[0]),
    ...serviceAndParts.body.slice(1).map((p, i) =>
      block(`svc-body-${i}`, `Service & Parts copy ${i + 2}`, "Text Section", p)
    ),
    block(
      "svc-hours",
      "Service opening hours",
      "Feature List",
      serviceAndParts.hours.map((h) => `${h.days}: ${h.time}`).join("  ·  ")
    ),
    block("parts-intro", partsContent.title, "Text Section", partsContent.body.join("  ")),
    ...partsContent.brands.map((b, i) =>
      block(`parts-brand-${i}`, `Parts — ${b.name}`, "Card Grid", b.note)
    ),
  ],

  motability: [
    block("mot-intro", motability.title, "Text Section", motability.body[0]),
    ...motability.body.slice(1).map((p, i) =>
      block(`mot-body-${i}`, `Motability copy ${i + 2}`, "Text Section", p)
    ),
    block("mot-payments", "Motability pricing line", "Text Section", motability.payments),
    ...motability.rangeBrands.map((rb) =>
      block(`mot-range-${rb.brand}`, `Motability range — ${rb.brand}`, "Card Grid", rb.models.join(", "))
    ),
    block(
      "mot-cta",
      `Call to action — ${motability.cta.label}`,
      "Call To Action",
      `Links to ${motability.cta.href}`
    ),
  ],

  about: [
    ...about.body.map((p, i) =>
      block(`about-para-${i}`, `About copy — paragraph ${i + 1}`, "Text Section", p)
    ),
    ...timeline.map((t) =>
      block(`about-milestone-${t.year}`, `${t.year} — ${t.title}`, "Timeline Entry", t.body)
    ),
    ...team.map((m) =>
      block(`about-team-${m.id}`, `Team — ${m.name}`, "Team Member", `${m.role} · ${deptLabel(m.department)}`)
    ),
  ],

  blog: blogPosts.map((p) =>
    block(`blog-${p.id}`, p.title, "Blog Post", `${p.date} — ${p.excerpt}`)
  ),

  contact: [
    block("contact-address", "Branch address", "Text Section", contact.address.join(", ")),
    block(
      "contact-phone",
      "Contact phone number",
      "Call To Action",
      `${contact.phone}  (${contact.phoneHref})`
    ),
    block(
      "contact-sales-hours",
      "Sales opening hours",
      "Feature List",
      contact.salesHours.map((h) => `${h.days}: ${h.time}`).join("  ·  ")
    ),
    block(
      "contact-service-hours",
      "Service opening hours",
      "Feature List",
      contact.serviceHours.map((h) => `${h.days}: ${h.time}`).join("  ·  ")
    ),
    block(
      "contact-socials",
      "Social media links",
      "Feature List",
      contact.socials.map((s) => `${s.label} (${s.href})`).join("  ·  ")
    ),
    block("contact-map", "Embedded location map", "Embedded Form", contact.mapEmbed),
  ],
};

/* ------------------------------------------------------------------ */
/* Media library — every real image URL used on the /website page      */
/* ------------------------------------------------------------------ */

function collectMedia() {
  const map = new Map();
  const add = (url, usedOn) => {
    if (!url) return;
    const existing = map.get(url);
    if (existing) {
      existing.usedOn.add(usedOn);
      return;
    }
    map.set(url, { url, usedOn: new Set([usedOn]) });
  };

  add(brand.logoUrl, "Homepage — Logo");
  add(brand.logoWhiteUrl, "Homepage — Logo (white)");
  add(hero.backgroundUrl, "Homepage — Hero");
  add(about.imageUrl, "About Us");
  add(serviceAndParts.imageUrl, "Service & Parts");
  brands.forEach((b) => add(b.logo, "Homepage — Brand strip"));
  newVehicles.forEach((v) => add(v.image, "New Cars"));
  usedVehicles.forEach((v) => add(v.image, "Used Cars"));
  offers.forEach((o) => add(o.image, "Offers"));
  blogPosts.forEach((p) => add(p.image, "Blog"));
  team.forEach((m) => add(m.photo, "About Us — Team"));

  return Array.from(map.values()).map((m, i) => ({
    id: `media-${i + 1}`,
    name: fileNameFromUrl(m.url),
    url: m.url,
    type: "image",
    sizeKb: null, // not known until served by a real media backend
    uploadedBy: null,
    uploadedAt: null,
    usedOn: Array.from(m.usedOn).join(", "),
  }));
}

export const MEDIA_ASSETS = collectMedia();

/* ------------------------------------------------------------------ */
/* SEO / meta                                                          */
/* ------------------------------------------------------------------ */
// The Homepage entry is the live <Head> from src/singlescroll/WebsitePage.js.
// /website is a single-scroll page, so the other chapters have no separate
// <head> on the live site — their entries below are derived from real section
// content (real anchors, real copy) so the panel stays useful and editable.

export const SEO_ENTRIES = {
  home: {
    metaTitle: `${brand.name} — Family-run Suzuki, KGM & Mitsubishi dealer in Kent`,
    metaDescription:
      "Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing, MOTs and parts.",
    slug: "/website",
    canonical: "",
    ogImage: fileNameFromUrl(hero.backgroundUrl),
    indexed: true,
  },
  "new-cars": {
    metaTitle: `New Cars — ${brand.name}`,
    metaDescription: `New ${[...new Set(newVehicles.map((v) => v.brand))].join(", ")} cars with manufacturer offers.`,
    slug: "/website#cars",
    canonical: "",
    ogImage: newVehicles[0] ? fileNameFromUrl(newVehicles[0].image) : "",
    indexed: true,
  },
  "used-cars": {
    metaTitle: `Used Cars — ${brand.name}`,
    metaDescription: `Quality used cars from ${[...new Set(usedVehicles.map((v) => v.brand))].join(", ")}, each with a 120-point inspection.`,
    slug: "/website#cars",
    canonical: "",
    ogImage: usedVehicles[0] ? fileNameFromUrl(usedVehicles[0].image) : "",
    indexed: true,
  },
  offers: {
    metaTitle: `Offers — ${brand.name}`,
    metaDescription: `${offers.length} current manufacturer offers across the Suzuki, KGM and Mitsubishi ranges.`,
    slug: "/website#offers",
    canonical: "",
    ogImage: offers[0] ? fileNameFromUrl(offers[0].image) : "",
    indexed: true,
  },
  "sell-your-car": {
    metaTitle: `${sellYourCar.title} — ${brand.name}`,
    metaDescription: sellYourCar.benefits.slice(0, 2).join(". ") + ".",
    slug: "/website#sell",
    canonical: "",
    ogImage: "",
    indexed: true,
  },
  "service-parts": {
    metaTitle: `${serviceAndParts.title} — ${brand.name}`,
    metaDescription: serviceAndParts.body[0],
    slug: "/website#service",
    canonical: "",
    ogImage: fileNameFromUrl(serviceAndParts.imageUrl),
    indexed: true,
  },
  motability: {
    metaTitle: `${motability.title} — ${brand.name}`,
    metaDescription: motability.body[0],
    slug: "/website#motability",
    canonical: "",
    ogImage: "",
    indexed: true,
  },
  about: {
    metaTitle: `${about.title} — ${brand.name}`,
    metaDescription: about.body[0],
    slug: "/website#about",
    canonical: "",
    ogImage: fileNameFromUrl(about.imageUrl),
    indexed: true,
  },
  blog: {
    metaTitle: `Blog — ${brand.name}`,
    metaDescription: `${blogPosts.length} car-buying guides and dealership news articles for buyers in Kent.`,
    slug: "/website#blog",
    canonical: "",
    ogImage: blogPosts[0] ? fileNameFromUrl(blogPosts[0].image) : "",
    indexed: true,
  },
  contact: {
    metaTitle: `${contact.title} — ${brand.name}`,
    metaDescription: `Visit ${brand.name} at ${contact.address.slice(1).join(", ")}. Call ${contact.phone}.`,
    slug: "/website#contact",
    canonical: "",
    ogImage: "",
    indexed: true,
  },
};

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */
// Starts empty — there is no audit backend, so the only real activity is what
// staff change through this tool during the session. Every change is appended
// live by WebsiteManager.js.
//   TODO: load the real audit trail from /api/website/activity once it exists.
export const INITIAL_ACTIVITY = [];
