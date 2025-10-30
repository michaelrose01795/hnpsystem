// file location: /workspaces/hnpsystem/next.config.mjs

// Detect if we're in production (GitHub Pages) or development
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Enable React strict mode for better error detection
  reactStrictMode: true,

  // ✅ Only use static export on GitHub Pages (no API routes there)
  // 🚫 Disable export in development so API routes work locally
  ...(isProd
    ? {
        output: "export", // only export for production build (GitHub Pages)
        basePath: "/hnpsystem",
        assetPrefix: "/hnpsystem/",
        images: {
          unoptimized: true,
        },
      }
    : {
        // Normal Next.js dev server mode
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

  // ✅ Remove deprecated experimental.allowedDevOrigins key
  experimental: {
    // Add other safe experimental flags here if needed later
  },

  // ✅ Environment variables for Keycloak (available client-side)
  env: {
    NEXT_PUBLIC_KEYCLOAK_URL: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
    NEXT_PUBLIC_KEYCLOAK_REALM: process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  },
};

export default nextConfig;
