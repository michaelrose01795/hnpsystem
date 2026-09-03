// file location: src/pages/dashboard/admin/index.js

"use client";

import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
// Loaded on demand.
//
// This module resolves the Supabase browser client, so importing it at module
// scope put 213 KB of @supabase/supabase-js into this route's first-load
// bundle — before the page could paint, for data that is only fetched from an
// effect after mount. The queries still start on the same tick they did
// before; only the download of the client moves off the critical path.
const loadDashboardData = () => import("@/lib/database/dashboard/admin");
import { ContentWidth, LayerSurface, LayerTheme, PageShell } from "@/components/ui";
import AdminDashboardUi from "@/components/page-ui/dashboard/admin/dashboard-admin-ui";
import { logFailure } from "@/lib/utils/logFailure";

const MetricCard = ({ label, parentKey, sectionKey, value, helper }) => (
  <LayerSurface
    sectionKey={sectionKey}
    parentKey={parentKey}
    radius="var(--radius-sm)"
    style={{ minWidth: 0, height: "100%" }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-1)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>{helper}</p>}
  </LayerSurface>
);

const HolidayList = ({ holidays }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
    {holidays.length === 0 ? (
      <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>No holidays for the coming week.</p>
    ) : (
      holidays.map((absence) => (
        <div
          key={absence.absence_id}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-1)" }}
        >
          <div>
            <strong style={{ color: "var(--text-1)" }}>
              {absence.userName || "Unknown user"}
            </strong>
            <p style={{ margin: "4px 0 0", color: "var(--surfaceTextMuted)" }}>
              {dayjs(absence.start_date).format("D MMM")} - {dayjs(absence.end_date).format("D MMM")}
            </p>
          </div>
          <span style={{ color: "var(--surfaceTextMuted)" }}>{absence.type}</span>
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
      <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>No notices at the moment.</p>
    ) : (
      notices.map((notice) => (
        <div key={notice.notification_id} style={{ color: "var(--text-1)" }}>
          <p style={{ margin: 0 }}>{formatNoticeMessage(notice.message)}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--surfaceTextMuted)" }}>
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
        const payload = await (await loadDashboardData()).getAdminDashboardData();
        setData(payload);
      } catch (fetchError) {
        logFailure("Failed to load admin dashboard", fetchError);
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
