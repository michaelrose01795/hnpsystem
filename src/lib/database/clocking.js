// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/clocking.js
import { supabase } from "@/lib/supabaseClient";
import dayjs from "dayjs";

/* ============================================
   CLOCK IN
   ✅ Enhanced with validation and error handling
============================================ */
export const clockIn = async (userId) => {
  console.log("⏰ clockIn called for user:", userId); // debug log
  
  try {
    // ✅ Validate user ID
    if (!userId) {
      throw new Error("User ID is required");
    }

    // ✅ Check if already clocked in
    const { data: existing } = await supabase
      .from("time_records")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();

    if (existing) {
      console.warn("⚠️ User already clocked in:", existing);
      return { 
        success: false, 
        error: { message: "You are already clocked in" },
        data: existing
      };
    }

    // ✅ Create new clock-in record
    const clockInTime = new Date().toISOString();
    const date = dayjs().format("YYYY-MM-DD");

    const { data, error } = await supabase
      .from("time_records")
      .insert([{
        user_id: userId,
        clock_in: clockInTime,
        clock_out: null,
        date: date,
        hours_worked: null,
        break_minutes: 0,
        notes: null,
        created_at: clockInTime
      }])
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          role
        )
      `)
      .single();

    if (error) throw error;

    console.log("✅ Clock-in successful:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ clockIn error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   CLOCK OUT
   ✅ Enhanced with break time and calculations
============================================ */
export const clockOut = async (userId, breakMinutes = 0, notes = null) => {
  console.log("⏰ clockOut called for user:", userId); // debug log
  
  try {
    // ✅ Validate user ID
    if (!userId) {
      throw new Error("User ID is required");
    }

    // ✅ Find active clock-in record
    const { data: record } = await supabase
      .from("time_records")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();

    if (!record) {
      console.warn("⚠️ No active clock-in found for user:", userId);
      return { 
        success: false, 
        error: { message: "No active clock-in found. Please clock in first." } 
      };
    }

    // ✅ Calculate hours worked
    const clockOutTime = new Date().toISOString();
    const clockInTime = new Date(record.clock_in);
    const totalMinutes = (new Date(clockOutTime) - clockInTime) / (1000 * 60);
    const workMinutes = totalMinutes - (breakMinutes || 0);
    const hoursWorked = (workMinutes / 60).toFixed(2);

    console.log("📊 Time calculation:", {
      clockIn: clockInTime,
      clockOut: clockOutTime,
      totalMinutes: totalMinutes.toFixed(2),
      breakMinutes,
      workMinutes: workMinutes.toFixed(2),
      hoursWorked
    });

    // ✅ Update record with clock-out time
    const { data, error } = await supabase
      .from("time_records")
      .update({ 
        clock_out: clockOutTime,
        hours_worked: parseFloat(hoursWorked),
        break_minutes: breakMinutes || 0,
        notes: notes,
        updated_at: clockOutTime
      })
      .eq("id", record.id)
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          role
        )
      `)
      .single();

    if (error) throw error;

    console.log("✅ Clock-out successful:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ clockOut error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET CLOCKING STATUS
   ✅ Enhanced with full user details
============================================ */
export const getClockingStatus = async (userId) => {
  console.log("🔍 getClockingStatus for user:", userId); // debug log
  
  try {
    const { data, error } = await supabase
      .from("time_records")
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          role
        )
      `)
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (which is ok)
      throw error;
    }

    const isClockedIn = !!data;
    console.log("✅ Clocking status:", isClockedIn ? "Clocked In" : "Clocked Out");
    
    return { 
      success: true,
      isClockedIn, 
      data,
      clockInTime: data?.clock_in || null
    };
  } catch (error) {
    console.error("❌ getClockingStatus error:", error);
    return { 
      success: false,
      isClockedIn: false, 
      data: null, 
      error: { message: error.message } 
    };
  }
};

/* ============================================
   GET TODAY'S CLOCKING RECORDS
   ✅ Enhanced with department filtering and stats
============================================ */
export const getTodayClockingRecords = async (department = null) => {
  console.log("📋 getTodayClockingRecords - department:", department); // debug log
  
  try {
    const today = dayjs().format("YYYY-MM-DD");
    
    let query = supabase
      .from("time_records")
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          role,
          email
        )
      `)
      .eq("date", today)
      .order("clock_in", { ascending: false });

    // ✅ Filter by department if provided
    if (department) {
      // ⚠️ Verify: table or column not found in Supabase schema
      query = query.eq("user.department", department);
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log("✅ Today's records found:", data?.length || 0);
    
    // ✅ Calculate statistics
    const stats = {
      totalRecords: data?.length || 0,
      clockedIn: data?.filter(r => !r.clock_out).length || 0,
      clockedOut: data?.filter(r => r.clock_out).length || 0,
      totalHours: data?.reduce((sum, r) => sum + (parseFloat(r.hours_worked) || 0), 0).toFixed(2) || "0.00"
    };

    return { 
      success: true, 
      data: data || [], 
      stats 
    };
  } catch (error) {
    console.error("❌ getTodayClockingRecords error:", error);
    return { 
      success: false, 
      data: [], 
      stats: { totalRecords: 0, clockedIn: 0, clockedOut: 0, totalHours: "0.00" },
      error: { message: error.message } 
    };
  }
};

/* ============================================
   GET ALL CLOCKING RECORDS
   ✅ NEW: Get all records with pagination
============================================ */
export const getAllClockingRecords = async (limit = 100, offset = 0, filters = {}) => {
  console.log("📋 getAllClockingRecords - limit:", limit, "offset:", offset); // debug log
  
  try {
    let query = supabase
      .from("time_records")
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          role
        )
      `, { count: 'exact' })
      .order("date", { ascending: false })
      .order("clock_in", { ascending: false });

    // ✅ Apply filters
    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }
    if (filters.department) {
      // ⚠️ Verify: table or column not found in Supabase schema
      query = query.eq("user.department", filters.department);
    }
    if (filters.startDate) {
      query = query.gte("date", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("date", filters.endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    console.log("✅ Records fetched:", data?.length || 0, "Total:", count);
    return { success: true, data: data || [], count: count || 0 };
  } catch (error) {
    console.error("❌ getAllClockingRecords error:", error);
    return { success: false, data: [], count: 0, error: { message: error.message } };
  }
};

/* ============================================
   GET USER TIMESHEET
   ✅ Enhanced with summary statistics
============================================ */
export const getUserTimesheet = async (userId, startDate, endDate) => {
  console.log("📊 getUserTimesheet - user:", userId, "period:", startDate, "to", endDate); // debug log
  
  try {
    const { data, error } = await supabase
      .from("time_records")
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          role
        )
      `)
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("clock_in", { ascending: true });

    if (error) throw error;

    console.log("✅ Timesheet records found:", data?.length || 0);

    // ✅ Calculate summary statistics
    const totalRecords = data?.length || 0;
    const totalHours = data?.reduce((sum, r) => sum + (parseFloat(r.hours_worked) || 0), 0) || 0;
    const totalBreakMinutes = data?.reduce((sum, r) => sum + (parseInt(r.break_minutes) || 0), 0) || 0;
    const daysWorked = new Set(data?.map(r => r.date)).size || 0;
    const averageHoursPerDay = daysWorked > 0 ? (totalHours / daysWorked).toFixed(2) : "0.00";

    return { 
      success: true,
      data: data || [], 
      summary: {
        totalRecords,
        totalHours: totalHours.toFixed(2),
        totalBreakMinutes,
        daysWorked,
        averageHoursPerDay,
        startDate,
        endDate
      }
    };
  } catch (error) {
    console.error("❌ getUserTimesheet error:", error);
    return { 
      success: false,
      data: [], 
      summary: {
        totalRecords: 0,
        totalHours: "0.00",
        totalBreakMinutes: 0,
        daysWorked: 0,
        averageHoursPerDay: "0.00"
      },
      error: { message: error.message } 
    };
  }
};

/* ============================================
   UPDATE TIME RECORD
   ✅ NEW: Manually adjust time records (admin only)
============================================ */
export const updateTimeRecord = async (recordId, updates) => {
  console.log("🔄 updateTimeRecord:", recordId, updates); // debug log
  
  try {
    // ✅ Recalculate hours if clock times change
    if (updates.clock_in || updates.clock_out) {
      const { data: existing } = await supabase
        .from("time_records")
        .select("*")
        .eq("id", recordId)
        .single();

      if (existing) {
        const clockIn = new Date(updates.clock_in || existing.clock_in);
        const clockOut = new Date(updates.clock_out || existing.clock_out);
        const breakMinutes = updates.break_minutes !== undefined ? updates.break_minutes : existing.break_minutes;
        
        const totalMinutes = (clockOut - clockIn) / (1000 * 60);
        const workMinutes = totalMinutes - breakMinutes;
        updates.hours_worked = (workMinutes / 60).toFixed(2);
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("time_records")
      .update(updates)
      .eq("id", recordId)
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department
        )
      `)
      .single();

    if (error) throw error;

    console.log("✅ Time record updated:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ updateTimeRecord error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   DELETE TIME RECORD
   ✅ NEW: Remove a time record (admin only)
============================================ */
export const deleteTimeRecord = async (recordId) => {
  console.log("🗑️ deleteTimeRecord:", recordId); // debug log
  
  try {
    const { error } = await supabase
      .from("time_records")
      .delete()
      .eq("id", recordId);

    if (error) throw error;

    console.log("✅ Time record deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ deleteTimeRecord error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET WEEKLY SUMMARY
   ✅ NEW: Get weekly summary for payroll
============================================ */
export const getWeeklySummary = async (userId, startOfWeek) => {
  console.log("📊 getWeeklySummary - user:", userId, "week starting:", startOfWeek); // debug log
  
  try {
    const endOfWeek = dayjs(startOfWeek).add(6, 'days').format('YYYY-MM-DD');
    
    const { data, error } = await supabase
      .from("time_records")
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id(
          user_id,
          first_name,
          last_name,
          department,
          hourly_rate
        )
      `)
      .eq("user_id", userId)
      .gte("date", startOfWeek)
      .lte("date", endOfWeek)
      .order("date", { ascending: true });

    if (error) throw error;

    // ✅ Group by day
    const daysSummary = {};
    let totalWeekHours = 0;

    data?.forEach(record => {
      if (!daysSummary[record.date]) {
        daysSummary[record.date] = {
          date: record.date,
          records: [],
          totalHours: 0
        };
      }
      daysSummary[record.date].records.push(record);
      const hours = parseFloat(record.hours_worked) || 0;
      daysSummary[record.date].totalHours += hours;
      totalWeekHours += hours;
    });

    console.log("✅ Weekly summary calculated:", totalWeekHours.toFixed(2), "hours");

    return {
      success: true,
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      daysSummary,
      totalWeekHours: totalWeekHours.toFixed(2),
      user: data?.[0]?.user || null
    };
  } catch (error) {
    console.error("❌ getWeeklySummary error:", error);
    return { 
      success: false, 
      error: { message: error.message },
      totalWeekHours: "0.00"
    };
  }
};

/* ============================================
   GET DEPARTMENT SUMMARY
   ✅ NEW: Get summary for entire department
============================================ */
export const getDepartmentSummary = async (department, date = null) => {
  console.log("📊 getDepartmentSummary - department:", department, "date:", date); // debug log
  
  try {
    const targetDate = date || dayjs().format("YYYY-MM-DD");
    
    const { data, error } = await supabase
      .from("time_records")
      // ⚠️ Verify: table or column not found in Supabase schema
      .select(`
        *,
        user:user_id!inner(
          user_id,
          first_name,
          last_name,
          department,
          role
        )
      `)
      // ⚠️ Verify: table or column not found in Supabase schema
      .eq("user.department", department)
      .eq("date", targetDate)
      .order("user.last_name", { ascending: true });

    if (error) throw error;

    // ✅ Calculate department statistics
    const stats = {
      totalStaff: new Set(data?.map(r => r.user_id)).size || 0,
      currentlyClockedIn: data?.filter(r => !r.clock_out).length || 0,
      totalHoursToday: data?.reduce((sum, r) => sum + (parseFloat(r.hours_worked) || 0), 0).toFixed(2) || "0.00",
      records: data || []
    };

    console.log("✅ Department summary calculated:", stats);
    return { success: true, data: stats, date: targetDate };
  } catch (error) {
    console.error("❌ getDepartmentSummary error:", error);
    return { 
      success: false, 
      data: { totalStaff: 0, currentlyClockedIn: 0, totalHoursToday: "0.00", records: [] },
      error: { message: error.message } 
    };
  }
};
