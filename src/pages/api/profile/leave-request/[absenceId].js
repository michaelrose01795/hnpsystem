import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/database/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { ensureDirectThread, sendThreadMessage, updateThreadMessageMetadata } from "@/lib/database/messages";
import { parseEmployeeMeta } from "@/lib/hr/employeeMeta";
import {
  buildLeaveRequestMessageLines,
  calculateLeaveRequestDayTotals,
  parseLeaveRequestNotes,
  serializeLeaveRequestNotes,
} from "@/lib/hr/leaveRequests";

const VALID_TYPES = ["Holiday", "Sickness", "Unpaid Leave"];

const buildRequesterName = (user = {}) =>
  [user.first_name || "", user.last_name || ""].filter(Boolean).join(" ").trim() || user.email || "Employee";

async function resolveAuthenticatedUserId(req, res) {
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
      throw new Error("Dev mode enabled but no users found.");
    }
    return firstUser.user_id;
  }

  const session = await getServerSession(req, res, authOptions);
  return resolveSessionUserId(session);
}

async function markExistingManagerMessages({
  refs = [],
  absenceId,
  requesterId,
  managerIds = [],
  type,
  startDate,
  endDate,
  halfDay = "None",
  totalDays = null,
  calendarDays = null,
  requestNotes = "",
  status,
}) {
  await Promise.all(
    (refs || []).map((ref) =>
      updateThreadMessageMetadata({
        threadId: ref.threadId,
        messageId: ref.messageId,
        metadataPatch: {
          leaveRequest: {
            absenceId,
            requesterId,
            managerIds,
            status,
            leaveType: type,
            startDate,
            endDate,
            halfDay,
            totalDays,
            calendarDays,
            requestNotes,
          },
        },
      })
    )
  );
}

async function sendManagerMessages({
  requesterId,
  requesterName,
  lineManagerIds,
  absenceId,
  type,
  startDate,
  endDate,
  halfDay,
  totalDays,
  calendarDays,
  requestNotes,
  prefix = "/leaverequest",
}) {
  const lines = buildLeaveRequestMessageLines({
    prefix,
    type,
    startDate,
    endDate,
    halfDay,
    totalDays,
    notes: requestNotes,
  });

  const refs = [];
  for (const managerId of lineManagerIds) {
    const thread = await ensureDirectThread(requesterId, managerId);
    const sentMessage = await sendThreadMessage({
      threadId: thread.id,
      senderId: requesterId,
      receiverId: managerId,
      content: lines.join(" "),
      metadata: {
        type: "leave-request",
        leaveRequest: {
          absenceId,
          requesterId,
          requesterName,
          managerIds: lineManagerIds,
          status: "Pending",
          leaveType: type,
          startDate,
          endDate,
          halfDay,
          totalDays,
          calendarDays,
          requestNotes,
        },
      },
    });

    refs.push({
      managerId,
      threadId: thread.id,
      messageId: sentMessage.id,
    });
  }

  return refs;
}

export default async function handler(req, res) {
  if (!["PATCH", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const userId = await resolveAuthenticatedUserId(req, res);
    const absenceId = Number.parseInt(String(req.query.absenceId || ""), 10);

    if (!absenceId) {
      return res.status(400).json({ success: false, message: "A valid leave request is required." });
    }

    const { data: existing, error: existingError } = await supabase
      .from("hr_absences")
      .select("absence_id, user_id, type, start_date, end_date, approval_status, approved_by, notes")
      .eq("absence_id", absenceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return res.status(404).json({ success: false, message: "Leave request not found." });
    }

    const requesterResult = await supabase
      .from("users")
      .select("user_id, first_name, last_name, email, emergency_contact, manager_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (requesterResult.error) throw requesterResult.error;
    const requester = requesterResult.data || null;
    const requesterName = buildRequesterName(requester);
    const emergencyManagerIds = parseEmployeeMeta(requester?.emergency_contact).lineManagerIds;
    const lineManagerIds = Array.from(
      new Set([requester?.manager_id, ...emergencyManagerIds].filter((managerId) => Number.isInteger(managerId) && managerId !== userId))
    );
    const existingNotes = parseLeaveRequestNotes(existing.notes);

    if (req.method === "DELETE") {
      await markExistingManagerMessages({
        refs: existingNotes.managerNotificationRefs,
        absenceId,
        requesterId: userId,
        managerIds: lineManagerIds,
        type: existing.type,
        startDate: existing.start_date,
        endDate: existing.end_date,
        halfDay: existingNotes.halfDay,
        totalDays: existingNotes.totalDays,
        requestNotes: existingNotes.requestNotes,
        status: "Removed",
      });

      const { error: deleteError } = await supabase
        .from("hr_absences")
        .delete()
        .eq("absence_id", absenceId)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      for (const managerId of lineManagerIds) {
        const thread = await ensureDirectThread(userId, managerId);
        await sendThreadMessage({
          threadId: thread.id,
          senderId: userId,
          receiverId: managerId,
          content: `/leaverequest removed request for ${existing.type} on ${existing.start_date}.`,
          metadata: {
            type: "leave-request-removed",
            leaveRequest: {
              absenceId,
              requesterId: userId,
              requesterName,
              managerIds: lineManagerIds,
              status: "Removed",
              leaveType: existing.type,
              startDate: existing.start_date,
              endDate: existing.end_date,
              halfDay: existingNotes.halfDay || "None",
              totalDays: existingNotes.totalDays ?? null,
              requestNotes: existingNotes.requestNotes || "",
            },
          },
        });
      }

      return res.status(200).json({ success: true, data: { removed: true, absenceId } });
    }

    const { type, startDate, endDate, notes = "", halfDay = "None" } = req.body || {};

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Leave type, start date, and end date are required.",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type. Must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be on or after start date.",
      });
    }

    const leaveTotals = calculateLeaveRequestDayTotals({ startDate, endDate, halfDay });
    if (!(leaveTotals.workDays > 0)) {
      return res.status(400).json({
        success: false,
        message: "Selected dates do not include any working days.",
      });
    }

    if (lineManagerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No line manager is assigned to your profile yet. Ask HR to add one before editing leave.",
      });
    }

    await markExistingManagerMessages({
      refs: existingNotes.managerNotificationRefs,
      absenceId,
      requesterId: userId,
      managerIds: lineManagerIds,
      type: existing.type,
      startDate: existing.start_date,
        endDate: existing.end_date,
        halfDay: existingNotes.halfDay,
        totalDays: existingNotes.totalDays,
        calendarDays: calculateLeaveRequestDayTotals({
          startDate: existing.start_date,
          endDate: existing.end_date,
          halfDay: existingNotes.halfDay,
          fallbackTotalDays: existingNotes.totalDays,
        }).calendarDays,
        requestNotes: existingNotes.requestNotes,
        status: "Superseded",
      });

    const nextRefs = await sendManagerMessages({
      requesterId: userId,
      requesterName,
      lineManagerIds,
      absenceId,
      type,
      startDate,
      endDate,
      halfDay,
      totalDays: leaveTotals.workDays,
      calendarDays: leaveTotals.calendarDays,
      requestNotes: notes,
      prefix: "/leaverequest updated",
    });

    const nextNotes = {
      requestNotes: notes || "",
      declineReason: "",
      halfDay,
      totalDays: leaveTotals.workDays,
      lineManagerIds,
      managerNotificationRefs: nextRefs,
    };

    const { data: updated, error: updateError } = await supabase
      .from("hr_absences")
      .update({
        type,
        start_date: startDate,
        end_date: endDate,
        approval_status: "Pending",
        approved_by: null,
        notes: serializeLeaveRequestNotes(nextNotes),
      })
      .eq("absence_id", absenceId)
      .eq("user_id", userId)
      .select("absence_id, user_id, type, start_date, end_date, approval_status")
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      data: {
        id: updated.absence_id,
        userId: updated.user_id,
        type: updated.type,
        startDate: updated.start_date,
        endDate: updated.end_date,
        status: updated.approval_status,
        notes,
        halfDay,
        totalDays: leaveTotals.workDays,
        calendarDays: leaveTotals.calendarDays,
      },
    });
  } catch (error) {
    console.error("Failed to update/remove leave request:", error);
    const statusCode = error?.message === "Authentication required" ? 401 : 500;
    return res.status(statusCode).json({
      success: false,
      message: "Failed to update leave request.",
      error: error.message,
    });
  }
}
