// file location: src/pages/dashboard/admin/index.js

"use client";

import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { getAdminDashboardData } from "@/lib/database/dashboard/admin";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md §3.0)
import AdminDashboardUi from "@/components/page-ui/dashboard/admin/dashboard-admin-ui"; // Extracted presentation layer.

// MetricCard — single stat tile. Lives inside a Section (LayerSurface),
// so per the strict alternation rule it renders as a LayerTheme.
const MetricCard = ({ label, value, helper }) => (
  <LayerTheme radius="var(--radius-sm)" style={{ minWidth: 160 }}>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-selected)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </LayerTheme>
);

// HolidayList — list block inside a Section (LayerSurface), renders as LayerTheme.
const HolidayList = ({ holidays }) => (
  <LayerTheme radius="var(--radius-sm)" padding="12px" gap="10px">
    {holidays.length === 0 ?
      <p style={{ margin: 0, color: "var(--info)" }}>No holidays for the coming week.</p> :
      holidays.map((absence) =>
        <div
          key={absence.absence_id}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info-dark)" }}>
          <div>
            <strong style={{ color: "var(--primary-selected)" }}>
              {absence.userName || "Unknown user"}
            </strong>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
              {dayjs(absence.start_date).format("D MMM")} – {dayjs(absence.end_date).format("D MMM")}
            </p>
          </div>
          <span style={{ color: "var(--info)" }}>{absence.type}</span>
        </div>
      )
    }
  </LayerTheme>
);

// NoticeList — list block inside a Section (LayerSurface), renders as LayerTheme.
const NoticeList = ({ notices }) => (
  <LayerTheme radius="var(--radius-sm)" padding="12px" gap="10px">
    {notices.length === 0 ?
      <p style={{ margin: 0, color: "var(--info)" }}>No notices at the moment.</p> :
      notices.map((notice) =>
        <div key={notice.notification_id} style={{ color: "var(--info-dark)" }}>
          <p style={{ margin: 0 }}>{notice.message}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--info)" }}>
            {notice.target_role ? `For ${notice.target_role}` : "General"}
          </p>
        </div>
      )
    }
  </LayerTheme>
);


const defaultData = {
  totalJobs: 0,
  appointmentsToday: 0,
  partsRequests: 0,
  newUsers: 0,
  holidays: [],
  notices: []
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

  return <AdminDashboardUi view="section1" data={data} error={error} HolidayList={HolidayList} LayerSurface={LayerSurface} loading={loading} MetricCard={MetricCard} NoticeList={NoticeList} Section={Section} />;
}
