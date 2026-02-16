// file location: src/pages/api/vhc/labour-time-overrides.js

import { supabase } from "@/lib/supabaseClient";
import getUserFromRequest from "@/lib/auth/getUserFromRequest";
import { buildNormalizedKey, isValidUuid } from "@/features/labour-times/normalization";
import { clearCacheByPrefix } from "@/features/labour-times/cache";

const GLOBAL_WRITE_ROLES = new Set(["admin", "manager"]);

const normalizeScope = (value = "") => {
  const cleaned = String(value || "").toLowerCase().trim();
  if (cleaned === "global") return "global";
  return "user";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const description = String(req.body?.description || "").trim();
    const timeHours = Number(req.body?.timeHours);
    const scope = normalizeScope(req.body?.scope);
    const userId = String(req.body?.userId || "").trim();

    if (!description) {
      res.status(400).json({ success: false, message: "description is required" });
      return;
    }

    if (!Number.isFinite(timeHours) || timeHours < 0) {
      res.status(400).json({ success: false, message: "timeHours must be a positive number" });
      return;
    }

    const normalizedKey = buildNormalizedKey(description);
    if (!normalizedKey) {
      res.status(400).json({ success: false, message: "description does not contain searchable tokens" });
      return;
    }

    const requestUser = await getUserFromRequest(req);
    const role = String(requestUser?.role || "").toLowerCase();

    if (scope === "global" && !GLOBAL_WRITE_ROLES.has(role)) {
      res.status(403).json({ success: false, message: "Global overrides require Admin or Manager role" });
      return;
    }

    if (scope === "user" && !isValidUuid(userId)) {
      res.status(400).json({ success: false, message: "userId must be a UUID for user scoped overrides" });
      return;
    }

    const nowIso = new Date().toISOString();

    const existingQuery = supabase
      .from("labour_time_overrides")
      .select("id, usage_count")
      .eq("normalized_key", normalizedKey)
      .eq("scope", scope)
      .limit(1);

    const existingResult = scope === "user"
      ? await existingQuery.eq("user_id", userId).maybeSingle()
      : await existingQuery.is("user_id", null).maybeSingle();

    if (existingResult?.data?.id) {
      const usageCount = Number(existingResult.data.usage_count || 0) + 1;
      const updateResult = await supabase
        .from("labour_time_overrides")
        .update({
          override_time_hours: timeHours,
          usage_count: usageCount,
          last_used_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existingResult.data.id)
        .select("id, normalized_key, override_time_hours, scope, user_id, usage_count, last_used_at, updated_at")
        .single();

      if (updateResult.error) {
        throw updateResult.error;
      }

      clearCacheByPrefix("labour:suggest:");
      res.status(200).json({ success: true, override: updateResult.data, mode: "updated" });
      return;
    }

    const insertResult = await supabase
      .from("labour_time_overrides")
      .insert({
        normalized_key: normalizedKey,
        override_time_hours: timeHours,
        scope,
        user_id: scope === "user" ? userId : null,
        usage_count: 1,
        last_used_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, normalized_key, override_time_hours, scope, user_id, usage_count, last_used_at, updated_at")
      .single();

    if (insertResult.error) {
      throw insertResult.error;
    }

    clearCacheByPrefix("labour:suggest:");
    res.status(200).json({ success: true, override: insertResult.data, mode: "created" });
  } catch (error) {
    console.error("Failed to save labour override", error);
    res.status(500).json({ success: false, message: "Failed to save labour override" });
  }
}
