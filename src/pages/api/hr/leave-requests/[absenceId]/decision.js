import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/database/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { sendThreadMessage, updateThreadMessageMetadata } from "@/lib/database/messages";
import { formatLeaveDateRange, parseLeaveRequestNotes, serializeLeaveRequestNotes } from "@/lib/hr/leaveRequests";

const DECISION_MAP = {
  approve: "Approved",
  approved: "Approved",
  decline: "Declined",
  declined: "Declined",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const actorUserId = await resolveSessionUserId(session);
    const absenceId = Number.parseInt(String(req.query.absenceId || ""), 10);
    const decisionKey = String(req.body?.decision || "").toLowerCase().trim();
    const decision = DECISION_MAP[decisionKey] || null;
    const declineReason = String(req.body?.reason || "").trim();
    const sourceThreadId = Number.parseInt(String(req.body?.threadId || ""), 10) || null;
    const sourceMessageId = String(req.body?.messageId || "").trim() || null;

    if (!absenceId) {
      return res.status(400).json({ success: false, message: "A valid leave request is required." });
    }

    if (!decision) {
      return res.status(400).json({ success: false, message: "Decision must be approve or decline." });
    }

    if (decision === "Declined" && !declineReason) {
      return res.status(400).json({ success: false, message: "A decline reason is required." });
    }

    const { data: absence, error: absenceError } = await supabase
      .from("hr_absences")
      .select("absence_id, user_id, type, start_date, end_date, approval_status, notes")
      .eq("absence_id", absenceId)
      .maybeSingle();

    if (absenceError) throw absenceError;
    if (!absence) {
      return res.status(404).json({ success: false, message: "Leave request not found." });
    }

    const noteData = parseLeaveRequestNotes(absence.notes);
    const managerIds = noteData.lineManagerIds || [];

    if (!managerIds.includes(actorUserId)) {
      return res.status(403).json({ success: false, message: "You are not assigned to approve this leave request." });
    }

    if (String(absence.approval_status || "").toLowerCase() !== "pending") {
      return res.status(409).json({ success: false, message: `This leave request is already ${absence.approval_status || "processed"}.` });
    }

    const nextNotes = {
      ...noteData,
      declineReason: decision === "Declined" ? declineReason : "",
    };

    const { error: updateError } = await supabase
      .from("hr_absences")
      .update({
        approval_status: decision,
        approved_by: actorUserId,
        notes: serializeLeaveRequestNotes(nextNotes),
      })
      .eq("absence_id", absenceId);

    if (updateError) throw updateError;

    const allNotificationRefs = Array.isArray(nextNotes.managerNotificationRefs)
      ? nextNotes.managerNotificationRefs
      : [];

    await Promise.all(
      allNotificationRefs.map((ref) =>
        updateThreadMessageMetadata({
          threadId: ref.threadId,
          messageId: ref.messageId,
          metadataPatch: {
            leaveRequest: {
              absenceId,
              requesterId: absence.user_id,
              managerIds,
              status: decision,
              leaveType: absence.type,
              startDate: absence.start_date,
              endDate: absence.end_date,
              halfDay: nextNotes.halfDay || "None",
              totalDays: nextNotes.totalDays ?? null,
              requestNotes: nextNotes.requestNotes || "",
              declineReason: nextNotes.declineReason || "",
              decidedBy: actorUserId,
              decidedAt: new Date().toISOString(),
            },
          },
        })
      )
    );

    if (sourceThreadId && sourceMessageId) {
      const detailText =
        decision === "Approved"
          ? `Approved leave request for ${formatLeaveDateRange(absence.start_date, absence.end_date)}.`
          : `Declined leave request for ${formatLeaveDateRange(absence.start_date, absence.end_date)}. Reason: ${declineReason}`;

      await sendThreadMessage({
        threadId: sourceThreadId,
        senderId: actorUserId,
        receiverId: absence.user_id,
        content: detailText,
        metadata: {
          type: "leave-request-decision",
          leaveRequestDecision: {
            absenceId,
            status: decision,
            reason: decision === "Declined" ? declineReason : "",
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        absenceId,
        status: decision,
        declineReason: decision === "Declined" ? declineReason : "",
      },
    });
  } catch (error) {
    console.error("Failed to process leave request decision:", error);
    const statusCode = error?.message === "Authentication required" ? 401 : 500;
    return res.status(statusCode).json({
      success: false,
      message: "Failed to process leave request decision.",
      error: error.message,
    });
  }
}
