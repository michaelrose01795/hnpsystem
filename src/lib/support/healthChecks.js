// file location: src/lib/support/healthChecks.js
//
// Phase 7 (hardening) — health checks for the Help & Diagnostics ("support")
// subsystems. This module is split into:
//   - a PURE self-test + aggregator (`sanitiserSelfTest`, `summariseHealth`)
//     that is fully unit-testable with no I/O, and
//   - the probe orchestration is done by the API route (which owns the DB /
//     storage / env I/O) and hands its raw results to `summariseHealth`.
//
// The self-test proves — at runtime, in production — that the sanitiser still
// strips a known planted secret. This is the "canary": if a deploy ever ships a
// broken sanitiser, /api/support/health goes red before a real secret leaks.
//
// No probe records request content; a check returns only a status + short note.

import { sanitiseDiagnostics, REDACTED } from "@/lib/support/sanitise";

export const HEALTH_OK = "ok";
export const HEALTH_WARN = "warn";
export const HEALTH_FAIL = "fail";

// Canary secrets — must be stripped by the live sanitiser or the self-test fails.
const CANARY = {
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcnkifQ.canarysignature_abcdef",
  card: "4111 1111 1111 1111",
  nino: "AB123456C",
};

/**
 * Run the sanitiser over a blob containing known secrets and confirm none
 * survive. Pure — safe to run on every health request.
 * @returns {{ status: string, note: string }}
 */
export function sanitiserSelfTest() {
  const probe = {
    session: { password: "canary-pw", token: CANARY.jwt },
    console_errors: [`Bearer ${CANARY.jwt}`, `card ${CANARY.card}`, `nino ${CANARY.nino}`],
  };
  let cleaned;
  try {
    cleaned = sanitiseDiagnostics(probe);
  } catch (error) {
    return { status: HEALTH_FAIL, note: `sanitiser threw: ${error?.message || error}` };
  }
  const serialised = JSON.stringify(cleaned);
  const leaked = [CANARY.jwt, CANARY.card, CANARY.nino].filter((s) => serialised.includes(s));
  const keyRedacted = cleaned?.session?.password === REDACTED && cleaned?.session?.token === REDACTED;
  if (leaked.length || !keyRedacted) {
    return {
      status: HEALTH_FAIL,
      note: leaked.length ? `sanitiser leaked ${leaked.length} secret(s)` : "secret-named keys not redacted",
    };
  }
  return { status: HEALTH_OK, note: "sanitiser strips planted secrets" };
}

/**
 * Fold a set of named check results into an overall status. `fail` dominates,
 * then `warn`, else `ok`. Unknown/missing statuses count as a fail (fail-closed).
 * @param {Record<string, { status: string, note?: string }>} checks
 * @returns {{ status: string, checks: object, failing: string[], warning: string[] }}
 */
export function summariseHealth(checks = {}) {
  const entries = Object.entries(checks || {});
  const failing = [];
  const warning = [];
  for (const [name, result] of entries) {
    const status = result?.status;
    if (status === HEALTH_OK) continue;
    if (status === HEALTH_WARN) warning.push(name);
    else failing.push(name); // fail OR anything unrecognised → fail-closed
  }
  const status = failing.length ? HEALTH_FAIL : warning.length ? HEALTH_WARN : HEALTH_OK;
  return { status, checks, failing, warning };
}
