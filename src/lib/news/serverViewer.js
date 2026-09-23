// file location: src/lib/news/serverViewer.js
//
// Resolves "who is asking" for every news-hub API route, in one place.
//
// The session is the authority for identity and roles. A userId in the request
// body is only ever accepted when the session carries no numeric id — that is
// the dev-bypass / cookie-role path used elsewhere in this codebase, and it is
// never available in production.

import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { deriveDepartmentsFromRoles } from "@/lib/news/constants";
import { getNewsCapabilities } from "@/lib/news/permissions";

const toUserId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

/**
 * @param {object} session  the session withRoleGuard handed the route
 * @param {object} req      used only for the dev-bypass userId fallback
 */
export function resolveViewer(session, req) {
  const roles = normalizeRoles(session?.user?.roles ?? []);
  const sessionUserId = toUserId(session?.user?.id);

  // Dev bypass sessions have roles but no numeric id. Rather than refuse every
  // write in local development, fall back to the id the client sent — the same
  // convention /api/reactions already uses.
  const bodyUserId =
    session?.devBypass && process.env.NODE_ENV !== "production"
      ? toUserId(req?.body?.userId ?? req?.query?.userId)
      : null;

  const userId = sessionUserId ?? bodyUserId;
  const allAccess = hasAllAccessRole(roles);
  const capabilities = getNewsCapabilities(roles);

  return {
    userId,
    roles,
    allAccess,
    // A moderator or all-access user sees every department's feed; everyone
    // else sees General plus the departments their roles map to.
    departments: deriveDepartmentsFromRoles(roles, { allAccess }),
    canSeeEverything: allAccess || capabilities.canModerate,
    ...capabilities,
  };
}

/** Throws a 403-shaped error when the viewer lacks a capability. */
export function assertCapability(viewer, capability, message) {
  if (!viewer?.[capability]) {
    const error = new Error(message || "You do not have permission to do that.");
    error.statusCode = 403;
    throw error;
  }
}

/** Throws a 401-shaped error when the viewer could not be identified. */
export function assertIdentified(viewer) {
  if (!viewer?.userId) {
    const error = new Error("We could not identify your account for this action.");
    error.statusCode = 401;
    throw error;
  }
  return viewer.userId;
}

/** Turns any thrown error into the { status, message } an API route replies with. */
export function toApiError(error, fallback = "Server error") {
  const status = Number(error?.statusCode) || (/(required|Unknown|Invalid|too long|too large|cannot|only)/i.test(error?.message || "") ? 400 : 500);
  return { status, message: error?.message || fallback };
}
