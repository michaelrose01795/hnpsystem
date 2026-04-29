// Thin generic CRUD wrappers around the compliance register tables.
// All write paths call writeAuditLog so changes are traceable.

import { supabaseService } from "@/lib/database/supabaseClient";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { shallowDiff } from "@/lib/audit/auditContext";

const ALLOWED_TABLES = new Set([
  "subject_requests",
  "breach_records",
  "processing_activities",
  "dpia_records",
  "retention_policies",
]);

const requireService = () => {
  if (!supabaseService) {
    throw new Error("Supabase service client unavailable.");
  }
};

const requireTable = (table) => {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Unknown register table: ${table}`);
  }
};

export async function listRegister(table, { limit = 200, orderBy = "created_at", ascending = false } = {}) {
  requireService();
  requireTable(table);
  const { data, error } = await supabaseService
    .from(table)
    .select("*")
    .order(orderBy, { ascending })
    .limit(limit);
  if (error) throw new Error(`listRegister(${table}): ${error.message}`);
  return data || [];
}

export async function createRegisterRow(table, payload, auditCtx) {
  requireService();
  requireTable(table);
  const { data, error } = await supabaseService
    .from(table)
    .insert([payload])
    .select("*")
    .single();
  if (error) throw new Error(`createRegisterRow(${table}): ${error.message}`);
  await writeAuditLog({
    ...(auditCtx || {}),
    action: "create",
    entityType: table,
    entityId: data?.id ?? null,
    diff: { after: data },
  });
  return data;
}

export async function updateRegisterRow(table, id, patch, auditCtx) {
  requireService();
  requireTable(table);
  const { data: before } = await supabaseService
    .from(table)
    .select("*")
    .eq(table === "retention_policies" ? "entity_type" : "id", id)
    .maybeSingle();

  const updatePayload = { ...patch, updated_at: new Date().toISOString() };
  const { data: after, error } = await supabaseService
    .from(table)
    .update(updatePayload)
    .eq(table === "retention_policies" ? "entity_type" : "id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateRegisterRow(${table}): ${error.message}`);

  await writeAuditLog({
    ...(auditCtx || {}),
    action: "update",
    entityType: table,
    entityId: id,
    diff: shallowDiff(before, after),
  });
  return after;
}
