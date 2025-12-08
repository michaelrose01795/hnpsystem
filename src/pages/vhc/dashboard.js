// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/vhc/dashboard.js
"use client";

import React, { useEffect, useState } from "react"; // import React hooks for stateful UI
import Layout from "@/components/Layout"; // import shared layout component
import { useRouter } from "next/router"; // import router hook for navigation
import { getAllJobs } from "@/lib/database/jobs"; // import Supabase helper to fetch jobs
import { getVhcChecksByJob, getVhcWorkflowStatus } from "@/lib/database/vhc"; // import Supabase helpers to fetch VHC data and workflow status
import { useUser } from "@/context/UserContext"; // import context hook to read current user roles
import { getDatabaseClient } from "@/lib/database/client"; // import shared Supabase client for additional VHC history lookups
import {
  STATUS_COLORS,
  VALID_VHC_STATUSES,
  computeSeverityTotals,
  deriveVhcDashboardStatus,
  parseVhcBuilderPayload,
  summariseTechnicianVhc,
} from "@/lib/vhc/summary";

const supabase = getDatabaseClient(); // reuse a single Supabase client instance

// ✅ Badge palette used to keep all severity chips on brand
const ITEM_STATUS_COLORS = {
  Red: { background: "rgba(var(--danger-rgb), 0.16)", color: "var(--danger)", border: "rgba(var(--danger-rgb), 0.32)" },
  Amber: { background: "rgba(var(--warning-rgb), 0.16)", color: "var(--warning)", border: "rgba(var(--warning-rgb), 0.32)" },
  Green: { background: "rgba(var(--info-rgb), 0.16)", color: "var(--info-dark)", border: "rgba(var(--info-rgb), 0.32)" },
  Neutral: { background: "rgba(var(--grey-accent-rgb), 0.16)", color: "var(--info-dark)", border: "rgba(var(--grey-accent-rgb), 0.28)" },
};

// ✅ Text color palette for individual concern lines
const CONCERN_STATUS_COLORS = {
  Red: "var(--danger)",
  Amber: "var(--warning)",
  Green: "var(--info-dark)",
  Grey: "var(--info)",
};

// ✅ Derive human readable text for how long ago a timestamp occurred (in months)
const formatMonthsAgo = (timestamp) => {
  if (!timestamp) return null;
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  const diffMonths = Math.max(0, (now - then) / (1000 * 60 * 60 * 24 * 30));
  const rounded = Math.max(1, Math.round(diffMonths));
  return `${rounded} month${rounded === 1 ? "" : "s"} ago`;
};


// ✅ Helper function to get customer name
const getCustomerName = (customer) => {
  if (!customer) return "N/A"; // handle missing customer
  if (typeof customer === "string") return customer; // simple string
  if (typeof customer === "object") {
    return `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email || "N/A"; // combine object fields
  }
  return "N/A"; // default fallback
};

// ✅ Get last visit bubble color
const getLastVisitColor = (lastVisitDate) => {
  if (!lastVisitDate || lastVisitDate === "First visit") return null; // no bubble for first visit

  const visitDate = new Date(lastVisitDate); // parse last visit date
  const today = new Date(); // current date
  const monthsDiff = (today - visitDate) / (1000 * 60 * 60 * 24 * 30); // approximate months difference

  if (monthsDiff <= 4) return "var(--info)"; // recent visit -> green
  return "var(--warning)"; // otherwise amber
};

// ✅ Get next service bubble color
const getNextServiceColor = (nextServiceDate) => {
  if (!nextServiceDate || nextServiceDate === "Not scheduled") return null; // skip if unscheduled

  const serviceDate = new Date(nextServiceDate); // parse next service date
  const today = new Date(); // current date
  const monthsDiff = (serviceDate - today) / (1000 * 60 * 60 * 24 * 30); // approximate months until next service

  if (monthsDiff <= 1) return "var(--danger)"; // due within a month -> red
  if (monthsDiff <= 3) return "var(--warning)"; // due within three months -> amber
  return "var(--info)"; // plenty of time -> green
};

// ✅ Get MOT expiry bubble color
const getMOTColor = (motExpiry) => {
  if (!motExpiry) return null; // skip if no MOT date

  const expiryDate = new Date(motExpiry); // parse expiry date
  const today = new Date(); // current date
  const monthsDiff = (expiryDate - today) / (1000 * 60 * 60 * 24 * 30); // approximate months until expiry

  if (monthsDiff < 1) return "var(--danger)"; // expires within a month -> red
  if (monthsDiff < 3) return "var(--warning)"; // expires within three months -> amber
  if (monthsDiff >= 4) return "var(--info)"; // more than four months -> green
  return "var(--warning)"; // default amber
};

// ✅ Build badge styles for section/item badges
const buildBadgeStyle = (status) => {
  const palette = ITEM_STATUS_COLORS[status] || ITEM_STATUS_COLORS.Neutral; // choose palette or neutral fallback
  return {
    backgroundColor: palette.background, // badge background color
    color: palette.color, // badge text color
    border: `1px solid ${palette.border}`, // badge border color
    borderRadius: "999px", // pill badge shape
    padding: "2px 10px", // badge padding
    fontSize: "11px", // badge text size
    fontWeight: "600", // make it bold for clarity
    letterSpacing: "0.3px", // subtle spacing for readability
  };
};

// ✅ Resolve concern status color with safe fallback
const getConcernColor = (status) => CONCERN_STATUS_COLORS[status] || CONCERN_STATUS_COLORS.Grey;

// ✅ VHC Job Card Component
const VHCJobCard = ({ job, onClick, partsMode }) => {
  const router = useRouter(); // enable in-card navigation for severity counters
  const lastVisitColor = getLastVisitColor(job.lastVisit); // determine color for last visit pill
  const nextServiceColor = getNextServiceColor(job.nextService); // determine color for next service pill
  const motColor = getMOTColor(job.motExpiry); // determine color for MOT pill
  const statusColor = STATUS_COLORS[job.vhcStatus] || "var(--info)"; // pick brand color for status badge

  const renderSectionMetrics = (section) => (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {section.metrics.red > 0 ? (
        <span style={{ ...buildBadgeStyle("Red"), fontSize: "10px" }}>
          {section.metrics.red} Red
        </span>
      ) : null}
      {section.metrics.amber > 0 ? (
        <span style={{ ...buildBadgeStyle("Amber"), fontSize: "10px" }}>
          {section.metrics.amber} Amber
        </span>
      ) : null}
      {section.metrics.grey > 0 ? (
        <span style={{ ...buildBadgeStyle("Neutral"), fontSize: "10px" }}>
          {section.metrics.grey} Grey
        </span>
      ) : null}
    </div>
  );

  const renderSectionItem = (item, index) => {
    const badgeStyle = buildBadgeStyle(item.status || "Neutral"); // compute badge colors
    const showBadge = item.status && item.status !== "Neutral"; // hide neutral badges to reduce noise
    return (
      <div
        key={`${item.heading}-${index}`}
        style={{
          border: "1px solid var(--info-surface)",
          borderRadius: "10px",
          backgroundColor: "var(--surface)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent-purple)" }}>{item.heading}</span>
          {showBadge ? <span style={badgeStyle}>{item.status}</span> : null}
        </div>
        {item.rows?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {item.rows.map((line, lineIdx) => (
              <span key={`${item.heading}-row-${lineIdx}`} style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                {line}
              </span>
            ))}
          </div>
        ) : null}
        {item.concerns?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {item.concerns.map((concern, concernIdx) => (
              <div
                key={`${item.heading}-concern-${concernIdx}`}
                style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}
              >
                <span style={{ fontSize: "10px", color: "var(--info)", lineHeight: "18px" }}>•</span>
                <span style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                  <span style={{ fontWeight: "600", color: getConcernColor(concern.status) }}>
                    {concern.status}:
                  </span>{" "}
                  {concern.text}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        border: "1px solid var(--surface-light)",
        padding: "16px 20px",
        borderRadius: "12px",
        backgroundColor: "var(--surface)",
        boxShadow: "none",
        cursor: "pointer",
        transition: "all 0.3s ease",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)"; // lift card on hover
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(var(--primary-rgb),0.15)"; // add red glow
        e.currentTarget.style.borderColor = "var(--danger)"; // tint border red
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"; // reset transform
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(var(--shadow-rgb),0.05)"; // reset shadow
        e.currentTarget.style.borderColor = "var(--surface-light)"; // reset border color
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          width: "100%",
        }}
      >
        {/* Left Side - Vehicle and customer info */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", width: "600px", flexShrink: 0 }}>
          <div
            style={{
              backgroundColor: statusColor,
              color: "white",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              whiteSpace: "nowrap",
              minWidth: "160px",
              textAlign: "center",
            }}
          >
            {job.vhcStatus}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                }}
              >
                {job.reg || "N/A"}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--grey-accent)",
                  whiteSpace: "nowrap",
                }}
              >
                {getCustomerName(job.customer)}
              </span>
            </div>
            <span
              style={{
                fontSize: "13px",
                color: "var(--grey-accent-light)",
                whiteSpace: "nowrap",
              }}
            >
              {job.makeModel || "N/A"}
            </span>
          </div>
        </div>

        {/* Right Side - status metrics */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flex: 1,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ textAlign: "center", minWidth: "90px" }}>
            {lastVisitColor ? (
              <div
                style={{
                  backgroundColor: lastVisitColor,
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {job.lastVisit}
              </div>
            ) : (
              <span style={{ fontSize: "11px", color: "var(--background)" }}>First visit</span>
            )}
          </div>

          <div style={{ textAlign: "center", minWidth: "90px" }}>
            {nextServiceColor ? (
              <div
                style={{
                  backgroundColor: nextServiceColor,
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {job.nextService}
              </div>
            ) : (
              <span style={{ fontSize: "11px", color: "var(--background)" }}>-</span>
            )}
          </div>

          <div style={{ textAlign: "center", minWidth: "90px" }}>
            {motColor ? (
              <div
                style={{
                  backgroundColor: motColor,
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {job.motExpiry || "N/A"}
              </div>
            ) : (
              <span style={{ fontSize: "11px", color: "var(--background)" }}>-</span>
            )}
          </div>

          <div
            style={{ textAlign: "center", minWidth: "70px", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/vhc/${job.jobNumber}`);
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                color: "var(--danger)",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                alignItems: "center",
              }}
            >
              <span>{job.redIssues || 0}</span>
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Red</span>
            </div>
          </div>

          <div
            style={{ textAlign: "center", minWidth: "70px", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/vhc/${job.jobNumber}`);
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(var(--warning-rgb), 0.12)",
                color: "var(--warning)",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                alignItems: "center",
              }}
            >
              <span>{job.amberIssues || 0}</span>
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Amber</span>
            </div>
          </div>

          {job.partsCount > 0 && (
            <div style={{ textAlign: "center", minWidth: "80px" }}>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--warning)",
                }}
              >
                £{job.partsValue || "0.00"}
              </span>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--warning)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Parts
              </div>
            </div>
          )}
        </div>
      </div>

      {job.vhcSections?.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {job.vhcSections.map((section) => (
            <div
              key={section.key}
              style={{
                flex: "1 1 260px",
                minWidth: "260px",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary)" }}>{section.title}</span>
                {renderSectionMetrics(section)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {section.items.map((item, idx) => renderSectionItem(item, idx))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ✅ Status filter tabs used by the dashboard header
const STATUS_TABS = ["All", ...VALID_VHC_STATUSES];

// ✅ Main VHC dashboard page component
export default function VHCDashboard() {
  const router = useRouter(); // router for navigation
  const [vhcJobs, setVhcJobs] = useState([]); // store jobs shown on dashboard
  const [loading, setLoading] = useState(true); // loading state for fetch cycle
  const [filter, setFilter] = useState("All"); // active status filter
  const [search, setSearch] = useState({ reg: "", jobNumber: "", customer: "" }); // search inputs
  const [currentPage, setCurrentPage] = useState(1); // pagination state
  const itemsPerPage = 10; // page size
  const { user } = useUser(); // current user context
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase()); // normalise role list
  const isPartsRole = userRoles.some((role) => role === "parts" || role === "parts manager"); // detect parts users
  const workshopViewRoles = [
    "service",
    "service manager",
    "workshop manager",
    "after sales director",
    "general manager",
    "admin",
    "techs",
  ]; // roles allowed to see full workshop data
  const hasWorkshopPrivileges = userRoles.some((role) => workshopViewRoles.includes(role)); // detect workshop access
  const partsOnlyMode = isPartsRole && !hasWorkshopPrivileges; // limit parts team to relevant jobs

  useEffect(() => {
    const fetchVhcJobs = async () => {
      setLoading(true); // start loading state
      console.log("Fetching VHC dashboard data..."); // debug log

      try {
        const jobs = await getAllJobs(); // fetch jobs from Supabase
        console.log("Jobs fetched:", jobs.length); // debug count

        const vhcEligibleJobs = jobs.filter((job) => job.vhcRequired === true);
        console.log(
          "Jobs requiring VHC or carrying standalone part requests:",
          vhcEligibleJobs.length,
        ); // debug filtered count

        // Build a vehicle registration -> last VHC sent timestamp map using the vhc_send_history table
        const jobIdToReg = new Map();
        const allJobIds = [];
        jobs.forEach((job) => {
          if (typeof job.id === "number") {
            allJobIds.push(job.id);
            if (job.reg) {
              jobIdToReg.set(job.id, job.reg.toUpperCase());
            }
          }
        });

        let regLastVhcMap = new Map();
        if (allJobIds.length > 0) {
          const { data: historyRows, error: historyError } = await supabase
            .from("vhc_send_history")
            .select("job_id, sent_at")
            .in("job_id", allJobIds);

          if (historyError) {
            console.error("Error loading VHC send history:", historyError);
          } else {
            regLastVhcMap = historyRows.reduce((map, row) => {
              const reg = jobIdToReg.get(row.job_id);
              if (!reg) return map;
              const current = map.get(reg);
              const rowDate = row.sent_at ? new Date(row.sent_at).getTime() : null;
              if (!rowDate || Number.isNaN(rowDate)) return map;
              if (!current || rowDate > current) {
                map.set(reg, rowDate);
              }
              return map;
            }, new Map());
          }
        }

        const jobsWithVhcRaw = await Promise.all(
          vhcEligibleJobs.map(async (job) => {
            const checks = await getVhcChecksByJob(job.id); // fetch technician VHC records (note: lowercase 'hc')
            let workflow = null;
            try {
              workflow = await getVhcWorkflowStatus(job.id); // pull workflow snapshot so statuses mirror job card + appointments
            } catch (workflowError) {
              console.error("Failed to load VHC workflow status", workflowError);
            }

            const allocationCount = Array.isArray(job.partsAllocations)
              ? job.partsAllocations.length
              : 0; // count allocations tied to job
            const requestCount = Array.isArray(job.partsRequests)
              ? job.partsRequests.length
              : 0; // count raw part requests
            const partsCount = allocationCount + requestCount; // combined parts counter

            const builderPayload = parseVhcBuilderPayload(checks); // extract technician VHC JSON blob
            const builderSummary = summariseTechnicianVhc(builderPayload); // summarise into dashboard sections
            const hasBuilderSections = builderSummary.sections.length > 0; // track whether we have technician data
            const hasTechnicianData = hasBuilderSections || checks.length > 0;

            const legacyRedIssues = checks.filter((check) =>
              typeof check.section === "string" && check.section.toLowerCase().includes("brake"),
            ).length; // legacy red counts from classic checks
            const legacyAmberIssues = checks.filter((check) =>
              typeof check.section === "string" && check.section.toLowerCase().includes("tyre"),
            ).length; // legacy amber counts from classic checks

            const sectionItemCount = hasBuilderSections
              ? Math.max(builderSummary.itemCount, builderSummary.sections.length)
              : checks.length > 0
              ? checks.length
              : partsCount; // number of cards/sections available for counter display

            const workflowRequiresVhc = workflow?.vhcRequired;
            if (workflowRequiresVhc === false) {
              return null;
            }

            const workflowHasActivity = Boolean(
              (workflow?.vhcChecksCount || 0) > 0 ||
                workflow?.vhcSentAt ||
                workflow?.lastSentAt ||
                workflow?.authorizationCount ||
                workflow?.declinationCount ||
                workflow?.vhcCompletedAt,
            );
            const hasVhcState = hasTechnicianData || workflowHasActivity;
            const meetsInclusionRule = Boolean(job.checkedInAt) || hasVhcState;

            const vhcStatus = deriveVhcDashboardStatus({
              job,
              workflow,
              hasChecks: hasTechnicianData,
            }); // resolve dashboard status directly from workflow + job fields

            if (!vhcStatus || !VALID_VHC_STATUSES.includes(vhcStatus) || !meetsInclusionRule) {
              return null;
            }

            const severityTotals = computeSeverityTotals({
              builderSummary,
              checks,
              legacyRedIssues,
              legacyAmberIssues,
            }); // aggregate severity counts across builder + legacy data
            const redIssues = severityTotals.red; // final red count
            const amberIssues = severityTotals.amber; // final amber count
            const greyIssues = severityTotals.grey; // final grey count

            const allocationValue = (job.partsAllocations || []).reduce((sum, allocation) => {
              const qty = allocation.quantityRequested || allocation.quantityAllocated || 0; // use requested or allocated quantity
              const price = Number.parseFloat(allocation.unitPrice) || 0; // unit price for allocation
              return sum + qty * price; // accumulate allocation value
            }, 0);
            const requestValue = (job.partsRequests || []).reduce((sum, request) => {
              const qty = request.quantity || request.quantityRequested || 0; // use available quantity field
              const price = Number.parseFloat(request.unitPrice) || 0; // unit price for request
              return sum + qty * price; // accumulate request value
            }, 0);
            const partsValue = allocationValue + requestValue; // combined parts value for display

            return {
              id: job.id,
              jobNumber: job.jobNumber,
              reg: job.reg,
              customer: job.customer,
              makeModel: job.makeModel,
              vhcStatus,
              workflowStatus: workflow?.status || null,
              vhcSections: hasBuilderSections ? builderSummary.sections : [],
              sectionItemCount,
              redIssues,
              amberIssues,
              greyIssues,
              partsCount,
              partsValue: partsValue.toFixed(2),
              lastVisit: (() => {
                const regKey = job.reg ? job.reg.toUpperCase() : null;
                const lastVhcMs = regKey ? regLastVhcMap.get(regKey) : null;
                if (!lastVhcMs) return "First Visit";
                const label = formatMonthsAgo(lastVhcMs);
                return label || "First Visit";
              })(),
              nextService: job.nextService || "Not scheduled",
              motExpiry: job.motExpiry || null,
              createdAt: job.createdAt,
            };
          }),
        );

        const jobsWithVhc = jobsWithVhcRaw.filter(Boolean);

        const scopedJobs = partsOnlyMode
          ? jobsWithVhc.filter((job) => {
              if (job.partsCount > 0) return true; // parts users see jobs with parts activity
              return (job.redIssues || 0) > 0 || (job.amberIssues || 0) > 0; // otherwise only show jobs with actionable items
            })
          : jobsWithVhc; // workshop roles see all filtered jobs

        console.log("VHC data processed for", scopedJobs.length, "jobs"); // debug log
        setVhcJobs(scopedJobs); // update state with processed data
      } catch (error) {
        console.error("Error fetching VHC data:", error); // log fetch failure
      } finally {
        setLoading(false); // stop loading state
      }
    };

    fetchVhcJobs(); // kick off fetch cycle
  }, [partsOnlyMode]);

  const filteredJobs = vhcJobs
    .filter((job) => filter === "All" || job.vhcStatus === filter) // status filter
    .filter((job) => {
      const customerName = getCustomerName(job.customer).toLowerCase(); // normalise customer name
      return (
        job.reg?.toLowerCase().includes(search.reg.toLowerCase()) &&
        job.jobNumber?.toString().includes(search.jobNumber) &&
        customerName.includes(search.customer.toLowerCase())
      ); // apply search filters
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first ordering

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1; // derive total pagination pages
  const startIndex = (currentPage - 1) * itemsPerPage; // current page start index
  const endIndex = startIndex + itemsPerPage; // current page end index
  const currentJobs = filteredJobs.slice(startIndex, endIndex); // jobs to display on the current page

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage); // update page when within bounds
    }
  };

  useEffect(() => {
    setCurrentPage(1); // reset pagination when filters change
  }, [filter, search]);

  const handleJobClick = (jobNumber) => {
    router.push(`/vhc/details/${jobNumber}`); // navigate to technician detail view
  };

  return (
    <Layout>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "8px 16px",
          overflow: "hidden",
        }}
      >
        {/* Search Section */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "12px",
            padding: "12px",
            backgroundColor: "var(--search-surface)",
            borderRadius: "8px",
            boxShadow: "none",
            flexShrink: 0,
            color: "var(--search-text)",
          }}
        >
          <input
            type="search"
            placeholder="Search Registration"
            value={search.reg}
            onChange={(e) => setSearch({ ...search, reg: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid var(--search-surface-muted)",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "var(--search-surface)",
              color: "var(--search-text)",
            }}
          />
          <input
            type="search"
            placeholder="Search Job Number"
            value={search.jobNumber}
            onChange={(e) => setSearch({ ...search, jobNumber: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid var(--search-surface-muted)",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "var(--search-surface)",
              color: "var(--search-text)",
            }}
          />
          <input
            type="search"
            placeholder="Search Customer"
            value={search.customer}
            onChange={(e) => setSearch({ ...search, customer: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid var(--search-surface-muted)",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "var(--search-surface)",
              color: "var(--search-text)",
            }}
          />
        </div>

        {/* Status Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "12px",
            overflowX: "auto",
            paddingBottom: "4px",
            flexShrink: 0,
          }}
        >
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: "8px 16px",
                border: filter === status ? "2px solid var(--primary)" : "1px solid var(--primary)",
                color: filter === status ? "var(--surface)" : "var(--primary)",
                backgroundColor: filter === status ? "var(--primary)" : "var(--surface)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: filter === status ? "600" : "500",
                fontSize: "14px",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {partsOnlyMode && (
          <div
            style={{
              backgroundColor: "var(--warning-surface)",
              border: "1px solid var(--warning)",
              borderRadius: "12px",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
              color: "var(--danger-dark)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong>Parts-focused VHC view</strong>
              <span style={{ fontSize: "13px" }}>
                Showing jobs with outstanding part requests or costed VHC recommendations so you can update customer-ready information.
              </span>
            </div>
          </div>
        )}

        {/* Job List Section */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: "24px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            padding: "24px",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {loading ? null : filteredJobs.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <p style={{ color: "var(--grey-accent)", fontSize: "18px", fontWeight: "600" }}>
                No VHC reports found
              </p>
            </div>
          ) : (
            <>
              {/* Column Headers */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingBottom: "16px",
                  marginBottom: "16px",
                  borderBottom: "2px solid var(--surface-light)",
                  flexShrink: 0,
                }}
              >
                <div style={{ width: "600px", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                    VEHICLE DETAILS
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    flex: 1,
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>Last Visit</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>Next Service</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>MOT</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Red</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Amber</span>
                </div>
              </div>

              {/* Job Cards */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingRight: "8px",
                  marginBottom: "16px",
                  minHeight: 0,
                }}
              >
                {currentJobs.map((job) => (
                  <VHCJobCard
                    key={job.id}
                    job={job}
                    partsMode={partsOnlyMode}
                    onClick={() => handleJobClick(job.jobNumber)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div
                style={{
                  flexShrink: 0,
                  paddingTop: "16px",
                  borderTop: "2px solid var(--surface-light)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid var(--surface-light)",
                      backgroundColor: currentPage === 1 ? "var(--surface)" : "var(--surface)",
                      color: currentPage === 1 ? "var(--grey-accent-light)" : "var(--text-secondary)",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid var(--surface-light)",
                      backgroundColor: currentPage === totalPages ? "var(--surface)" : "var(--surface)",
                      color: currentPage === totalPages ? "var(--grey-accent-light)" : "var(--text-secondary)",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Next →
                  </button>
                </div>
                <span style={{ display: "block", textAlign: "center", fontSize: "12px", color: "var(--grey-accent-light)" }}>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
