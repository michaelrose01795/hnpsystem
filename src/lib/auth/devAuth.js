// Server-side gate for developer-style auth shortcuts (login by user ID,
// CI test bypass). Honours the dev-tools config so the server gate stays in
// sync with the UI: if the dev-tools config exposes the dev login button,
// the server must accept it. ALLOW_DEV_AUTH=1 still works as an override.

import { devToolsConfig } from "@/lib/dev-tools/config";

const truthy = (value) =>
  typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());

export function isDevAuthAllowed() {
  if (truthy(process.env.ALLOW_DEV_AUTH)) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(devToolsConfig?.enabled && devToolsConfig?.allowInProduction && devToolsConfig?.showLogin);
}

export function isCiTestAuthAllowed() {
  return truthy(process.env.PLAYWRIGHT_TEST_AUTH);
}
