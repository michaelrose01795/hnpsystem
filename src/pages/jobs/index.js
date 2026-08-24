// file location: src/pages/jobs/index.js
// ✅ Imports converted to use absolute alias "@/"
// Edit: Responsive improvements - optimized mobile/tablet layout with better stacking, reduced padding, and improved grid templates
"use client"; // enables client-side rendering for Next.js

import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from "react"; // import React and hooks
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useNextAction } from "@/context/NextActionContext"; // import next action context
import { useRouter } from "next/router"; // for navigation
// The jobs list no longer imports getAllJobs: it fetches the narrow, bounded
// workload through /api/jobs/workload so the query runs server-side and the
// query module stays out of this page's client bundle.
import { subscribeToJobsOverviewChanges, updateJobStatus } from "@/lib/database/jobs";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { useUser } from "@/context/UserContext";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { deriveJobTypeDisplay, formatDetectedJobTypeLabel } from "@/lib/jobType/display";
import { revalidateAllJobs } from "@/lib/swr/mutations"; // SWR cache invalidation after mutations
import { prefetchJob } from "@/lib/swr/prefetch"; // warm SWR cache on hover for instant navigation
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { FilterToolbarRow, PageShell, SectionShell } from "@/components/ui";
import ViewJobCardsUi from "@/components/page-ui/job-cards/view/job-cards-view-ui"; // Extracted presentation layer.
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerSurface from "@/components/ui/LayerSurface";
import { reportError } from "@/lib/notifications/report"; // Phase 3 reporting helper (Phase 10 migration).
import { buildJobOperationalStatusCounts, buildJobRowSummary, buildTechnicianWorkloadMap, findNextJobsTechnician } from "@/lib/jobCards/jobRowSummary";
import { createJobNote, getNotesByJob } from "@/lib/database/notes";
import { getMotTesterUsers, getTechnicianUsers } from "@/lib/database/users";
import { invalidateCache } from "@/lib/database/queryCache";

const TODAY_STATUSES = ["Booked", "Checked In", "In Progress", "Invoiced", "Released"];

const CARRY_OVER_STATUSES = ["Booked", "Checked In", "In Progress", "Invoiced", "Released"];
const JOBS_PAGE_CACHE_KEY = "jobs:all:jobs-page";
// Coalescing window for realtime events that cannot be attributed to a single
// job. Wider than the previous 150ms because a busy workshop produces bursts
// (every clock-on writes job_clocking) and each expiry costs a workload fetch.
const JOBS_REALTIME_REFRESH_DELAY_MS = 600;
const JOBS_FETCH_RETRY_DELAYS = [250, 750];

const waitForRetry = (delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs));

/* ================================
   Utility function: today's date
================================ */
const getTodayDate = () => {
  const today = new Date(); // get current date
  const yyyy = today.getFullYear(); // get year
  const mm = String(today.getMonth() + 1).padStart(2, "0"); // get month with leading zero
  const dd = String(today.getDate()).padStart(2, "0"); // get day with leading zero
  return `${yyyy}-${mm}-${dd}`; // return formatted date
};

const BASE_STATUS_OPTIONS = {
  today: TODAY_STATUSES,
  carryOver: CARRY_OVER_STATUSES,
  orders: []
};

const buildStatusOptions = (jobs, baseStatuses) => {
  const statusSet = new Set(baseStatuses);
  jobs.forEach((job) => {
    const label = job?.status || "Unknown";
    statusSet.add(label);
  });
  return Array.from(statusSet);
};

const normalizeString = (value) =>
typeof value === "string" ? value.trim().toLowerCase() : "";

const formatCustomerStatusLabel = (value) => {
  if (!value) return "Neither";
  const normalized = normalizeString(value);
  if (normalized.includes("loan")) return "Loan Car";
  if (normalized.includes("collect")) return "Collection";
  if (normalized.includes("wait")) return "Waiting";
  return value;
};

const getJobDate = (job) => {
  if (job?.appointment?.date) return job.appointment.date;
  if (job?.createdAt) return job.createdAt.substring(0, 10);
  return null;
};

const deriveJobType = (job) => deriveJobTypeDisplay(job, { includeExtraCount: true });

const getStatusCounts = (jobs = []) => {
  return jobs.reduce((acc, job) => {
    const key = job.status || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
};

const getJobStatusBadgeTone = (status) => {
  const normalized = normalizeString(status);
  if (normalized.includes("released") || normalized.includes("complete") || normalized.includes("invoiced")) return "app-badge--success";
  if (normalized.includes("progress") || normalized.includes("checked")) return "app-badge--accent-soft";
  if (normalized.includes("waiting") || normalized.includes("hold") || normalized.includes("pending")) return "app-badge--warning";
  if (normalized.includes("cancel") || normalized.includes("failed")) return "app-badge--danger";
  return "app-badge--neutral";
};

const matchesSearchTerm = (job, value) => {
  if (!value) return true;
  const haystack = [
  job.jobNumber,
  job.reg,
  job.customer,
  job.makeModel,
  job.waitingStatus].

  filter(Boolean).
  map((entry) => entry.toLowerCase());
  return haystack.some((entry) => entry.includes(value));
};
const popupPrimaryActionButtonStyle = {
  flex: 1,
  padding: "12px 20px",
  backgroundColor: "var(--accent-purple)",
  color: "var(--text-2)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease"
};

const popupSecondaryActionButtonStyle = {
  ...popupPrimaryActionButtonStyle,
  backgroundColor: "var(--theme)",
  color: "var(--accent-purple)"
};

const popupQuietActionButtonStyle = {
  width: "100%",
  marginTop: "16px",
  padding: "12px 20px",
  backgroundColor: "var(--surface)",
  color: "var(--accent-purple)",
  border: "1px solid var(--ghostbutton-ring-color)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease"
};

/* ================================
   Main component: ViewJobCards
================================ */
export default function ViewJobCards() {
  const [jobs, setJobs] = useState([]); // store all jobs
  const [orders, setOrders] = useState([]); // store parts orders
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [popupJob, setPopupJob] = useState(null); // store selected job for popup
  const [popupSnapshot, setPopupSnapshot] = useState(null);
  const [quickNoteJob, setQuickNoteJob] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [quickNoteHidden, setQuickNoteHidden] = useState(true);
  const [quickNoteNotes, setQuickNoteNotes] = useState([]);
  const [quickNoteLoading, setQuickNoteLoading] = useState(false);
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);
  const [quickNoteError, setQuickNoteError] = useState("");
  const [nextJobsTechnicians, setNextJobsTechnicians] = useState([]);
  const [searchValues, setSearchValues] = useState({
    today: "",
    carryOver: "",
    orders: ""
  });
  const [activeStatusFilters, setActiveStatusFilters] = useState({
    today: "All",
    carryOver: "All",
    orders: "All"
  });
  const [activeTab, setActiveTab] = useState("today"); // track active tab
  const [loading, setLoading] = useState(true); // loading state
  const [jobsLoadError, setJobsLoadError] = useState("");
  const [operationalNow, setOperationalNow] = useState(() => new Date());
  const jobsRealtimeRefreshRef = useRef(null);
  const router = useRouter(); // router for navigation
  const divisionParam = router.query?.division;
  useEffect(() => {
    if (!router.isReady || !divisionParam) {
      return;
    }
    const nextQuery = { ...router.query };
    delete nextQuery.division;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true
    });
  }, [divisionParam, router]);
  useEffect(() => {
    if (!popupJob?.id) {
      setPopupSnapshot(null);
      return;
    }
    let isActive = true;
    const loadSnapshot = async () => {
      try {
        const response = await fetch(`/api/status/snapshot?jobId=${popupJob.id}`);
        const payload = await response.json();
        if (!isActive) return;
        if (payload?.success && payload?.snapshot) {
          setPopupSnapshot(payload.snapshot);
        }
      } catch (snapshotError) {
        if (!isActive) return;
        console.error("Failed to load status snapshot:", snapshotError);
      }
    };
    loadSnapshot();
    return () => {
      isActive = false;
    };
  }, [popupJob?.id]);
  const [divisionFilter, setDivisionFilter] = useState("All"); // Retail vs Sales filter
  const { triggerNextAction } = useNextAction(); // next action dispatcher
  const { user, dbUserId } = useUser();
  const today = getTodayDate(); // get today's date

  const userRoles = useMemo(() => {
    if (!user?.roles) return [];
    return user.roles.
    map((role) =>
    typeof role === "string" ? role.trim().toLowerCase() : ""
    ).
    filter(Boolean);
  }, [user]);
  const canViewOrdersTab = useMemo(
    () => userRoles.some((role) => role === "parts" || role === "parts manager"),
    [userRoles]
  );

  /* ----------------------------
     Fetch jobs from Supabase
  ---------------------------- */
  const fetchJobs = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true); // show loading state
    setJobsLoadError("");
    let lastError = null;

    for (let attempt = 0; attempt <= JOBS_FETCH_RETRY_DELAYS.length; attempt += 1) {
      try {
        // Server-owned narrow workload query (see pages/api/jobs/workload.js).
        // This replaced a direct browser-to-PostgREST getAllJobs() call that
        // selected every job ever created with 14 nested relations.
        const response = await fetch(`/api/jobs/workload${showLoading ? "" : "?fresh=1"}`, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Jobs workload request failed (HTTP ${response.status})`);
        }
        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Jobs workload request failed");
        }
        const jobsFromSupabase = Array.isArray(payload.data) ? payload.data : [];

        // A successful empty result can briefly occur while the browser session
        // is settling after a hard reload. Confirm it before rendering an empty state.
        if (jobsFromSupabase.length === 0 && attempt < JOBS_FETCH_RETRY_DELAYS.length) {
          invalidateCache(JOBS_PAGE_CACHE_KEY);
          await waitForRetry(JOBS_FETCH_RETRY_DELAYS[attempt]);
          continue;
        }

        console.log("Fetched jobs:", jobsFromSupabase); // debug log
        setJobs(jobsFromSupabase); // update state
        setPopupJob((currentJob) => currentJob
          ? jobsFromSupabase.find((job) => job.id === currentJob.id) || currentJob
          : null);
        setQuickNoteJob((currentJob) => currentJob
          ? jobsFromSupabase.find((job) => job.id === currentJob.id) || currentJob
          : null);
        setLoading(false); // hide loading state
        return;
      } catch (fetchError) {
        lastError = fetchError;
        invalidateCache(JOBS_PAGE_CACHE_KEY);
        if (attempt < JOBS_FETCH_RETRY_DELAYS.length) {
          await waitForRetry(JOBS_FETCH_RETRY_DELAYS[attempt]);
        }
      }
    }

    console.error("Failed to load jobs after retrying", lastError);
    setJobsLoadError("Jobs could not be loaded. Please refresh and try again.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchJobs(); // fetch jobs on component mount
  }, [fetchJobs]);

  const fetchNextJobsRoster = useCallback(async () => {
    try {
      const [technicians, motTesters] = await Promise.all([
        getTechnicianUsers(),
        getMotTesterUsers(),
      ]);
      setNextJobsTechnicians([
        ...(Array.isArray(technicians) ? technicians : []),
        ...(Array.isArray(motTesters) ? motTesters : []),
      ]);
    } catch (technicianError) {
      console.error("Failed to load the Next Jobs technician roster", technicianError);
      setNextJobsTechnicians([]);
    }
  }, []);

  useEffect(() => {
    void fetchNextJobsRoster();
  }, [fetchNextJobsRoster]);

  // Patch a single job in place. Used when a realtime event names the job that
  // changed, so a status flip or a clock-on no longer re-downloads the whole
  // workload — previously ANY event on 13 tables (job_clocking fires every time
  // a technician clocks on or off) triggered a full refetch 150ms later.
  const patchJobRow = useCallback(async (jobId) => {
    try {
      const response = await fetch(`/api/jobs/workload?jobId=${encodeURIComponent(jobId)}`, {
        credentials: "include",
      });
      if (!response.ok) return false;
      const payload = await response.json();
      if (!payload?.success) return false;
      const updated = payload.data;
      if (!updated) {
        // Row is gone (deleted / archived out of the workload) — drop it.
        setJobs((current) => current.filter((job) => String(job.id) !== String(jobId)));
        return true;
      }
      setJobs((current) => {
        const index = current.findIndex((job) => String(job.id) === String(updated.id));
        if (index === -1) return current; // Not in the current page of results.
        const next = current.slice();
        next[index] = updated;
        return next;
      });
      setPopupJob((current) =>
        current && String(current.id) === String(updated.id) ? updated : current
      );
      setQuickNoteJob((current) =>
        current && String(current.id) === String(updated.id) ? updated : current
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToJobsOverviewChanges("jobs-page", (payload, table) => {
      if (table === "users") void fetchNextJobsRoster();
      if (table === "job_notes" && quickNoteJob?.id) {
        void getNotesByJob(quickNoteJob.id).then((notes) => {
          setQuickNoteNotes(Array.isArray(notes) ? notes : []);
        });
      }

      // Fast path: the event carries a job id, so refresh just that row.
      const row = payload?.new || payload?.old || null;
      const jobId = table === "jobs" ? row?.id : row?.job_id;
      if (jobId) {
        void patchJobRow(jobId).then((patched) => {
          if (patched) return;
          // Row wasn't in view (or the patch failed) — fall back to a coalesced
          // full refresh.
          if (jobsRealtimeRefreshRef.current) window.clearTimeout(jobsRealtimeRefreshRef.current);
          jobsRealtimeRefreshRef.current = window.setTimeout(() => {
            void fetchJobs({ showLoading: false });
          }, JOBS_REALTIME_REFRESH_DELAY_MS);
        });
        return;
      }

      // Slow path: an event we cannot attribute to one job. Coalesce hard — a
      // burst of these used to produce a full workload download every 150ms.
      if (jobsRealtimeRefreshRef.current) window.clearTimeout(jobsRealtimeRefreshRef.current);
      jobsRealtimeRefreshRef.current = window.setTimeout(() => {
        void fetchJobs({ showLoading: false });
      }, JOBS_REALTIME_REFRESH_DELAY_MS);
    });

    return () => {
      unsubscribe();
      if (jobsRealtimeRefreshRef.current) window.clearTimeout(jobsRealtimeRefreshRef.current);
    };
  }, [fetchJobs, fetchNextJobsRoster, patchJobRow, quickNoteJob?.id]);

  useEffect(() => {
    if (!quickNoteJob?.id) {
      setQuickNoteNotes([]);
      return;
    }

    let isActive = true;
    setQuickNoteLoading(true);
    setQuickNoteError("");
    getNotesByJob(quickNoteJob.id)
      .then((notes) => {
        if (isActive) setQuickNoteNotes(Array.isArray(notes) ? notes : []);
      })
      .catch((noteError) => {
        if (!isActive) return;
        console.error("Failed to load quick-note context", noteError);
        setQuickNoteError("Existing notes could not be loaded.");
      })
      .finally(() => {
        if (isActive) setQuickNoteLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [quickNoteJob?.id]);

  const openQuickNote = useCallback((job) => {
    setQuickNoteJob(job);
    setQuickNoteText("");
    setQuickNoteHidden(true);
    setQuickNoteError("");
  }, []);

  const closeQuickNote = useCallback(() => {
    if (quickNoteSaving) return;
    setQuickNoteJob(null);
    setQuickNoteText("");
    setQuickNoteError("");
  }, [quickNoteSaving]);

  const saveQuickNote = useCallback(async () => {
    const noteText = quickNoteText.trim();
    if (!quickNoteJob?.id || !noteText || quickNoteSaving) return;

    setQuickNoteSaving(true);
    setQuickNoteError("");
    try {
      const result = await createJobNote({
        job_id: quickNoteJob.id,
        user_id: dbUserId || null,
        note_text: noteText,
        hidden_from_customer: quickNoteHidden,
      });
      if (!result?.success) throw new Error(result?.error?.message || "Failed to save note");

      setJobs((currentJobs) => currentJobs.map((job) => (
        job.id === quickNoteJob.id
          ? { ...job, notes: [...(Array.isArray(job.notes) ? job.notes : []), result.data] }
          : job
      )));
      await revalidateAllJobs();
      setQuickNoteJob(null);
      setQuickNoteText("");
      setQuickNoteHidden(true);
    } catch (noteError) {
      console.error("Failed to save quick note", noteError);
      setQuickNoteError(noteError?.message || "Failed to save note.");
    } finally {
      setQuickNoteSaving(false);
    }
  }, [dbUserId, quickNoteHidden, quickNoteJob, quickNoteSaving, quickNoteText]);

  useEffect(() => {
    const timer = window.setInterval(() => setOperationalNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await fetch("/api/parts/orders");
      if (!response.ok) {
        throw new Error("Failed to load orders");
      }
      const payload = await response.json();
      setOrders(payload?.orders || []);
    } catch (orderError) {
      console.error("Failed to fetch parts orders", orderError);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canViewOrdersTab) {
      setOrders([]);
      return;
    }
    fetchOrders();
  }, [canViewOrdersTab, fetchOrders]);

  /* ----------------------------
     Go to job card page
  ---------------------------- */
  const goToJobCard = (jobNumber) => {
    prefetchJob(jobNumber); // warm SWR cache for instant load
    router.push(`/job-cards/${jobNumber}`); // navigate to job card detail page
  };

  /* ----------------------------
     Update job status in Supabase
  ---------------------------- */
  const resolveNextActionType = (status) => {
    if (!status) return null;
    const normalized = String(status).toLowerCase();
    if (normalized.includes('vhc')) return 'vhc_complete';
    if (normalized.includes('complete') || normalized.includes('being washed')) return 'job_complete';
    return null;
  };

  const handleStatusChange = async (jobId, newStatus) => {
    const result = await updateJobStatus(jobId, newStatus, dbUserId || null); // update status in database
    if (result?.success && result.data) {
      fetchJobs(); // refresh jobs list after update
      revalidateAllJobs(); // sync status change to other pages via SWR
      if (popupJob && popupJob.id === jobId) {
        setPopupJob({ ...popupJob, status: result.data.status }); // update popup if open
      }

      const actionType = resolveNextActionType(result.data.status);
      if (actionType) {
        const updatedJob = jobs.find((job) => job.id === jobId) || popupJob;
        if (updatedJob) {
          triggerNextAction(actionType, {
            jobId,
            jobNumber: updatedJob.jobNumber || updatedJob.job_number || "",
            vehicleId: updatedJob.vehicleId || updatedJob.vehicle_id || null,
            vehicleReg: updatedJob.reg || updatedJob.vehicleReg || updatedJob.vehicle_reg || "",
            triggeredBy: null
          });
        }
      }
    } else {
      reportError("Couldn't update the job status. Please try again."); // friendly toast + reference code
    }
  };

  const normalizedDivisionFilter =
  divisionFilter !== "All" ? divisionFilter.toLowerCase() : null;

  const divisionFilteredJobs = useMemo(
    () =>
    normalizedDivisionFilter ?
    jobs.filter(
      (job) =>
      (job.jobDivision || "Retail").toLowerCase() ===
      normalizedDivisionFilter
    ) :
    jobs,
    [jobs, normalizedDivisionFilter]
  );

  const technicianLoads = useMemo(
    () => buildTechnicianWorkloadMap(jobs, nextJobsTechnicians),
    [jobs, nextJobsTechnicians]
  );

  const handleDivisionFilterChange = useCallback(
    (nextValue) => {
      if (!nextValue || nextValue === divisionFilter) return;
      setDivisionFilter(nextValue);
    },
    [divisionFilter]
  );

  const jobDateLookup = useMemo(
    () =>
    divisionFilteredJobs.reduce((acc, job) => {
      acc[job.id] = getJobDate(job);
      return acc;
    }, {}),
    [divisionFilteredJobs]
  );

  const todayJobs = useMemo(
    () =>
    divisionFilteredJobs.filter((job) => {
      const jobDate = jobDateLookup[job.id];
      return jobDate === today;
    }),
    [divisionFilteredJobs, today, jobDateLookup]
  );

  const carryOverJobs = useMemo(
    () =>
    divisionFilteredJobs.filter((job) => {
      const jobDate = jobDateLookup[job.id];
      return jobDate !== today;
    }),
    [divisionFilteredJobs, today, jobDateLookup]
  );

  const normalizedOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.
    map((order) => {
      const makeModel = [order.vehicle_make, order.vehicle_model].
      filter(Boolean).
      join(" ").
      trim();
      const appointment = order.delivery_eta ?
      {
        date: order.delivery_eta,
        time: order.delivery_window || ""
      } :
      null;
      const fallbackCustomer =
      order.customer_name ||
      order.delivery_contact ||
      order.customer_email ||
      "Parts order customer";
      const normalizedNumber = (order.order_number || "").trim().toUpperCase();

      return {
        ...order,
        orderNumber: normalizedNumber,
        reg: order.vehicle_reg || "",
        customer: fallbackCustomer,
        makeModel: makeModel || order.vehicle_make || order.vehicle_model || "",
        waitingStatus:
        order.delivery_status || order.delivery_type || order.status || "Order",
        appointment,
        createdAt: order.created_at,
        requests: order.items || []
      };
    }).
    filter((order) => Boolean(order.orderNumber) && order.orderNumber.startsWith("P"));
  }, [orders]);

  const orderJobs = normalizedOrders;

  const todayStatusCounts = useMemo(
    () => getStatusCounts(todayJobs),
    [todayJobs]
  );
  const carryStatusCounts = useMemo(
    () => getStatusCounts(carryOverJobs),
    [carryOverJobs]
  );
  const orderStatusCounts = useMemo(
    () => getStatusCounts(orderJobs),
    [orderJobs]
  );

  const handleSearchValueChange = (tab, value) => {
    setSearchValues((prev) => ({ ...prev, [tab]: value }));
  };

  const handleStatusFilterChange = (tab, status) => {
    setActiveStatusFilters((prev) => ({
      ...prev,
      [tab]: status
    }));
  };

  useEffect(() => {
    if (activeTab === "orders" && !canViewOrdersTab) {
      setActiveTab("today");
    }
  }, [activeTab, canViewOrdersTab]);

  const isOrdersTab = activeTab === "orders" && canViewOrdersTab;
  const baseJobs =
  activeTab === "today" ?
  todayJobs :
  activeTab === "carryOver" ?
  carryOverJobs :
  orderJobs;
  const operationalStatusCounts = useMemo(
    () => buildJobOperationalStatusCounts(isOrdersTab ? [] : baseJobs, { now: operationalNow }),
    [baseJobs, isOrdersTab, operationalNow]
  );
  const statusOptionsMap = useMemo(
    () => ({
      today: buildStatusOptions(todayJobs, BASE_STATUS_OPTIONS.today),
      carryOver: buildStatusOptions(carryOverJobs, BASE_STATUS_OPTIONS.carryOver),
      orders: buildStatusOptions(orderJobs, BASE_STATUS_OPTIONS.orders)
    }),
    [todayJobs, carryOverJobs, orderJobs]
  );
  const statusOptions = statusOptionsMap[activeTab] || [];
  const statusTabs = ["All", ...statusOptions];
  const statusCounts =
  activeTab === "today" ?
  todayStatusCounts :
  activeTab === "carryOver" ?
  carryStatusCounts :
  orderStatusCounts;
  const activeStatusFilter = activeStatusFilters[activeTab];
  const immediateSearchValue = searchValues[activeTab]?.trim().toLowerCase() || "";
  const searchValue = useDeferredValue(immediateSearchValue);
  const searchPlaceholder = isOrdersTab ? "Search orders..." : "Search jobs...";
  const emptyStateMessage = jobsLoadError && jobs.length === 0 ?
  jobsLoadError :
  searchValue ?
  isOrdersTab ?
  "No orders match your search." :
  "No jobs match your search." :
  isOrdersTab ?
  "No orders available." :
  "No jobs in this status group.";
  const tabOptions = useMemo(() => {
    const baseTabs = [
    { value: "today", label: "Today's workload" },
    { value: "carryOver", label: "Carry over" }];

    if (canViewOrdersTab) {
      baseTabs.push({ value: "orders", label: "Orders" });
    }
    return baseTabs;
  }, [canViewOrdersTab]);

  const sortedJobs = useMemo(() => {
    // Orders ignore the job-status filter. Defer search-driven filtering so
    // typing stays responsive even when a large operational list is mounted.
    const filteredByStatus = isOrdersTab || activeStatusFilter === "All"
      ? baseJobs
      : baseJobs.filter((job) => (job.status || "Unknown") === activeStatusFilter);
    const filteredJobs = searchValue
      ? filteredByStatus.filter((job) => matchesSearchTerm(job, searchValue))
      : filteredByStatus;
    const getSortValue = (job) => {
      if (job?.appointment?.date && job?.appointment?.time) {
        return new Date(`${job.appointment.date}T${job.appointment.time}`);
      }
      if (job?.appointment?.date) return new Date(`${job.appointment.date}T00:00:00`);
      if (job?.createdAt) return new Date(job.createdAt);
      return new Date(0);
    };

    return filteredJobs.slice().sort((a, b) => (
      isOrdersTab ? getSortValue(a) - getSortValue(b) : getSortValue(b) - getSortValue(a)
    ));
  }, [activeStatusFilter, baseJobs, isOrdersTab, searchValue]);

  const popupStatusLabel = useMemo(() => {
    if (!popupJob) return "";
    const snapshotStatus = popupSnapshot?.job?.status || null;
    const snapshotLabel = popupSnapshot?.job?.statusLabel || null;
    if (snapshotLabel && (popupJob.status === snapshotStatus || popupJob.status === snapshotLabel)) {
      return snapshotLabel;
    }
    return popupJob.status || snapshotLabel || "";
  }, [popupJob, popupSnapshot]);

  const combinedStatusOptions = useMemo(() => {
    const union = new Set([...TODAY_STATUSES, ...CARRY_OVER_STATUSES]);
    if (popupStatusLabel) {
      union.add(popupStatusLabel);
    }
    return Array.from(union);
  }, [popupStatusLabel]);

  const handleCardNavigation = (jobNumber) => {
    goToJobCard(jobNumber);
  };

  /* ================================
     Loading State
  ================================ */
  if (loading) {
    return <ViewJobCardsUi view="section1" PageSkeleton={PageSkeleton} />;
  }

  /* ================================
     Page Layout
  ================================ */
  return <ViewJobCardsUi view="section2" activeStatusFilter={activeStatusFilter} activeTab={activeTab} baseJobs={baseJobs} closeQuickNote={closeQuickNote} combinedStatusOptions={combinedStatusOptions} DevLayoutSection={DevLayoutSection} divisionFilter={divisionFilter} DropdownField={DropdownField} emptyStateMessage={emptyStateMessage} FilterToolbarRow={FilterToolbarRow} formatDetectedJobTypeLabel={formatDetectedJobTypeLabel} goToJobCard={goToJobCard} handleCardNavigation={handleCardNavigation} handleDivisionFilterChange={handleDivisionFilterChange} handleSearchValueChange={handleSearchValueChange} handleStatusChange={handleStatusChange} handleStatusFilterChange={handleStatusFilterChange} isOrdersTab={isOrdersTab} JobListCard={JobListCard} nextJobsTechnicians={nextJobsTechnicians} onOpenQuickNote={openQuickNote} OrderListCard={OrderListCard} operationalNow={operationalNow} operationalStatusCounts={operationalStatusCounts} ordersLoading={ordersLoading} PageShell={PageShell} popupCardStyles={popupCardStyles} popupJob={popupJob} popupOverlayStyles={popupOverlayStyles} popupPrimaryActionButtonStyle={popupPrimaryActionButtonStyle} popupQuietActionButtonStyle={popupQuietActionButtonStyle} popupSecondaryActionButtonStyle={popupSecondaryActionButtonStyle} popupStatusLabel={popupStatusLabel} prefetchJob={prefetchJob} quickNoteError={quickNoteError} quickNoteHidden={quickNoteHidden} quickNoteJob={quickNoteJob} quickNoteLoading={quickNoteLoading} quickNoteNotes={quickNoteNotes} quickNoteSaving={quickNoteSaving} quickNoteText={quickNoteText} router={router} saveQuickNote={saveQuickNote} SearchBar={SearchBar} searchPlaceholder={searchPlaceholder} searchValues={searchValues} SectionShell={SectionShell} setActiveTab={setActiveTab} setPopupJob={setPopupJob} setQuickNoteHidden={setQuickNoteHidden} setQuickNoteText={setQuickNoteText} sortedJobs={sortedJobs} statusCounts={statusCounts} statusTabs={statusTabs} TabGroup={TabGroup} tabOptions={tabOptions} technicianLoads={technicianLoads} />;































































































































































































































































































































































































































































































































































































































































































































}

const operationalBadgeTone = (tone) => ({
  accent: "app-badge--accent-soft",
  danger: "app-badge--danger",
  success: "app-badge--success",
  warning: "app-badge--warning",
}[tone] || "app-badge--neutral");

const JobListCard = ({ job, onNavigate, onMouseEnter, onOpenQuickNote, sectionKey, parentKey, now, technicianLoads, nextJobsTechnicians }) => {
  const jobType = deriveJobType(job);
  const waitingLabel = formatCustomerStatusLabel(job.waitingStatus);
  const nextJobsTechnician = findNextJobsTechnician(job, nextJobsTechnicians);
  const nextJobsTechnicianId = nextJobsTechnician?.id ?? nextJobsTechnician?.user_id;
  const technicianLoad = nextJobsTechnicianId !== null && nextJobsTechnicianId !== undefined
    ? technicianLoads?.[String(nextJobsTechnicianId)] || null
    : null;
  const assignedTechName = nextJobsTechnician?.name || nextJobsTechnician?.displayName || nextJobsTechnician?.fullName || "";
  const summary = buildJobRowSummary(job, { now, technicianLoad });
  const runAction = (event, action) => {
    event.stopPropagation();
    action();
  };

  return (
    <DevLayoutSection
      as="article"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="list-row"
      className="app-job-operations-row-shell"
      onMouseEnter={onMouseEnter}>

      <LayerSurface
        className={`app-job-operations-row${summary.signals.some((signal) => signal.tone === "danger") ? " is-overdue" : summary.signals.length ? " needs-attention" : ""}`}
        radius="var(--radius-sm)"
        padding="0"
        gap="0"
        data-dev-disable-fallback="1">

      <DevLayoutSection
        sectionKey={`${sectionKey}-summary`}
        parentKey={sectionKey}
        sectionType="section-shell"
        backgroundToken="transparent"
        className="app-job-operations-row__board"
        role="group"
        aria-label={`Job ${job.jobNumber || "workshop row"} summary`}
        data-dev-text-preview={`Job ${job.jobNumber || "workshop row"} appointment customer status technician VHC parts actions`}>
        <section className="app-job-operations-row__column app-job-operations-row__column--appointment">
          <span className="app-job-operations-row__label">Appointment</span>
          {summary.appointmentTime && <time className="app-job-operations-row__time-value">{summary.appointmentTime}</time>}
          {summary.appointmentDate && <span className="app-job-operations-row__time-date">{summary.appointmentDate}</span>}
          {summary.scheduleLabel && <strong className={`app-job-operations-row__elapsed${summary.scheduleState === "overdue" ? " is-overdue" : ""}`}>{summary.scheduleLabel}</strong>}
          {summary.presenceLabel && <strong className="app-job-operations-row__elapsed">{summary.presenceLabel}</strong>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--job">
          <span className="app-job-operations-row__label">Job</span>
          <div className="app-job-operations-row__job-number">
            {job.jobNumber && <span>{job.jobNumber}</span>}
            {job.primeJobNumber && <span className="app-badge app-badge--neutral" title={job.isPrimeJob ? "Prime job" : `Sub-job of ${job.primeJobNumber}`}>
              {job.isPrimeJob ? "Prime" : `Sub-job · ${job.primeJobNumber}`}
            </span>}
          </div>
          {job.reg && <strong className="app-job-operations-row__registration">{job.reg}</strong>}
          {job.makeModel && <span className="app-job-operations-row__vehicle-model">{job.makeModel}</span>}
          {jobType && <span className="app-job-operations-row__muted">{jobType}</span>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--customer">
          <span className="app-job-operations-row__label">Customer</span>
          {job.customer && <strong className="app-job-operations-row__value">{job.customer}</strong>}
          {job.customerPhone && <span className="app-job-operations-row__muted">{job.customerPhone}</span>}
          {job.customerEmail && <span className="app-job-operations-row__muted app-job-operations-row__customer-email" title={job.customerEmail}>{job.customerEmail}</span>}
          {job.customerPostcode && <span className="app-job-operations-row__muted">{job.customerPostcode}</span>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--status">
          <span className="app-job-operations-row__label">Status</span>
          <div className="app-job-operations-row__badge-line">
            {job.status && <span className={`app-badge ${getJobStatusBadgeTone(job.status)}`}>{job.status}</span>}
            {waitingLabel && waitingLabel !== "Neither" && <span className="app-badge app-badge--accent-soft">{waitingLabel}</span>}
          </div>
          {summary.statusDuration && <span className="app-job-operations-row__muted">{summary.statusDuration}</span>}
          {summary.signals.length > 0 && <div className="app-job-operations-row__signals" aria-label="Job attention indicators">
            {summary.signals.map((signal) => <span key={signal.label} className={`app-badge ${operationalBadgeTone(signal.tone)}`}>{signal.label}</span>)}
          </div>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--technician">
          <span className="app-job-operations-row__label">Technician</span>
          {assignedTechName ? <strong className="app-job-operations-row__value">{assignedTechName}</strong> : <span className="app-badge app-badge--neutral">No tech</span>}
          {summary.technicianLoad && <span className="app-job-operations-row__muted">{summary.technicianLoad}</span>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--vhc">
          <span className="app-job-operations-row__label">VHC</span>
          {summary.vhc && <span className={`app-badge ${operationalBadgeTone(summary.vhc.tone)}`}>{summary.vhc.label}</span>}
          {summary.vhc?.detail && <span className="app-job-operations-row__muted">{summary.vhc.detail}</span>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--parts">
          <span className="app-job-operations-row__label">Parts</span>
          {summary.parts && <span className={`app-badge app-job-operations-row__parts-status ${operationalBadgeTone(summary.parts.tone)}`}>{summary.parts.label}</span>}
          {summary.parts?.detail && <span className="app-job-operations-row__muted">{summary.parts.detail}</span>}
        </section>

        <section className="app-job-operations-row__column app-job-operations-row__column--actions">
          <span className="app-job-operations-row__label">Actions</span>
          <div className="app-job-operations-row__action-stack">
            <button type="button" className="app-btn app-btn--primary app-btn--sm" onClick={(event) => runAction(event, onNavigate)}>
              Open job
            </button>
            <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={(event) => runAction(event, () => onOpenQuickNote(job))}>
              Quick note
            </button>
          </div>
        </section>
      </DevLayoutSection>

      {summary.requests.length > 0 && <DevLayoutSection
        sectionKey={`${sectionKey}-customer-requests`}
        parentKey={sectionKey}
        sectionType="section-shell"
        backgroundToken="transparent"
        className="app-job-operations-row__lower"
        data-dev-text-preview={`${summary.requests.length} customer requests for job ${job.jobNumber || "workshop row"}`}>
        <DevLayoutSection
          sectionKey={`${sectionKey}-customer-requests-content`}
          parentKey={`${sectionKey}-customer-requests`}
          sectionType="list-row"
          backgroundToken="transparent"
          className="app-job-operations-row__requests"
          data-dev-text-preview={`Customer request content for job ${job.jobNumber || "workshop row"}`}>
          <div className="app-job-operations-row__requests-heading">
            <span className="app-job-operations-row__requests-total" aria-label={`${summary.requests.length} customer requests`}>
              {summary.requests.length}
            </span>
            <span>Customer requests</span>
          </div>
          <div className="app-job-operations-row__requests-scroll" role="region" aria-label="Customer request details" tabIndex={0}>
            <ol>
              {summary.requests.map((request, index) => <li key={`${request.text}-${index}`}>
                <span className="app-job-operations-row__request-number" aria-hidden="true">{index + 1}</span>
                <span className="app-job-operations-row__request-text">{request.text}</span>
                {Number.isFinite(request.hours) && request.hours > 0 && <small className="app-job-operations-row__request-hours">{request.hours}h</small>}
                <span className="app-job-operations-row__request-meta">
                  {request.status && <span className={`app-badge ${getJobStatusBadgeTone(request.status)}`}>{request.status}</span>}
                </span>
              </li>)}
            </ol>
          </div>
        </DevLayoutSection>
      </DevLayoutSection>}
      </LayerSurface>
    </DevLayoutSection>);
};

const OrderListCard = ({ order, onNavigate, sectionKey, parentKey }) => {
  // top-layer
  const rowBackground = "var(--surface)";
  const items = order.requests || order.items || [];
  const totalItems = items.length;
  const deliveryLabel = order.delivery_type === "collection" ? "Collection" : "Delivery";
  const deliveryWindow = order.appointment ?
  order.appointment.time ?
  `${order.appointment.date} · ${order.appointment.time}` :
  order.appointment.date :
  "ETA not set";
  const primaryStatus =
  order.status || order.delivery_status || order.invoice_status || "Draft";
  const primaryStatusTone = getJobStatusBadgeTone(primaryStatus);

  return (
    // List-row container hosts onClick + hover handlers; row background is data-driven (rowBackground), so kept inline.
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="list-row"
      onClick={onNavigate}
      style={{
        padding: "0.75rem 0.9rem",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        backgroundColor: rowBackground,
        color: "var(--text-2)",
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.position = "relative";
        event.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.boxShadow = "none";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.zIndex = "0";
      }}>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          flexWrap: "wrap",
          gap: "12px"
        }}>
        
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", flex: "1 1 18rem", minWidth: "min(100%, 18rem)" }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-1)" }}>
            {order.orderNumber}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-accent)" }}>
            {order.customer || "Customer"}
          </span>
          <span style={{ fontSize: "15px", color: "var(--text-2)" }}>
            {order.makeModel || order.vehicle_reg || "Vehicle pending"}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))",
            gap: "0.55rem",
            fontSize: "0.92rem",
            flex: "999 1 28rem",
            minWidth: "min(100%, 24rem)",
            alignItems: "center"
          }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
              Fulfilment
            </span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{deliveryLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
              Scheduled
            </span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{deliveryWindow}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
              Items
            </span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
              {totalItems} line{totalItems === 1 ? "" : "s"}
            </span>
          </div>
          {order.invoice_total !== undefined &&
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
                Invoice Value
              </span>
              <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
                GBP {Number(order.invoice_total || 0).toFixed(2)}
              </span>
            </div>
          }
        </div>
        <span
          style={{ flex: "0 1 auto", minWidth: "fit-content", alignSelf: "flex-start" }}
          className={`app-badge app-badge--uppercase ${primaryStatusTone}`}>
          
          {primaryStatus}
        </span>
      </div>
      {items.length > 0 &&
      <LayerTheme radius="var(--radius-xs)" padding="10px 12px" gap={undefined} style={{
        display: "grid",
        gridTemplateColumns: "minmax(8.5rem, auto) minmax(0, 1fr)",
        alignItems: "start",
        gap: "8px 12px"
      }}>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 700 }}>
              Parts Summary
            </span>
            <span className="app-badge app-badge--neutral">{items.length}</span>
          </div>
          <div style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: 500, lineHeight: "1.45", minWidth: 0, overflowWrap: "anywhere" }}>
            {items.
          slice(0, 4).
          map((item) => item.part_name || item.part_number || "Part").
          join(" • ")}
            {items.length > 4 ? " +" + (items.length - 4) + " more" : ""}
          </div>
        </LayerTheme>
      }
    </DevLayoutSection>);

};
