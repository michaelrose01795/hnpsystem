// file location: src/lib/support/devPlatformAudit.js
//
// Phase 8 — thin wrapper over the shared, hash-chained writeAuditLog so every
// Developer Platform surface records access + security-sensitive actions with
// consistent action names. Best-effort: auditing must never block or fail the
// request it describes.
//
// Action names (all under entityType "dev_platform"):
//   dev_platform_session → a `dev` session was established (NextAuth mint)
//   dev_platform_view    → a dev-gated platform data read (list/detail/health)
//   dev_platform_action  → a mutating platform action (saved-view / preference)

import { writeAuditLog } from "@/lib/audit/auditLog";

const clientIp = (req) => {
  const fwd = req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req?.socket?.remoteAddress || null;
};

const actorId = (session) => {
  const n = Number.parseInt(session?.user?.id, 10);
  return Number.isInteger(n) ? n : null;
};

const actorRole = (session) => session?.user?.roles?.[0] || "dev";

/**
 * Record a Developer Platform audit entry. Never throws.
 * @param {string} action  one of the dev_platform_* action names
 * @param {object} opts     { req, session, entityId?, diff? }
 */
export async function recordDevPlatformAudit(action, { req, session, entityId = null, diff = null } = {}) {
  try {
    await writeAuditLog({
      action,
      actorUserId: actorId(session),
      actorRole: actorRole(session),
      entityType: "dev_platform",
      entityId,
      diff,
      ip: clientIp(req),
      userAgent: req?.headers?.["user-agent"] || null,
    });
  } catch {
    /* auditing is best-effort */
  }
}
