// file location: src/pages/api/vhc/parts-search-learning.js

import { supabase } from "@/lib/supabaseClient";
import getUserFromRequest from "@/lib/auth/getUserFromRequest";
import {
  buildNormalizedContextKey,
  buildVehicleContextText,
  normalizeText,
} from "@/features/parts-search-suggestions/normalization";
import { clearSuggestionCache } from "@/features/parts-search-suggestions/cache";
import { isValidUuid } from "@/features/labour-times/normalization";

const ADMIN_ROLES = new Set(["admin", "manager"]);

const normalizeScope = (value = "") => {
  return String(value || "").toLowerCase().trim() === "global" ? "global" : "user";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const contextText = String(req.body?.contextText || "").trim();
    const finalQuery = String(req.body?.finalQuery || "").trim();
    const selectedSuggestion = String(req.body?.selectedSuggestion || "").trim();
    const userId = String(req.body?.userId || "").trim();
    const jobId = req.body?.jobId || null;
    const scope = normalizeScope(req.body?.scope);
    const vehicleContext = req.body?.vehicleContext || {};

    if (!contextText || !finalQuery) {
      res.status(400).json({ success: false, message: "contextText and finalQuery are required" });
      return;
    }

    if (scope === "user" && !isValidUuid(userId)) {
      res.status(400).json({ success: false, message: "userId is required for user scope" });
      return;
    }

    const requestUser = await getUserFromRequest(req);
    const role = String(requestUser?.role || "").toLowerCase();
    if (scope === "global" && !ADMIN_ROLES.has(role)) {
      res.status(403).json({ success: false, message: "Global writes require Admin/Manager role" });
      return;
    }

    const vehicleText = typeof vehicleContext === "string"
      ? normalizeText(vehicleContext)
      : buildVehicleContextText(vehicleContext || {});

    const combinedContext = [contextText, vehicleText].filter(Boolean).join(" ").trim();
    const normalizedContextKey = buildNormalizedContextKey(combinedContext);
    if (!normalizedContextKey) {
      res.status(400).json({ success: false, message: "Could not derive normalized context key" });
      return;
    }

    const now = new Date().toISOString();

    const existingQuery = supabase
      .from("parts_search_learned")
      .select("id, usage_count")
      .eq("normalized_context_key", normalizedContextKey)
      .eq("learned_query", finalQuery)
      .eq("scope", scope)
      .limit(1);

    const existingResult = scope === "user"
      ? await existingQuery.eq("user_id", userId).maybeSingle()
      : await existingQuery.is("user_id", null).maybeSingle();

    let learnedRecord = null;

    if (existingResult?.data?.id) {
      const updateResult = await supabase
        .from("parts_search_learned")
        .update({
          usage_count: Number(existingResult.data.usage_count || 0) + 1,
          last_used_at: now,
          updated_at: now,
        })
        .eq("id", existingResult.data.id)
        .select("id, normalized_context_key, learned_query, scope, user_id, usage_count, last_used_at, updated_at")
        .single();
      if (updateResult.error) throw updateResult.error;
      learnedRecord = updateResult.data;
    } else {
      const insertResult = await supabase
        .from("parts_search_learned")
        .insert({
          normalized_context_key: normalizedContextKey,
          learned_query: finalQuery,
          scope,
          user_id: scope === "user" ? userId : null,
          usage_count: 1,
          last_used_at: now,
          updated_at: now,
        })
        .select("id, normalized_context_key, learned_query, scope, user_id, usage_count, last_used_at, updated_at")
        .single();
      if (insertResult.error) throw insertResult.error;
      learnedRecord = insertResult.data;
    }

    const eventPayload = {
      user_id: isValidUuid(userId) ? userId : null,
      job_id: jobId || null,
      context_text: contextText,
      selected_suggestion: selectedSuggestion || null,
      final_query: finalQuery,
    };

    await supabase.from("parts_search_events").insert(eventPayload);

    clearSuggestionCache("parts:suggest:");

    res.status(200).json({
      success: true,
      learned: learnedRecord,
    });
  } catch (error) {
    console.error("Failed to save parts search learning", error);
    res.status(500).json({ success: false, message: "Failed to save parts search learning" });
  }
}
