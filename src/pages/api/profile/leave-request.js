// API endpoint for submitting a leave request for the authenticated user
// Creates a new record in hr_absences with status 'Pending'
// file location: src/pages/api/profile/leave-request.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Support both NextAuth (Keycloak) and dev authentication bypass
    const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
    const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
    const allowDevBypass =
      devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));

    let userId = null;

    if (allowDevBypass) {
      const queryUserId = req.query.userId || req.body.userId;
      if (queryUserId) {
        userId = parseInt(queryUserId, 10);
      } else {
        const { data: firstUser, error: firstUserError } = await supabase
          .from("users")
          .select("user_id")
          .limit(1)
          .single();

        if (firstUserError) {
          return res.status(500).json({
            success: false,
            message: "Dev mode enabled but no users found.",
          });
        }
        userId = firstUser.user_id;
      }
    } else {
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      const sessionEmail = session.user.email;
      const sessionName = session.user.name;

      if (!sessionEmail && !sessionName) {
        return res.status(400).json({ success: false, message: "Unable to identify user from session" });
      }

      let userQuery = supabase.from("users").select("user_id");
      if (sessionEmail) {
        userQuery = userQuery.eq("email", sessionEmail);
      } else if (sessionName) {
        userQuery = userQuery.or(`first_name.ilike.${sessionName},last_name.ilike.${sessionName}`);
      }

      const { data: userData, error: userError } = await userQuery.maybeSingle();
      if (userError || !userData) {
        return res.status(404).json({ success: false, message: "User not found in database" });
      }

      userId = userData.user_id;
    }

    // Validate request body
    const { type, startDate, endDate, notes } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Leave type, start date, and end date are required.",
      });
    }

    const validTypes = ["Holiday", "Sickness", "Unpaid Leave"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be on or after start date.",
      });
    }

    // Insert leave request into hr_absences
    const { data, error } = await supabase
      .from("hr_absences")
      .insert({
        user_id: userId,
        type,
        start_date: startDate,
        end_date: endDate,
        approval_status: "Pending",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Leave request insert error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create leave request.",
        error: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully.",
      data: {
        id: data.absence_id,
        userId: data.user_id,
        type: data.type,
        startDate: data.start_date,
        endDate: data.end_date,
        status: data.approval_status,
        notes: data.notes,
      },
    });
  } catch (error) {
    console.error("❌ /api/profile/leave-request error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process leave request.",
      error: error.message,
    });
  }
}
