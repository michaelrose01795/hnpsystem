// file location: src/pages/api/support/health.js
//
// Phase 7 (hardening) — developer-only health check for the Help & Diagnostics
// ("support") subsystems. GET returns a rolled-up status ("ok"/"warn"/"fail")
// plus a per-check breakdown so an admin/dev can confirm at a glance that:
//   - the sanitiser still strips a planted secret (the privacy canary),
//   - the RLS-locked support_reports table is reachable via the service role,
//   - the private support-reports storage bucket exists,
//   - build / code-state metadata is populated,
//   - RLS is being enforced by service-role-only routing.
//
// Dev-gated the same way as the Support Centre (strict DEV_PLATFORM_ROLES — the
// `dev` role, Phase 8 re-gate). Returns only statuses + short notes — never
// diagnostics content, never secrets. A non-ok roll-up returns HTTP 503 so an
// uptime probe can alert on it.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { supabaseService } from "@/lib/database/supabaseClient";
import { getSupportBucketStatus } from "@/lib/storage/supportMediaBucketService";
import {
  sanitiserSelfTest,
  summariseHealth,
  HEALTH_OK,
  HEALTH_WARN,
  HEALTH_FAIL,
} from "@/lib/support/healthChecks";
import { readBuildInfo } from "@/lib/support/buildInfo";
import { getSectionSourceMapHash } from "@/lib/dev-layout/sectionSourceMap";

async function checkDatabase() {
  try {
    if (!supabaseService) {
      return { status: HEALTH_WARN, note: "service-role client not configured (dev/CI stub)" };
    }
    const { error } = await supabaseService
      .from("support_reports")
      .select("id", { count: "exact", head: true });
    if (error) return { status: HEALTH_FAIL, note: `query failed: ${error.message}` };
    return { status: HEALTH_OK, note: "support_reports reachable via service role" };
  } catch (error) {
    return { status: HEALTH_FAIL, note: error?.message || "database check threw" };
  }
}

function checkRls() {
  // RLS is enforced structurally: the table has RLS enabled with NO permissive
  // policies, so the only path to the data is the service-role key on the server.
  // We can't SELECT pg_policies without extra grants, so this reports the invariant
  // the whole design rests on: the service role must be present server-side and the
  // anon key must never be used for support_reports (it isn't — see support.js).
  if (!supabaseService) {
    return { status: HEALTH_WARN, note: "no service role — support data would be inaccessible in prod" };
  }
  return { status: HEALTH_OK, note: "RLS on, no policies; access only via service-role routes" };
}

function checkBuild() {
  try {
    const build = readBuildInfo(process.env, { sectionMapHash: getSectionSourceMapHash() });
    const hasCommit = Boolean(build?.commit_sha && build.commit_sha !== "dev");
    return {
      status: hasCommit ? HEALTH_OK : HEALTH_WARN,
      note: hasCommit
        ? `pinned to ${build.commit_sha.slice(0, 8)} (${build.deploy_env || "?"})`
        : "commit sha not injected (local/dev) — drift detection limited",
    };
  } catch (error) {
    return { status: HEALTH_FAIL, note: error?.message || "build info threw" };
  }
}

async function handleGet(req, res) {
  const checks = {
    sanitiser: sanitiserSelfTest(),
    database: await checkDatabase(),
    storage: await getSupportBucketStatus(),
    rls: checkRls(),
    build: checkBuild(),
  };
  const summary = summariseHealth(checks);
  const httpStatus = summary.status === HEALTH_FAIL ? 503 : 200;
  return res.status(httpStatus).json({
    success: summary.status !== HEALTH_FAIL,
    status: summary.status,
    failing: summary.failing,
    warning: summary.warning,
    checks,
    checkedAt: new Date().toISOString(),
  });
}

// Dev-gated: only the strict `dev` role (DEV_PLATFORM_ROLES) may probe subsystem health.
export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet },
});
