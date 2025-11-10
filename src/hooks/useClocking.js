// ✅ Imports converted to use absolute alias "@/"
// file location: src/hooks/useClocking.js
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient"; // make sure you have Supabase client setup
import { useClockingContext } from "@/context/ClockingContext";

export const useClocking = () => {
  const { userId } = useClockingContext(); // assumes you store logged-in user ID in context
  const [clockedIn, setClockedIn] = useState(false); // is user clocked in
  const [hoursWorked, setHoursWorked] = useState(0); // total hours today
  const [loading, setLoading] = useState(true);

  // fetch today's clocking status and hours
  const fetchClocking = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const { data, error } = await supabase
        .from("clocking") // your DB table
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .order("clock_in", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const lastRecord = data[data.length - 1];
        setClockedIn(!lastRecord.clock_out); // if clock_out is null, user is clocked in

        // calculate total hours worked today
        let total = 0;
        data.forEach((record) => {
          if (record.clock_in && record.clock_out) {
            total += (new Date(record.clock_out) - new Date(record.clock_in)) / 3600000; // hours
          }
        });
        setHoursWorked(total.toFixed(2));
      } else {
        setClockedIn(false);
        setHoursWorked(0);
      }
    } catch (err) {
      console.error("Error fetching clocking:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchClocking();
  }, [userId]);

  // clock in function
  const clockIn = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("clocking").insert([
        { user_id: userId, date: today, clock_in: new Date().toISOString() },
      ]);
      if (error) throw error;
      setClockedIn(true);
      fetchClocking(); // refresh hoursWorked
    } catch (err) {
      console.error("Clock In Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // clock out function
  const clockOut = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      // find latest clock-in without clock-out
      const { data, error } = await supabase
        .from("clocking")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      await supabase
        .from("clocking")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", data.id);

      setClockedIn(false);
      fetchClocking(); // refresh hoursWorked
    } catch (err) {
      console.error("Clock Out Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return { clockedIn, hoursWorked, loading, clockIn, clockOut };
};