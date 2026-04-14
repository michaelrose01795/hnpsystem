// file location: src/pages/job-cards/archive/index.js
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { prefetchJob } from "@/lib/swr/prefetch";

const STATUS_BADGES = {
  Complete: { bg: "var(--success-surface)", color: "var(--success-text)" },
  Released: { bg: "var(--success-surface)", color: "var(--success-dark)" },
  Invoiced: { bg: "var(--info-surface)", color: "var(--accentText)" },
  Delivered: { bg: "var(--warning-surface)", color: "var(--warning-text)" },
  Archived: { bg: "var(--info-surface)", color: "var(--accentText)" },
};

const defaultStatusBadge = { bg: "var(--info-surface)", color: "var(--accentText)" };

export default function ArchivedJobsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("updated-desc");
  const [regOnly, setRegOnly] = useState(false);

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

  const availableStatuses = useMemo(() => {
    const statuses = new Set();
    results.forEach((job) => {
      const statusValue = String(job?.status || "").trim();
      if (statusValue) statuses.add(statusValue);
    });
    return ["all", ...Array.from(statuses)];
  }, [results]);

  const filteredResults = useMemo(() => {
    const nextResults = [...results].filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (regOnly && !String(job.vehicleReg || "").trim()) return false;
      return true;
    });

    nextResults.sort((left, right) => {
      if (sortOrder === "updated-asc" || sortOrder === "updated-desc") {
        const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return sortOrder === "updated-asc" ? leftTime - rightTime : rightTime - leftTime;
      }

      if (sortOrder === "job-asc" || sortOrder === "job-desc") {
        const compared = String(left.jobNumber || "").localeCompare(String(right.jobNumber || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortOrder === "job-asc" ? compared : -compared;
      }

      return String(left.customer || "").localeCompare(String(right.customer || ""), undefined, {
        sensitivity: "base",
      });
    });

    return nextResults;
  }, [regOnly, results, sortOrder, statusFilter]);

  return (
    <>
      <DevLayoutSection
        sectionKey="job-cards-archive-page-shell"
        sectionType="page-shell"
        shell
        className="app-page-stack"
        style={{ gap: "24px" }}
      >
        <DevLayoutSection
          as="form"
          sectionKey="job-cards-archive-search-toolbar"
          parentKey="job-cards-archive-page-shell"
          sectionType="toolbar"
          backgroundToken="transparent"
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
          <DevLayoutSection
            sectionKey="job-cards-archive-search-input"
            parentKey="job-cards-archive-search-toolbar"
            sectionType="filter-row"
            backgroundToken="search-surface"
            style={{ flex: "1 1 260px" }}
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
          </DevLayoutSection>
          <DevLayoutSection
            sectionKey="job-cards-archive-toolbar-actions"
            parentKey="job-cards-archive-search-toolbar"
            sectionType="toolbar"
            backgroundToken="accent-surface"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <DropdownField
              aria-label="Filter archive results by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={availableStatuses.map((status) => ({
                value: status,
                label: status === "all" ? "All statuses" : status,
              }))}
              placeholder="All statuses"
              style={{
                minWidth: "150px",
                width: "auto",
              }}
            />

            <DropdownField
              aria-label="Sort archive results"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              options={[
                { value: "updated-desc", label: "Newest completed" },
                { value: "updated-asc", label: "Oldest completed" },
                { value: "job-asc", label: "Job number A-Z" },
                { value: "job-desc", label: "Job number Z-A" },
                { value: "customer-asc", label: "Customer A-Z" },
              ]}
              placeholder="Sort archive"
              style={{
                minWidth: "180px",
                width: "auto",
              }}
            />

            <Button
              type="submit"
              variant="primary"
              disabled={isSearching}
              style={{
                minWidth: "120px",
                opacity: isSearching ? 0.6 : 1,
              }}
            >
              {isSearching ? "Searching…" : "Search"}
            </Button>

            <Button
              type="button"
              variant={regOnly ? "primary" : "secondary"}
              onClick={() => {
                setRegOnly((current) => !current);
              }}
              aria-pressed={regOnly}
            >
              Registration Only
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setSortOrder("updated-desc");
                setRegOnly(false);
                runSearch("");
              }}
            >
              Clear filtes
            </Button>
          </DevLayoutSection>
        </DevLayoutSection>

        {error && (
          <DevLayoutSection
            sectionKey="job-cards-archive-error-banner"
            parentKey="job-cards-archive-page-shell"
            sectionType="state-banner"
            backgroundToken="danger-surface"
            style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--danger-surface)", background: "var(--danger-surface)", padding: "12px" }}
          >
            <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
          </DevLayoutSection>
        )}

        <DevLayoutSection
          as="section"
          sectionKey="job-cards-archive-results-panel"
          parentKey="job-cards-archive-page-shell"
          sectionType="section-shell"
          shell
          backgroundToken="surface"
          style={{
            background: "var(--accentSurfaceSubtle)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accentBorder)",
          }}
        >
          <DevLayoutSection
            sectionKey="job-cards-archive-results-table-scroll"
            parentKey="job-cards-archive-results-panel"
            sectionType="content-card"
            backgroundToken="accent-surface"
            style={{ overflowX: "auto" }}
          >
            <DevLayoutSection
              as="table"
              sectionKey="job-cards-archive-results-table"
              parentKey="job-cards-archive-results-table-scroll"
              sectionType="data-table"
              backgroundToken="accent-surface"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead
                data-dev-section="1"
                data-dev-section-key="job-cards-archive-results-table-headings"
                data-dev-section-type="table-headings"
                data-dev-section-parent="job-cards-archive-results-table"
                style={{ background: "var(--accentSurface)", color: "var(--surfaceText)" }}
              >
                <tr style={{ textAlign: "left", color: "var(--surfaceText)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "10px 18px" }}>Job #</th>
                  <th style={{ padding: "10px 18px" }}>Customer</th>
                  <th style={{ padding: "10px 18px" }}>Vehicle</th>
                  <th style={{ padding: "10px 18px" }}>Status</th>
                  <th style={{ padding: "10px 18px" }}>Completed</th>
                  <th style={{ padding: "10px 18px" }} />
                </tr>
              </thead>
              <tbody data-dev-section-key="job-cards-archive-results-table-rows">
                {filteredResults.map((job) => {
                  const badge = STATUS_BADGES[job.status] || defaultStatusBadge;
                  return (
                    <tr
                      key={job.id}
                      data-dev-section-key={`job-cards-archive-results-row-${job.id}`}
                      style={{
                        borderTop: "1px solid var(--accentBorder)",
                        background: "var(--surface)",
                        transition: "background-color 0.18s ease, box-shadow 0.18s ease",
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = "var(--accentSurfaceSubtle)";
                        event.currentTarget.style.boxShadow = "inset 4px 0 0 var(--accentMain)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = "var(--surface)";
                        event.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--accentText)" }}>{job.jobNumber}</td>
                      <td style={{ padding: "12px 18px", color: "var(--surfaceText)" }}>{job.customer || "—"}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: 600, color: "var(--surfaceText)" }}>{job.vehicleMakeModel || "—"}</span>
                          <span style={{ color: "var(--surfaceTextMuted)" }}>{job.vehicleReg || "—"}</span>
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
                {filteredResults.length === 0 && (
                  <tr data-dev-section-key="job-cards-archive-empty-row">
                    <td colSpan={6} style={{ padding: "18px", textAlign: "center", color: "var(--info)" }}>
                      No archived jobs matched the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>
      </DevLayoutSection>
    </>
  );
}
