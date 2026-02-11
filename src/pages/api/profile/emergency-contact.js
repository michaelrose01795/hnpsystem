// API route for updating the authenticated user's emergency contact
// file location: src/pages/api/profile/emergency-contact.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";

async function resolveUserId(req, res) {
  const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
  const allowDevBypass =
    devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));

  if (allowDevBypass) {
    const queryUserId = req.query.userId || req.body?.userId;
    if (queryUserId) return parseInt(queryUserId, 10);

    const { data: firstUser, error: firstUserError } = await supabase
      .from("users")
      .select("user_id")
      .limit(1)
      .single();

    if (firstUserError) throw new Error("Dev bypass enabled but no default user found");
    return firstUser.user_id;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) throw new Error("Authentication required");

  const identifier = session.user.email || session.user.name;
  if (!identifier) throw new Error("Unable to resolve user identity");

  let query = supabase.from("users").select("user_id").limit(1);
  if (session.user.email) {
    query = query.eq("email", session.user.email);
  } else {
    query = query.or(`first_name.ilike.${session.user.name},last_name.ilike.${session.user.name}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("User profile not found");
  return data.user_id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const userId = await resolveUserId(req, res);
    const { name, phone, relationship, address } = req.body || {};

    const updatePayload = {};

    // Store emergency contact as { raw: "Name, Phone, Relationship" }
    // Matches the format used by /api/hr/employees (HR manager page)
    if (name !== undefined || phone !== undefined || relationship !== undefined) {
      const ecParts = [name, phone, relationship].filter(Boolean);
      updatePayload.emergency_contact = ecParts.length > 0 ? { raw: ecParts.join(", ") } : null;
    }

    // Store address in the dedicated home_address column
    if (address !== undefined) {
      updatePayload.home_address = address || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update." });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update emergency contact:", updateError);
      return res.status(500).json({ success: false, message: "Failed to update emergency contact." });
    }

    const ecParts = [name, phone, relationship].filter(Boolean);
    return res.status(200).json({
      success: true,
      data: {
        emergencyContact: ecParts.length > 0 ? ecParts.join(", ") : "Not provided",
        address: address || "No address on file",
      },
    });
  } catch (error) {
    console.error("emergency-contact API error:", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
