// Wraps window.fetch to short-circuit internal /api/* calls when in
// presentation mode. Installed/restored from _app.js as the user enters or
// leaves /presentation routes. External fetches (and non-/api internal fetches)
// always pass through to the original implementation.

import { isPresentationMode } from "../runtime/presentationMode";

// `./apiRouteTable` is ~64KB of route handlers and pulls in the whole demo
// fixture set. _app.js imports this module statically (it must, to install the
// interceptor on route change), so a static import here put the entire demo data
// layer in the shared first-load bundle of every route in the app.
//
// It is loaded on demand instead. The interceptor wrapper below is installed
// synchronously — so no request can slip past while the module loads — and the
// wrapper is already async, so it simply awaits the table before building a mock
// response. Only /presentation routes ever reach that path.
let apiRouteTablePromise = null;
const loadMockApiResponder = () => {
  if (!apiRouteTablePromise) {
    apiRouteTablePromise = import("./apiRouteTable").then((mod) => mod.buildMockApiResponse);
  }
  return apiRouteTablePromise;
};

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
  // Start fetching the route table immediately so the first intercepted call
  // normally finds it already resolved.
  void loadMockApiResponder();

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === "string" ? input : input?.url || "";
    let apiPath = "";
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.origin === window.location.origin) {
        apiPath = `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      apiPath = rawUrl;
    }
    const method = (init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
    if (isPresentationMode() && /^\/api\//.test(apiPath) && !PASSTHROUGH_RE.test(apiPath)) {
      // Pass the request body through so route transforms that branch on a
      // payload `action` (e.g. /api/personal/security lock/unlock) can read it.
      let parsedBody = null;
      const rawBody = init?.body ?? (typeof input === "object" ? input?.body : null);
      if (typeof rawBody === "string" && rawBody) {
        try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = null; }
      }
      const buildMockApiResponse = await loadMockApiResponder();
      const mock = buildMockApiResponse(apiPath, method, parsedBody);
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
