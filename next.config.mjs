// file location: next.config.mjs
import path from "path"; // Node.js path utilities for building aliases

const nextConfig = { // Exported Next.js configuration object
  reactStrictMode: true, // Enable React strict mode for highlighting potential issues
  
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
    ]; // Close redirects array
  }, // Close redirects function
  
  webpack(config) { // Custom webpack tweaks for alias support (kept for backward compatibility)
    config.resolve.alias = { // Keep Next's defaults while adding our own
      ...config.resolve.alias,
      "@": path.resolve(process.cwd(), "src"), // Map @ to src for cleaner imports
    };
    return config; // Return the modified config back to Next.js
  }, // Close webpack override
}; // Close configuration object

export default nextConfig; // Export configuration as default for Next.js
