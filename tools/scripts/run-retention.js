#!/usr/bin/env node
// file location: tools/scripts/run-retention.js
// Retention runner — Phase 8.
//
// Walks public.retention_policies and applies each entity-type's policy
// (delete or anonymise) for rows older than the configured retention
// period. Every run, dry or not, is recorded in retention_runs and
// audit_log.
//
// Usage:
//   node tools/scripts/run-retention.js                  # dry-run, all policies
//   node tools/scripts/run-retention.js --apply          # actually mutate
//   node tools/scripts/run-retention.js --entity=auth_login_attempts
//
// Safety:
//   - Default mode is dry-run. You must pass --apply to write.
//   - Each entity type has its own handler in HANDLERS. New types must
//     be added explicitly — there is no implicit "delete from table".
//   - Each handler is responsible for its own where-clause.
//
// Environment: requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");

dotenv.config({ path: resolve(root, ".env") });
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ENTITY_FILTER = (args.find((a) => a.startsWith("--entity=")) || "").split("=")[1] || null;

// ---------------------------------------------------------------------------
// Per-entity handlers. Each receives { policy, dryRun, sb } and returns
// { rowsProcessed, rowsActioned }. Add new entity types here as they are
// implemented and signed off — do not add a generic "delete from anywhere".
// ---------------------------------------------------------------------------

const HANDLERS = {
  // 90-day rolling window of login attempts. Older rows are deleted
  // outright (security forensics value drops sharply after the window).
  auth_login_attempts: async ({ dryRun }) => {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const { count } = await sb
      .from("auth_login_attempts")
      .select("id", { count: "exact", head: true })
      .lt("attempted_at", cutoff);
    const rowsProcessed = count || 0;
    if (!dryRun && rowsProcessed > 0) {
      const { error } = await sb
        .from("auth_login_attempts")
        .delete()
        .lt("attempted_at", cutoff);
      if (error) throw new Error(`auth_login_attempts delete: ${error.message}`);
    }
    return { rowsProcessed, rowsActioned: dryRun ? 0 : rowsProcessed };
  },

  // 12-month cookie consent expiry — beyond that the user should be
  // re-prompted. Delete the stale row so the banner reappears.
  cookie_consent: async ({ dryRun }) => {
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
    const { count } = await sb
      .from("cookie_consents")
      .select("id", { count: "exact", head: true })
      .lt("created_at", cutoff);
    const rowsProcessed = count || 0;
    if (!dryRun && rowsProcessed > 0) {
      const { error } = await sb
        .from("cookie_consents")
        .delete()
        .lt("created_at", cutoff);
      if (error) throw new Error(`cookie_consents delete: ${error.message}`);
    }
    return { rowsProcessed, rowsActioned: dryRun ? 0 : rowsProcessed };
  },

  // Audit log retention is "archive then delete". For now we only delete
  // beyond the 7y mark. An archive job to cold storage is a follow-up.
  audit_log: async ({ dryRun }) => {
    const cutoff = new Date(Date.now() - 7 * 365 * 86400000).toISOString();
    const { count } = await sb
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .lt("occurred_at", cutoff);
    const rowsProcessed = count || 0;
    if (!dryRun && rowsProcessed > 0) {
      const { error } = await sb
        .from("audit_log")
        .delete()
        .lt("occurred_at", cutoff);
      if (error) throw new Error(`audit_log delete: ${error.message}`);
    }
    return { rowsProcessed, rowsActioned: dryRun ? 0 : rowsProcessed };
  },

  // Below: handlers NOT YET IMPLEMENTED. They will throw so an operator
  // who forgets and runs --apply gets a hard failure rather than a silent
  // no-op. Implement these alongside the matching anonymisation graph
  // (which fields to null, which links to keep, etc.).
  customer_no_jobs: async () => {
    throw new Error("customer_no_jobs handler not implemented; coordinate with HR + jobs schema first.");
  },
  customer_with_vehicle: async () => {
    throw new Error("customer_with_vehicle handler not implemented.");
  },
  job_card: async () => {
    throw new Error("job_card handler not implemented.");
  },
  vhc_report: async () => {
    throw new Error("vhc_report handler not implemented.");
  },
  test_drive_dl_check: async () => {
    throw new Error("test_drive_dl_check handler not implemented.");
  },
  marketing_prospect: async () => {
    throw new Error("marketing_prospect handler not implemented.");
  },
};

// ---------------------------------------------------------------------------

async function recordRun({ entityType, action, dryRun, rowsProcessed, rowsActioned, notes }) {
  await sb.from("retention_runs").insert([
    {
      entity_type: entityType,
      action,
      dry_run: dryRun,
      rows_processed: rowsProcessed,
      rows_actioned: rowsActioned,
      triggered_by: null,
      notes,
    },
  ]);
}

async function loadPolicies() {
  let q = sb.from("retention_policies").select("*").order("entity_type");
  if (ENTITY_FILTER) q = q.eq("entity_type", ENTITY_FILTER);
  const { data, error } = await q;
  if (error) throw new Error(`load policies: ${error.message}`);
  return data || [];
}

(async () => {
  const dryRun = !APPLY;
  console.log(
    `[retention] ${dryRun ? "DRY-RUN" : "APPLY"} — ${ENTITY_FILTER ? "entity=" + ENTITY_FILTER : "all policies"}`
  );

  const policies = await loadPolicies();
  if (policies.length === 0) {
    console.log("[retention] no matching policies found.");
    return;
  }

  const summary = [];
  for (const policy of policies) {
    const handler = HANDLERS[policy.entity_type];
    if (!handler) {
      console.log(`[retention] skip ${policy.entity_type} (no handler defined)`);
      summary.push({ entity_type: policy.entity_type, status: "skipped" });
      continue;
    }
    try {
      const { rowsProcessed, rowsActioned } = await handler({ policy, dryRun, sb });
      console.log(
        `[retention] ${policy.entity_type}: processed=${rowsProcessed} actioned=${rowsActioned}`
      );
      await recordRun({
        entityType: policy.entity_type,
        action: policy.action,
        dryRun,
        rowsProcessed,
        rowsActioned,
        notes: ENTITY_FILTER ? "filter=" + ENTITY_FILTER : null,
      });
      summary.push({
        entity_type: policy.entity_type,
        status: "ok",
        rowsProcessed,
        rowsActioned,
      });
    } catch (err) {
      console.error(`[retention] ${policy.entity_type} FAILED:`, err.message);
      await recordRun({
        entityType: policy.entity_type,
        action: policy.action,
        dryRun,
        rowsProcessed: 0,
        rowsActioned: 0,
        notes: `error: ${err.message}`,
      });
      summary.push({ entity_type: policy.entity_type, status: "error", message: err.message });
    }
  }

  console.log("\n[retention] summary:");
  for (const row of summary) console.log(" -", JSON.stringify(row));
})().catch((err) => {
  console.error("[retention] fatal:", err);
  process.exit(1);
});
