// file location: src/lib/database/website.js
//
// Database helper for the public /website single-scroll marketing page AND the
// staff /staff/website-manager CMS. Backs every website_* table defined in the
// 20260520120000_add_website_content_and_shop migration.
//
// Shape contract:
//   getWebsiteContent() returns a tree that matches what src/singlescroll/data/*
//   has historically exported. WebsitePage.js can switch between the static
//   modules and this fetcher without changing how it reads fields.
//
// Server / client awareness:
//   We import the shared `supabase` export from supabaseClient.js. On the
//   server it resolves to the service-role client (RLS bypassed); in the
//   browser it resolves to the anon client (which has only the SELECT
//   policies created by the migration). Writes therefore only succeed
//   from a server context (API routes).

import { supabase } from "@/lib/database/supabaseClient";

/* ============================================================================
   READ HELPERS
============================================================================ */

const orderedSelect = async (table, { extraSelect } = {}) => {
  const select = extraSelect || "*";
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error(`[website] ${table} read error:`, error.message);
    return [];
  }
  return data || [];
};

const singletonSelect = async (table) => {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    console.error(`[website] ${table} singleton read error:`, error.message);
    return null;
  }
  return data || null;
};

/* ----------------------------------------------------------------------------
   Singleton getters — one row each, keyed by id='default'
---------------------------------------------------------------------------- */

export const getBrand = () => singletonSelect("website_brand");
export const getHero = () => singletonSelect("website_hero");
export const getAbout = () => singletonSelect("website_about");
export const getSellYourCar = () => singletonSelect("website_sell_your_car");
export const getServiceParts = () => singletonSelect("website_service_parts");
export const getMotability = () => singletonSelect("website_motability");
export const getPartsContent = () => singletonSelect("website_parts_content");
export const getContact = () => singletonSelect("website_contact");
export const getFooter = () => singletonSelect("website_footer");

/* ----------------------------------------------------------------------------
   Collection getters — published rows only for the public /website read
---------------------------------------------------------------------------- */

const publishedOnly = async (table) => {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error(`[website] ${table} published read error:`, error.message);
    return [];
  }
  return data || [];
};

export const getTrustPoints = () => publishedOnly("website_trust_points");
export const getPartnerBrands = () => publishedOnly("website_partner_brands");
export const getRatings = () => publishedOnly("website_ratings");
export const getVehicles = () => publishedOnly("website_vehicles");
export const getOffers = () => publishedOnly("website_offers");
export const getReviews = () => publishedOnly("website_reviews");
export const getBlogPosts = () => publishedOnly("website_blog_posts");

// Team is two tables: departments + members. Returned as a list of departments
// each with its members nested, matching how WebsitePage.js renders them.
export const getTeam = async () => {
  const [{ data: depts, error: dErr }, { data: members, error: mErr }] =
    await Promise.all([
      supabase.from("website_team_departments").select("*").order("sort_order"),
      supabase
        .from("website_team_members")
        .select("*")
        .eq("status", "published")
        .order("sort_order"),
    ]);
  if (dErr) console.error("[website] team departments read error:", dErr.message);
  if (mErr) console.error("[website] team members read error:", mErr.message);
  return { departments: depts || [], members: members || [] };
};

// Timeline is a collection but every row is always public — no status filter.
export const getTimeline = async () => orderedSelect("website_timeline");

/* ----------------------------------------------------------------------------
   Full content tree — single round-trip bundle for WebsitePage
---------------------------------------------------------------------------- */
//
// Shape mirrors what src/singlescroll/data/* used to export so WebsitePage.js
// can swap its imports for one call to this without changing field access.
//
//   siteContent : { brand, hero, trustPoints, ratings, about, serviceAndParts,
//                   motability, sellYourCar, contact, footer, partsContent }
//   vehicles    : []
//   offers      : []
//   reviews     : []
//   timeline    : []
//   blogPosts   : []
//   brands      : []          // partner-brand strip
//   team        : []          // flat list, members carry .department
//   teamDepartments : []

export const getWebsiteContent = async () => {
  const [
    brand,
    hero,
    trustPoints,
    ratings,
    about,
    serviceParts,
    motability,
    sellYourCar,
    partsContent,
    contact,
    footer,
    partnerBrands,
    vehicles,
    offers,
    reviews,
    blogPosts,
    timeline,
    team,
  ] = await Promise.all([
    getBrand(),
    getHero(),
    getTrustPoints(),
    getRatings(),
    getAbout(),
    getServiceParts(),
    getMotability(),
    getSellYourCar(),
    getPartsContent(),
    getContact(),
    getFooter(),
    getPartnerBrands(),
    getVehicles(),
    getOffers(),
    getReviews(),
    getBlogPosts(),
    getTimeline(),
    getTeam(),
  ]);

  return {
    siteContent: {
      brand: brand || {},
      hero: heroOut(hero),
      trustPoints: trustPoints.map((t) => ({ value: t.value, label: t.label })),
      ratings: ratings.map((r) => ({ source: r.source, score: r.score })),
      about: aboutOut(about),
      serviceAndParts: serviceOut(serviceParts),
      motability: motabilityOut(motability),
      sellYourCar: sellOut(sellYourCar),
      partsContent: partsOut(partsContent),
      contact: contactOut(contact),
      footer: footerOut(footer),
    },
    vehicles: vehicles.map(vehicleOut),
    offers: offers.map(offerOut),
    reviews: reviews.map(reviewOut),
    timeline: timeline.map(timelineOut),
    blogPosts: blogPosts.map(blogOut),
    brands: partnerBrands.map((b) => ({ name: b.name, logo: b.logo_url })),
    team: team.members.map(memberOut),
    teamDepartments: team.departments.map((d) => ({ id: d.id, label: d.label })),
  };
};

/* ----------------------------------------------------------------------------
   Row -> render-shape mappers (DB column names -> the field names WebsitePage
   has been reading from the static modules). Kept inline so the shape contract
   is right next to the query.
---------------------------------------------------------------------------- */

const heroOut = (h) =>
  h
    ? {
        eyebrow: h.eyebrow,
        headline: h.headline,
        subhead: h.subhead,
        backgroundUrl: h.background_url,
        ctas: h.ctas || [],
      }
    : null;

const aboutOut = (a) =>
  a
    ? {
        eyebrow: a.eyebrow,
        title: a.title,
        body: a.body || [],
        imageUrl: a.image_url,
      }
    : null;

const serviceOut = (s) =>
  s
    ? {
        eyebrow: s.eyebrow,
        title: s.title,
        body: s.body || [],
        hours: s.hours || [],
        imageUrl: s.image_url,
        cta: { label: s.cta_label, href: s.cta_href },
      }
    : null;

const motabilityOut = (m) =>
  m
    ? {
        eyebrow: m.eyebrow,
        title: m.title,
        body: m.body || [],
        payments: m.payments,
        rangeBrands: m.range_brands || [],
        cta: { label: m.cta_label, href: m.cta_href },
      }
    : null;

const sellOut = (s) =>
  s
    ? {
        eyebrow: s.eyebrow,
        title: s.title,
        steps: s.steps || [],
        benefits: s.benefits || [],
        cta: { label: s.cta_label, href: s.cta_href },
      }
    : null;

const partsOut = (p) =>
  p
    ? {
        eyebrow: p.eyebrow,
        title: p.title,
        body: p.body || [],
        brands: p.brands || [],
        cta: { label: p.cta_label, href: p.cta_href },
      }
    : null;

const contactOut = (c) =>
  c
    ? {
        eyebrow: c.eyebrow,
        title: c.title,
        phone: c.phone,
        phoneHref: c.phone_href,
        address: c.address || [],
        salesHours: c.sales_hours || [],
        serviceHours: c.service_hours || [],
        socials: c.socials || [],
        mapEmbed: c.map_embed,
      }
    : null;

const footerOut = (f) =>
  f
    ? {
        legal: f.legal_links || [],
        fcaReg: f.fca_reg,
        creditDisclosure: f.credit_disclosure,
      }
    : null;

const vehicleOut = (v) => ({
  id: v.id,
  type: v.vehicle_type,
  brand: v.brand,
  model: v.model,
  year: v.year,
  price: v.price_text,
  miles: v.miles,
  badge: v.badge,
  image: v.image_url,
});

const offerOut = (o) => ({
  id: o.id,
  title: o.title,
  headline: o.headline,
  body: o.body,
  image: o.image_url,
});

const reviewOut = (r) => ({
  id: r.id,
  name: r.customer_name,
  rating: r.rating,
  source: r.source,
  date: r.review_date,
  quote: r.quote,
});

const timelineOut = (t) => ({
  year: t.year,
  title: t.title,
  body: t.body,
});

const blogOut = (p) => ({
  id: p.id,
  title: p.title,
  date: p.post_date,
  excerpt: p.excerpt,
  body: p.body,
  image: p.image_url,
});

const memberOut = (m) => ({
  id: m.id,
  name: m.name,
  role: m.role,
  department: m.department_id,
  photo: m.photo_url,
});

/* ============================================================================
   WRITE HELPERS
   ----------------------------------------------------------------------------
   Called by the staff API routes only. On the server, `supabase` resolves to
   the service-role client (the supabaseClient module promotes it). On the
   client these will fail RLS by design.
============================================================================ */

const stampUpdater = (actor) => ({
  updated_by: actor || null,
  updated_at: new Date().toISOString(),
});

export const upsertSingleton = async (table, patch, actor) => {
  const row = { id: "default", ...patch, ...stampUpdater(actor) };
  const { data, error } = await supabase
    .from(table)
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error(`[website] ${table} upsert error:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
};

export const upsertRow = async (table, row, actor) => {
  const payload = { ...row, ...stampUpdater(actor) };
  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error(`[website] ${table} upsert row error:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
};

export const deleteRow = async (table, id) => {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    console.error(`[website] ${table} delete error:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
};

export const reorderRows = async (table, idsInOrder, actor) => {
  // Update sort_order to match the given array order in a single round-trip.
  if (!Array.isArray(idsInOrder) || idsInOrder.length === 0) return { ok: true };
  const stamp = stampUpdater(actor);
  const rows = idsInOrder.map((id, idx) => ({
    id,
    sort_order: idx,
    ...stamp,
  }));
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(`[website] ${table} reorder error:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
};

/* ----------------------------------------------------------------------------
   Page status + activity log
---------------------------------------------------------------------------- */

export const getPages = async () => {
  const { data, error } = await supabase
    .from("website_pages")
    .select("*")
    .order("page_key");
  if (error) {
    console.error("[website] pages read error:", error.message);
    return [];
  }
  return data || [];
};

export const touchPage = async (pageKey, actor) => {
  const { error } = await supabase
    .from("website_pages")
    .update({
      last_edited_by: actor || null,
      last_edited_at: new Date().toISOString(),
    })
    .eq("page_key", pageKey);
  if (error) console.error("[website] touchPage error:", error.message);
};

export const setPageStatus = async (pageKey, status, actor) => {
  const { data, error } = await supabase
    .from("website_pages")
    .update({
      status,
      last_edited_by: actor || null,
      last_edited_at: new Date().toISOString(),
    })
    .eq("page_key", pageKey)
    .select()
    .single();
  if (error) {
    console.error("[website] setPageStatus error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
};

export const logActivity = async ({ actor, action, target, pageKey }) => {
  const { error } = await supabase.from("website_activity").insert({
    actor: actor || null,
    action,
    target,
    page_key: pageKey || null,
  });
  if (error) console.error("[website] logActivity error:", error.message);
};

export const getRecentActivity = async (limit = 50) => {
  const { data, error } = await supabase
    .from("website_activity")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[website] activity read error:", error.message);
    return [];
  }
  return data || [];
};

/* ----------------------------------------------------------------------------
   SEO
---------------------------------------------------------------------------- */

export const getSeoEntries = async () => {
  const { data, error } = await supabase.from("website_seo").select("*");
  if (error) {
    console.error("[website] seo read error:", error.message);
    return [];
  }
  return data || [];
};

export const updateSeo = async (pageKey, patch, actor) => {
  const { data, error } = await supabase
    .from("website_seo")
    .upsert(
      { page_key: pageKey, ...patch, ...stampUpdater(actor) },
      { onConflict: "page_key" }
    )
    .select()
    .single();
  if (error) {
    console.error("[website] updateSeo error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
};

/* ----------------------------------------------------------------------------
   Media library
---------------------------------------------------------------------------- */

export const getMedia = async () => {
  const { data, error } = await supabase
    .from("website_media")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("[website] media read error:", error.message);
    return [];
  }
  return data || [];
};

export const upsertMedia = async (asset) => {
  const { data, error } = await supabase
    .from("website_media")
    .upsert(asset, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("[website] upsertMedia error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
};

export const deleteMedia = async (id) => {
  const { error } = await supabase.from("website_media").delete().eq("id", id);
  if (error) {
    console.error("[website] deleteMedia error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
};

/* ----------------------------------------------------------------------------
   Section <-> table name map (used by API routes + manager UI)
---------------------------------------------------------------------------- */

export const SECTION_TABLES = {
  brand: { table: "website_brand", kind: "singleton" },
  hero: { table: "website_hero", kind: "singleton" },
  about: { table: "website_about", kind: "singleton" },
  "sell-your-car": { table: "website_sell_your_car", kind: "singleton" },
  "service-parts": { table: "website_service_parts", kind: "singleton" },
  motability: { table: "website_motability", kind: "singleton" },
  "parts-content": { table: "website_parts_content", kind: "singleton" },
  contact: { table: "website_contact", kind: "singleton" },
  footer: { table: "website_footer", kind: "singleton" },
  "trust-points": { table: "website_trust_points", kind: "collection" },
  "partner-brands": { table: "website_partner_brands", kind: "collection" },
  ratings: { table: "website_ratings", kind: "collection" },
  vehicles: { table: "website_vehicles", kind: "collection" },
  offers: { table: "website_offers", kind: "collection" },
  reviews: { table: "website_reviews", kind: "collection" },
  "team-departments": { table: "website_team_departments", kind: "collection" },
  "team-members": { table: "website_team_members", kind: "collection" },
  timeline: { table: "website_timeline", kind: "collection" },
  "blog-posts": { table: "website_blog_posts", kind: "collection" },
};
