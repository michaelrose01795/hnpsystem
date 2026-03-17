// file location: src/lib/database/jobRequestPresets.js

import { getDatabaseClient } from "@/lib/database/client";
import { isDiagnosticRequestText, normalizePresetText, tokenizePresetText } from "@/lib/jobRequestPresets/constants";
import { rankJobRequestPresets, scorePresetMatch } from "@/lib/jobRequestPresets/matching";

const supabase = getDatabaseClient();

const toPresetResponse = (row = {}) => ({
  id: row.id,
  label: row.label || "",
  aliases: Array.isArray(row.aliases) ? row.aliases : [],
  defaultHours: Number(row.default_hours ?? row.defaultHours ?? 0),
  isActive: row.is_active !== false,
  usageCount: Number(row.usage_count || 0),
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const buildSearchOrFilter = (query = "") => {
  const normalized = normalizePresetText(query);
  if (!normalized) return null;

  const tokens = tokenizePresetText(normalized).slice(0, 4);
  const clauses = [`label.ilike.%${normalized}%`, `normalized_label.ilike.%${normalized}%`];
  tokens.forEach((token) => {
    clauses.push(`label.ilike.%${token}%`);
    clauses.push(`normalized_label.ilike.%${token}%`);
    clauses.push(`aliases.cs.{${token}}`);
    clauses.push(`normalized_aliases.cs.{${token}}`);
  });

  return clauses.join(",");
};

export const searchJobRequestPresets = async ({ query = "", limit = 8 } = {}) => {
  const normalizedQuery = normalizePresetText(query);
  const resolvedLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const orFilter = buildSearchOrFilter(normalizedQuery);

  let dbQuery = supabase
    .from("job_request_presets")
    .select("id, label, aliases, default_hours, is_active, usage_count, created_at, updated_at")
    .eq("is_active", true)
    .limit(normalizedQuery ? 80 : 40);

  if (orFilter) {
    dbQuery = dbQuery.or(orFilter);
  }

  const { data, error } = await dbQuery;
  if (error) {
    throw error;
  }

  const candidates = (Array.isArray(data) ? data : []).map(toPresetResponse);
  const ranked = rankJobRequestPresets({ query: normalizedQuery, presets: candidates, limit: resolvedLimit });

  return ranked;
};

export const getJobRequestPresetById = async (presetId) => {
  const parsedId = Number(presetId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return null;

  const { data, error } = await supabase
    .from("job_request_presets")
    .select("id, label, aliases, default_hours, is_active, usage_count, created_at, updated_at")
    .eq("id", parsedId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? toPresetResponse(data) : null;
};

export const resolvePresetFromRequestText = async (requestText = "") => {
  const normalized = normalizePresetText(requestText);
  if (!normalized) return null;

  const { data: exactRow, error: exactError } = await supabase
    .from("job_request_presets")
    .select("id, label, aliases, default_hours, is_active, usage_count, created_at, updated_at")
    .eq("is_active", true)
    .eq("normalized_label", normalized)
    .maybeSingle();

  if (exactError) throw exactError;
  if (exactRow) return toPresetResponse(exactRow);

  const suggestions = await searchJobRequestPresets({ query: normalized, limit: 3 });
  const topMatch = suggestions[0] || null;
  if (!topMatch) return null;

  const matchScore = scorePresetMatch(normalized, topMatch);
  if (matchScore < 30) return null;
  return topMatch;
};

export const updateJobRequestPresetDefaultHours = async ({
  presetId = null,
  requestText = "",
  defaultHours,
  forceDiagnosticHours = false,
} = {}) => {
  const parsedHours = Number(defaultHours);
  if (!Number.isFinite(parsedHours) || parsedHours < 0) {
    throw new Error("defaultHours must be a non-negative number");
  }

  let targetPreset = null;
  if (presetId !== null && presetId !== undefined && presetId !== "") {
    targetPreset = await getJobRequestPresetById(presetId);
  }

  if (!targetPreset && requestText) {
    targetPreset = await resolvePresetFromRequestText(requestText);
  }

  if (!targetPreset) {
    return { success: false, matched: false, reason: "No matching preset found" };
  }

  const applyDiagnosticRule = forceDiagnosticHours || isDiagnosticRequestText(requestText || targetPreset.label);
  const nextHours = applyDiagnosticRule ? 1 : parsedHours;

  const { data, error } = await supabase
    .from("job_request_presets")
    .update({
      default_hours: nextHours,
      usage_count: Number(targetPreset.usageCount || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetPreset.id)
    .select("id, label, aliases, default_hours, is_active, usage_count, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    success: true,
    matched: true,
    preset: toPresetResponse(data),
    diagnosticApplied: applyDiagnosticRule,
  };
};
