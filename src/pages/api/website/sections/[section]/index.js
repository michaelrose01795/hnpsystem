// file location: src/pages/api/website/sections/[section]/index.js
//
// Per-section endpoint for the /staff/website-manager CMS.
//
//   GET    /api/website/sections/:section              -> singleton OR full collection (staff read - drafts included)
//   PATCH  /api/website/sections/:section              -> patch singleton (only valid for singleton sections)
//   POST   /api/website/sections/:section              -> create collection row (only valid for collection sections)
//   POST   /api/website/sections/:section/reorder      -> reorder collection (?op=reorder) - see reorder.js
//
// Per-row CRUD lives at [section]/[id].js.
//
// Section keys are the keys of SECTION_TABLES exported by @/lib/database/website
// (e.g. "hero", "vehicles", "team-members", "trust-points", ...).

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/database/supabaseClient";
import {
  SECTION_TABLES,
  upsertSingleton,
  upsertRow,
  logActivity,
} from "@/lib/database/website";

const WRITE_ROLES = [
  "owner",
  "admin",
  "admin manager",
  "general manager",
  "sales",
];

const actorFromSession = (session) =>
  session?.user?.username || session?.user?.name || session?.user?.email || "Staff User";

async function handler(req, res, session) {
  const { section } = req.query;
  const meta = SECTION_TABLES[section];
  if (!meta) {
    return res
      .status(404)
      .json({ success: false, message: `Unknown section "${section}"` });
  }

  // ---- READ ----------------------------------------------------------------
  if (req.method === "GET") {
    if (meta.kind === "singleton") {
      const { data, error } = await supabase
        .from(meta.table)
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (error) {
        console.error(`[api/website/sections/${section}] read error:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.status(200).json({ success: true, data: data || null });
    }
    const { data, error } = await supabase
      .from(meta.table)
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error(`[api/website/sections/${section}] read error:`, error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.status(200).json({ success: true, data: data || [] });
  }

  // ---- PATCH singleton -----------------------------------------------------
  if (req.method === "PATCH") {
    if (meta.kind !== "singleton") {
      return res.status(400).json({
        success: false,
        message: `Section "${section}" is a collection — PATCH /sections/${section}/[id] instead.`,
      });
    }
    const actor = actorFromSession(session);
    const result = await upsertSingleton(meta.table, req.body || {}, actor);
    if (!result.ok) {
      return res.status(500).json({ success: false, message: result.error });
    }
    await logActivity({
      actor,
      action: "Updated section",
      target: section,
      pageKey: null,
    });
    return res.status(200).json({ success: true, data: result.data });
  }

  // ---- POST create collection row -----------------------------------------
  if (req.method === "POST") {
    if (meta.kind !== "collection") {
      return res.status(400).json({
        success: false,
        message: `Section "${section}" is a singleton — use PATCH.`,
      });
    }
    const row = req.body || {};
    if (!row.id) {
      return res.status(400).json({
        success: false,
        message: "Collection rows require an `id` field (stable text PK).",
      });
    }
    const actor = actorFromSession(session);
    const result = await upsertRow(meta.table, row, actor);
    if (!result.ok) {
      return res.status(500).json({ success: false, message: result.error });
    }
    await logActivity({
      actor,
      action: "Created row",
      target: `${section}/${row.id}`,
      pageKey: null,
    });
    return res.status(201).json({ success: true, data: result.data });
  }

  res.setHeader("Allow", "GET, PATCH, POST");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

// GET is open to authenticated staff readers; writes require the same role set
// as the Website Manager page itself (see src/pages/staff/website-manager.js).
export default withRoleGuard(handler, { allow: WRITE_ROLES });
