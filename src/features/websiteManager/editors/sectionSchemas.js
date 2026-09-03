// file location: src/features/websiteManager/editors/sectionSchemas.js
//
// Declarative schema for every editable section of the public /website.
// Each entry describes:
//   - kind        : "singleton" | "collection"
//   - label       : human name for the panel heading
//   - pageKey     : which website_pages.page_key this section belongs to
//   - fields[]    : { name, label, type, ...opts }
//
// The schema drives a single SectionEditor component (./SectionEditor.js)
// so we don't need 18 hand-written form components.
//
// Supported field `type` values:
//   "text"            single-line text
//   "textarea"        multi-line text
//   "url"             single-line text, validated as URL
//   "image_url"       text + 80x80 preview thumbnail
//   "number"          numeric input
//   "select"          dropdown - requires `options: [{value,label}]`
//   "status"          dropdown of published / draft
//   "string_list"     editable list of strings (one per row)
//   "object_list"     editable list of records, schema-defined columns

const CONTENT_SECTION_SCHEMAS = {
  /* ---------------------- singletons ---------------------- */
  brand: {
    kind: "singleton",
    label: "Brand identity",
    pageKey: "home",
    fields: [
      { name: "name", label: "Brand name", type: "text", required: true },
      { name: "logo_url", label: "Logo (dark on light)", type: "image_url" },
      { name: "logo_white_url", label: "Logo (light on dark)", type: "image_url" },
    ],
  },

  hero: {
    kind: "singleton",
    label: "Hero banner",
    pageKey: "home",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "headline", label: "Headline", type: "text", required: true },
      { name: "subhead", label: "Subheading", type: "textarea" },
      { name: "background_url", label: "Background image", type: "image_url" },
      {
        name: "ctas",
        label: "Call-to-action buttons",
        type: "object_list",
        schema: [
          { name: "label", label: "Label", type: "text" },
          { name: "href", label: "Link", type: "text" },
          {
            name: "variant",
            label: "Style",
            type: "select",
            options: [
              { value: "primary", label: "Primary" },
              { value: "ghost", label: "Ghost" },
            ],
          },
        ],
      },
    ],
  },

  about: {
    kind: "singleton",
    label: "About Us",
    pageKey: "about",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Paragraphs", type: "string_list", multiline: true },
      { name: "image_url", label: "Section image", type: "image_url" },
    ],
  },

  "sell-your-car": {
    kind: "singleton",
    label: "Sell Your Car",
    pageKey: "sell-your-car",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text", required: true },
      {
        name: "steps",
        label: "Steps",
        type: "object_list",
        schema: [
          { name: "n", label: "Number", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "body", label: "Body", type: "textarea" },
        ],
      },
      { name: "benefits", label: "Benefits", type: "string_list" },
      { name: "cta_label", label: "CTA label", type: "text" },
      { name: "cta_href", label: "CTA link", type: "text" },
    ],
  },

  "service-parts": {
    kind: "singleton",
    label: "Service & Parts",
    pageKey: "service-parts",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Paragraphs", type: "string_list", multiline: true },
      {
        name: "hours",
        label: "Opening hours",
        type: "object_list",
        schema: [
          { name: "days", label: "Days", type: "text" },
          { name: "time", label: "Time", type: "text" },
        ],
      },
      { name: "image_url", label: "Section image", type: "image_url" },
      { name: "cta_label", label: "CTA label", type: "text" },
      { name: "cta_href", label: "CTA link", type: "text" },
    ],
  },

  motability: {
    kind: "singleton",
    label: "Motability",
    pageKey: "motability",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Paragraphs", type: "string_list", multiline: true },
      { name: "payments", label: "Pricing line", type: "text" },
      {
        name: "range_brands",
        label: "Range by brand",
        type: "object_list",
        schema: [
          { name: "brand", label: "Brand", type: "text" },
          { name: "models", label: "Models (comma-separated)", type: "csv_to_array" },
        ],
      },
      { name: "cta_label", label: "CTA label", type: "text" },
      { name: "cta_href", label: "CTA link", type: "text" },
    ],
  },

  "parts-content": {
    kind: "singleton",
    label: "Parts & Accessories",
    pageKey: "service-parts",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Paragraphs", type: "string_list", multiline: true },
      {
        name: "brands",
        label: "Parts brands",
        type: "object_list",
        schema: [
          { name: "name", label: "Brand", type: "text" },
          { name: "note", label: "Note", type: "text" },
        ],
      },
      { name: "cta_label", label: "CTA label", type: "text" },
      { name: "cta_href", label: "CTA link", type: "text" },
    ],
  },

  contact: {
    kind: "singleton",
    label: "Contact",
    pageKey: "contact",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text" },
      { name: "phone_href", label: "Phone link (tel:...)", type: "text" },
      { name: "address", label: "Address lines", type: "string_list" },
      {
        name: "sales_hours",
        label: "Sales hours",
        type: "object_list",
        schema: [
          { name: "days", label: "Days", type: "text" },
          { name: "time", label: "Time", type: "text" },
        ],
      },
      {
        name: "service_hours",
        label: "Service hours",
        type: "object_list",
        schema: [
          { name: "days", label: "Days", type: "text" },
          { name: "time", label: "Time", type: "text" },
        ],
      },
      {
        name: "socials",
        label: "Social links",
        type: "object_list",
        schema: [
          { name: "label", label: "Label", type: "text" },
          { name: "href", label: "URL", type: "text" },
        ],
      },
      { name: "map_embed", label: "Embedded map URL", type: "url" },
    ],
  },

  footer: {
    kind: "singleton",
    label: "Footer",
    pageKey: "home",
    fields: [
      { name: "legal_links", label: "Legal link labels", type: "string_list" },
      { name: "fca_reg", label: "FCA registration", type: "text" },
      { name: "credit_disclosure", label: "Credit disclosure", type: "textarea" },
    ],
  },

  /* ---------------------- collections --------------------- */
  "trust-points": {
    kind: "collection",
    label: "Trust highlights",
    pageKey: "home",
    rowLabel: (r) => `${r.value || ""} ${r.label || ""}`.trim() || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "value", label: "Value", type: "text", required: true },
      { name: "label", label: "Label", type: "text", required: true },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  "partner-brands": {
    kind: "collection",
    label: "Partner brand logos",
    pageKey: "home",
    rowLabel: (r) => r.name || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "logo_url", label: "Logo", type: "image_url", required: true },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  ratings: {
    kind: "collection",
    label: "Review ratings",
    pageKey: "home",
    rowLabel: (r) => `${r.source || r.id}: ${r.score || ""}`,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "source", label: "Source", type: "text", required: true },
      { name: "score", label: "Score", type: "text", required: true },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  vehicles: {
    kind: "collection",
    label: "Featured vehicles",
    pageKey: "new-cars",
    rowLabel: (r) => `${r.brand || ""} ${r.model || ""}`.trim() || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      {
        name: "vehicle_type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "new", label: "New" },
          { value: "used", label: "Used" },
        ],
      },
      { name: "brand", label: "Brand", type: "text", required: true },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "year", label: "Year", type: "number" },
      { name: "price_text", label: "Price (text)", type: "text" },
      { name: "miles", label: "Mileage", type: "text" },
      { name: "badge", label: "Badge", type: "text" },
      { name: "image_url", label: "Image", type: "image_url" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  offers: {
    kind: "collection",
    label: "Manufacturer offers",
    pageKey: "offers",
    rowLabel: (r) => r.title || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "headline", label: "Headline", type: "text", required: true },
      { name: "body", label: "Body", type: "textarea" },
      { name: "image_url", label: "Image", type: "image_url" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  reviews: {
    kind: "collection",
    label: "Customer reviews",
    pageKey: "home",
    rowLabel: (r) => `${r.customer_name || r.id} (${r.source || ""})`,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "customer_name", label: "Customer name", type: "text", required: true },
      { name: "rating", label: "Rating (1-5)", type: "number", required: true },
      { name: "source", label: "Source", type: "text", required: true },
      { name: "review_date", label: "Date (text)", type: "text" },
      { name: "quote", label: "Quote", type: "textarea", required: true },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  "team-departments": {
    kind: "collection",
    label: "Team departments",
    pageKey: "about",
    rowLabel: (r) => r.label || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "label", label: "Label", type: "text", required: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },

  "team-members": {
    kind: "collection",
    label: "Team members",
    pageKey: "about",
    rowLabel: (r) => r.name || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "text" },
      { name: "department_id", label: "Department ID", type: "text" },
      { name: "photo_url", label: "Photo", type: "image_url" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  timeline: {
    kind: "collection",
    label: "Timeline",
    pageKey: "about",
    rowLabel: (r) => `${r.year || ""} ${r.title || ""}`.trim() || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "year", label: "Year", type: "text", required: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Body", type: "textarea" },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },

  "blog-posts": {
    kind: "collection",
    label: "Blog posts",
    pageKey: "blog",
    rowLabel: (r) => r.title || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "post_date", label: "Date", type: "text" },
      { name: "excerpt", label: "Excerpt", type: "textarea" },
      { name: "body", label: "Body", type: "textarea" },
      { name: "image_url", label: "Image", type: "image_url" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },
};

/* ==========================================================================
   Site-builder schemas
   --------------------------------------------------------------------------
   These three do NOT belong to a website page — they describe the site
   chrome itself (top bar, block running order, visual design), which is why
   they carry `builder: true` and are excluded from SECTIONS_BY_PAGE. They
   drive the Top bar / Sections / Design tabs of the Website Manager and are
   backed by the tables added in
   supabase/migrations/20260901120000_website_builder_nav_design_layout.sql.
   ========================================================================== */

// Anchors offered by the "Links to" dropdown. Every id here must exist as a
// section id in WebsitePage's BLOCK_ORDER, or the link scrolls nowhere.
export const NAV_TARGETS = [
  { value: "#top", label: "Top of page" },
  { value: "#cars", label: "Cars" },
  { value: "#offers", label: "Offers" },
  { value: "#shop", label: "Shop" },
  { value: "#sell", label: "Sell Your Car" },
  { value: "#service", label: "Service & Parts" },
  { value: "#motability", label: "Motability" },
  { value: "#about", label: "About Us" },
  { value: "#reviews", label: "Reviews" },
  { value: "#team", label: "Meet the team" },
  { value: "#blog", label: "Blog" },
  { value: "#contact", label: "Contact" },
  { value: "/website/shop", label: "Shop page (/website/shop)" },
  { value: "/website/login", label: "Customer login" },
  { value: "/website/profile", label: "Customer profile" },
];

export const BUILDER_SCHEMAS = {
  nav: {
    kind: "collection",
    builder: true,
    label: "Top bar links",
    rowLabel: (r) => r.label || r.id,
    fields: [
      { name: "id", label: "ID", type: "text", required: true, idField: true },
      { name: "label", label: "Link text", type: "text", required: true },
      { name: "href", label: "Links to", type: "select", required: true, options: NAV_TARGETS },
      {
        name: "filter",
        label: "Pre-filter the car list",
        type: "select",
        options: [
          { value: "", label: "No filter" },
          { value: "new", label: "New cars only" },
          { value: "used", label: "Used cars only" },
        ],
      },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  "section-layout": {
    kind: "collection",
    builder: true,
    label: "Page sections",
    rowLabel: (r) => r.label || r.id,
    fields: [
      { name: "id", label: "Block key", type: "text", required: true, idField: true },
      { name: "label", label: "Name (staff only)", type: "text", required: true },
      { name: "anchor", label: "Anchor id", type: "text" },
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Heading", type: "text" },
      { name: "lead", label: "Intro paragraph", type: "textarea" },
      { name: "tint", label: "Tinted background", type: "boolean" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "status" },
    ],
  },

  design: {
    kind: "singleton",
    builder: true,
    label: "Site design",
    fields: [
      { name: "accent_hex", label: "Accent colour", type: "color" },
      { name: "accent_hover_hex", label: "Accent colour (hover)", type: "color" },
      {
        name: "default_theme",
        label: "Default colour mode",
        type: "select",
        options: [
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
        ],
      },
      {
        name: "container_width",
        label: "Content width",
        type: "select",
        options: [
          { value: "1040px", label: "Narrow (1040px)" },
          { value: "1200px", label: "Standard (1200px)" },
          { value: "1360px", label: "Wide (1360px)" },
          { value: "100%", label: "Full bleed" },
        ],
      },
      {
        name: "section_spacing",
        label: "Section spacing",
        type: "select",
        options: [
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Comfortable" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      {
        name: "corner_radius",
        label: "Card corners",
        type: "select",
        options: [
          { value: "0px", label: "Square" },
          { value: "8px", label: "Slight" },
          { value: "18px", label: "Rounded" },
          { value: "28px", label: "Very rounded" },
        ],
      },
      {
        name: "button_radius",
        label: "Button shape",
        type: "select",
        options: [
          { value: "6px", label: "Square" },
          { value: "14px", label: "Rounded" },
          { value: "999px", label: "Pill" },
        ],
      },
      {
        name: "heading_font",
        label: "Heading font",
        type: "select",
        options: [
          { value: "system", label: "Match body font" },
          { value: "serif", label: "Serif" },
          { value: "mono", label: "Monospace" },
        ],
      },
      { name: "nav_height", label: "Top bar height", type: "text" },
      { name: "logo_height", label: "Logo height", type: "text" },
      { name: "nav_sticky", label: "Top bar sticks on scroll", type: "boolean" },
      { name: "show_nav_phone", label: "Show phone number in top bar", type: "boolean" },
      { name: "show_nav_account", label: "Show login / account in top bar", type: "boolean" },
      { name: "show_brand_strip", label: "Show partner brand strip", type: "boolean" },
    ],
  },
};

export const SECTION_SCHEMAS = { ...CONTENT_SECTION_SCHEMAS, ...BUILDER_SCHEMAS };

// Page -> sections grouping for the manager UI. Builder schemas are excluded:
// they describe site chrome, not the content of any one website page.
export const SECTIONS_BY_PAGE = (() => {
  const out = {};
  for (const [section, schema] of Object.entries(CONTENT_SECTION_SCHEMAS)) {
    if (!out[schema.pageKey]) out[schema.pageKey] = [];
    out[schema.pageKey].push(section);
  }
  return out;
})();
