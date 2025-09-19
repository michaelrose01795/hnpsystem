"use client";
import { useState } from "react";

export default function TechnicianClock({ jobId, technicianName }) {
  const [clockedIn, setClockedIn] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  const handleClockIn = () => {
    const now = new Date();
    setStartTime(now);
    setClockedIn(true);
  };

  const handleClockOut = () => {
    const now = new Date();
    setEndTime(now);
    setClockedIn(false);
    alert(`Technician ${technicianName} clocked ${((now - startTime)/60000).toFixed(2)} minutes for job ${jobId}`);
    // TODO: Send clocking data to backend
  };

  return (
    <div className="p-3 border rounded bg-white shadow-md mb-3">
      <h4 className="font-semibold mb-2">{technicianName} - Job {jobId}</h4>
      {!clockedIn ? (
        <button
          onClick={handleClockIn}
          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
        >
          Clock In
        </button>
      ) : (
        <button
          onClick={handleClockOut}
          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
        >
          Clock Out
        </button>
      )}
      {startTime && <p className="mt-1 text-sm">Start Time: {startTime.toLocaleTimeString()}</p>}
      {endTime && <p className="mt-1 text-sm">End Time: {endTime.toLocaleTimeString()}</p>}
    </div>
  );
}