// file location: src/pages/archive/index.js
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { prefetchJob } from "@/lib/swr/prefetch";
import ArchivedJobsPageUi from "@/components/page-ui/job-cards/archive/job-cards-archive-ui"; // Extracted presentation layer.

const STATUS_BADGE_CLASSES = {
  Complete: "app-badge--success",
  Released: "app-badge--success",
  Cancelled: "app-badge--danger",
  Invoiced: "app-badge--accent-soft",
  Delivered: "app-badge--warning",
  Archived: "app-badge--accent-soft"
};

const defaultStatusBadgeClass = "app-badge--neutral";

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
          sensitivity: "base"
        });
        return sortOrder === "job-asc" ? compared : -compared;
      }

      return String(left.customer || "").localeCompare(String(right.customer || ""), undefined, {
        sensitivity: "base"
      });
    });

    return nextResults;
  }, [regOnly, results, sortOrder, statusFilter]);

  return <ArchivedJobsPageUi view="section1" availableStatuses={availableStatuses} Button={Button} defaultStatusBadgeClass={defaultStatusBadgeClass} DevLayoutSection={DevLayoutSection} DropdownField={DropdownField} error={error} filteredResults={filteredResults} isSearching={isSearching} Link={Link} prefetchJob={prefetchJob} query={query} regOnly={regOnly} runSearch={runSearch} SearchBar={SearchBar} setQuery={setQuery} setRegOnly={setRegOnly} setSortOrder={setSortOrder} setStatusFilter={setStatusFilter} sortOrder={sortOrder} STATUS_BADGE_CLASSES={STATUS_BADGE_CLASSES} statusFilter={statusFilter} />;















































































































































































































































































}
