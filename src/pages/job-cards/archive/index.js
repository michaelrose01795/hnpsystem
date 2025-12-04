// file location: src/pages/job-cards/archive/index.js
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";

const STATUS_BADGES = {
  Complete: { bg: "var(--success-surface)", color: "var(--info-dark)" },
  Invoiced: { bg: "var(--info-surface)", color: "var(--accent-purple)" },
  Delivered: { bg: "var(--warning-surface)", color: "var(--danger-dark)" },
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
        <header>
          <p style={{ color: "var(--primary)", letterSpacing: "0.3em", textTransform: "uppercase", fontSize: "0.75rem" }}>
            Archive
          </p>
          <h1 style={{ margin: "4px 0 8px", fontSize: "2rem", fontWeight: 700, color: "var(--accent-purple)" }}>
            Archived Job Cards
          </h1>
          <p style={{ color: "var(--info-dark)", maxWidth: "720px" }}>
            Completed jobs are permanently archived for audit purposes. Use the search tools below to look up vehicles by
            registration, job number, or customer name. Selecting a record opens the full job card in read-only mode with
            VHC, notes, and documents intact.
          </p>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(query);
          }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            background: "var(--search-surface)",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 10px 25px rgba(var(--shadow-rgb),0.06)",
            border: "1px solid var(--search-surface-muted)",
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by reg, job number, or customer name"
            style={{
              flex: "1 1 260px",
              padding: "12px 16px",
              border: "1px solid var(--search-surface-muted)",
              borderRadius: "10px",
              fontSize: "1rem",
              background: "var(--search-surface)",
              color: "var(--search-text)",
            }}
          />
          <button
            type="submit"
            disabled={isSearching}
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              minWidth: "140px",
              opacity: isSearching ? 0.6 : 1,
            }}
          >
            {isSearching ? "Searching…" : "Search"}
          </button>
        </form>

        {error && (
          <div style={{ borderRadius: "12px", border: "1px solid var(--danger-surface)", background: "var(--danger-surface)", padding: "12px" }}>
            <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        <section
          style={{
            background: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--info-surface)",
            boxShadow: "0 10px 25px rgba(var(--shadow-rgb),0.04)",
          }}
        >
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--info-surface)" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--accent-purple)" }}>
              {results.length} archived {results.length === 1 ? "job" : "jobs"} found
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--info)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "12px 24px" }}>Job #</th>
                  <th style={{ padding: "12px 24px" }}>Customer</th>
                  <th style={{ padding: "12px 24px" }}>Vehicle</th>
                  <th style={{ padding: "12px 24px" }}>Status</th>
                  <th style={{ padding: "12px 24px" }}>Completed</th>
                  <th style={{ padding: "12px 24px" }} />
                </tr>
              </thead>
              <tbody>
                {results.map((job) => {
                  const badge = STATUS_BADGES[job.status] || defaultStatusBadge;
                  return (
                    <tr key={job.id} style={{ borderTop: "1px solid var(--info-surface)" }}>
                      <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--accent-purple)" }}>{job.jobNumber}</td>
                      <td style={{ padding: "16px 24px", color: "var(--info-dark)" }}>{job.customer || "—"}</td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: 600 }}>{job.vehicleMakeModel || "—"}</span>
                          <span style={{ color: "var(--info)" }}>{job.vehicleReg || "—"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 12px",
                            borderRadius: "999px",
                            background: badge.bg,
                            color: badge.color,
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", color: "var(--info-dark)" }}>
                        {job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <Link
                          href={`/job-cards/${encodeURIComponent(job.jobNumber)}?archive=1`}
                          style={{
                            textDecoration: "none",
                            padding: "8px 14px",
                            borderRadius: "10px",
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
                    <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--info)" }}>
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
