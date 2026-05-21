// file location: desktop/src/config.js
// Centralised configuration for the H&P System Electron shell.
// Editing the DMS_APP_URL fallback below changes the production target
// when the DMS_APP_URL environment variable is not provided at runtime.

"use strict"; // Enforce strict mode for safer Electron main-process code

const fs = require("node:fs");     // Tiny built-in fs used by the inline .env loader below
const path = require("node:path"); // Tiny built-in path used by the inline .env loader below

// ---------------------------------------------------------------------------
// Zero-dependency .env loader.
// Looks for desktop/.env (next to package.json) and copies any KEY=VALUE
// pairs into process.env without overriding values already set in the shell.
// Kept inline so we don't pull in the `dotenv` package just for one variable.
// ---------------------------------------------------------------------------
function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env"); // desktop/.env
  if (!fs.existsSync(envPath)) {
    return; // No .env present — that's fine, we'll fall back to defaults
  }
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue; // Skip blanks/comments
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = value; // Shell values take precedence over the file
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[H&P Desktop] Couldn't read desktop/.env:", err.message);
  }
}
loadDotEnv(); // Run before we read DMS_APP_URL below

// =============================================================
// PRODUCTION TARGET
// -------------------------------------------------------------
// The hosted Next.js DMS URL the desktop shell should load.
// Replace the placeholder below with the real Vercel URL when
// known, OR set DMS_APP_URL in the environment / .env file.
// Example values:
//   https://hnpsystem.vercel.app
//   https://hnp.humphriesandparks.co.uk
// =============================================================
const DEFAULT_DMS_URL = "https://hnpsystem.vercel.app"; // Fallback target — override via DMS_APP_URL env var

// Read the override from the environment if present, otherwise use the fallback above
const RAW_DMS_URL = (process.env.DMS_APP_URL || DEFAULT_DMS_URL).trim(); // Trim any stray whitespace from env vars

// Parse the URL once so we can derive a strict host allow-list for navigation
// (anything not on the allowed host opens in the user's normal browser instead).
let parsedDmsUrl; // Will hold the URL object used by navigation guards
try {
  parsedDmsUrl = new URL(RAW_DMS_URL); // Validate the configured URL up front
} catch (err) {
  // If the configured URL is malformed we hard-fail with a helpful message —
  // an invalid URL would otherwise cause obscure white-screen errors at runtime.
  // eslint-disable-next-line no-console
  console.error("[H&P Desktop] Invalid DMS_APP_URL:", RAW_DMS_URL, err);
  process.exit(1);
}

// The single allowed host the BrowserWindow is permitted to navigate to.
// Subdomains can be added here if your auth flow redirects through another host.
const ALLOWED_HOSTS = new Set([
  parsedDmsUrl.host, // e.g. hnpsystem.vercel.app
]);

// Optional auxiliary hosts you may want to allow inside the app shell.
// NextAuth, Supabase, and Stripe all run sign-in / callback flows on their
// own domains — add the ones you actually use here. Anything not listed
// will be forced to open in the user's external browser.
const AUX_ALLOWED_HOSTS = [
  // "accounts.google.com",       // Uncomment if you support Google login inside the app
  // "login.microsoftonline.com", // Uncomment for Microsoft auth flows
  // "auth.humphriesandparks.co.uk", // Custom auth subdomain example
];
for (const host of AUX_ALLOWED_HOSTS) {
  ALLOWED_HOSTS.add(host); // Merge auxiliary hosts into the navigation allow-list
}

// Public-facing application metadata used by Electron and electron-builder.
// Kept here so that main.js / preload.js share a single source of truth.
const APP_META = {
  productName: "H&P System",           // Window title and About dialog name
  companyName: "Humphries & Parks",    // Used in installer metadata
  appId: "uk.co.humphriesandparks.hnpsystem", // Reverse-DNS identifier for the installer
};

// Default BrowserWindow geometry — keeps the first-run experience consistent.
const WINDOW_DEFAULTS = {
  width: 1440,    // Reasonable starting width for desktop monitors
  height: 900,    // Reasonable starting height for desktop monitors
  minWidth: 1024, // Prevent layout breakage on overly narrow drags
  minHeight: 640, // Prevent layout breakage on overly short drags
};

// Export everything the main process needs in one object
module.exports = {
  DMS_URL: RAW_DMS_URL,           // Final resolved DMS URL string
  DMS_ORIGIN: parsedDmsUrl.origin, // Origin string (protocol + host) for comparisons
  ALLOWED_HOSTS,                   // Set of allowed hosts for in-window navigation
  APP_META,                        // Branding / installer metadata
  WINDOW_DEFAULTS,                 // Default window size constants
};
