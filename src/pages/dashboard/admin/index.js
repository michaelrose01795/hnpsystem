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

const formatDate = (value) => (value ? dayjs(value).format("D MMM") : "—");

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalJobs, setTotalJobs] = useState(0);
  const [appointmentsToday, setAppointmentsToday] = useState(0);
  const [partsRequests, setPartsRequests] = useState(0);
  const [newUsers, setNewUsers] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    const fetchAdminMetrics = async () => {
      setLoading(true);
      setError(null);
      const todayStart = dayjs().startOf("day").toISOString();
      const todayEnd = dayjs().endOf("day").toISOString();
      const weekStart = dayjs().subtract(7, "day").startOf("day").toISOString();

      try {
        const [jobsRes, appointmentsRes, partsRes, usersRes, holidaysRes, noticesRes] = await Promise.all([
          supabase.from("jobs").select("id", { count: "exact", head: true }),
          supabase
            .from("appointments")
            .select("appointment_id", { count: "exact", head: true })
            .gte("scheduled_time", todayStart)
            .lt("scheduled_time", todayEnd),
          supabase.from("parts_requests").select("request_id", { count: "exact", head: true }),
          supabase
            .from("users")
            .select("user_id", { count: "exact", head: true })
            .gte("created_at", weekStart)
            .lte("created_at", todayEnd),
          supabase
            .from("hr_absences")
            .select("absence_id,user_id,type,start_date,end_date")
            .eq("type", "Holiday")
            .gte("start_date", dayjs().startOf("day").toISOString())
            .lte("start_date", dayjs().add(7, "day").endOf("day").toISOString())
            .order("start_date", { ascending: true })
            .limit(6),
          supabase
            .from("notifications")
            .select("notification_id,message,target_role,created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        setTotalJobs(jobsRes.count || 0);
        setAppointmentsToday(appointmentsRes.count || 0);
        setPartsRequests(partsRes.count || 0);
        setNewUsers(usersRes.count || 0);
        setHolidays(holidaysRes.data || []);
        setNotices(noticesRes.data || []);
      } catch (fetchError) {
        console.error("Failed to load admin dashboard", fetchError);
        setError(fetchError.message || "Unable to load admin metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminMetrics();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #eef2ff, #fff)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #dfe3ff",
            boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Admin pulse
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>System health</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Track high-level KPIs, new user sign-ups, holidays, and notices in one place.
          </p>
        </header>

        <Section title="System statistics" subtitle="Jobs, appointments, and parts throughput">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading system stats…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Total jobs" value={totalJobs} helper="All job records" />
              <MetricCard label="Appointments today" value={appointmentsToday} helper="Scheduled slots" />
              <MetricCard label="Parts requests" value={partsRequests} helper="Active requests" />
            </div>
          )}
        </Section>

        <Section title="New users" subtitle="Last 7 days">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Counting new users…</p>
          ) : (
            <MetricCard label="New users" value={newUsers} helper="Registered in last 7 days" />
          )}
        </Section>

        <Section title="Upcoming holidays" subtitle="Next 7 days">
          {holidays.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No holidays logged for the coming week.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {holidays.map((absence) => (
                <div
                  key={absence.absence_id}
                  style={{
                    border: "1px solid #ffe0e0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong style={{ color: "#a00000" }}>User {absence.user_id}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      {formatDate(absence.start_date)} – {formatDate(absence.end_date)}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{absence.type}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Notices" subtitle="Latest alerts">
          {notices.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No notices at the moment.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {notices.map((notice) => (
                <div
                  key={notice.notification_id}
                  style={{
                    border: "1px solid #ffe0e0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: "#fff",
                  }}
                >
                  <p style={{ margin: 0, color: "#374151" }}>{notice.message}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                    {notice.target_role ? `For ${notice.target_role}` : "General"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
