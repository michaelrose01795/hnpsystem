// file location: src/pages/dashboard/valeting/index.js
"use client";

import React, { useEffect, useState } from "react"; // React runtime + hooks
import { getValetingDashboardData } from "@/lib/database/dashboard/valeting"; // fetch valet dashboard metrics

// MetricCard — surface-background stat card, equal-sized via parent CSS grid
import ValetingDashboardUi from "@/components/page-ui/dashboard/valeting/dashboard-valeting-ui"; // Extracted presentation layer.
const MetricCard = ({ label, value, helper }) => <div
  className="app-section-card" // surface background from globals.css
  style={{ minWidth: 0 }} // let grid control width so all cards match size
>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-dark)" }}>{label}</p> {/* metric label */}
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p> {/* metric value */}
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>} {/* helper text */}
  </div>;


// TrendBlock — horizontal bar chart rows, each row uses surface background
const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count)); // find max for proportional bar widths
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}> {/* vertical stack of trend rows */}
      {(data || []).map((point) =>
      <div
        key={point.label}
        style={{
          display: "flex", // row layout for label + bar + count
          alignItems: "center", // vertically centred
          gap: "8px", // spacing between label, bar, count
          background: "var(--surface)", // surface-level row background
          borderRadius: "var(--radius-sm)", // rounded corners
          padding: "8px 12px" // inner spacing
        }}>
        
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--info)" }}>{point.label}</span> {/* day label */}
          <div style={{ flex: 1, height: 8, background: "var(--surface-light)", borderRadius: 4 }}> {/* bar track */}
            <div
            style={{
              width: `${Math.round(point.count / max * 100)}%`, // proportional fill
              height: "100%", // full track height
              background: "var(--accent-purple)", // accent colour bar fill
              borderRadius: 4 // rounded bar ends
            }} />
          
          </div>
          <strong style={{ color: "var(--primary-dark)" }}>{point.count}</strong> {/* numeric count */}
        </div>
      )}
    </div>);

};

// QueueBoard — waiting cars table with surface-level rows inside accent section
const QueueBoard = ({ queue }) =>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}> {/* vertical list of queue rows */}
    {queue.length === 0 ? // empty state
  <div
    style={{
      background: "var(--surface)", // surface background for empty card
      borderRadius: "var(--radius-sm)", // rounded corners
      padding: "16px", // inner spacing
      color: "var(--info)" // muted text colour
    }}>
    
        No cars waiting.
      </div> :

  <>
        <div
      style={{
        display: "grid", // table-header grid
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto", // column widths
        gap: "12px", // column gap
        alignItems: "center", // vertical centre
        padding: "0 8px 10px", // header padding
        borderBottom: "1px solid rgba(var(--primary-rgb), 0.14)" // divider line
      }}>
      
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--primary-dark)" }}>Vehicle</span> {/* column header */}
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--primary-dark)" }}>Status</span> {/* column header */}
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--primary-dark)" }}>Queue</span> {/* column header */}
        </div>
        <div
      style={{
        display: "flex", // vertical scroll container
        flexDirection: "column", // stack rows
        gap: "10px", // row gap
        maxHeight: "294px", // scroll after 4-5 rows
        overflowY: "auto", // vertical scroll
        paddingRight: "4px" // space for scrollbar
      }}>
      
          {queue.map((job) =>
      <div
        key={job.id}
        style={{
          display: "grid", // row grid matching header columns
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto", // same as header
          gap: "12px", // column gap
          alignItems: "center", // vertical centre
          minHeight: "66px", // minimum row height
          padding: "14px 16px", // inner spacing
          background: "var(--surface)", // surface-level row background
          borderRadius: "var(--radius-sm)", // rounded corners
          border: "1px solid rgba(var(--primary-rgb), 0.12)", // subtle border
          boxShadow: "0 1px 0 rgba(var(--primary-rgb), 0.04)" // lift shadow
        }}>
        
              <div style={{ minWidth: 0 }}> {/* vehicle info cell */}
                <strong style={{ color: "var(--primary-dark)" }}>{job.job_number || "—"}</strong> {/* job number */}
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--primary)" }}>{job.vehicle_reg || "Plate"}</p> {/* registration */}
              </div>
              <span style={{ color: "var(--info-dark)", fontSize: "0.9rem" }}>{job.status || "Checked in"}</span> {/* status text */}
              <span
          style={{
            justifySelf: "start", // align left in cell
            padding: "6px 10px", // pill padding
            borderRadius: "999px", // pill shape
            background: "rgba(var(--primary-rgb), 0.1)", // soft accent fill
            color: "var(--primary-dark)", // text colour
            fontSize: "0.82rem", // small text
            fontWeight: 600, // semi-bold
            border: "1px solid rgba(var(--primary-rgb), 0.14)" // subtle border
          }}>
          
                {job.waiting_status || "Ready"} {/* queue status badge */}
              </span>
            </div>
      )}
        </div>
      </>
  }
  </div>;


// default empty state for dashboard data
const defaultData = {
  waitingCount: 0, // cars waiting to be washed
  washedCount: 0, // cars already washed
  delayedCount: 0, // cars with delay flag
  waitingQueue: [], // list of cars in the queue
  trends: [] // 7-day trend data
};

export default function ValetingDashboard() {
  const [data, setData] = useState(defaultData); // dashboard metrics state
  const [loading, setLoading] = useState(true); // loading indicator
  const [error, setError] = useState(null); // error message

  useEffect(() => {
    const loadData = async () => {// fetch dashboard data on mount
      setLoading(true); // show loading state
      setError(null); // clear previous errors
      try {
        const payload = await getValetingDashboardData(); // call Supabase query
        setData(payload); // update state with fetched data
      } catch (fetchError) {
        console.error("Failed to load valeting metrics", fetchError); // log error
        setError(fetchError.message || "Unable to load valeting data"); // display error
      } finally {
        setLoading(false); // hide loading state
      }
    };
    loadData(); // invoke on mount
  }, []);

  const totalTrendStarts = (data.trends || []).reduce((sum, point) => sum + (point.count || 0), 0); // sum of 7-day wash starts

  return <ValetingDashboardUi view="section1" data={data} error={error} loading={loading} MetricCard={MetricCard} QueueBoard={QueueBoard} TrendBlock={TrendBlock} />;








































































}
