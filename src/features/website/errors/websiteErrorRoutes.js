// file location: src/features/website/errors/websiteErrorRoutes.js
//
// Which "side" of the app a framework error page belongs to.
//
// Next.js renders 404 / 500 / _error under their OWN route pattern ("/404",
// "/500", "/_error"), not the URL the visitor asked for. Anything that decided
// between the customer site (custglobal.css) and the staff app (staffglobal.css)
// from the route pattern therefore sent every /website error to the staff side.
// These helpers resolve the real address instead.

export const FRAMEWORK_ERROR_ROUTES = new Set(["/404", "/500", "/_error"]);

const stripQueryAndHash = (path = "") => String(path).split(/[?#]/)[0] || "";

export const isWebsitePath = (path = "") => {
  const clean = stripQueryAndHash(path);
  return clean === "/website" || clean.startsWith("/website/");
};

export const isFrameworkErrorRoute = (path = "") => FRAMEWORK_ERROR_ROUTES.has(stripQueryAndHash(path));
