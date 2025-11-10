// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/auth/roleGuard.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { HR_CORE_ROLES, normalizeRoles } from "@/lib/auth/roles";

/**
 * Wrap API route handlers with a role guard to enforce Keycloak-based RBAC.
 *
 * @param {Function} handler - API route handler (req, res, session) => any
 * @param {Object} options - configuration for the guard
 * @param {string[]} options.allow - list of roles allowed to access the endpoint
 * @param {Function} [options.authorize] - optional custom authorize function receiving normalized roles
 * @returns {Function} wrapped handler that enforces authentication + role checks
 *
 * TODO: Replace this guard with a Supabase policy-aware version once backend endpoints are available.
 */
export function withRoleGuard(handler, { allow = [], authorize } = {}) {
  return async (req, res) => {
    if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
      return handler(req, res, {
        user: { roles: HR_CORE_ROLES },
        devBypass: true,
      });
    }

    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const roles = normalizeRoles(session.user?.roles ?? []);

    const isAllowed =
      typeof authorize === "function"
        ? authorize(roles, session)
        : allow.length === 0 || allow.some((role) => roles.includes(role.toLowerCase()));

    if (!isAllowed) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    return handler(req, res, session);
  };
}
