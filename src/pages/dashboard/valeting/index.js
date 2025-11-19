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
      minWidth: 160,
      background: "#fff",
      boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const formatTime = (value) => (value ? dayjs(value).format("HH:mm") : "—");

export default function ValetingDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [washedCount, setWashedCount] = useState(0);
  const [delayedCount, setDelayedCount] = useState(0);
  const [waitingQueue, setWaitingQueue] = useState([]);

  useEffect(() => {
    const fetchValeting = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await supabase
          .from("jobs")
          .select(
            "id,job_number,vehicle_reg,status,checked_in_at,wash_started_at,waiting_status,completed_at"
          )
          .order("checked_in_at", { ascending: true })
          .limit(40);

        const jobs = data || [];
        const waiting = jobs.filter((job) => job.checked_in_at && !job.wash_started_at).length;
        const washed = jobs.filter((job) => Boolean(job.wash_started_at)).length;
        const delayed = jobs.filter((job) => (job.waiting_status || "").toLowerCase().includes("delay")).length;
        const queue = jobs
          .filter((job) => job.checked_in_at && !job.wash_started_at)
          .slice(0, 6);

        setWaitingCount(waiting);
        setWashedCount(washed);
        setDelayedCount(delayed);
        setWaitingQueue(queue);
      } catch (fetchError) {
        console.error("Failed to load valeting metrics", fetchError);
        setError(fetchError.message || "Unable to load valeting data");
      } finally {
        setLoading(false);
      }
    };

    fetchValeting();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #f8fafc, #fff)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #dce4eb",
            boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a00000" }}>
            Valeting desk
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Car wash queue</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Monitor the wash bay, track delays, and keep orders flowing.
          </p>
        </header>

        <Section title="Wash bay metrics">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Gathering wash bay metrics…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Cars waiting wash" value={waitingCount} helper="Checked in but not started" />
              <MetricCard label="Cars washed" value={washedCount} helper="Wash started" />
              <MetricCard label="Cars delayed" value={delayedCount} helper="Waiting-status includes delay" />
            </div>
          )}
        </Section>

        <Section title="Waiting for wash" subtitle="Cars checked in and ready">
          {waitingQueue.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No cars currently in the waiting bay.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {waitingQueue.map((job) => (
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
                      {job.vehicle_reg || "Plate TBC"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{formatTime(job.checked_in_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
