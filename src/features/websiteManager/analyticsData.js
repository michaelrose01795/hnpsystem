// file location: src/features/websiteManager/analyticsData.js
// Data for the Website Manager — Website Analytics / Customer Behaviour area.
//
// There is NO analytics/tracking backend. No page-view, session, search,
// enquiry or login events are recorded anywhere (checked
// src/lib/database/schema/schemaReference.sql — only website-CONTENT concepts
// exist). Rather than invent figures, every analytics SECTION renders an
// honest "tracking not connected" empty state (see panels/analytics/*).
//
// The only real, non-fabricated data here is the automation roadmap below —
// the planned content-automation features, which are deliberately
// informational.
//
// Backend wiring plan (when analytics tracking is built):
//   TODO: create analytics tables (website_page_views, website_sessions,
//         website_search_events, website_enquiries, website_account_events,
//         website_stock_stats, website_content_audit) in Supabase.
//   TODO: add query helpers in src/lib/database/websiteAnalytics.js.
//   TODO: expose read-only API routes under /api/website/analytics/* — these
//         must be staff-auth gated (getUserFromRequest) and MUST NOT be
//         reachable from the public /website pages.
// Each analytics section names the exact endpoint it expects.

// Content-automation roadmap. None of these features are built — this is a
// planned-work list, not a control panel, so it carries no fabricated metrics.
export const AUTOMATION_ROADMAP = [
  { id: "auto-1", title: "Auto-upload new cars for sale", detail: "Publish new adverts to /website automatically from dealership stock data.", status: "planned" },
  { id: "auto-2", title: "Auto-remove sold vehicles", detail: "Pull adverts from /website as soon as a vehicle is marked sold.", status: "planned" },
  { id: "auto-3", title: "Auto-sync images, price, mileage & spec", detail: "Keep advert images, pricing and specification in step with the stock record.", status: "in design" },
  { id: "auto-4", title: "Auto-create advert descriptions", detail: "Generate first-draft advert copy from a vehicle's specification.", status: "exploring" },
  { id: "auto-5", title: "Auto-suggest price changes", detail: "Recommend price adjustments for adverts showing low interest.", status: "exploring" },
  { id: "auto-6", title: "Auto-flag stale adverts", detail: "Highlight adverts that have been listed too long with little engagement.", status: "in design" },
  { id: "auto-7", title: "Auto-generate offer banners", detail: "Build promotional banner artwork from current offers.", status: "exploring" },
  { id: "auto-8", title: "Auto-post vehicles to social media", detail: "Schedule selected vehicles to post to social channels.", status: "later" },
  { id: "auto-9", title: "Auto-create blog / news posts", detail: "Draft blog and news articles from dealership updates.", status: "later" },
];
