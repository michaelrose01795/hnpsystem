// file location: src/pages/appointments/index.js
// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react"; // Import React hooks
import Layout from "@/components/Layout"; // Main layout wrapper
import Popup from "@/components/popups/Popup"; // Reusable popup modal
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { useRouter } from "next/router"; // For reading query params
import { useUser } from "@/context/UserContext"; // Access current user for check-in attribution
import { useNextAction } from "@/context/NextActionContext"; // Trigger follow-up actions after check-in
import {
  createOrUpdateAppointment,
  getJobByNumberOrReg,
  getJobsByDate // ✅ NEW: Get appointments by date
} from "@/lib/database/jobs"; // DB functions
import { autoSetCheckedInStatus } from "@/lib/services/jobStatusService"; // Shared status transition helper
import supabase from "@/lib/database/supabaseClient"; // Supabase client for live tech availability
import { useConfirmation } from "@/context/ConfirmationContext";
import { parseLeaveRequestNotes } from "@/lib/hr/leaveRequests";
import { invalidateCache } from "@/lib/database/queryCache"; // clear stale cache after mutations
import { revalidateAllJobs } from "@/lib/swr/mutations"; // SWR cache invalidation after mutations
import { useJobsList } from "@/hooks/useJobsList"; // SWR-powered jobs list with auto-refresh
import { prefetchJob } from "@/lib/swr/prefetch"; // warm SWR cache on hover for instant navigation
import AppointmentsUi from "@/components/page-ui/appointments/appointments-ui"; // Extracted presentation layer.
const TECH_AVAILABILITY_TABLE = "job_clocking"; // Source table for tech availability data

// Calculate hours worked between two timestamps
const calculateDurationHours = (start, end) => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return 0;
  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
};

const getDateKey = (dateInput) => {
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return dateObj.toDateString();
};

// Generate list of dates excluding Sundays
const generateDates = (daysAhead = 60) => {
  const result = [];
  const today = new Date();
  let count = 0;
  let current = new Date(today);

  while (count < daysAhead) {
    if (current.getDay() !== 0) {// Skip Sundays
      result.push(new Date(current));
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
};

// Generate time slots from 8:00 AM to 5:00 PM in 30-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour <= 17; hour++) {// 8 AM to 5 PM
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 17) slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

const parseHoursValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getDailyHoursFromWeeklyContracted = (value) => {
  const weeklyHours = parseHoursValue(value);
  if (weeklyHours === null || weeklyHours <= 0) return null;
  return parseFloat((weeklyHours / 5).toFixed(2));
};

const getTechDailyHours = (source, fallbackHours = DEFAULT_RETAIL_TECH_HOURS) => {
  const contractedDailyHours = getDailyHoursFromWeeklyContracted(
    source?.contracted_hours ?? source?.contractedHours
  );
  return contractedDailyHours ?? fallbackHours;
};

const deriveAvailableHours = (entry) => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const fallbackFields = [
  "available_hours",
  "scheduled_hours",
  "max_hours",
  "assigned_hours",
  "hours",
  "hours_worked"];


  for (const field of fallbackFields) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) {
      const numeric = parseHoursValue(entry[field]);
      if (numeric !== null) return numeric;
    }
  }

  return null;
};

const normalizeStatusValue = (value) => String(value || "").trim().toLowerCase();

const isJobActuallyCheckedIn = (job) => {
  if (!job) return false;
  if (job.checked_in_at || job.checkedInAt) return true;

  const appointmentStatus = normalizeStatusValue(job.appointment?.status);
  const jobStatus = normalizeStatusValue(job.status);

  return (
    appointmentStatus === "checked_in" ||
    appointmentStatus === "checked in" ||
    jobStatus === "checked_in" ||
    jobStatus === "checked in");

};

const getCapacityStatus = (booked, available) => {
  const numericBooked = parseHoursValue(booked) || 0;
  const numericAvailable = parseHoursValue(available) || 0;

  if (numericAvailable <= 0) {
    return numericBooked > 0 ? "red" : "default";
  }

  if (numericBooked >= numericAvailable + 0.5) {
    return "red";
  }

  if (numericAvailable - numericBooked <= 3) {
    return "amber";
  }

  return "default";
};

const getStatusBadgeStyle = (status) => {
  if (status === "red") {
    return { backgroundColor: "var(--surface-light)", color: "var(--danger)" };
  }
  if (status === "amber") {
    return { backgroundColor: "var(--warning-surface)", color: "var(--warning)" };
  }
  return { backgroundColor: "var(--success-surface)", color: "var(--success-dark)" };
};

const getCapacityStatusLabel = (status) => {
  if (status === "red") return "Over capacity";
  if (status === "amber") return "Approaching max";
  return "Within capacity";
};

const DEFAULT_RETAIL_TECH_COUNT = 6;
const DEFAULT_RETAIL_TECH_HOURS = 6;
const DEFAULT_RETAIL_TECH_NAMES = [
"Retail Tech 1",
"Retail Tech 2",
"Retail Tech 3",
"Retail Tech 4",
"Retail Tech 5",
"Retail Tech 6"];

const TECH_USER_ROLES = [
"Techs",
"Technician",
"Technician Lead",
"Lead Technician"];


const CALENDAR_SEVERITY_STYLES = {
  amber: {
    backgroundColor: "var(--warning-surface)",
    textColor: "var(--warning)",
    borderColor: "transparent"
  },
  red: {
    backgroundColor: "var(--danger-surface)",
    textColor: "var(--danger)",
    borderColor: "transparent"
  }
};

const SATURDAY_SEVERITY_STYLES = {
  amber: {
    backgroundColor: "var(--warning-surface)",
    textColor: "var(--warning)",
    borderColor: "transparent"
  },
  red: {
    backgroundColor: "var(--danger-dark)",
    textColor: "var(--surface)",
    borderColor: "transparent"
  }
};

const getBookingSeverity = (percent) => {
  if (Number.isNaN(percent)) return "green";
  if (percent >= 90) return "red";
  if (percent >= 50) return "amber";
  return "green";
};

const STAFF_ROLES = new Set([
"service advisor",
"technician",
"techs",
"technician lead",
"lead technician",
"mot tester",
"tester",
"workshop manager",
"service manager",
"after sales manager"]
);

const toMidnightDate = (value) => {
  if (!value) return null;
  const dateObj = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(dateObj.getTime())) return null;
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
};

const formatRoleLabel = (role) => {
  if (!role || typeof role !== "string") return "Staff";
  return role.
  split(/\s+/).
  map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()).
  join(" ");
};

const formatStaffName = (user) => {
  if (!user) return "Staff Member";
  const first = (user.first_name || "").trim();
  const last = (user.last_name || "").trim();
  return [first, last].filter(Boolean).join(" ") || user.email || "Staff Member";
};

const normalizeKey = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const getAbsenceUnavailableHours = (absence, currentDate) => {
  const noteData = parseLeaveRequestNotes(absence?.notes);
  const currentDateKey = toMidnightDate(currentDate)?.getTime();
  const absenceEndKey = toMidnightDate(absence?.end_date)?.getTime();
  if (!currentDateKey || !absenceEndKey) return null;

  const dailyHours = getTechDailyHours(absence?.user);

  return noteData.halfDay && noteData.halfDay !== "None" && currentDateKey === absenceEndKey ?
  dailyHours / 2 :
  dailyHours;
};

const buildStaffAbsenceMap = (records = [], calendarStart, calendarEnd) => {
  const map = {};
  const startBoundary = toMidnightDate(calendarStart);
  const endBoundary = toMidnightDate(calendarEnd);
  if (!startBoundary || !endBoundary || startBoundary > endBoundary) return map;

  const oneDayMs = 24 * 60 * 60 * 1000;

  (records || []).forEach((absence) => {
    const user = absence?.user;
    const normalizedRole = (user?.role || "").trim();
    const roleKey = normalizedRole.toLowerCase();
    if (!STAFF_ROLES.has(roleKey)) return;

    const absenceStart = toMidnightDate(absence?.start_date);
    const absenceEnd = absence?.end_date ?
    toMidnightDate(absence.end_date) :
    absenceStart;
    if (!absenceStart || !absenceEnd) return;

    const effectiveStartMs = Math.max(absenceStart.getTime(), startBoundary.getTime());
    const effectiveEndMs = Math.min(absenceEnd.getTime(), endBoundary.getTime());
    if (effectiveStartMs > effectiveEndMs) return;

    const entryBase = {
      id: `${absence.absence_id}-${user?.user_id || absence.absence_id}`,
      userId: user?.user_id || null,
      name: formatStaffName(user),
      role: formatRoleLabel(normalizedRole),
      type: absence?.type || "Holiday"
    };

    for (let currentMs = effectiveStartMs; currentMs <= effectiveEndMs; currentMs += oneDayMs) {
      const currentDate = new Date(currentMs);
      const dateKey = currentDate.toDateString();
      if (!map[dateKey]) {
        map[dateKey] = [];
      }

      map[dateKey].push({
        ...entryBase,
        unavailableHours: getAbsenceUnavailableHours(absence, currentDate)
      });
    }
  });

  return map;
};

// ---------------- Utility Functions ----------------
// ✅ Display vehicle info using new database fields
const getVehicleDisplay = (job) => {
  // Try makeModel first (combined field), then fall back to make + model
  if (job.makeModel) return job.makeModel;

  const make = job.make || "";
  const model = job.model || "";
  const year = job.year || "";
  return [year, make, model].filter(Boolean).join(" ") || "-";
};

const buildTechAvailabilityMap = (records = []) => {
  const availability = {};

  records.forEach((entry) => {
    if (!entry?.clock_in) return;

    const dateKey = getDateKey(entry.clock_in);
    if (!availability[dateKey]) {
      availability[dateKey] = { totalTechs: 0, techs: [] };
    }

    const techId = entry.user_id;
    const techName = entry.user ?
    `${entry.user.first_name || ""} ${entry.user.last_name || ""}`.trim() :
    "";
    const normalizedName = techName || `Tech #${techId}`;

    let techRecord = availability[dateKey].techs.find(
      (tech) => tech.techId === techId
    );

    if (!techRecord) {
      techRecord = {
        techId,
        name: normalizedName,
        totalHours: 0,
        segments: [],
        latestClockIn: entry.clock_in,
        latestClockOut: entry.clock_out || null,
        currentlyClockedIn: !entry.clock_out,
        availableHours: deriveAvailableHours(entry) ?? getTechDailyHours(entry.user)
      };
      availability[dateKey].techs.push(techRecord);
    }

    const duration = entry.clock_out ?
    calculateDurationHours(entry.clock_in, entry.clock_out) :
    0;

    techRecord.totalHours = parseFloat(
      (techRecord.totalHours + duration).toFixed(2)
    );
    techRecord.latestClockIn = entry.clock_in;
    techRecord.latestClockOut = entry.clock_out || techRecord.latestClockOut;
    techRecord.currentlyClockedIn =
    techRecord.currentlyClockedIn || !entry.clock_out;

    if (entry.job_number) {
      techRecord.segments.push({
        jobNumber: entry.job_number,
        workType: entry.work_type || "general",
        startedAt: entry.clock_in,
        endedAt: entry.clock_out
      });
    }

    const explicitAvailableHours = deriveAvailableHours(entry);
    if (explicitAvailableHours !== null) {
      techRecord.availableHours = explicitAvailableHours;
    }

    availability[dateKey].totalTechs = availability[dateKey].techs.length;
  });

  Object.values(availability).forEach((day) => {
    day.techs.sort((a, b) => a.name.localeCompare(b.name));
  });

  return availability;
};

export default function Appointments() {
  const router = useRouter();
  const jobQueryParam = Array.isArray(router.query.jobNumber) ?
  router.query.jobNumber[0] :
  router.query.jobNumber;
  const { user, dbUserId } = useUser();
  const { triggerNextAction } = useNextAction();
  const { confirm } = useConfirmation();

  // ---------------- SWR-powered jobs list (auto-refresh, cached, deduplicated) ----------------
  const { jobs: allJobs, mutate: mutateJobs } = useJobsList({ enabled: !!user });
  const jobs = useMemo(() => (allJobs || []).filter((job) => job.appointment), [allJobs]); // filter to only jobs with appointments

  // ---------------- States ----------------
  const [dates, setDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [notes, setNotes] = useState({});
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [time, setTime] = useState("");
  const [highlightJob, setHighlightJob] = useState("");
  const [jobParamActive, setJobParamActive] = useState(true);
  const [techAvailability, setTechAvailability] = useState({});
  const [isTechAvailabilityLoading, setIsTechAvailabilityLoading] = useState(false);
  const [techAvailabilityError, setTechAvailabilityError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeSlots] = useState(generateTimeSlots());
  const [isLoading, setIsLoading] = useState(false);
  const [checkingInJobId, setCheckingInJobId] = useState(null);
  const [jobRequestHours, setJobRequestHours] = useState({});
  const [jobVhcLabourHours, setJobVhcLabourHours] = useState({});
  const [staffAbsences, setStaffAbsences] = useState({});
  const [showStaffOffPopup, setShowStaffOffPopup] = useState(false);
  const [staffOffPopupDetails, setStaffOffPopupDetails] = useState([]);
  const [staffOffPopupDate, setStaffOffPopupDate] = useState(null);
  const [activeDayTab, setActiveDayTab] = useState("jobs");
  const [techHoursOverrides, setTechHoursOverrides] = useState({});
  const [techUsers, setTechUsers] = useState([]);
  const [isCompactMobile, setIsCompactMobile] = useState(false);

  const techUserNameMap = useMemo(() => {
    const map = new Map();
    (techUsers || []).forEach((user) => {
      if (!user?.user_id) return;
      map.set(normalizeKey(user.user_id), formatStaffName(user));
    });
    return map;
  }, [techUsers]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateViewportFlags = () => {
      setIsCompactMobile(window.innerWidth <= 640);
    };

    updateViewportFlags();
    window.addEventListener("resize", updateViewportFlags);
    return () => window.removeEventListener("resize", updateViewportFlags);
  }, []);

  const fetchJobRequestHours = useCallback(async (jobIds = []) => {
    if (!jobIds || jobIds.length === 0) {
      setJobRequestHours({});
      return;
    }

    const uniqueJobIds = Array.from(new Set(jobIds));

    try {
      const { data, error } = await supabase.
      from("job_requests").
      select("job_id, hours").
      in("job_id", uniqueJobIds);

      if (error) throw error;

      const aggregated = {};
      (data || []).forEach((row) => {
        if (!row?.job_id) return;
        const hours = parseHoursValue(row.hours) ?? 0;
        const key = row.job_id;
        aggregated[key] = (aggregated[key] || 0) + hours;
      });

      setJobRequestHours(aggregated);
    } catch (error) {
      console.error("Error fetching job request hours:", error);
    }
  }, []);

  const fetchJobVhcLabourHours = useCallback(async (jobIds = []) => {
    if (!jobIds || jobIds.length === 0) {
      setJobVhcLabourHours({});
      return;
    }

    const uniqueJobIds = Array.from(new Set(jobIds));

    try {
      const { data, error } = await supabase.
      from("vhc_checks").
      select("job_id, labour_hours, approval_status").
      in("job_id", uniqueJobIds);

      if (error) throw error;

      const aggregated = {};
      (data || []).forEach((row) => {
        if (!row?.job_id) return;
        const status = String(row?.approval_status || "").trim().toLowerCase();
        if (status !== "authorized" && status !== "authorised" && status !== "completed") {
          return;
        }
        const vhcHours = parseHoursValue(row.labour_hours) ?? 0;
        if (vhcHours <= 0) return;
        const key = row.job_id;
        aggregated[key] = (aggregated[key] || 0) + vhcHours;
      });

      setJobVhcLabourHours(aggregated);
    } catch (error) {
      console.error("Error fetching VHC labour hours:", error);
    }
  }, []);

  const fetchTechAvailability = useCallback(async () => {
    if (!dates || dates.length === 0) return;

    setIsTechAvailabilityLoading(true);
    setTechAvailabilityError("");

    const startDate = dates[0].toISOString().split("T")[0];
    const endDate = dates[dates.length - 1].toISOString().split("T")[0];

    try {
      const { data, error } = await supabase.
      from(TECH_AVAILABILITY_TABLE).
      select(`
          id,
          user_id,
          job_id,
          job_number,
          clock_in,
          clock_out,
          work_type,
          updated_at,
          user:user_id(
            user_id,
            first_name,
            last_name,
            contracted_hours
          )
        `).
      gte("clock_in", `${startDate}T00:00:00.000Z`).
      lte("clock_in", `${endDate}T23:59:59.999Z`);

      if (error) throw error;

      const availabilityMap = buildTechAvailabilityMap(data || []);
      setTechAvailability(availabilityMap);
    } catch (error) {
      console.error("Error fetching tech availability:", error);
      setTechAvailabilityError("Unable to load live tech availability.");
    } finally {
      setIsTechAvailabilityLoading(false);
    }
  }, [dates]);

  const fetchTechUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.
      from("users").
      select("user_id, first_name, last_name, email, role, contracted_hours").
      in("role", TECH_USER_ROLES).
      order("first_name", { ascending: true });

      if (error) throw error;
      setTechUsers(data || []);
    } catch (error) {
      console.error("Error fetching tech users:", error);
      setTechUsers([]);
    }
  }, []);

  const fetchStaffAbsences = useCallback(async () => {
    if (!dates || dates.length === 0) return;

    const startDate = dates[0].toISOString().split("T")[0];
    const endDate = dates[dates.length - 1].toISOString().split("T")[0];

    try {
      const { data, error } = await supabase.
      from("hr_absences").
      select(`
          absence_id,
          type,
          start_date,
          end_date,
          notes,
          approval_status,
          user:user_id(
            user_id,
            first_name,
            last_name,
            email,
            role,
            contracted_hours
          )
        `).
      eq("approval_status", "Approved").
      lte("start_date", endDate).
      gte("end_date", startDate);

      if (error) throw error;

      const map = buildStaffAbsenceMap(data || [], dates[0], dates[dates.length - 1]);
      setStaffAbsences(map);
    } catch (error) {
      console.error("Error fetching staff absences:", error);
      setStaffAbsences({});
    }
  }, [dates]);

  useEffect(() => {
    setDates(generateDates(60));
  }, []);

  useEffect(() => {
    if (!dates.length) return;
    fetchTechAvailability();
  }, [dates, fetchTechAvailability]);

  useEffect(() => {
    fetchTechUsers();
  }, [fetchTechUsers]);

  useEffect(() => {
    const jobIdsWithAppointments = jobs.
    filter((job) => job.appointment?.date).
    map((job) => job.id).
    filter(Boolean);

    if (jobIdsWithAppointments.length === 0) {
      setJobRequestHours({});
      setJobVhcLabourHours({});
      return;
    }

    fetchJobRequestHours(jobIdsWithAppointments);
    fetchJobVhcLabourHours(jobIdsWithAppointments);
  }, [jobs, fetchJobRequestHours, fetchJobVhcLabourHours]);

  useEffect(() => {
    if (!dates.length) return;
    fetchStaffAbsences();
  }, [dates, fetchStaffAbsences]);

  useEffect(() => {
    if (!dates.length) return;

    const channel = supabase.
    channel("job_clocking_changes").
    on(
      "postgres_changes",
      { event: "*", schema: "public", table: TECH_AVAILABILITY_TABLE },
      () => {
        fetchTechAvailability();
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dates, fetchTechAvailability]);

  // Real-time subscription for jobs and appointments tables — revalidate SWR when data changes
  useEffect(() => {
    const channel = supabase.
    channel("appointments-page-jobs-sync") // unique channel name for this page
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "jobs" }, // listen for all job changes
      () => {mutateJobs();} // trigger SWR revalidation (deduplicated)
    ).
    on(
      "postgres_changes",
      { event: "*", schema: "public", table: "appointments" }, // listen for appointment changes
      () => {mutateJobs();} // trigger SWR revalidation (deduplicated)
    ).
    subscribe();

    return () => {supabase.removeChannel(channel);}; // clean up on unmount
  }, [mutateJobs]);

  useEffect(() => {
    setJobParamActive(true);
  }, [jobQueryParam]);

  // ✅ Handle jobNumber from URL parameters
  useEffect(() => {
    if (!router.isReady || !jobParamActive) return;
    const jobParam = typeof jobQueryParam === "string" ? jobQueryParam : "";
    if (jobParam.trim().length > 0) {
      setJobNumber(jobParam);
      const existingJob = jobs.find((j) => j.jobNumber.toString() === jobParam || j.id.toString() === jobParam);
      if (existingJob && existingJob.appointment) {
        setSelectedDay(new Date(existingJob.appointment.date));
        setTime(existingJob.appointment.time);
      }
    }
  }, [router.isReady, jobParamActive, jobQueryParam, jobs]);

  // ---------------- Notes ----------------
  const handleAddNote = (date) => {
    setSelectedDay(date);
    const dateKey = date.toDateString();
    setCurrentNote(notes[dateKey] || "");
    setShowNotePopup(true);
  };

  const saveNote = () => {
    setNotes({ ...notes, [selectedDay.toDateString()]: currentNote });
    setShowNotePopup(false);
    // ✅ TODO: Save note to database (create appointments_notes table or use job_notes)
  };

  const handleShowStaffOff = (event, date, entries) => {
    event.stopPropagation();
    setStaffOffPopupDate(date);
    setStaffOffPopupDetails(entries.slice());
    setShowStaffOffPopup(true);
  };

  // Prefetch job card data on hover so navigation is instant
  const handleJobRowHover = useCallback(
    (jobNumberValue) => {prefetchJob(jobNumberValue);}, // warm SWR cache ahead of navigation
    []
  );

  const handleJobRowClick = useCallback(
    (jobNumberValue) => {
      if (!jobNumberValue) return;
      router.push(`/job-cards/${encodeURIComponent(jobNumberValue)}`);
    },
    [router]
  );

  const handleJobNumberInputChange = (event) => {
    if (jobParamActive) {
      setJobParamActive(false);
    }
    setJobNumber(event.target.value);
  };

  // ---------------- Add / Update Appointment ----------------
  const handleAddAppointment = async (customDate) => {
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);

    // ✅ Validation
    if (!jobNumber || jobNumber.trim() === "") {
      alert("Error: Job number is required");
      return;
    }
    if (!appointmentDate) {
      alert("Error: Please select a date");
      return;
    }
    if (!time || time === "") {
      alert("Error: Please select a time");
      return;
    }

    setIsLoading(true);

    try {
      const normalizedJobNumber = jobNumber.toString().trim();
      console.log("Attempting to book appointment for job:", normalizedJobNumber);

      // ✅ Look for job in local state first
      let job = jobs.find((j) =>
      j.jobNumber?.toString() === normalizedJobNumber ||
      j.id?.toString() === normalizedJobNumber
      );

      // ✅ If not found locally, fetch from database
      if (!job) {
        console.log(`Job ${normalizedJobNumber} not found locally, fetching from DB...`);
        const fetchedJob = await getJobByNumberOrReg(normalizedJobNumber);

        if (!fetchedJob) {
          alert(`Error: Job ${normalizedJobNumber} does not exist in the system.\n\nPlease create the job card first before booking an appointment.`);
          setIsLoading(false);
          return;
        }

        job = fetchedJob;
        console.log("Job fetched from database:", job);
      }

      // ✅ Create or update appointment using job number
      console.log("Creating appointment with:", {
        jobNumber: job.jobNumber,
        date: appointmentDate,
        time: time
      });

      const appointmentResult = await createOrUpdateAppointment(
        job.jobNumber, // Use job number for appointment creation
        appointmentDate,
        time,
        currentNote || null, // ✅ Pass notes if available
        dbUserId || user?.user_id || user?.id || null
      );

      if (!appointmentResult.success) {
        const errorMessage = appointmentResult.error?.message || "Unknown error occurred";
        console.error("Appointment booking failed:", errorMessage);
        alert(`Error booking appointment:\n\n${errorMessage}\n\nPlease check the job number and try again.`);
        setIsLoading(false);
        return;
      }

      console.log("Appointment booked successfully:", appointmentResult);

      // ✅ Update local state with new appointment data
      const updatedJob = {
        ...job,
        appointment: {
          appointmentId: appointmentResult.data?.appointment?.appointment_id,
          date: appointmentDate,
          time: time,
          notes: currentNote || "",
          status: "Scheduled"
        },
        status: "Booked"
      };

      // Optimistically update SWR cache so UI reflects the change instantly
      mutateJobs(
        (prevAll) => {
          if (!prevAll) return [updatedJob]; // edge case: no jobs yet
          const idx = prevAll.findIndex((j) => j.id === job.id); // find existing job
          if (idx !== -1) {
            const updated = [...prevAll]; // clone the array
            updated[idx] = updatedJob; // replace with updated job
            return updated;
          }
          return [...prevAll, updatedJob]; // add as new job
        },
        { revalidate: true } // also refetch from server in background
      );

      // ✅ Visual feedback
      setHighlightJob(job.jobNumber || job.id.toString());
      setSelectedDay(new Date(appointmentDate));
      setTimeout(() => setHighlightJob(""), 3000);

      // ✅ Success notification
      alert(
        `Appointment booked successfully!\n\n` +
        `Job Number: ${job.jobNumber}\n` +
        `Customer: ${job.customer}\n` +
        `Vehicle: ${job.reg}\n` +
        `Date: ${appointmentDate}\n` +
        `Time: ${time}`
      );

      // ✅ Clear form
      setJobParamActive(false);
      setJobNumber("");
      setTime("");
      setCurrentNote("");
      invalidateCache("jobs:"); // clear stale queryCache after appointment change

    } catch (error) {
      console.error("Unexpected error booking appointment:", error);
      alert(`Unexpected error:\n\n${error.message}\n\nPlease try again or contact support.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- Check-in Flow ----------------
  const handleCheckIn = async (job) => {
    if (!job?.id) {
      alert("Unable to check in this job because it is missing an ID.");
      return;
    }

    // Structured payload renders the modern themed-tile layout in
    // ConfirmationDialog. Falls back to the plain message if a future
    // ConfirmationDialog drops the details prop.
    const confirmed = await confirm({
      title: null, // Suppress the eyebrow — the prompt is enough on its own.
      message: "Check in this customer?",
      details: [
        { label: "Job", value: job.jobNumber || job.id || "—", tone: "info" },
        { label: "Customer", value: job.customer || "N/A", tone: "success" },
        { label: "Vehicle", value: job.reg || "N/A", tone: "warning" },
        { label: "Appointment", value: job.appointment?.time || "N/A", tone: "accent" },
      ],
      confirmLabel: "Check In",
      cancelLabel: "Cancel",
    });

    if (!confirmed) return;

    setCheckingInJobId(job.id);

    try {
      const result = await autoSetCheckedInStatus(
        job.id,
        dbUserId || user?.user_id || user?.id || "SYSTEM"
      );

      if (result.success) {
        alert(
          `✅ Customer Checked In!\n\n` +
          `Job: ${job.jobNumber || job.id}\n` +
          `Customer: ${job.customer || "N/A"}\n` +
          `Time: ${new Date().toLocaleTimeString()}`
        );

        if (typeof triggerNextAction === "function") {
          triggerNextAction("job_checked_in", {
            jobId: job.id || null,
            jobNumber: job.jobNumber || "",
            vehicleId: job.vehicleId || job.vehicle_id || null,
            vehicleReg: job.reg || job.vehicleReg || job.vehicle_reg || "",
            triggeredBy: user?.id || null
          });
        }

        const updatedJob = result.data || {};
        // Optimistically update SWR cache so UI reflects check-in instantly
        mutateJobs(
          (prevAll) =>
          (prevAll || []).map((existing) => {
            if (existing.id !== job.id) return existing; // skip other jobs
            const nextAppointment = updatedJob.appointment ?? existing.appointment; // preserve appointment data
            return {
              ...existing,
              ...updatedJob,
              appointment: nextAppointment,
              status: updatedJob.status || "Checked In", // update status immediately
              checked_in_at: updatedJob.checked_in_at || new Date().toISOString() // set check-in timestamp
            };
          }),
          { revalidate: true } // also refetch from server in background
        );
        invalidateCache("jobs:"); // clear stale queryCache so job card page gets fresh data
      } else {
        console.error("❌ Check-in failed:", result.error);
        alert(`❌ Failed to check in: ${result.error?.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("❌ Error checking in:", error);
      alert("❌ Error checking in customer. Please try again.");
    } finally {
      setCheckingInJobId(null);
    }
  };

  // ---------------- Utilities ----------------
  const formatDate = (dateObj) =>
  dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const formatDateNoYear = (dateObj) =>
  dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const getDayTechSummary = (date) => {
    if (!date) {
      return {
        dateKey: "",
        techs: [],
        availableTechs: DEFAULT_RETAIL_TECH_COUNT,
        totalTechs: DEFAULT_RETAIL_TECH_COUNT,
        totalAvailableHours: DEFAULT_RETAIL_TECH_COUNT * DEFAULT_RETAIL_TECH_HOURS
      };
    }

    const dateKey = date.toDateString();
    const dayData = techAvailability[dateKey] || { techs: [] };
    const storedTechs = Array.isArray(dayData.techs) ? dayData.techs : [];
    const overridesForDay = techHoursOverrides[dateKey] || {};
    const staffEntries = staffAbsences[dateKey] || [];
    const staffOffByUserId = new Map(
      staffEntries.
      filter((entry) => entry?.userId).
      map((entry) => [normalizeKey(entry.userId), entry])
    );
    const roster = Array.isArray(techUsers) ? techUsers : [];
    const expectedTechCount = roster.length > 0 ? roster.length : DEFAULT_RETAIL_TECH_COUNT;

    const normalizedTechs = storedTechs.map((tech, index) => {
      const techId = tech.techId ?? tech.user?.user_id ?? `${dateKey}-tech-${index}`;
      const techKey = normalizeKey(techId);
      const overrideHours = parseHoursValue(overridesForDay[techId]);
      const baseAvailable = parseHoursValue(tech.availableHours);
      const defaultDailyHours =
      getTechDailyHours(
        roster.find((user) => normalizeKey(user.user_id) === techKey) || tech.user || tech
      );
      const staffEntry = staffOffByUserId.get(techKey);
      const isOnHoliday = Boolean(staffEntry);
      const unavailableHours = parseHoursValue(staffEntry?.unavailableHours);
      const adjustedAvailableHours =
      unavailableHours === null ?
      isOnHoliday ?
      0 :
      baseAvailable ?? defaultDailyHours :
      Math.max(0, (baseAvailable ?? defaultDailyHours) - unavailableHours);
      const availableHours =
      overrideHours ?? adjustedAvailableHours;
      return {
        ...tech,
        techId,
        name: techUserNameMap.get(techKey) || tech.name || `Tech #${techId}`,
        availableHours,
        contractedHours:
        tech.contractedHours ??
        tech.contracted_hours ??
        roster.find((user) => normalizeKey(user.user_id) === techKey)?.contracted_hours ??
        null,
        isOnHoliday,
        absenceType: staffEntry?.type || null
      };
    });

    const normalizedTechIds = new Set(normalizedTechs.map((tech) => normalizeKey(tech.techId)));
    const placeholders = roster.length ?
    roster.
    filter((user) => !normalizedTechIds.has(normalizeKey(user.user_id))).
    map((user) => {
      const techId = user.user_id;
      const techKey = normalizeKey(techId);
      const overrideHours = parseHoursValue(overridesForDay[techId]);
      const defaultDailyHours = getTechDailyHours(user);
      const staffEntry = staffOffByUserId.get(techKey);
      const isOnHoliday = Boolean(staffEntry);
      const unavailableHours = parseHoursValue(staffEntry?.unavailableHours);
      const adjustedAvailableHours =
      unavailableHours === null ?
      isOnHoliday ?
      0 :
      defaultDailyHours :
      Math.max(0, defaultDailyHours - unavailableHours);
      return {
        techId,
        name: techUserNameMap.get(techKey) || formatStaffName(user),
        availableHours: overrideHours ?? adjustedAvailableHours,
        contractedHours: user.contracted_hours ?? null,
        totalHours: 0,
        segments: [],
        currentlyClockedIn: false,
        isPlaceholder: true,
        workType: "retail",
        isOnHoliday,
        absenceType: staffEntry?.type || null
      };
    }) :
    Array.from({ length: Math.max(expectedTechCount - normalizedTechs.length, 0) }, (_, idx) => {
      const placeholderId = `${dateKey}-retail-placeholder-${idx}`;
      const overrideHours = parseHoursValue(overridesForDay[placeholderId]);
      return {
        techId: placeholderId,
        name: DEFAULT_RETAIL_TECH_NAMES[idx] || `Retail Tech ${idx + 1}`,
        availableHours: overrideHours ?? DEFAULT_RETAIL_TECH_HOURS,
        contractedHours: null,
        totalHours: 0,
        segments: [],
        currentlyClockedIn: false,
        isPlaceholder: true,
        workType: "retail"
      };
    });

    const finalTechs = [...normalizedTechs, ...placeholders].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
    );
    const availableTechs = finalTechs.filter(
      (tech) => (parseHoursValue(tech.availableHours) ?? 0) > 0
    ).length;
    const totalAvailableHours = finalTechs.reduce(
      (sum, tech) => sum + (parseHoursValue(tech.availableHours) ?? 0),
      0
    );

    return {
      dateKey,
      techs: finalTechs,
      availableTechs,
      totalTechs: Math.max(finalTechs.length, expectedTechCount),
      totalAvailableHours
    };
  };

  const getTechHoursForDay = (date) => getDayTechSummary(date).totalTechs;

  const getEarliestTechStartForDate = (date) => {
    const dateKey = date.toDateString();
    const dayData = techAvailability[dateKey];
    if (!dayData || !Array.isArray(dayData.techs)) return null;

    let earliest = null;
    dayData.techs.forEach((tech) => {
      const segments = Array.isArray(tech.segments) ? tech.segments : [];
      segments.forEach((segment) => {
        if (!segment?.startedAt) return;
        const start = new Date(segment.startedAt);
        if (Number.isNaN(start.getTime())) return;
        if (!earliest || start < earliest) {
          earliest = start;
        }
      });
    });

    return earliest;
  };

  const calculateFinishTimeForDate = (date, jobHours, vhcHours) => {
    const start = getEarliestTechStartForDate(date);
    if (!start) return "-";
    const totalHours = (parseHoursValue(jobHours) || 0) + (parseHoursValue(vhcHours) || 0) + 0.5;
    const finish = new Date(start.getTime() + totalHours * 60 * 60 * 1000);
    return finish.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const handleTechAvailabilityChange = (dateKey, techId, rawValue) => {
    setTechHoursOverrides((prev) => {
      const dayOverrides = { ...(prev[dateKey] || {}) };
      const parsedValue = parseHoursValue(rawValue);

      if (parsedValue === null) {
        delete dayOverrides[techId];
      } else {
        dayOverrides[techId] = parsedValue;
      }

      const next = { ...prev };
      if (Object.keys(dayOverrides).length === 0) {
        delete next[dateKey];
      } else {
        next[dateKey] = dayOverrides;
      }

      return next;
    });
  };

  const normalizeJobCategoryLabel = (rawLabel) => {
    if (!rawLabel || typeof rawLabel !== "string") return null;
    const cleaned = rawLabel.trim().toLowerCase();

    if (cleaned === "service") return "service";
    if (cleaned === "mot") return "mot";
    if (cleaned === "diagnostic" || cleaned === "diagnostics" || cleaned === "diagnosis")
    return "diagnosis";
    if (cleaned === "other") return "other";

    return null;
  };

  const getDetectedJobTypeLabels = (job) => {
    const categories = Array.isArray(job.jobCategories) ? job.jobCategories : [];
    const normalizedLabels = new Set(
      categories.
      map((category) => normalizeJobCategoryLabel(category)).
      filter(Boolean)
    );

    if (normalizedLabels.size === 0) {
      const fallbackType = (job.type || "").trim().toLowerCase();
      if (fallbackType.includes("mot")) {
        normalizedLabels.add("mot");
      } else if (fallbackType.includes("diag")) {
        normalizedLabels.add("diagnosis");
      } else if (fallbackType.includes("service")) {
        normalizedLabels.add("service");
      }
    }

    if (normalizedLabels.size === 0) {
      normalizedLabels.add("other");
    }

    return normalizedLabels;
  };

  // ✅ Enhanced job counts with new job categories - FIXED to handle non-array requests
  const getJobCounts = (date) => {
    const jobsForDate = jobs.filter((j) => j.appointment?.date === date.toISOString().split("T")[0]);
    const totals = {
      totalJobs: jobsForDate.length,
      services: 0,
      mot: 0,
      diagnosis: 0,
      other: 0
    };

    let jobHours = 0;
    let vhcHours = 0;

    jobsForDate.forEach((job) => {
      const detectedLabels = getDetectedJobTypeLabels(job);

      if (detectedLabels.has("service")) totals.services += 1;
      if (detectedLabels.has("mot")) totals.mot += 1;
      if (detectedLabels.has("diagnosis")) totals.diagnosis += 1;
      if (detectedLabels.has("other")) totals.other += 1;

      const currentJobHours = parseHoursValue(jobRequestHours[job.id]) || 0;
      const currentVhcHours = parseHoursValue(jobVhcLabourHours[job.id]) || 0;
      jobHours += currentJobHours;
      vhcHours += currentVhcHours;
    });

    const finishTime = calculateFinishTimeForDate(date, jobHours, vhcHours);

    return {
      ...totals,
      totalHours: jobHours.toFixed(1),
      finishTime
    };
  };

  const isSameDate = (a, b) => {
    if (!a || !b) return false;
    const dateA = a instanceof Date ? a : new Date(a);
    const dateB = b instanceof Date ? b : new Date(b);
    return (
      !Number.isNaN(dateA.getTime()) &&
      !Number.isNaN(dateB.getTime()) &&
      dateA.toDateString() === dateB.toDateString());

  };

  const getCheckinStatsForDate = (date) => {
    const targetDateKey = date.toISOString().split("T")[0];
    const appointmentsForDate = jobs.filter((job) => job.appointment?.date === targetDateKey);
    const total = appointmentsForDate.length;
    const checkedIn = appointmentsForDate.filter((job) => isJobActuallyCheckedIn(job)).length;
    const awaiting =
    isSameDate(date, new Date()) ?
    appointmentsForDate.filter((job) => !isJobActuallyCheckedIn(job)).length :
    0;
    return { total, checkedIn, awaiting };
  };

  const getDetectedJobTypeLabel = (job) => {
    const labels = Array.from(getDetectedJobTypeLabels(job)).filter(Boolean);
    if (labels.length > 0) {
      return labels.join(", ");
    }
    return job.type || "Service";
  };

  const getJobTypeBadgeStyle = (label) => {
    const base = {
      display: "inline-block",
      padding: "3px 8px",
      borderRadius: "var(--radius-sm)",
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "capitalize",
      whiteSpace: "nowrap"
    };
    switch (label) {
      case "service":
        return { ...base, background: "rgba(59,130,246,0.12)", color: "#2563eb" };
      case "mot":
        return { ...base, background: "rgba(var(--warning-rgb), 0.12)", color: "var(--warning-text)" };
      case "diagnosis":
        return { ...base, background: "rgba(var(--accent-purple-rgb), 0.12)", color: "var(--accent-purple)" };
      default:
        return { ...base, background: "rgba(107,114,128,0.12)", color: "#6b7280" };
    }
  };

  const getCustomerStatusBadgeColors = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "waiting") {
      return {
        backgroundColor: "var(--surface-light)",
        color: "var(--danger)"
      };
    }
    if (normalized === "loan car") {
      return {
        backgroundColor: "var(--info-surface)",
        color: "var(--info)"
      };
    }
    if (normalized === "collection") {
      return {
        backgroundColor: "var(--warning-surface)",
        color: "var(--warning)"
      };
    }
    return {
      backgroundColor: "var(--success-surface)",
      color: "var(--success-dark)"
    };
  };

  const getEstimatedFinishTime = (job) => {
    const appointment = job.appointment;
    if (!appointment?.date || !appointment?.time) return "-";
    const start = new Date(`${appointment.date}T${appointment.time}:00`);
    if (Number.isNaN(start.getTime())) return "-";

    const requestHours = parseHoursValue(jobRequestHours[job.id]) || 0;
    const vhcHours = parseHoursValue(jobVhcLabourHours[job.id]) || 0;
    const totalHours = requestHours + vhcHours + 0.5;
    const finish = new Date(start.getTime() + totalHours * 60 * 60 * 1000);
    return finish.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  // ---------------- Filtered Jobs for Selected Day ----------------
  const jobsForDay = jobs.filter((j) => j.appointment?.date === selectedDay.toISOString().split("T")[0]);
  const techSummaryForSelectedDay = getDayTechSummary(selectedDay);
  const techsForSelectedDay = techSummaryForSelectedDay.techs;
  const checkinStatsForSelectedDay = getCheckinStatsForDate(selectedDay);

  const totalBookedTechHours = techsForSelectedDay.reduce(
    (sum, tech) => sum + (parseHoursValue(tech.totalHours) || 0),
    0
  );

  const totalAvailableTechHours = techSummaryForSelectedDay.totalAvailableHours;

  const totalCapacityStatus = getCapacityStatus(totalBookedTechHours, totalAvailableTechHours);
  const totalCapacityBadgeStyle = getStatusBadgeStyle(totalCapacityStatus);
  const totalCapacityLabel = getCapacityStatusLabel(totalCapacityStatus);

  const filteredJobs = jobsForDay.filter((job) => {
    const query = searchQuery.toLowerCase();
    return (
      job.jobNumber?.toString().includes(query) ||
      job.id?.toString().includes(query) ||
      job.customer?.toLowerCase().includes(query) ||
      job.reg?.toLowerCase().includes(query) ||
      job.makeModel?.toLowerCase().includes(query));

  });

  // ✅ Sort jobs by appointment time, grouping linked jobs together
  const sortedJobs = filteredJobs.sort((a, b) => {
    // First, group by prime job number (linked jobs stay together)
    const primeA = a.primeJobNumber || a.jobNumber || "";
    const primeB = b.primeJobNumber || b.jobNumber || "";
    if (primeA !== primeB) {
      // Sort by the earliest appointment time in each group
      const timeA = a.appointment?.time || "00:00";
      const timeB = b.appointment?.time || "00:00";
      return timeA.localeCompare(timeB);
    }
    // Within same prime group, prime job comes first, then sub-jobs by sequence
    if (a.isPrimeJob && !b.isPrimeJob) return -1;
    if (!a.isPrimeJob && b.isPrimeJob) return 1;
    return (a.subJobSequence || 0) - (b.subJobSequence || 0);
  });

  // ✅ Compute group size for each prime job number so rows can show "X/Y Job Cards"
  const jobGroupSizeMap = {};
  for (const job of sortedJobs) {
    const key = job.primeJobNumber || job.jobNumber;
    if (key) {
      jobGroupSizeMap[key] = (jobGroupSizeMap[key] || 0) + 1;
    }
  }
  const getJobGroupBadge = (job) => {
    const key = job.primeJobNumber || job.jobNumber;
    const total = key ? jobGroupSizeMap[key] || 1 : 1;
    if (total <= 1) return null;
    const position = job.isPrimeJob ? 1 : (job.subJobSequence ?? 0) + 1;
    return `${position}/${total}`;
  };

  // ---------------- Render ----------------
  return <AppointmentsUi view="section1" activeDayTab={activeDayTab} CALENDAR_SEVERITY_STYLES={CALENDAR_SEVERITY_STYLES} checkingInJobId={checkingInJobId} currentNote={currentNote} dates={dates} DEFAULT_RETAIL_TECH_COUNT={DEFAULT_RETAIL_TECH_COUNT} DEFAULT_RETAIL_TECH_HOURS={DEFAULT_RETAIL_TECH_HOURS} DropdownField={DropdownField} formatDate={formatDate} formatDateNoYear={formatDateNoYear} getBookingSeverity={getBookingSeverity} getCustomerStatusBadgeColors={getCustomerStatusBadgeColors} getDayTechSummary={getDayTechSummary} getDetectedJobTypeLabels={getDetectedJobTypeLabels} getEstimatedFinishTime={getEstimatedFinishTime} getJobCounts={getJobCounts} getJobGroupBadge={getJobGroupBadge} getJobTypeBadgeStyle={getJobTypeBadgeStyle} getTechDailyHours={getTechDailyHours} getVehicleDisplay={getVehicleDisplay} handleAddAppointment={handleAddAppointment} handleCheckIn={handleCheckIn} handleJobNumberInputChange={handleJobNumberInputChange} handleJobRowClick={handleJobRowClick} handleJobRowHover={handleJobRowHover} handleShowStaffOff={handleShowStaffOff} handleTechAvailabilityChange={handleTechAvailabilityChange} highlightJob={highlightJob} isCompactMobile={isCompactMobile} isJobActuallyCheckedIn={isJobActuallyCheckedIn} isLoading={isLoading} isSameDate={isSameDate} isTechAvailabilityLoading={isTechAvailabilityLoading} jobNumber={jobNumber} parseHoursValue={parseHoursValue} Popup={Popup} SATURDAY_SEVERITY_STYLES={SATURDAY_SEVERITY_STYLES} saveNote={saveNote} SearchBar={SearchBar} searchQuery={searchQuery} selectedDay={selectedDay} setActiveDayTab={setActiveDayTab} setCurrentNote={setCurrentNote} setSearchQuery={setSearchQuery} setSelectedDay={setSelectedDay} setShowNotePopup={setShowNotePopup} setShowStaffOffPopup={setShowStaffOffPopup} setTime={setTime} showNotePopup={showNotePopup} showStaffOffPopup={showStaffOffPopup} sortedJobs={sortedJobs} staffAbsences={staffAbsences} staffOffPopupDate={staffOffPopupDate} staffOffPopupDetails={staffOffPopupDetails} TECH_AVAILABILITY_TABLE={TECH_AVAILABILITY_TABLE} techAvailabilityError={techAvailabilityError} techsForSelectedDay={techsForSelectedDay} techSummaryForSelectedDay={techSummaryForSelectedDay} time={time} timeSlots={timeSlots} totalAvailableTechHours={totalAvailableTechHours} totalBookedTechHours={totalBookedTechHours} totalCapacityBadgeStyle={totalCapacityBadgeStyle} totalCapacityLabel={totalCapacityLabel} />;



















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































}

Appointments.getLayout = (page) => <Layout requiresLandscape>{page}</Layout>;
