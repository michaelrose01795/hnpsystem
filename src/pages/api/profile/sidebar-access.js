// API endpoint for fetching the authenticated user's own sidebar-access snapshot.
// Any authenticated user may read their own snapshot — it is what UserContext
// feeds to the sidebar filter and the client route guard (pageAccess.js).
// A null value means "no override" → role-derived navigation (the default).
// file location: src/pages/api/profile/sidebar-access.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/database/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";

async function getSidebarAccess(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("sidebar_access")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("❌ getSidebarAccess error", error);
    throw error;
  }
  return data?.sidebar_access ?? null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Mirror /api/profile/me.js auth resolution: dev bypass (non-production only)
    // or a real NextAuth session.
    const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
    const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
    const allowDevBypass =
      devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));

    let userId = null;

    if (allowDevBypass && req.query.userId) {
      userId = parseInt(req.query.userId, 10);
    } else {
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      userId = await resolveSessionUserId(session);
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      // No resolvable DB user (e.g. synthetic dev-platform login) — no override.
      return res.status(200).json({ success: true, sidebarAccess: null });
    }

    const sidebarAccess = await getSidebarAccess(userId);
    return res.status(200).json({ success: true, sidebarAccess });
  } catch (error) {
    console.error("❌ /api/profile/sidebar-access error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load sidebar access",
      error: error.message,
    });
  }
}
