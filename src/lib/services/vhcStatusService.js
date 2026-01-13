// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/services/vhcStatusService.js

import { supabase } from "@/lib/supabaseClient"; // Supabase client for database operations
import { 
  autoSetVHCCompleteStatus,
  autoSetVHCSentStatus,
  autoSetAdditionalWorkRequiredStatus,
  autoSetWarrantyQualityControlStatus,
  autoSetWarrantyReadyToClaimStatus,
  logJobSubStatus
} from "@/lib/services/jobStatusService"; // Import auto-status functions
import { resolveMainStatusId } from "@/lib/status/statusFlow";

/* ============================================
   CHECK AND UPDATE VHC STATUS
   Called after VHC checks are added/updated
   Determines if VHC is complete and updates status
============================================ */
export const checkAndUpdateVHCStatus = async (jobId, userId) => {
  console.log("🔍 Checking VHC status for job:", jobId);
  
  try {
    // Get job data
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        vhc_required,
        vhc_completed_at,
        job_source,
        vhc_checks(vhc_id, section, issue_title, issue_description, measurement)
      `)
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    if (!jobData) {
      console.log("⚠️ Job not found");
      return { success: false, error: "Job not found" };
    }
    
    // Check if VHC is required
    if (!jobData.vhc_required) {
      console.log("ℹ️ VHC not required for this job");
      return { success: true, message: "VHC not required" };
    }
    
    // Check if VHC has any checks
    if (!jobData.vhc_checks || jobData.vhc_checks.length === 0) {
      console.log("⚠️ No VHC checks found");
      return { success: true, message: "No VHC checks yet" };
    }
    
    // Check if all critical VHC checks have measurements (for red/amber items)
    const criticalChecks = jobData.vhc_checks.filter(check => 
      check.section === "Brakes" || check.section === "Tyres"
    );
    
    const allMeasurementsComplete = criticalChecks.every(check => 
      check.measurement !== null && check.measurement !== undefined && check.measurement !== ""
    );
    
    if (!allMeasurementsComplete) {
      console.log("⚠️ VHC checks incomplete - missing measurements");
      return { success: true, message: "VHC incomplete - missing measurements" };
    }
    
    const mainStatus = resolveMainStatusId(jobData.status);
    if (mainStatus === "invoiced" || mainStatus === "complete") {
      return { success: true, message: "VHC complete, job already invoiced/complete" };
    }

    console.log("✅ VHC complete - logging sub-status");
    const result = await autoSetVHCCompleteStatus(jobId, userId);

    if (result.success) {
      return { success: true, statusUpdated: true, newStatus: "VHC Completed" };
    }

    console.error("❌ Failed to update VHC complete:", result.error);
    return { success: false, error: result.error };
    
  } catch (error) {
    console.error("❌ Error checking VHC status:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   MARK VHC AS SENT
   Called when manager/service advisor sends VHC to customer
============================================ */
export const markVHCAsSent = async (jobId, sentBy, sendMethod = "email", customerEmail = null) => {
  console.log(`📤 Marking VHC as sent for job ${jobId} via ${sendMethod}`);
  
  try {
    // Get job data
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        vhc_sent_at,
        vhc_completed_at,
        vhc_checks(vhc_id)
      `)
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    if (!jobData) {
      console.log("⚠️ Job not found");
      return { success: false, error: "Job not found" };
    }
    
    // Check if VHC has been completed
    if (!jobData.vhc_checks || jobData.vhc_checks.length === 0) {
      console.log("⚠️ Cannot send VHC - no checks found");
      return { success: false, error: "VHC has no checks" };
    }
    
    if (!jobData.vhc_completed_at) {
      console.log("⚠️ Cannot send VHC - VHC must be completed first");
      return {
        success: false,
        error: "Cannot send VHC before it is completed.",
      };
    }
    
    // Log VHC send event
    const { error: logError } = await supabase
      .from("vhc_send_history")
      .insert([{
        job_id: jobId,
        sent_by: sentBy,
        sent_at: new Date().toISOString(),
        send_method: sendMethod,
        customer_email: customerEmail,
        created_at: new Date().toISOString()
      }]);
    
    if (logError) {
      console.error("⚠️ Failed to log VHC send event:", logError);
      // Continue anyway - logging failure shouldn't block the status update
    }
    
    // Log sub-status: Sent to Customer
    const result = await autoSetVHCSentStatus(jobId, sentBy);
    
    if (result.success) {
      console.log("✅ VHC marked as sent, status updated");
      return { 
        success: true, 
        statusUpdated: true, 
        newStatus: "Sent to Customer",
        message: "VHC sent to customer successfully"
      };
    } else {
      console.error("❌ Failed to update status:", result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error("❌ Error marking VHC as sent:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   AUTHORIZE ADDITIONAL WORK
   Called when customer authorizes additional work from VHC
============================================ */
export const authorizeAdditionalWork = async (
  jobId, 
  authorizedBy, 
  authorizedItems = [], 
  customerNotes = ""
) => {
  console.log(`✅ Authorizing additional work for job ${jobId}`);
  
  try {
    // Get job data
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        vhc_sent_at,
        vhc_checks(vhc_id, section, issue_title, issue_description, measurement)
      `)
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    if (!jobData) {
      console.log("⚠️ Job not found");
      return { success: false, error: "Job not found" };
    }
    
    // Check if VHC has been sent
    if (!jobData.vhc_sent_at) {
      console.log("⚠️ Cannot authorize work - VHC must be sent first");
      return { 
        success: false, 
        error: "Cannot authorize work before VHC is sent."
      };
    }
    
    // Log authorization
    const { error: logError } = await supabase
      .from("vhc_authorizations")
      .insert([{
        job_id: jobId,
        authorized_by: authorizedBy,
        authorized_at: new Date().toISOString(),
        authorized_items: authorizedItems,
        customer_notes: customerNotes,
        created_at: new Date().toISOString()
      }]);
    
    if (logError) {
      console.error("⚠️ Failed to log authorization:", logError);
      // Continue anyway
    }
    
    // Log sub-status: Customer Authorised
    const result = await autoSetAdditionalWorkRequiredStatus(jobId, authorizedBy);
    
    if (result.success) {
      console.log("✅ Additional work authorized, status updated");
      return { 
        success: true, 
        statusUpdated: true, 
        newStatus: "Customer Authorised",
        message: "Additional work authorized successfully"
      };
    } else {
      console.error("❌ Failed to update status:", result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error("❌ Error authorizing additional work:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   DECLINE ADDITIONAL WORK
   Called when customer declines additional work from VHC
   Moves job to "Being Washed" or "Complete"
============================================ */
export const declineAdditionalWork = async (jobId, declinedBy, customerNotes = "") => {
  console.log(`❌ Customer declined additional work for job ${jobId}`);
  
  try {
    // Get job data
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_number, status, vhc_sent_at")
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    if (!jobData) {
      console.log("⚠️ Job not found");
      return { success: false, error: "Job not found" };
    }
    
    // Check if VHC has been sent
    if (!jobData.vhc_sent_at) {
      console.log("⚠️ Cannot decline work - VHC must be sent first");
      return { 
        success: false, 
        error: "Cannot decline work before VHC is sent."
      };
    }
    
    // Log declination
    const { error: logError } = await supabase
      .from("vhc_declinations")
      .insert([{
        job_id: jobId,
        declined_by: declinedBy,
        declined_at: new Date().toISOString(),
        customer_notes: customerNotes,
        created_at: new Date().toISOString()
      }]);
    
    if (logError) {
      console.error("⚠️ Failed to log declination:", logError);
      // Continue anyway
    }
    
    // Update job notes to indicate customer declined additional work
    const { error: noteError } = await supabase
      .from("job_notes")
      .insert([{
        job_id: jobId,
        note_text: `Customer declined additional work from VHC. ${customerNotes ? `Notes: ${customerNotes}` : ""}`,
        user_id: declinedBy,
        created_at: new Date().toISOString()
      }]);
    
    if (noteError) {
      console.error("⚠️ Failed to add note:", noteError);
    }

    await logJobSubStatus(jobId, "Customer Declined", declinedBy, "Additional work declined");

    console.log("ℹ️ Customer declined additional work - job can proceed to completion");
    
    return { 
      success: true, 
      message: "Additional work declined, job ready for washing/completion",
      requiresManualUpdate: true // Manager needs to manually update status
    };
    
  } catch (error) {
    console.error("❌ Error declining additional work:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   CHECK WARRANTY JOB COMPLETION
   Called when warranty job is being completed
   Checks if write-up is complete, otherwise sends to QC
============================================ */
export const checkWarrantyJobCompletion = async (jobId, userId) => {
  console.log(`🔍 Checking warranty job completion for job ${jobId}`);
  
  try {
    // Get job data
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        job_source,
        job_writeups(writeup_id, work_performed, parts_used, recommendations)
      `)
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    if (!jobData) {
      console.log("⚠️ Job not found");
      return { success: false, error: "Job not found" };
    }
    
    // Check if it's a warranty job
    if (jobData.job_source !== "Warranty") {
      console.log("ℹ️ Not a warranty job - no QC needed");
      return { success: true, message: "Not a warranty job" };
    }
    
    // Check if write-up exists and is complete
    if (!jobData.job_writeups || jobData.job_writeups.length === 0) {
      console.log("⚠️ Warranty job missing write-up");
      await autoSetWarrantyQualityControlStatus(jobId, userId);
      return { 
        success: true, 
        statusUpdated: false, 
        message: "Warranty job requires write-up before completion"
      };
    }
    
    // Check if write-up is complete (has all required fields)
    const writeUp = jobData.job_writeups[0];
    const isComplete = writeUp.work_performed && 
                       writeUp.work_performed.trim() !== "" &&
                       writeUp.parts_used;
    
    if (!isComplete) {
      console.log("⚠️ Warranty write-up incomplete - sending to QC");
      
      await autoSetWarrantyQualityControlStatus(jobId, userId);
      return { 
        success: true, 
        statusUpdated: false, 
        message: "Warranty job requires completed write-up before completion"
      };
    }
    
    // Write-up is complete - can proceed to completion
    console.log("✅ Warranty write-up complete - job can be completed");
    return { 
      success: true, 
      message: "Warranty write-up complete",
      canComplete: true 
    };
    
  } catch (error) {
    console.error("❌ Error checking warranty job:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   COMPLETE WARRANTY QC
   Called when warranty write-up is completed during QC
   Updates status to Warranty Ready to Claim
============================================ */
export const completeWarrantyQC = async (jobId, completedBy) => {
  console.log(`✅ Completing warranty QC for job ${jobId}`);
  
  try {
    // Get job data
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        job_source,
        job_writeups(writeup_id, work_performed, parts_used)
      `)
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    if (!jobData) {
      console.log("⚠️ Job not found");
      return { success: false, error: "Job not found" };
    }
    
    // Check if write-up is now complete
    if (!jobData.job_writeups || jobData.job_writeups.length === 0) {
      console.log("⚠️ Write-up still missing");
      return { success: false, error: "Write-up required to complete QC" };
    }
    
    const writeUp = jobData.job_writeups[0];
    const isComplete = writeUp.work_performed && 
                       writeUp.work_performed.trim() !== "" &&
                       writeUp.parts_used;
    
    if (!isComplete) {
      console.log("⚠️ Write-up still incomplete");
      return { 
        success: false, 
        error: "Write-up must be complete with work performed and parts used" 
      };
    }
    
    // Update status to Warranty Ready to Claim
    const result = await autoSetWarrantyReadyToClaimStatus(jobId, completedBy);
    
    if (result.success) {
      console.log("✅ Status updated to Warranty Ready to Claim");
      return { 
        success: true, 
        statusUpdated: false, 
        newStatus: null,
        message: "Warranty QC complete - ready to claim"
      };
    } else {
      console.error("❌ Failed to update status:", result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error("❌ Error completing warranty QC:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   GET VHC SEND HISTORY
   Returns history of when VHC was sent to customer
============================================ */
export const getVHCSendHistory = async (jobId) => {
  console.log(`📋 Fetching VHC send history for job ${jobId}`);
  
  try {
    const { data, error } = await supabase
      .from("vhc_send_history")
      .select(`
        id,
        sent_by,
        sent_at,
        send_method,
        customer_email,
        created_at,
        user:sent_by(first_name, last_name, email)
      `)
      .eq("job_id", jobId)
      .order("sent_at", { ascending: false });
    
    if (error) throw error;
    
    console.log(`✅ Found ${data?.length || 0} send events`);
    
    return { success: true, data: data || [] };
    
  } catch (error) {
    console.error("❌ Error fetching VHC send history:", error);
    return { success: false, error: error.message, data: [] };
  }
};

/* ============================================
   GET VHC AUTHORIZATION HISTORY
   Returns history of customer authorizations/declinations
============================================ */
export const getVHCAuthorizationHistory = async (jobId) => {
  console.log(`📋 Fetching VHC authorization history for job ${jobId}`);
  
  try {
    // Get authorizations
    const { data: authData, error: authError } = await supabase
      .from("vhc_authorizations")
      .select("*")
      .eq("job_id", jobId)
      .order("authorized_at", { ascending: false });
    
    if (authError) throw authError;
    
    // Get declinations
    const { data: declineData, error: declineError } = await supabase
      .from("vhc_declinations")
      .select("*")
      .eq("job_id", jobId)
      .order("declined_at", { ascending: false });
    
    if (declineError) throw declineError;
    
    console.log(`✅ Found ${authData?.length || 0} authorizations, ${declineData?.length || 0} declinations`);
    
    return { 
      success: true, 
      data: {
        authorizations: authData || [],
        declinations: declineData || []
      }
    };
    
  } catch (error) {
    console.error("❌ Error fetching VHC authorization history:", error);
    return { 
      success: false, 
      error: error.message, 
      data: { authorizations: [], declinations: [] } 
    };
  }
};

/* ============================================
   CALCULATE VHC TOTALS
   Calculates red work, amber work, authorized, and declined totals
============================================ */
export const calculateVHCTotals = async (jobId) => {
  console.log(`💰 Calculating VHC totals for job ${jobId}`);
  
  try {
    // Get VHC checks
    const { data: vhcChecks, error: vhcError } = await supabase
      .from("vhc_checks")
      .select("vhc_id, section, issue_title, measurement")
      .eq("job_id", jobId);
    
    if (vhcError) throw vhcError;
    
    if (!vhcChecks || vhcChecks.length === 0) {
      return {
        success: true,
        data: {
          redWork: 0,
          amberWork: 0,
          totalWork: 0,
          authorized: 0,
          declined: 0
        }
      };
    }
    
    // Calculate red work (Brakes section)
    const redWork = vhcChecks
      .filter(check => check.section === "Brakes" && check.measurement)
      .reduce((sum, check) => sum + (parseFloat(check.measurement) || 0), 0);
    
    // Calculate amber work (Tyres section)
    const amberWork = vhcChecks
      .filter(check => check.section === "Tyres" && check.measurement)
      .reduce((sum, check) => sum + (parseFloat(check.measurement) || 0), 0);
    
    const totalWork = redWork + amberWork;
    
    // Get authorizations to calculate authorized amount
    const { data: authData } = await supabase
      .from("vhc_authorizations")
      .select("authorized_items")
      .eq("job_id", jobId);
    
    let authorized = 0;
    if (authData && authData.length > 0) {
      authData.forEach(auth => {
        if (auth.authorized_items && Array.isArray(auth.authorized_items)) {
          auth.authorized_items.forEach(item => {
            authorized += parseFloat(item.amount) || 0;
          });
        }
      });
    }
    
    const declined = totalWork - authorized;
    
    console.log(`✅ VHC Totals: Red £${redWork.toFixed(2)}, Amber £${amberWork.toFixed(2)}, Authorized £${authorized.toFixed(2)}, Declined £${declined.toFixed(2)}`);
    
    return {
      success: true,
      data: {
        redWork: parseFloat(redWork.toFixed(2)),
        amberWork: parseFloat(amberWork.toFixed(2)),
        totalWork: parseFloat(totalWork.toFixed(2)),
        authorized: parseFloat(authorized.toFixed(2)),
        declined: parseFloat(declined.toFixed(2))
      }
    };
    
  } catch (error) {
    console.error("❌ Error calculating VHC totals:", error);
    return { 
      success: false, 
      error: error.message,
      data: {
        redWork: 0,
        amberWork: 0,
        totalWork: 0,
        authorized: 0,
        declined: 0
      }
    };
  }
};
