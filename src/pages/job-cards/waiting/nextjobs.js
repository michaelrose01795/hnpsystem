// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useMemo, useEffect } from "react"; // Core React hooks
import Layout from "@/components/Layout"; // Main layout wrapper
import { useUser } from "@/context/UserContext"; // Logged-in user context
import { useRoster } from "@/context/RosterContext";
import { useRouter } from "next/router"; // Next.js router for navigation
import { 
  getAllJobs, 
  assignTechnicianToJob, 
  unassignTechnicianFromJob, 
  updateJobPosition 
} from "@/lib/database/jobs"; // ✅ Fetch and update jobs from Supabase
import { getTechnicianUsers, getMotTesterUsers } from "@/lib/database/users";
import { normalizeDisplayName } from "@/utils/nameUtils";

// Layout constants ensure consistent panel sizing and scroll thresholds
const VISIBLE_JOBS_PER_PANEL = 5;
const JOB_CARD_HEIGHT = 68; // px height per job card (including padding)
const JOB_CARD_VERTICAL_GAP = 8; // px gap between cards
const JOB_LIST_MAX_HEIGHT =
  VISIBLE_JOBS_PER_PANEL * JOB_CARD_HEIGHT +
  (VISIBLE_JOBS_PER_PANEL - 1) * JOB_CARD_VERTICAL_GAP;
const PANEL_EXTRA_SPACE = 110; // header, counters, padding
const PANEL_HEIGHT = JOB_LIST_MAX_HEIGHT + PANEL_EXTRA_SPACE;
const JOB_LIST_MAX_HEIGHT_PX = `${JOB_LIST_MAX_HEIGHT}px`;
const PANEL_HEIGHT_PX = `${PANEL_HEIGHT}px`;

// Strict role checks
const isTechRole = (role) => {
  if (!role) return false;
  const normalized = String(role).toLowerCase();
  return normalized.includes("tech");
};

const isMotRole = (role) => {
  if (!role) return false;
  const normalized = String(role).toLowerCase();
  return normalized.includes("mot");
};

export default function NextJobsPage() {
  // ✅ Hooks
  const { user } = useUser(); // Current logged-in user
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const router = useRouter(); // Next.js router for navigation
  const [jobs, setJobs] = useState([]); // Jobs from database
  const [dbTechnicians, setDbTechnicians] = useState([]);
  const [dbMotTesters, setDbMotTesters] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null); // Job selected for popup
  const [assignPopup, setAssignPopup] = useState(false); // Assign popup
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const [draggingJob, setDraggingJob] = useState(null); // Job being dragged
  const [dragOverTarget, setDragOverTarget] = useState(null); // Track which section/tech is being hovered over
  const [dragOverJob, setDragOverJob] = useState(null); // Track which specific job is being hovered over
  const [feedbackMessage, setFeedbackMessage] = useState(null); // Success/error feedback
  const [loading, setLoading] = useState(true); // Loading state

  // ✅ Manager access check
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole?.["Workshop Manager"] || []),
    ...(usersByRole?.["Service Manager"] || []),
    ...(usersByRole?.["After Sales Director"] || []),
    ...(usersByRole?.["After Sales Manager"] || []),
    ...(usersByRole?.["Admin Manager"] || []),
  ];
  const allowedRoles = new Set([
    "WORKSHOP MANAGER",
    "SERVICE MANAGER",
    "AFTER SALES DIRECTOR",
    "AFTER SALES MANAGER",
    "ADMIN MANAGER",
  ]);
  const normalizedRoles = (user?.roles || []).map((role) =>
    typeof role === "string" ? role.toUpperCase() : ""
  );
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
  const hasAccess =
    allowedUsers.includes(username) ||
    normalizedRoles.some((role) => allowedRoles.has(role));

  const fallbackTechs = useMemo(
    () =>
      (usersByRole?.["Techs"] || []).map((name, index) => ({
        id: `tech-${index + 1}`,
        name,
      })),
    [usersByRole]
  );

  const fallbackMot = useMemo(
    () =>
      (usersByRole?.["MOT Tester"] || []).map((name, index) => ({
        id: `mot-${index + 1}`,
        name,
      })),
    [usersByRole]
  );

  // ✅ Fetch jobs from Supabase on component mount
  useEffect(() => {
    fetchJobs();
    fetchTechnicians();
  }, []);

  const fetchJobs = async () => {
    setLoading(true); // Start loading
    const fetchedJobs = await getAllJobs(); // Fetch all jobs from database

    // Only include jobs with a real job number (actual job cards)
    const filtered = fetchedJobs.filter(
      (job) => job.jobNumber && job.jobNumber.trim() !== ""
    );

    setJobs(filtered); // Update state with filtered jobs
    setLoading(false); // Stop loading
    return filtered;
  };

  const fetchTechnicians = async () => {
    try {
      const [techList, testerList] = await Promise.all([
        getTechnicianUsers(),
        getMotTesterUsers(),
      ]);
      setDbTechnicians(techList);
      setDbMotTesters(testerList);
    } catch (err) {
      console.error("❌ Error fetching technicians:", err);
    }
  };

  const staffDirectory = useMemo(() => {
    const map = new Map();

    const mergePerson = (person, roleTag, index, prefix) => {
      if (!person) return;
      const label =
        person.name ||
        person.displayName ||
        person.fullName ||
        person.email ||
        (typeof person === "string" ? person : "");
      const normalized = normalizeDisplayName(label);
      if (!normalized) return;

      const fallbackName =
        label ||
        `${roleTag === "tech" ? "Technician" : "MOT"} ${index + 1}`;
      const fallbackId =
        person.id ??
        person.user_id ??
        person.email ??
        `${prefix}-${index}`;

      const existing = map.get(normalized) || {
        id: fallbackId || normalized,
        name: fallbackName,
        email: person.email || "",
        roles: new Set(),
      };

      if (!existing.name && fallbackName) existing.name = fallbackName;
      if (!existing.email && person.email) existing.email = person.email;
      if (!existing.id && fallbackId) existing.id = fallbackId;

      existing.roles.add(roleTag);
      map.set(normalized, existing);
    };

    const techSource = dbTechnicians.length > 0 ? dbTechnicians : fallbackTechs;
    techSource.forEach((person, index) => mergePerson(person, "tech", index, "tech"));

    const motSource = dbMotTesters.length > 0 ? dbMotTesters : fallbackMot;
    motSource.forEach((person, index) => mergePerson(person, "mot", index, "mot"));

    jobs.forEach((job) => {
      const rawName =
        job.assignedTech?.name ||
        job.technician ||
        (typeof job.assignedTo === "string" ? job.assignedTo : "");

      const normalized = normalizeDisplayName(rawName);
      if (!normalized) return;

      const roleHint =
        job.assignedTech?.role ||
        job.technicianRole ||
        job.technician?.role ||
        "";

      let inferredRole = null;
      if (isMotRole(roleHint)) inferredRole = "mot";
      else if (isTechRole(roleHint)) inferredRole = "tech";

      if (!inferredRole) return;

      const existing = map.get(normalized) || {
        id: job.assignedTech?.id || `db-${inferredRole}-${normalized}`,
        name: rawName?.trim() || "Unnamed Staff",
        email: job.assignedTech?.email || "",
        roles: new Set(),
      };

      if (!existing.name && rawName) existing.name = rawName.trim();
      if (!existing.email && job.assignedTech?.email) existing.email = job.assignedTech.email;
      existing.roles.add(inferredRole);
      map.set(normalized, existing);
    });

    return Array.from(map.entries()).map(([normalized, entry]) => ({
      ...entry,
      normalizedName: normalized,
      roles: Array.from(entry.roles),
    }));
  }, [jobs, dbTechnicians, dbMotTesters, fallbackTechs, fallbackMot]);

  const techPanelList = useMemo(
    () => staffDirectory.filter((person) => person.roles.includes("tech")),
    [staffDirectory]
  );

  const motPanelList = useMemo(
    () => staffDirectory.filter((person) => person.roles.includes("mot")),
    [staffDirectory]
  );

  const assignableStaffList = useMemo(
    () =>
      staffDirectory.map((staff) => ({
        id: staff.id || staff.normalizedName,
        name: staff.name,
      })),
    [staffDirectory]
  );

  // ✅ Filter ALL outstanding/not started jobs (unassigned AND not completed)
  // These are jobs that are not finished - they show in the top section
  const unassignedJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const completedStatuses = ["Completed", "Finished", "Closed", "Invoiced", "Collected"];
        const assignedName =
          job.assignedTech?.name ||
          job.technician ||
          (typeof job.assignedTo === "string" ? job.assignedTo : "");

        const normalizedAssigned = normalizeDisplayName(assignedName);
        const hasAssignedTech =
          (normalizedAssigned && normalizedAssigned.length > 0) ||
          (typeof job.assignedTo === "number" && job.assignedTo !== null);

        return !completedStatuses.includes(job.status) && !hasAssignedTech;
      }),
    [jobs]
  );

  // ✅ Search logic for job cards in the outstanding section
  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return unassignedJobs; // Return all unassigned jobs if no search term
    const lower = searchTerm.toLowerCase(); // Convert search term to lowercase for case-insensitive search
    return unassignedJobs.filter(
      (job) =>
        job.jobNumber?.toLowerCase().includes(lower) || // Search in job number
        job.customer?.toLowerCase().includes(lower) || // Search in customer name
        job.make?.toLowerCase().includes(lower) || // Search in make
        job.model?.toLowerCase().includes(lower) || // Search in model
        job.reg?.toLowerCase().includes(lower) // Search in registration
    );
  }, [searchTerm, unassignedJobs]); // Recalculate when search term or unassigned jobs change

  // ✅ Group jobs by technician (using assignedTech.name)
  const getJobsForAssignee = (assigneeName) => {
    const normalizedAssignee = normalizeDisplayName(assigneeName);

    return jobs
      .filter((job) => {
        const assignedNameRaw =
          job.assignedTech?.name ||
          job.technician ||
          (typeof job.assignedTo === "string" ? job.assignedTo : "");

        const jobAssignedName = normalizeDisplayName(assignedNameRaw);

        return jobAssignedName && jobAssignedName === normalizedAssignee;
      })
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  };

  const assignedJobs = useMemo(
    () =>
      techPanelList.map((tech, index) => ({
        ...tech,
        panelKey: `${tech.id || tech.normalizedName || "tech"}-tech-${index}`,
        jobs: getJobsForAssignee(tech.name),
      })),
    [jobs, techPanelList]
  );

  const assignedMotJobs = useMemo(
    () =>
      motPanelList.map((tester, index) => ({
        ...tester,
        panelKey: `${tester.id || tester.normalizedName || "mot"}-mot-${index}`,
        jobs: getJobsForAssignee(tester.name),
      })),
    [jobs, motPanelList]
  );

  const handleOpenJobDetails = (job) => {
    setFeedbackMessage(null);
    setSelectedJob(job);
  };

  const handleCloseJobDetails = () => {
    setFeedbackMessage(null);
    setSelectedJob(null);
  };

  const handleOpenAssignPopup = () => {
    setFeedbackMessage(null);
    setAssignPopup(true);
  };

  // ✅ NEW: Handle Edit Job - Navigate to create page with job data
  const handleEditJob = () => {
    if (!selectedJob) return;
    router.push(`/job-cards/create?edit=${selectedJob.id}`);
  };

  // ✅ Assign technician to a job (save to Supabase)
  const assignTechToJob = async (tech) => {
    if (!selectedJob) return; // Exit if no job selected
    const jobId = selectedJob.id;
    const jobNumber = selectedJob.jobNumber;
    const technicianName = tech.name;
    const rawIdentifier = tech.id ?? tech.user_id ?? technicianName;
    const technicianIdentifier =
      rawIdentifier && Number.isInteger(Number(rawIdentifier))
        ? Number(rawIdentifier)
        : rawIdentifier;

    console.log("🔄 Assigning technician:", technicianName, "to job:", jobId); // Debug log
    setFeedbackMessage(null);

    // Use the dedicated helper function - it now returns formatted job data or null
    let updatedJob;
    try {
      updatedJob = await assignTechnicianToJob(
        jobId,
        technicianIdentifier,
        technicianName
      );
    } catch (err) {
      console.error("❌ Exception assigning technician:", err);
      setAssignPopup(false);
      setFeedbackMessage({
        type: "error",
        text: `Failed to assign ${jobNumber} to ${technicianName}: ${err?.message || "Unknown error"}`,
      });
      return;
    }

    if (!updatedJob?.success) {
      console.error("❌ Failed to assign technician:", updatedJob?.error);
      setAssignPopup(false);
      setFeedbackMessage({
        type: "error",
        text: `Failed to assign ${jobNumber} to ${technicianName}${
          updatedJob?.error?.message ? `: ${updatedJob.error.message}` : ""
        }`,
      });
      return;
    }

    console.log("✅ Technician assigned successfully:", updatedJob); // Debug log

    const latestJobs = await fetchJobs();
    const refreshedJob = latestJobs.find((job) => job.id === jobId);

    setAssignPopup(false); // Close assign popup
    setSelectedJob(refreshedJob || selectedJob); // Keep modal open with latest info
    setFeedbackMessage({
      type: "success",
      text: `Job ${jobNumber} assigned to ${technicianName}`,
    });
  };

  // ✅ Unassign technician (save to Supabase)
  const unassignTechFromJob = async () => {
    if (!selectedJob) return; // Exit if no job selected
    const jobId = selectedJob.id;
    const jobNumber = selectedJob.jobNumber;

    console.log("🔄 Unassigning technician from job:", jobId); // Debug log
    setFeedbackMessage(null);

    // Use the dedicated helper function - it now returns formatted job data or null
    let updatedJob;
    try {
      updatedJob = await unassignTechnicianFromJob(jobId);
    } catch (err) {
      console.error("❌ Exception unassigning technician:", err);
      setFeedbackMessage({
        type: "error",
        text: `Failed to unassign technician from ${jobNumber}: ${err?.message || "Unknown error"}`,
      });
      return;
    }

    if (!updatedJob?.success) {
      console.error("❌ Failed to unassign technician:", updatedJob?.error);
      setFeedbackMessage({
        type: "error",
        text: `Failed to unassign technician from ${jobNumber}${
          updatedJob?.error?.message ? `: ${updatedJob.error.message}` : ""
        }`,
      });
      return;
    }

    console.log("✅ Technician unassigned successfully:", updatedJob); // Debug log

    const latestJobs = await fetchJobs();
    const refreshedJob = latestJobs.find((job) => job.id === jobId);

    setSelectedJob(refreshedJob || selectedJob);
    setFeedbackMessage({
      type: "success",
      text: `Technician unassigned from job ${jobNumber}`,
    });
  };

  // ✅ Drag handlers for reordering and reassigning
  const handleDragStart = (job, e) => {
    if (!hasAccess) return; // Only managers can drag
    setDraggingJob(job); // Set the job being dragged
    e.dataTransfer.effectAllowed = "move"; // Set cursor effect
  };

  const handleDragOver = (e) => {
    if (!hasAccess) return; // Only managers can drop
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = "move"; // Set cursor effect
  };

  // ✅ IMPROVED: Track which section is being hovered over (works for entire box)
  const handleDragEnterSection = (target, e) => {
    if (!hasAccess || !draggingJob) return;
    e.stopPropagation(); // Prevent event bubbling
    setDragOverTarget(target); // Set the target being hovered over
  };

  // ✅ IMPROVED: Track which specific job is being hovered over
  const handleDragEnterJob = (jobNumber, techName, e) => {
    if (!hasAccess || !draggingJob) return;
    e.stopPropagation(); // Prevent event bubbling
    setDragOverJob(jobNumber); // Set the specific job being hovered over
    setDragOverTarget(techName); // Also set the tech section as active
  };

  const handleDragLeave = (e) => {
    if (!hasAccess || !draggingJob) return;
    // Only clear if we're leaving the container entirely
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverTarget(null); // Clear hover target
      setDragOverJob(null); // Clear job hover
    }
  };

  // ✅ NEW: Handle drop on tech section (assign tech and reorder)
  const handleDropOnTech = async (targetJob, tech) => {
    if (!hasAccess || !draggingJob) return; // Only managers can reorder

    console.log("🔄 Dropping job on tech section:", tech.name); // Debug log

    // Get the current technician of the dragged job
    const draggingJobTechRaw =
      draggingJob.assignedTech?.name || draggingJob.technician || "";
    const draggingJobTech = normalizeDisplayName(draggingJobTechRaw);
    const targetTech = normalizeDisplayName(tech.name);

    // If dropping on a different technician, reassign the job
    if (draggingJobTech !== targetTech) {
      console.log("🔄 Reassigning job to new technician:", tech.name); // Debug log
      const identifier =
        tech.id && Number.isInteger(Number(tech.id))
          ? Number(tech.id)
          : tech.id || tech.name;
      await assignTechnicianToJob(draggingJob.id, identifier, tech.name);
    }

    // Remove the dragged job from the tech's job list
    const updatedTechJobs = tech.jobs.filter(
      (j) => j.jobNumber !== draggingJob.jobNumber
    );
    
    // Find where to insert the dragged job (at the target job's position)
    const dropIndex = targetJob 
      ? updatedTechJobs.findIndex((j) => j.jobNumber === targetJob.jobNumber)
      : updatedTechJobs.length; // If no target job, add to end
    
    // Insert the dragged job at the drop position
    updatedTechJobs.splice(dropIndex, 0, draggingJob);

    // Reindex positions (1-based index)
    const reindexed = updatedTechJobs.map((j, i) => ({
      ...j,
      position: i + 1, // Position starts at 1
    }));

    console.log("📝 Updating positions for", reindexed.length, "jobs"); // Debug log

    // Update all reindexed jobs in Supabase using the helper function
    for (const job of reindexed) {
      await updateJobPosition(job.id, job.position); // Update each job's position
    }

    console.log("✅ Positions updated successfully"); // Debug log

    // Refresh jobs from database
    await fetchJobs();
    setDraggingJob(null); // Clear dragging state
    setDragOverTarget(null); // Clear hover target
    setDragOverJob(null); // Clear job hover
  };

  // ✅ NEW: Handle drop on outstanding section (unassign tech)
  const handleDropOnOutstanding = async () => {
    if (!hasAccess || !draggingJob) return;

    console.log("🔄 Dropping job on outstanding section"); // Debug log

    // Unassign the technician from the job
    await unassignTechnicianFromJob(draggingJob.id);

    // Refresh jobs from database
    await fetchJobs();
    setDraggingJob(null); // Clear dragging state
    setDragOverTarget(null); // Clear hover target
    setDragOverJob(null); // Clear job hover
  };

  const renderAssigneePanel = (assignee) => {
    const panelKey = assignee.panelKey || assignee.id || assignee.name;
    const shouldScroll = assignee.jobs.length > VISIBLE_JOBS_PER_PANEL;
    return (
      <div
        key={panelKey}
        style={{
          background: "white",
          border: dragOverTarget === assignee.name ? "3px solid #d10000" : "1px solid #ffe5e5",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          height: PANEL_HEIGHT_PX,
          minHeight: PANEL_HEIGHT_PX,
          maxHeight: PANEL_HEIGHT_PX,
          boxShadow: dragOverTarget === assignee.name ? "0 4px 12px rgba(209,0,0,0.2)" : "0 2px 4px rgba(0,0,0,0.08)",
          transition: "all 0.2s ease",
          backgroundColor: dragOverTarget === assignee.name ? "#fff5f5" : "white"
      }}
      onDragOver={handleDragOver}
      onDragEnter={(e) => handleDragEnterSection(assignee.name, e)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        handleDropOnTech(null, assignee);
      }}
    >
      <p style={{
        fontWeight: "600",
        marginBottom: "12px",
        fontSize: "16px",
        color: "#1f2937",
        flexShrink: 0
      }}>
        {assignee.name} ({assignee.jobs.length})
      </p>
      <div style={{
        flex: 1,
        minHeight: JOB_LIST_MAX_HEIGHT_PX,
        maxHeight: JOB_LIST_MAX_HEIGHT_PX,
        overflowY: shouldScroll ? "auto" : "hidden",
        paddingRight: shouldScroll ? "8px" : "4px"
      }}>
        {assignee.jobs.length === 0 ? (
          <p style={{
            color: "#9ca3af",
            fontSize: "14px",
            margin: 0
          }}>
            No jobs assigned
          </p>
        ) : (
          assignee.jobs.map((job, index) => (
            <React.Fragment key={job.jobNumber}>
              {dragOverJob === job.jobNumber && dragOverTarget === assignee.name && (
                <div style={{
                  height: "3px",
                  backgroundColor: "#d10000",
                  marginBottom: "8px",
                  borderRadius: "2px",
                  boxShadow: "0 0 8px rgba(209,0,0,0.4)"
                }} />
              )}

              <div
                draggable={hasAccess}
                onDragStart={(e) => handleDragStart(job, e)}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnterJob(job.jobNumber, assignee.name, e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDropOnTech(job, assignee);
                }}
                onClick={() => handleOpenJobDetails(job)}
                style={{
                  border: "1px solid #ffd6d6",
                  borderRadius: "8px",
                  padding: "10px",
                  marginBottom: "8px",
                  backgroundColor:
                    draggingJob?.jobNumber === job.jobNumber ? "#ffe5e5" : "#fff5f5",
                  cursor: hasAccess ? "grab" : "pointer",
                  transition: "all 0.2s",
                  opacity: draggingJob?.jobNumber === job.jobNumber ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (draggingJob?.jobNumber !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = "#ffecec";
                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(209,0,0,0.12)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (draggingJob?.jobNumber !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = "#fff5f5";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <p style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#d10000",
                  margin: "0 0 4px 0"
                }}>
                  {job.jobNumber} – {job.reg}
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  margin: 0
                }}>
                  {job.status}
                </p>
              </div>

              {index === assignee.jobs.length - 1 &&
                dragOverTarget === assignee.name &&
                !dragOverJob &&
                draggingJob && (
                  <div style={{
                    height: "3px",
                    backgroundColor: "#d10000",
                    marginTop: "-8px",
                    marginBottom: "8px",
                    borderRadius: "2px",
                    boxShadow: "0 0 8px rgba(209,0,0,0.4)"
                  }} />
                )}
            </React.Fragment>
          ))
        )}

        {assignee.jobs.length === 0 &&
          dragOverTarget === assignee.name &&
          draggingJob && (
            <div style={{
              height: "3px",
              backgroundColor: "#d10000",
              borderRadius: "2px",
              boxShadow: "0 0 8px rgba(209,0,0,0.4)"
            }} />
          )}
      </div>
      </div>
    );
  };

  // ✅ Access check
  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
          Loading roster…
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#d10000" }}>Access Denied</h2>
          <p>You do not have access to Next Jobs.</p>
        </div>
      </Layout>
    );
  }

  // ✅ Loading state with spinner animation
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "80vh",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #d10000",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666" }}>Loading jobs...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  // ✅ Page layout
  return (
    <Layout>
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        flexDirection: "column", 
        padding: "8px 16px",
        gap: "12px",
        overflowY: "auto" 
      }}>
        
        {/* ✅ Outstanding Jobs Section with Drop Zone */}
        <div 
          style={{
            marginBottom: "12px",
            background: "#fff",
            borderRadius: "8px",
            border: dragOverTarget === "outstanding" ? "3px solid #d10000" : "1px solid #ffe5e5",
            boxShadow: dragOverTarget === "outstanding" ? "0 4px 12px rgba(209,0,0,0.2)" : "0 2px 4px rgba(0,0,0,0.08)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            maxHeight: "180px",
            flexShrink: 0,
            transition: "all 0.2s ease",
            backgroundColor: dragOverTarget === "outstanding" ? "#fff5f5" : "#fff" // Highlight entire box
          }}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnterSection("outstanding", e)}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnOutstanding}
        >
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "12px" 
          }}>
            <h2 style={{ 
              fontSize: "18px", 
              fontWeight: "600", 
              color: "#1f2937",
              margin: 0
            }}>
              Outstanding Jobs ({unassignedJobs.length})
            </h2>
          </div>
          
          <input
            type="text"
            placeholder="Search job number, reg, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} // Update search term
            style={{
              padding: "10px 12px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
          />

          <div style={{ 
            overflowX: "auto", 
            whiteSpace: "nowrap", 
            flex: 1,
            paddingBottom: "8px"
          }}>
            {filteredJobs.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
                {searchTerm.trim() ? "No matching jobs found." : "No outstanding jobs."}
              </p>
            ) : (
              filteredJobs.map((job) => (
                <button
                  key={job.jobNumber}
                  draggable={hasAccess}
                  onDragStart={(e) => handleDragStart(job, e)}
                  onClick={() => handleOpenJobDetails(job)} // Open job details popup
                  style={{
                    display: "inline-block",
                    backgroundColor: draggingJob?.jobNumber === job.jobNumber ? "#ffe5e5" : "#d10000",
                    color: "white",
                    padding: "8px 12px",
                    marginRight: "8px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: hasAccess ? "grab" : "pointer",
                    border: "none",
                    boxShadow: "0 2px 4px rgba(209,0,0,0.18)",
                    transition: "background-color 0.2s",
                    opacity: draggingJob?.jobNumber === job.jobNumber ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (draggingJob?.jobNumber !== job.jobNumber) {
                      e.currentTarget.style.backgroundColor = "#a60a0a";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (draggingJob?.jobNumber !== job.jobNumber) {
                      e.currentTarget.style.backgroundColor = "#d10000";
                    }
                  }}
                  title={`${job.jobNumber} - ${job.customer} - ${job.make} ${job.model} - Status: ${job.status}`}
                >
                  {`${job.jobNumber} - ${job.reg}`}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ✅ Technicians Grid Section */}
        <div style={{ 
          flex: "1 0 auto",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          border: "1px solid #ffe5e5",
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gridAutoRows: PANEL_HEIGHT_PX,
            gap: "16px",
            width: "100%"
          }}>
            {assignedJobs.slice(0, 6).map(renderAssigneePanel)}
          </div>

          {motPanelList.length > 0 && (
            <div>
              <h3 style={{
                margin: "0 0 12px 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#1f2937"
              }}>
                MOT Testers
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gridAutoRows: PANEL_HEIGHT_PX,
                gap: "16px"
              }}>
                {assignedMotJobs.slice(0, 2).map(renderAssigneePanel)}
              </div>
            </div>
          )}
        </div>

        {/* ✅ JOB DETAILS POPUP WITH EDIT BUTTON */}
        {selectedJob && (
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.5)", // Semi-transparent overlay
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
            onClick={handleCloseJobDetails} // Close when clicking overlay
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "500px",
                maxWidth: "90%",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                border: "1px solid #ffe5e5",
                position: "relative"
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              {/* ✅ NEW: Edit Job Button in top right */}
              <button
                onClick={handleEditJob}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "background-color 0.2s",
                  boxShadow: "0 2px 4px rgba(239,68,68,0.2)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#dc2626"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ef4444"}
              >
                Edit Job
              </button>

              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "#d10000",
                paddingRight: "100px" // Make space for edit button
              }}>
                Job Details
              </h3>
              
              {feedbackMessage && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    backgroundColor:
                      feedbackMessage.type === "error" ? "#fee2e2" : "#d1fae5",
                    color: feedbackMessage.type === "error" ? "#991b1b" : "#065f46",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: feedbackMessage.type === "error" ? "1px solid #fca5a5" : "1px solid #6ee7b7"
                  }}
                >
                  {feedbackMessage.text}
                </div>
              )}
              
              <div style={{ marginBottom: "20px" }}>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Job Number:</strong> {selectedJob.jobNumber}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Status:</strong> {selectedJob.status}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Make:</strong> {selectedJob.make} {selectedJob.model}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Reg:</strong> {selectedJob.reg}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Customer:</strong> {selectedJob.customer}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Description:</strong> {selectedJob.description}
                </p>
                {selectedJob.assignedTech && (
                  <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                    <strong style={{ color: "#6b7280" }}>Assigned To:</strong> {selectedJob.assignedTech.name}
                  </p>
                )}
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px"
              }}>
                <button
                  style={{
                    flex: 1,
                    backgroundColor: "#6c757d",
                    color: "white",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onClick={handleOpenAssignPopup} // Open assign popup
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5a6268")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6c757d")}
                >
                  Assign Tech
                </button>
                {selectedJob.assignedTech && (
                  <button
                    style={{
                      flex: 1,
                      backgroundColor: "#f59e0b",
                      color: "white",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: "600",
                      transition: "background-color 0.2s"
                    }}
                    onClick={unassignTechFromJob} // Unassign technician
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#d97706")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f59e0b")}
                  >
                    Unassign
                  </button>
                )}
                <button
                  style={{
                    flex: 1,
                    backgroundColor: "#d10000",
                    color: "white",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onClick={handleCloseJobDetails} // Close popup
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ ASSIGN TECH POPUP */}
        {assignPopup && (
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.5)", // Semi-transparent overlay
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1001, // Above job details popup
            }}
            onClick={() => setAssignPopup(false)} // Close when clicking overlay
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "450px",
                maxWidth: "90%",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                border: "1px solid #ffe5e5"
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "#d10000"
              }}>
                Assign Technician
              </h3>
              
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  const selectedTech = assignableStaffList.find(
                    (t) =>
                      String((t.id ?? t.name)) === value || t.name === value
                  );
                  if (selectedTech) assignTechToJob(selectedTech); // Assign selected tech
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  fontSize: "14px",
                  marginBottom: "16px",
                  outline: "none",
                  cursor: "pointer",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                defaultValue=""
              >
                <option value="" disabled>
                  Select Technician...
                </option>
                {assignableStaffList.map((tech) => (
                  <option
                    key={tech.id ?? tech.name}
                    value={String(tech.id ?? tech.name)}
                  >
                    {tech.name}
                  </option>
                ))}
              </select>
              
              <button
                style={{
                  width: "100%",
                  backgroundColor: "#d10000",
                  color: "white",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onClick={() => setAssignPopup(false)} // Close assign popup
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
