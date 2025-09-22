// file location: src/hooks/useClocking.js
// Hook for handling clock in/out logic for mechanics

import { useState, useEffect } from "react";

// Mock storage, replace with API calls later
const STORAGE_KEY = "mechanicClocking";

export default function useClocking() {
  const [clockingData, setClockingData] = useState([]);

  // Load clocking data from localStorage or API
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setClockingData(JSON.parse(stored));
  }, []);

  // Save clocking data to localStorage or API
  const saveData = (data) => {
    setClockingData(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  // Clock IN mechanic
  const clockIn = (mechanic) => {
    const now = new Date();
    const updated = [...clockingData, { mechanic, in: now.toISOString(), out: null }];
    saveData(updated);
  };

  // Clock OUT mechanic
  const clockOut = (mechanic) => {
    const now = new Date();
    const updated = clockingData.map((entry) =>
      entry.mechanic === mechanic && !entry.out ? { ...entry, out: now.toISOString() } : entry
    );
    saveData(updated);
  };

  // Check if mechanic is currently clocked in
  const isClockedIn = (mechanic) => {
    const entry = clockingData.find((e) => e.mechanic === mechanic && !e.out);
    return !!entry;
  };

  return { clockingData, clockIn, clockOut, isClockedIn };
}
