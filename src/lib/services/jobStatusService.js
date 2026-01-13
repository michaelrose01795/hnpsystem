// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/services/jobStatusService.js

import { supabase } from "@/lib/supabaseClient"; // Supabase client for database operations
import { updateJob } from "@/lib/database/jobs"; // Function to update job in database
import {
  getSubStatusMetadata,
  resolveMainStatusId,
} from "@/lib/status/statusFlow";

/* ============================================
   STATUS FLOW DEFINITION
   Defines which statuses can transition to which
============================================ */
const STATUS_FLOW = {
  Booked: ["Checked In", "In Progress"],
  "Checked In": ["In Progress"],
  "In Progress": ["Invoiced"],
  Invoiced: ["Complete"],
  Complete: [],
};

/* ============================================
   VALIDATE STATUS TRANSITION
   Checks if moving from currentStatus to newStatus is allowed
============================================ */
export const canTransitionStatus = (currentStatus, newStatus) => {
  // If no current status (new job), allow any initial status
  if (!currentStatus) return true;
  
  // Check if the new status is in the allowed transitions for current status
  const allowedTransitions = STATUS_FLOW[currentStatus] || [];
  
  // Always allow manual override (user can force any status)
  // But log it for audit purposes
  if (!allowedTransitions.includes(newStatus)) {
    console.warn(`⚠️ Non-standard status transition: ${currentStatus} → ${newStatus}`);
    return true; // Allow but warn
  }
  
  return true;
};

const resolveSubStatusLabel = (status) => {
  const metadata = getSubStatusMetadata(status);
  return metadata?.label || status || null;
};

const ensureInProgressStatus = async (jobId, updatedBy) => {
  const { data: jobRow, error } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .single();

  if (error) {
    console.error("❌ Unable to check job status before sub-status update:", error);
    return null;
  }

  const currentMain = resolveMainStatusId(jobRow?.status);
  if (currentMain === "in_progress" || currentMain === "invoiced" || currentMain === "complete") {
    return jobRow?.status || null;
  }

  const result = await updateJob(jobId, {
    status: "In Progress",
    status_updated_at: new Date().toISOString(),
    status_updated_by: updatedBy || "SYSTEM_STATUS",
  });

  return result?.success ? "In Progress" : jobRow?.status || null;
};

export const logJobSubStatus = async (jobId, subStatus, changedBy, reason) => {
  if (!jobId || !subStatus) return { success: false, error: "Missing jobId or subStatus" };

  try {
    await ensureInProgressStatus(jobId, changedBy);
    const label = resolveSubStatusLabel(subStatus);
    if (!label) {
      return { success: false, error: "Unknown sub-status" };
    }

    const { error } = await supabase.from("job_status_history").insert([
      {
        job_id: jobId,
        from_status: null,
        to_status: label,
        changed_by: changedBy || null,
        reason: reason || null,
        changed_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("❌ Error logging sub-status:", error);
    return { success: false, error };
  }
};

const REQUIRED_INVOICE_SUB_STATUSES = new Set([
  "technician_work_completed",
  "vhc_completed",
  "pricing_completed",
]);

const fetchJobSubStatusSet = async (jobId) => {
  const { data, error } = await supabase
    .from("job_status_history")
    .select("to_status, from_status")
    .eq("job_id", jobId);

  if (error) {
    throw error;
  }

  const set = new Set();
  (data || []).forEach((row) => {
    const toId = getSubStatusMetadata(row.to_status)?.id || null;
    const fromId = getSubStatusMetadata(row.from_status)?.id || null;
    if (toId) set.add(toId);
    if (fromId) set.add(fromId);
  });
  return set;
};

const hasInvoiceForJob = async (jobId) => {
  const { data, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("job_id", jobId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
};

const ensureInvoicingPrereqs = async (jobId) => {
  const subStatusSet = await fetchJobSubStatusSet(jobId);
  const missing = Array.from(REQUIRED_INVOICE_SUB_STATUSES).filter(
    (status) => !subStatusSet.has(status)
  );

  return { ok: missing.length === 0, missing };
};

/* ============================================
   AUTO UPDATE STATUS: BOOKED
   Called when appointment is created
============================================ */
export const autoSetBookedStatus = async (jobId) => {
  console.log("📅 Auto-setting status to Booked for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Booked",
      status_updated_at: new Date().toISOString(),
      status_updated_by: "SYSTEM_APPOINTMENT"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Booked");
      await logStatusChange(jobId, null, "Booked", "SYSTEM", "Appointment created");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Booked status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: CHECKED IN
   Called when customer arrives at workshop
============================================ */
export const autoSetCheckedInStatus = async (jobId, checkedInBy) => {
  console.log("👤 Auto-setting status to Checked In for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Checked In",
      checked_in_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: checkedInBy || "SYSTEM_CHECKIN"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Checked In");
      await logStatusChange(jobId, "Booked", "Checked In", checkedInBy, "Customer arrived");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Checked In status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WORKSHOP/MOT
   Called when technician clocks onto the job
============================================ */
export const autoSetWorkshopStatus = async (jobId, technicianId, technicianName) => {
  console.log("🔧 Auto-setting status to In Progress for job:", jobId);
  
  try {
    // Get current job data to check if it has MOT in job categories
    const { data: jobData } = await supabase
      .from("jobs")
      .select("job_categories, status")
      .eq("id", jobId)
      .single();
    
    const currentMain = resolveMainStatusId(jobData?.status);
    if (currentMain === "invoiced" || currentMain === "complete") {
      return { success: false, error: "Job already invoiced or complete" };
    }

    const result = await updateJob(jobId, {
      status: "In Progress",
      workshop_started_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: technicianId || "SYSTEM_CLOCKING",
    });

    if (result.success) {
      await logJobSubStatus(
        jobId,
        "Technician Started",
        technicianId,
        `Technician ${technicianName} started work`
      );
    }

    return result;
  } catch (error) {
    console.error("❌ Error auto-setting In Progress status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: VHC COMPLETE
   Called when technician completes VHC checks
============================================ */
export const autoSetVHCCompleteStatus = async (jobId, completedBy) => {
  console.log("✅ Logging VHC Completed for job:", jobId);
  
  try {
    // Check if job has VHC checks
    const { data: vhcChecks } = await supabase
      .from("vhc_checks")
      .select("vhc_id")
      .eq("job_id", jobId);
    
    if (!vhcChecks || vhcChecks.length === 0) {
      console.log("⚠️ No VHC checks found, not updating status");
      return { success: false, error: "No VHC checks found" };
    }
    
    const result = await updateJob(jobId, {
      vhc_completed_at: new Date().toISOString(),
    });

    if (result.success) {
      await logJobSubStatus(jobId, "VHC Completed", completedBy, "VHC inspection completed");
    }

    return result;
  } catch (error) {
    console.error("❌ Error logging VHC Completed status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: VHC SENT
   Called when manager sends VHC to customer
============================================ */
export const autoSetVHCSentStatus = async (jobId, sentBy) => {
  console.log("📤 Logging VHC Sent for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      vhc_sent_at: new Date().toISOString(),
    });

    if (result.success) {
      await logJobSubStatus(jobId, "Sent to Customer", sentBy, "VHC sent to customer");
    }

    return result;
  } catch (error) {
    console.error("❌ Error logging VHC Sent status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: ADDITIONAL WORK REQUIRED
   Called when customer authorizes additional work from VHC
============================================ */
export const autoSetAdditionalWorkRequiredStatus = async (jobId, authorizedBy) => {
  console.log("🔨 Logging Customer Authorised for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      additional_work_authorized_at: new Date().toISOString(),
    });

    if (result.success) {
      await logJobSubStatus(jobId, "Customer Authorised", authorizedBy, "Additional work authorized");
    }

    return result;
  } catch (error) {
    console.error("❌ Error logging Customer Authorised status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: ADDITIONAL WORK BEING CARRIED OUT
   Called when technician clocks back onto job for additional work
============================================ */
export const autoSetAdditionalWorkInProgressStatus = async (jobId, technicianId) => {
  console.log("🔧 Logging Technician Started for additional work:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      additional_work_started_at: new Date().toISOString(),
    });

    if (result.success) {
      await logJobSubStatus(jobId, "Technician Started", technicianId, "Additional work started");
    }

    return result;
  } catch (error) {
    console.error("❌ Error logging Technician Started status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: BEING WASHED
   Called when valet starts washing the vehicle
============================================ */
export const autoSetBeingWashedStatus = async (jobId, valetId) => {
  console.log("🚿 Recording valet start without main status change for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      wash_started_at: new Date().toISOString(),
    });
    
    if (result.success) {
      console.log("✅ Valeting started");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error recording valet start:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: COMPLETE
   Called when all work is finished
============================================ */
export const autoSetCompleteStatus = async (jobId, completedBy) => {
  console.log("🎉 Auto-setting status to Complete for job:", jobId);
  
  try {
    // Get job data to check if all requirements are met
    const { data: jobData } = await supabase
      .from("jobs")
      .select(`
        id,
        vhc_required,
        job_source,
        vhc_checks(vhc_id),
        job_writeups(writeup_id)
      `)
      .eq("id", jobId)
      .single();
    
    // Check if VHC is required and completed
    if (jobData?.vhc_required && (!jobData?.vhc_checks || jobData.vhc_checks.length === 0)) {
      console.log("⚠️ VHC required but not completed");
      return { success: false, error: "VHC required but not completed" };
    }
    
    // Check if warranty job has write-up completed
    if (jobData?.job_source === "Warranty" && (!jobData?.job_writeups || jobData.job_writeups.length === 0)) {
      console.log("⚠️ Warranty job requires write-up");
      return { success: false, error: "Warranty job requires write-up before completion" };
    }

    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("invoices")
      .select("id")
      .eq("job_id", jobId)
      .limit(1)
      .maybeSingle();

    if (invoiceError) {
      console.error("❌ Error checking invoices before completion:", invoiceError);
      return { success: false, error: invoiceError };
    }

    if (!invoiceRow?.id) {
      console.log("⚠️ Cannot complete job without invoice");
      return { success: false, error: "Invoice required before completion" };
    }
    
    const result = await updateJob(jobId, {
      status: "Complete",
      completed_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: completedBy || "SYSTEM_COMPLETION"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Complete");
      await logStatusChange(jobId, null, "Complete", completedBy, "Job completed");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Complete status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: RETAIL PARTS ON ORDER
   Called when parts are marked as on order for retail job
============================================ */
export const autoSetRetailPartsOnOrderStatus = async (jobId, orderedBy) => {
  console.log("📦 Logging Waiting for Parts for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      parts_ordered_at: new Date().toISOString(),
    });
    
    if (result.success) {
      await logJobSubStatus(jobId, "Waiting for Parts", orderedBy, "Retail parts ordered");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error logging Waiting for Parts status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WARRANTY PARTS ON ORDER
   Called when parts are marked as on order for warranty job
============================================ */
export const autoSetWarrantyPartsOnOrderStatus = async (jobId, orderedBy) => {
  console.log("📦 Logging Waiting for Parts for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      warranty_parts_ordered_at: new Date().toISOString(),
    });
    
    if (result.success) {
      await logJobSubStatus(jobId, "Waiting for Parts", orderedBy, "Warranty parts ordered");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error logging Waiting for Parts status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WARRANTY QUALITY CONTROL
   Called automatically for warranty jobs without write-up
============================================ */
export const autoSetWarrantyQualityControlStatus = async (jobId, userId) => {
  console.log("🔍 Warranty QC requires manual review for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      warranty_qc_started_at: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    console.error("❌ Error recording Warranty QC requirement:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WARRANTY READY TO CLAIM
   Called when warranty write-up is completed
============================================ */
export const autoSetWarrantyReadyToClaimStatus = async (jobId, userId) => {
  console.log("✅ Warranty ready to claim noted for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      warranty_ready_at: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    console.error("❌ Error recording Warranty Ready to Claim:", error);
    return { success: false, error };
  }
};

/* ============================================
   LOG STATUS CHANGE
   Records all status changes for audit trail
============================================ */
const logStatusChange = async (jobId, fromStatus, toStatus, changedBy, reason) => {
  try {
    const { error } = await supabase
      .from("job_status_history")
      .insert([{
        job_id: jobId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: changedBy,
        reason: reason,
        changed_at: new Date().toISOString()
      }]);
    
    if (error) throw error;
    
    console.log(`📝 Status change logged: ${fromStatus} → ${toStatus}`);
  } catch (error) {
    console.error("❌ Error logging status change:", error);
    // Don't throw - logging failure shouldn't block status update
  }
};

/* ============================================
   GET STATUS HISTORY
   Retrieves all status changes for a job
============================================ */
export const getJobStatusHistory = async (jobId) => {
  try {
    const { data, error } = await supabase
      .from("job_status_history")
      .select("*")
      .eq("job_id", jobId)
      .order("changed_at", { ascending: true });
    
    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting status history:", error);
    return { success: false, error, data: [] };
  }
};

/* ============================================
   MANUAL STATUS UPDATE
   For when user manually changes status (with validation)
============================================ */
export const manualStatusUpdate = async (jobId, newStatus, userId, reason) => {
  console.log(`🔄 Manual status update for job ${jobId} to ${newStatus}`);
  
  try {
    // Get current job status
    const { data: currentJob } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .single();
    
    const normalizedTarget = resolveMainStatusId(newStatus);
    if (!normalizedTarget) {
      return { success: false, error: "Main job status required" };
    }

    // Validate transition
    if (!canTransitionStatus(currentJob?.status, newStatus)) {
      console.warn(`⚠️ Invalid status transition: ${currentJob?.status} → ${newStatus}`);
    }

    if (normalizedTarget === "invoiced") {
      const { ok, missing } = await ensureInvoicingPrereqs(jobId);
      if (!ok) {
        return { success: false, error: `Missing sub-statuses: ${missing.join(", ")}` };
      }
    }

    if (normalizedTarget === "complete") {
      const hasInvoice = await hasInvoiceForJob(jobId);
      if (!hasInvoice) {
        return { success: false, error: "Invoice required before completion" };
      }
    }
    
    // Update status
    const result = await updateJob(jobId, {
      status: newStatus,
      status_updated_at: new Date().toISOString(),
      status_updated_by: userId
    });
    
    if (result.success) {
      console.log("✅ Manual status update successful");
      await logStatusChange(jobId, currentJob?.status, newStatus, userId, reason || "Manual update");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error in manual status update:", error);
    return { success: false, error };
  }
};
