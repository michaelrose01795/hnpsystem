// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/view/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useState, useEffect, useMemo } from "react"; // import React and hooks
import Layout from "@/components/Layout"; // import layout wrapper
import { useNextAction } from "@/context/NextActionContext"; // import next action context
import { useRouter } from "next/router"; // for navigation
import { getAllJobs, updateJobStatus } from "@/lib/database/jobs"; // import database functions

const TODAY_STATUSES = [
  "Booked",
  "Checked In",
  "Workshop/MOT",
  "VHC Complete",
  "VHC Sent",
  "Additional Work Required",
  "Additional Work Being Carried Out",
  "Being Washed",
  "Complete",
];

const CARRY_OVER_STATUSES = [
  "Retail Parts on Order",
  "Warranty Parts on Order",
  "Raise TSR",
  "Waiting for TSR Response",
  "Warranty Quality Control",
  "Warranty Ready to Claim",
];

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

const deriveJobType = (job) => {
  if (Array.isArray(job?.jobCategories) && job.jobCategories.length > 0) {
    if (job.jobCategories.some((type) => normalizeString(type).includes("mot")))
      return "MOT";
    if (
      job.jobCategories.some((type) => normalizeString(type).includes("service"))
    )
      return "Service";
    if (
      job.jobCategories.some((type) =>
        normalizeString(type).includes("diag")
      )
    )
      return "Diagnose";
  }
  const baseType = normalizeString(job?.type);
  if (baseType.includes("mot")) return "MOT";
  if (baseType.includes("service")) return "Service";
  if (baseType.includes("diag")) return "Diagnose";
  return "Other";
};

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
            borderRadius: "50%",
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
          borderRadius: "50%",
          backgroundColor: completed ? "var(--success)" : "var(--danger)",
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
  const [popupJob, setPopupJob] = useState(null); // store selected job for popup
  const [searchValues, setSearchValues] = useState({
    today: "",
    carryOver: "",
  });
  const [activeStatusFilters, setActiveStatusFilters] = useState({
    today: "All",
    carryOver: "All",
  });
  const [activeTab, setActiveTab] = useState("today"); // track active tab
  const [loading, setLoading] = useState(true); // loading state
  const router = useRouter(); // router for navigation
  const { triggerNextAction } = useNextAction(); // next action dispatcher
  const today = getTodayDate(); // get today's date

  /* ----------------------------
     Fetch jobs from Supabase
  ---------------------------- */
  const fetchJobs = async () => {
    setLoading(true); // show loading state
    const jobsFromSupabase = await getAllJobs(); // get all jobs from database with full data
    console.log("📋 Fetched jobs:", jobsFromSupabase); // debug log
    setJobs(jobsFromSupabase); // update state
    setLoading(false); // hide loading state
  };

  useEffect(() => {
    fetchJobs(); // fetch jobs on component mount
  }, []);

  /* ----------------------------
     Go to job card page
  ---------------------------- */
  const goToJobCard = (jobNumber) => {
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
    if (result.success) {
      fetchJobs(); // refresh jobs list after update
      if (popupJob && popupJob.id === jobId) {
        setPopupJob({ ...popupJob, status: newStatus }); // update popup if open
      }

      const actionType = resolveNextActionType(newStatus);
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

  const jobDateLookup = useMemo(
    () =>
      jobs.reduce((acc, job) => {
        acc[job.id] = getJobDate(job);
        return acc;
      }, {}),
    [jobs]
  );

  const todayJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const jobDate = jobDateLookup[job.id];
        return jobDate === today;
      }),
    [jobs, today, jobDateLookup]
  );

  const carryOverJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const jobDate = jobDateLookup[job.id];
        return jobDate !== today;
      }),
    [jobs, today, jobDateLookup]
  );

  const todayStatusCounts = useMemo(
    () => getStatusCounts(todayJobs),
    [todayJobs]
  );
  const carryStatusCounts = useMemo(
    () => getStatusCounts(carryOverJobs),
    [carryOverJobs]
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

  const baseJobs = activeTab === "today" ? todayJobs : carryOverJobs;
  const statusOptionsMap = useMemo(
    () => ({
      today: buildStatusOptions(todayJobs, BASE_STATUS_OPTIONS.today),
      carryOver: buildStatusOptions(carryOverJobs, BASE_STATUS_OPTIONS.carryOver),
    }),
    [todayJobs, carryOverJobs]
  );
  const statusOptions = statusOptionsMap[activeTab];
  const statusTabs = ["All", ...statusOptions];
  const statusCounts =
    activeTab === "today" ? todayStatusCounts : carryStatusCounts;
  const activeStatusFilter = activeStatusFilters[activeTab];
  const searchValue = searchValues[activeTab]?.trim().toLowerCase() || "";
  const overviewStats = [
    { label: "Today's Jobs", value: todayJobs.length },
    { label: "Carry Over", value: carryOverJobs.length },
    { label: "Total Jobs", value: jobs.length },
  ];
  const activeFilterLabel =
    activeStatusFilter === "All"
      ? "Showing every status"
      : `Filtered by "${activeStatusFilter}"`;

  const filteredByStatus =
    activeStatusFilter === "All"
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
    .sort((a, b) => getSortValue(a) - getSortValue(b));

  const combinedStatusOptions = useMemo(() => {
    const union = new Set([...TODAY_STATUSES, ...CARRY_OVER_STATUSES]);
    if (popupJob?.status) {
      union.add(popupJob.status);
    }
    return Array.from(union);
  }, [popupJob]);

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
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh" 
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ 
              fontSize: "18px", 
              fontWeight: "600", 
              color: "var(--primary)",
              marginBottom: "12px"
            }}>
              Loading Job Cards...
            </div>
            <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
              Please wait while we fetch your data
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  /* ================================
     Page Layout
  ================================ */
  return (
    <Layout>
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          padding: "32px 24px 40px",
          background: "var(--surface)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1400px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface)",
              borderRadius: "24px",
              padding: "24px 28px",
              border: "1px solid var(--surface-light)",
              boxShadow: "0 24px 65px rgba(var(--primary-rgb),0.08)",
            }}
          >
            <div style={{ flex: "1 1 320px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--warning)",
                }}
              >
                Job Overview
              </p>
              <h1 style={{ fontSize: "28px", margin: "6px 0", color: "var(--accent-purple)" }}>
                Workshop workload
              </h1>
              <p style={{ margin: 0, color: "var(--info)", fontSize: "15px" }}>
                Monitor today&apos;s progress and outstanding carry overs in one glance.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {overviewStats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    minWidth: "130px",
                    padding: "10px 16px",
                    borderRadius: "16px",
                    background: "var(--danger)",
                    border: "1px solid var(--danger-surface)",
                    color: "var(--danger-dark)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>{stat.value}</div>
                </div>
              ))}
              <button
                onClick={fetchJobs}
                style={{
                  padding: "12px 28px",
                  background: "var(--danger)",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  boxShadow: "0 15px 35px rgba(var(--danger-rgb), 0.35)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 20px 45px rgba(var(--danger-rgb), 0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 15px 35px rgba(var(--danger-rgb), 0.35)";
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                padding: "4px",
                borderRadius: "999px",
                backgroundColor: "var(--surface)",
                border: "1px solid rgba(var(--primary-rgb),0.2)",
                boxShadow: "0 18px 40px rgba(var(--primary-rgb),0.08)",
              }}
            >
              <button
                onClick={() => setActiveTab("today")}
                style={{
                  padding: "12px 32px",
                  border: "none",
                  borderRadius: "999px",
                  background: activeTab === "today" ? "var(--primary)" : "transparent",
                  color: activeTab === "today" ? "white" : "var(--danger-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ☀️ Today&apos;s workload
              </button>
              <button
                onClick={() => setActiveTab("carryOver")}
                style={{
                  padding: "12px 32px",
                  border: "none",
                  borderRadius: "999px",
                  background: activeTab === "carryOver" ? "var(--primary)" : "transparent",
                  color: activeTab === "carryOver" ? "white" : "var(--danger-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                🌙 Carry over
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              borderRadius: "28px",
              border: "1px solid var(--info-surface)",
              boxShadow: "0 24px 65px rgba(var(--shadow-rgb),0.08)",
              padding: "24px",
              minHeight: "0",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "stretch",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  flex: "1 1 320px",
                  minWidth: "240px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 18px",
                  borderRadius: "18px",
                  border: "1px solid var(--info-surface)",
                  background: "var(--info-surface)",
                  boxShadow: "inset 0 1px 1px rgba(var(--shadow-rgb),0.05)",
                }}
              >
                <span style={{ fontSize: "18px", color: "var(--info)" }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search job number, registration, or customer"
                  value={searchValues[activeTab]}
                  onChange={(event) =>
                    handleSearchValueChange(activeTab, event.target.value)
                  }
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: "15px",
                    color: "var(--accent-purple)",
                  }}
                />
              </div>
              <div
                style={{
                  flex: "0 1 220px",
                  minWidth: "200px",
                  padding: "12px 18px",
                  borderRadius: "18px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--danger-surface)",
                  color: "var(--danger)",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                {activeFilterLabel}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                padding: "12px",
                marginBottom: "16px",
                background: "var(--surface)",
                borderRadius: "18px",
                border: "1px solid var(--surface-light)",
                boxShadow: "inset 0 1px 1px rgba(var(--surface-rgb), 0.8)",
              }}
            >
              {statusTabs.map((status) => {
                const isActive = activeStatusFilter === status;
                const count =
                  status === "All" ? baseJobs.length : statusCounts[status] || 0;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusFilterChange(activeTab, status)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "14px",
                      border: "1px solid",
                      borderColor: isActive ? "transparent" : "rgba(var(--primary-rgb), 0.3)",
                      background: isActive ? "var(--danger)" : "rgba(var(--surface-rgb), 0.9)",
                      color: isActive ? "white" : "var(--danger)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      boxShadow: isActive
                        ? "0 10px 25px rgba(var(--primary-rgb), 0.25)"
                        : "0 6px 16px rgba(var(--primary-rgb), 0.08)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>{status}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: "999px",
                        backgroundColor: isActive
                          ? "rgba(var(--surface-rgb), 0.25)"
                          : "rgba(var(--primary-rgb), 0.1)",
                        color: isActive ? "white" : "var(--danger)",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                flex: 1,
                overflow: "hidden",
                borderRadius: "16px",
                border: "1px solid var(--info-surface)",
                background: "var(--surface)",
                padding: "12px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {sortedJobs.length === 0 ? (
                  <div
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: "var(--info)",
                      border: "1px dashed var(--accent-purple-surface)",
                      borderRadius: "12px",
                      background: "var(--info-surface)",
                    }}
                  >
                    {searchValue
                      ? "No jobs match your search."
                      : "No jobs in this status group."}
                  </div>
                ) : (
                  sortedJobs.map((job) => (
                    <JobListCard
                      key={job.jobNumber}
                      job={job}
                      onNavigate={() => handleCardNavigation(job.jobNumber)}
                      onQuickView={() => handleQuickView(job)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ✅ Job Popup - Enhanced with all new fields */}
          {popupJob && (
            <div
              style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(var(--shadow-rgb),0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              }}
              onClick={() => setPopupJob(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: "var(--surface)",
                  padding: "32px",
                  borderRadius: "16px",
                  maxWidth: "700px",
                  width: "90%",
                  maxHeight: "85vh",
                  overflowY: "auto",
                  boxShadow: "0 20px 60px rgba(var(--shadow-rgb),0.3)"
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
                  <div style={{
                    backgroundColor: popupJob.jobSource === "Warranty" ? "var(--warning)" : "var(--success)",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {popupJob.jobSource || "RETAIL"}
                  </div>
                </div>
              </div>

              {/* ✅ Job Details - Enhanced */}
              <div style={{ 
                background: "var(--surface)",
                border: "1px solid var(--surface-light)",
                borderRadius: "12px",
                padding: "16px",
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
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}
                        >
                          {category}
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
                              borderRadius: "4px",
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
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  VHC Checks: {popupJob.vhcChecks?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "var(--warning-surface)",
                  color: "var(--danger-dark)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Parts Requests: {popupJob.partsRequests?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "var(--success-surface)",
                  color: "var(--success-dark)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Notes: {popupJob.notes?.length || 0}
                </div>
                {/* ✅ Files Badge */}
                {popupJob.files && popupJob.files.length > 0 && (
                  <div style={{
                    backgroundColor: "var(--danger-surface)",
                    color: "var(--danger)",
                    padding: "8px 16px",
                    borderRadius: "8px",
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
                    color: "var(--danger)",
                    padding: "8px 16px",
                    borderRadius: "8px",
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
                  value={popupJob.status}
                  onChange={(e) => handleStatusChange(popupJob.id, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    borderRadius: "8px",
                    border: "1px solid var(--surface-light)",
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
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "var(--primary-dark)"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
                >
                  📝 View Full Details
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}/vhc`)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "var(--danger)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger)"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "var(--danger)"}
                >
                  🔍 View VHC
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}/write-up`)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "var(--info)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "var(--info-dark)"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "var(--info)"}
                >
                  ✍️ Write-Up
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setPopupJob(null)}
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "12px 20px",
                  backgroundColor: "var(--surface)",
                  color: "var(--grey-accent)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "var(--surface-light)"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "var(--surface)"}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </Layout>
  );
}

const JobListCard = ({ job, onNavigate, onQuickView }) => {
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
  const jobSourceLabel = job.jobSource || "Retail";

  const infoBlocks = [
    { label: "Customer", value: job.customer || "Unknown customer" },
    { label: "Technician", value: assignedTechName },
    { label: "Job Type", value: jobType },
    { label: "Appointment", value: appointmentLabel },
    { label: "Customer Status", value: waitingLabel },
    { label: "Requests", value: `${requestsCount} item${requestsCount === 1 ? "" : "s"}` },
  ];

  return (
    <div
      onClick={onNavigate}
      style={{
        border: "1px solid var(--surface-light)",
        padding: "18px",
        borderRadius: "16px",
        backgroundColor: "var(--surface)",
        boxShadow: "0 2px 6px rgba(var(--primary-rgb),0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.boxShadow = "0 6px 16px rgba(var(--primary-rgb),0.12)";
        event.currentTarget.style.borderColor = "var(--danger)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = "0 2px 6px rgba(var(--primary-rgb),0.04)";
        event.currentTarget.style.borderColor = "var(--surface-light)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--info-dark)" }}>{job.jobNumber}</span>
            <span
              style={{
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--info)",
              }}
            >
              {jobSourceLabel}
            </span>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "baseline" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--primary)" }}>{job.reg || "—"}</span>
            <span style={{ fontSize: "14px", color: "var(--info)" }}>{job.makeModel || "Vehicle pending"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "var(--danger-surface)",
              color: "var(--danger)",
              fontWeight: 600,
              fontSize: "13px",
              textTransform: "capitalize",
            }}
          >
            {jobStatus}
          </span>
          {onQuickView ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onQuickView();
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "var(--surface)",
                color: "var(--info-dark)",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ⚡ Quick actions
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: "12px",
        }}
      >
        {infoBlocks.map((block) => (
          <div
            key={block.label}
            style={{
              border: "1px solid var(--info-surface)",
              borderRadius: "12px",
              padding: "12px",
              backgroundColor: "var(--danger-surface)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {block.label}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--info-dark)", marginTop: "4px" }}>{block.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: "13px", color: "var(--info)" }}>
          Scheduled: <strong>{jobDate || "Not scheduled"}</strong>
        </div>
        <div style={{ fontSize: "13px", color: "var(--info)" }}>
          Created: <strong>{createdStamp}</strong>
        </div>
        <div>{renderVhcBadge(job)}</div>
      </div>
    </div>
  );
};
