// file location: vitest.config.js
// Vitest config — unit tests for pure-function modules (currently src/features/vhc).
// Playwright tests under tests/** are excluded so npm run test (Playwright) and
// npm run test:unit (Vitest) stay non-overlapping.

import path from "node:path"; // Node path utilities for resolving @ alias.
import { defineConfig } from "vitest/config"; // Vitest config helper.

export default defineConfig({ // Single config — no plugins required, all targets are .js.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // Mirror the tsconfig.json baseUrl/paths mapping.
    },
  },
  test: {
    include: ["src/**/*.test.{js,jsx}"], // Co-locate unit tests next to source files.
    exclude: ["tests/**", "node_modules/**", ".next/**"], // Keep Playwright suite (tests/**) out.
    environment: "node", // Pure-function modules only — no DOM yet.
    globals: false, // Force explicit imports of describe/it/expect.
    // Unit tests never touch a live database. This forces the in-memory Supabase
    // stub WHEN credentials are absent (e.g. CI / a fresh clone) so importing a
    // DB-touching module degrades to the stub instead of throwing. Real-cred
    // environments are unaffected (the stub only engages when creds are missing).
    env: { PLAYWRIGHT_TEST_AUTH: "1" },
  },
});
