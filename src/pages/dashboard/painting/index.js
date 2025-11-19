"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#a00000" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      border: "1px solid #ffe0e0",
      borderRadius: "14px",
      padding: "16px",
      minWidth: 180,
      background: "#fff",
      boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const estimateFinish = (job) => {
  const base = job.workshop_started_at || job.checked_in_at || job.updated_at;
  if (!base) return "TBC";
  return dayjs(base).add(3, "hour").format("HH:mm");
};

export default function PaintingDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bodyshopCount, setBodyshopCount] = useState(0);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const fetchPaintingJobs = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await supabase
          .from("jobs")
          .select(
            "id,job_number,vehicle_reg,status,checked_in_at,workshop_started_at,completed_at,updated_at,type"
          )
          .or("type.ilike.%paint%,job_categories.cs.{bodyshop}")
          .order("checked_in_at", { ascending: true })
          .limit(30);

        const paintJobs = data || [];
        const activeQueue = paintJobs.filter((job) => !job.completed_at).slice(0, 6);

        setBodyshopCount(paintJobs.length);
        setQueue(activeQueue);
      } catch (fetchError) {
        console.error("Failed to load painting dashboard", fetchError);
        setError(fetchError.message || "Unable to load painting jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchPaintingJobs();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #fff7ed, #fff9f1)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffe2c6",
            boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Painting studio
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Bodyshop queue</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Track paint jobs waiting on the bay and pull estimated finish times directly from the job timestamps.
          </p>
        </header>

        <Section title="Bodyshop jobs">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading bodyshop jobs…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <MetricCard label="Bodyshop jobs" value={bodyshopCount} helper="Jobs matching paint or bodyshop" />
          )}
        </Section>

        <Section title="Paint queue" subtitle="Jobs still in progress">
          {queue.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No painting jobs waiting right now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {queue.map((job) => (
                <div
                  key={job.id}
                  style={{
                    border: "1px solid #ffe0e0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ color: "#a00000" }}>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      {job.vehicle_reg || "Plate pending"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "#374151" }}>{job.status || "In progress"}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                      Est. finish {estimateFinish(job)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
