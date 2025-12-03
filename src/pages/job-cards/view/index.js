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
  const [statusFilters, setStatusFilters] = useState({
    today: new Set(),
    carryOver: new Set(),
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

  const handleStatusToggle = (tab, status) => {
    setStatusFilters((prev) => {
      const nextSet = new Set(prev[tab]);
      if (nextSet.has(status)) {
        nextSet.delete(status);
      } else {
        nextSet.add(status);
      }
      return { ...prev, [tab]: nextSet };
    });
  };

  const resetStatuses = (tab) => {
    setStatusFilters((prev) => ({
      ...prev,
      [tab]: new Set(),
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
  const statusCounts =
    activeTab === "today" ? todayStatusCounts : carryStatusCounts;
  const disabledStatuses = statusFilters[activeTab];
  const searchValue = searchValues[activeTab]?.trim().toLowerCase() || "";

  const filteredByStatus = baseJobs.filter((job) => {
    const jobStatus = job.status || "Unknown";
    if (!statusOptions.includes(jobStatus)) {
      return true;
    }
    return !disabledStatuses.has(jobStatus);
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
            color: "#9ca3af",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#d1d5db",
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
          color: completed ? "#15803d" : "#b45309",
        }}
      >
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: completed ? "#22c55e" : "#f97316",
          }}
        />
        {completed ? "VHC complete" : "VHC pending"}
      </span>
    );
  };

  const combinedStatusOptions = useMemo(() => {
    const union = new Set([...TODAY_STATUSES, ...CARRY_OVER_STATUSES]);
    if (popupJob?.status) {
      union.add(popupJob.status);
    }
    return Array.from(union);
  }, [popupJob]);

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
              color: "#d10000",
              marginBottom: "12px"
            }}>
              Loading Job Cards...
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
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
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              Total Jobs: {jobs.length} · Today&apos;s Workload: {todayJobs.length} · Carry Over: {carryOverJobs.length}
            </p>
          </div>
          <button
            onClick={fetchJobs}
            style={{
              padding: "10px 20px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#b00000")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
          >
            🔄 Refresh
          </button>
        </div>

        <div
          style={{
            display: "flex",
            borderRadius: "12px",
            border: "1px solid #ffe0e0",
            overflow: "hidden",
            width: "fit-content",
          }}
        >
          <button
            onClick={() => setActiveTab("today")}
            style={{
              padding: "10px 24px",
              border: "none",
              backgroundColor: activeTab === "today" ? "#d10000" : "transparent",
              color: activeTab === "today" ? "white" : "#7f1d1d",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
          >
            Today&apos;s Workload
          </button>
          <button
            onClick={() => setActiveTab("carryOver")}
            style={{
              padding: "10px 24px",
              border: "none",
              backgroundColor: activeTab === "carryOver" ? "#d10000" : "transparent",
              color: activeTab === "carryOver" ? "white" : "#7f1d1d",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
          >
            Carry Over
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "white",
            borderRadius: "20px",
            border: "1px solid #f3f4f6",
            boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
            padding: "20px",
            minHeight: "0",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <input
              type="text"
              placeholder="Search job number, registration, or customer"
              value={searchValues[activeTab]}
              onChange={(event) =>
                handleSearchValueChange(activeTab, event.target.value)
              }
              style={{
                flex: "1 1 260px",
                minWidth: "220px",
                padding: "10px 14px",
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                fontSize: "14px",
                outline: "none",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
              }}
            />
            <button
              type="button"
              onClick={() => resetStatuses(activeTab)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "1px solid #ffe0e0",
                backgroundColor: "white",
                color: "#b91c1c",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              All statuses
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            {statusOptions.map((status) => {
              const count = statusCounts[status] || 0;
              const isActive = !disabledStatuses.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusToggle(activeTab, status)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    border: isActive ? "1px solid #d10000" : "1px solid #e5e7eb",
                    backgroundColor: isActive ? "#fff5f5" : "white",
                    color: isActive ? "#b91c1c" : "#4b5563",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{status}</span>
                  <span
                    style={{
                      backgroundColor: isActive ? "#fee2e2" : "#f3f4f6",
                      color: isActive ? "#b91c1c" : "#6b7280",
                      borderRadius: "999px",
                      padding: "0 8px",
                      fontSize: "11px",
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
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ overflowY: "auto", height: "100%" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontSize: "11px",
                      color: "#64748b",
                    }}
                  >
                    {[
                      "Job #",
                      "Reg",
                      "Customer",
                      "Customer Status",
                      "Job Type",
                      "Status",
                      "Appointment",
                      "Requests",
                      "VHC",
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          borderBottom: "1px solid #e2e8f0",
                          position: "sticky",
                          top: 0,
                          background: "#f8fafc",
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        {searchValue
                          ? "No jobs match your search."
                          : "No jobs in this status group."}
                      </td>
                    </tr>
                  ) : (
                    sortedJobs.map((job) => (
                      <tr
                        key={job.jobNumber}
                        onClick={() => setPopupJob(job)}
                        style={{
                          cursor: "pointer",
                          transition: "background-color 0.15s",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.backgroundColor = "#fff7ed";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                          {job.jobNumber}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>
                          {job.reg || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#111827" }}>
                          {job.customer || "Unknown customer"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              backgroundColor: "#e0f2fe",
                              color: "#0c4a6e",
                              fontWeight: 600,
                              fontSize: "12px",
                            }}
                          >
                            {formatCustomerStatusLabel(job.waitingStatus)}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#111827" }}>
                          {deriveJobType(job)}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#111827" }}>
                          {job.status || "Status pending"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>
                          {getAppointmentDisplay(job)}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>
                          {getRequestsCount(job.requests)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>{renderVhcBadge(job)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
              backgroundColor: "rgba(0,0,0,0.5)",
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
                backgroundColor: "white",
                padding: "32px",
                borderRadius: "16px",
                maxWidth: "700px",
                width: "90%",
                maxHeight: "85vh",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
              }}
            >
              {/* Popup Header */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
                      {popupJob.jobNumber}
                    </h2>
                    <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                      {popupJob.customer}
                    </p>
                  </div>
                  {/* ✅ Job Source Badge */}
                  <div style={{
                    backgroundColor: popupJob.jobSource === "Warranty" ? "#ff8800" : "#4CAF50",
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
                background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
                border: "1px solid #ffe5e5",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ fontSize: "14px", color: "#666" }}>
                    <strong>Registration:</strong> {popupJob.reg}
                  </div>
                  {popupJob.makeModel && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Vehicle:</strong> {popupJob.makeModel}
                    </div>
                  )}
                  {popupJob.vin && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>VIN:</strong> {popupJob.vin}
                    </div>
                  )}
                  {popupJob.mileage && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Mileage:</strong> {popupJob.mileage.toLocaleString()} miles
                    </div>
                  )}
                  {/* ✅ Waiting Status */}
                  {popupJob.waitingStatus && popupJob.waitingStatus !== "Neither" && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Customer Status:</strong> {popupJob.waitingStatus}
                    </div>
                  )}
                  {popupJob.appointment && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Appointment:</strong> {popupJob.appointment.date} at {popupJob.appointment.time}
                    </div>
                  )}
                </div>

                {/* ✅ Job Categories */}
                {popupJob.jobCategories && popupJob.jobCategories.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "#666" }}>Job Types:</strong>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                      {popupJob.jobCategories.map((category, idx) => (
                        <span
                          key={idx}
                          style={{
                            backgroundColor: "#e0e0e0",
                            color: "#333",
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
                    <strong style={{ fontSize: "14px", color: "#666" }}>Customer Requests:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                      {popupJob.requests.map((req, idx) => (
                        <li key={idx} style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
                          {req.text || req} 
                          {req.time && <span style={{ color: "#999" }}> ({req.time}h)</span>}
                          {req.paymentType && req.paymentType !== "Customer" && (
                            <span style={{ 
                              marginLeft: "8px", 
                              backgroundColor: "#fff3cd", 
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
                    <strong style={{ fontSize: "14px", color: "#666" }}>Cosmetic Damage:</strong>
                    <p style={{ fontSize: "13px", color: "#666", margin: "4px 0 0 0" }}>
                      {popupJob.cosmeticNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Badges */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div style={{
                  backgroundColor: "#f0f9ff",
                  color: "#0369a1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  VHC Checks: {popupJob.vhcChecks?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "#fef3c7",
                  color: "#92400e",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Parts Requests: {popupJob.partsRequests?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "#f0fdf4",
                  color: "#166534",
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
                    backgroundColor: "#fef3f2",
                    color: "#991b1b",
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
                    backgroundColor: "#ffe4e6",
                    color: "#be123c",
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
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#666", display: "block", marginBottom: "8px" }}>
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
                    border: "1px solid #e0e0e0",
                    backgroundColor: "white",
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
                    backgroundColor: "#d10000",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
                >
                  📝 View Full Details
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}/vhc`)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#dc2626"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#ef4444"}
                >
                  🔍 View VHC
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}/write-up`)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#059669"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#10b981"}
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
                  backgroundColor: "#f5f5f5",
                  color: "#666",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#f5f5f5"}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
