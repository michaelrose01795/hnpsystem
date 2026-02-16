// file location: src/pages/api/vhc/parts-search-suggestions.js

import { supabase } from "@/lib/supabaseClient";
import {
  buildNormalizedContextKey,
  buildVehicleContextText,
  normalizeText,
  tokenizeContext,
} from "@/features/parts-search-suggestions/normalization";
import { rankPartSuggestions } from "@/features/parts-search-suggestions/ranking";
import { getSuggestionCache, setSuggestionCache } from "@/features/parts-search-suggestions/cache";
import { isValidUuid } from "@/features/labour-times/normalization";

const buildContextFilter = (tokens = []) => {
  const clean = (tokens || []).filter(Boolean).slice(0, 4);
  if (clean.length === 0) return null;
  return clean
    .map((token) => {
      const safe = String(token).replace(/,/g, "").trim();
      return `normalized_context_key.ilike.%${safe}%,suggested_query.ilike.%${safe}%`;
    })
    .join(",");
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const contextText = String(req.body?.contextText || "").trim();
    const userId = String(req.body?.userId || "").trim();
    const vehicleContext = req.body?.vehicleContext || {};

    const vehicleText = typeof vehicleContext === "string"
      ? normalizeText(vehicleContext)
      : buildVehicleContextText(vehicleContext || {});

    const combinedContext = [contextText, vehicleText].filter(Boolean).join(" ").trim();
    const normalizedContextKey = buildNormalizedContextKey(combinedContext);

    if (!normalizedContextKey) {
      res.status(200).json({ success: true, suggestions: [], normalizedContextKey: "" });
      return;
    }

    const cacheKey = `parts:suggest:${normalizedContextKey}:${isValidUuid(userId) ? userId : "anon"}`;
    const cached = getSuggestionCache(cacheKey, 45000);
    if (cached) {
      res.status(200).json({ success: true, suggestions: cached, normalizedContextKey, cached: true });
      return;
    }

    const validUserId = isValidUuid(userId) ? userId : null;
    const contextTokens = tokenizeContext(combinedContext);
    const filter = buildContextFilter(contextTokens);

    const [globalLearnedResult, userLearnedResult, presetsResult] = await Promise.all([
      (() => {
        let query = supabase
          .from("parts_search_learned")
          .select("id, normalized_context_key, learned_query, scope, usage_count, updated_at")
          .eq("scope", "global")
          .order("usage_count", { ascending: false })
          .limit(200);
        if (filter) query = query.or(filter);
        return query;
      })(),
      validUserId
        ? (() => {
            let query = supabase
              .from("parts_search_learned")
              .select("id, normalized_context_key, learned_query, scope, user_id, usage_count, updated_at")
              .eq("scope", "user")
              .eq("user_id", validUserId)
              .order("usage_count", { ascending: false })
              .limit(200);
            if (filter) query = query.or(filter);
            return query;
          })()
        : Promise.resolve({ data: [] }),
      (() => {
        let query = supabase
          .from("parts_search_presets")
          .select("id, normalized_context_key, context_keywords, suggested_query, tags, created_at")
          .order("suggested_query", { ascending: true })
          .limit(500);
        if (filter) query = query.or(filter);
        return query;
      })(),
    ]);

    const candidates = [];
    const dedupe = new Set();

    const addCandidate = (candidate) => {
      const key = `${candidate.source}:${candidate.scope || "none"}:${candidate.query}`;
      if (dedupe.has(key)) return;
      dedupe.add(key);
      candidates.push(candidate);
    };

    (Array.isArray(userLearnedResult?.data) ? userLearnedResult.data : []).forEach((row, index) => {
      addCandidate({
        id: row.id,
        query: row.learned_query,
        source: "learned",
        scope: "user",
        normalizedContextKey: row.normalized_context_key,
        usageCount: Number(row.usage_count || 0),
        reason: "user learned",
        defaultOrder: index,
      });
    });

    (Array.isArray(globalLearnedResult?.data) ? globalLearnedResult.data : []).forEach((row, index) => {
      addCandidate({
        id: row.id,
        query: row.learned_query,
        source: "learned",
        scope: "global",
        normalizedContextKey: row.normalized_context_key,
        usageCount: Number(row.usage_count || 0),
        reason: "global learned",
        defaultOrder: 1000 + index,
      });
    });

    (Array.isArray(presetsResult?.data) ? presetsResult.data : []).forEach((row, index) => {
      addCandidate({
        id: row.id,
        query: row.suggested_query,
        source: "preset",
        scope: null,
        normalizedContextKey: row.normalized_context_key,
        usageCount: 0,
        reason: "preset",
        defaultOrder: 5000 + index,
      });
    });

    const ranked = rankPartSuggestions({
      contextText: combinedContext,
      candidates,
      limit: 10,
    });

    setSuggestionCache(cacheKey, ranked);

    res.status(200).json({
      success: true,
      normalizedContextKey,
      suggestions: ranked,
    });
  } catch (error) {
    console.error("Failed to get parts search suggestions", error);
    res.status(500).json({ success: false, message: "Failed to get parts search suggestions" });
  }
}
