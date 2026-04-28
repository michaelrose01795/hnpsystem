// file location: src/pages/vhc/customer/[jobNumber]/[linkCode].js
// Public, link-authenticated VHC customer view. Replaces /vhc/share/...
// The customer can authorise / decline items here; staff updates pushed in
// real-time via Supabase channel; customer changes write back via the public
// share-update API and propagate back to staff via the same channel.
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/database/supabaseClient";
import { summariseTechnicianVhc, parseVhcBuilderPayload } from "@/lib/vhc/summary";
import { normaliseDecisionStatus, resolveSeverityKey } from "@/features/vhc/vhcStatusEngine";
import { buildVhcQuoteLinesModel } from "@/lib/vhc/quoteLines";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import VhcCustomerView from "@/components/VHC/VhcCustomerView";

const LABOUR_RATE = 85;

export default function CustomerLinkPage() {
  const router = useRouter();
  const { jobNumber, linkCode } = router.query;

  const [job, setJob] = useState(null);
  const [vhcChecksData, setVhcChecksData] = useState([]);
  const [partsJobItems, setPartsJobItems] = useState([]);
  const [jobFiles, setJobFiles] = useState([]);
  const [vhcIdAliases, setVhcIdAliases] = useState({});
  const [authorizedViewRows, setAuthorizedViewRows] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [updatingStatus, setUpdatingStatus] = useState(new Set());

  const refetchTimerRef = useRef(null);
  const validateAndFetchRef = useRef(null);

  // Fetch job data via the public share-link API
  useEffect(() => {
    if (!jobNumber || !linkCode) return;

    const validateAndFetch = async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/job-cards/${jobNumber}/share-link?linkCode=${linkCode}`
        );
        let data;
        try {
          data = await response.json();
        } catch (parseErr) {
          setError("Failed to load job data");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          if (response.status === 410) {
            setError("This link has expired. Please request a new link from the service team.");
          } else if (response.status === 404) {
            setError("This link is invalid or the job was not found.");
          } else {
            setError(data?.error || "Failed to load job data");
          }
          return;
        }

        const { jobData, expiresAt: linkExpiresAt } = data;
        const {
          vhc_checks = [],
          parts_job_items = [],
          job_files = [],
          ...jobFields
        } = jobData || {};

        setJob(jobFields);
        setVhcChecksData(vhc_checks || []);
        setPartsJobItems(parts_job_items || []);
        setJobFiles(job_files || []);
        setExpiresAt(linkExpiresAt);

        const aliasMap = {};
        (vhc_checks || []).forEach((check) => {
          if (check?.display_id && check?.vhc_id) {
            aliasMap[String(check.display_id)] = String(check.vhc_id);
          }
        });
        setVhcIdAliases(aliasMap);

        const authorizedRows = (vhc_checks || []).filter(
          (c) => c.approval_status === "authorized" || c.approval_status === "completed"
        );
        setAuthorizedViewRows(authorizedRows);
      } catch (err) {
        console.error("Error fetching job data:", err);
        if (!silent) setError("Failed to load job data. Please try again later.");
      } finally {
        if (!silent) setLoading(false);
      }
    };

    validateAndFetchRef.current = validateAndFetch;
    validateAndFetch();
  }, [jobNumber, linkCode]);

  // Live updates from staff edits — silent re-fetch on any change
  useEffect(() => {
    const jobId = job?.id;
    if (!jobId) return undefined;

    const scheduleRefetch = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        validateAndFetchRef.current?.({ silent: true });
      }, 400);
    };

    const channel = supabase
      .channel(`vhc-customer-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vhc_checks", filter: `job_id=eq.${jobId}` },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parts_job_items", filter: `job_id=eq.${jobId}` },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_files", filter: `job_id=eq.${jobId}` },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [job?.id]);

  // ===== Severity / totals derivation (mirrors customer-preview logic) =====

  const vhcData = useMemo(() => {
    const fromDb = parseVhcBuilderPayload(vhcChecksData || []);
    if (fromDb) return fromDb;
    if (!job?.checksheet) return null;
    try {
      return typeof job.checksheet === "string" ? JSON.parse(job.checksheet) : job.checksheet;
    } catch {
      return null;
    }
  }, [vhcChecksData, job?.checksheet]);

  const builderSummary = useMemo(() => summariseTechnicianVhc(vhcData || {}), [vhcData]);
  const sections = builderSummary.sections || [];

  const quoteViewModel = useMemo(
    () =>
      buildVhcQuoteLinesModel({
        job,
        sections,
        vhcChecksData,
        partsJobItems,
        vhcIdAliases,
        authorizedViewRows,
        labourRate: LABOUR_RATE,
        mode: "withPlaceholders"
      }),
    [job, sections, vhcChecksData, partsJobItems, vhcIdAliases, authorizedViewRows]
  );
  const displaySeverityLists = quoteViewModel.severityLists || {
    red: [], amber: [], green: [], authorized: [], declined: []
  };
  const displayTotals = quoteViewModel.totals || {
    red: 0, amber: 0, green: 0, authorized: 0, declined: 0
  };

  // Photos / videos
  const photoFiles = useMemo(() => {
    return jobFiles.filter((file) => {
      const type = (file.file_type || "").toLowerCase();
      const name = (file.file_name || "").toLowerCase();
      return type.startsWith("image") || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
    });
  }, [jobFiles]);

  const videoFiles = useMemo(() => {
    return jobFiles.filter((file) => {
      const type = (file.file_type || "").toLowerCase();
      const name = (file.file_name || "").toLowerCase();
      return type.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
    });
  }, [jobFiles]);

  // Customer-side authorise/decline → public API
  const updateEntryStatus = useCallback(
    async (itemId, newStatus) => {
      if (!itemId || !jobNumber || !linkCode) return;
      setUpdatingStatus((prev) => new Set(prev).add(itemId));
      try {
        const response = await fetch("/api/vhc/share-update-item-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobNumber,
            linkCode,
            vhcItemId: itemId,
            approvalStatus: newStatus || "pending"
          })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          alert(body?.message || "Could not update — please refresh and try again.");
        } else {
          // Optimistic refresh — channel will also push, but this gives instant feedback
          validateAndFetchRef.current?.({ silent: true });
        }
      } catch (err) {
        console.error("Customer update failed:", err);
        alert("Could not update — please check your connection and try again.");
      } finally {
        setUpdatingStatus((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [jobNumber, linkCode]
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--surface-light)", padding: "16px 12px" }}>
        <SkeletonKeyframes />
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonBlock width="100%" height="64px" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <SkeletonBlock width="100%" height="60px" />
            <SkeletonBlock width="100%" height="60px" />
            <SkeletonBlock width="100%" height="60px" />
            <SkeletonBlock width="100%" height="60px" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} width="100%" height="120px" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-light)",
          padding: 16
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--accent-purple)", marginBottom: 8 }}>
            Unable to load report
          </div>
          <div style={{ fontSize: 14, color: "var(--info)" }}>{error}</div>
        </div>
      </div>
    );
  }

  const vehicleInfo = job?.vehicle;
  const customerInfo = job?.customer;

  return (
    <VhcCustomerView
      jobNumber={jobNumber}
      vehicleInfo={vehicleInfo}
      customerInfo={customerInfo}
      severityLists={displaySeverityLists}
      totals={displayTotals}
      photoFiles={photoFiles}
      videoFiles={videoFiles}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      interactive={false}
      onUpdateStatus={updateEntryStatus}
      updatingIds={updatingStatus}
      expiresAt={expiresAt}
    />
  );
}

// Bypass the global app shell: customers landing on this link should see only
// the VHC content — no staff topbar, sidebar, or job tracker.
CustomerLinkPage.getLayout = function publicLayout(page) {
  return page;
};
