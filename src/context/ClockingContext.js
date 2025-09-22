// file location: src/context/ClockingContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "./UserContext";

const ClockingContext = createContext();

export const ClockingProvider = ({ children }) => {
  const { user } = useUser();
  const [clockedIn, setClockedIn] = useState(false);
  const [hoursWorked, setHoursWorked] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch current clocking status
  const fetchClockingStatus = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clocking/getClocking?user=${user.name}`);
      const data = await res.json();
      setClockedIn(data.clockedIn);
      setHoursWorked(data.hoursWorked);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClockingStatus();
  }, [user]);

  const clockIn = async () => {
    if (!user) return;
    await fetch("/api/clocking/clockIn", {
      method: "POST",
      body: JSON.stringify({ user: user.name }),
      headers: { "Content-Type": "application/json" },
    });
    setClockedIn(true);
    fetchClockingStatus();
  };

  const clockOut = async () => {
    if (!user) return;
    await fetch("/api/clocking/clockOut", {
      method: "POST",
      body: JSON.stringify({ user: user.name }),
      headers: { "Content-Type": "application/json" },
    });
    setClockedIn(false);
    fetchClockingStatus();
  };

  return (
    <ClockingContext.Provider
      value={{ clockedIn, hoursWorked, loading, clockIn, clockOut }}
    >
      {children}
    </ClockingContext.Provider>
  );
};

export const useClockingContext = () => useContext(ClockingContext);
