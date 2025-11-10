// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/pages/workshop/Clocking.js
"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { getAllJobs } from "@/lib/database/jobs";

export default function Clocking() {
  const [techs, setTechs] = useState([]);
  const [statuses, setStatuses] = useState({});

  // ✅ Fetch all technicians and their current job status
  useEffect(() => {
    const fetchTechnicians = async () => {
      // Get all users marked as technicians
      const { data: users, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, role")
        .eq("role", "Technician");

      if (error) {
        console.error("❌ Error fetching technicians:", error);
        return;
      }

      setTechs(users || []);

      // Get all current jobs to find which techs are clocked in
      const jobs = await getAllJobs();

      const techStatuses = {};
      users.forEach((tech) => {
        const assignedJob = jobs.find(
          (j) => j.technician && j.technician.includes(tech.first_name)
        );
        techStatuses[tech.id] = assignedJob
          ? `Working on ${assignedJob.jobNumber}`
          : "Not Clocked In";
      });

      setStatuses(techStatuses);
    };

    fetchTechnicians();

    // ✅ Realtime updates for clocking events
    const channel = supabase
      .channel("job-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        fetchTechnicians();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ✅ Placeholder actions for managers
  const managerFeatures = [
    "Add Job",
    "Approve Parts",
    "Send Alert",
    "Generate Report",
    "Assign Tasks",
    "View Stats",
  ];

  return (
    <Layout>
      <div style={{ padding: "20px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "20px" }}>
          Workshop Clocking
        </h1>

        <h2 style={{ marginBottom: "10px" }}>Mechanic Status</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          {techs.map((tech) => (
            <div
              key={tech.id}
              style={{
                backgroundColor: "#FFF0F0",
                border: "1px solid #FFCCCC",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "center",
                fontWeight: "500",
                color: "#FF4040",
              }}
            >
              <div>
                {tech.first_name} {tech.last_name}
              </div>
              <div style={{ marginTop: "10px", color: "#FF8080" }}>
                Status: {statuses[tech.id] || "Loading..."}
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ marginBottom: "10px" }}>Manager Actions</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
          }}
        >
          {managerFeatures.map((feat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#FFF8F8",
                border: "1px solid #FFCCCC",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "center",
                fontWeight: "500",
                color: "#FF4040",
              }}
            >
              {feat}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}