// file location: src/lib/database/supportKnowledge.js
//
// Phase 10 — data layer for the engineering knowledge centre
// (support_knowledge_entries). Same privacy model; service-role behind
// dev-gated routes. Degrades gracefully when the migration is absent.

import { supabaseService } from "@/lib/database/supabaseClient";
import { supportTableExists } from "@/lib/database/supportTableProbe";

const TABLE = "support_knowledge_entries";
const STATUSES = new Set(["draft", "published", "archived"]);

export async function listKnowledgeEntries({ status } = {}) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: true, data: [] };
  try {
    let q = supabaseService.from(TABLE).select("*").order("updated_at", { ascending: false });
    if (status && STATUSES.has(status)) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function getKnowledgeEntry(id) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: true, data: null };
  try {
    const { data, error } = await supabaseService.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function normaliseEntry(input = {}) {
  return {
    fingerprint: input.fingerprint ?? null,
    title: String(input.title || "").trim(),
    body: input.body ?? null,
    category: input.category ?? null,
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 20) : null,
    report_ids: Array.isArray(input.reportIds) ? input.reportIds : null,
    links: Array.isArray(input.links) ? input.links : [],
    status: STATUSES.has(input.status) ? input.status : "published",
  };
}

export async function createKnowledgeEntry(input = {}, { authorKey = null } = {}) {
  if (!supabaseService) return { ok: false, error: "Service client not configured." };
  if (!(await supportTableExists(TABLE))) return { ok: false, error: "Knowledge table not applied." };
  const row = normaliseEntry(input);
  if (!row.title) return { ok: false, error: "A title is required." };
  row.author_key = authorKey;
  row.updated_at = new Date().toISOString();
  try {
    const { data, error } = await supabaseService.from(TABLE).insert([row]).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateKnowledgeEntry(id, patch = {}) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: false, error: "Knowledge table not applied." };
  const update = { updated_at: new Date().toISOString() };
  const n = normaliseEntry({ ...patch });
  ["fingerprint", "title", "body", "category", "tags", "report_ids", "links", "status"].forEach((k) => {
    if (patch[k] !== undefined || (k === "report_ids" && patch.reportIds !== undefined)) update[k] = n[k];
  });
  if (update.title !== undefined && !update.title) return { ok: false, error: "Title cannot be empty." };
  try {
    const { data, error } = await supabaseService.from(TABLE).update(update).eq("id", id).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Entry not found." };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteKnowledgeEntry(id) {
  if (!supabaseService || !(await supportTableExists(TABLE))) return { ok: false, error: "Knowledge table not applied." };
  try {
    const { error } = await supabaseService.from(TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
