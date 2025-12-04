// file location: src/pages/dashboard/admin/index.js

"use client";

import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getAdminDashboardData } from "@/lib/database/dashboard/admin";

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "var(--surface)",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid var(--surface-light)",
      boxShadow: "0 18px 30px rgba(var(--shadow-rgb),0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--info)" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      border: "1px solid var(--surface-light)",
      borderRadius: "14px",
      padding: "16px",
      minWidth: 160,
      background: "var(--surface)",
      boxShadow: "0 10px 20px rgba(var(--shadow-rgb),0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-dark)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>
);

const HolidayList = ({ holidays }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      border: "1px solid var(--surface-light)",
      borderRadius: "12px",
      padding: "12px",
      background: "var(--surface)",
    }}
  >
    {holidays.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No holidays for the coming week.</p>
    ) : (
      holidays.map((absence) => (
        <div
          key={absence.absence_id}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info-dark)" }}
        >
          <div>
            <strong style={{ color: "var(--primary-dark)" }}>User {absence.user_id}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
              {dayjs(absence.start_date).format("D MMM")} – {dayjs(absence.end_date).format("D MMM")}
            </p>
          </div>
          <span style={{ color: "var(--info)" }}>{absence.type}</span>
        </div>
      ))
    )}
  </div>
);

const NoticeList = ({ notices }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      border: "1px solid var(--surface-light)",
      borderRadius: "12px",
      padding: "12px",
      background: "var(--surface)",
    }}
  >
    {notices.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No notices at the moment.</p>
    ) : (
      notices.map((notice) => (
        <div key={notice.notification_id} style={{ color: "var(--info-dark)" }}>
          <p style={{ margin: 0 }}>{notice.message}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--info)" }}>
            {notice.target_role ? `For ${notice.target_role}` : "General"}
          </p>
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  totalJobs: 0,
  appointmentsToday: 0,
  partsRequests: 0,
  newUsers: 0,
  holidays: [],
  notices: [],
};

export default function AdminDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAdminDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load admin dashboard", fetchError);
        setError(fetchError.message || "Unable to load admin metrics");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid var(--accent-purple-surface)",
            boxShadow: "0 18px 30px rgba(var(--shadow-rgb),0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary-dark)" }}>
            Admin pulse
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>System health</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Track jobs, appointments, requests, and notices in one place.
          </p>
        </header>

        <Section title="System statistics" subtitle="Jobs, appointments, and parts throughput">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading system stats…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Total jobs" value={data.totalJobs} helper="Job records" />
              <MetricCard label="Appointments today" value={data.appointmentsToday} helper="Scheduled slots" />
              <MetricCard label="Parts requests" value={data.partsRequests} helper="Active requests" />
            </div>
          )}
        </Section>

        <Section title="New users" subtitle="Last 7 days">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Counting new users…</p>
          ) : (
            <MetricCard label="New users" value={data.newUsers} helper="Registered in last 7 days" />
          )}
        </Section>

        <Section title="Upcoming holidays" subtitle="Next 7 days">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading holiday requests…</p>
          ) : (
            <HolidayList holidays={data.holidays} />
          )}
        </Section>

        <Section title="Notices" subtitle="Latest alerts">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading notices…</p>
          ) : (
            <NoticeList notices={data.notices} />
          )}
        </Section>
      </div>
    </Layout>
  );
}