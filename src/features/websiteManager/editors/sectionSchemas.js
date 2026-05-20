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

export const SECTION_SCHEMAS = {
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

// Page -> sections grouping for the manager UI.
export const SECTIONS_BY_PAGE = (() => {
  const out = {};
  for (const [section, schema] of Object.entries(SECTION_SCHEMAS)) {
    if (!out[schema.pageKey]) out[schema.pageKey] = [];
    out[schema.pageKey].push(section);
  }
  return out;
})();
