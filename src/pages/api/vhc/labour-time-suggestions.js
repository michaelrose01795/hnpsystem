// file location: src/pages/api/vhc/labour-time-suggestions.js

import { supabase } from "@/lib/supabaseClient";
import { buildNormalizedKey, isValidUuid, tokenize } from "@/features/labour-times/normalization";
import { rankSuggestions } from "@/features/labour-times/ranking";
import { getCachedValue, setCachedValue } from "@/features/labour-times/cache";
import { estimateLabourHours } from "@/features/labour-times/fallbackEstimator";

const LABOUR_SUGGEST_DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LABOUR_SUGGESTIONS === "1";

const buildSearchFilter = (tokens = []) => {
  const clean = (tokens || []).filter(Boolean).slice(0, 4);
  if (clean.length === 0) return null;
  return clean
    .map((token) => {
      const escaped = String(token).replace(/,/g, "").trim();
      return `normalized_key.ilike.%${escaped}%,display_description.ilike.%${escaped}%`;
    })
    .join(",");
};

const dedupeByKey = (rows = []) => {
  const byKey = new Map();
  for (const row of rows) {
    const mapKey = `${row.source}:${row.scope || "none"}:${row.normalizedKey}:${row.timeHours}`;
    if (!byKey.has(mapKey)) {
      byKey.set(mapKey, row);
    }
  }
  return Array.from(byKey.values());
};

const buildFallbackSuggestion = ({ description = "", normalizedKey = "" } = {}) => {
  const estimate = estimateLabourHours(description);
  return {
    id: `fallback:${normalizedKey || "default"}`,
    source: "fallback",
    scope: null,
    displayDescription: description,
    normalizedKey: normalizedKey || "",
    timeHours: Number(estimate.hours),
    usageCount: 0,
    confidence: estimate.confidence || "low",
    reason: estimate.reason || "fallback default",
    tags: [],
    defaultOrder: 999999,
  };
};

const toSuggestionResponse = (item = {}) => ({
  id: item.id,
  source: item.source,
  scope: item.scope || null,
  displayDescription: item.displayDescription || "",
  normalizedKey: item.normalizedKey || "",
  timeHours: Number(item.timeHours),
  usageCount: Number(item.usageCount || 0),
  confidence: item.confidence || null,
  reason: item.reason || null,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const description = String(req.body?.description || "").trim();
    const userId = String(req.body?.userId || "").trim();
    const normalizedKey = buildNormalizedKey(description);
    const queryTokens = tokenize(description);
    const fallbackSuggestion = buildFallbackSuggestion({ description, normalizedKey });

    if (!description || !normalizedKey) {
      if (LABOUR_SUGGEST_DEBUG) {
        console.log("[labour-time-suggestions] Using fallback for blank description");
      }
      res.status(200).json({
        success: true,
        normalizedKey,
        suggestions: [toSuggestionResponse(fallbackSuggestion)],
      });
      return;
    }

    const cacheKey = `labour:suggest:${normalizedKey}:${isValidUuid(userId) ? userId : "anon"}`;
    const cached = getCachedValue(cacheKey, 45000);
    if (cached) {
      const cachedWithFallback = Array.isArray(cached) ? cached : [];
      const hasFallback = cachedWithFallback.some((item) => item?.source === "fallback");
      const suggestions = hasFallback
        ? cachedWithFallback
        : [...cachedWithFallback.slice(0, 7), toSuggestionResponse(fallbackSuggestion)];
      res.status(200).json({ success: true, normalizedKey, suggestions: suggestions.map(toSuggestionResponse), cached: true });
      return;
    }

    const validUserId = isValidUuid(userId) ? userId : null;

    const [userExactResult, globalExactResult] = await Promise.all([
      validUserId
        ? supabase
            .from("labour_time_overrides")
            .select("id, normalized_key, override_time_hours, scope, user_id, usage_count, updated_at")
            .eq("scope", "user")
            .eq("user_id", validUserId)
            .eq("normalized_key", normalizedKey)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("labour_time_overrides")
        .select("id, normalized_key, override_time_hours, scope, usage_count, updated_at")
        .eq("scope", "global")
        .eq("normalized_key", normalizedKey)
        .limit(1)
        .maybeSingle(),
    ]);

    const exactSuggestions = [];
    if (userExactResult?.data) {
      exactSuggestions.push({
        id: userExactResult.data.id,
        source: "learned",
        scope: "user",
        displayDescription: description,
        normalizedKey: userExactResult.data.normalized_key,
        timeHours: Number(userExactResult.data.override_time_hours),
        usageCount: Number(userExactResult.data.usage_count || 0),
        defaultOrder: 0,
      });
    }
    if (globalExactResult?.data) {
      exactSuggestions.push({
        id: globalExactResult.data.id,
        source: "learned",
        scope: "global",
        displayDescription: description,
        normalizedKey: globalExactResult.data.normalized_key,
        timeHours: Number(globalExactResult.data.override_time_hours),
        usageCount: Number(globalExactResult.data.usage_count || 0),
        defaultOrder: 1,
      });
    }

    const filter = buildSearchFilter(queryTokens);

    const [globalOverridesResult, userOverridesResult, presetRowsResult] = await Promise.all([
      supabase
        .from("labour_time_overrides")
        .select("id, normalized_key, override_time_hours, scope, user_id, usage_count, updated_at")
        .eq("scope", "global")
        .order("usage_count", { ascending: false })
        .limit(120),
      validUserId
        ? supabase
            .from("labour_time_overrides")
            .select("id, normalized_key, override_time_hours, scope, user_id, usage_count, updated_at")
            .eq("scope", "user")
            .eq("user_id", validUserId)
            .order("usage_count", { ascending: false })
            .limit(120)
        : Promise.resolve({ data: [] }),
      (() => {
        let query = supabase
          .from("labour_time_presets")
          .select("id, normalized_key, display_description, default_time_hours, tags, created_at")
          .order("display_description", { ascending: true })
          .limit(280);

        if (filter) {
          query = query.or(filter);
        }

        return query;
      })(),
    ]);

    const overrideRows = [
      ...(Array.isArray(userOverridesResult?.data) ? userOverridesResult.data : []),
      ...(Array.isArray(globalOverridesResult?.data) ? globalOverridesResult.data : []),
    ];
    const presetRows = Array.isArray(presetRowsResult?.data) ? presetRowsResult.data : [];

    const candidates = [];

    exactSuggestions.forEach((item) => candidates.push(item));

    overrideRows.forEach((row, index) => {
      if (row.scope === "user" && validUserId && row.user_id !== validUserId) return;
      candidates.push({
        id: row.id,
        source: "learned",
        scope: row.scope,
        displayDescription: description,
        normalizedKey: row.normalized_key,
        timeHours: Number(row.override_time_hours),
        usageCount: Number(row.usage_count || 0),
        tags: [],
        defaultOrder: 100 + index,
      });
    });

    presetRows.forEach((row, index) => {
      candidates.push({
        id: row.id,
        source: "preset",
        scope: null,
        displayDescription: row.display_description,
        normalizedKey: row.normalized_key,
        timeHours: Number(row.default_time_hours),
        usageCount: 0,
        tags: Array.isArray(row.tags) ? row.tags : [],
        defaultOrder: 1000 + index,
      });
    });

    candidates.push(fallbackSuggestion);

    const rankedRaw = rankSuggestions({
      queryText: description,
      suggestions: dedupeByKey(candidates),
      limit: 8,
    });

    const hasFallbackInRanked = rankedRaw.some((item) => item?.source === "fallback");
    const ranked = hasFallbackInRanked ? rankedRaw : [...rankedRaw.slice(0, 7), toSuggestionResponse(fallbackSuggestion)];

    if (LABOUR_SUGGEST_DEBUG) {
      console.log("[labour-time-suggestions] Ranked suggestions", {
        normalizedKey,
        count: ranked.length,
        hasFallback: ranked.some((item) => item?.source === "fallback"),
      });
    }

    setCachedValue(cacheKey, ranked);

    res.status(200).json({
      success: true,
      normalizedKey,
      suggestions: ranked.map(toSuggestionResponse),
    });
  } catch (error) {
    console.error("Failed to fetch labour time suggestions", error);
    res.status(500).json({ success: false, message: "Failed to fetch labour suggestions" });
  }
}
