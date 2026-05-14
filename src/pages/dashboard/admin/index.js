// file location: src/pages/dashboard/admin/index.js

"use client";

import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { getAdminDashboardData } from "@/lib/database/dashboard/admin";
import { ContentWidth, LayerSurface, LayerTheme, PageShell } from "@/components/ui";
import AdminDashboardUi from "@/components/page-ui/dashboard/admin/dashboard-admin-ui";

const MetricCard = ({ label, parentKey, sectionKey, value, helper }) => (
  <LayerSurface
    sectionKey={sectionKey}
    parentKey={parentKey}
    radius="var(--radius-sm)"
    style={{ minWidth: 0, height: "100%" }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-selected)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </LayerSurface>
);

const HolidayList = ({ holidays }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
    {holidays.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No holidays for the coming week.</p>
    ) : (
      holidays.map((absence) => (
        <div
          key={absence.absence_id}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info-dark)" }}
        >
          <div>
            <strong style={{ color: "var(--primary-selected)" }}>
              {absence.userName || "Unknown user"}
            </strong>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
              {dayjs(absence.start_date).format("D MMM")} - {dayjs(absence.end_date).format("D MMM")}
            </p>
          </div>
          <span style={{ color: "var(--info)" }}>{absence.type}</span>
        </div>
      ))
    )}
  </LayerSurface>
);

const formatNoticeMessage = (message = "") =>
  String(message).replace(/^\s*(?:\u2139\uFE0F?|\u24D8|i)\s*/i, "").trim();

const NoticeList = ({ notices }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
    {notices.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No notices at the moment.</p>
    ) : (
      notices.map((notice) => (
        <div key={notice.notification_id} style={{ color: "var(--info-dark)" }}>
          <p style={{ margin: 0 }}>{formatNoticeMessage(notice.message)}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--info)" }}>
            {notice.target_role ? `For ${notice.target_role}` : "General"}
          </p>
        </div>
      ))
    )}
  </LayerSurface>
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
    <AdminDashboardUi
      view="section1"
      ContentWidth={ContentWidth}
      data={data}
      error={error}
      HolidayList={HolidayList}
      LayerTheme={LayerTheme}
      loading={loading}
      MetricCard={MetricCard}
      NoticeList={NoticeList}
      PageShell={PageShell}
    />
  );
}
