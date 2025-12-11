// API route that proxies overtime session writes through a Supabase Edge Function
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getFunctionsBaseUrl = () => {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return supabaseUrl.replace(".supabase.co", ".functions.supabase.co");
};

async function resolveUserId(req, res) {
  const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
  const allowDevBypass =
    devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));

  if (allowDevBypass) {
    const queryUserId = req.query.userId || req.body?.userId;
    if (queryUserId) {
      return parseInt(queryUserId, 10);
    }

    const { data: firstUser, error: firstUserError } = await supabase
      .from("users")
      .select("user_id")
      .limit(1)
      .single();

    if (firstUserError) {
      throw new Error("Dev bypass enabled but no default user found");
    }

    return firstUser.user_id;
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    throw new Error("Authentication required");
  }

  const identifier = session.user.email || session.user.name;
  if (!identifier) {
    throw new Error("Unable to resolve user identity");
  }

  let query = supabase.from("users").select("user_id").limit(1);

  if (session.user.email) {
    query = query.eq("email", session.user.email);
  } else if (session.user.name) {
    query = query.or(`first_name.ilike.${session.user.name},last_name.ilike.${session.user.name}`);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    throw new Error("User profile not found");
  }

  return data.user_id;
}

async function getActiveOvertimePeriod() {
  const { data, error } = await supabase
    .from("overtime_periods")
    .select("period_id, period_start, period_end")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data || null;
}

function normalizeSession(row) {
  return {
    id: row.session_id,
    periodId: row.period_id,
    userId: row.user_id,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
    totalHours: Number(row.total_hours || 0),
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (!supabaseServiceKey) {
    return res.status(500).json({ success: false, message: "SUPABASE_SERVICE_ROLE_KEY missing" });
  }

  try {
    const { date, start, end, notes = "" } = req.body || {};

    if (!date || !start || !end) {
      return res
        .status(400)
        .json({ success: false, message: "date, start, and end fields are required" });
    }

    const userId = await resolveUserId(req, res);
    const activePeriod = await getActiveOvertimePeriod();

    if (!activePeriod?.period_id) {
      return res.status(409).json({
        success: false,
        message: "No active overtime period found. Please create one before logging sessions.",
      });
    }

    const diffMs = new Date(`${date}T${end}`) - new Date(`${date}T${start}`);
    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time for overtime sessions.",
      });
    }

    const functionResponse = await fetch(`${getFunctionsBaseUrl()}/overtime-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        userId,
        periodId: activePeriod.period_id,
        date,
        start,
        end,
        notes,
      }),
    });

    const payload = await functionResponse.json();

    if (!functionResponse.ok) {
      const message = payload?.message || "Failed to persist overtime session";
      return res.status(functionResponse.status).json({ success: false, message });
    }

    if (!payload?.data) {
      return res.status(500).json({ success: false, message: "Edge function returned no session data" });
    }

    return res.status(200).json({
      success: true,
      data: normalizeSession(payload.data),
    });
  } catch (error) {
    console.error("❌ overtime session API error", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
