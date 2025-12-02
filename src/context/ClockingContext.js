// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/context/ClockingContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient"; // Supabase client

// Create context
const ClockingContext = createContext();

// Provider
export const ClockingProvider = ({ children }) => {
  const { user, dbUserId } = useUser(); // logged-in user + real users.user_id
  const [clockedIn, setClockedIn] = useState(false);
  const [hoursWorked, setHoursWorked] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch today's clocking info
  const fetchClockingStatus = async () => {
    if (!dbUserId) {
      setClockedIn(false);
      setHoursWorked(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const { data, error } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .select("*")
        .eq("user_id", dbUserId)
        .eq("date", today)
        .order("clock_in", { ascending: true });

      if (error) throw error;

      if (data?.length > 0) {
        const lastRecord = data[data.length - 1];
        setClockedIn(!lastRecord.clock_out); // clocked in if no clock_out

        // calculate hours worked
        let total = 0;
        data.forEach((record) => {
          if (record.clock_in && record.clock_out) {
            total += (new Date(record.clock_out) - new Date(record.clock_in)) / 3600000;
          }
        });
        setHoursWorked(Number(total.toFixed(2)));
      } else {
        setClockedIn(false);
        setHoursWorked(0);
      }
    } catch (err) {
      console.error("Error fetching clocking status:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dbUserId) {
      fetchClockingStatus();
    }
  }, [dbUserId]);

  // Clock in
  const clockIn = async () => {
    if (!dbUserId) {
      console.warn("Clock in attempted without resolved users.user_id");
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      // ⚠️ Verify: table or column not found in Supabase schema
      const { error } = await supabase.from("clocking").insert([
        { user_id: dbUserId, date: today, clock_in: new Date().toISOString() },
      ]);
      if (error) throw error;
      setClockedIn(true);
      await fetchClockingStatus();
    } catch (err) {
      console.error("Clock In Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Clock out
  const clockOut = async () => {
    if (!dbUserId) {
      console.warn("Clock out attempted without resolved users.user_id");
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .select("*")
        .eq("user_id", dbUserId)
        .eq("date", today)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (!data) {
        console.warn("No active clock-in record found.");
        setLoading(false);
        return;
      }

      await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", data.id);

      setClockedIn(false);
      await fetchClockingStatus();
    } catch (err) {
      console.error("Clock Out Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClockingContext.Provider
      value={{ clockedIn, hoursWorked, loading, clockIn, clockOut, userId: dbUserId }}
    >
      {children}
    </ClockingContext.Provider>
  );
};

// Hook to use the context safely
export const useClockingContext = () => {
  const context = useContext(ClockingContext);
  if (!context) {
    throw new Error("useClockingContext must be used within a ClockingProvider");
  }
  return context;
};
