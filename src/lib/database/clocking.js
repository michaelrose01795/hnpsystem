// ✅ File location: src/lib/database/clocking.js
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";

/* ============================================
   CLOCK IN
============================================ */
export const clockIn = async (userId) => {
  try {
    // Check if already clocked in
    const { data: existing } = await supabase
      .from("time_records")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();

    if (existing) {
      return { 
        success: false, 
        error: { message: "Already clocked in" } 
      };
    }

    const { data, error } = await supabase
      .from("time_records")
      .insert([{
        user_id: userId,
        clock_in: new Date().toISOString(),
        date: dayjs().format("YYYY-MM-DD")
      }])
      .select()
      .single();

    return { success: !error, data, error };
  } catch (error) {
    return { success: false, error };
  }
};

/* ============================================
   CLOCK OUT
============================================ */
export const clockOut = async (userId) => {
  try {
    // Find active clock-in record
    const { data: record } = await supabase
      .from("time_records")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();

    if (!record) {
      return { 
        success: false, 
        error: { message: "No active clock-in found" } 
      };
    }

    const clockOutTime = new Date().toISOString();
    const clockInTime = new Date(record.clock_in);
    const hoursWorked = (new Date(clockOutTime) - clockInTime) / (1000 * 60 * 60);

    const { data, error } = await supabase
      .from("time_records")
      .update({ 
        clock_out: clockOutTime,
        hours_worked: hoursWorked.toFixed(2)
      })
      .eq("id", record.id)
      .select()
      .single();

    return { success: !error, data, error };
  } catch (error) {
    return { success: false, error };
  }
};

/* ============================================
   GET CLOCKING STATUS
============================================ */
export const getClockingStatus = async (userId) => {
  const { data, error } = await supabase
    .from("time_records")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out", null)
    .maybeSingle();

  return { isClockedIn: !!data, data, error };
};

/* ============================================
   GET TODAY'S CLOCKING RECORDS
============================================ */
export const getTodayClockingRecords = async () => {
  const today = dayjs().format("YYYY-MM-DD");
  
  const { data, error } = await supabase
    .from("time_records")
    .select(`
      *,
      user:user_id(
        user_id,
        first_name,
        last_name,
        department
      )
    `)
    .eq("date", today)
    .order("clock_in", { ascending: false });

  return error ? [] : data;
};

/* ============================================
   GET USER TIMESHEET
============================================ */
export const getUserTimesheet = async (userId, startDate, endDate) => {
  const { data, error } = await supabase
    .from("time_records")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  return error ? [] : data;
};