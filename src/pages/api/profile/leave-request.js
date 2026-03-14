// API endpoint for submitting a leave request for the authenticated user
// Creates a new record in hr_absences with status 'Pending'
// file location: src/pages/api/profile/leave-request.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { ensureDirectThread, sendThreadMessage } from "@/lib/database/messages";
import { parseEmployeeMeta } from "@/lib/hr/employeeMeta";
import {
  formatLeaveDateRange,
  parseLeaveRequestNotes,
  serializeLeaveRequestNotes,
} from "@/lib/hr/leaveRequests";

const buildRequesterName = (user = {}) =>
  [user.first_name || "", user.last_name || ""].filter(Boolean).join(" ").trim() || user.email || "Employee";

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
      userId = await resolveSessionUserId(session);
    }

    // Validate request body
    const { type, startDate, endDate, notes, halfDay = "None", totalDays = null } = req.body;

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

    const { data: requester, error: requesterError } = await supabase
      .from("users")
      .select("user_id, first_name, last_name, email, emergency_contact")
      .eq("user_id", userId)
      .maybeSingle();

    if (requesterError) {
      return res.status(500).json({
        success: false,
        message: "Failed to load requester details.",
        error: requesterError.message,
      });
    }

    const lineManagerIds = parseEmployeeMeta(requester?.emergency_contact).lineManagerIds.filter(
      (managerId) => managerId !== userId
    );

    if (lineManagerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No line manager is assigned to your profile yet. Ask HR to add one before requesting leave.",
      });
    }

    const requesterName = buildRequesterName(requester);
    const notePayload = {
      requestNotes: notes || "",
      halfDay,
      totalDays: totalDays === null || totalDays === undefined || totalDays === "" ? null : Number(totalDays),
      lineManagerIds,
      managerNotificationRefs: [],
    };

    // Insert leave request into hr_absences
    const { data, error } = await supabase
      .from("hr_absences")
      .insert({
        user_id: userId,
        type,
        start_date: startDate,
        end_date: endDate,
        approval_status: "Pending",
        notes: serializeLeaveRequestNotes(notePayload),
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

    const leaveSummary = formatLeaveDateRange(startDate, endDate);
    const requestLines = [
      `/leaverequest ${type} requested for ${leaveSummary}.`,
      halfDay && halfDay !== "None" ? `Half day: ${halfDay}.` : null,
      totalDays ? `Working days requested: ${totalDays}.` : null,
      notes ? `Details: ${notes}` : null,
    ].filter(Boolean);

    const managerNotificationRefs = [];

    // TODO: Reuse these line-manager relationships to power the future manager dashboard view for assigned staff states.
    for (const managerId of lineManagerIds) {
      const thread = await ensureDirectThread(userId, managerId);
      const sentMessage = await sendThreadMessage({
        threadId: thread.id,
        senderId: userId,
        receiverId: managerId,
        content: requestLines.join(" "),
        metadata: {
          type: "leave-request",
          leaveRequest: {
            absenceId: data.absence_id,
            requesterId: userId,
            requesterName,
            managerIds: lineManagerIds,
            status: "Pending",
            leaveType: type,
            startDate,
            endDate,
            halfDay,
            totalDays: notePayload.totalDays,
            requestNotes: notes || "",
          },
        },
      });

      managerNotificationRefs.push({
        managerId,
        threadId: thread.id,
        messageId: sentMessage.id,
      });
    }

    if (managerNotificationRefs.length > 0) {
      const nextNotes = parseLeaveRequestNotes(data.notes);
      nextNotes.managerNotificationRefs = managerNotificationRefs;
      await supabase
        .from("hr_absences")
        .update({ notes: serializeLeaveRequestNotes(nextNotes) })
        .eq("absence_id", data.absence_id);
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
        notes,
        halfDay,
        totalDays: notePayload.totalDays,
      },
    });
  } catch (error) {
    console.error("❌ /api/profile/leave-request error:", error);
    const statusCode = error?.message === "Authentication required" ? 401 : 500;
    return res.status(statusCode).json({
      success: false,
      message: "Failed to process leave request.",
      error: error.message,
    });
  }
}
