import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { supabaseService } from "@/lib/database/supabaseClient";

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (!supabaseService) {
    return res.status(503).json({ success: false, message: "Database service is unavailable" });
  }

  let userId = await resolveSessionUserId(session).catch(() => null);
  if (!userId && session?.devBypass && process.env.NODE_ENV !== "production") {
    userId = parsePositiveInteger(req.query.userId);
  }
  if (!userId) {
    return res.status(404).json({ success: false, message: "User profile not found" });
  }

  const { data, error } = await supabaseService
    .from("users")
    .select("user_id, signature_file_url, signature_storage_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Signature lookup failed", error);
    return res.status(500).json({ success: false, message: "Failed to load signature" });
  }

  return res.status(200).json({ success: true, data: data || null });
}

export default withRoleGuard(handler);
