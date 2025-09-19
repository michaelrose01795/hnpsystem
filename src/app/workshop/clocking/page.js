"use client";
import { useState } from "react";
import TechnicianClock from "@/components/Workshop/TechnicianClock";

export default function ClockingPage() {
  const [assignments, setAssignments] = useState([
    { jobId: "JOB001", technician: "Alice" },
    { jobId: "JOB002", technician: "Bob" },
    { jobId: "JOB003", technician: "Charlie" },
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Technician Clocking & Assignments</h1>

      {assignments.map((a) => (
        <TechnicianClock
          key={a.jobId}
          jobId={a.jobId}
          technicianName={a.technician}
        />
      ))}
    </div>
  );
}