"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
// Loaded on demand — 213 KB of @supabase/supabase-js.
//
// This is the only page customers ever see: they open it from a text-message
// link, usually on mobile data. The client is used for exactly one thing, the
// realtime channel below that mirrors staff edits into the open report — and
// that subscription is not needed to render the report, only to keep it fresh
// afterwards. Importing it statically put the whole client in front of first
// paint on the slowest-scoring route in the app.
//
// Deferring it into the effect keeps realtime behaviour identical (the channel
// still subscribes as soon as the job id is known) while taking the client off
// the critical path. Same pattern as useMessagesBadge.
import { subscribeWithDeferredClient } from "@/lib/database/realtimeClient";
import { summariseTechnicianVhc, parseVhcBuilderPayload } from "@/lib/vhc/summary";
import { DEFAULT_LABOUR_RATE_GBP } from "@/lib/vhc/shared";
import { buildVhcQuoteLinesModel } from "@/lib/vhc/quoteLines";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import VhcCustomerView from "@/components/VHC/VhcCustomerView";
// NOTE: this route deliberately does NOT call useWebsiteScope(). It is not a
// /website path, so _app.js puts `staff-scope` on <html> (and strips
// `website-scope` again in its own effect, which runs after this page's), and
// custglobal.css is never attached outside /website. The hook was therefore a
// no-op that only fought the scope the staff design system hangs off — the
// report renders through staffglobal.css + families/*.css like every other page.
// useWebsiteTheme() is kept: it drives the light/dark choice for the report and
// is independent of which stylesheet is scoped.
import useWebsiteTheme from "@/features/website/hooks/useWebsiteTheme";
import { logFailure } from "@/lib/utils/logFailure";

const LABOUR_RATE = DEFAULT_LABOUR_RATE_GBP;

// One mapping from the share-link payload to the shape this page renders.
//
// It is used twice — to seed state from the server-rendered report, and by the
// client refetch — so the two can never drift. Previously this lived inline in
// the fetch effect.
const toReportState = (payload) => {
  const { jobData } = payload || {};
  const {
    vhc_checks = [],
    parts_job_items = [],
    job_files = [],
    ...jobFields
  } = jobData || {};

  const checks = vhc_checks || [];
  const aliases = {};
  checks.forEach((check) => {
    if (check?.display_id && check?.vhc_id) {
      aliases[String(check.display_id)] = String(check.vhc_id);
    }
  });

  return {
    job: jobData ? jobFields : null,
    vhcChecks: checks,
    partsJobItems: parts_job_items || [],
    jobFiles: job_files || [],
    aliases,
  };
};

const EMPTY_REPORT_STATE = toReportState(null);

export function VhcLinkedCustomerPage({
  initialReport = null,
  // /customer/<code> has no job number in the URL — it resolves one server-side
  // from the (unique) share code and passes it in here, so every downstream
  // fetch and PATCH below keeps its existing job-number shape and this
  // component needs no other knowledge of which route it is serving.
  resolvedJobNumber = null,
  resolvedLinkCode = null,
}) {
  const router = useRouter();
  const jobNumber = resolvedJobNumber || router.query.jobNumber;
  const linkCode = resolvedLinkCode || router.query.linkCode;

  // Server-rendered report, when getServerSideProps resolved one. Seeding state
  // from it means the customer sees the report in the first paint instead of a
  // skeleton that waits for hydration and then a round trip.
  const seed = useMemo(
    () => (initialReport?.payload ? toReportState(initialReport.payload) : EMPTY_REPORT_STATE),
    [initialReport]
  );
  // True when the server already delivered a usable answer (report or error), so
  // the mount-time fetch below has nothing left to do.
  const hasServerAnswer = Boolean(initialReport?.payload || initialReport?.error);
  const skipInitialFetchRef = useRef(hasServerAnswer);
  useWebsiteTheme();

  const [job, setJob] = useState(seed.job);
  const [vhcChecksData, setVhcChecksData] = useState(seed.vhcChecks);
  const [partsJobItems, setPartsJobItems] = useState(seed.partsJobItems);
  const [jobFiles, setJobFiles] = useState(seed.jobFiles);
  const [vhcIdAliases, setVhcIdAliases] = useState(seed.aliases);
  const authorizedViewRows = useMemo(() => vhcChecksData.filter((row) =>
    row.approval_status === "authorized" || row.approval_status === "completed"
  ), [vhcChecksData]);

  const [loading, setLoading] = useState(!hasServerAnswer);
  const [error, setError] = useState(initialReport?.error || null);
  const [shareLabel, setShareLabel] = useState("Share");
  const [activeTab, setActiveTab] = useState("summary");
  const [updatingStatus, setUpdatingStatus] = useState(new Set());

  const refetchTimerRef = useRef(null);
  const validateAndFetchRef = useRef(null);

  // Single coalescing point for background reconciliation.
  //
  // Both the realtime channel and the customer's own decisions want to re-sync
  // from the server. Previously each decision fired an immediate full refetch
  // AND the channel fired another one 400ms later for the same write — two full
  // job payloads and two rebuilds of the quote model per tap. Routing both
  // through one debounce collapses a burst of decisions into a single refetch.
  const scheduleReconcile = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      validateAndFetchRef.current?.({ silent: true });
    }, 400);
  }, []);

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
        } catch {
          setError("Failed to load job data");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          if (response.status === 404) {
            setError("This link is invalid or the job was not found.");
          } else {
            // Surface either `error` or `message` so an auth/guard rejection
            // (which returns `message`) doesn't get masked behind the generic
            // fallback. See: GET on /api/job-cards/[jobNumber]/share-link must
            // remain public — if a future change re-wraps it in withRoleGuard
            // the response would otherwise show "Failed to load job data".
            setError(data?.error || data?.message || "Failed to load job data");
          }
          return;
        }

        const next = toReportState(data);
        setJob(next.job);
        setVhcChecksData(next.vhcChecks);
        setPartsJobItems(next.partsJobItems);
        setJobFiles(next.jobFiles);
        setVhcIdAliases(next.aliases);
      } catch (err) {
        logFailure("Error fetching job data:", err);
        if (!silent) setError("Failed to load job data. Please try again later.");
      } finally {
        if (!silent) setLoading(false);
      }
    };

    validateAndFetchRef.current = validateAndFetch;

    // The server already resolved this exact report for the initial HTML, so
    // refetching it on mount would just repeat the work the customer is already
    // looking at. Later refetches (realtime echoes, the customer's own
    // decisions) still go through validateAndFetchRef as before.
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }

    validateAndFetch();
  }, [jobNumber, linkCode]);

  // Live updates from staff edits — silent re-fetch on any change
  useEffect(() => {
    const jobId = job?.id;
    if (!jobId) return undefined;

    // Shared with the decision handler so a customer's own write and its
    // realtime echo collapse into one refetch rather than two.
    const scheduleRefetch = scheduleReconcile;

    const stopRealtime = subscribeWithDeferredClient((supabase) =>
      supabase
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
      .subscribe()
    );

    const poll = setInterval(scheduleRefetch, 15000);
    return () => {
      clearInterval(poll);
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      stopRealtime();
    };
  }, [job?.id, scheduleReconcile]);

  // All customer routes use the same quote model and current report data.

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
  // Memoised because `builderSummary.sections || []` produced a NEW array
  // identity on every render whenever sections was absent, which invalidated the
  // quoteViewModel memo below on every render — so the full quote model was
  // rebuilt for every keystroke, tab change and spinner tick on this page.
  const sections = useMemo(() => builderSummary.sections || [], [builderSummary]);

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
  // Stable identities: these are passed straight down to VhcCustomerView, and a
  // fresh object literal per render would defeat any memoisation there.
  const displaySeverityLists = useMemo(
    () =>
      quoteViewModel.severityLists || {
        red: [], amber: [], green: [], authorized: [], declined: []
      },
    [quoteViewModel]
  );
  const displayTotals = useMemo(
    () =>
      quoteViewModel.totals || {
        red: 0, amber: 0, green: 0, authorized: 0, declined: 0
      },
    [quoteViewModel]
  );

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

      // TRUE optimistic update.
      //
      // This previously awaited the PATCH and then triggered a FULL refetch of
      // the job before the customer saw anything change, so one tap on
      // Authorise/Decline cost a round trip, a second round trip, and a re-render
      // of the whole view before the next paint. That is the interaction this
      // route's INP is made of.
      //
      // The same fields the server writes are applied locally first (see
      // /api/vhc/share-update-item-status), so the row flips immediately. The
      // request still goes out, the realtime channel still reconciles, and any
      // failure restores the previous rows exactly.
      const nextStatus = newStatus || "pending";
      const targetId = String(itemId);
      const previousChecks = vhcChecksData;
      const rollback = () => {
        setVhcChecksData((rows) => rows.map((row) => String(row.vhc_id) === targetId
          ? previousChecks.find((previous) => String(previous.vhc_id) === targetId) || row : row));
        scheduleReconcile();
      };

      const applyLocalDecision = (rows) =>
        (rows || []).map((row) => {
          if (String(row?.vhc_id) !== targetId) return row;
          const decided = nextStatus === "authorized" || nextStatus === "declined";
          return {
            ...row,
            approval_status: nextStatus,
            authorization_state: nextStatus,
            display_status: decided ? nextStatus : row.severity || null,
            approved_at: decided ? new Date().toISOString() : null,
            approved_by: decided ? "customer" : null,
          };
        });

      setVhcChecksData(applyLocalDecision);
      setUpdatingStatus((prev) => new Set(prev).add(itemId));

      try {
        const response = await fetch("/api/vhc/share-update-item-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobNumber,
            linkCode,
            vhcItemId: itemId,
            approvalStatus: nextStatus
          })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          rollback(); // restore exactly what was there before the tap
          alert(body?.message || "Could not update — please refresh and try again.");
        } else {
          // Reconcile in the background, coalesced with the realtime echo of
          // this same write, so one tap costs one refetch rather than two. The
          // optimistic state is already on screen either way.
          scheduleReconcile();
        }
      } catch (err) {
        logFailure("Customer update failed:", err);
        rollback();
        alert("Could not update — please check your connection and try again.");
      } finally {
        setUpdatingStatus((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [jobNumber, linkCode, vhcChecksData, scheduleReconcile]
  );

  const shareReport = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Vehicle Health Check", url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setShareLabel("Link copied");
      }
    } catch (error) {
      if (error.name !== "AbortError") setShareLabel("Copy the address to share");
    }
  };

  // Tag the document body while mounted so external widgets (floating notes)
  // can detect this page.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.add("vhc-customer-link-page");
    return () => {
      document.body.classList.remove("vhc-share-link-page");
      document.body.classList.remove("vhc-customer-link-page");
    };
  }, []);

  if (loading) {
    return (
      <div className="vhc-customer-page vhc-customer-page--loading">
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
      <div className="vhc-customer-page vhc-customer-page--error">
        <div className="app-empty-state app-empty-state--page">
          <div className="app-empty-state__copy">
            <p className="app-empty-state__title">Unable to load report</p>
            <p className="app-empty-state__description">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const vehicleInfo = job?.vehicle;
  const customerInfo = job?.customer;

  return (
    <div className="vhc-customer-page">
      <Head><title>Vehicle Health Check</title><meta name="robots" content="noindex, nofollow" /><meta name="referrer" content="no-referrer" /></Head>
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
        interactive={true}
        onUpdateStatus={updateEntryStatus}
        updatingIds={updatingStatus}
        onShare={shareReport}
        shareLabel={shareLabel}
      />
    </div>
  );
}


export default VhcLinkedCustomerPage;
