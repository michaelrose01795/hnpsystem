// file location: /workspaces/hnpsystem/next.config.mjs

// ✅ Detect if we're in production (GitHub Pages) or development
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Enable React strict mode for better error detection
  reactStrictMode: true,

  // ✅ Conditional config: export only for production (GitHub Pages)
  ...(isProd
    ? {
        // ✅ Static export for GitHub Pages
        output: "export",
        basePath: "/hnpsystem",
        assetPrefix: "/hnpsystem/",
        images: {
          unoptimized: true, // disable image optimization for static export
        },
      }
    : {
        // ✅ Normal dev server mode (API routes work)
        basePath: "",
        assetPrefix: "",
        images: {
          remotePatterns: [
            {
              protocol: "https",
              hostname: "**",
            },
          ],
        },
      }),

  // ✅ Experimental section with allowedDevOrigins for local LAN access
  experimental: {
    allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.157"], // fixes cross-origin dev warning
  },

  // ✅ Environment variables for Keycloak (available on client side)
  env: {
    NEXT_PUBLIC_KEYCLOAK_URL: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
    NEXT_PUBLIC_KEYCLOAK_REALM: process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  },
};

export default nextConfig;