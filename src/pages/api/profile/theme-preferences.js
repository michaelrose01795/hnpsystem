import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { supabaseService, supabase } from "@/lib/supabaseClient";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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
