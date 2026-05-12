// Wraps window.fetch to short-circuit internal /api/* calls when in
// presentation mode. Installed/restored from _app.js as the user enters or
// leaves /presentation routes. External fetches (and non-/api internal fetches)
// always pass through to the original implementation.

import { isPresentationMode } from "../runtime/presentationMode";
import { buildMockApiResponse } from "./apiRouteTable";

let originalFetch = null;
let installed = false;

// Routes that MUST pass through to the real backend even in presentation mode.
// NextAuth uses /api/auth/* internally to fetch session/csrf — intercepting
// breaks the auth provider chain. /api/health is harmless and useful for
// liveness checks during demos. Anything else under /api/* is faked.
const PASSTHROUGH_RE = /^\/api\/(auth|health|img-proxy)\b/;

function makeMockResponse({ status, body }) {
  const json = JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function installFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  originalFetch = window.fetch.bind(window);
  installed = true;

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
    if (isPresentationMode() && /^\/api\//.test(url) && !PASSTHROUGH_RE.test(url)) {
      const mock = buildMockApiResponse(url, method);
      return makeMockResponse(mock);
    }
    return originalFetch(input, init);
  };
}

export function restoreFetchInterceptor() {
  if (!installed || typeof window === "undefined") return;
  if (originalFetch) window.fetch = originalFetch;
  originalFetch = null;
  installed = false;
}
