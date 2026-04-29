// Server-side gate for developer-style auth shortcuts (login by user ID,
// CI test bypass). Default = OFF in production. Must be explicitly enabled
// via env var. Client-side dev-tools/config.js controls UI only — this file
// is the load-bearing security check.

const truthy = (value) =>
  typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());

export function isDevAuthAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return truthy(process.env.ALLOW_DEV_AUTH);
}

export function isCiTestAuthAllowed() {
  return truthy(process.env.PLAYWRIGHT_TEST_AUTH);
}
