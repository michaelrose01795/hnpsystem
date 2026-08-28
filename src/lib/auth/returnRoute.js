// file location: src/lib/auth/returnRoute.js
//
// One place that answers "where should this user land after authenticating?".
//
// The staff app loses the user's place in three different ways, and each one
// used to end at /newsfeed:
//
//   1. A cold hard load of a protected route with no valid cookie. The edge
//      guard (src/proxy.js) bounces to /login and records the route in
//      ?redirectedFrom=, but the login page only honoured that for CUSTOMER
//      logins — staff always went to the role default.
//   2. A session that expires while the tab is open or restored.
//      ProtectedRoute sent the user to a bare "/login" with no record at all,
//      so the route was gone before login could read it.
//   3. A browser restart onto a tab pinned at "/" (or /login itself). There is
//      no current route to preserve, so nothing can be recovered from the URL.
//
// (1) and (2) are solved by carrying the route through the redirect. (3) needs
// a remembered route, which is why one is stored — but ONLY as the fallback for
// that case. A real current route always wins, so this never hijacks a
// deliberate navigation.
//
// Two rules hold for every candidate, whatever its source:
//   * it must be a safe, restorable in-app staff route (isRestorableRoute), and
//   * the CURRENT user must be allowed to land on it (canAccessPath).
//
// The second is what stops a remembered or carried-over route from becoming a
// permission hole: the route is re-authorised against the user who is signing
// in NOW, not the one who was there before. The remembered entry is also keyed
// by user id, so one user's route is never even considered for another's.
//
// Note this is an ADDITIONAL gate, never a replacement one: _app's
// PageAccessGuard and the edge guard still police the route after landing, so
// the worst case for a stale decision here is a redirect, not access.

import { canAccessPath } from "@/lib/auth/pageAccess";

const LAST_ROUTE_STORAGE_KEY = "hnp-last-staff-route";

// Routes that must never be restored. Landing on any of these either bounces
// straight back out (creating a redirect loop) or is not a place the user was
// "working" in the first place.
const NON_RESTORABLE_EXACT = new Set([
  "/",
  "/login",
  "/loginPresentation",
  "/unauthorized",
  "/logout",
]);

const NON_RESTORABLE_PREFIXES = [
  "/api/",
  "/_next/",
  "/login?",
  "/presentation/", // demo decks own their own entry flow
  "/website/", // customer site has its own post-login destination
];

/**
 * A candidate route is restorable when it is an in-app, non-auth path that the
 * app can navigate to directly. Rejects absolute URLs and protocol-relative
 * values ("//evil.com"), so a crafted ?redirectedFrom= cannot send the user off
 * site after login.
 */
export function isRestorableRoute(value) {
  if (typeof value !== "string") return false;
  const route = value.trim();
  if (!route.startsWith("/")) return false;
  if (route.startsWith("//")) return false;
  if (route.includes("\\")) return false; // some browsers normalise "\" to "/"
  const [pathname] = route.split(/[?#]/);
  if (NON_RESTORABLE_EXACT.has(pathname)) return false;
  if (NON_RESTORABLE_PREFIXES.some((prefix) => route.startsWith(prefix))) return false;
  return true;
}

/**
 * canAccessPath is keyed on Next route PATTERNS as they appear in the manifest
 * (e.g. "/jobs"), while a restored route is a real URL ("/jobs?status=open", or
 * "/job-cards/12345"). Strip the query/hash, then walk the path back one
 * segment at a time so a detail URL is authorised by its list page — the same
 * relationship DYNAMIC_DETAIL_EXTENDS encodes for the dynamic patterns.
 */
function isRouteAllowedForUser(route, roles, sidebarAccess) {
  const [pathname] = String(route).split(/[?#]/);
  if (canAccessPath(pathname, roles, sidebarAccess)) return true;

  const segments = pathname.split("/").filter(Boolean);
  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    const parent = `/${segments.slice(0, depth).join("/")}`;
    if (canAccessPath(parent, roles, sidebarAccess)) return true;
  }
  return false;
}

/**
 * Store the route the user is currently working in, so a later cold start with
 * no route of its own (a pinned "/" tab, a bookmarked /login) can offer it back.
 *
 * Only ever called for a route the user has just been ALLOWED to land on — see
 * the call site in _app's PageAccessGuard — so a remembered route is a route
 * that passed the guard at least once. localStorage rather than sessionStorage
 * on purpose: this has to survive the browser being closed and reopened, which
 * is the case it exists for.
 */
export function rememberStaffRoute(userKey, route) {
  if (typeof window === "undefined") return;
  if (userKey === null || userKey === undefined || userKey === "") return;
  if (!isRestorableRoute(route)) return;
  try {
    window.localStorage.setItem(
      LAST_ROUTE_STORAGE_KEY,
      JSON.stringify({ userKey: String(userKey), route, at: Date.now() })
    );
  } catch {
    // Private mode / quota — a remembered route is a convenience, never a
    // requirement. Losing it just means the role default is used.
  }
}

/**
 * Read the remembered route back, but only for the user it was stored for.
 * A mismatch is not an error: it means somebody else is signing in on this
 * machine, and their own default applies.
 */
export function readRememberedStaffRoute(userKey) {
  if (typeof window === "undefined") return null;
  if (userKey === null || userKey === undefined || userKey === "") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (String(parsed?.userKey) !== String(userKey)) return null;
    return isRestorableRoute(parsed?.route) ? parsed.route : null;
  } catch {
    return null;
  }
}

export function clearRememberedStaffRoute() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_ROUTE_STORAGE_KEY);
  } catch {
    // Nothing to do — see rememberStaffRoute.
  }
}

/**
 * Pick the post-authentication destination.
 *
 * Precedence is deliberate: the route the user was actually asking for beats a
 * remembered one, and a remembered one beats the role default. Every candidate
 * must clear isRestorableRoute AND isRouteAllowedForUser; a candidate that
 * fails is skipped rather than fatal, so the worst case is the role default.
 *
 * `sidebarAccess` is usually still null at login time (the per-user snapshot
 * loads with the shell). That is safe: a null snapshot resolves to the
 * role-derived set, and if the snapshot later narrows access, PageAccessGuard
 * moves the user off the route. It can cost a redirect; it cannot grant access.
 */
export function resolveReturnRoute({
  redirectedFrom = null,
  remembered = null,
  roles = [],
  sidebarAccess = null,
  fallback,
}) {
  const candidates = [redirectedFrom, remembered];
  for (const candidate of candidates) {
    if (!isRestorableRoute(candidate)) continue;
    if (!isRouteAllowedForUser(candidate, roles, sidebarAccess)) continue;
    return candidate;
  }
  return fallback;
}

export { LAST_ROUTE_STORAGE_KEY };
