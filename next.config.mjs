// file location: /workspaces/hnpsystem/next.config.mjs

// Detect if we're in production (GitHub Pages) or development
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode for better error detection
  reactStrictMode: true,

  // Disable Turbopack in development to fix Supabase HMR errors
  experimental: {
    turbo: false
  },

  // Conditional config: export only for production (GitHub Pages)
  ...(isProd
    ? {
        output: "export",
        basePath: "/hnpsystem",
        assetPrefix: "/hnpsystem/",
        images: {
          unoptimized: true,
          remotePatterns: [
            {
              protocol: "https",
              hostname: "**",
            },
          ],
        },
      }
    : {
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

  // Environment variables for Keycloak (client-side)
  env: {
    NEXT_PUBLIC_KEYCLOAK_URL: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
    NEXT_PUBLIC_KEYCLOAK_REALM: process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  },
};

export default nextConfig;
