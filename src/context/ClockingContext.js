// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/context/ClockingContext.js
// Uses /api/profile/clock API which handles auto-closing stale records server-side
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/UserContext";

// Create context
const ClockingContext = createContext();

// Provider
export const ClockingProvider = ({ children }) => {
  const { user, dbUserId } = useUser(); // logged-in user + real users.user_id
  const [clockedIn, setClockedIn] = useState(false);
  const [hoursWorked, setHoursWorked] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch clocking status via the server API (handles auto-close of stale records)
  const fetchClockingStatus = useCallback(async () => {
    if (!dbUserId) {
      setClockedIn(false);
      setHoursWorked(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/clock?userId=${dbUserId}`);
      const json = await res.json();

      if (json.success && json.data) {
        setClockedIn(json.data.isClockedIn);
        // If clocked in, calculate hours from clock-in time to now
        if (json.data.isClockedIn && json.data.activeRecord?.clockIn) {
          const clockInTime = new Date(json.data.activeRecord.clockIn);
          const now = new Date();
          const hours = (now - clockInTime) / 3600000;
          setHoursWorked(Number(hours.toFixed(2)));
        } else {
          setHoursWorked(0);
        }
      } else {
        setClockedIn(false);
        setHoursWorked(0);
      }
    } catch (err) {
      console.error("Error fetching clocking status:", err.message);
    } finally {
      setLoading(false);
    }
  }, [dbUserId]);

  useEffect(() => {
    if (dbUserId) {
      fetchClockingStatus();
    }
  }, [dbUserId, fetchClockingStatus]);

  // Clock in via the server API (auto-closes stale records if needed)
  const clockIn = async () => {
    if (!dbUserId) {
      console.warn("Clock in attempted without resolved users.user_id");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/clock?userId=${dbUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clock-in", userId: dbUserId }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error("Clock In Error:", json.message);
      } else {
        setClockedIn(true);
      }
      await fetchClockingStatus();
    } catch (err) {
      console.error("Clock In Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Clock out via the server API
  const clockOut = async () => {
    if (!dbUserId) {
      console.warn("Clock out attempted without resolved users.user_id");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/clock?userId=${dbUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clock-out", userId: dbUserId }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error("Clock Out Error:", json.message);
      } else {
        setClockedIn(false);
      }
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
