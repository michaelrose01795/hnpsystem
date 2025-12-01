// file location: src/pages/job-cards/archive/index.js
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";

const STATUS_BADGES = {
  Complete: { bg: "#ecfdf5", color: "#065f46" },
  Invoiced: { bg: "#eff6ff", color: "#1d4ed8" },
  Delivered: { bg: "#fef3c7", color: "#92400e" },
};

const defaultStatusBadge = { bg: "#f3f4f6", color: "#374151" };

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
          <p style={{ color: "#d10000", letterSpacing: "0.3em", textTransform: "uppercase", fontSize: "0.75rem" }}>
            Archive
          </p>
          <h1 style={{ margin: "4px 0 8px", fontSize: "2rem", fontWeight: 700, color: "#111827" }}>
            Archived Job Cards
          </h1>
          <p style={{ color: "#4b5563", maxWidth: "720px" }}>
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
            background: "white",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
            border: "1px solid #f3f4f6",
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by reg, job number, or customer name"
            style={{
              flex: "1 1 260px",
              padding: "12px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              fontSize: "1rem",
            }}
          />
          <button
            type="submit"
            disabled={isSearching}
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              border: "none",
              background: "#d10000",
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
          <div style={{ borderRadius: "12px", border: "1px solid #fecaca", background: "#fef2f2", padding: "12px" }}>
            <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>
          </div>
        )}

        <section
          style={{
            background: "white",
            borderRadius: "12px",
            border: "1px solid #f3f4f6",
            boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f3f4f6" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "#111827" }}>
              {results.length} archived {results.length === 1 ? "job" : "jobs"} found
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6b7280", fontSize: "0.85rem" }}>
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
                    <tr key={job.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "16px 24px", fontWeight: 600, color: "#111827" }}>{job.jobNumber}</td>
                      <td style={{ padding: "16px 24px", color: "#374151" }}>{job.customer || "—"}</td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: 600 }}>{job.vehicleMakeModel || "—"}</span>
                          <span style={{ color: "#6b7280" }}>{job.vehicleReg || "—"}</span>
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
                      <td style={{ padding: "16px 24px", color: "#4b5563" }}>
                        {job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <Link
                          href={`/job-cards/${encodeURIComponent(job.jobNumber)}?archive=1`}
                          style={{
                            textDecoration: "none",
                            padding: "8px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            color: "#111827",
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
                    <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
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
