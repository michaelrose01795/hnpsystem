// file location: src/pages/job-cards/archive/index.js
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { SearchBar } from "@/components/searchBarAPI";
import { prefetchJob } from "@/lib/swr/prefetch";

const STATUS_BADGES = {
  Complete: { bg: "var(--success-surface)", color: "var(--info-dark)" },
  Released: { bg: "var(--success-surface)", color: "var(--success-dark)" },
  Invoiced: { bg: "var(--info-surface)", color: "var(--accent-purple)" },
  Delivered: { bg: "var(--warning-surface)", color: "var(--danger-dark)" },
  Archived: { bg: "var(--info-surface)", color: "var(--info-dark)" },
};

const defaultStatusBadge = { bg: "var(--info-surface)", color: "var(--info-dark)" };

export default function ArchivedJobsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const runSearch = async (searchTerm = "") => {
    setIsSearching(true);
    setError("");
    try {
      const response = await fetch(
        `/api/jobcards/archive/search?q=${encodeURIComponent(searchTerm.trim())}`
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Search failed");
      }
      setResults(payload.data || []);
    } catch (err) {
      setError(err.message || "Unable to search archived jobs.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    runSearch("");
  }, []);

  return (
    <Layout>
      <div className="app-page-stack" style={{ gap: "24px" }}>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(query);
          }}
          className="app-toolbar-row"
          style={{
            display: "flex",
            width: "100%",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            padding: 0,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            borderRadius: 0,
            color: "var(--search-text)",
          }}
        >
          <SearchBar
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search by reg, job number, or customer name"
            style={{
              flex: "1 1 260px",
            }}
          />
          <button
            type="submit"
            disabled={isSearching}
            style={{
              minHeight: "var(--control-height)",
              height: "var(--control-height)",
              padding: "0 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              minWidth: "120px",
              flexShrink: 0,
              opacity: isSearching ? 0.6 : 1,
            }}
          >
            {isSearching ? "Searching…" : "Search"}
          </button>
        </form>

        {error && (
          <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--danger-surface)", background: "var(--danger-surface)", padding: "12px" }}>
            <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        <section
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--info-surface)",
          }}
        >
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--info-surface)" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--accent-purple)" }}>
              {results.length} archived {results.length === 1 ? "job" : "jobs"} found
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--info)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "10px 18px" }}>Job #</th>
                  <th style={{ padding: "10px 18px" }}>Customer</th>
                  <th style={{ padding: "10px 18px" }}>Vehicle</th>
                  <th style={{ padding: "10px 18px" }}>Status</th>
                  <th style={{ padding: "10px 18px" }}>Completed</th>
                  <th style={{ padding: "10px 18px" }} />
                </tr>
              </thead>
              <tbody>
                {results.map((job) => {
                  const badge = STATUS_BADGES[job.status] || defaultStatusBadge;
                  return (
                    <tr key={job.id} style={{ borderTop: "1px solid var(--info-surface)" }}>
                      <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--accent-purple)" }}>{job.jobNumber}</td>
                      <td style={{ padding: "12px 18px", color: "var(--info-dark)" }}>{job.customer || "—"}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: 600 }}>{job.vehicleMakeModel || "—"}</span>
                          <span style={{ color: "var(--info)" }}>{job.vehicleReg || "—"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 12px",
                            borderRadius: "var(--control-radius)",
                            background: badge.bg,
                            color: badge.color,
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", color: "var(--info-dark)" }}>
                        {job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <Link
                          href={`/job-cards/${encodeURIComponent(job.jobNumber)}?archive=1`}
                          onMouseEnter={() => prefetchJob(job.jobNumber)} // warm SWR cache on hover
                          style={{
                            textDecoration: "none",
                            padding: "8px 14px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--info)",
                            color: "var(--accent-purple)",
                            fontWeight: 600,
                          }}
                        >
                          View archive
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "18px", textAlign: "center", color: "var(--info)" }}>
                      No archived jobs matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}
