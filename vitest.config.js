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
  },
});
