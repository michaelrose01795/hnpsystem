// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react"; // Core React hooks
import Layout from "@/components/Layout"; // Main layout wrapper
import { useUser } from "@/context/UserContext"; // Logged-in user context
import { useRoster } from "@/context/RosterContext";
import { useRouter } from "next/router"; // Next.js router for navigation
import { 
  assignTechnicianToJob, 
  unassignTechnicianFromJob, 
  updateJobPosition 
} from "@/lib/database/jobs"; // ✅ Fetch and update jobs from Supabase
import { getTechnicianUsers, getMotTesterUsers } from "@/lib/database/users";
import { normalizeDisplayName } from "@/utils/nameUtils";
import { supabase } from "@/lib/supabaseClient";

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

const STATUS_WAITING_QUEUE = new Set([
  "CHECKED IN",
  "ACCEPTED IN",
  "WAITING FOR WORKSHOP",
  "AWAITING WORKSHOP",
  "AWAITING TECH",
  "AWAITING ALLOCATION",
  "ARRIVED",
  "IN RECEPTION",
]);

const STATUS_IN_PROGRESS = new Set([
  "WORKSHOP/MOT",
  "WORKSHOP",
  "IN PROGRESS",
  "VHC COMPLETE",
  "VHC SENT",
  "ADDITIONAL WORK REQUIRED",
  "ADDITIONAL WORK BEING CARRIED OUT",
  "ADDITIONAL WORK",
  "BEING WASHED",
]);

const STATUS_COMPLETED = new Set([
  "COMPLETE",
  "COMPLETED",
  "INVOICED",
  "COLLECTED",
  "CLOSED",
  "FINISHED",
  "CANCELLED",
]);

const toStatusKey = (status) => (status ? String(status).trim().toUpperCase() : "");
const OUTSTANDING_ALLOWED_STATUSES = new Set(["CHECKED IN", "ACCEPTED IN"]);
const BLOCKING_STATUS_KEYWORDS = ["MOT", "VALET", "SERVICE MANAGER", "AFTERSALES"];
const OUTSTANDING_VISIBLE_ROWS = 1;
const OUTSTANDING_CARD_HEIGHT = 210;
const OUTSTANDING_GRID_MAX_HEIGHT_PX = `${OUTSTANDING_VISIBLE_ROWS * OUTSTANDING_CARD_HEIGHT}px`;

const formatCheckedInTime = (value) => {
  if (!value) return "Not recorded";
  try {
    return new Date(value).toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });
  } catch (err) {
    return "Not recorded";
  }
};

const formatCustomerStatus = (value) => {
  if (!value) return "Neither";
  const lower = value.toString().toLowerCase();
  if (lower.includes("loan")) return "Loan Car";
  if (lower.includes("collect")) return "Collection";
  if (lower.includes("wait")) return "Waiting";
  return value;
};

const isBlockedByDepartment = (status) => {
  const statusKey = toStatusKey(status);
  if (!statusKey) return false;
  return BLOCKING_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword));
};

const getJobRequestsCountFromPayload = (payload) => {
  if (!payload) return 0;
  if (Array.isArray(payload)) return payload.length;
  if (Array.isArray(payload?.items)) return payload.items.length;
  if (typeof payload === "object") return Object.keys(payload).length;
  return 0;
};

const getJobRequestsCount = (job) => {
  if (typeof job?.jobRequestsCount === "number") return job.jobRequestsCount;
  return getJobRequestsCountFromPayload(job?.requests);
};

const formatAppointmentTime = (job) => {
  const appointment = job?.appointment;
  if (!appointment) return "No appointment";
  if (appointment.time) return appointment.time;
  const isoValue = appointment.scheduledTime || appointment.scheduled_time;
  if (!isoValue) return "No appointment";
  try {
    return new Date(isoValue).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_err) {
    return "No appointment";
  }
};

const JOB_TYPE_KEYWORDS = [
  { label: "MOT", keywords: ["mot"] },
  { label: "Service", keywords: ["service", "oil", "inspection", "maintenance"] },
  { label: "Diagnose", keywords: ["diagnos", "fault", "warning", "investigation", "check"] },
];

const deriveJobTypeLabel = (job) => {
  const categories = (job?.jobCategories || []).map((category) => toStatusKey(category));
  if (categories.some((category) => category.includes("MOT"))) return "MOT";
  if (categories.some((category) => category.includes("SERVICE"))) return "Service";
  if (categories.some((category) => category.includes("DIAG"))) return "Diagnose";

  const baseType = toStatusKey(job?.type);
  if (baseType.includes("MOT")) return "MOT";
  if (baseType.includes("SERVICE")) return "Service";
  if (baseType.includes("DIAG")) return "Diagnose";

  const haystack = [
    job?.description || "",
    typeof job?.requests === "string" ? job.requests : JSON.stringify(job?.requests || ""),
  ]
    .join(" ")
    .toLowerCase();

  for (const mapping of JOB_TYPE_KEYWORDS) {
    if (mapping.keywords.some((keyword) => haystack.includes(keyword))) {
      return mapping.label;
    }
  }

  return "Other";
};

const formatClockInTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_err) {
    return "";
  }
};

const toUserIdKey = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : null;
};

const mapActiveClockingRow = (row = {}) => {
  const job = row.job || {};
  const vehicle = job.vehicle || {};
  const customer = job.customer || {};
  const reg =
    job.vehicle_reg ||
    vehicle.registration ||
    vehicle.reg_number ||
    "";
  const makeModel =
    job.vehicle_make_model ||
    vehicle.make_model ||
    [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
  const customerFirst = (customer.firstname || "").trim();
  const customerLast = (customer.lastname || "").trim();
  const customerName =
    customer.name ||
    [customerFirst, customerLast].filter(Boolean).join(" ").trim();

  return {
    clockingId: row.id ?? null,
    userId: row.user_id ?? null,
    jobId: row.job_id ?? null,
    jobNumber: row.job_number || job.job_number || "",
    clockIn: row.clock_in || null,
    workType: row.work_type || "initial",
    reg,
    makeModel,
    customer: customerName,
    status: job.status || "",
    description: job.description || "",
  };
};

const buildJobFromClockingEntry = (entry = {}, technicianName = "") => {
  const makeModel = entry.makeModel || "";
  const [make, ...modelParts] = makeModel.split(" ");
  return {
    id: entry.jobId ?? null,
    jobNumber: entry.jobNumber || "Job pending",
    reg: entry.reg || "Reg TBC",
    make: make || "",
    model: modelParts.join(" "),
    customer: entry.customer || "",
    description: entry.description || "",
    status: entry.status || "In Progress",
    assignedTech:
      technicianName || entry.userId
        ? {
            id: entry.userId ?? null,
            name: technicianName || "",
          }
        : null,
  };
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
  const [activeClockingsByUser, setActiveClockingsByUser] = useState({});

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

  const isWaitingJob = (job) => {
    const statusKey = toStatusKey(job.status);
    const hasStarted =
      STATUS_IN_PROGRESS.has(statusKey) || Boolean(job.workshopStartedAt);
    const isFinished =
      STATUS_COMPLETED.has(statusKey) || Boolean(job.completedAt);
    const hasArrived =
      STATUS_WAITING_QUEUE.has(statusKey) ||
      (Boolean(job.checkedInAt) && !isFinished);

    return hasArrived && !hasStarted && !isFinished;
  };

  const waitingJobs = useMemo(() => jobs.filter(isWaitingJob), [jobs]);

  const jobsByNumber = useMemo(() => {
    const map = new Map();
    waitingJobs.forEach((job) => {
      if (job?.jobNumber) {
        map.set(job.jobNumber, job);
      }
    });
    return map;
  }, [waitingJobs]);

  const outstandingJobs = useMemo(
    () =>
      waitingJobs.filter((job) => {
        const statusKey = toStatusKey(job.status);
        const allowedStatus = OUTSTANDING_ALLOWED_STATUSES.has(statusKey);
        const isUnassigned = !job.assignedTech && job.assignedTo == null;
        const blocked = isBlockedByDepartment(job.status);
        return allowedStatus && isUnassigned && !blocked;
      }),
    [waitingJobs]
  );

  const mapJobFromDatabase = (row) => {
    const customerFirst = row.customer?.firstname?.trim() || "";
    const customerLast = row.customer?.lastname?.trim() || "";
    const customerName =
      row.customer?.name ||
      [customerFirst, customerLast].filter(Boolean).join(" ").trim();

    const vehicleReg =
      row.vehicle_reg ||
      row.vehicle?.registration ||
      row.vehicle?.reg_number ||
      "";

    const assignedTechRecord = row.technician;
    const assignedTech = assignedTechRecord
      ? {
          id: assignedTechRecord.user_id || null,
          name:
            [assignedTechRecord.first_name, assignedTechRecord.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || assignedTechRecord.email || "",
          role: assignedTechRecord.role || "",
          email: assignedTechRecord.email || "",
        }
      : null;

    return {
      id: row.id,
      jobNumber: row.job_number,
      description: row.description || "",
      type: row.type || "Service",
      status: row.status || "",
      reg: vehicleReg,
      make: row.vehicle?.make || "",
      model: row.vehicle?.model || "",
      makeModel: row.vehicle_make_model || row.vehicle?.make_model || "",
      waitingStatus: row.waiting_status || "Neither",
      jobCategories: Array.isArray(row.job_categories)
        ? row.job_categories
        : row.job_categories
        ? [row.job_categories].flat()
        : [],
      requests: row.requests || null,
      jobRequestsCount: getJobRequestsCountFromPayload(row.requests),
      vhcRequired: Boolean(row.vhc_required),
      assignedTo: row.assigned_to,
      assignedTech,
      technician: assignedTech?.name || "",
      technicianRole: assignedTech?.role || "",
      customer: customerName || "",
      customerId: row.customer_id || null,
      customerPhone: row.customer?.mobile || row.customer?.telephone || "",
      customerEmail: row.customer?.email || "",
      customerAddress: row.customer?.address || "",
      customerPostcode: row.customer?.postcode || "",
      customerContactPreference: row.customer?.contact_preference || "email",
      checkedInAt: row.checked_in_at || null,
      workshopStartedAt: row.workshop_started_at || null,
      completedAt: row.completed_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      position: row.position || null,
      appointment: row.appointments?.[0]
        ? {
            appointmentId: row.appointments[0].appointment_id,
            scheduledTime: row.appointments[0].scheduled_time,
            status: row.appointments[0].status,
            notes: row.appointments[0].notes || "",
          }
        : null,
    };
  };

  const fetchJobs = useCallback(async () => { // Wrap Supabase fetch in stable callback to avoid TDZ
    setLoading(true); // Start loading to show spinner

    const { data, error } = await supabase
      .from("jobs")
      .select(
        `
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        waiting_status,
        job_categories,
        requests,
        vhc_required,
        vehicle_reg,
        vehicle_make_model,
        customer_id,
        checked_in_at,
        workshop_started_at,
        completed_at,
        created_at,
        updated_at,
        technician:assigned_to(user_id, first_name, last_name, email, role),
        customer:customer_id(firstname, lastname, name, mobile, telephone, email, address, postcode, contact_preference),
        vehicle:vehicle_id(registration, reg_number, make, model, make_model),
        appointments(appointment_id, scheduled_time, status, notes)
      `
      )
      .order("checked_in_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching waiting jobs:", error);
      setJobs([]);
      setLoading(false);
      return [];
    }

    const formatted = (data || [])
      .map(mapJobFromDatabase)
      .filter((job) => job.jobNumber && job.jobNumber.trim() !== "")
      .filter(isWaitingJob);

    setJobs(formatted);
    setLoading(false); // Stop loading
    return formatted;
  }, []);

  const fetchTechnicians = useCallback(async () => { // Wrap technician lookup in stable callback
    try {
      const [techList, testerList] = await Promise.all([
        getTechnicianUsers(), // Load technician list
        getMotTesterUsers(), // Load MOT tester list
      ]);
      setDbTechnicians(techList); // Cache technicians
      setDbMotTesters(testerList); // Cache MOT testers
    } catch (err) {
      console.error("❌ Error fetching technicians:", err); // Log fetch errors
    }
  }, []);

  const fetchActiveClockings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("job_clocking")
        .select(
          `
          id,
          user_id,
          job_id,
          job_number,
          clock_in,
          work_type,
          job:job_id(
            job_number,
            description,
            vehicle_reg,
            vehicle_make_model,
            status,
            customer:customer_id(firstname, lastname, name),
            vehicle:vehicle_id(registration, reg_number, make, model, make_model)
          )
        `
        )
        .is("clock_out", null);

      if (error) {
        throw error;
      }

      const byUser = {};
      (data || []).forEach((row) => {
        const entry = mapActiveClockingRow(row);
        if (!entry.userId) return;
        const key = String(entry.userId);
        const existing = byUser[key];
        if (!existing) {
          byUser[key] = entry;
          return;
        }
        const existingTime = existing.clockIn ? Date.parse(existing.clockIn) : 0;
        const candidateTime = entry.clockIn ? Date.parse(entry.clockIn) : 0;
        if (candidateTime >= existingTime) {
          byUser[key] = entry;
        }
      });

      setActiveClockingsByUser(byUser);
    } catch (err) {
      console.error("❌ Error fetching active technician clockings:", err);
    }
  }, []);

  // ✅ Fetch jobs and technicians from Supabase on component mount
  useEffect(() => { // Kick off initial data fetch
    fetchJobs(); // Load waiting jobs
    fetchTechnicians(); // Load staff lists
    fetchActiveClockings(); // Load current clocking per technician
  }, [fetchJobs, fetchTechnicians, fetchActiveClockings]);

  useEffect(() => { // Subscribe to Supabase changes for live updates
    const channel = supabase
      .channel("nextjobs-waiting-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  useEffect(() => {
    const channel = supabase
      .channel("nextjobs-active-clocking")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_clocking" },
        () => {
          fetchActiveClockings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveClockings]);

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

    return Array.from(map.entries()).map(([normalized, entry]) => ({
      ...entry,
      normalizedName: normalized,
      roles: Array.from(entry.roles),
    }));
  }, [dbTechnicians, dbMotTesters, fallbackTechs, fallbackMot]);

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

  // ✅ Search logic for job cards in the outstanding section
  const filteredOutstandingJobs = useMemo(() => {
    if (!searchTerm.trim()) return outstandingJobs;
    const lower = searchTerm.toLowerCase();
    return outstandingJobs.filter((job) => {
      const haystack = [
        job.jobNumber,
        job.customer,
        job.make,
        job.model,
        job.reg,
        job.type,
        job.waitingStatus,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());

      return haystack.some((value) => value.includes(lower));
    });
  }, [searchTerm, outstandingJobs]);

  // ✅ Group jobs by technician (using assignedTech.name)
  const getJobsForAssignee = (assigneeName) => {
    const normalizedAssignee = normalizeDisplayName(assigneeName);

    return waitingJobs
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
    [waitingJobs, techPanelList]
  );

  const assignedMotJobs = useMemo(
    () =>
      motPanelList.map((tester, index) => ({
        ...tester,
        panelKey: `${tester.id || tester.normalizedName || "mot"}-mot-${index}`,
        jobs: getJobsForAssignee(tester.name),
      })),
    [waitingJobs, motPanelList]
  );

  const handleOpenJobDetails = (job) => {
    setFeedbackMessage(null);
    setSelectedJob(job);
  };

  const handleCloseJobDetails = () => {
    setFeedbackMessage(null);
    setSelectedJob(null);
  };

  const handleOpenCurrentClocking = (entry, technicianName) => {
    if (!entry) return;
    if (entry.jobNumber) {
      const knownJob = jobsByNumber.get(entry.jobNumber);
      if (knownJob) {
        handleOpenJobDetails(knownJob);
        return;
      }
    }
    const fallbackJob = buildJobFromClockingEntry(entry, technicianName);
    handleOpenJobDetails(fallbackJob);
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

  const handleViewSelectedJobCard = () => {
    if (!selectedJob?.jobNumber) return;
    router.push(`/job-cards/${encodeURIComponent(selectedJob.jobNumber)}`);
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

  const handleNavigateToJobCard = useCallback(
    (jobNumber) => {
      if (!jobNumber) return;
      router.push(`/job-cards/${encodeURIComponent(jobNumber)}`);
    },
    [router]
  );

  const renderAssigneePanel = (assignee) => {
    const panelKey = assignee.panelKey || assignee.id || assignee.name;
    const shouldScroll = assignee.jobs.length > VISIBLE_JOBS_PER_PANEL;
    const userIdKey = toUserIdKey(assignee.id);
    const currentClocking = userIdKey ? activeClockingsByUser[userIdKey] : null;
    const clockingSubtitleParts = [];
    if (currentClocking?.reg) clockingSubtitleParts.push(currentClocking.reg);
    if (currentClocking?.customer) clockingSubtitleParts.push(currentClocking.customer);
    const clockingSubtitle = clockingSubtitleParts.join(" • ");
    const clockInLabel = currentClocking ? formatClockInTime(currentClocking.clockIn) : "";
        return (
          <div
            key={panelKey}
            style={{
              background: "var(--surface)",
              border: dragOverTarget === assignee.name ? "3px solid var(--primary)" : "1px solid var(--surface-light)",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              height: PANEL_HEIGHT_PX,
              minHeight: PANEL_HEIGHT_PX,
              maxHeight: PANEL_HEIGHT_PX,
              boxShadow: dragOverTarget === assignee.name ? "0 4px 12px rgba(var(--primary-rgb),0.2)" : "0 2px 4px rgba(var(--shadow-rgb),0.14)",
              transition: "all 0.2s ease",
              backgroundColor: dragOverTarget === assignee.name ? "var(--surface-light)" : "var(--surface)"
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
        color: "var(--accent-purple)",
        flexShrink: 0
      }}>
        {assignee.name} ({assignee.jobs.length})
      </p>
      <div
        style={{
          marginBottom: "12px",
          padding: "12px",
          borderRadius: "8px",
          border: currentClocking ? "1px solid var(--success)" : "1px dashed var(--accent-purple)",
          backgroundColor: currentClocking ? "var(--success-surface)" : "var(--surface-light)",
          cursor: currentClocking ? "pointer" : "default",
        }}
        onClick={() => handleOpenCurrentClocking(currentClocking, assignee.name)}
      >
        <p
          style={{
            margin: "0 0 4px 0",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--accent-purple)",
          }}
        >
          Current clocking
        </p>
        {currentClocking ? (
          <>
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {currentClocking.jobNumber || "Job pending"}
            </p>
            {clockingSubtitle && (
              <p
                style={{
                margin: "0 0 4px 0",
                fontSize: "12px",
                color: "var(--text-primary)",
              }}
            >
              {clockingSubtitle}
            </p>
            )}
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--text-primary)",
              }}
            >
              {clockInLabel
                ? `Clocked in at ${clockInLabel}`
                : "Clock-in time not recorded"}
            </p>
          </>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--accent-purple)",
            }}
          >
            Not clocked into a job
          </p>
        )}
      </div>
      <div style={{
        flex: 1,
        minHeight: JOB_LIST_MAX_HEIGHT_PX,
        maxHeight: JOB_LIST_MAX_HEIGHT_PX,
        overflowY: shouldScroll ? "auto" : "hidden",
        paddingRight: shouldScroll ? "8px" : "4px"
      }}>
            {assignee.jobs.length === 0 ? (
              <p style={{
            color: "var(--text-primary)",
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
                  backgroundColor: "var(--primary)",
                  marginBottom: "8px",
                  borderRadius: "2px",
                  boxShadow: "0 0 8px rgba(var(--primary-rgb),0.4)"
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
                  border: "1px solid var(--surface-light)",
                  borderRadius: "8px",
                  padding: "10px",
                  marginBottom: "8px",
                  backgroundColor:
                    draggingJob?.jobNumber === job.jobNumber ? "var(--surface-light)" : "var(--surface)",
                  cursor: hasAccess ? "grab" : "pointer",
                  transition: "all 0.2s",
                  opacity: draggingJob?.jobNumber === job.jobNumber ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (draggingJob?.jobNumber !== job.jobNumber) {
                  e.currentTarget.style.backgroundColor = "var(--surface-light)";
                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(var(--primary-rgb),0.12)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (draggingJob?.jobNumber !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = "var(--surface)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <p style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--primary)",
                  margin: "0 0 4px 0"
                }}>
                  {job.jobNumber} – {job.reg}
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "var(--accent-purple)",
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
                    backgroundColor: "var(--primary)",
                    marginTop: "-8px",
                    marginBottom: "8px",
                    borderRadius: "2px",
                    boxShadow: "0 0 8px rgba(var(--primary-rgb),0.4)"
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
              backgroundColor: "var(--primary)",
              borderRadius: "2px",
              boxShadow: "0 0 8px rgba(var(--primary-rgb),0.4)"
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
        <div style={{ padding: "40px", textAlign: "center", color: "var(--accent-purple)" }}>
          Loading roster…
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "var(--primary)" }}>Access Denied</h2>
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
            border: "4px solid var(--surface)",
            borderTop: "4px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "var(--grey-accent)" }}>Loading jobs...</p>
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
        gap: "12px"
      }}>
        
        {/* ✅ Outstanding Jobs Section with Drop Zone */}
            <div 
              style={{
                marginBottom: "12px",
                background: "var(--surface)",
                borderRadius: "8px",
            border: dragOverTarget === "outstanding" ? "3px solid var(--primary)" : "1px solid var(--surface-light)",
            boxShadow: dragOverTarget === "outstanding" ? "0 4px 12px rgba(var(--primary-rgb),0.2)" : "0 2px 4px rgba(var(--shadow-rgb),0.08)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            minHeight: OUTSTANDING_GRID_MAX_HEIGHT_PX,
            flexShrink: 0,
            transition: "all 0.2s ease",
            backgroundColor: dragOverTarget === "outstanding" ? "var(--surface-light)" : "var(--surface)" // Highlight entire box
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
              color: "var(--accent-purple)",
              margin: 0
            }}>
              Outstanding Jobs ({outstandingJobs.length})
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
              border: "1px solid var(--surface-light)",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--surface-light)"}
          />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: OUTSTANDING_GRID_MAX_HEIGHT_PX,
                paddingRight: "6px",
              }}
            >
              {filteredOutstandingJobs.length === 0 ? (
                <p style={{ color: "var(--text-primary)", fontSize: "14px", margin: 0 }}>
                  {searchTerm.trim() ? "No matching jobs found." : "No outstanding jobs."}
                </p>
              ) : (
                <div className="outstanding-grid">
                  {filteredOutstandingJobs.map((job) => {
                    const jobTypeLabel = deriveJobTypeLabel(job);
                    const customerStatus = formatCustomerStatus(job.waitingStatus);
                    const requestsCount = getJobRequestsCount(job);
                    const appointmentDisplay = formatAppointmentTime(job);
                    return (
                      <div
                        key={job.jobNumber}
                        draggable={hasAccess}
                        onDragStart={(e) => handleDragStart(job, e)}
                        onClick={(event) => {
                          event.preventDefault();
                          if (draggingJob) return;
                          handleOpenJobDetails(job);
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          padding: "14px",
                          borderRadius: "16px",
                          border:
                            draggingJob?.jobNumber === job.jobNumber
                              ? "2px dashed var(--primary)"
                              : "1px solid var(--info-surface)",
                          backgroundColor:
                            draggingJob?.jobNumber === job.jobNumber ? "var(--surface-light)" : "var(--background)",
                          cursor: hasAccess ? "grab" : "pointer",
                          boxShadow: "0 8px 20px rgba(var(--shadow-rgb),0.08)",
                          transition: "border 0.2s, background-color 0.2s, transform 0.2s",
                        }}
                        title={`${job.jobNumber} – ${job.customer || "Unknown customer"}`}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "16px",
                                color: "var(--accent-purple)",
                              }}
                            >
                              {job.jobNumber}
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                              {job.reg || "Reg TBC"}
                            </div>
                          </div>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              backgroundColor: "var(--danger-surface)",
                              color: "var(--danger)",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {jobTypeLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                          {job.customer || "Unknown customer"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            fontSize: "12px",
                          color: "var(--text-primary)",
                        }}
                      >
                        <span>
                          <strong>Requests:</strong> {requestsCount}
                          </span>
                          <span>
                            <strong>Appointment:</strong> {appointmentDisplay}
                          </span>
                          <span>
                            <strong>Checked in:</strong> {formatCheckedInTime(job.checkedInAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: "var(--surface-light)",
                              color: "var(--accent-purple)",
                            }}
                          >
                            {customerStatus}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                            {job.status || "Status pending"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Technicians Grid Section */}
            <div style={{ 
              flex: "1 0 auto",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.08)",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
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
                    color: "var(--accent-purple)"
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
              backgroundColor: "rgba(var(--shadow-rgb),0.5)", // Semi-transparent overlay
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
                    backgroundColor: "var(--surface)",
                    padding: "24px",
                borderRadius: "12px",
                width: "500px",
                maxWidth: "90%",
                boxShadow: "0 8px 24px rgba(var(--shadow-rgb),0.3)",
                border: "1px solid var(--surface-light)",
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
                  backgroundColor: "var(--danger)",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "background-color 0.2s",
                  boxShadow: "0 2px 4px rgba(var(--danger-rgb), 0.2)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--danger)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--danger)"}
              >
                Edit Job
              </button>

              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "var(--primary)",
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
                      feedbackMessage.type === "error" ? "var(--danger-surface)" : "var(--success)",
                    color: feedbackMessage.type === "error" ? "var(--danger)" : "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: feedbackMessage.type === "error" ? "1px solid var(--danger)" : "1px solid var(--success)"
                  }}
                >
                  {feedbackMessage.text}
                </div>
              )}
              
              <div style={{ marginBottom: "20px" }}>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Job Number:</strong> {selectedJob.jobNumber}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Status:</strong> {selectedJob.status}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Make:</strong> {selectedJob.make} {selectedJob.model}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Reg:</strong> {selectedJob.reg}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Customer:</strong> {selectedJob.customer}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Description:</strong> {selectedJob.description}
                </p>
                {selectedJob.assignedTech && (
                  <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                    <strong style={{ color: "var(--accent-purple)" }}>Assigned To:</strong> {selectedJob.assignedTech.name}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${selectedJob?.assignedTech ? 4 : 3}, minmax(0, 1fr))`,
                  gap: "12px"
                }}
              >
                <button
                  style={{
                    backgroundColor: "var(--grey-accent)",
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--grey-accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--grey-accent)")}
                >
                  Assign Tech
                </button>
                <button
                  style={{
                    backgroundColor: "var(--accent-purple)",
                    color: "white",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onClick={handleViewSelectedJobCard}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-purple)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-purple)")}
                >
                  View Job Card
                </button>
                {selectedJob.assignedTech && (
                  <button
                    style={{
                      backgroundColor: "var(--warning)",
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--warning)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--warning)")}
                  >
                    Unassign
                  </button>
                )}
                <button
                  style={{
                    backgroundColor: "var(--primary)",
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--danger-dark)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--primary)")}
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
              backgroundColor: "rgba(var(--shadow-rgb),0.5)", // Semi-transparent overlay
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
                backgroundColor: "var(--surface)",
                padding: "24px",
                borderRadius: "12px",
                width: "450px",
                maxWidth: "90%",
                boxShadow: "0 8px 24px rgba(var(--shadow-rgb),0.3)",
                border: "1px solid var(--surface-light)"
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "var(--primary)"
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
                  border: "1px solid var(--surface-light)",
                  fontSize: "14px",
                  marginBottom: "16px",
                  outline: "none",
                  cursor: "pointer",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--surface-light)"}
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
                  backgroundColor: "var(--primary)",
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
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--danger-dark)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--primary)")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <style jsx>{`
          .outstanding-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
          @media (max-width: 1280px) {
            .outstanding-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 960px) {
            .outstanding-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 640px) {
            .outstanding-grid {
              grid-template-columns: repeat(1, minmax(0, 1fr));
            }
          }
        `}</style>
      </div>
    </Layout>
  );
}
