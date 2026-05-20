// file location: tools/scripts/seed-website-content.mjs
//
// One-shot seed: copies the existing static content under src/singlescroll/data/*
// into the website_* tables created by migration 20260520120000.
//
// Idempotent: every write is an upsert keyed on the row's stable `id` (or
// 'default' for singleton tables). Re-running the script overwrites any seed-
// shaped row but leaves staff edits intact if they were written under a
// different id.
//
// Usage:
//   1. Ensure NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
//      (in .env at the project root - dotenv is loaded below).
//   2. Run the migration first:  psql / supabase db push  /
//      supabase migration up   - whichever applies in this environment.
//   3. node tools/scripts/seed-website-content.mjs
//
// Run as ESM (.mjs) so we can `import` the existing data modules directly.
// They contain no Next-specific imports - pure data.

/* eslint-disable no-console */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { siteContent } from "../../src/singlescroll/data/siteContent.js";
import { vehicles } from "../../src/singlescroll/data/vehicles.js";
import { offers } from "../../src/singlescroll/data/offers.js";
import { reviews } from "../../src/singlescroll/data/reviews.js";
import { team, teamDepartments } from "../../src/singlescroll/data/team.js";
import { timeline } from "../../src/singlescroll/data/timeline.js";
import { brands } from "../../src/singlescroll/data/brands.js";
import { blogPosts } from "../../src/singlescroll/data/blogPosts.js";
import { partsContent } from "../../src/singlescroll/data/partsContent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Aborting."
  );
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACTOR = "seed-script";

/* ---------------------------------------------------------------- helpers */

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const upsertOne = async (table, row, opts = {}) => {
  const onConflict = opts.onConflict || "id";
  const { error } = await supabase
    .from(table)
    .upsert(row, { onConflict })
    .select();
  if (error) {
    console.error(`  ✗ ${table} upsert failed:`, error.message);
    throw error;
  }
};

const upsertMany = async (table, rows, opts = {}) => {
  if (!rows.length) return;
  const onConflict = opts.onConflict || "id";
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict });
  if (error) {
    console.error(`  ✗ ${table} bulk upsert failed:`, error.message);
    throw error;
  }
};

/* ---------------------------------------------------------------- seeding */

async function seedSingletons() {
  console.log("→ singletons");
  const { brand, hero, about, serviceAndParts, motability, sellYourCar, contact, footer } =
    siteContent;

  await upsertOne("website_brand", {
    id: "default",
    name: brand.name,
    logo_url: brand.logoUrl,
    logo_white_url: brand.logoWhiteUrl,
    updated_by: ACTOR,
  });

  await upsertOne("website_hero", {
    id: "default",
    eyebrow: hero.eyebrow,
    headline: hero.headline,
    subhead: hero.subhead,
    background_url: hero.backgroundUrl,
    ctas: hero.ctas,
    updated_by: ACTOR,
  });

  await upsertOne("website_about", {
    id: "default",
    eyebrow: about.eyebrow,
    title: about.title,
    body: about.body,
    image_url: about.imageUrl,
    updated_by: ACTOR,
  });

  await upsertOne("website_service_parts", {
    id: "default",
    eyebrow: serviceAndParts.eyebrow,
    title: serviceAndParts.title,
    body: serviceAndParts.body,
    hours: serviceAndParts.hours,
    image_url: serviceAndParts.imageUrl,
    cta_label: serviceAndParts.cta?.label || null,
    cta_href: serviceAndParts.cta?.href || null,
    updated_by: ACTOR,
  });

  await upsertOne("website_motability", {
    id: "default",
    eyebrow: motability.eyebrow,
    title: motability.title,
    body: motability.body,
    payments: motability.payments,
    range_brands: motability.rangeBrands,
    cta_label: motability.cta?.label || null,
    cta_href: motability.cta?.href || null,
    updated_by: ACTOR,
  });

  await upsertOne("website_sell_your_car", {
    id: "default",
    eyebrow: sellYourCar.eyebrow,
    title: sellYourCar.title,
    steps: sellYourCar.steps,
    benefits: sellYourCar.benefits,
    cta_label: sellYourCar.cta?.label || null,
    cta_href: sellYourCar.cta?.href || null,
    updated_by: ACTOR,
  });

  await upsertOne("website_parts_content", {
    id: "default",
    eyebrow: partsContent.eyebrow,
    title: partsContent.title,
    body: partsContent.body,
    brands: partsContent.brands,
    cta_label: partsContent.cta?.label || null,
    cta_href: partsContent.cta?.href || null,
    updated_by: ACTOR,
  });

  await upsertOne("website_contact", {
    id: "default",
    eyebrow: contact.eyebrow,
    title: contact.title,
    phone: contact.phone,
    phone_href: contact.phoneHref,
    address: contact.address,
    sales_hours: contact.salesHours,
    service_hours: contact.serviceHours,
    socials: contact.socials,
    map_embed: contact.mapEmbed,
    updated_by: ACTOR,
  });

  await upsertOne("website_footer", {
    id: "default",
    legal_links: footer.legal,
    fca_reg: footer.fcaReg,
    credit_disclosure: footer.creditDisclosure,
    updated_by: ACTOR,
  });
}

async function seedCollections() {
  console.log("→ collections");
  const { trustPoints, ratings } = siteContent;

  await upsertMany(
    "website_trust_points",
    trustPoints.map((t, i) => ({
      id: `tp-${i + 1}`,
      value: t.value,
      label: t.label,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_partner_brands",
    brands.map((b, i) => ({
      id: slug(b.name) || `pb-${i + 1}`,
      name: b.name,
      logo_url: b.logo,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_ratings",
    ratings.map((r, i) => ({
      id: slug(r.source) || `rt-${i + 1}`,
      source: r.source,
      score: r.score,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_vehicles",
    vehicles.map((v, i) => ({
      id: v.id,
      vehicle_type: v.type,
      brand: v.brand,
      model: v.model,
      year: v.year,
      price_text: v.price,
      miles: v.miles,
      badge: v.badge,
      image_url: v.image,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_offers",
    offers.map((o, i) => ({
      id: o.id,
      title: o.title,
      headline: o.headline,
      body: o.body,
      image_url: o.image,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_reviews",
    reviews.map((r, i) => ({
      id: r.id,
      customer_name: r.name,
      rating: r.rating,
      source: r.source,
      review_date: r.date,
      quote: r.quote,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  // Departments first (FK target), then members.
  await upsertMany(
    "website_team_departments",
    teamDepartments.map((d, i) => ({
      id: d.id,
      label: d.label,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_team_members",
    team.map((m, i) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      department_id: m.department,
      photo_url: m.photo,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_timeline",
    timeline.map((t, i) => ({
      id: `tl-${slug(t.year) || i + 1}`,
      year: t.year,
      title: t.title,
      body: t.body,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );

  await upsertMany(
    "website_blog_posts",
    blogPosts.map((p, i) => ({
      id: p.id,
      title: p.title,
      post_date: p.date,
      excerpt: p.excerpt,
      image_url: p.image,
      sort_order: i,
      updated_by: ACTOR,
    }))
  );
}

async function seedPagesAndSeo() {
  console.log("→ pages + SEO");
  const pages = [
    { page_key: "home", name: "Homepage", route: "/website" },
    { page_key: "new-cars", name: "New Cars", route: "/website#cars" },
    { page_key: "used-cars", name: "Used Cars", route: "/website#cars" },
    { page_key: "offers", name: "Offers", route: "/website#offers" },
    { page_key: "sell-your-car", name: "Sell Your Car", route: "/website#sell" },
    { page_key: "service-parts", name: "Service & Parts", route: "/website#service" },
    { page_key: "motability", name: "Motability", route: "/website#motability" },
    { page_key: "about", name: "About Us", route: "/website#about" },
    { page_key: "blog", name: "Blog", route: "/website#blog" },
    { page_key: "contact", name: "Contact Us", route: "/website#contact" },
    { page_key: "shop", name: "Shop", route: "/website#shop" },
  ];
  await upsertMany("website_pages", pages, { onConflict: "page_key" });

  const brandName = siteContent.brand.name;
  const seoEntries = [
    {
      page_key: "home",
      meta_title: `${brandName} - Family-run Suzuki, KGM & Mitsubishi dealer in Kent`,
      meta_description:
        "Humphries & Parks: family-run dealership in West Malling, Kent since 1947. New & used cars, Motability, servicing, MOTs and parts.",
      slug: "/website",
      indexed: true,
    },
    {
      page_key: "new-cars",
      meta_title: `New Cars - ${brandName}`,
      meta_description: "New Suzuki, KGM and Mitsubishi cars with manufacturer offers.",
      slug: "/website#cars",
      indexed: true,
    },
    {
      page_key: "used-cars",
      meta_title: `Used Cars - ${brandName}`,
      meta_description:
        "Quality used cars from Suzuki, KGM and Mitsubishi, each with a 120-point inspection.",
      slug: "/website#cars",
      indexed: true,
    },
    {
      page_key: "offers",
      meta_title: `Offers - ${brandName}`,
      meta_description: "Current manufacturer offers across the Suzuki, KGM and Mitsubishi ranges.",
      slug: "/website#offers",
      indexed: true,
    },
    {
      page_key: "sell-your-car",
      meta_title: `Sell Your Car - ${brandName}`,
      meta_description: "Free home collection. No admin fees. Instant payment.",
      slug: "/website#sell",
      indexed: true,
    },
    {
      page_key: "service-parts",
      meta_title: `Service & Parts - ${brandName}`,
      meta_description:
        "Authorised service agents for Suzuki, KGM and Mitsubishi. Genuine parts, manufacturer-trained technicians.",
      slug: "/website#service",
      indexed: true,
    },
    {
      page_key: "motability",
      meta_title: `Motability - ${brandName}`,
      meta_description: "Five Motability specialists on staff. Available across the Suzuki and KGM ranges.",
      slug: "/website#motability",
      indexed: true,
    },
    {
      page_key: "about",
      meta_title: `About Us - ${brandName}`,
      meta_description: "A Kent dealership built on three generations of trust.",
      slug: "/website#about",
      indexed: true,
    },
    {
      page_key: "blog",
      meta_title: `Blog - ${brandName}`,
      meta_description: "Car-buying guides and dealership news for buyers in Kent.",
      slug: "/website#blog",
      indexed: true,
    },
    {
      page_key: "contact",
      meta_title: `Contact - ${brandName}`,
      meta_description: "Visit Humphries & Parks at 120 London Road, West Malling.",
      slug: "/website#contact",
      indexed: true,
    },
    {
      page_key: "shop",
      meta_title: `Shop - Parts & Accessories - ${brandName}`,
      meta_description: "Genuine Suzuki, KGM and Mitsubishi parts and accessories - shipped UK-wide.",
      slug: "/website#shop",
      indexed: true,
    },
  ];
  await upsertMany("website_seo", seoEntries, { onConflict: "page_key" });
}

async function main() {
  console.log(`Seeding website content from src/singlescroll/data/* into ${supabaseUrl}`);
  await seedSingletons();
  await seedCollections();
  await seedPagesAndSeo();
  console.log("✓ Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
