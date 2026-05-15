// file location: src/features/websiteManager/panels/ActivityPanel.js
// Recent website activity log — a monitored audit trail of every change made
// through the Website Manager.
import React, { useMemo, useState } from "react";
import Section from "@/components/Section";
import { EmptyState, formatDateTime, cellStyle, headCellStyle } from "../helpers";

export default function ActivityPanel({ activity }) {
  const [query, setQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("all");

  // Distinct page names present in the log, for the filter dropdown.
  const pageOptions = useMemo(() => {
    const set = new Set(activity.map((a) => a.page).filter(Boolean));
    return Array.from(set).sort();
  }, [activity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activity.filter((a) => {
      if (pageFilter !== "all" && a.page !== pageFilter) return false;
      if (!q) return true;
      return (
        a.action.toLowerCase().includes(q) ||
        (a.target || "").toLowerCase().includes(q) ||
        (a.page || "").toLowerCase().includes(q) ||
        (a.user || "").toLowerCase().includes(q)
      );
    });
  }, [activity, query, pageFilter]);

  return (
    <Section
      title="Recent Website Activity"
      subtitle="Every add, edit, delete, upload, reorder and status change is recorded here."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          className="app-input"
          type="search"
          placeholder="Search activity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 220px", minWidth: 200 }}
        />
        <select
          className="app-input"
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value)}
          style={{ flex: "0 0 auto", minWidth: 180 }}
        >
          <option value="all">All pages</option>
          {pageOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            activity.length === 0
              ? "No website changes have been recorded yet. Edits, uploads and status changes made here will appear in this log."
              : "No activity matches your search."
          }
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
          >
            <thead>
              <tr>
                <th style={headCellStyle}>When</th>
                <th style={headCellStyle}>Action</th>
                <th style={headCellStyle}>Item</th>
                <th style={headCellStyle}>Page</th>
                <th style={headCellStyle}>By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...cellStyle, color: "var(--text-1)", whiteSpace: "nowrap" }}>
                    {formatDateTime(a.at)}
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{a.action}</td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                    {a.target || "—"}
                  </td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                    {a.page || "—"}
                  </td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>{a.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
