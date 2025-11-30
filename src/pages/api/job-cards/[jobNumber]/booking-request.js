import { supabaseService } from "@/lib/supabaseClient";
import { sendSystemNotification } from "@/lib/notifications/system";

const BOOKING_REQUEST_FIELDS = `
  request_id,
  job_id,
  status,
  description,
  waiting_status,
  submitted_by,
  submitted_by_name,
  submitted_at,
  approved_by,
  approved_by_name,
  approved_at,
  confirmation_sent_at,
  price_estimate,
  estimated_completion,
  loan_car_details,
  confirmation_notes
`;

const serializeBookingRequest = (row) => {
  if (!row) return null;
  return {
    requestId: row.request_id,
    jobId: row.job_id,
    status: row.status || "pending",
    description: row.description || "",
    waitingStatus: row.waiting_status || "Neither",
    submittedBy: row.submitted_by || null,
    submittedByName: row.submitted_by_name || "",
    submittedAt: row.submitted_at || null,
    approvedBy: row.approved_by || null,
    approvedByName: row.approved_by_name || "",
    approvedAt: row.approved_at || null,
    confirmationSentAt: row.confirmation_sent_at || null,
    priceEstimate: row.price_estimate || null,
    estimatedCompletion: row.estimated_completion || null,
    loanCarDetails: row.loan_car_details || "",
    confirmationNotes: row.confirmation_notes || ""
  };
};

const insertNotification = async ({ jobNumber, type, message, targetRole }) => {
  try {
    await supabaseService
      .from("notifications")
      .insert({
        user_id: null,
        type,
        message,
        target_role: targetRole || "customer",
        job_number: jobNumber,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn("⚠️ Failed to record booking notification:", error);
  }
};

const fetchJobContext = async (jobNumber) => {
  const { data, error } = await supabaseService
    .from("jobs")
    .select(
      `
      id,
      job_number,
      description,
      waiting_status,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      customer:customer_id(id, firstname, lastname, email),
      vehicle:vehicle_id(vehicle_id, registration, reg_number, make_model)
    `
    )
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const safeName = (jobsRow) => {
  const text =
    jobsRow?.customer?.firstname || jobsRow?.customer?.lastname
      ? `${jobsRow.customer.firstname || ""} ${
          jobsRow.customer.lastname || ""
        }`.trim()
      : jobsRow?.customer?.name || jobsRow?.customerName || null;
  if (text && text.length > 0) return text;
  return jobsRow?.customer || "Customer";
};

const buildSubmissionMessage = (job, description, submittedByName) => {
  const who = submittedByName || safeName(job);
  const reg = job.vehicle_reg || job.vehicle?.registration || "";
  return `📩 Booking request received for Job #${job.job_number} ${reg ? `(${reg}) ` : ""}by ${who}.\n\n${description}`;
};

const buildApprovalMessage = ({
  job,
  priceEstimate,
  eta,
  loanCarDetails,
  confirmationMessage
}) => {
  const formattedPrice =
    typeof priceEstimate === "number"
      ? `£${priceEstimate.toFixed(2)}`
      : "N/A";
  const etaText = eta
    ? new Date(eta).toLocaleString()
    : "Awaiting scheduling";
  const loanText = loanCarDetails?.trim()
    ? loanCarDetails.trim()
    : "No loan car required";
  const body = [
    confirmationMessage?.trim(),
    `Price estimate: ${formattedPrice}`,
    `ETA: ${etaText}`,
    `Loan car: ${loanText}`
  ]
    .filter(Boolean)
    .join("\n");
  return `✅ Booking approved for Job #${job.job_number}.\n${body}`;
};

export default async function handler(req, res) {
  if (!supabaseService) {
    return res
      .status(500)
      .json({ success: false, error: "Service role key is not configured" });
  }

  const { jobNumber } = req.query || {};
  if (!jobNumber) {
    return res
      .status(400)
      .json({ success: false, error: "Job number is required" });
  }

  try {
    const jobRow = await fetchJobContext(jobNumber);
    if (!jobRow) {
      return res
        .status(404)
        .json({ success: false, error: "Job card not found" });
    }

    if (req.method === "POST") {
      const {
        description,
        waitingStatus,
        vehicleId,
        submittedBy,
        submittedByName
      } = req.body || {};

      if (!description?.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "Description is required" });
      }

      const now = new Date().toISOString();
      const payload = {
        job_id: jobRow.id,
        customer_id: jobRow.customer_id || jobRow.customer?.id || null,
        vehicle_id: vehicleId || jobRow.vehicle_id || null,
        description: description.trim(),
        waiting_status: waitingStatus || jobRow.waiting_status || "Neither",
        status: "pending",
        submitted_by: submittedBy || null,
        submitted_by_name: submittedByName || null,
        submitted_at: now,
        updated_at: now
      };

      const { data, error } = await supabaseService
        .from("job_booking_requests")
        .upsert(payload, { onConflict: "job_id" })
        .select(BOOKING_REQUEST_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      const content = buildSubmissionMessage(
        jobRow,
        description.trim(),
        submittedByName
      );
      try {
        await sendSystemNotification({
          content,
          metadata: {
            type: "booking_request_submitted",
            jobNumber: jobRow.job_number
          }
        });
      } catch (notifyError) {
        console.warn("⚠️ Failed to dispatch booking submission message:", notifyError);
      }

      await insertNotification({
        jobNumber: jobRow.job_number,
        type: "booking_request_submitted",
        message: `Booking request emailed to ${safeName(jobRow)} (${jobRow.customer?.email || "no email"})`,
        targetRole: "customer"
      });

      return res.status(200).json({
        success: true,
        bookingRequest: serializeBookingRequest(data)
      });
    }

    if (req.method === "PUT") {
      const {
        priceEstimate,
        estimatedCompletion,
        loanCarDetails,
        confirmationMessage,
        approvedBy,
        approvedByName
      } = req.body || {};

      if (!priceEstimate?.toString().trim()) {
        return res
          .status(400)
          .json({ success: false, error: "Price estimate is required" });
      }
      if (!estimatedCompletion) {
        return res
          .status(400)
          .json({ success: false, error: "Estimated completion is required" });
      }

      const numericPrice = Number(priceEstimate);
      if (Number.isNaN(numericPrice)) {
        return res
          .status(400)
          .json({ success: false, error: "Price estimate is invalid" });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseService
        .from("job_booking_requests")
        .update({
          status: "approved",
          price_estimate: numericPrice,
          estimated_completion: estimatedCompletion,
          loan_car_details: loanCarDetails || null,
          confirmation_notes: confirmationMessage || null,
          approved_by: approvedBy || null,
          approved_by_name: approvedByName || null,
          approved_at: now,
          confirmation_sent_at: now,
          updated_at: now
        })
        .eq("job_id", jobRow.id)
        .select(BOOKING_REQUEST_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "No booking request found for this job"
        });
      }

      const approvalMessage = buildApprovalMessage({
        job: jobRow,
        priceEstimate: numericPrice,
        eta: estimatedCompletion,
        loanCarDetails,
        confirmationMessage
      });
      try {
        await sendSystemNotification({
          content: approvalMessage,
          metadata: {
            type: "booking_request_confirmed",
            jobNumber: jobRow.job_number
          }
        });
      } catch (notifyError) {
        console.warn("⚠️ Failed to dispatch booking approval message:", notifyError);
      }

      await insertNotification({
        jobNumber: jobRow.job_number,
        type: "booking_request_confirmed",
        message: approvalMessage,
        targetRole: "customer"
      });

      return res.status(200).json({
        success: true,
        bookingRequest: serializeBookingRequest(data)
      });
    }

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  } catch (error) {
    console.error("❌ Booking request handler error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Server error" });
  }
}
