"use client";

import React, { useEffect, useMemo, useState } from "react";
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
      boxShadow: "0 16px 30px rgba(0,0,0,0.05)",
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
      borderRadius: "16px",
      padding: "18px",
      background: "#fff",
      minWidth: 160,
      boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.75rem", color: "#a00000" }}>
      {label}
    </p>
    <p style={{ margin: "8px 0 0", fontSize: "1.8rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const StatusBadge = ({ label, count }) => (
  <div
    style={{
      padding: "10px 14px",
      borderRadius: "12px",
      border: "1px solid #fde6e6",
      display: "flex",
      justifyContent: "space-between",
      background: "#fff",
    }}
  >
    <p style={{ margin: 0, color: "#374151" }}>{label}</p>
    <strong style={{ color: "#a00000" }}>{count}</strong>
  </div>
);

export default function ServiceDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appointmentsToday, setAppointmentsToday] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [upcomingJobs, setUpcomingJobs] = useState([]);
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [awaitingVhc, setAwaitingVhc] = useState([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      const todayStart = dayjs().startOf("day").toISOString();
      const todayEnd = dayjs().endOf("day").toISOString();

      try {
        const [appointmentsData, statusData, jobsUpcoming, vhcCandidates] = await Promise.all([
          supabase
            .from("appointments")
            .select("appointment_id")
            .gte("scheduled_time", todayStart)
            .lt("scheduled_time", todayEnd),
          supabase.from("job_customer_statuses").select("status,job_id").order("created_at", { ascending: false }),
          supabase
            .from("jobs")
            .select("id,job_number,vehicle_reg,status,checked_in_at,created_at")
            .not("status", "in", ["Completed", "Complete", "Cancelled", "Collected"])
            .order("created_at", { ascending: true })
            .limit(6),
          supabase
            .from("jobs")
            .select("id,job_number,vehicle_reg,checked_in_at,vhc_authorizations(id)")
            .eq("vhc_required", true)
            .is("vhc_completed_at", null)
            .limit(5),
        ]);

        const counts = (statusData || []).reduce((acc, row) => {
          const statusLabel = row.status ? row.status.trim() : "Unknown";
          acc[statusLabel] = (acc[statusLabel] || 0) + 1;
          return acc;
        }, {});

        const sortedStatuses = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([key, count]) => ({ status: key, count }));

        const awaiting = (vhcCandidates || []).filter(
          (job) => !Array.isArray(job.vhc_authorizations) || job.vhc_authorizations.length === 0
        );

        setAppointmentsToday(appointmentsData?.length || 0);
        setStatusCounts(counts);
        setCustomerStatuses(sortedStatuses);
        setUpcomingJobs(jobsUpcoming || []);
        setAwaitingVhc(awaiting);
      } catch (fetchError) {
        console.error("Failed to load service metrics", fetchError);
        setError(fetchError.message || "Unable to load service metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const keywordCount = (keyword) =>
    Object.entries(statusCounts).reduce((total, [status, value]) => {
      if (status.toLowerCase().includes(keyword.toLowerCase())) {
        return total + value;
      }
      return total;
    }, 0);

  const waitingCount = keywordCount("waiting");
  const loanCarCount = keywordCount("loan");
  const collectionCount = keywordCount("collection");

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "#fff5f5",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffd6d6",
            boxShadow: "0 16px 30px rgba(0,0,0,0.08)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Service dashboard
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Advisor cockpit</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Appointment throughput, customer status, and VHC approvals all in one pane.
          </p>
        </header>

        <Section title="Appointments today">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Counting today&apos;s arrivals…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <MetricCard
              label="Appointments today"
              value={appointmentsToday}
              helper="Scheduled slots between 00:00 and midnight"
            />
          )}
        </Section>

        <Section title="Customer waiting mix" subtitle="Loan vehicles, queues, and collections">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
            <StatusBadge label="Waiting" count={waitingCount} />
            <StatusBadge label="Loan car" count={loanCarCount} />
            <StatusBadge label="Collection" count={collectionCount} />
          </div>
        </Section>

        <Section title="Upcoming jobs" subtitle="Bookings still pending or checked in">
          {loading ? (
            <p style={{ margin: 0, color: "#6b7280" }}>Loading jobs…</p>
          ) : upcomingJobs.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No upcoming jobs found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {upcomingJobs.map((job) => (
                <div
                  key={job.id || job.job_number}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid #ffe0e0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: "#fff",
                  }}
                >
                  <div>
                    <strong style={{ color: "#a00000" }}>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      {job.vehicle_reg || "Plate missing"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#374151" }}>{job.status || "Status unknown"}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Customer statuses">
          {customerStatuses.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No alternative customer statuses recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              {customerStatuses.map((row) => (
                <StatusBadge key={row.status} label={row.status} count={row.count} />
              ))}
            </div>
          )}
        </Section>

        <Section title="VHCs awaiting approval">
          {awaitingVhc.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No pending authorizations.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {awaitingVhc.map((job) => (
                <div
                  key={job.id || job.job_number}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    border: "1px solid #ffe0e0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    background: "#fff",
                  }}
                >
                  <div>
                    <strong>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      {job.vehicle_reg || "Registration pending"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    Checked in {job.checked_in_at ? dayjs(job.checked_in_at).format("HH:mm") : "—"}
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
