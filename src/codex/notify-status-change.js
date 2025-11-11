// file location: src/codex/notify-status-change.js
// Centralised helper to broadcast job-status notifications.
import supabase from "@/lib/database/client";

const normaliseStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const asJobNumberString = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};

export const notifyJobStatusChange = async ({
  jobNumber,
  previousStatus,
  newStatus,
}) => {
  const jobNumberLabel = asJobNumberString(jobNumber);
  const nextStatus = normaliseStatus(newStatus);
  const lastStatus = normaliseStatus(previousStatus);

  if (!jobNumberLabel || !nextStatus) {
    return;
  }

  if (lastStatus && lastStatus === nextStatus) {
    return;
  }

  const isReadyForWorkshop = nextStatus === "ready for workshop";
  const isWaitingForParts = nextStatus === "waiting for parts";
  const isVhcSentToService =
    nextStatus === "vhc sent to service" ||
    nextStatus === "vhc_sent_to_service" ||
    nextStatus === "vhc sent";
  const isJobComplete =
    nextStatus === "job complete" ||
    nextStatus === "completed" ||
    nextStatus === "complete";

  if (isReadyForWorkshop) {
    // ✅ Notify Techs that job is ready for workshop
    try {
      await supabase.from("notifications").insert({
        message: `🚗 Job #${jobNumberLabel} is ready for workshop.`,
        target_role: "Techs",
        job_number: jobNumberLabel,
      });
    } catch (error) {
      console.error("❌ Failed to notify Techs for Ready for Workshop:", error);
    }
  }

  if (isWaitingForParts) {
    // ✅ Notify Parts that job is waiting for parts approval
    try {
      await supabase.from("notifications").insert({
        message: `🧩 Job #${jobNumberLabel} is waiting for parts approval.`,
        target_role: "Parts",
        job_number: jobNumberLabel,
      });
    } catch (error) {
      console.error("❌ Failed to notify Parts for Waiting for Parts:", error);
    }
  }

  if (isVhcSentToService) {
    // ✅ Notify Managers that VHC has been sent to service
    try {
      await supabase.from("notifications").insert({
        message: `📋 Job #${jobNumberLabel} VHC sent to service managers.`,
        target_role: "Managers",
        job_number: jobNumberLabel,
      });
    } catch (error) {
      console.error(
        "❌ Failed to notify Managers for VHC Sent to Service:",
        error
      );
    }
  }

  if (isJobComplete) {
    // ✅ Notify Managers that the job is complete
    try {
      await supabase.from("notifications").insert({
        message: `🎉 Job #${jobNumberLabel} is complete and ready for review.`,
        target_role: "Managers",
        job_number: jobNumberLabel,
      });
    } catch (error) {
      console.error("❌ Failed to notify Managers for Job Complete:", error);
    }

    // ✅ Notify Valet that the job needs final valeting
    try {
      await supabase.from("notifications").insert({
        message: `🧽 Job #${jobNumberLabel} needs valeting before handover.`,
        target_role: "Valet",
        job_number: jobNumberLabel,
      });
    } catch (error) {
      console.error("❌ Failed to notify Valet for Job Complete:", error);
    }
  }
};

export default notifyJobStatusChange;
