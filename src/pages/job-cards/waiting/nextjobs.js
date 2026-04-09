// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"; // Core React hooks
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
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { SearchBar } from "@/components/searchBarAPI";
import { deriveJobTypeDisplay } from "@/lib/jobType/display";
import { normalizeRequests } from "@/lib/jobcards/utils";
import { getJobRequests, getJobRequestsCount as canonicalRequestsCount, getVehicleRegistration } from "@/lib/canonical/fields";
import { revalidateAllJobs } from "@/lib/swr/mutations";
import { prefetchJob } from "@/lib/swr/prefetch"; // warm SWR cache on hover for instant navigation

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

// NOTE: These status Sets use DMS-specific uppercase display labels (not canonical status IDs).
// For canonical status checks, use isInactiveJobStatus() from @/lib/status/statusHelpers.
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
const STATUS_EXCLUDED_TECH_PANEL = new Set(["BOOKED", "INVOICED", "RELEASED"]);

const toStatusKey = (status) => (status ? String(status).trim().toUpperCase() : "");
const OUTSTANDING_VISIBLE_ROWS = 1;
const OUTSTANDING_CARD_HEIGHT = 210;
const OUTSTANDING_GRID_MAX_HEIGHT_PX = `${OUTSTANDING_VISIBLE_ROWS * OUTSTANDING_CARD_HEIGHT}px`;
const DRAG_START_THRESHOLD_PX = 8;
const DRAG_PREVIEW_OFFSET_PX = 16;

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

const jobDetailsPopupPrimaryButtonStyle = {
  backgroundColor: "var(--accent-purple)",
  color: "var(--text-inverse)",
  padding: "12px 16px",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
  border: "1px solid var(--accent-purple)",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
};

const jobDetailsPopupSecondaryButtonStyle = {
  ...jobDetailsPopupPrimaryButtonStyle,
  backgroundColor: "var(--accent-purple-surface)",
  color: "var(--accent-purple)",
};

const jobDetailsPopupWarningButtonStyle = {
  ...jobDetailsPopupPrimaryButtonStyle,
  backgroundColor: "var(--warning-surface)",
  color: "var(--warning-dark)",
  border: "1px solid var(--warning)",
};

const jobDetailsPopupQuietButtonStyle = {
  ...jobDetailsPopupPrimaryButtonStyle,
  backgroundColor: "var(--surface-light)",
  color: "var(--accent-purple)",
  border: "1px solid var(--accent-purple-surface)",
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

const deriveJobTypeLabel = (job) => deriveJobTypeDisplay(job, { includeExtraCount: true });

const getRequestText = (request = {}, index = 0) => {
  const text = [
    request?.text,
    request?.description,
    request?.request,
    request?.title,
    request?.label,
    request?.name,
    request?.issue_title,
    request?.issueDescription,
    request?.issue_description,
    request?.detail,
    request?.noteText,
    request?.note_text,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  return text || `Request ${index + 1}`;
};

const getJobRequestItems = (job) =>
  getJobRequests(job).map((request, index) => ({
    id:
      request?.requestId ??
      request?.request_id ??
      request?.id ??
      `${job?.jobNumber || "job"}-request-${index}`,
    text: getRequestText(request, index),
  }));

const normalizeApprovalDecision = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "authorised") return "authorized";
  return normalized;
};

const getApprovedVhcItems = (job) => {
  const rows = Array.isArray(job?.vhcChecks)
    ? job.vhcChecks
    : Array.isArray(job?.vhc_checks)
    ? job.vhc_checks
    : [];

  return rows
    .filter((row) => {
      const approval = normalizeApprovalDecision(row?.approval_status);
      const state = normalizeApprovalDecision(row?.authorization_state);
      return approval === "authorized" || approval === "completed" || state === "authorized";
    })
    .map((row, index) => ({
      id: row?.vhc_id ?? row?.id ?? `vhc-${index}`,
      text:
        [
          row?.issue_title,
          row?.issue_description,
          row?.section,
        ]
          .map((value) => String(value || "").trim())
          .find(Boolean) || `Approved VHC ${index + 1}`,
    }));
};

const getJobDetailsRequestRows = (job) => {
  const requestItems = getJobRequestItems(job).map((item, index) => ({
    id: `request-${item.id}`,
    label: `Request ${index + 1}`,
    text: item.text,
  }));

  const approvedVhcItems = getApprovedVhcItems(job).map((item, index) => ({
    id: `vhc-${item.id}`,
    label: `VHC Approved ${index + 1}`,
    text: item.text,
  }));

  return [...requestItems, ...approvedVhcItems];
};

const jobMatchesSearchTerm = (job, rawSearchTerm = "") => {
  const lower = String(rawSearchTerm || "").trim().toLowerCase();
  if (!lower) return false;

  const haystack = [
    job?.jobNumber,
    job?.customer,
    job?.make,
    job?.model,
    job?.makeModel,
    job?.reg,
    job?.type,
    job?.status,
    job?.waitingStatus,
    job?.assignedTech?.name,
    job?.technician,
  ]
    .filter(Boolean)
    .map((value) => value.toString().toLowerCase());

  return haystack.some((value) => value.includes(lower));
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

const getSortablePosition = (job) => {
  const numeric = Number(job?.position);
  return Number.isFinite(numeric) ? numeric : null;
};

const getComparableTimestamp = (value) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareJobsForBoard = (left, right) => {
  const leftPosition = getSortablePosition(left);
  const rightPosition = getSortablePosition(right);

  if (leftPosition !== null && rightPosition !== null && leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  if (leftPosition !== null && rightPosition === null) return -1;
  if (leftPosition === null && rightPosition !== null) return 1;

  const checkedInDifference =
    getComparableTimestamp(right?.checkedInAt) - getComparableTimestamp(left?.checkedInAt);
  if (checkedInDifference !== 0) return checkedInDifference;

  return getComparableTimestamp(right?.createdAt) - getComparableTimestamp(left?.createdAt);
};

const mapActiveClockingRow = (row = {}) => {
  const job = row.job || {};
  const vehicle = job.vehicle || {};
  const customer = job.customer || {};
  const reg =
    job.vehicle_reg ||
    getVehicleRegistration(vehicle);
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
    assignedTech: technicianName
      ? {
          id: entry.userId ?? null,
          name: technicianName,
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
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const [draggingJob, setDraggingJob] = useState(null); // Job being dragged
  const [dragState, setDragState] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // Success/error feedback
  const [loading, setLoading] = useState(true); // Loading state
  const [activeClockingsByUser, setActiveClockingsByUser] = useState({});
  const [hoveredRequestJobNumber, setHoveredRequestJobNumber] = useState(null);
  const [highlightedSearchJobNumbers, setHighlightedSearchJobNumbers] = useState([]);
  const dragStateRef = useRef(null);
  const dropIndicatorRef = useRef(null);
  const searchHighlightTimeoutRef = useRef(null);
  const jobCardRefs = useRef({});

  const clearDragState = useCallback(() => {
    dragStateRef.current = null;
    dropIndicatorRef.current = null;
    setDragState(null);
    setDraggingJob(null);
    setDropIndicator(null);
  }, []);

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

  const isTechPanelJob = useCallback(
    (job) => {
      if (!job) return false;
      const statusKey = toStatusKey(job.status);
      if (STATUS_COMPLETED.has(statusKey)) return false;
      if (STATUS_EXCLUDED_TECH_PANEL.has(statusKey)) return false;
      return true;
    },
    []
  );

  const techPanelJobs = useMemo(() => jobs.filter(isTechPanelJob), [jobs, isTechPanelJob]);

  const jobsByNumber = useMemo(() => {
    const map = new Map();
    waitingJobs.forEach((job) => {
      if (job?.jobNumber) {
        map.set(job.jobNumber, job);
      }
    });
    return map;
  }, [waitingJobs]);

  const mapJobFromDatabase = (row) => {
    const customerFirst = row.customer?.firstname?.trim() || "";
    const customerLast = row.customer?.lastname?.trim() || "";
    const customerName =
      row.customer?.name ||
      [customerFirst, customerLast].filter(Boolean).join(" ").trim();

    const vehicleReg =
      row.vehicle_reg ||
      getVehicleRegistration(row.vehicle);

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
      vhcChecks: Array.isArray(row.vhc_checks) ? row.vhc_checks : [],
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
        appointments(appointment_id, scheduled_time, status, notes),
        vhc_checks(vhc_id, section, issue_title, issue_description, approval_status, authorization_state)
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
      .filter((job) => job.jobNumber && job.jobNumber.trim() !== "");

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

  const techIdSet = useMemo(() => {
    return new Set(
      (dbTechnicians || [])
        .map((tech) => tech?.id ?? tech?.user_id)
        .filter((id) => id !== null && id !== undefined)
        .map((id) => String(id))
    );
  }, [dbTechnicians]);

  const motIdSet = useMemo(() => {
    return new Set(
      (dbMotTesters || [])
        .map((tester) => tester?.id ?? tester?.user_id)
        .filter((id) => id !== null && id !== undefined)
        .map((id) => String(id))
    );
  }, [dbMotTesters]);

  const isAssignedToKnownStaff = (job) => {
    if (!job) return false;
    const assignedId = job.assignedTech?.id ?? job.assignedTo;
    if (assignedId != null) {
      const assignedIdKey = String(assignedId);
      if (techIdSet.has(assignedIdKey) || motIdSet.has(assignedIdKey)) {
        return true;
      }
    }
    const assignedRole = job.assignedTech?.role || job.technicianRole || "";
    if (assignedRole) {
      return isTechRole(assignedRole) || isMotRole(assignedRole);
    }
    const assignedNameRaw =
      job.assignedTech?.name ||
      job.technician ||
      (typeof job.assignedTo === "string" ? job.assignedTo : "");
    const normalizedAssignedName = normalizeDisplayName(assignedNameRaw);
    if (!normalizedAssignedName) return false;
    const allStaff = [...(dbTechnicians || []), ...(dbMotTesters || [])];
    return allStaff.some((staff) => {
      const label = staff?.name || staff?.email || "";
      return normalizeDisplayName(label) === normalizedAssignedName;
    });
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

    techPanelJobs.forEach((job, index) => {
      const assignedTech = job?.assignedTech;
      if (!assignedTech) return;
      const role = assignedTech.role || "";
      const shouldIncludeTech = isTechRole(role);
      const shouldIncludeMot = isMotRole(role);
      if (!shouldIncludeTech && !shouldIncludeMot) return;
      const person = {
        id: assignedTech.id || null,
        name: assignedTech.name || assignedTech.fullName || "",
        email: assignedTech.email || "",
      };
      if (shouldIncludeTech) {
        mergePerson(person, "tech", index, "assigned-tech");
      }
      if (shouldIncludeMot) {
        mergePerson(person, "mot", index, "assigned-mot");
      }
    });

    return Array.from(map.entries()).map(([normalized, entry]) => ({
      ...entry,
      normalizedName: normalized,
      roles: Array.from(entry.roles),
    }));
  }, [dbTechnicians, dbMotTesters, fallbackTechs, fallbackMot, techPanelJobs]);

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

  const outstandingJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const assignedToStaff = isAssignedToKnownStaff(job);
        const statusKey = toStatusKey(job.status);
        const isCheckedIn = Boolean(job.checkedInAt) || statusKey === "CHECKED IN";
        return isCheckedIn && !assignedToStaff;
      }).sort(compareJobsForBoard),
    [jobs, techIdSet, motIdSet, dbTechnicians, dbMotTesters]
  );

  // ✅ Search logic for job cards in the outstanding section
  const filteredOutstandingJobs = useMemo(() => {
    if (!searchTerm.trim()) return outstandingJobs;
    return outstandingJobs.filter((job) => jobMatchesSearchTerm(job, searchTerm));
  }, [searchTerm, outstandingJobs]);

  const matchedSearchJobs = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const seen = new Set();
    return jobs.filter((job) => {
      const jobNumber = String(job?.jobNumber || "").trim();
      if (!jobNumber || seen.has(jobNumber)) return false;
      const matches = jobMatchesSearchTerm(job, searchTerm);
      if (matches) seen.add(jobNumber);
      return matches;
    });
  }, [jobs, searchTerm]);

  // ✅ Group jobs by technician (using assignedTech.name)
  const getJobsForAssignee = (assignee) => {
    const normalizedAssignee = normalizeDisplayName(assignee?.name);
    const assigneeIdKey = toUserIdKey(assignee?.id);

    return techPanelJobs
      .filter((job) => {
        const jobAssignedIdKey = toUserIdKey(
          job.assignedTech?.id ?? job.assignedTo
        );
        if (assigneeIdKey && jobAssignedIdKey && assigneeIdKey === jobAssignedIdKey) {
          return true;
        }
        const assignedNameRaw =
          job.assignedTech?.name ||
          job.technician ||
          (typeof job.assignedTo === "string" ? job.assignedTo : "");

        const jobAssignedName = normalizeDisplayName(assignedNameRaw);

        return jobAssignedName && jobAssignedName === normalizedAssignee;
      })
      .sort(compareJobsForBoard);
  };

  const assignedJobs = useMemo(
    () =>
      techPanelList.map((tech, index) => ({
        ...tech,
        panelKey: `${tech.id || tech.normalizedName || "tech"}-tech-${index}`,
        jobs: getJobsForAssignee(tech),
      })),
    [techPanelJobs, techPanelList]
  );

  const assignedMotJobs = useMemo(
    () =>
      motPanelList.map((tester, index) => ({
        ...tester,
        panelKey: `${tester.id || tester.normalizedName || "mot"}-mot-${index}`,
        jobs: getJobsForAssignee(tester),
      })),
    [techPanelJobs, motPanelList]
  );

  const assigneeLookup = useMemo(() => {
    const map = new Map();
    [...assignedJobs, ...assignedMotJobs].forEach((assignee) => {
      map.set(String(assignee.panelKey), assignee);
    });
    return map;
  }, [assignedJobs, assignedMotJobs]);

  const findAssigneeForJob = useCallback(
    (job) => {
      if (!job) return null;
      const jobAssignedIdKey = toUserIdKey(job.assignedTech?.id ?? job.assignedTo);
      const jobAssignedName = normalizeDisplayName(
        job.assignedTech?.name ||
          job.technician ||
          (typeof job.assignedTo === "string" ? job.assignedTo : "")
      );

      for (const assignee of assigneeLookup.values()) {
        const assigneeIdKey = toUserIdKey(assignee.id);
        if (jobAssignedIdKey && assigneeIdKey === jobAssignedIdKey) {
          return assignee;
        }
        if (jobAssignedName && normalizeDisplayName(assignee.name) === jobAssignedName) {
          return assignee;
        }
      }

      return null;
    },
    [assigneeLookup]
  );

  const handleOpenJobDetails = (job) => {
    clearDragState();
    setFeedbackMessage(null);
    setSelectedJob(job);
  };

  const handleCloseJobDetails = () => {
    clearDragState();
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

  const handleViewSelectedJobCard = () => {
    if (!selectedJob?.jobNumber) return;
    prefetchJob(selectedJob.jobNumber); // warm SWR cache for instant load
    router.push(`/job-cards/${encodeURIComponent(selectedJob.jobNumber)}`);
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
    revalidateAllJobs(); // sync SWR cache after technician unassignment
    const refreshedJob = latestJobs.find((job) => job.id === jobId);

    setSelectedJob(refreshedJob || selectedJob);
    setFeedbackMessage({
      type: "success",
      text: `Technician unassigned from job ${jobNumber}`,
    });
  };

  const resolveDropIndicator = useCallback((clientX, clientY, job) => {
    if (typeof document === "undefined" || !job) return null;

    const element = document.elementFromPoint(clientX, clientY);
    if (!element) return null;

    const targetContainer = element.closest("[data-dnd-target-type]");
    if (!targetContainer) return null;

    const targetType = targetContainer.getAttribute("data-dnd-target-type");
    const targetKey = targetContainer.getAttribute("data-dnd-target-key") || targetType;
    const jobCard = element.closest("[data-dnd-job-card='true']");

    if (jobCard && targetContainer.contains(jobCard)) {
      const targetJobNumber = jobCard.getAttribute("data-dnd-job-number");
      const rect = jobCard.getBoundingClientRect();
      return {
        targetType,
        targetKey,
        targetJobNumber,
        placement: clientY < rect.top + rect.height / 2 ? "before" : "after",
      };
    }

    return {
      targetType,
      targetKey,
      targetJobNumber: null,
      placement: "after",
    };
  }, []);

  const handleCardPointerDown = useCallback(
    (job, onClick) => (event) => {
      if (
        !hasAccess ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      event.currentTarget.setPointerCapture?.(event.pointerId);

      const nextState = {
        job,
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        onClick,
        started: false,
      };

      dragStateRef.current = nextState;
      setDragState(nextState);
    },
    [hasAccess]
  );

  const updateJobPositions = useCallback(async (jobsToUpdate) => {
    const reindexed = jobsToUpdate.map((job, index) => ({
      ...job,
      position: index + 1,
    }));

    await Promise.all(
      reindexed
        .filter((job) => job?.id)
        .map((job) => updateJobPosition(job.id, job.position))
    );
  }, []);

  const handleDropOnTech = useCallback(
    async (job, indicator) => {
      const tech = assigneeLookup.get(String(indicator?.targetKey));
      if (!tech || !job) return;

      const sourceAssignee = findAssigneeForJob(job);
      const draggingJobTechRaw = job.assignedTech?.name || job.technician || "";
      const draggingJobTech = normalizeDisplayName(draggingJobTechRaw);
      const targetTech = normalizeDisplayName(tech.name);
      const sameAssignee = draggingJobTech && draggingJobTech === targetTech;

      if (sameAssignee && indicator?.targetJobNumber === job.jobNumber) {
        return;
      }

      if (!sameAssignee) {
        const identifier =
          tech.id && Number.isInteger(Number(tech.id))
            ? Number(tech.id)
            : tech.id || tech.name;
        await assignTechnicianToJob(job.id, identifier, tech.name);
      }

      const updatedTechJobs = tech.jobs.filter((entry) => entry.jobNumber !== job.jobNumber);
      const targetIndex = indicator?.targetJobNumber
        ? updatedTechJobs.findIndex((entry) => entry.jobNumber === indicator.targetJobNumber)
        : -1;
      const insertIndex =
        targetIndex === -1
          ? updatedTechJobs.length
          : targetIndex + (indicator?.placement === "after" ? 1 : 0);

      updatedTechJobs.splice(insertIndex, 0, job);
      await updateJobPositions(updatedTechJobs);

      if (sourceAssignee && String(sourceAssignee.panelKey) !== String(tech.panelKey)) {
        const sourceJobs = sourceAssignee.jobs.filter(
          (entry) => entry.jobNumber !== job.jobNumber
        );
        await updateJobPositions(sourceJobs);
      }
    },
    [assigneeLookup, findAssigneeForJob, updateJobPositions]
  );

  const handleDropOnOutstanding = useCallback(
    async (job, indicator) => {
      if (!job) return;

      const sourceAssignee = findAssigneeForJob(job);
      const draggingJobTechRaw = job.assignedTech?.name || job.technician || "";
      const isAssigned = normalizeDisplayName(draggingJobTechRaw) !== "";

      if (!isAssigned && indicator?.targetJobNumber === job.jobNumber) {
        return;
      }

      if (isAssigned) {
        await unassignTechnicianFromJob(job.id);
        if (sourceAssignee) {
          const sourceJobs = sourceAssignee.jobs.filter(
            (entry) => entry.jobNumber !== job.jobNumber
          );
          await updateJobPositions(sourceJobs);
        }
      }

      const updatedOutstandingJobs = outstandingJobs.filter(
        (entry) => entry.jobNumber !== job.jobNumber
      );
      const targetIndex = indicator?.targetJobNumber
        ? updatedOutstandingJobs.findIndex(
            (entry) => entry.jobNumber === indicator.targetJobNumber
          )
        : -1;
      const insertIndex =
        targetIndex === -1
          ? updatedOutstandingJobs.length
          : targetIndex + (indicator?.placement === "after" ? 1 : 0);

      updatedOutstandingJobs.splice(insertIndex, 0, job);
      await updateJobPositions(updatedOutstandingJobs);
    },
    [findAssigneeForJob, outstandingJobs, updateJobPositions]
  );

  const completePointerDrop = useCallback(
    async (job, indicator) => {
      if (!job || !indicator) return;

      if (indicator.targetType === "assignee") {
        await handleDropOnTech(job, indicator);
      }

      if (indicator.targetType === "outstanding") {
        await handleDropOnOutstanding(job, indicator);
      }

      await fetchJobs();
      revalidateAllJobs();
    },
    [fetchJobs, handleDropOnOutstanding, handleDropOnTech, revalidateAllJobs]
  );

  useEffect(() => {
    if (!dragStateRef.current) return undefined;

    const handlePointerMove = (event) => {
      if (event.pointerId !== dragStateRef.current?.pointerId) return;

      const currentState = dragStateRef.current;
      if (!currentState) return;

      const movedEnough =
        Math.abs(event.clientX - currentState.originX) >= DRAG_START_THRESHOLD_PX ||
        Math.abs(event.clientY - currentState.originY) >= DRAG_START_THRESHOLD_PX;

      const nextState = {
        ...currentState,
        clientX: event.clientX,
        clientY: event.clientY,
        started: currentState.started || movedEnough,
      };

      dragStateRef.current = nextState;
      setDragState(nextState);

      if (nextState.started) {
        event.preventDefault();
        setDraggingJob(nextState.job);
        const nextIndicator = resolveDropIndicator(event.clientX, event.clientY, nextState.job);
        dropIndicatorRef.current = nextIndicator;
        setDropIndicator(nextIndicator);
      }
    };

    const handlePointerEnd = async (event) => {
      if (event.pointerId !== dragStateRef.current?.pointerId) return;

      const currentState = dragStateRef.current;
      const currentIndicator = dropIndicatorRef.current;
      clearDragState();

      if (!currentState?.started) {
        currentState?.onClick?.();
        return;
      }

      if (!currentIndicator) return;

      try {
        await completePointerDrop(currentState.job, currentIndicator);
      } catch (error) {
        console.error("❌ Failed to drop job:", error);
        setFeedbackMessage({
          type: "error",
          text: `Failed to move ${currentState.job?.jobNumber || "job"}: ${
            error?.message || "Unknown error"
          }`,
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [clearDragState, completePointerDrop, Boolean(dragState), resolveDropIndicator]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const body = document.body;
    if (dragState?.started) {
      body.classList.add("nextjobs-drag-active");
    } else {
      body.classList.remove("nextjobs-drag-active");
    }

    return () => {
      body.classList.remove("nextjobs-drag-active");
    };
  }, [dragState?.started]);

  useEffect(() => {
    if (searchHighlightTimeoutRef.current) {
      clearTimeout(searchHighlightTimeoutRef.current);
      searchHighlightTimeoutRef.current = null;
    }

    if (!searchTerm.trim() || matchedSearchJobs.length === 0) {
      setHighlightedSearchJobNumbers([]);
      return undefined;
    }

    const jobNumbers = matchedSearchJobs
      .map((job) => String(job?.jobNumber || "").trim())
      .filter(Boolean);

    setHighlightedSearchJobNumbers(jobNumbers);

    const firstMatch = jobNumbers[0];
    const firstMatchElement = firstMatch ? jobCardRefs.current[firstMatch] : null;
    if (firstMatchElement && typeof firstMatchElement.scrollIntoView === "function") {
      firstMatchElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    searchHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedSearchJobNumbers([]);
      searchHighlightTimeoutRef.current = null;
    }, 5000);

    return () => {
      if (searchHighlightTimeoutRef.current) {
        clearTimeout(searchHighlightTimeoutRef.current);
        searchHighlightTimeoutRef.current = null;
      }
    };
  }, [matchedSearchJobs, searchTerm]);

  const handleNavigateToJobCard = useCallback(
    (jobNumber) => {
      if (!jobNumber) return;
      prefetchJob(jobNumber); // warm SWR cache for instant load
      router.push(`/job-cards/${encodeURIComponent(jobNumber)}`);
    },
    [router]
  );

  const activeDropTarget =
    dropIndicator?.targetType === "outstanding"
      ? "outstanding"
      : dropIndicator?.targetKey || null;
  const isDragActive = Boolean(dragState?.started && draggingJob);

  const matchesDropIndicator = useCallback(
    (targetType, targetKey, targetJobNumber, placement) =>
      dropIndicator?.targetType === targetType &&
      String(dropIndicator?.targetKey || "") === String(targetKey || "") &&
      String(dropIndicator?.targetJobNumber || "") === String(targetJobNumber || "") &&
      dropIndicator?.placement === placement,
    [dropIndicator]
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
    const techJobRowBackground = "var(--accent-surface)";
    const techJobRowHoverBackground = "var(--accent-surface-hover)";
    return (
      <div
        key={panelKey}
        data-dev-section-key={`nextjobs-panel-${panelKey}`}
        data-dev-section-type="content-card"
        data-dev-background-token="surface"
        data-dnd-target-type="assignee"
        data-dnd-target-key={panelKey}
        style={{
          background: "var(--surface)",
          border:
            activeDropTarget === panelKey
              ? "3px solid var(--primary)"
              : "1px solid var(--surface-light)",
          borderRadius: "var(--radius-xs)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          height: PANEL_HEIGHT_PX,
          minHeight: PANEL_HEIGHT_PX,
          maxHeight: PANEL_HEIGHT_PX,
          boxShadow:
            activeDropTarget === panelKey
              ? "0 4px 12px rgba(0, 0, 0, 0.2)"
              : "0 2px 4px rgba(var(--shadow-rgb),0.14)",
          transition: "all 0.2s ease",
          backgroundColor:
            activeDropTarget === panelKey ? "var(--surface-light)" : "var(--surface)",
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
        data-dev-section-key={`nextjobs-clocking-${panelKey}`}
        data-dev-section-parent={`nextjobs-panel-${panelKey}`}
        data-dev-section-type="stat-card"
        data-dev-background-token={currentClocking ? "success-surface" : "layer-section-level-1"}
        style={{
          marginBottom: "12px",
          padding: "12px",
          borderRadius: "var(--radius-xs)",
          border: currentClocking ? "1px solid var(--success)" : "1px dashed var(--accent-purple)",
          backgroundColor: currentClocking ? "var(--success-surface)" : "var(--layer-section-level-1)",
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
      <div
        data-dev-section-key={`nextjobs-joblist-${panelKey}`}
        data-dev-section-parent={`nextjobs-panel-${panelKey}`}
        data-dev-section-type="section-shell"
        data-dnd-target-type="assignee"
        data-dnd-target-key={panelKey}
        style={{
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
          assignee.jobs.map((job) => {
            const isSearchHighlighted = highlightedSearchJobNumbers.includes(job.jobNumber);
            return (
            <React.Fragment key={job.jobNumber}>
              {matchesDropIndicator("assignee", panelKey, job.jobNumber, "before") && (
                <div style={{
                  height: "3px",
                  backgroundColor: "var(--primary)",
                  marginBottom: "8px",
                  borderRadius: "var(--radius-xs)",
                }} />
              )}

              <div
                ref={(node) => {
                  if (node) {
                    jobCardRefs.current[job.jobNumber] = node;
                  } else if (jobCardRefs.current[job.jobNumber]) {
                    delete jobCardRefs.current[job.jobNumber];
                  }
                }}
                data-dnd-job-card="true"
                data-dnd-job-number={job.jobNumber}
                onPointerDown={handleCardPointerDown(job, () => handleOpenJobDetails(job))}
                style={{
                  border: isSearchHighlighted ? "2px solid var(--success)" : "none",
                  borderRadius: "var(--radius-xs)",
                  padding: "10px",
                  marginBottom: "8px",
                  backgroundColor:
                    draggingJob?.jobNumber === job.jobNumber
                      ? techJobRowHoverBackground
                      : isSearchHighlighted
                      ? "var(--success-surface)"
                      : techJobRowBackground,
                  cursor: hasAccess ? "grab" : "pointer",
                  transition: "all 0.2s",
                  opacity: draggingJob?.jobNumber === job.jobNumber ? 0.5 : 1,
                  touchAction: "none",
                  boxShadow: isSearchHighlighted
                    ? "0 0 0 2px rgba(34, 197, 94, 0.18), 0 8px 18px rgba(34, 197, 94, 0.22)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (draggingJob?.jobNumber !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = isSearchHighlighted ? "var(--success-surface)" : techJobRowHoverBackground;
                    e.currentTarget.style.boxShadow = isSearchHighlighted
                      ? "0 0 0 2px rgba(34, 197, 94, 0.18), 0 8px 18px rgba(34, 197, 94, 0.22)"
                      : "0 0 0 1px rgba(var(--accent-base-rgb), 0.14)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (draggingJob?.jobNumber !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = isSearchHighlighted ? "var(--success-surface)" : techJobRowBackground;
                    e.currentTarget.style.boxShadow = isSearchHighlighted
                      ? "0 0 0 2px rgba(34, 197, 94, 0.18), 0 8px 18px rgba(34, 197, 94, 0.22)"
                      : "none";
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

              {matchesDropIndicator("assignee", panelKey, job.jobNumber, "after") && (
                  <div style={{
                    height: "3px",
                    backgroundColor: "var(--primary)",
                    marginBottom: "8px",
                    borderRadius: "var(--radius-xs)",
                    }} />
                )}
            </React.Fragment>
          );
          })
        )}

        {assignee.jobs.length > 0 &&
          activeDropTarget === panelKey &&
          !dropIndicator?.targetJobNumber &&
          draggingJob && (
            <div style={{
              height: "3px",
              backgroundColor: "var(--primary)",
              borderRadius: "var(--radius-xs)",
              marginTop: "4px",
            }} />
          )}

        {assignee.jobs.length === 0 &&
          activeDropTarget === panelKey &&
          draggingJob && (
            <div style={{
              height: "3px",
              backgroundColor: "var(--primary)",
              borderRadius: "var(--radius-xs)",
              marginTop: "12px",
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

  if (loading) {
    return <Layout />;
  }

  // ✅ Page layout
  return (
    <Layout>
      <div
        data-dev-section-key="nextjobs-page-shell"
        data-dev-shell="1"
        data-dev-section-type="page-shell"
        data-dev-background-token="none"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "8px 16px",
          gap: "12px"
        }}>
        
        {/* ✅ Outstanding Jobs Section with Drop Zone */}
            <div
              data-dev-section-key="nextjobs-outstanding"
              data-dev-section-parent="nextjobs-page-shell"
              data-dev-section-type="content-card"
              data-dev-background-token="layer-section-level-3"
            style={{
                marginBottom: "12px",
                background: "var(--layer-section-level-3)",
                borderRadius: "var(--radius-xs)",
            border: activeDropTarget === "outstanding" ? "3px solid var(--primary)" : "1px solid var(--surface-light)",
            boxShadow: activeDropTarget === "outstanding" ? "0 4px 12px rgba(0, 0, 0, 0.2)" : "0 2px 4px rgba(var(--shadow-rgb),0.08)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            minHeight: OUTSTANDING_GRID_MAX_HEIGHT_PX,
            flexShrink: 0,
            transition: "all 0.2s ease",
            backgroundColor: activeDropTarget === "outstanding" ? "var(--surface-light)" : "var(--layer-section-level-3)",
            color: "var(--text-primary)"
          }}
        >
          <div
            data-dev-section-key="nextjobs-outstanding-header"
            data-dev-section-parent="nextjobs-outstanding"
            data-dev-section-type="toolbar"
            style={{
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
          
          <SearchBar
            placeholder="Search job number, reg, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            style={{
              marginBottom: "12px",
            }}
          />

          <div
            data-dev-section-key="nextjobs-outstanding-scroll"
            data-dev-section-parent="nextjobs-outstanding"
            data-dev-section-type="section-shell"
            data-dnd-target-type="outstanding"
            data-dnd-target-key="outstanding"
            style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div
              data-dnd-target-type="outstanding"
              data-dnd-target-key="outstanding"
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: OUTSTANDING_GRID_MAX_HEIGHT_PX,
                paddingRight: "6px",
              }}
            >
              {filteredOutstandingJobs.length === 0 ? (
                <>
                  <p style={{ color: "var(--text-primary)", fontSize: "14px", margin: 0 }}>
                    {searchTerm.trim() ? "No matching jobs found." : "No outstanding jobs."}
                  </p>
                  {activeDropTarget === "outstanding" && draggingJob && (
                    <div
                      style={{
                        height: "3px",
                        backgroundColor: "var(--primary)",
                        borderRadius: "var(--radius-xs)",
                        marginTop: "12px",
                      }}
                    />
                  )}
                </>
              ) : (
                <div className="outstanding-grid">
                  {filteredOutstandingJobs.map((job) => {
                    const jobTypeLabel = deriveJobTypeLabel(job);
                    const customerStatus = formatCustomerStatus(job.waitingStatus);
                    const requestsCount = getJobRequestsCount(job);
                    const requestItems = getJobRequestItems(job);
                    const isSearchHighlighted = highlightedSearchJobNumbers.includes(job.jobNumber);
                    const showRequestsHover = hoveredRequestJobNumber === job.jobNumber && requestItems.length > 0;
                    const appointmentDisplay = formatAppointmentTime(job);
                    return (
                      <React.Fragment key={job.jobNumber}>
                        {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "before") && (
                          <div style={{
                            height: "3px",
                            backgroundColor: "var(--primary)",
                            marginBottom: "8px",
                            borderRadius: "var(--radius-xs)",
                          }} />
                        )}
                        <div
                          ref={(node) => {
                            if (node) {
                              jobCardRefs.current[job.jobNumber] = node;
                            } else if (jobCardRefs.current[job.jobNumber]) {
                              delete jobCardRefs.current[job.jobNumber];
                            }
                          }}
                          data-dnd-job-card="true"
                          data-dnd-job-number={job.jobNumber}
                          onPointerDown={handleCardPointerDown(job, () => handleOpenJobDetails(job))}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            padding: "14px",
                            position: "relative",
                            borderRadius: "var(--radius-md)",
                            border:
                              draggingJob?.jobNumber === job.jobNumber
                                ? "2px dashed var(--primary)"
                                : isSearchHighlighted
                                ? "2px solid var(--success)"
                                : "1px solid var(--surface-light)",
                            backgroundColor:
                              draggingJob?.jobNumber === job.jobNumber
                                ? "var(--surface-light)"
                                : isSearchHighlighted
                                ? "var(--success-surface)"
                                : "var(--surface)",
                            cursor: hasAccess ? "grab" : "pointer",
                            transition: "border 0.2s, background-color 0.2s, transform 0.2s",
                            touchAction: "none",
                            boxShadow: isSearchHighlighted
                              ? "0 0 0 2px rgba(34, 197, 94, 0.18), 0 8px 18px rgba(34, 197, 94, 0.22)"
                              : "none",
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
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseEnter={() => {
                                if (requestItems.length > 0) {
                                  setHoveredRequestJobNumber(job.jobNumber);
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredRequestJobNumber((current) =>
                                  current === job.jobNumber ? null : current
                                );
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "var(--control-radius)",
                                backgroundColor: "var(--danger-surface)",
                                color: "var(--danger)",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: requestItems.length > 0 ? "help" : "default",
                              }}
                            >
                              {jobTypeLabel}
                            </span>
                          </div>
                          {showRequestsHover ? (
                            <div
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseEnter={() => setHoveredRequestJobNumber(job.jobNumber)}
                              onMouseLeave={() => {
                                setHoveredRequestJobNumber((current) =>
                                  current === job.jobNumber ? null : current
                                );
                              }}
                              style={{
                                position: "absolute",
                                top: "48px",
                                right: "14px",
                                width: "min(320px, calc(100% - 28px))",
                                maxHeight: "160px",
                                overflowY: "auto",
                                padding: "12px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--accent-purple-surface)",
                                backgroundColor: "var(--surface)",
                                boxShadow: "0 12px 28px rgba(var(--shadow-rgb), 0.18)",
                                zIndex: 3,
                              }}
                            >
                              <div
                                style={{
                                  marginBottom: "8px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "var(--accent-purple)",
                                }}
                              >
                                Job Requests
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {requestItems.map((request, index) => (
                                  <div
                                    key={request.id}
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      alignItems: "flex-start",
                                      fontSize: "12px",
                                      color: "var(--text-primary)",
                                      lineHeight: "1.4",
                                    }}
                                  >
                                    <span
                                      style={{
                                        flexShrink: 0,
                                        width: "18px",
                                        color: "var(--accent-purple)",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {index + 1}.
                                    </span>
                                    <span>{request.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
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
                                borderRadius: "var(--radius-sm)",
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
                        {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "after") && (
                          <div style={{
                            height: "3px",
                            backgroundColor: "var(--primary)",
                            marginBottom: "8px",
                            borderRadius: "var(--radius-xs)",
                          }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredOutstandingJobs.length > 0 &&
                    activeDropTarget === "outstanding" &&
                    !dropIndicator?.targetJobNumber &&
                    draggingJob && (
                      <div
                        style={{
                          height: "3px",
                          backgroundColor: "var(--primary)",
                          borderRadius: "var(--radius-xs)",
                          marginTop: "4px",
                        }}
                      />
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Technicians Grid Section */}
            <div
              data-dev-section-key="nextjobs-technicians"
              data-dev-section-parent="nextjobs-page-shell"
              data-dev-shell="1"
              data-dev-section-type="content-card"
              data-dev-background-token="layer-section-level-3"
              style={{
                flex: "1 0 auto",
                borderRadius: "var(--radius-xs)",
                border: "none",
                background: "var(--layer-section-level-3)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "24px"
              }}>
          
          <div
            data-dev-section-key="nextjobs-tech-grid"
            data-dev-section-parent="nextjobs-technicians"
            data-dev-section-type="data-table"
            data-dev-width-mode="full"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gridAutoRows: PANEL_HEIGHT_PX,
              gap: "16px",
              width: "100%"
            }}>
            {assignedJobs.slice(0, 6).map(renderAssigneePanel)}
          </div>

              {motPanelList.length > 0 && (
                <div
                  data-dev-section-key="nextjobs-mot-section"
                  data-dev-section-parent="nextjobs-technicians"
                  data-dev-section-type="section-shell"
                >
                  <h3 style={{
                    margin: "0 0 12px 0",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "var(--accent-purple)"
                  }}>
                    MOT Testers
                  </h3>
              <div
                data-dev-section-key="nextjobs-mot-grid"
                data-dev-section-parent="nextjobs-mot-section"
                data-dev-section-type="data-table"
                data-dev-width-mode="full"
                style={{
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

        {isDragActive && draggingJob && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: dragState.clientX + DRAG_PREVIEW_OFFSET_PX,
              top: dragState.clientY + DRAG_PREVIEW_OFFSET_PX,
              pointerEvents: "none",
              zIndex: 3200,
              minWidth: "180px",
              maxWidth: "260px",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(var(--primary-rgb), 0.28)",
              background: "rgba(255, 255, 255, 0.96)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.16)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--accent-purple)",
                marginBottom: "2px",
              }}
            >
              {draggingJob.jobNumber}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
              {draggingJob.reg || "Reg TBC"}
            </div>
          </div>
        )}

        <style jsx global>{`
          body.nextjobs-drag-active,
          body.nextjobs-drag-active * {
            user-select: none !important;
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            cursor: grabbing !important;
          }
        `}</style>

        {/* ✅ JOB DETAILS POPUP */}
        {selectedJob && (
          (() => {
            const detailsRows = getJobDetailsRequestRows(selectedJob);
            const hasScrollableDetails = detailsRows.length > 5;
            const assignedToName = selectedJob.assignedTech?.name || "Unassigned";
            return (
          <div className="popup-backdrop" onClick={handleCloseJobDetails}>
            <div
              className="popup-card"
              data-dev-section-key="nextjobs-job-details-popup"
              data-dev-section-type="content-card"
              data-dev-background-token="surface"
              style={{
                borderRadius: "var(--radius-xl)",
                width: "100%",
                maxWidth: "500px",
                maxHeight: "90vh",
                overflowY: "auto",
                border: "none",
                padding: "32px",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "var(--primary)",
              }}>
                Job Details
              </h3>
              
              {feedbackMessage && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-xs)",
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {[
                    { label: "Job Number", value: selectedJob.jobNumber || "Not available" },
                    { label: "Reg", value: selectedJob.reg || "Not available" },
                    { label: "Customer", value: selectedJob.customer || "Unknown customer" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--accent-purple-surface)",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-purple)", marginBottom: "6px" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  {[
                    { label: "Make & Model", value: [selectedJob.make, selectedJob.model].filter(Boolean).join(" ") || selectedJob.makeModel || "Not available" },
                    { label: "Status", value: selectedJob.status || "Status pending" },
                    { label: "Assigned To", value: assignedToName },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--accent-purple-surface)",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-purple)", marginBottom: "6px" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--accent-purple-surface)",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-purple)", marginBottom: "8px" }}>
                    Description
                  </div>
                  {detailsRows.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        maxHeight: hasScrollableDetails ? "280px" : "none",
                        overflowY: hasScrollableDetails ? "auto" : "visible",
                        paddingRight: hasScrollableDetails ? "4px" : 0,
                      }}
                    >
                      {detailsRows.map((row) => (
                        <div
                          key={row.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "120px minmax(0, 1fr)",
                            gap: "10px",
                            alignItems: "start",
                            padding: "10px 12px",
                            borderRadius: "var(--radius-xs)",
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--accent-purple-surface)",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent-purple)" }}>
                            {row.label}
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.45" }}>
                            {row.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                      No request details recorded.
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${selectedJob?.assignedTech ? 3 : 2}, minmax(0, 1fr))`,
                  gap: "12px"
                }}
              >
                <button
                  style={jobDetailsPopupPrimaryButtonStyle}
                  onClick={handleViewSelectedJobCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary-dark)";
                    e.currentTarget.style.borderColor = "var(--primary-dark)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--accent-purple)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                >
                  View Job Card
                </button>
                {selectedJob.assignedTech && (
                  <button
                    style={jobDetailsPopupWarningButtonStyle}
                    onClick={unassignTechFromJob} // Unassign technician
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--warning)";
                      e.currentTarget.style.color = "var(--text-inverse)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--warning-surface)";
                      e.currentTarget.style.color = "var(--warning-dark)";
                    }}
                  >
                    Unassign
                  </button>
                )}
                <button
                  style={jobDetailsPopupSecondaryButtonStyle}
                  onClick={handleCloseJobDetails} // Close popup
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-light)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--accent-purple-surface)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
            );
          })()
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
