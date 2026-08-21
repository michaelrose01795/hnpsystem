import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const VALID_MODES = new Set(["light", "dark", "system"]);
const VALID_ACCENTS = new Set(["red", "beige", "grey", "blue", "green", "yellow", "pink", "orange", "purple"]);

const normalizeMode = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return VALID_MODES.has(normalized) ? normalized : null;
};

const normalizeAccent = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return VALID_ACCENTS.has(normalized) ? normalized : null;
};

async function resolveRequestUserId(req, res) {
  if (process.env.NODE_ENV !== "production") {
    const devUserId = Number.parseInt(String(req.query.userId || req.body?.userId || ""), 10);
    if (Number.isInteger(devUserId) && devUserId > 0) {
      return devUserId;
    }
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    throw new Error("Authentication required");
  }

  return resolveSessionUserId(session);
}

// Read the caller's saved theme preference.
//
// This lived in the browser (themeProvider.js queried `users` through
// supabaseClient). That single import put the whole @supabase/supabase-js client
// — postgrest + realtime + GoTrue, ~213KB — into the first-load bundle of all 163
// routes, INCLUDING /login, where the query can never even run: it is gated on a
// numeric user id, and nobody is signed in yet.
//
// The accent_color fallback is preserved exactly: some deployments predate that
// column, so a failure on the two-column select retries with dark_mode alone.
async function readThemePreference(req, res) {
  try {
    const userId = await resolveRequestUserId(req, res);
    if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
      return res.status(200).json({ success: true, data: { mode: null, accent: null } });
    }

    const db = supabaseService || supabase;
    res.setHeader("Cache-Control", "private, no-store");

    const full = await db
      .from("users")
      .select("dark_mode, accent_color")
      .eq("user_id", userId)
      .maybeSingle();

    if (!full.error) {
      return res.status(200).json({
        success: true,
        data: { mode: full.data?.dark_mode ?? null, accent: full.data?.accent_color ?? null },
      });
    }

    // accent_color unavailable on this deployment — fall back to mode only.
    const modeOnly = await db
      .from("users")
      .select("dark_mode")
      .eq("user_id", userId)
      .maybeSingle();

    if (modeOnly.error) throw modeOnly.error;
    return res.status(200).json({
      success: true,
      data: { mode: modeOnly.data?.dark_mode ?? null, accent: null },
    });
  } catch (error) {
    const statusCode = error?.message === "Authentication required" ? 401 : 500;
    if (statusCode !== 401) {
      console.error("❌ GET /api/profile/theme-preferences error", error);
    }
    return res.status(statusCode).json({
      success: false,
      message: "Failed to load theme preferences",
    });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return readThemePreference(req, res);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const mode = normalizeMode(req.body?.mode);
  const accent = normalizeAccent(req.body?.accent);

  if (!mode && !accent) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid theme mode or accent preference.",
    });
  }

  try {
    const userId = await resolveRequestUserId(req, res);
    const db = supabaseService || supabase;
    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (mode) {
      updates.dark_mode = mode;
    }
    if (accent) {
      updates.accent_color = accent;
    }

    const { data, error } = await db
      .from("users")
      .update(updates)
      .eq("user_id", userId)
      .select("user_id, dark_mode, accent_color")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: data?.user_id ?? userId,
        mode: data?.dark_mode ?? mode ?? null,
        accent: data?.accent_color ?? accent ?? null,
      },
    });
  } catch (error) {
    console.error("❌ /api/profile/theme-preferences error", error);
    const statusCode = error?.message === "Authentication required" ? 401 : 500;
    return res.status(statusCode).json({
      success: false,
      message: "Failed to save theme preferences",
      error: error.message,
    });
  }
}
