// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/workshop/ControllerClocking.js
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ControllerClocking() {
  const [techs, setTechs] = useState([]);
  const [clocking, setClocking] = useState({});
  const [loading, setLoading] = useState(false);

  // 🔹 Fetch technicians (role = 'Technician')
  const fetchTechs = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        // ⚠️ Verify: table or column not found in Supabase schema
        .select("username")
        .eq("role", "Technician");
      if (error) throw error;
      setTechs(data.map((u) => u.username));
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  };

  // 🔹 Fetch latest clocking status
  const fetchClocking = async () => {
    try {
      const { data, error } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .select("mechanic, in_time, out_time");
      if (error) throw error;

      const status = {};
      data.forEach((entry) => {
        if (!entry.out_time) status[entry.mechanic] = "In";
        else status[entry.mechanic] = "Out";
      });
      setClocking(status);
    } catch (error) {
      console.error("Error fetching clocking data:", error);
    }
  };

  useEffect(() => {
    fetchTechs();
    fetchClocking();

    // 🔹 Real-time subscription for live updates
    const channel = supabase
      .channel("clocking-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clocking" },
        () => fetchClocking()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 🔹 Handle Clock IN
  const clockIn = async (tech) => {
    setLoading(true);
    try {
      // ⚠️ Verify: table or column not found in Supabase schema
      await supabase.from("clocking").insert([
        {
          mechanic: tech,
          in_time: new Date().toISOString(),
          out_time: null,
        },
      ]);
      fetchClocking();
    } catch (error) {
      console.error("Clock In Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Handle Clock OUT (updates latest in_time with null out_time)
  const clockOut = async (tech) => {
    setLoading(true);
    try {
      const { data: lastEntry, error } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .select("id")
        .eq("mechanic", tech)
        .is("out_time", null)
        .order("in_time", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;

      await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .update({ out_time: new Date().toISOString() })
        .eq("id", lastEntry.id);

      fetchClocking();
    } catch (error) {
      console.error("Clock Out Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ color: "var(--primary)", fontSize: "1.8rem", marginBottom: "20px" }}>
        Workshop Controller Dashboard
      </h1>

      {loading && <p style={{ color: "var(--primary-light)" }}>Updating...</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--danger)" }}>
            <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Technician</th>
            <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Status</th>
            <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Clock In</th>
            <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Clock Out</th>
          </tr>
        </thead>
        <tbody>
          {techs.map((tech) => (
            <tr key={tech}>
              <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{tech}</td>
              <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>
                {clocking[tech] || "Not Clocked"}
              </td>
              <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>
                <button
                  onClick={() => clockIn(tech)}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  disabled={clocking[tech] === "In" || loading}
                >
                  IN
                </button>
              </td>
              <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>
                <button
                  onClick={() => clockOut(tech)}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "var(--primary-light)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  disabled={clocking[tech] === "Out" || loading}
                >
                  OUT
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
