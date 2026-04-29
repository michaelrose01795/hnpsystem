// Helper to assemble an audit context (actor + request metadata) from a
// Next.js API route. Routes call getAuditContext(req, res) once at the top
// of the handler, then pass the spread context into writeAuditLog along
// with the action / entity / diff specific to that change.
//
// Usage:
//   const ctx = await getAuditContext(req, res);
//   ...do work...
//   await writeAuditLog({ ...ctx, action: 'update', entityType: 'customer', entityId: id, diff });

import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getClientIp, getUserAgent } from "@/lib/auth/rateLimit";

export async function getAuditContext(req, res) {
  let session = null;
  try {
    session = await getServerSession(req, res, authOptions);
  } catch {
    session = null;
  }

  const actorUserIdRaw = session?.user?.id;
  const actorUserId = Number(actorUserIdRaw);
  const roles = session?.user?.roles || [];
  const actorRole = roles[0] || session?.user?.role || null;

  // Stable request id: prefer one passed by the edge / client (so an entire
  // multi-API-call user action can be correlated), otherwise mint one.
  const incomingId =
    req?.headers?.["x-request-id"] || req?.headers?.["x-correlation-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.length > 0
      ? incomingId
      : crypto.randomUUID();

  return {
    actorUserId: Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null,
    actorRole,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    requestId,
  };
}

// Convenience: compute a shallow before/after diff between two row-shaped
// objects, producing { fieldName: { before, after } } only for fields that
// actually changed. Sensitive field redaction is applied later by
// writeAuditLog.
export function shallowDiff(before, after) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return null;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff = {};
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}
