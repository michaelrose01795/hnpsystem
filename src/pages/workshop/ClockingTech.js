// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/pages/workshop/ClockingTech.js
"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

export default function ClockingTech() {
  const { user } = useUser();
  const [clockingData, setClockingData] = useState([]);
  const [loading, setLoading] = useState(false);

  const mechanic = user?.username || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Unknown";

  // ✅ Fetch today's clocking records for this technician
  useEffect(() => {
    const fetchClocking = async () => {
      if (!mechanic) return;
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .select("*")
        .eq("mechanic", mechanic)
        .gte("in", `${today}T00:00:00`)
        .lte("in", `${today}T23:59:59`)
        .order("in", { ascending: false });

      if (error) {
        console.error("❌ Error fetching clocking data:", error);
        return;
      }

      setClockingData(data || []);
    };

    fetchClocking();

    // ✅ Real-time listener for changes
    const channel = supabase
      .channel("clocking-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "clocking" }, () => {
        fetchClocking();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mechanic]);

  // ✅ Check if currently clocked in
  const isClockedIn = () => {
    const latest = clockingData[0];
    return latest && !latest.out;
  };

  // ✅ Clock IN function
  const clockIn = async () => {
    setLoading(true);
    try {
      // ⚠️ Verify: table or column not found in Supabase schema
      const { error } = await supabase.from("clocking").insert([
        {
          mechanic,
          in: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    } catch (err) {
      console.error("❌ Error clocking in:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Clock OUT function
  const clockOut = async () => {
    setLoading(true);
    try {
      const latest = clockingData.find((e) => !e.out);
      if (!latest) return;

      const { error } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("clocking")
        .update({ out: new Date().toISOString() })
        .eq("id", latest.id);
      if (error) throw error;
    } catch (err) {
      console.error("❌ Error clocking out:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Toggle button
  const handleToggle = () => {
    if (isClockedIn()) {
      clockOut();
    } else {
      clockIn();
    }
  };

  return (
    <Layout>
      <div style={{ padding: "20px" }}>
        <h1 style={{ color: "var(--primary)", marginBottom: "20px" }}>My Clocking</h1>

        <button
          onClick={handleToggle}
          disabled={loading}
          style={{
            padding: "12px 20px",
            fontSize: "1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            backgroundColor: isClockedIn() ? "var(--primary-light)" : "var(--primary)",
            color: "white",
            marginBottom: "20px",
          }}
        >
          {loading
            ? "Please wait..."
            : isClockedIn()
            ? "Clock OUT"
            : "Clock IN"}
        </button>

        <h2>Today’s Entries</h2>
        <ul>
          {clockingData.length === 0 && <li>No clocking entries yet today.</li>}
          {clockingData.map((entry) => (
            <li key={entry.id}>
              Clock IN:{" "}
              {new Date(entry.in).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              {entry.out && (
                <>
                  {" | "}Clock OUT:{" "}
                  {new Date(entry.out).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
