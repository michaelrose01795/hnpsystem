"use client";
import { useState } from "react";
import JobAssignmentForm from "@/components/Workshop/JobAssignmentForm";

export default function AssignmentsPage() {
  const [jobs] = useState([
    { id: "1", jobId: "JOB001", customer: "John Smith" },
    { id: "2", jobId: "JOB002", customer: "Alice Johnson" },
  ]);

  const [technicians] = useState(["Alice", "Bob", "Charlie"]);

  const handleAssign = (jobId, tech) => {
    console.log(`Assigned job ${jobId} to technician ${tech}`);
    // TODO: save assignment to backend
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Job Assignments</h1>
      <JobAssignmentForm jobs={jobs} technicians={technicians} onAssign={handleAssign} />
    </div>
  );
}