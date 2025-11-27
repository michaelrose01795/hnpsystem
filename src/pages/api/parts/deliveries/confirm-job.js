import { supabaseService } from "@/lib/supabaseClient";
import { sendThreadMessage } from "@/lib/database/messages";

const SYSTEM_THREAD_ID = Number(process.env.SYSTEM_MESSAGE_THREAD_ID);
const SYSTEM_SENDER_ID = Number(process.env.SYSTEM_MESSAGE_SENDER_ID);

const JOB_STATUS = "Delivered to customer";

const formatSystemMessage = ({ jobNumber, stopNumber, customerName }) => {
  const parts = [
    `Job ${jobNumber || "unknown"}`,
    stopNumber ? `stop ${stopNumber}` : null,
    customerName ? `customer ${customerName}` : null,
    "has been delivered."
  ].filter(Boolean);
  return `System alert: ${parts.join(" · ")}`;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const { jobId, stopNumber, customerName, userId, deliveryId } = req.body || {};
  if (!jobId || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "jobId and userId are required." });
  }

  if (!supabaseService) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY for job confirmation updates.");
    return res.status(500).json({ success: false, message: "Server misconfiguration." });
  }

  try {
    const { data: jobRow, error: jobError } = await supabaseService
      .from("jobs")
      .select("id, job_number, status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      throw jobError;
    }

    if (!jobRow) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    const timestamp = new Date().toISOString();
    const { error: updateError } = await supabaseService
      .from("jobs")
      .update({
        status: JOB_STATUS,
        status_updated_at: timestamp,
        status_updated_by: String(userId),
        delivery_confirmed_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", jobRow.id);

    if (updateError) {
      throw updateError;
    }

    const { error: historyError } = await supabaseService.from("job_status_history").insert([
      {
        job_id: jobRow.id,
        from_status: jobRow.status,
        to_status: JOB_STATUS,
        changed_by: String(userId),
        changed_at: timestamp,
      },
    ]);

    if (historyError) {
      throw historyError;
    }

    if (SYSTEM_THREAD_ID && SYSTEM_SENDER_ID) {
      try {
        await sendThreadMessage({
          threadId: SYSTEM_THREAD_ID,
          senderId: SYSTEM_SENDER_ID,
          content: formatSystemMessage({
            jobNumber: jobRow.job_number,
            stopNumber,
            customerName,
          }),
          metadata: {
            deliveryId: deliveryId || null,
            jobId: jobRow.id,
            departments: ["Service", "Parts"],
          },
        });
      } catch (messageError) {
        console.error("Failed to send delivery confirmation message:", messageError);
      }
    }

    return res.status(200).json({ success: true, jobId: jobRow.id, jobNumber: jobRow.job_number });
  } catch (error) {
    console.error("Error confirming delivery:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Unable to confirm delivery." });
  }
}
