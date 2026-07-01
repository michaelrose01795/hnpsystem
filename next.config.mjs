// Help & Diagnostics — Phase 5 (code-state pinning). Resolve the deployed code
// state from Vercel's build-time git env (falling back to any explicitly-set
// NEXT_PUBLIC_* override, then a safe default) so every support report can be
// stamped with the exact commit it was captured against. These values are
// NON-SECRET deploy metadata only — never tokens, keys, or cookies. They are
// read once here at build time and inlined into the client bundle via `env`.
const gitEnv = process.env; // Build-time environment (Vercel injects VERCEL_GIT_* here)
const COMMIT_SHA =
  gitEnv.NEXT_PUBLIC_COMMIT_SHA || gitEnv.VERCEL_GIT_COMMIT_SHA || ""; // Full deployed commit SHA
const COMMIT_REF =
  gitEnv.NEXT_PUBLIC_COMMIT_REF || gitEnv.VERCEL_GIT_COMMIT_REF || ""; // Branch / tag deployed
const APP_VERSION =
  gitEnv.NEXT_PUBLIC_APP_VERSION ||
  gitEnv.npm_package_version ||
  (COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : "dev"); // Human-facing version label
const DEPLOY_ENV =
  gitEnv.NEXT_PUBLIC_DEPLOY_ENV || gitEnv.VERCEL_ENV || "development"; // production | preview | development
const DEPLOY_URL =
  gitEnv.NEXT_PUBLIC_DEPLOY_URL || gitEnv.VERCEL_URL || ""; // Deployment host (no scheme)
// Build id is deterministic from the commit when available so the same commit
// always maps to the same buildId (used by generateBuildId below + stamping).
const BUILD_ID =
  gitEnv.NEXT_PUBLIC_BUILD_ID || (COMMIT_SHA ? COMMIT_SHA.slice(0, 12) : ""); // Next buildId seed
// Timestamp of THIS build. Set explicitly in CI for reproducibility; otherwise
// stamped at config-eval time. Non-secret.
const DEPLOYED_AT = gitEnv.NEXT_PUBLIC_DEPLOYED_AT || new Date().toISOString(); // ISO build time
// Hash of the dev-layout section source map that shipped in THIS build, so a
// captured report's file:line can be verified against / drift-detected from the
// deployed map. Populated by the source-map generator in CI (safe default "").
const SECTION_MAP_HASH = gitEnv.NEXT_PUBLIC_SECTION_MAP_HASH || ""; // Deployed section-map hash

const nextConfig = { // Exported Next.js configuration object
  reactStrictMode: true, // Enable React strict mode for highlighting potential issues
  devIndicators: false, // Disable the Next.js dev tools indicator overlay for this project

  turbopack: {}, // CRITICAL FIX: Add empty turbopack config to silence Next.js 16 error and enable Turbopack by default

  // Pin Next's buildId to the deployed commit when known so client-captured
  // diagnostics and the served bundle share one identifier (else Next's random id).
  generateBuildId: async () => BUILD_ID || null, // null → Next falls back to its default
  
  images: { // Configure remote image domains
    remotePatterns: [ // Allow generic HTTPS image sources
      { // Single wildcard rule
        protocol: "https", // Permit only HTTPS protocol
        hostname: "**", // Accept any remote hostname
      }, // Close remote pattern object
    ], // Close remotePatterns array
  }, // Close images config
  
  env: { // Surface selected environment variables to the client bundle
    NEXT_PUBLIC_KEYCLOAK_URL: process.env.NEXT_PUBLIC_KEYCLOAK_URL, // Keycloak base URL
    NEXT_PUBLIC_KEYCLOAK_REALM: process.env.NEXT_PUBLIC_KEYCLOAK_REALM, // Keycloak realm identifier
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID, // Client ID for Keycloak auth
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "", // Fallback to empty string for optional API URL
    // Help & Diagnostics (Phase 5) — deployed code-state metadata (non-secret).
    // Consumed by src/lib/support/buildInfo.js → the support diagnostics `build`.
    NEXT_PUBLIC_APP_VERSION: APP_VERSION, // Human-facing version label
    NEXT_PUBLIC_COMMIT_SHA: COMMIT_SHA, // Full deployed commit SHA
    NEXT_PUBLIC_COMMIT_REF: COMMIT_REF, // Deployed branch / tag
    NEXT_PUBLIC_BUILD_ID: BUILD_ID, // Deterministic build id (commit-derived)
    NEXT_PUBLIC_DEPLOY_ENV: DEPLOY_ENV, // production | preview | development
    NEXT_PUBLIC_DEPLOY_URL: DEPLOY_URL, // Deployment host (no scheme)
    NEXT_PUBLIC_DEPLOYED_AT: DEPLOYED_AT, // ISO build timestamp
    NEXT_PUBLIC_SECTION_MAP_HASH: SECTION_MAP_HASH, // Deployed section-map hash (for drift detection)
  }, // Close env block

  compiler: { // Keep console output minimal in production bundles
    removeConsole: { // Strip log/info/debug while keeping warnings and errors
      exclude: ["error", "warn"], // Preserve high-signal logs
    },
  },
  
  async redirects() { // Define redirects to retire outdated routes
    return [ // Return list of redirect rules
      { // Redirect legacy job card appointments page
        source: "/job-cards/appointments", // Legacy route path
        destination: "/appointments", // New consolidated appointments calendar
        permanent: true, // Use permanent redirect for SEO and caching benefits
      }, // Close redirect rule
      // URL-shortening sweep (2026-06-11): deep job-card routes moved to short
      // top-level paths. Old paths 308-redirect to the new canonical locations so
      // existing bookmarks and any un-migrated links keep working.
      { source: "/job-cards/myjobs/:jobNumber", destination: "/tech/:jobNumber", permanent: true }, // Technician job detail
      { source: "/job-cards/myjobs", destination: "/tech", permanent: true }, // Technician my-jobs list
      { source: "/job-cards/waiting/nextjobs", destination: "/nextjobs", permanent: true }, // Next-jobs queue
      { source: "/job-cards/archive", destination: "/archive", permanent: true }, // Archived job cards
      { source: "/job-cards/create", destination: "/new-job", permanent: true }, // Create job card
      { source: "/job-cards/view", destination: "/jobs", permanent: true }, // Job cards list
      { source: "/job-cards/valet/:jobNumber", destination: "/valet/:jobNumber", permanent: true }, // Valet job detail
      // Round 2: parts / workshop / tech leaf pages flattened to short top-level paths.
      { source: "/parts/goods-in", destination: "/goods-in", permanent: true }, // Goods-in receiving
      { source: "/parts/goods-in/:goodsInNumber", destination: "/goods-in/:goodsInNumber", permanent: true }, // Goods-in detail
      { source: "/parts/deliveries", destination: "/deliveries", permanent: true }, // Parts deliveries
      { source: "/parts/deliveries/:deliveryId", destination: "/deliveries/:deliveryId", permanent: true }, // Delivery detail
      { source: "/parts/delivery-planner", destination: "/delivery-planner", permanent: true }, // Delivery route planner
      { source: "/parts/create-order", destination: "/new-order", permanent: true }, // Create parts order
      { source: "/parts/create-order/:orderNumber", destination: "/new-order/:orderNumber", permanent: true }, // Edit parts order
      { source: "/parts/manager", destination: "/parts-manager", permanent: true }, // Parts manager console
      { source: "/workshop/consumables-tracker", destination: "/consumables-tracker", permanent: true }, // Workshop consumables
      { source: "/tech/consumables-request", destination: "/consumables-request", permanent: true }, // Technician consumables request
      // Round 3: one-off-parent leaf pages flattened to top level.
      { source: "/staff/website-manager", destination: "/website-manager", permanent: true }, // Staff website CMS
      { source: "/account/security", destination: "/security", permanent: true }, // Own account security
    ]; // Close redirects array
  }, // Close redirects function
  
}; // Close configuration object

export default nextConfig; // Export configuration as default for Next.js
