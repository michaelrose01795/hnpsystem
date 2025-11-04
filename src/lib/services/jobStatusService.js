// file location: src/lib/services/jobStatusService.js

import { supabase } from "../supabaseClient"; // Supabase client for database operations
import { updateJob } from "../database/jobs"; // Function to update job in database

/* ============================================
   STATUS FLOW DEFINITION
   Defines which statuses can transition to which
============================================ */
const STATUS_FLOW = {
  "Booked": ["Checked In", "Cancelled"], // From Booked, can go to Checked In or Cancelled
  "Checked In": ["Workshop/MOT", "Cancelled"], // From Checked In, can go to Workshop/MOT or Cancelled
  "Workshop/MOT": ["VHC Complete", "Being Washed", "Complete"], // From Workshop/MOT, can go to VHC Complete, Being Washed, or Complete
  "VHC Complete": ["VHC Sent", "Being Washed"], // From VHC Complete, can go to VHC Sent or Being Washed
  "VHC Sent": ["Additional Work Required", "Being Washed", "Complete"], // From VHC Sent, can go to Additional Work Required, Being Washed, or Complete
  "Additional Work Required": ["Additional Work Being Carried Out"], // From Additional Work Required, can go to Additional Work Being Carried Out
  "Additional Work Being Carried Out": ["Being Washed", "Complete"], // From Additional Work Being Carried Out, can go to Being Washed or Complete
  "Being Washed": ["Complete"], // From Being Washed, can only go to Complete
  "Complete": ["Invoiced", "Collected"], // From Complete, can go to Invoiced or Collected
  "Retail Parts on Order": ["Workshop/MOT", "Complete"], // Parts arrived, can continue work
  "Warranty Parts on Order": ["Workshop/MOT", "Complete"], // Warranty parts arrived
  "Raise TSR": ["Waiting for TSR Response"], // TSR raised, waiting for response
  "Waiting for TSR Response": ["Workshop/MOT", "Warranty Quality Control"], // TSR response received
  "Warranty Quality Control": ["Warranty Ready to Claim"], // QC done, ready to claim
  "Warranty Ready to Claim": ["Complete"], // Claim submitted, job complete
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
  console.log("🔧 Auto-setting status to Workshop/MOT for job:", jobId);
  
  try {
    // Get current job data to check if it has MOT in job categories
    const { data: jobData } = await supabase
      .from("jobs")
      .select("job_categories, status")
      .eq("id", jobId)
      .single();
    
    // Only update if current status is "Checked In" or "Booked"
    if (!["Checked In", "Booked"].includes(jobData?.status)) {
      console.log("⚠️ Job not in correct status for Workshop/MOT transition");
      return { success: false, error: "Job must be Checked In or Booked" };
    }
    
    const result = await updateJob(jobId, {
      status: "Workshop/MOT",
      workshop_started_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: technicianId || "SYSTEM_CLOCKING"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Workshop/MOT");
      await logStatusChange(
        jobId, 
        jobData?.status, 
        "Workshop/MOT", 
        technicianId, 
        `Technician ${technicianName} started work`
      );
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Workshop/MOT status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: VHC COMPLETE
   Called when technician completes VHC checks
============================================ */
export const autoSetVHCCompleteStatus = async (jobId, completedBy) => {
  console.log("✅ Auto-setting status to VHC Complete for job:", jobId);
  
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
      status: "VHC Complete",
      vhc_completed_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: completedBy || "SYSTEM_VHC"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to VHC Complete");
      await logStatusChange(jobId, "Workshop/MOT", "VHC Complete", completedBy, "VHC inspection completed");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting VHC Complete status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: VHC SENT
   Called when manager sends VHC to customer
============================================ */
export const autoSetVHCSentStatus = async (jobId, sentBy) => {
  console.log("📤 Auto-setting status to VHC Sent for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "VHC Sent",
      vhc_sent_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: sentBy || "SYSTEM_VHC"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to VHC Sent");
      await logStatusChange(jobId, "VHC Complete", "VHC Sent", sentBy, "VHC sent to customer");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting VHC Sent status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: ADDITIONAL WORK REQUIRED
   Called when customer authorizes additional work from VHC
============================================ */
export const autoSetAdditionalWorkRequiredStatus = async (jobId, authorizedBy) => {
  console.log("🔨 Auto-setting status to Additional Work Required for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Additional Work Required",
      additional_work_authorized_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: authorizedBy || "SYSTEM_VHC"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Additional Work Required");
      await logStatusChange(jobId, "VHC Sent", "Additional Work Required", authorizedBy, "Additional work authorized");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Additional Work Required status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: ADDITIONAL WORK BEING CARRIED OUT
   Called when technician clocks back onto job for additional work
============================================ */
export const autoSetAdditionalWorkInProgressStatus = async (jobId, technicianId) => {
  console.log("🔧 Auto-setting status to Additional Work Being Carried Out for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Additional Work Being Carried Out",
      additional_work_started_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: technicianId || "SYSTEM_CLOCKING"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Additional Work Being Carried Out");
      await logStatusChange(jobId, "Additional Work Required", "Additional Work Being Carried Out", technicianId, "Additional work started");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Additional Work Being Carried Out status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: BEING WASHED
   Called when valet starts washing the vehicle
============================================ */
export const autoSetBeingWashedStatus = async (jobId, valetId) => {
  console.log("🚿 Auto-setting status to Being Washed for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Being Washed",
      wash_started_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: valetId || "SYSTEM_VALET"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Being Washed");
      await logStatusChange(jobId, null, "Being Washed", valetId, "Valeting started");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Being Washed status:", error);
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
      // Don't block completion, but set status to Warranty Quality Control instead
      return await autoSetWarrantyQualityControlStatus(jobId, completedBy);
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
  console.log("📦 Auto-setting status to Retail Parts on Order for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Retail Parts on Order",
      parts_ordered_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: orderedBy || "SYSTEM_PARTS"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Retail Parts on Order");
      await logStatusChange(jobId, null, "Retail Parts on Order", orderedBy, "Retail parts ordered");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Retail Parts on Order status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WARRANTY PARTS ON ORDER
   Called when parts are marked as on order for warranty job
============================================ */
export const autoSetWarrantyPartsOnOrderStatus = async (jobId, orderedBy) => {
  console.log("📦 Auto-setting status to Warranty Parts on Order for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Warranty Parts on Order",
      warranty_parts_ordered_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: orderedBy || "SYSTEM_PARTS"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Warranty Parts on Order");
      await logStatusChange(jobId, null, "Warranty Parts on Order", orderedBy, "Warranty parts ordered");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Warranty Parts on Order status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WARRANTY QUALITY CONTROL
   Called automatically for warranty jobs without write-up
============================================ */
export const autoSetWarrantyQualityControlStatus = async (jobId, userId) => {
  console.log("🔍 Auto-setting status to Warranty Quality Control for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Warranty Quality Control",
      warranty_qc_started_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: userId || "SYSTEM_WARRANTY"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Warranty Quality Control");
      await logStatusChange(jobId, null, "Warranty Quality Control", userId, "Warranty QC required - write-up incomplete");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Warranty Quality Control status:", error);
    return { success: false, error };
  }
};

/* ============================================
   AUTO UPDATE STATUS: WARRANTY READY TO CLAIM
   Called when warranty write-up is completed
============================================ */
export const autoSetWarrantyReadyToClaimStatus = async (jobId, userId) => {
  console.log("✅ Auto-setting status to Warranty Ready to Claim for job:", jobId);
  
  try {
    const result = await updateJob(jobId, {
      status: "Warranty Ready to Claim",
      warranty_ready_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      status_updated_by: userId || "SYSTEM_WARRANTY"
    });
    
    if (result.success) {
      console.log("✅ Status auto-updated to Warranty Ready to Claim");
      await logStatusChange(jobId, "Warranty Quality Control", "Warranty Ready to Claim", userId, "Warranty documentation complete");
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error auto-setting Warranty Ready to Claim status:", error);
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
    
    // Validate transition
    if (!canTransitionStatus(currentJob?.status, newStatus)) {
      console.warn(`⚠️ Invalid status transition: ${currentJob?.status} → ${newStatus}`);
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