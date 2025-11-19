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
      border: "1px solid #fdecec",
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

export default function MotDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testsToday, setTestsToday] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [retestCount, setRetestCount] = useState(0);
  const [recentTests, setRecentTests] = useState([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      const todayStart = dayjs().startOf("day").toISOString();
      const todayEnd = dayjs().endOf("day").toISOString();

      try {
        const [testsTodayRes, passRes, failRes, retestRes, recentData] = await Promise.all([
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "MOT")
            .gte("checked_in_at", todayStart)
            .lt("checked_in_at", todayEnd),
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "MOT")
            .ilike("completion_status", "%pass%"),
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "MOT")
            .ilike("completion_status", "%fail%"),
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "MOT")
            .ilike("completion_status", "%retest%"),
          supabase
            .from("jobs")
            .select("id,job_number,vehicle_reg,completion_status,checked_in_at")
            .eq("type", "MOT")
            .order("checked_in_at", { ascending: false })
            .limit(6),
        ]);

        setTestsToday(testsTodayRes.count || 0);
        setPassCount(passRes.count || 0);
        setFailCount(failRes.count || 0);
        setRetestCount(retestRes.count || 0);
        setRecentTests(recentData || []);
      } catch (fetchError) {
        console.error("Failed to load MOT metrics", fetchError);
        setError(fetchError.message || "Unable to load MOT data");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #ffecee, #fff5f5)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffd6d6",
            boxShadow: "0 18px 30px rgba(209,0,0,0.08)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a00000" }}>
            MOT workspace
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Today's test board</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Track pass/fail rates, retest volumes, and the queue for testers.
          </p>
        </header>

        <Section title="Daily MOT tally">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading daily totals…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Tests today" value={testsToday} helper="Checked in today" />
              <MetricCard label="Passed" value={passCount} helper="Completion status includes pass" />
              <MetricCard label="Failed" value={failCount} helper="Status includes fail" />
              <MetricCard label="Retests" value={retestCount} helper="Requires follow-up" />
            </div>
          )}
        </Section>

        <Section title="Recent MOT jobs" subtitle="Latest registered MOT jobs">
          {recentTests.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No MOT jobs in the dataset yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentTests.map((job) => (
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
                      {job.vehicle_reg || "No plate"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "#374151" }}>{job.completion_status || "Pending"}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                      {formatTime(job.checked_in_at)}
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
