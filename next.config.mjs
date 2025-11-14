// file location: next.config.mjs // Document file path for clarity
// Added per instruction to keep comment coverage
const nextConfig = { // Exported Next.js configuration object
  reactStrictMode: true, // Enable React strict mode for highlighting potential issues
  // Added per instruction to keep comment coverage
  images: { // Configure remote image domains
    remotePatterns: [ // Allow generic HTTPS image sources
      { // Single wildcard rule
        protocol: "https", // Permit only HTTPS protocol
        hostname: "**", // Accept any remote hostname
      }, // Close remote pattern object
    ], // Close remotePatterns array
  }, // Close images config
  // Added per instruction to keep comment coverage
  env: { // Surface selected environment variables to the client bundle
    NEXT_PUBLIC_KEYCLOAK_URL: process.env.NEXT_PUBLIC_KEYCLOAK_URL, // Keycloak base URL
    NEXT_PUBLIC_KEYCLOAK_REALM: process.env.NEXT_PUBLIC_KEYCLOAK_REALM, // Keycloak realm identifier
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID, // Client ID for Keycloak auth
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "", // Fallback to empty string for optional API URL
  }, // Close env block
  // Added per instruction to keep comment coverage
  async redirects() { // Define redirects to retire outdated routes
    return [ // Return list of redirect rules
      { // Redirect legacy job card appointments page
        source: "/job-cards/appointments", // Legacy route path
        destination: "/appointments", // New consolidated appointments calendar
        permanent: true, // Use permanent redirect for SEO and caching benefits
      }, // Close redirect rule
    ]; // Close redirects array
  }, // Close redirects function
}; // Close configuration object
// Added per instruction to keep comment coverage
export default nextConfig; // Export configuration as default for Next.js
