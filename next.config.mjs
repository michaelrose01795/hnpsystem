// file location: /workspaces/hnpsystem/next.config.mjs

// Detect if we're in production (GitHub Pages) or development
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Enable React strict mode for better error detection
  reactStrictMode: true,

  // ✅ Enable static export for GitHub Pages (no Node.js server required)
  output: "export",

  // ✅ Base path and asset prefix for serving from /hnpsystem subdirectory
  basePath: isProd ? "/hnpsystem" : "",
  assetPrefix: isProd ? "/hnpsystem/" : "",

  // ✅ Disable Next.js image optimization (not supported on static export)
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },

  // ✅ Allow cross-origin requests in development
  experimental: {
    allowedDevOrigins: ["127.0.0.1", "localhost"],
  },

  // ✅ Environment variables available on client side for Keycloak
  env: {
    NEXT_PUBLIC_KEYCLOAK_URL: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
    NEXT_PUBLIC_KEYCLOAK_REALM: process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  },
};

export default nextConfig;
