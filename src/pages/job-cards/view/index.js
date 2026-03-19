// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/view/index.js
// Edit: Responsive improvements - optimized mobile/tablet layout with better stacking, reduced padding, and improved grid templates
"use client"; // enables client-side rendering for Next.js

import React, { useState, useEffect, useMemo, useCallback } from "react"; // import React and hooks
import Layout from "@/components/Layout"; // import layout wrapper
import { useNextAction } from "@/context/NextActionContext"; // import next action context
import { useRouter } from "next/router"; // for navigation
import { getAllJobs, updateJobStatus } from "@/lib/database/jobs"; // import database functions
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { useUser } from "@/context/UserContext";
import { DropdownField } from "@/components/dropdownAPI";
import { SearchBar } from "@/components/searchBarAPI";
import { TabGroup } from "@/components/tabAPI/TabGroup";
import { deriveJobTypeDisplay, formatDetectedJobTypeLabel } from "@/lib/jobType/display";
import { revalidateAllJobs } from "@/lib/swr/mutations"; // SWR cache invalidation after mutations
import { prefetchJob } from "@/lib/swr/prefetch"; // warm SWR cache on hover for instant navigation
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { ContentWidth, FilterToolbarRow, PageShell, SectionShell } from "@/components/ui";

const TODAY_STATUSES = ["Booked", "Checked In", "In Progress", "Invoiced", "Released"];

const CARRY_OVER_STATUSES = ["Booked", "Checked In", "In Progress", "Invoiced", "Released"];

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
  orders: [],
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

const getRequestsCount = (requests) => {
  if (!requests) return 0;
  if (Array.isArray(requests)) return requests.length;
  if (typeof requests === "object") return Object.keys(requests).length;
  return 0;
};

const getStatusCounts = (jobs = []) => {
  return jobs.reduce((acc, job) => {
    const key = job.status || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
};

const matchesSearchTerm = (job, value) => {
  if (!value) return true;
  const haystack = [
    job.jobNumber,
    job.reg,
    job.customer,
    job.makeModel,
    job.waitingStatus,
  ]
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
  return haystack.some((entry) => entry.includes(value));
};
const getAppointmentDisplay = (job) => {
  if (job?.appointment?.date && job?.appointment?.time) {
    return `${job.appointment.date} · ${job.appointment.time}`;
  }
  if (job?.appointment?.date) {
    return job.appointment.date;
  }
  return "Not scheduled";
};

const popupPrimaryActionButtonStyle = {
  flex: 1,
  padding: "12px 20px",
  backgroundColor: "var(--accent-purple)",
  color: "var(--text-inverse)",
  border: "1px solid var(--accent-purple)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
};

const popupSecondaryActionButtonStyle = {
  ...popupPrimaryActionButtonStyle,
  backgroundColor: "var(--accent-purple-surface)",
  color: "var(--accent-purple)",
};

const popupQuietActionButtonStyle = {
  width: "100%",
  marginTop: "16px",
  padding: "12px 20px",
  backgroundColor: "var(--surface-light)",
  color: "var(--accent-purple)",
  border: "1px solid var(--accent-purple-surface)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
};

const renderVhcBadge = (job) => {
  if (!job.vhcRequired) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: "var(--info)",
        }}
      >
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--info)",
          }}
        />
        Not required
      </span>
    );
  }
  const completed = Boolean(job.vhcCompletedAt);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        color: completed ? "var(--success-dark)" : "var(--warning)",
      }}
    >
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "var(--radius-full)",
    backgroundColor: completed ? "var(--success)" : "var(--primary)",
        }}
      />
      {completed ? "VHC complete" : "VHC pending"}
    </span>
  );
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
  const [searchValues, setSearchValues] = useState({
    today: "",
    carryOver: "",
    orders: "",
  });
  const [activeStatusFilters, setActiveStatusFilters] = useState({
    today: "All",
    carryOver: "All",
    orders: "All",
  });
  const [activeTab, setActiveTab] = useState("today"); // track active tab
  const [loading, setLoading] = useState(true); // loading state
  const router = useRouter(); // router for navigation
  useEffect(() => {
    const divisionParam = router.query?.division;
    if (!divisionParam) {
      setDivisionFilter("All");
      return;
    }
    const normalized = String(divisionParam).trim().toLowerCase();
    if (normalized === "retail") {
      setDivisionFilter("Retail");
    } else if (normalized === "sales") {
      setDivisionFilter("Sales");
    } else {
      setDivisionFilter("All");
    }
  }, [router.query?.division]);
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
  const { user } = useUser();
  const today = getTodayDate(); // get today's date

  const userRoles = useMemo(() => {
    if (!user?.roles) return [];
    return user.roles
      .map((role) =>
        typeof role === "string" ? role.trim().toLowerCase() : ""
      )
      .filter(Boolean);
  }, [user]);
  const canViewOrdersTab = useMemo(
    () => userRoles.some((role) => role === "parts" || role === "parts manager"),
    [userRoles]
  );

  /* ----------------------------
     Fetch jobs from Supabase
  ---------------------------- */
  const fetchJobs = async () => {
    setLoading(true); // show loading state
    const jobsFromSupabase = await getAllJobs(); // get all jobs from database with full data
    console.log("Fetched jobs:", jobsFromSupabase); // debug log
    setJobs(jobsFromSupabase); // update state
    setLoading(false); // hide loading state
  };

  useEffect(() => {
    fetchJobs(); // fetch jobs on component mount
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
    const result = await updateJobStatus(jobId, newStatus); // update status in database
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
            triggeredBy: null,
          });
        }
      }
    } else {
      alert("Error updating status"); // show error message
    }
  };

  const normalizedDivisionFilter =
    divisionFilter !== "All" ? divisionFilter.toLowerCase() : null;

  const divisionFilteredJobs = useMemo(
    () =>
      normalizedDivisionFilter
        ? jobs.filter(
            (job) =>
              (job.jobDivision || "Retail").toLowerCase() ===
              normalizedDivisionFilter
          )
        : jobs,
    [jobs, normalizedDivisionFilter]
  );

  const handleDivisionFilterChange = useCallback(
    (nextValue) => {
      if (!nextValue || nextValue === divisionFilter) return;
      const nextFilter = nextValue;
      setDivisionFilter(nextFilter);
      const nextQuery = { ...router.query };
      if (nextFilter === "All") {
        delete nextQuery.division;
      } else {
        nextQuery.division = nextFilter.toLowerCase();
      }
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true,
      });
    },
    [divisionFilter, router]
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
    return orders
      .map((order) => {
        const makeModel = [order.vehicle_make, order.vehicle_model]
          .filter(Boolean)
          .join(" ")
          .trim();
        const appointment = order.delivery_eta
          ? {
              date: order.delivery_eta,
              time: order.delivery_window || "",
            }
          : null;
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
          requests: order.items || [],
        };
      })
      .filter((order) => Boolean(order.orderNumber) && order.orderNumber.startsWith("P"));
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
      [tab]: status,
    }));
  };

  useEffect(() => {
    if (activeTab === "orders" && !canViewOrdersTab) {
      setActiveTab("today");
    }
  }, [activeTab, canViewOrdersTab]);

  const isOrdersTab = activeTab === "orders" && canViewOrdersTab;
  const baseJobs =
    activeTab === "today"
      ? todayJobs
      : activeTab === "carryOver"
      ? carryOverJobs
      : orderJobs;
  const statusOptionsMap = useMemo(
    () => ({
      today: buildStatusOptions(todayJobs, BASE_STATUS_OPTIONS.today),
      carryOver: buildStatusOptions(carryOverJobs, BASE_STATUS_OPTIONS.carryOver),
      orders: buildStatusOptions(orderJobs, BASE_STATUS_OPTIONS.orders),
    }),
    [todayJobs, carryOverJobs, orderJobs]
  );
  const statusOptions = statusOptionsMap[activeTab] || [];
  const statusTabs = ["All", ...statusOptions];
  const statusCounts =
    activeTab === "today"
      ? todayStatusCounts
      : activeTab === "carryOver"
      ? carryStatusCounts
      : orderStatusCounts;
  const activeStatusFilter = activeStatusFilters[activeTab];
  const searchValue = searchValues[activeTab]?.trim().toLowerCase() || "";
  const searchPlaceholder = isOrdersTab ? "Search orders..." : "Search jobs...";
  const emptyStateMessage = searchValue
    ? isOrdersTab
      ? "No orders match your search."
      : "No jobs match your search."
    : isOrdersTab
    ? "No orders available."
    : "No jobs in this status group.";
  const tabOptions = useMemo(() => {
    const baseTabs = [
      { value: "today", label: "Today's workload" },
      { value: "carryOver", label: "Carry over" },
    ];
    if (canViewOrdersTab) {
      baseTabs.push({ value: "orders", label: "Orders" });
    }
    return baseTabs;
  }, [canViewOrdersTab]);

  // For Orders tab, show all orders regardless of status filter
  const filteredByStatus = isOrdersTab
    ? baseJobs
    : activeStatusFilter === "All"
    ? baseJobs
    : baseJobs.filter((job) => {
        const jobStatus = job.status || "Unknown";
        return jobStatus === activeStatusFilter;
      });

  const filteredJobs = searchValue
    ? filteredByStatus.filter((job) => matchesSearchTerm(job, searchValue))
    : filteredByStatus;

  const getSortValue = (job) => {
    if (job?.appointment?.date && job?.appointment?.time) {
      return new Date(`${job.appointment.date}T${job.appointment.time}`);
    }
    if (job?.appointment?.date) {
      return new Date(`${job.appointment.date}T00:00:00`);
    }
    if (job?.createdAt) {
      return new Date(job.createdAt);
    }
    return new Date(0);
  };

  const sortedJobs = filteredJobs
    .slice()
    .sort((a, b) => {
      if (isOrdersTab) {
        return getSortValue(a) - getSortValue(b);
      }
      return getSortValue(b) - getSortValue(a);
    });

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
  }, [popupJob, popupStatusLabel]);

  const handleQuickView = (job) => {
    setPopupJob(job);
  };

  const handleCardNavigation = (jobNumber) => {
    goToJobCard(jobNumber);
  };

  /* ================================
     Loading State
  ================================ */
  if (loading) {
    return (
      <Layout>
        <PageShell sectionKey="job-cards-view-loading-shell">
          <DevLayoutSection
            className="redirect-screen"
            role="status"
            aria-live="polite"
            sectionKey="job-cards-view-loading-state"
            parentKey="job-cards-view-loading-shell"
            sectionType="state-banner"
          >
          <DevLayoutSection
            className="redirect-card"
            sectionKey="job-cards-view-loading-card"
            parentKey="job-cards-view-loading-state"
            sectionType="content-card"
          >
            <div className="login-brand redirect-brand" aria-hidden="true">
              <img src="/logo.png" alt="H&P logo" className="login-logo" />
            </div>
            <div className="redirect-spinner" aria-hidden="true"></div>
            <div className="redirect-copy">
              <p className="redirect-kicker">Page Load</p>
              <h2 className="redirect-title">Loading job cards...</h2>
              <p className="redirect-sub">Please wait while we fetch your data.</p>
            </div>
            <div className="redirect-dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </DevLayoutSection>
          </DevLayoutSection>
        </PageShell>
      </Layout>
    );
  }

  /* ================================
     Page Layout
  ================================ */
  return (
    <Layout>
      <style>{`
        .job-cards-filter.dropdown-api {
          width: 100%;
        }

        .job-cards-view-toolbar {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          justify-content: flex-start;
        }

        .job-cards-view-tabs {
          flex: 0 1 auto;
          width: fit-content;
          max-width: max-content;
          min-height: calc(var(--control-height-sm) + 0.7rem);
          min-width: auto;
          overflow: visible;
          padding: 0.35rem 0.5rem;
        }

        .job-cards-view-tabs .tab-api {
          padding: 0;
          gap: 0.375rem;
          min-height: var(--control-height-sm);
          flex-wrap: nowrap;
          overflow: visible;
          justify-content: flex-start;
          width: fit-content;
          max-width: max-content;
          align-items: center;
        }

        .job-cards-view-tabs .tab-api__item {
          min-height: var(--control-height-sm);
          padding: 0.45rem 0.7rem;
          font-size: 0.78rem;
          flex: 0 0 auto;
        }

        .job-cards-view-search-shell {
          flex: 1 1 auto;
          width: auto;
          max-width: none;
          min-height: calc(var(--control-height-sm) + 0.7rem);
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(7.2rem, 8.4rem) minmax(7.2rem, 8.4rem);
          align-items: center;
          justify-content: stretch;
          gap: 0.45rem;
          padding: 0.35rem 0.5rem;
          min-width: 0;
        }

        .job-cards-view-searchbar.searchbar-api {
          width: 100%;
          min-height: var(--control-height-sm);
          padding: 0.45rem 0.7rem;
          min-width: 0;
          max-width: none;
        }

        .job-cards-view-searchbar .searchbar-api__input {
          font-size: 0.85rem;
        }

        .job-cards-view-filter-controls {
          display: contents;
        }

        .job-cards-view-filter-slot {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .job-cards-view-filter-control {
          width: 100%;
          min-width: 0;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
        }

        .job-cards-view-filter-control .dropdown-api {
          width: 100%;
        }

        .job-cards-view-filter-control .dropdown-api__control {
          min-height: var(--control-height-sm);
          padding: 0.45rem 0.65rem;
        }

        .job-cards-view-filter-control .dropdown-api__value {
          font-size: 0.8rem;
        }

        @media (max-width: 900px) {
          .job-cards-view-toolbar {
            display: flex;
            flex-wrap: wrap;
          }

          .job-cards-view-tabs,
          .job-cards-view-search-shell {
            flex: 1 1 100%;
            display: flex;
            flex-wrap: wrap;
          }

          .job-cards-view-searchbar.searchbar-api {
            flex: 1 1 100%;
            max-width: none;
          }

          .job-cards-view-filter-slot {
            width: 100%;
          }

          .job-cards-view-filter-controls,
          .job-cards-view-filter-slot {
            flex-wrap: wrap;
            justify-content: stretch;
          }

          .job-cards-view-filter-control {
            width: 100%;
            min-width: 0;
            flex: 1 1 100%;
          }
        }
      `}</style>
      <PageShell sectionKey="job-cards-view-shell">
        <ContentWidth sectionKey="job-cards-view-content" parentKey="job-cards-view-shell" widthMode="content">
      <div className="app-page-stack">
          <SectionShell
            sectionKey="job-cards-view-filter-shell"
            parentKey="job-cards-view-content"
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(var(--primary-rgb), 0.10)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(var(--primary-rgb), 0.18)",
              padding: "12px",
              gap: "12px",
            }}
          >
            <FilterToolbarRow
              sectionKey="job-cards-view-filter-row"
              parentKey="job-cards-view-filter-shell"
              className="job-cards-view-toolbar"
              style={{
                gap: "0.75rem",
              }}
            >
              <DevLayoutSection
                className="page-surface-plain job-cards-view-tabs"
                sectionKey="job-cards-view-tabs"
                parentKey="job-cards-view-filter-row"
                sectionType="tab-row"
                style={{
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <TabGroup
                  items={tabOptions}
                  value={activeTab}
                  onChange={setActiveTab}
                  ariaLabel="Job card tabs"
                  className="tab-api--wrap"
                />
              </DevLayoutSection>
              <DevLayoutSection
                className="app-layout-card job-cards-view-search-shell"
                sectionKey="job-cards-view-search"
                parentKey="job-cards-view-filter-row"
                sectionType="search-control"
              >
                <SearchBar
                  className="job-cards-view-searchbar"
                  placeholder={searchPlaceholder}
                  value={searchValues[activeTab]}
                  onChange={(event) =>
                    handleSearchValueChange(activeTab, event.target.value)
                  }
                  onClear={() => handleSearchValueChange(activeTab, "")}
                  style={{ width: "100%" }}
                />
                {!isOrdersTab && (
                  <DevLayoutSection
                    className="job-cards-view-filter-controls"
                    sectionKey="job-cards-view-filter-controls"
                    parentKey="job-cards-view-search"
                    sectionType="toolbar"
                  >
                    <DevLayoutSection
                      className="job-cards-view-filter-slot"
                      sectionKey="job-cards-view-filter-controls-division-slot"
                      parentKey="job-cards-view-filter-controls"
                      sectionType="filter-control"
                    >
                      <DevLayoutSection
                        className="job-cards-view-filter-control"
                        sectionKey="job-cards-view-division-filter"
                        parentKey="job-cards-view-filter-controls-division-slot"
                        sectionType="filter-control"
                      >
                        <DropdownField
                          className="job-cards-filter"
                          value={divisionFilter}
                          options={[
                            { value: "All", label: "Division filter: All" },
                            { value: "Retail", label: "Division filter: Retail" },
                            { value: "Sales", label: "Division filter: Sales" },
                          ]}
                          size="sm"
                          onValueChange={(value) => handleDivisionFilterChange(value)}
                        />
                      </DevLayoutSection>
                    </DevLayoutSection>
                    <DevLayoutSection
                      className="job-cards-view-filter-slot"
                      sectionKey="job-cards-view-filter-controls-status-slot"
                      parentKey="job-cards-view-filter-controls"
                      sectionType="filter-control"
                    >
                      <DevLayoutSection
                        className="job-cards-view-filter-control"
                        sectionKey="job-cards-view-status-filter"
                        parentKey="job-cards-view-filter-controls-status-slot"
                        sectionType="filter-control"
                      >
                        <DropdownField
                          className="job-cards-filter"
                          value={activeStatusFilter}
                          options={statusTabs.map((status) => ({
                            value: status,
                            label: `Status filter: ${status}`,
                            description:
                              status === "All"
                                ? `${baseJobs.length} total`
                                : `${statusCounts[status] || 0} jobs`,
                          }))}
                          size="sm"
                          onValueChange={(value) =>
                            handleStatusFilterChange(activeTab, value)
                          }
                        />
                      </DevLayoutSection>
                    </DevLayoutSection>
                  </DevLayoutSection>
                )}
              </DevLayoutSection>
            </FilterToolbarRow>
          </SectionShell>

          <SectionShell
            sectionKey="job-cards-view-list-shell"
            parentKey="job-cards-view-content"
            style={{
              flex: 1,
              overflow: "hidden",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(var(--primary-rgb), 0.18)",
              background: "rgba(var(--primary-rgb), 0.10)",
              padding: "12px",
              minHeight: "0",
            }}
          >
            <DevLayoutSection
              sectionKey="job-cards-view-list-viewport"
              parentKey="job-cards-view-list-shell"
              sectionType="scroll-region"
              style={{
                height: "100%",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {isOrdersTab && ordersLoading ? (
                <DevLayoutSection
                  sectionKey="job-cards-view-orders-loading"
                  parentKey="job-cards-view-list-viewport"
                  sectionType="state-banner"
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "var(--info)",
                    border: "1px dashed var(--accent-purple-surface)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--info-surface)",
                  }}
                >
                  Loading orders...
                </DevLayoutSection>
              ) : sortedJobs.length === 0 ? (
                <DevLayoutSection
                  sectionKey="job-cards-view-empty-state"
                  parentKey="job-cards-view-list-viewport"
                  sectionType="state-banner"
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "var(--info)",
                    border: "1px dashed var(--accent-purple-surface)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--info-surface)",
                  }}
                >
                  {emptyStateMessage}
                </DevLayoutSection>
              ) : (
                sortedJobs.map((job, index) =>
                  isOrdersTab ? (
                    <OrderListCard
                      key={job.id || job.orderNumber}
                      sectionKey={`job-cards-view-order-row-${job.id || job.orderNumber || index + 1}`}
                      parentKey="job-cards-view-list-viewport"
                      order={job}
                      index={index}
                      onNavigate={() => router.push(`/parts/create-order/${job.orderNumber}`)}
                    />
                  ) : (
                    <JobListCard
                      key={job.jobNumber}
                      sectionKey={`job-cards-view-job-row-${job.jobNumber || index + 1}`}
                      parentKey="job-cards-view-list-viewport"
                      job={job}
                      index={index}
                      onNavigate={() => handleCardNavigation(job.jobNumber)}
                      onMouseEnter={() => prefetchJob(job.jobNumber)}
                    />
                  )
                )
              )}
            </DevLayoutSection>
          </SectionShell>

          {/* ✅ Job Popup - Enhanced with all new fields */}
          {popupJob && (
            <>
              <DevLayoutSection
                sectionKey="job-cards-view-quick-view-overlay"
                parentKey="job-cards-view-shell"
                sectionType="floating-action"
                style={{
                  ...popupOverlayStyles,
                  zIndex: 1200,
                }}
                onClick={() => setPopupJob(null)}
              >
              <DevLayoutSection
                sectionKey="job-cards-view-quick-view-card"
                parentKey="job-cards-view-quick-view-overlay"
                sectionType="content-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  ...popupCardStyles,
                  padding: "var(--page-card-padding)",
                  maxWidth: "700px",
                  width: "90%",
                  maxHeight: "85vh",
                  overflowY: "auto",
                }}
              >
              {/* Popup Header */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                      {popupJob.jobNumber}
                    </h2>
                    <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: 0 }}>
                      {popupJob.customer}
                    </p>
                  </div>
                  {/* ✅ Job Source Badge */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {popupJob.jobDivision && (
                      <span
                        style={{
                          backgroundColor:
                            popupJob.jobDivision.toLowerCase() === "sales"
                              ? "var(--info-surface)"
                              : "var(--success-surface)",
                          color:
                            popupJob.jobDivision.toLowerCase() === "sales"
                              ? "var(--info)"
                              : "var(--success-dark)",
                          padding: "8px 16px",
                          borderRadius: "var(--control-radius-xs)",
                          fontSize: "12px",
                          fontWeight: "600",
                          border: "1px solid currentColor",
                          letterSpacing: "0.3px",
                        }}
                      >
                        {popupJob.jobDivision}
                      </span>
                    )}
                    <span
                      style={{
                        backgroundColor: popupJob.jobSource === "Warranty" ? "var(--warning)" : "var(--success)",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "var(--control-radius-xs)",
                        fontSize: "12px",
                        fontWeight: "600",
                        border: "1px solid transparent",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {popupJob.jobSource || "Retail"}
                    </span>
                    {/* ✅ Prime/Sub-job badge */}
                    {popupJob.primeJobNumber && (
                      <span
                        style={{
                          backgroundColor: "var(--primary-surface)",
                          color: "var(--primary)",
                          padding: "8px 16px",
                          borderRadius: "var(--radius-xs)",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {popupJob.isPrimeJob ? "🔗 Prime Job" : `Sub-job of #${popupJob.primeJobNumber}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ Job Details - Enhanced */}
              <div className="app-section-card" style={{
                marginBottom: "20px"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
                    <strong>Registration:</strong> {popupJob.reg}
                  </div>
                  {popupJob.makeModel && (
                    <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
                      <strong>Vehicle:</strong> {popupJob.makeModel}
                    </div>
                  )}
                  {popupJob.vin && (
                    <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
                      <strong>VIN:</strong> {popupJob.vin}
                    </div>
                  )}
                  {popupJob.mileage && (
                    <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
                      <strong>Mileage:</strong> {popupJob.mileage.toLocaleString()} miles
                    </div>
                  )}
                  {/* ✅ Waiting Status */}
                  {popupJob.waitingStatus && popupJob.waitingStatus !== "Neither" && (
                    <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
                      <strong>Customer Status:</strong> {popupJob.waitingStatus}
                    </div>
                  )}
                  {popupJob.appointment && (
                    <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
                      <strong>Appointment:</strong> {popupJob.appointment.date} at {popupJob.appointment.time}
                    </div>
                  )}
                </div>

                {/* ✅ Job Categories */}
                {popupJob.jobCategories && popupJob.jobCategories.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--grey-accent)" }}>Job Types:</strong>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                      {popupJob.jobCategories.map((category, idx) => (
                        <span
                          key={idx}
                          style={{
                            backgroundColor: "var(--surface-light)",
                            color: "var(--text-secondary)",
                            padding: "4px 10px",
                            borderRadius: "var(--radius-xs)",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}
                        >
                          {formatDetectedJobTypeLabel(category)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ Job Requests */}
                {popupJob.requests && popupJob.requests.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--grey-accent)" }}>Customer Requests:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                      {popupJob.requests.map((req, idx) => (
                        <li key={idx} style={{ fontSize: "13px", color: "var(--grey-accent)", marginBottom: "4px" }}>
                          {req.text || req} 
                          {req.time && <span style={{ color: "var(--grey-accent-light)" }}> ({req.time}h)</span>}
                          {req.paymentType && req.paymentType !== "Customer" && (
                            <span style={{ 
                              marginLeft: "8px", 
                              backgroundColor: "var(--warning-surface)", 
                              padding: "2px 6px", 
                              borderRadius: "var(--radius-xs)",
                              fontSize: "11px"
                            }}>
                              {req.paymentType}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ✅ Cosmetic Notes */}
                {popupJob.cosmeticNotes && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--grey-accent)" }}>Cosmetic Damage:</strong>
                    <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "4px 0 0 0" }}>
                      {popupJob.cosmeticNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Badges */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div style={{
                  backgroundColor: "var(--info-surface)",
                  color: "var(--info-dark)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  VHC Checks: {popupJob.vhcChecks?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "var(--warning-surface)",
                  color: "var(--accent-purple)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Parts Requests: {popupJob.partsRequests?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "var(--success-surface)",
                  color: "var(--success-dark)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Notes: {popupJob.notes?.length || 0}
                </div>
                {/* ✅ Files Badge */}
                {popupJob.files && popupJob.files.length > 0 && (
                  <div style={{
                    backgroundColor: "var(--accent-purple-surface)",
                    color: "var(--accent-purple)",
                    padding: "8px 16px",
                    borderRadius: "var(--radius-xs)",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    Files: {popupJob.files.length}
                  </div>
                )}
                {/* ✅ VHC Required Badge */}
                {popupJob.vhcRequired && (
                  <div style={{
                    backgroundColor: "var(--surface-light)",
                    color: "var(--accent-purple)",
                    padding: "8px 16px",
                    borderRadius: "var(--radius-xs)",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    VHC REQUIRED
                  </div>
                )}
              </div>

              {/* Status Dropdown */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--grey-accent)", display: "block", marginBottom: "8px" }}>
                  Update Status
                </label>
                <select
                  value={popupStatusLabel || ""}
                  onChange={(e) => handleStatusChange(popupJob.id, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    backgroundColor: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  {combinedStatusOptions.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  onClick={() => goToJobCard(popupJob.jobNumber)}
                  style={popupPrimaryActionButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary-dark)";
                    e.currentTarget.style.borderColor = "var(--primary-dark)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--accent-purple)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                >
                  View Full Details
                </button>

                <button
                  onClick={() => router.push(`/job-cards/myjobs/${popupJob.jobNumber}?tab=vhc`)}
                  style={popupSecondaryActionButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-light)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--accent-purple-surface)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                >
                  View VHC
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}?tab=write-up`)}
                  style={popupSecondaryActionButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-light)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--accent-purple-surface)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                >
                  Write-Up
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setPopupJob(null)}
                style={popupQuietActionButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--accent-purple-surface)";
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-light)";
                  e.currentTarget.style.borderColor = "var(--accent-purple-surface)";
                }}
              >
                Close
              </button>
            </DevLayoutSection>
          </DevLayoutSection>
            </>
        )}
      </div>
      </ContentWidth>
      </PageShell>
    </Layout>
  );
}

const JobListCard = ({ job, onNavigate, onQuickView, onMouseEnter, index = 0, sectionKey, parentKey }) => {
  // top-layer
  const rowBackground = "var(--surface)";
  const jobType = deriveJobType(job);
  const appointmentLabel = getAppointmentDisplay(job);
  const jobDate = getJobDate(job);
  const requestsCount = getRequestsCount(job.requests);
  const waitingLabel = formatCustomerStatusLabel(job.waitingStatus);
  const assignedTechName =
    job.assignedTech?.fullName ||
    job.assignedTech?.name ||
    job.technician ||
    "Unassigned";
  const createdStamp = job.createdAt
    ? new Date(job.createdAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown";
  const jobStatus = job.status || "Status pending";
  const jobDivisionLabel = job.jobDivision || "Retail";
  const isSalesDivision = jobDivisionLabel.toLowerCase() === "sales";
  const divisionBadgeStyles = {
    backgroundColor: isSalesDivision ? "var(--info-surface)" : "var(--success-surface)",
    color: isSalesDivision ? "var(--info)" : "var(--success-dark)",
  };

  // Extract customer requests text
  const customerRequests = job.requests && Array.isArray(job.requests)
    ? job.requests.map(req => typeof req === "string" ? req : req?.text || req?.description || "").filter(Boolean)
    : [];

  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="list-row"
      onClick={onNavigate}
      style={{
        border: "none",
        padding: "0.75rem 0.9rem",
        borderRadius: "var(--radius-sm)",
        backgroundColor: rowBackground,
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(event) => {
        if (onMouseEnter) onMouseEnter(); // prefetch job data on hover
        event.currentTarget.style.position = "relative";
        event.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.borderColor = "var(--primary)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.borderColor = "var(--surface-light)";
        event.currentTarget.style.zIndex = "0";
      }}
    >
      {/* Header Row - Job Number, Reg, Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--info-dark)" }}>{job.jobNumber}</span>
          {/* ✅ Prime/Sub-job badge */}
          {job.primeJobNumber && (
            <span
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--primary-surface)",
                color: "var(--primary)",
                fontWeight: "600",
              }}
              title={job.isPrimeJob ? "Prime Job" : `Sub-job of ${job.primeJobNumber}`}
            >
              {job.isPrimeJob ? "🔗 Prime" : `↳ ${job.primeJobNumber}`}
            </span>
          )}
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--primary)" }}>{job.reg || "—"}</span>
          <span style={{ fontSize: "13px", color: "var(--info)" }}>{job.makeModel || "Vehicle pending"}</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "var(--control-radius-xs)",
              fontWeight: 600,
              fontSize: "12px",
              textTransform: "capitalize",
              border: "1px solid currentColor",
              letterSpacing: "0.3px",
              ...divisionBadgeStyles,
            }}
          >
            {jobDivisionLabel}
          </span>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "var(--control-radius-xs)",
              backgroundColor: "var(--accent-purple-surface)",
              color: "var(--accent-purple)",
              fontWeight: 600,
              fontSize: "12px",
              textTransform: "capitalize",
              border: "1px solid currentColor",
              letterSpacing: "0.3px",
            }}
          >
            {jobStatus}
          </span>
        </div>
      </div>

      {/* Main Info Row - Compact horizontal layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(6.5rem, 1fr))",
          gap: "0.5rem",
          fontSize: "0.8rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>Customer</span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{job.customer || "Unknown"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>Technician</span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{assignedTechName}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>Job Type</span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{jobType}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>Appointment</span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{appointmentLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>Customer Status</span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{waitingLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>VHC</span>
          <span style={{ fontSize: "12px" }}>{renderVhcBadge(job)}</span>
        </div>
      </div>

      {/* Customer Requests Section */}
      {customerRequests.length > 0 && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--info-surface)",
            border: "none",
          }}
        >
          <div style={{ fontSize: "10px", color: "var(--warning)", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
            Customer Requests ({customerRequests.length})
          </div>
          <div style={{ fontSize: "12px", color: "var(--info-dark)", lineHeight: "1.4" }}>
            {customerRequests.join(" • ")}
          </div>
        </div>
      )}
    </DevLayoutSection>
  );
};

const OrderListCard = ({ order, onNavigate, index = 0, sectionKey, parentKey }) => {
  // top-layer
  const rowBackground = "var(--surface)";
  const items = order.requests || order.items || [];
  const totalItems = items.length;
  const deliveryLabel = order.delivery_type === "collection" ? "Collection" : "Delivery";
  const deliveryWindow = order.appointment
    ? order.appointment.time
      ? `${order.appointment.date} · ${order.appointment.time}`
      : order.appointment.date
    : "ETA not set";
  const primaryStatus =
    order.status || order.delivery_status || order.invoice_status || "Draft";

  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="list-row"
      onClick={onNavigate}
      style={{
        border: "none",
        padding: "0.75rem 0.9rem",
        borderRadius: "var(--radius-sm)",
        backgroundColor: rowBackground,
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.position = "relative";
        event.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.borderColor = "var(--primary)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.borderColor = "var(--surface-light)";
        event.currentTarget.style.zIndex = "0";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--info-dark)" }}>
            {order.orderNumber}
          </span>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--primary)" }}>
            {order.customer || "Customer"}
          </span>
          <span style={{ fontSize: "13px", color: "var(--info)" }}>
            {order.makeModel || order.vehicle_reg || "Vehicle pending"}
          </span>
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "var(--control-radius)",
            backgroundColor: "var(--accent-purple-surface)",
            color: "var(--accent-purple)",
            fontWeight: 600,
            fontSize: "12px",
            textTransform: "capitalize",
          }}
        >
          {primaryStatus}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))",
          gap: "0.5rem",
          fontSize: "0.8rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>
            Fulfilment
          </span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{deliveryLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>
            Scheduled
          </span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{deliveryWindow}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>
            Items
          </span>
          <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>
            {totalItems} line{totalItems === 1 ? "" : "s"}
          </span>
        </div>
        {order.invoice_total !== undefined && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>
              Invoice Value
            </span>
            <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>
              £{Number(order.invoice_total || 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--info-surface)",
            border: "none",
          }}
        >
          <div style={{ fontSize: "10px", color: "var(--warning)", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
            Parts Summary
          </div>
          <div style={{ fontSize: "12px", color: "var(--info-dark)", lineHeight: "1.4" }}>
            {items
              .slice(0, 4)
              .map((item) => item.part_name || item.part_number || "Part")
              .join(" • ")}
            {items.length > 4 ? " +" + (items.length - 4) + " more" : ""}
          </div>
        </div>
      )}
    </DevLayoutSection>
  );
};
