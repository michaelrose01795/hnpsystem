// file location: src/lib/reporting/actor.js
//
// PRIORITY 2 — Actor attribution (engine side, Phase-2 §8).
//
// Resolves "who did it" into the canonical actor shape every event/history row
// carries: { actorKind, actorUserId (canonical int), actorAuthUuid, actorRole }.
// Bridges the dual identity (int users.user_id vs uuid auth.users.id) via the
// dim_actor data helper, with point-in-time role captured on the event so
// historical attribution survives later role changes (ADR-15).
//
// Per-user KPIs remain BLOCKED until dim_actor is populated for the uuid-keyed
// tables (Risk R2) — this module surfaces that by returning a null canonical id
// for unresolved auth uuids rather than guessing.

import { resolveCanonicalActor } from "@/lib/database/reporting/dimActor";

export const ACTOR_KINDS = Object.freeze(["user", "system", "customer", "integration"]);

// Build the actor descriptor for the current request from a NextAuth session.
// `session.user.id` is the int users.user_id (canonical today); roles[0] is the
// point-in-time role. Returns a synchronous descriptor (no DB hit needed — the
// session already carries the canonical int id).
export function actorFromSession(session) {
  const id = Number(session?.user?.id);
  const roles = session?.user?.roles || [];
  return {
    actorKind: Number.isFinite(id) && id > 0 ? "user" : "system",
    actorUserId: Number.isFinite(id) && id > 0 ? id : null,
    actorAuthUuid: null,
    actorRole: roles[0] || session?.user?.role || null,
  };
}

// System/automated actor (cron, aggregation, integrations — Phase-2 §8.3).
export function systemActor(source = "system") {
  return { actorKind: "system", actorUserId: null, actorAuthUuid: null, actorRole: source };
}

// Customer actor (e.g. VHC share authorisation — §8.1). Keeps actor_kind honest
// while ownership reflects the owning desk (§5.4).
export function customerActor(customerId = null) {
  return {
    actorKind: "customer",
    actorUserId: null,
    actorAuthUuid: null,
    actorRole: "customer",
    customerId,
  };
}

// Resolve an actor from any available id (int user id and/or auth uuid) into the
// canonical descriptor. Async — hits dim_actor / the fallback resolver. Used by
// the bridges that ingest uuid-keyed source rows (parts allocated_by, etc.).
export async function resolveActor({ userId = null, authUuid = null, role = null } = {}) {
  const resolved = await resolveCanonicalActor({ userId, authUuid });
  if (!resolved) {
    return { actorKind: "system", actorUserId: null, actorAuthUuid: authUuid || null, actorRole: role };
  }
  return {
    actorKind: resolved.canonicalUserId ? "user" : authUuid ? "user" : "system",
    actorUserId: resolved.canonicalUserId || null, // null = unresolved uuid (R2 block)
    actorAuthUuid: resolved.authUuid || null,
    actorRole: role || resolved.role || null,
  };
}

export default resolveActor;
