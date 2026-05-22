// file location: src/features/presentation/slides/definitions/websiteShop.js
//
// Presentation overlays for the public /website#shop block and the four
// checkout sub-pages. Visible to staff who manage the shop (so they can
// preview the customer journey from inside the presentation deck).

const SHOP_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

// The customer-facing shop is also part of the customer presentation deck.
const SHOP_VIEW_ROLES = [...SHOP_ROLES, "customer"];

export const websiteShopSlide = {
  id: "website-shop",
  route: "/website#shop",
  title: "Public Shop — Parts & Accessories",
  roles: SHOP_VIEW_ROLES,
  workflowIndex: 146,
  steps: [
    {
      kind: "main",
      anchor: "[data-presentation=\"website-shop-products\"]",
      position: "center",
      title: "Parts & accessories store",
      body: "Customers browse genuine Suzuki, KGM and Mitsubishi parts directly on the marketing page, filter by category, and add items to a persistent cart.",
    },
    {
      kind: "feature",
      anchor: "[data-presentation=\"website-shop-filters\"]",
      position: "bottom-right",
      title: "Cart persists between visits",
      body: "The cart is stored locally so customers can come back later and finish checking out without losing what they selected.",
    },
  ],
};

export const websiteShopCartSlide = {
  id: "website-shop-cart",
  route: "/website/shop/cart",
  title: "Shop — Cart Review",
  roles: SHOP_VIEW_ROLES,
  workflowIndex: 147,
  steps: [
    {
      kind: "main",
      anchor: "[data-presentation=\"website-shop-content\"]",
      position: "center",
      title: "Review the basket",
      body: "Customers can adjust quantities, remove items and see a live subtotal before moving to checkout.",
    },
  ],
};

export const websiteShopCheckoutSlide = {
  id: "website-shop-checkout",
  route: "/website/shop/checkout",
  title: "Shop — Checkout",
  roles: SHOP_VIEW_ROLES,
  workflowIndex: 148,
  steps: [
    {
      kind: "main",
      anchor: "[data-presentation=\"website-shop-content\"]",
      position: "center",
      title: "Contact + shipping",
      body: "Customer details and address are captured, then the order is created in our database and the customer is redirected to Stripe Checkout for payment.",
    },
    {
      kind: "feature",
      anchor: "[data-presentation=\"website-shop-content\"]",
      position: "bottom-left",
      title: "Card details never touch our servers",
      body: "Payment is handled entirely by Stripe — we only receive a confirmation webhook and a Stripe payment-intent reference.",
    },
  ],
};

export const websiteShopSuccessSlide = {
  id: "website-shop-success",
  route: "/website/shop/success",
  title: "Shop — Order Confirmed",
  roles: SHOP_VIEW_ROLES,
  workflowIndex: 149,
  steps: [
    {
      kind: "main",
      anchor: "[data-presentation=\"website-shop-content\"]",
      position: "center",
      title: "Order received",
      body: "Stripe redirects the customer here on success. We display the order reference and clear the cart; the webhook (running in parallel) marks the order paid and decrements stock.",
    },
  ],
};

export const websiteShopCancelSlide = {
  id: "website-shop-cancel",
  route: "/website/shop/cancel",
  title: "Shop — Checkout Cancelled",
  roles: SHOP_VIEW_ROLES,
  workflowIndex: 149.5,
  steps: [
    {
      kind: "main",
      anchor: "[data-presentation=\"website-shop-content\"]",
      position: "center",
      title: "Checkout abandoned",
      body: "If the customer backs out of Stripe Checkout they land here. The pending order is preserved (status = pending_payment) and the cart is left intact so they can finish later.",
    },
  ],
};

// Deep links into the manager (?tab=preview / ?tab=shop) get their own slide
// entries so the sidebar buttons can navigate through the presentation deck.
export const staffWebsiteLivePreviewSlide = {
  id: "staff-website-live-preview",
  route: "/staff/website-manager?tab=preview",
  title: "Website Live Preview",
  roles: SHOP_ROLES,
  workflowIndex: 142,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "What customers see, in real time",
      body: "The /website customer website page is embedded in an iframe so staff can preview the live customer experience without leaving the dashboard.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Click any section to edit",
      body: "Each editable region of the page lists below the preview with an Edit button that jumps straight to its typed editor in the Page Content tab.",
    },
  ],
};

export const staffWebsiteShopSlide = {
  id: "staff-website-shop",
  route: "/staff/website-manager?tab=shop",
  title: "Website Shop Management",
  roles: SHOP_ROLES,
  workflowIndex: 143,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Products, categories and orders",
      body: "Staff add, edit and publish parts; group them into categories; and process customer orders all from this panel.",
    },
    {
      kind: "feature",
      position: "right",
      title: "Stock is tracked here",
      body: "Each product has a live stock_qty field that the checkout webhook decrements automatically when an order is paid.",
    },
  ],
};
