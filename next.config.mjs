const nextConfig = { // Exported Next.js configuration object
  reactStrictMode: true, // Enable React strict mode for highlighting potential issues
  devIndicators: false, // Disable the Next.js dev tools indicator overlay for this project
  
  turbopack: {}, // CRITICAL FIX: Add empty turbopack config to silence Next.js 16 error and enable Turbopack by default
  
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
