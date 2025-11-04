// file location: src/lib/database/jobClocking.js

import { supabase } from "../supabaseClient"; // Import the Supabase client for DB access
import {                                     // Import auto-status helpers for workflow updates
  autoSetWorkshopStatus,                      // Sets status when initial work starts
  autoSetAdditionalWorkInProgressStatus       // Sets status when additional work starts
} from "../services/jobStatusService";        // Service that manages job status changes

/* ------------------------------------------------------------
   ✅ HARD GUARDRAILS: Prevent bad types going into integer FKs
   These guards stop "out of range for type integer" at source.
------------------------------------------------------------- */
const toInt = (val, name) => {                // Helper to coerce and validate integers
  if (val === null || val === undefined) {    // Ensure a value was provided
    throw new Error(`${name} is required`);   // Throw a clear error if missing
  }
  const n = Number(val);                      // Convert to number (handles "123" -> 123)
  if (!Number.isInteger(n)) {                 // Must be an integer
    throw new Error(`${name} must be an integer`); // Stop if not integer
  }
  return n;                                   // Return the integer
};

/* ============================================
   CLOCK IN TO JOB
   Technician starts working on a specific job
============================================ */
export const clockInToJob = async (userId, jobId, jobNumber, workType = "initial") => {
  console.log(`🔧 Clocking in: User ${userId} → Job ${jobNumber} (${workType})`); // Log intent
  
  try {
    const userIdInt = toInt(userId, "userId"); // ✅ Enforce integer userId (prevents FK/type errors)
    const jobIdInt = toInt(jobId, "jobId");    // ✅ Enforce integer jobId (prevents FK/type errors)
    const jobNumberText = String(jobNumber || ""); // Ensure jobNumber is stored as text
    const workTypeText = String(workType || "initial"); // Ensure workType is text

    // Check if user is already clocked into this job (open session)
    const { data: existingClock, error: checkError } = await supabase // Query open clocking row
      .from("job_clocking")                                           // job_clocking table
      .select("*")                                                    // Select all columns (we return it if exists)
      .eq("user_id", userIdInt)                                       // Match user
      .eq("job_id", jobIdInt)                                         // Match job
      .is("clock_out", null)                                          // Only active (no clock_out yet)
      .maybeSingle();                                                 // Return one row or null
    
    if (checkError && checkError.code !== "PGRST116") {               // Ignore "no rows" sentinel
      throw checkError;                                               // Propagate any real error
    }
    
    if (existingClock) {                                              // If an active session already exists
      console.log("⚠️ User already clocked into this job");           // Log info
      return {                                                        // Return soft-fail to UI
        success: false, 
        error: "Already clocked into this job",
        data: existingClock 
      };
    }
    
    // Create new clock-in record (typed values only)
    const nowIso = new Date().toISOString();                          // Capture a single timestamp
    const { data: clockData, error: insertError } = await supabase    // Insert a new clocking row
      .from("job_clocking")                                           // Into job_clocking
      .insert([{
        user_id: userIdInt,                                           // ✅ integer FK to users.user_id
        job_id: jobIdInt,                                             // ✅ integer FK to jobs.id
        job_number: jobNumberText,                                     // Text code e.g., "JOB-2025-014"
        clock_in: nowIso,                                             // ISO timestamp
        work_type: workTypeText,                                      // "initial" | "additional"
        created_at: nowIso                                            // ISO timestamp for created_at
      }])
      .select()                                                       // Return inserted row
      .single();                                                      // Exactly one row expected
    
    if (insertError) throw insertError;                               // Stop on insert error
    
    console.log("✅ Clocked in successfully:", clockData);            // Log success
    
    // Get user details for status update (nice-to-have for audit)
    const { data: userData } = await supabase                         // Fetch tech name
      .from("users")                                                  // From users table
      .select("first_name, last_name")                                // Only the needed fields
      .eq("user_id", userIdInt)                                       // Match by user id
      .single();                                                      // One row expected
    
    const techName = userData ? `${userData.first_name} ${userData.last_name}` : "Unknown"; // Build name
    
    // Auto-update job status based on work type
    if (workTypeText === "initial") {                                 // If initial work is starting
      await autoSetWorkshopStatus(jobIdInt, userIdInt, techName);     // Move job into workshop/MOT state
    } else if (workTypeText === "additional") {                       // If additional work is starting
      await autoSetAdditionalWorkInProgressStatus(jobIdInt, userIdInt); // Move to additional work in progress
    }
    
    return { success: true, data: clockData };                        // Return success
    
  } catch (error) {
    console.error("❌ Error clocking in to job:", error);             // Log error
    return { success: false, error: error.message };                  // Return clean error for UI
  }
};

/* ============================================
   CLOCK OUT FROM JOB
   Technician finishes working on a specific job
============================================ */
export const clockOutFromJob = async (userId, jobId) => {
  console.log(`⏸️ Clocking out: User ${userId} from Job ${jobId}`);    // Log intent
  
  try {
    const userIdInt = toInt(userId, "userId");                         // ✅ Enforce integer userId
    const jobIdInt = toInt(jobId, "jobId");                            // ✅ Enforce integer jobId

    // Find active clock-in record for this user+job
    const { data: activeClocking, error: findError } = await supabase  // Fetch open clocking
      .from("job_clocking")                                            // From job_clocking
      .select("*")                                                     // Get the full row (we need clock_in)
      .eq("user_id", userIdInt)                                        // Match user
      .eq("job_id", jobIdInt)                                          // Match job
      .is("clock_out", null)                                           // Only rows not clocked out
      .order("clock_in", { ascending: false })                         // Latest first
      .limit(1)                                                        // Only one
      .maybeSingle();                                                  // One or null
    
    if (findError && findError.code !== "PGRST116") {                  // Ignore "no rows" sentinel
      throw findError;                                                 // Propagate real error
    }
    
    if (!activeClocking) {                                             // If no open clocking exists
      console.log("⚠️ No active clock-in found for this job");         // Log info
      return {                                                         // Return soft-fail
        success: false, 
        error: "No active clock-in found for this job" 
      };
    }
    
    // Update record with clock-out time
    const clockOutTime = new Date().toISOString();                     // Timestamp for clock_out
    const { data: updatedClock, error: updateError } = await supabase  // Perform update
      .from("job_clocking")                                            // On job_clocking
      .update({                                                        // Set fields
        clock_out: clockOutTime,                                       // Set clock_out
        updated_at: clockOutTime                                       // Set updated_at
      })
      .eq("id", activeClocking.id)                                     // Match the row by id
      .select()                                                        // Return updated row
      .single();                                                       // One row expected
    
    if (updateError) throw updateError;                                // Stop on update error
    
    // Calculate hours worked
    const clockIn = new Date(activeClocking.clock_in);                 // Parse clock_in
    const clockOut = new Date(clockOutTime);                           // Parse clock_out
    const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);       // Convert ms to hours
    
    console.log(`✅ Clocked out successfully. Hours worked: ${hoursWorked.toFixed(2)}`); // Log success
    
    return {                                                           // Return success response
      success: true, 
      data: updatedClock,
      hoursWorked: hoursWorked.toFixed(2)
    };
    
  } catch (error) {
    console.error("❌ Error clocking out from job:", error);           // Log error
    return { success: false, error: error.message };                   // Return clean error
  }
};

/* ============================================
   GET USER'S ACTIVE JOBS
   Returns all jobs the user is currently clocked into
============================================ */
export const getUserActiveJobs = async (userId) => {
  console.log(`🔍 Fetching active jobs for user ${userId}`);           // Log intent
  
  try {
    const userIdInt = toInt(userId, "userId");                         // ✅ Enforce integer userId

    const { data, error } = await supabase                             // Query open clocking + related job
      .from("job_clocking")                                            // From job_clocking
      .select(`                                                         
        id,                                                             /* clocking row id */
        job_id,                                                         /* numeric FK to jobs.id */
        job_number,                                                     /* text job code */
        clock_in,                                                       /* start time */
        work_type,                                                      /* initial/additional */
        job:job_id (                                                    /* join to jobs via FK */
          id,                                                           /* numeric job id */
          job_number,                                                   /* job code */
          vehicle_reg,                                                  /* reg text on jobs */
          vehicle_make_model,                                           /* make/model text */
          status                                                        /* current status */
        )
      `)
      .eq("user_id", userIdInt)                                        // Filter by user
      .is("clock_out", null)                                           // Only active sessions
      .order("clock_in", { ascending: false });                        // Newest first
    
    if (error) throw error;                                            // Stop on error
    
    // Format response for UI
    const formattedJobs = (data || []).map(clocking => {               // Map rows to UI-friendly shape
      const job = clocking.job;                                        // Joined job row
      const clockInTime = new Date(clocking.clock_in);                 // Parse clock_in
      const now = new Date();                                          // Current time
      const hoursWorked = (now - clockInTime) / (1000 * 60 * 60);      // Live hours

      return {                                                         // Return merged object
        clockingId: clocking.id,                                       // Clocking row id
        jobId: clocking.job_id,                                        // Job id (integer)
        jobNumber: clocking.job_number || job?.job_number,             // Prefer clocking job_number
        clockIn: clocking.clock_in,                                    // Start time
        workType: clocking.work_type,                                  // Work type
        hoursWorked: hoursWorked.toFixed(2),                            // Hours rounded
        reg: job?.vehicle_reg || "N/A",                                // Vehicle reg
        makeModel: job?.vehicle_make_model || "N/A",                   // Make/model
        customer: "N/A",                                               // Placeholder (not joined here)
        status: job?.status || "Unknown"                               // Job status
      };
    });
    
    console.log(`✅ Found ${formattedJobs.length} active jobs`);        // Log count
    
    return { success: true, data: formattedJobs };                     // Return success
    
  } catch (error) {
    console.error("❌ Error fetching active jobs:", error);             // Log error
    return { success: false, error: error.message, data: [] };         // Return clean error + empty list
  }
};

/* ============================================
   GET JOB CLOCKING HISTORY
   Returns all clocking records for a specific job
============================================ */
export const getJobClockingHistory = async (jobId) => {
  console.log(`📋 Fetching clocking history for job ${jobId}`);        // Log intent
  
  try {
    const jobIdInt = toInt(jobId, "jobId");                            // ✅ Enforce integer jobId

    const { data, error } = await supabase                             // Query all clocking rows by job
      .from("job_clocking")                                            // From job_clocking
      .select(`                                                         
        id,                                                             /* clocking id */
        user_id,                                                        /* technician id */
        clock_in,                                                       /* start */
        clock_out,                                                      /* end (nullable) */
        work_type,                                                      /* initial/additional */
        created_at,                                                     /* created time */
        user:user_id (                                                  /* join to users */
          user_id,                                                      /* id */
          first_name,                                                   /* first name */
          last_name,                                                    /* last name */
          email                                                         /* email */
        )
      `)
      .eq("job_id", jobIdInt)                                          // Filter by target job
      .order("clock_in", { ascending: true });                         // Oldest first
    
    if (error) throw error;                                            // Stop on error
    
    // Calculate hours per record
    const formattedHistory = (data || []).map(clocking => {            // Map rows
      let hoursWorked = 0;                                             // Default hours

      if (clocking.clock_in && clocking.clock_out) {                   // If closed session
        const clockIn = new Date(clocking.clock_in);                   // Parse clock_in
        const clockOut = new Date(clocking.clock_out);                 // Parse clock_out
        hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);         // Compute hours
      } else if (clocking.clock_in) {                                  // If still active
        const clockIn = new Date(clocking.clock_in);                   // Parse clock_in
        const now = new Date();                                        // Current time
        hoursWorked = (now - clockIn) / (1000 * 60 * 60);              // Compute hours so far
      }
      
      return {                                                         // Build UI object
        id: clocking.id,                                               // Clocking id
        technicianId: clocking.user_id,                                // Tech id
        technicianName: clocking.user 
          ? `${clocking.user.first_name} ${clocking.user.last_name}`   // Compose name if present
          : "Unknown",                                                 // Fallback
        technicianEmail: clocking.user?.email || "",                   // Email if present
        clockIn: clocking.clock_in,                                    // Start time
        clockOut: clocking.clock_out,                                  // End time (nullable)
        workType: clocking.work_type,                                  // Work type
        hoursWorked: hoursWorked.toFixed(2),                            // Hours rounded
        isActive: !clocking.clock_out                                  // Active if no clock_out
      };
    });
    
    // Sum total hours across records
    const totalHours = formattedHistory.reduce((sum, record) => {      // Reduce for total
      return sum + parseFloat(record.hoursWorked);                      // Add numeric hours
    }, 0);
    
    console.log(`✅ Found ${formattedHistory.length} records. Total: ${totalHours.toFixed(2)}h`); // Log
    
    return {                                                           // Return success
      success: true, 
      data: formattedHistory,
      totalHours: totalHours.toFixed(2)
    };
    
  } catch (error) {
    console.error("❌ Error fetching job clocking history:", error);    // Log error
    return { success: false, error: error.message, data: [], totalHours: "0.00" }; // Clean fail
  }
};

/* ============================================
   GET ALL TECHNICIANS CURRENTLY WORKING
   Returns all technicians who are clocked into any job
============================================ */
export const getAllActiveTechnicians = async () => {
  console.log(`👥 Fetching all active technicians`);                   // Log intent
  
  try {
    const { data, error } = await supabase                             // Query open clocking + joins
      .from("job_clocking")                                            // From job_clocking
      .select(`                                                         
        id,                                                             /* clocking id */
        user_id,                                                        /* tech id */
        job_id,                                                         /* numeric job id */
        job_number,                                                     /* text job code */
        clock_in,                                                       /* start time */
        work_type,                                                      /* work type */
        user:user_id (                                                  /* join users */
          user_id,                                                      /* id */
          first_name,                                                   /* first name */
          last_name,                                                    /* last name */
          email,                                                        /* email */
          role                                                          /* role */
        ),
        job:job_id (                                                    /* join jobs */
          id,                                                           /* numeric id */
          job_number,                                                   /* code */
          vehicle_reg,                                                  /* reg */
          vehicle_make_model,                                           /* make/model */
          status                                                        /* status */
        )
      `)
      .is("clock_out", null)                                           // Only active sessions
      .order("clock_in", { ascending: false });                        // Newest first
    
    if (error) throw error;                                            // Stop on error
    
    // Group clocking by technician
    const technicianMap = {};                                          // Map user_id → tech object
    
    (data || []).forEach(clocking => {                                 // Iterate rows
      const userId = clocking.user_id;                                 // Extract tech id
      
      if (!technicianMap[userId]) {                                    // If first time seeing this tech
        technicianMap[userId] = {                                      // Create tech bucket
          userId: userId,                                              // Tech id
          name: clocking.user 
            ? `${clocking.user.first_name} ${clocking.user.last_name}` // Compose name
            : "Unknown",                                               // Fallback
          email: clocking.user?.email || "",                           // Email if present
          role: clocking.user?.role || "",                             // Role if present
          jobs: []                                                     // Jobs list
        };
      }
      
      const clockInTime = new Date(clocking.clock_in);                 // Parse clock_in
      const now = new Date();                                          // Current time
      const hoursWorked = (now - clockInTime) / (1000 * 60 * 60);      // Hours since start
      
      technicianMap[userId].jobs.push({                                // Push job summary
        clockingId: clocking.id,                                       // Clocking id
        jobId: clocking.job_id,                                        // Job id
        jobNumber: clocking.job_number,                                 // Text code
        reg: clocking.job?.vehicle_reg || "N/A",                       // Vehicle reg
        makeModel: clocking.job?.vehicle_make_model || "N/A",          // Make/model
        status: clocking.job?.status || "Unknown",                     // Status
        clockIn: clocking.clock_in,                                    // Start time
        workType: clocking.work_type,                                  // Work type
        hoursWorked: hoursWorked.toFixed(2)                             // Hours rounded
      });
    });
    
    const technicians = Object.values(technicianMap);                  // Convert map to array
    
    console.log(`✅ Found ${technicians.length} active techs across ${data?.length || 0} jobs`); // Log
    
    return { success: true, data: technicians };                       // Return success
    
  } catch (error) {
    console.error("❌ Error fetching active technicians:", error);      // Log error
    return { success: false, error: error.message, data: [] };         // Clean fail
  }
};

/* ============================================
   CLOCK OUT ALL JOBS FOR USER
   Emergency function to clock user out of all jobs
============================================ */
export const clockOutAllJobs = async (userId) => {
  console.log(`⏹️ Clocking out all jobs for user ${userId}`);          // Log intent
  
  try {
    const userIdInt = toInt(userId, "userId");                         // ✅ Enforce integer userId

    const clockOutTime = new Date().toISOString();                     // Timestamp for updates
    
    const { data, error } = await supabase                             // Update all open sessions
      .from("job_clocking")                                            // On job_clocking
      .update({                                                        // Set fields
        clock_out: clockOutTime,                                       // Close session
        updated_at: clockOutTime                                       // Update timestamp
      })
      .eq("user_id", userIdInt)                                        // For this user
      .is("clock_out", null)                                           // Only open sessions
      .select();                                                       // Return updated rows
    
    if (error) throw error;                                            // Stop on error
    
    console.log(`✅ Clocked out of ${data?.length || 0} jobs`);         // Log count
    
    return { success: true, data: data || [] };                        // Return success
    
  } catch (error) {
    console.error("❌ Error clocking out all jobs:", error);            // Log error
    return { success: false, error: error.message };                   // Clean fail
  }
};

/* ============================================
   GET TECHNICIAN DAILY SUMMARY
   Returns summary of hours worked today across all jobs
============================================ */
export const getTechnicianDailySummary = async (userId, date = null) => {
  const targetDate = date || new Date().toISOString().split("T")[0];   // Default to today (YYYY-MM-DD)
  console.log(`📊 Fetching daily summary for user ${userId} on ${targetDate}`); // Log intent
  
  try {
    const userIdInt = toInt(userId, "userId");                         // ✅ Enforce integer userId

    const { data, error } = await supabase                             // Query all clocking rows on date
      .from("job_clocking")                                            // From job_clocking
      .select(`                                                         
        id,                                                             /* clocking id */
        job_number,                                                     /* job code */
        clock_in,                                                       /* start */
        clock_out,                                                      /* end (nullable) */
        work_type                                                       /* initial/additional */
      `)
      .eq("user_id", userIdInt)                                        // For this user
      .gte("clock_in", `${targetDate}T00:00:00`)                       // From start of day
      .lte("clock_in", `${targetDate}T23:59:59`)                       // To end of day
      .order("clock_in", { ascending: true });                         // Oldest first
    
    if (error) throw error;                                            // Stop on error
    
    let totalHours = 0;                                                // Initialise totals
    let activeJobs = 0;                                                // Count active
    let completedJobs = 0;                                             // Count completed
    
    const jobsSummary = (data || []).map(clocking => {                 // Build job summaries
      let hoursWorked = 0;                                             // Hours default
      let isActive = false;                                            // Active flag
      
      if (clocking.clock_in && clocking.clock_out) {                   // Closed session
        const clockIn = new Date(clocking.clock_in);                   // Parse in
        const clockOut = new Date(clocking.clock_out);                 // Parse out
        hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);         // Compute hours
        completedJobs++;                                               // Increment completed
      } else if (clocking.clock_in) {                                  // Open session
        const clockIn = new Date(clocking.clock_in);                   // Parse in
        const now = new Date();                                        // Now
        hoursWorked = (now - clockIn) / (1000 * 60 * 60);              // Compute hours to now
        isActive = true;                                               // Mark active
        activeJobs++;                                                  // Increment active
      }
      
      totalHours += hoursWorked;                                       // Add to total
      
      return {                                                         // Build summary row
        jobNumber: clocking.job_number,                                // Job code
        clockIn: clocking.clock_in,                                    // Start time
        clockOut: clocking.clock_out,                                  // End time
        workType: clocking.work_type,                                  // Work type
        hoursWorked: hoursWorked.toFixed(2),                            // Hours rounded
        isActive                                                       // Active flag
      };
    });
    
    console.log(`✅ Daily summary: ${totalHours.toFixed(2)}h, ${activeJobs} active, ${completedJobs} completed`); // Log
    
    return {                                                           // Return success payload
      success: true,
      data: {
        date: targetDate,                                              // Date covered
        totalHours: totalHours.toFixed(2),                              // Total hours
        activeJobs,                                                     // Active count
        completedJobs,                                                  // Completed count
        jobsSummary                                                     // Per-job summary list
      }
    };
    
  } catch (error) {
    console.error("❌ Error fetching daily summary:", error);           // Log error
    return {                                                            // Return safe empty structure
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
  console.log(`🔄 Switching jobs: User ${userId} from Job ${fromJobId} to Job ${toJobId}`); // Log intent
  
  try {
    const userIdInt = toInt(userId, "userId");                         // ✅ Enforce integer userId
    const fromJobIdInt = toInt(fromJobId, "fromJobId");                // ✅ Enforce integer fromJobId
    const toJobIdInt = toInt(toJobId, "toJobId");                      // ✅ Enforce integer toJobId
    const toJobNumberText = String(toJobNumber || "");                 // Ensure text code
    const workTypeText = String(workType || "initial");                // Ensure text
    
    // Clock out from current job (ignore soft-fail)
    const clockOutResult = await clockOutFromJob(userIdInt, fromJobIdInt); // Attempt clock-out
    
    if (!clockOutResult.success) {                                     // If clock out failed
      console.log("⚠️ Failed to clock out from current job");          // Log warning (not fatal)
      // Continue anyway - might not be critical                        // Keep going
    }
    
    // Clock into new job (this enforces integer types again)
    const clockInResult = await clockInToJob(                          // Attempt clock-in
      userIdInt,                                                       // user id (int)
      toJobIdInt,                                                      // job id (int)
      toJobNumberText,                                                 // job number (text)
      workTypeText                                                     // work type (text)
    );
    
    if (!clockInResult.success) {                                      // If clock-in failed
      console.error("❌ Failed to clock into new job");                 // Log error
      return clockInResult;                                            // Bubble up error
    }
    
    console.log("✅ Successfully switched jobs");                       // Log success
    
    return {                                                           // Return success payload
      success: true, 
      data: {
        clockedOut: clockOutResult.data,                                // Data from clock-out
        clockedIn: clockInResult.data                                   // Data from clock-in
      }
    };
    
  } catch (error) {
    console.error("❌ Error switching jobs:", error);                   // Log error
    return { success: false, error: error.message };                   // Return clean error
  }
};