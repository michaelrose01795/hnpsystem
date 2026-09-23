// file location: src/features/websiteManager/panels/ActivityPanel.js
// Recent website activity log — a monitored audit trail of every change made
// through the Website Manager.
import React, { useMemo, useState } from "react";
import Section from "@/components/Section";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { formatDateTime } from "../helpers";

export default function ActivityPanel({ activity }) {
  const [query, setQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("all");

  // Distinct page names present in the log, for the filter dropdown.
  const pageOptions = useMemo(() => {
    const set = new Set(activity.map((a) => a.page).filter(Boolean));
    return Array.from(set)
      .sort()
      .map((name) => ({ value: name, label: name }));
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
    <Section title="Recent website activity">
      <div className="website-manager__toolbar">
        <input
          className="app-input"
          type="search"
          placeholder="Search activity…"
          aria-label="Search activity"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <DropdownField
          className="website-manager__toolbar-filter"
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value)}
          aria-label="Filter by page"
          options={[{ value: "all", label: "All pages" }, ...pageOptions]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="bare"
          role="status"
          title={activity.length === 0 ? "No changes recorded yet" : "No activity matches your search"}
          description={
            activity.length === 0
              ? "Edits, uploads and publish-status changes made in the Website Manager appear here as they happen."
              : "Clear the search box or choose “All pages” to see the full log."
          }
        />
      ) : (
        <div className="website-manager__table-scroll">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Item</th>
                <th>Page</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="website-manager__cell-muted website-manager__cell-nowrap">
                    {formatDateTime(a.at)}
                  </td>
                  <td className="website-manager__cell-strong">{a.action}</td>
                  <td className="website-manager__cell-muted">{a.target || "—"}</td>
                  <td className="website-manager__cell-muted">{a.page || "—"}</td>
                  <td className="website-manager__cell-muted">{a.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
