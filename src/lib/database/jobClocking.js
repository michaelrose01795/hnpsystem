// file location: src/lib/database/jobClocking.js

import { supabase } from "../supabaseClient"; // Supabase client for database operations
import { 
  autoSetWorkshopStatus, 
  autoSetAdditionalWorkInProgressStatus 
} from "../services/jobStatusService"; // Import auto-status functions

/* ============================================
   CLOCK IN TO JOB
   Technician starts working on a specific job
============================================ */
export const clockInToJob = async (userId, jobId, jobNumber, workType = "initial") => {
  console.log(`🔧 Clocking in: User ${userId} → Job ${jobNumber} (${workType})`);
  
  try {
    // Check if user is already clocked into this job
    const { data: existingClock, error: checkError } = await supabase
      .from("job_clocking")
      .select("*")
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .is("clock_out", null)
      .maybeSingle();
    
    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }
    
    if (existingClock) {
      console.log("⚠️ User already clocked into this job");
      return { 
        success: false, 
        error: "Already clocked into this job",
        data: existingClock 
      };
    }
    
    // Create new clock-in record
    const { data: clockData, error: insertError } = await supabase
      .from("job_clocking")
      .insert([{
        user_id: userId,
        job_id: jobId,
        job_number: jobNumber,
        clock_in: new Date().toISOString(),
        work_type: workType, // "initial" or "additional"
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    console.log("✅ Clocked in successfully:", clockData);
    
    // Get user details for status update
    const { data: userData } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .single();
    
    const techName = userData ? `${userData.first_name} ${userData.last_name}` : "Unknown";
    
    // Auto-update job status based on work type
    if (workType === "initial") {
      // First time working on job - set to Workshop/MOT
      await autoSetWorkshopStatus(jobId, userId, techName);
    } else if (workType === "additional") {
      // Additional work - set to Additional Work Being Carried Out
      await autoSetAdditionalWorkInProgressStatus(jobId, userId);
    }
    
    return { success: true, data: clockData };
    
  } catch (error) {
    console.error("❌ Error clocking in to job:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   CLOCK OUT FROM JOB
   Technician finishes working on a specific job
============================================ */
export const clockOutFromJob = async (userId, jobId) => {
  console.log(`⏸️ Clocking out: User ${userId} from Job ${jobId}`);
  
  try {
    // Find active clock-in record
    const { data: activeClocking, error: findError } = await supabase
      .from("job_clocking")
      .select("*")
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }
    
    if (!activeClocking) {
      console.log("⚠️ No active clock-in found for this job");
      return { 
        success: false, 
        error: "No active clock-in found for this job" 
      };
    }
    
    // Update record with clock-out time
    const clockOutTime = new Date().toISOString();
    const { data: updatedClock, error: updateError } = await supabase
      .from("job_clocking")
      .update({ 
        clock_out: clockOutTime,
        updated_at: clockOutTime
      })
      .eq("id", activeClocking.id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Calculate hours worked
    const clockIn = new Date(activeClocking.clock_in);
    const clockOut = new Date(clockOutTime);
    const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60); // Convert ms to hours
    
    console.log(`✅ Clocked out successfully. Hours worked: ${hoursWorked.toFixed(2)}`);
    
    return { 
      success: true, 
      data: updatedClock,
      hoursWorked: hoursWorked.toFixed(2)
    };
    
  } catch (error) {
    console.error("❌ Error clocking out from job:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   GET USER'S ACTIVE JOBS
   Returns all jobs the user is currently clocked into
============================================ */
export const getUserActiveJobs = async (userId) => {
  console.log(`🔍 Fetching active jobs for user ${userId}`);
  
  try {
    const { data, error } = await supabase
      .from("job_clocking")
      .select(`
        id,
        job_id,
        job_number,
        clock_in,
        work_type,
        job:job_id (
          id,
          job_number,
          vehicle_reg,
          vehicle_make_model,
          customer_id,
          status,
          vehicle:vehicle_id (
            registration,
            reg_number,
            make_model,
            customer:customer_id (
              firstname,
              lastname
            )
          )
        )
      `)
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false });
    
    if (error) throw error;
    
    // Format response
    const formattedJobs = (data || []).map(clocking => {
      const job = clocking.job;
      const clockInTime = new Date(clocking.clock_in);
      const now = new Date();
      const hoursWorked = (now - clockInTime) / (1000 * 60 * 60);
      
      return {
        clockingId: clocking.id,
        jobId: clocking.job_id,
        jobNumber: clocking.job_number,
        clockIn: clocking.clock_in,
        workType: clocking.work_type,
        hoursWorked: hoursWorked.toFixed(2),
        reg: job?.vehicle_reg || job?.vehicle?.registration || job?.vehicle?.reg_number || "N/A",
        makeModel: job?.vehicle_make_model || job?.vehicle?.make_model || "N/A",
        customer: job?.vehicle?.customer 
          ? `${job.vehicle.customer.firstname} ${job.vehicle.customer.lastname}`
          : "N/A",
        status: job?.status || "Unknown"
      };
    });
    
    console.log(`✅ Found ${formattedJobs.length} active jobs`);
    
    return { success: true, data: formattedJobs };
    
  } catch (error) {
    console.error("❌ Error fetching active jobs:", error);
    return { success: false, error: error.message, data: [] };
  }
};

/* ============================================
   GET JOB CLOCKING HISTORY
   Returns all clocking records for a specific job
============================================ */
export const getJobClockingHistory = async (jobId) => {
  console.log(`📋 Fetching clocking history for job ${jobId}`);
  
  try {
    const { data, error } = await supabase
      .from("job_clocking")
      .select(`
        id,
        user_id,
        clock_in,
        clock_out,
        work_type,
        created_at,
        user:user_id (
          user_id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("job_id", jobId)
      .order("clock_in", { ascending: true });
    
    if (error) throw error;
    
    // Calculate hours for each clocking record
    const formattedHistory = (data || []).map(clocking => {
      let hoursWorked = 0;
      
      if (clocking.clock_in && clocking.clock_out) {
        const clockIn = new Date(clocking.clock_in);
        const clockOut = new Date(clocking.clock_out);
        hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
      } else if (clocking.clock_in) {
        // Still clocked in - calculate hours so far
        const clockIn = new Date(clocking.clock_in);
        const now = new Date();
        hoursWorked = (now - clockIn) / (1000 * 60 * 60);
      }
      
      return {
        id: clocking.id,
        technicianId: clocking.user_id,
        technicianName: clocking.user 
          ? `${clocking.user.first_name} ${clocking.user.last_name}`
          : "Unknown",
        technicianEmail: clocking.user?.email || "",
        clockIn: clocking.clock_in,
        clockOut: clocking.clock_out,
        workType: clocking.work_type,
        hoursWorked: hoursWorked.toFixed(2),
        isActive: !clocking.clock_out
      };
    });
    
    // Calculate total hours for the job
    const totalHours = formattedHistory.reduce((sum, record) => {
      return sum + parseFloat(record.hoursWorked);
    }, 0);
    
    console.log(`✅ Found ${formattedHistory.length} clocking records. Total hours: ${totalHours.toFixed(2)}`);
    
    return { 
      success: true, 
      data: formattedHistory,
      totalHours: totalHours.toFixed(2)
    };
    
  } catch (error) {
    console.error("❌ Error fetching job clocking history:", error);
    return { success: false, error: error.message, data: [], totalHours: "0.00" };
  }
};

/* ============================================
   GET ALL TECHNICIANS CURRENTLY WORKING
   Returns all technicians who are clocked into any job
============================================ */
export const getAllActiveTechnicians = async () => {
  console.log(`👥 Fetching all active technicians`);
  
  try {
    const { data, error } = await supabase
      .from("job_clocking")
      .select(`
        id,
        user_id,
        job_id,
        job_number,
        clock_in,
        work_type,
        user:user_id (
          user_id,
          first_name,
          last_name,
          email,
          role
        ),
        job:job_id (
          id,
          job_number,
          vehicle_reg,
          vehicle_make_model,
          status
        )
      `)
      .is("clock_out", null)
      .order("clock_in", { ascending: false });
    
    if (error) throw error;
    
    // Group by technician
    const technicianMap = {};
    
    (data || []).forEach(clocking => {
      const userId = clocking.user_id;
      
      if (!technicianMap[userId]) {
        technicianMap[userId] = {
          userId: userId,
          name: clocking.user 
            ? `${clocking.user.first_name} ${clocking.user.last_name}`
            : "Unknown",
          email: clocking.user?.email || "",
          role: clocking.user?.role || "",
          jobs: []
        };
      }
      
      const clockInTime = new Date(clocking.clock_in);
      const now = new Date();
      const hoursWorked = (now - clockInTime) / (1000 * 60 * 60);
      
      technicianMap[userId].jobs.push({
        clockingId: clocking.id,
        jobId: clocking.job_id,
        jobNumber: clocking.job_number,
        reg: clocking.job?.vehicle_reg || "N/A",
        makeModel: clocking.job?.vehicle_make_model || "N/A",
        status: clocking.job?.status || "Unknown",
        clockIn: clocking.clock_in,
        workType: clocking.work_type,
        hoursWorked: hoursWorked.toFixed(2)
      });
    });
    
    const technicians = Object.values(technicianMap);
    
    console.log(`✅ Found ${technicians.length} active technicians working on ${data?.length || 0} jobs`);
    
    return { success: true, data: technicians };
    
  } catch (error) {
    console.error("❌ Error fetching active technicians:", error);
    return { success: false, error: error.message, data: [] };
  }
};

/* ============================================
   CLOCK OUT ALL JOBS FOR USER
   Emergency function to clock user out of all jobs
============================================ */
export const clockOutAllJobs = async (userId) => {
  console.log(`⏹️ Clocking out all jobs for user ${userId}`);
  
  try {
    const clockOutTime = new Date().toISOString();
    
    const { data, error } = await supabase
      .from("job_clocking")
      .update({ 
        clock_out: clockOutTime,
        updated_at: clockOutTime
      })
      .eq("user_id", userId)
      .is("clock_out", null)
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Clocked out of ${data?.length || 0} jobs`);
    
    return { success: true, data: data || [] };
    
  } catch (error) {
    console.error("❌ Error clocking out all jobs:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   GET TECHNICIAN DAILY SUMMARY
   Returns summary of hours worked today across all jobs
============================================ */
export const getTechnicianDailySummary = async (userId, date = null) => {
  const targetDate = date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  console.log(`📊 Fetching daily summary for user ${userId} on ${targetDate}`);
  
  try {
    const { data, error } = await supabase
      .from("job_clocking")
      .select(`
        id,
        job_number,
        clock_in,
        clock_out,
        work_type
      `)
      .eq("user_id", userId)
      .gte("clock_in", `${targetDate}T00:00:00`)
      .lte("clock_in", `${targetDate}T23:59:59`)
      .order("clock_in", { ascending: true });
    
    if (error) throw error;
    
    let totalHours = 0;
    let activeJobs = 0;
    let completedJobs = 0;
    
    const jobsSummary = (data || []).map(clocking => {
      let hoursWorked = 0;
      let isActive = false;
      
      if (clocking.clock_in && clocking.clock_out) {
        const clockIn = new Date(clocking.clock_in);
        const clockOut = new Date(clocking.clock_out);
        hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
        completedJobs++;
      } else if (clocking.clock_in) {
        const clockIn = new Date(clocking.clock_in);
        const now = new Date();
        hoursWorked = (now - clockIn) / (1000 * 60 * 60);
        isActive = true;
        activeJobs++;
      }
      
      totalHours += hoursWorked;
      
      return {
        jobNumber: clocking.job_number,
        clockIn: clocking.clock_in,
        clockOut: clocking.clock_out,
        workType: clocking.work_type,
        hoursWorked: hoursWorked.toFixed(2),
        isActive
      };
    });
    
    console.log(`✅ Daily summary: ${totalHours.toFixed(2)} hours, ${activeJobs} active, ${completedJobs} completed`);
    
    return {
      success: true,
      data: {
        date: targetDate,
        totalHours: totalHours.toFixed(2),
        activeJobs,
        completedJobs,
        jobsSummary
      }
    };
    
  } catch (error) {
    console.error("❌ Error fetching daily summary:", error);
    return { 
      success: false, 
      error: error.message,
      data: {
        date: targetDate,
        totalHours: "0.00",
        activeJobs: 0,
        completedJobs: 0,
        jobsSummary: []
      }
    };
  }
};

/* ============================================
   SWITCH JOB
   Clock out of current job and clock into another
============================================ */
export const switchJob = async (userId, fromJobId, toJobId, toJobNumber, workType = "initial") => {
  console.log(`🔄 Switching jobs: User ${userId} from Job ${fromJobId} to Job ${toJobId}`);
  
  try {
    // Clock out from current job
    const clockOutResult = await clockOutFromJob(userId, fromJobId);
    
    if (!clockOutResult.success) {
      console.log("⚠️ Failed to clock out from current job");
      // Continue anyway - might not be critical
    }
    
    // Clock into new job
    const clockInResult = await clockInToJob(userId, toJobId, toJobNumber, workType);
    
    if (!clockInResult.success) {
      console.error("❌ Failed to clock into new job");
      return clockInResult;
    }
    
    console.log("✅ Successfully switched jobs");
    
    return { 
      success: true, 
      data: {
        clockedOut: clockOutResult.data,
        clockedIn: clockInResult.data
      }
    };
    
  } catch (error) {
    console.error("❌ Error switching jobs:", error);
    return { success: false, error: error.message };
  }
};