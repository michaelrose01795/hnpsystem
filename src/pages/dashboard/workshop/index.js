"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "16px",
      padding: "16px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 10px 24px rgba(0,0,0,0.04)",
      minWidth: 160,
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 16px 30px rgba(209,0,0,0.08)",
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

const formatTime = (value) => (value ? dayjs(value).format("HH:mm") : "—");

export default function WorkshopDashboard() {
  const todayLabel = dayjs().format("dddd D MMMM");
  const { user } = useUser();
  const [metrics, setMetrics] = useState({
    inProgressCount: 0,
    checkedInToday: 0,
    completedToday: 0,
    totalTechnicians: 0,
    techniciansOnJobs: 0,
    queue: [],
    outstandingVhc: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const runQuery = async (fetcher) => {
      const { data, error: queryError } = await fetcher();
      if (queryError) {
        throw queryError;
      }
      return data || [];
    };

    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      const todayStart = dayjs().startOf("day").toISOString();
      const todayEnd = dayjs().endOf("day").toISOString();

      try {
        const [
          inProgressJobs,
          checkedInTodayJobs,
          completedTodayJobs,
          technicianUsers,
          clockedInEntries,
          queueJobs,
          outstandingVhc,
        ] = await Promise.all([
          runQuery(() =>
            supabase
              .from("jobs")
              .select("job_number,vehicle_reg,status,checked_in_at")
              .is("completed_at", null)
              .not("checked_in_at", "is", null)
          ),
          runQuery(() =>
            supabase
              .from("jobs")
              .select("id")
              .gte("checked_in_at", todayStart)
              .lt("checked_in_at", todayEnd)
          ),
          runQuery(() =>
            supabase
              .from("jobs")
              .select("id")
              .gte("completed_at", todayStart)
              .lt("completed_at", todayEnd)
          ),
          runQuery(() => supabase.from("users").select("user_id,first_name,last_name,role").ilike("role", "%tech%")),
          runQuery(() => supabase.from("job_clocking").select("user_id").is("clock_out", null)),
          runQuery(() =>
            supabase
              .from("jobs")
              .select("id,job_number,vehicle_reg,status,waiting_status,checked_in_at")
              .is("completed_at", null)
              .order("checked_in_at", { ascending: true, nullsFirst: true })
              .limit(6)
          ),
          runQuery(() =>
            supabase
              .from("jobs")
              .select("id,job_number,vehicle_reg,waiting_status,vhc_required,checked_in_at")
              .eq("vhc_required", true)
              .is("vhc_completed_at", null)
              .order("checked_in_at", { ascending: true, nullsFirst: true })
              .limit(5)
          ),
        ]);

        setMetrics({
          inProgressCount: inProgressJobs.length,
          checkedInToday: checkedInTodayJobs.length,
          completedToday: completedTodayJobs.length,
          totalTechnicians: technicianUsers.length,
          techniciansOnJobs: clockedInEntries.length,
          queue: queueJobs,
          outstandingVhc,
        });
      } catch (fetchError) {
        console.error("Failed to load workshop metrics", fetchError);
        setError(fetchError.message || "Unable to load metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const availableTechnicians = useMemo(
    () => Math.max(metrics.totalTechnicians - metrics.techniciansOnJobs, 0),
    [metrics.totalTechnicians, metrics.techniciansOnJobs]
  );

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #ffeaea, #fff5f5)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffd6d6",
            boxShadow: "0 18px 35px rgba(209,0,0,0.1)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Workshop workspace · {todayLabel}
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>
            {user?.username ? `Hi ${user.username}, workshop view` : "Workshop workspace"}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Live view of technician assignments, queue, and VHC throughput.
          </p>
        </header>

        <Section title="Daily checkpoints">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading today&apos;s workshop metrics…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Jobs in progress" value={metrics.inProgressCount} helper="Vehicles currently on bay" />
              <MetricCard label="Checked in today" value={metrics.checkedInToday} helper="Arrivals since midnight" />
              <MetricCard label="Jobs completed" value={metrics.completedToday} helper="Finished today" />
              <MetricCard
                label="Technician availability"
                value={`${availableTechnicians} / ${metrics.totalTechnicians}`}
                helper={`${metrics.techniciansOnJobs} techs on jobs`}
              />
            </div>
          )}
        </Section>

        <Section title="Next jobs queue" subtitle="Assigned jobs with no completion timestamp">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading queue…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {metrics.queue.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>No outstanding jobs in the queue.</p>
              ) : (
                metrics.queue.map((job) => (
                  <div
                    key={job.job_number}
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: "#fef6f6",
                      border: "1px solid #ffe0e0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#a00000" }}>
                        {job.job_number || "—"} · {job.vehicle_reg || "TBC"}
                      </strong>
                      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        {job.status || "Status unknown"}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                      Checked in {formatTime(job.checked_in_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </Section>

        <Section title="Outstanding VHCs" subtitle="Jobs requiring further inspection">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Pulling VHC backlog…</p>
          ) : metrics.outstandingVhc.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No VHCs awaiting completion.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {metrics.outstandingVhc.map((job) => (
                <div
                  key={job.job_number}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "#fff",
                    borderRadius: "10px",
                    border: "1px solid #ffe0e0",
                    padding: "12px 14px",
                  }}
                >
                  <div>
                    <strong>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      {job.vehicle_reg || "Registration missing"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    Checked in {formatTime(job.checked_in_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
