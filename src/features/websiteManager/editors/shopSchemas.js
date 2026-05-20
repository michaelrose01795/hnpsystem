// file location: src/features/websiteManager/editors/shopSchemas.js
//
// Field schemas for the staff Shop panel (products + categories). Uses the
// same SectionEditor as the website-content editors.

export const PRODUCT_SCHEMA = {
  kind: "collection",
  label: "Product",
  fields: [
    { name: "id", label: "ID", type: "text", required: true, idField: true },
    { name: "category_id", label: "Category ID", type: "text" },
    { name: "sku", label: "SKU", type: "text" },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "slug", label: "Slug", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea" },
    {
      name: "price_pence",
      label: "Price (pence)",
      type: "number",
      required: true,
    },
    {
      name: "compare_at_price_pence",
      label: "Compare-at price (pence)",
      type: "number",
    },
    { name: "image_url", label: "Image", type: "image_url" },
    { name: "stock_qty", label: "Stock qty", type: "number" },
    {
      name: "fit_brands",
      label: "Fits brands (comma-separated)",
      type: "csv_to_array",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ],
    },
    { name: "sort_order", label: "Order", type: "number" },
  ],
};

export const CATEGORY_SCHEMA = {
  kind: "collection",
  label: "Category",
  fields: [
    { name: "id", label: "ID", type: "text", required: true, idField: true },
    { name: "slug", label: "Slug", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "sort_order", label: "Order", type: "number" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  ],
};

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "fulfilling",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
];
