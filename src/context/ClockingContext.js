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
  const { user } = useUser(); // logged-in user
  const [clockedIn, setClockedIn] = useState(false);
  const [hoursWorked, setHoursWorked] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch today's clocking info
  const fetchClockingStatus = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const { data, error } = await supabase
        .from("clocking")
        .select("*")
        .eq("user_id", user.id)
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
    if (user) fetchClockingStatus();
  }, [user]);

  // Clock in
  const clockIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("clocking").insert([
        { user_id: user.id, date: today, clock_in: new Date().toISOString() },
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
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("clocking")
        .select("*")
        .eq("user_id", user.id)
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
      value={{ clockedIn, hoursWorked, loading, clockIn, clockOut, userId: user?.id }}
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
