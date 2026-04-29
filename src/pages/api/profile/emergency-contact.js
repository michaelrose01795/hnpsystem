// API route for updating the authenticated user's own emergency contact
// file location: src/pages/api/profile/emergency-contact.js

import { getServerSession } from "next-auth/next"; // NextAuth session helper
import { authOptions } from "@/pages/api/auth/[...nextauth]"; // Auth config
import { supabase } from "@/lib/database/supabaseClient"; // Supabase client for DB access
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver"; // Resolve DB user_id from session
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getAuditContext } from "@/lib/audit/auditContext";

export default async function handler(req, res) {
  // Only allow POST method for updates
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]); // Inform client of allowed methods
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Support both NextAuth (Keycloak) and dev authentication bypass
    const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"; // Check env flag
    const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null; // Check dev cookie
    const allowDevBypass =
      devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie)); // Allow bypass in non-prod

    let userId = null; // Will hold the authenticated user's DB id

    if (allowDevBypass) {
      // Dev mode — accept userId from query or fall back to first user
      const queryUserId = req.query.userId; // Optional override for testing
      if (queryUserId) {
        userId = parseInt(queryUserId, 10); // Parse provided userId
      } else {
        const { data: firstUser, error: firstUserError } = await supabase
          .from("users")
          .select("user_id")
          .limit(1)
          .single(); // Fetch first user as fallback

        if (firstUserError) {
          return res.status(500).json({ success: false, message: "Dev mode: no users found." });
        }
        userId = firstUser.user_id; // Use first user's id
      }
    } else {
      // Production mode — require authenticated session
      const session = await getServerSession(req, res, authOptions); // Get session from request
      if (!session?.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      userId = await resolveSessionUserId(session); // Resolve DB user_id from session
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unable to identify user." });
    }

    // Extract fields from request body
    const { name, phone, relationship, address } = req.body; // Destructure emergency contact fields

    // Build the emergency_contact JSON object for the users table
    const emergencyContact = {
      name: (name || "").trim() || null, // Contact name
      phone: (phone || "").trim() || null, // Contact phone number
      relationship: (relationship || "").trim() || null, // Relationship to employee
    };

    // Build update payload — always update emergency_contact, only update address if provided
    const updatePayload = {
      emergency_contact: emergencyContact, // Store as JSON in the users table
      updated_at: new Date().toISOString(), // Track when the record was modified
    };

    // Include home_address if address field was sent
    if (address !== undefined) {
      updatePayload.home_address = (address || "").trim() || null; // Update home address
    }

    // Update the user's own record in the users table
    const { error: updateError } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("user_id", userId); // Only update the authenticated user's row

    if (updateError) {
      console.error("❌ Emergency contact update failed", updateError); // Log error for debugging
      return res.status(500).json({ success: false, message: "Failed to update emergency contact." });
    }

    const auditCtx = await getAuditContext(req, res);
    await writeAuditLog({
      ...auditCtx,
      actorUserId: auditCtx.actorUserId ?? userId,
      action: "update",
      entityType: "user_emergency_contact",
      entityId: userId,
      diff: {
        fields_changed: address !== undefined
          ? ["emergency_contact", "home_address"]
          : ["emergency_contact"],
      },
    });

    return res.status(200).json({ success: true, message: "Emergency contact updated." }); // Success response
  } catch (err) {
    console.error("❌ Emergency contact endpoint error", err); // Log unexpected errors
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
