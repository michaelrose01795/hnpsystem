"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const ALLOWED_ROLES = ["after sales manager", "after sales director", "aftersales manager"];

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
      <h2 style={{ margin: 0, color: "#a00000", fontSize: "1.2rem" }}>{title}</h2>
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
      boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

export const useCombinedPerformanceMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [vhcCompleted, setVhcCompleted] = useState(0);
  const [followUps, setFollowUps] = useState([]);
  const [pendingParts, setPendingParts] = useState(0);
  const [pendingVhc, setPendingVhc] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      const weekStart = dayjs().startOf("week").toISOString();
      const weekEnd = dayjs().endOf("week").toISOString();

      try {
        const [completedJobs, completedVhc, followUpData, partsRequests, vhcPending] = await Promise.all([
          supabase
            .from("jobs")
            .select("id")
            .gte("completed_at", weekStart)
            .lt("completed_at", weekEnd),
          supabase
            .from("jobs")
            .select("id")
            .eq("vhc_required", true)
            .gte("vhc_completed_at", weekStart)
            .lt("vhc_completed_at", weekEnd),
          supabase
            .from("job_customer_statuses")
            .select("id,status,job_id,job:job_id(job_number,vehicle_reg)")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase.from("parts_requests").select("request_id").eq("status", "pending"),
          supabase
            .from("jobs")
            .select("id,job_number,vehicle_reg,checked_in_at,vhc_authorizations(id)")
            .eq("vhc_required", true)
            .is("vhc_completed_at", null)
            .limit(6),
        ]);

        const filteredFollowUps = (followUpData || []).filter((row) => {
          const normalized = (row.status || "").toLowerCase();
          return normalized.includes("follow") || normalized.includes("call");
        });

        const waitingVhcJobs = (vhcPending || []).filter(
          (job) => !Array.isArray(job.vhc_authorizations) || job.vhc_authorizations.length === 0
        );

        setJobsCompleted(completedJobs?.length || 0);
        setVhcCompleted(completedVhc?.length || 0);
        setFollowUps(filteredFollowUps);
        setPendingParts(partsRequests?.length || 0);
        setPendingVhc(waitingVhcJobs.length);
      } catch (fetchError) {
        console.error("Failed to load after sales metrics", fetchError);
        setError(fetchError.message || "Unable to load after sales metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return { loading, error, jobsCompleted, vhcCompleted, followUps, pendingParts, pendingVhc };
};

export const CombinedPerformanceView = ({
  loading,
  error,
  jobsCompleted,
  vhcCompleted,
  followUps,
  pendingParts,
  pendingVhc,
  title = "After Sales performance",
  heading = "Combined workshop + VHC view",
  description = "Keep the customer journey humming — view job completion, VHC throughput, and outstanding follow-ups.",
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "24px" }}>
    <header
      style={{
        background: "linear-gradient(120deg, #f8fafc, #fff5f5)",
        borderRadius: "18px",
        padding: "24px",
        border: "1px solid #ffd6d6",
        boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
      }}
    >
      <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>{title}</p>
      <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>{heading}</h1>
      <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{description}</p>
    </header>

    <Section title="Combined performance">
      {loading ? (
        <p style={{ color: "#6b7280" }}>Gathering completion statistics…</p>
      ) : error ? (
        <p style={{ color: "#ff4040" }}>{error}</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          <MetricCard label="Jobs completed" value={jobsCompleted} helper="This week" />
          <MetricCard label="VHCs completed" value={vhcCompleted} helper="This week" />
        </div>
      )}
    </Section>

    <Section title="Follow-up calls needed" subtitle="Statuses containing follow or call">
      {followUps.length === 0 ? (
        <p style={{ margin: 0, color: "#6b7280" }}>No follow-ups logged in the last few entries.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {followUps.map((entry) => (
            <div
              key={entry.id}
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
                <strong style={{ color: "#a00000" }}>{entry.job?.job_number || "Job"}</strong>
                <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>{entry.status}</p>
              </div>
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                {entry.job?.vehicle_reg || "Vehicle pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>

    <Section title="Approvals needed" subtitle="Parts and VHC sign-offs awaiting action">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
        <MetricCard label="Parts approvals" value={pendingParts} helper="Pending requests" />
        <MetricCard label="VHC sign-off" value={pendingVhc} helper="Awaiting auth" />
      </div>
    </Section>
  </div>
);

export default function AfterSalesDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = ALLOWED_ROLES.some((role) => userRoles.includes(role));

  const metrics = useCombinedPerformanceMetrics();

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the after sales dashboard.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <CombinedPerformanceView {...metrics} />
    </Layout>
  );
}
