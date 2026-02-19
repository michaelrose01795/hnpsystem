// file location: src/lib/api/createHandler.js
// Factory that wraps API handlers with standard method routing,
// role guards, and error handling to reduce boilerplate.

import { withRoleGuard } from "@/lib/auth/roleGuard";

/**
 * Creates a Next.js API handler with built-in method routing, role guards,
 * and standardised error responses.
 *
 * @param {Object} config
 * @param {string[]} config.allowedRoles - Roles permitted to reach this endpoint.
 * @param {Object} config.methods - Map of HTTP method to handler function.
 *   Each handler receives (req, res, session) and should return/throw normally.
 *   Example: { GET: handleGet, POST: handlePost }
 *
 * @returns {Function} A default-exportable Next.js API handler.
 *
 * Usage:
 *   export default createHandler({
 *     allowedRoles: ["admin", "accounts"],
 *     methods: {
 *       GET: async (req, res, session) => { ... },
 *       POST: async (req, res, session) => { ... },
 *     },
 *   });
 */
export default function createHandler({ allowedRoles = [], methods = {} }) {
  const allowedMethods = Object.keys(methods);
  const allowHeader = allowedMethods.join(",");

  async function handler(req, res, session) {
    const methodHandler = methods[req.method];

    if (!methodHandler) {
      res.setHeader("Allow", allowHeader);
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    try {
      await methodHandler(req, res, session);
    } catch (error) {
      console.error(`❌ API error [${req.method} ${req.url}]:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message || "Internal server error",
        });
      }
    }
  }

  return withRoleGuard(handler, { allow: allowedRoles });
}

/**
 * Send a standardised error response.
 * Shorthand for the repeated pattern:
 *   console.error(msg, error); res.status(code).json({ success: false, message });
 */
export function sendError(res, status, message, logContext) {
  if (logContext) {
    console.error(message, logContext);
  }
  return res.status(status).json({ success: false, message });
}

/**
 * Quick 403 check. Returns true (and sends 403) if the condition is falsy.
 *
 * Usage:
 *   if (denyUnless(res, permissions.canViewAccounts)) return;
 */
export function denyUnless(res, allowed) {
  if (!allowed) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return true;
  }
  return false;
}
