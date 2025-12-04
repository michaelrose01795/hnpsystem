// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/appointments/index.js
"use client";

import React, { useState, useEffect, useCallback } from "react"; // Import React hooks
import Layout from "@/components/Layout"; // Main layout wrapper
import Popup from "@/components/popups/Popup"; // Reusable popup modal
import { useRouter } from "next/router"; // For reading query params
import { useUser } from "@/context/UserContext"; // Access current user for check-in attribution
import { useNextAction } from "@/context/NextActionContext"; // Trigger follow-up actions after check-in
import { 
  getAllJobs, 
  createOrUpdateAppointment, 
  getJobByNumberOrReg,
  getJobsByDate // ✅ NEW: Get appointments by date
} from "@/lib/database/jobs"; // DB functions
import { autoSetCheckedInStatus } from "@/lib/services/jobStatusService"; // Shared status transition helper
import supabase from "@/lib/supabaseClient"; // Supabase client for live tech availability
import { useConfirmation } from "@/context/ConfirmationContext";

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
    if (current.getDay() !== 0) { // Skip Sundays
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
  for (let hour = 8; hour <= 17; hour++) { // 8 AM to 5 PM
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
    "hours_worked",
  ];

  for (const field of fallbackFields) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) {
      const numeric = parseHoursValue(entry[field]);
      if (numeric !== null) return numeric;
    }
  }

  return null;
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
  "Retail Tech 6",
];

const CALENDAR_SEVERITY_STYLES = {
  green: {
    backgroundColor: "var(--success-surface)",
    textColor: "var(--success-dark)",
    borderColor: "var(--success)",
  },
  amber: {
    backgroundColor: "var(--warning-surface)",
    textColor: "var(--warning)",
    borderColor: "var(--warning)",
  },
  red: {
    backgroundColor: "var(--danger-surface)",
    textColor: "var(--danger)",
    borderColor: "var(--danger)",
  },
};

const SATURDAY_SEVERITY_STYLES = {
  green: {
    backgroundColor: "var(--success-dark)",
    textColor: "var(--surface)",
    borderColor: "var(--success)",
  },
  amber: {
    backgroundColor: "var(--warning-dark)",
    textColor: "var(--surface)",
    borderColor: "var(--warning)",
  },
  red: {
    backgroundColor: "var(--danger-dark)",
    textColor: "var(--surface)",
    borderColor: "var(--danger)",
  },
};

const getBookingSeverity = (percent) => {
  if (Number.isNaN(percent)) return "green";
  if (percent >= 86) return "red";
  if (percent >= 65) return "amber";
  return "green";
};

const STAFF_ROLES = new Set([
  "service advisor",
  "technician",
  "workshop manager",
  "service manager",
  "after sales manager",
]);

const toMidnightDate = (value) => {
  if (!value) return null;
  const dateObj = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(dateObj.getTime())) return null;
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
};

const formatRoleLabel = (role) => {
  if (!role || typeof role !== "string") return "Staff";
  return role
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
};

const formatStaffName = (user) => {
  if (!user) return "Staff Member";
  const first = (user.first_name || "").trim();
  const last = (user.last_name || "").trim();
  return [first, last].filter(Boolean).join(" ") || user.email || "Staff Member";
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
    const absenceEnd = absence?.end_date
      ? toMidnightDate(absence.end_date)
      : absenceStart;
    if (!absenceStart || !absenceEnd) return;

    const effectiveStartMs = Math.max(absenceStart.getTime(), startBoundary.getTime());
    const effectiveEndMs = Math.min(absenceEnd.getTime(), endBoundary.getTime());
    if (effectiveStartMs > effectiveEndMs) return;

    const entryBase = {
      id: `${absence.absence_id}-${user?.user_id || absence.absence_id}`,
      name: formatStaffName(user),
      role: formatRoleLabel(normalizedRole),
      type: absence?.type || "Holiday",
    };

    for (let currentMs = effectiveStartMs; currentMs <= effectiveEndMs; currentMs += oneDayMs) {
      const dateKey = new Date(currentMs).toDateString();
      if (!map[dateKey]) {
        map[dateKey] = [];
      }

      map[dateKey].push(entryBase);
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
    const techName = entry.user
      ? `${entry.user.first_name || ""} ${entry.user.last_name || ""}`.trim()
      : "";
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
        availableHours: deriveAvailableHours(entry) ?? DEFAULT_RETAIL_TECH_HOURS,
      };
      availability[dateKey].techs.push(techRecord);
    }

    const duration = entry.clock_out
      ? calculateDurationHours(entry.clock_in, entry.clock_out)
      : 0;

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
        endedAt: entry.clock_out,
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
  const jobQueryParam = Array.isArray(router.query.jobNumber)
    ? router.query.jobNumber[0]
    : router.query.jobNumber;
  const { user } = useUser();
  const { triggerNextAction } = useNextAction();
  const { confirm } = useConfirmation();

  // ---------------- States ----------------
  const [jobs, setJobs] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [notes, setNotes] = useState({});
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [time, setTime] = useState("");
  const [highlightJob, setHighlightJob] = useState("");
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

  // ---------------- Fetch Jobs ----------------
  const fetchJobs = async () => {
    console.log("Fetching all jobs...");
    setIsLoading(true);
    
    try {
      const jobsFromDb = await getAllJobs();
      console.log("Jobs fetched:", jobsFromDb.length);
      
      // ✅ Filter only jobs with appointments
      const jobsWithAppointments = jobsFromDb.filter(job => job.appointment);
      console.log("Jobs with appointments:", jobsWithAppointments.length);
      
      setJobs(jobsWithAppointments);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      alert("Failed to load appointments. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobRequestHours = useCallback(async (jobIds = []) => {
    if (!jobIds || jobIds.length === 0) {
      setJobRequestHours({});
      return;
    }

    const uniqueJobIds = Array.from(new Set(jobIds));

    try {
      const { data, error } = await supabase
        .from("job_requests")
        .select("job_id, hours")
        .in("job_id", uniqueJobIds);

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

  const parseVhcItemHours = (item) => {
    if (!item || typeof item !== "object") return null;
    const candidates = [
      "labour_hours",
      "labor_hours",
      "labour_time",
      "labor_time",
      "hours",
      "time",
      "duration",
    ];

    for (const key of candidates) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
      const numeric = parseHoursValue(item[key]);
      if (numeric !== null) {
        return numeric;
      }
    }

    return null;
  };

  const sumAuthorizedVhcLabourHours = (items = []) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const hours = parseVhcItemHours(item);
      if (hours !== null) {
        return sum + hours;
      }
      return sum;
    }, 0);
  };

  const fetchJobVhcLabourHours = useCallback(async (jobIds = []) => {
    if (!jobIds || jobIds.length === 0) {
      setJobVhcLabourHours({});
      return;
    }

    const uniqueJobIds = Array.from(new Set(jobIds));

    try {
      const { data, error } = await supabase
        .from("vhc_authorizations")
        .select("job_id, authorized_items")
        .in("job_id", uniqueJobIds);

      if (error) throw error;

      const aggregated = {};
      (data || []).forEach((row) => {
        if (!row?.job_id) return;
        const vhcHours = sumAuthorizedVhcLabourHours(row.authorized_items);
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
      const { data, error } = await supabase
        .from(TECH_AVAILABILITY_TABLE)
        .select(`
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
            last_name
          )
        `)
        .gte("clock_in", `${startDate}T00:00:00.000Z`)
        .lte("clock_in", `${endDate}T23:59:59.999Z`);

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

  const fetchStaffAbsences = useCallback(async () => {
    if (!dates || dates.length === 0) return;

    const startDate = dates[0].toISOString().split("T")[0];
    const endDate = dates[dates.length - 1].toISOString().split("T")[0];

    try {
      const { data, error } = await supabase
        .from("hr_absences")
        .select(`
          absence_id,
          type,
          start_date,
          end_date,
          approval_status,
          user:user_id(
            user_id,
            first_name,
            last_name,
            email,
            role
          )
        `)
        .eq("approval_status", "Approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);

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
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!dates.length) return;
    fetchTechAvailability();
  }, [dates, fetchTechAvailability]);

  useEffect(() => {
    const jobIdsWithAppointments = jobs
      .filter((job) => job.appointment?.date)
      .map((job) => job.id)
      .filter(Boolean);

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

    const channel = supabase
      .channel("job_clocking_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TECH_AVAILABILITY_TABLE },
        () => {
          fetchTechAvailability();
        }
        )
        .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dates, fetchTechAvailability]);

  // ✅ Handle jobNumber from URL parameters
  useEffect(() => {
    if (!router.isReady) return;
    const jobParam = typeof jobQueryParam === "string" ? jobQueryParam : "";
    if (jobParam.trim().length > 0) {
      setJobNumber(jobParam);
      const existingJob = jobs.find((j) => j.jobNumber.toString() === jobParam || j.id.toString() === jobParam);
      if (existingJob && existingJob.appointment) {
        setSelectedDay(new Date(existingJob.appointment.date));
        setTime(existingJob.appointment.time);
      }
    }
  }, [router.isReady, jobQueryParam, jobs]);

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

  const handleJobRowClick = useCallback(
    (jobNumberValue) => {
      if (!jobNumberValue) return;
      router.push(`/job-cards/${encodeURIComponent(jobNumberValue)}`);
    },
    [router]
  );

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
        currentNote || null // ✅ Pass notes if available
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

      const jobIndex = jobs.findIndex((j) => j.id === job.id);
      if (jobIndex !== -1) {
        const updatedJobs = [...jobs];
        updatedJobs[jobIndex] = updatedJob;
        setJobs(updatedJobs);
      } else {
        setJobs([...jobs, updatedJob]);
      }

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
      setJobNumber("");
      setTime("");
      setCurrentNote("");

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

    const confirmed = await confirm(
      `Check in customer?\n\n` +
        `Job: ${job.jobNumber || job.id}\n` +
        `Customer: ${job.customer || "N/A"}\n` +
        `Vehicle: ${job.reg || "N/A"}\n` +
        `Appointment: ${job.appointment?.time || "N/A"}`
    );

    if (!confirmed) return;

    setCheckingInJobId(job.id);

    try {
      const result = await autoSetCheckedInStatus(job.id, user?.id || "SYSTEM");

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
            triggeredBy: user?.id || null,
          });
        }

        const updatedJob = result.data || {};
        setJobs((prevJobs) =>
          prevJobs.map((existing) => {
            if (existing.id !== job.id) return existing;
            const nextAppointment = updatedJob.appointment ?? existing.appointment;
            return {
              ...existing,
              ...updatedJob,
              appointment: nextAppointment,
              status: updatedJob.status || "Checked In",
              checked_in_at: updatedJob.checked_in_at || new Date().toISOString(),
            };
          })
        );
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
        totalTechs: DEFAULT_RETAIL_TECH_COUNT,
        totalAvailableHours: DEFAULT_RETAIL_TECH_COUNT * DEFAULT_RETAIL_TECH_HOURS,
      };
    }

    const dateKey = date.toDateString();
    const dayData = techAvailability[dateKey] || { techs: [] };
    const storedTechs = Array.isArray(dayData.techs) ? dayData.techs : [];
    const overridesForDay = techHoursOverrides[dateKey] || {};

    const normalizedTechs = storedTechs.map((tech, index) => {
      const techId = tech.techId ?? tech.user?.user_id ?? `${dateKey}-tech-${index}`;
      const overrideHours = parseHoursValue(overridesForDay[techId]);
      const baseAvailable = parseHoursValue(tech.availableHours);
      const availableHours = overrideHours ?? baseAvailable ?? DEFAULT_RETAIL_TECH_HOURS;
      return {
        ...tech,
        techId,
        availableHours,
      };
    });

    const placeholders = [];
    for (let idx = normalizedTechs.length; idx < DEFAULT_RETAIL_TECH_COUNT; idx += 1) {
      const placeholderId = `${dateKey}-retail-placeholder-${idx}`;
      const overrideHours = parseHoursValue(overridesForDay[placeholderId]);
      placeholders.push({
        techId: placeholderId,
        name: DEFAULT_RETAIL_TECH_NAMES[idx] || `Retail Tech ${idx + 1}`,
        availableHours: overrideHours ?? DEFAULT_RETAIL_TECH_HOURS,
        totalHours: 0,
        segments: [],
        currentlyClockedIn: false,
        isPlaceholder: true,
        workType: "retail",
      });
    }

    const finalTechs = [...normalizedTechs, ...placeholders];
    const totalAvailableHours = finalTechs.reduce(
      (sum, tech) => sum + (parseHoursValue(tech.availableHours) ?? 0),
      0
    );

    return {
      dateKey,
      techs: finalTechs,
      totalTechs: Math.max(finalTechs.length, DEFAULT_RETAIL_TECH_COUNT),
      totalAvailableHours,
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
      categories
        .map((category) => normalizeJobCategoryLabel(category))
        .filter(Boolean)
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
      other: 0,
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
      finishTime,
    };
  };

  const isSameDate = (a, b) => {
    if (!a || !b) return false;
    const dateA = a instanceof Date ? a : new Date(a);
    const dateB = b instanceof Date ? b : new Date(b);
    return (
      !Number.isNaN(dateA.getTime()) &&
      !Number.isNaN(dateB.getTime()) &&
      dateA.toDateString() === dateB.toDateString()
    );
  };

  const getCheckinStatsForDate = (date) => {
    const targetDateKey = date.toISOString().split("T")[0];
    const appointmentsForDate = jobs.filter((job) => job.appointment?.date === targetDateKey);
    const normalizedStatus = (job) => (job.status || "").trim().toLowerCase();
    const total = appointmentsForDate.length;
    const checkedIn = appointmentsForDate.filter((job) => normalizedStatus(job) !== "booked").length;
    const awaiting =
      isSameDate(date, new Date()) ?
        appointmentsForDate.filter((job) => normalizedStatus(job) === "booked").length
        : 0;
    return { total, checkedIn, awaiting };
  };

  const getDetectedJobTypeLabel = (job) => {
    const labels = Array.from(getDetectedJobTypeLabels(job)).filter(Boolean);
    if (labels.length > 0) {
      return labels.join(", ");
    }
    return job.type || "Service";
  };

  const getCustomerStatusBadgeColors = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "waiting") {
      return {
        backgroundColor: "var(--surface-light)",
        color: "var(--danger)",
      };
    }
    if (normalized === "loan car") {
      return {
        backgroundColor: "var(--info-surface)",
        color: "var(--info)",
      };
    }
    if (normalized === "collection") {
      return {
        backgroundColor: "var(--warning-surface)",
        color: "var(--warning)",
      };
    }
    return {
      backgroundColor: "var(--success-surface)",
      color: "var(--success-dark)",
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
      job.makeModel?.toLowerCase().includes(query)
    );
  });

  // ✅ Sort jobs by appointment time
  const sortedJobs = filteredJobs.sort((a, b) => {
    const timeA = a.appointment?.time || "00:00";
    const timeB = b.appointment?.time || "00:00";
    return timeA.localeCompare(timeB);
  });

  // ---------------- Render ----------------
  return (
    <Layout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}>

        {/* Top Bar */}
        <div style={{ 
          display: "flex", 
          gap: "12px", 
          alignItems: "center", 
          marginBottom: "12px", 
          padding: "12px", 
          backgroundColor: "var(--surface)", 
          borderRadius: "8px", 
          boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.08)" 
        }}>
          <button 
            onClick={() => handleAddNote(selectedDay)} 
            disabled={isLoading} 
            style={{ 
              padding: "10px 20px", 
              backgroundColor: isLoading ? "var(--background)" : "var(--primary)", 
              color: "white", 
              border: "none", 
              borderRadius: "8px", 
              cursor: isLoading ? "not-allowed" : "pointer", 
              fontWeight: "500", 
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = "var(--danger)")}
            onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = "var(--primary)")}
          >
            Add Note
          </button>

          <input 
            type="search" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by Job #, Name, Reg, or Vehicle..." 
            disabled={isLoading} 
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
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--search-surface-muted)"}
          />

          <input 
            type="text" 
            value={jobNumber} 
            onChange={(e) => setJobNumber(e.target.value)} 
            placeholder="Job Number" 
            disabled={isLoading} 
            style={{ 
              width: "140px", 
              padding: "10px 16px", 
              borderRadius: "8px", 
              border: "1px solid var(--surface-light)", 
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--surface-light)"}
          />

          <select 
            value={time} 
            onChange={(e) => setTime(e.target.value)} 
            disabled={isLoading} 
            style={{ 
              width: "120px", 
              padding: "10px 12px", 
              borderRadius: "8px", 
              border: "1px solid var(--surface-light)", 
              fontSize: "14px",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="">Select time</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>

          <button 
            onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])} 
            disabled={isLoading} 
            style={{ 
              padding: "10px 20px", 
              backgroundColor: isLoading ? "var(--background)" : "var(--primary)", 
              color: "white", 
              border: "none", 
              borderRadius: "8px", 
              cursor: isLoading ? "not-allowed" : "pointer", 
              fontWeight: "600", 
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = "var(--danger)")}
            onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = "var(--primary)")}
          >
            {isLoading ? "Booking..." : "Book Appointment"}
          </button>
        </div>

        {/* Calendar Table Container */}
        <div style={{ 
          flex: "0 0 auto", 
          maxHeight: "calc(8 * 42px + 60px)", 
          overflowY: "auto", 
          marginBottom: "12px", 
          borderRadius: "10px", 
          boxShadow: "0 2px 6px rgba(var(--shadow-rgb),0.1)", 
          backgroundColor: "var(--surface)" 
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ backgroundColor: "var(--surface)", borderBottom: "2px solid var(--primary)" }}>
                {["Day/Date","Availability","Total Hours","Total Jobs","Jobs Scheduled","Finish","Services","MOT","Diagnosis","Other","Staff Off"].map(header => (
                  <th 
                    key={header} 
                    style={{ 
                      textAlign: "left", 
                      padding: "10px 12px", 
                      fontWeight: "600", 
                      fontSize: "14px", 
                      color: "var(--text-secondary)", 
                      borderBottom: "1px solid var(--surface-light)", 
                      background: "var(--surface)", 
                      position: "sticky", 
                      top: 0 
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
                {dates.map((date) => {
                const dateKey = date.toDateString();
                const counts = getJobCounts(date);
                const staffEntries = staffAbsences[dateKey] || [];
                const isSelected = selectedDay.toDateString() === dateKey;
                const dayTechSummary = getDayTechSummary(date);
                const bookedHours = parseFloat(counts.totalHours) || 0;
                const totalAvailableHours =
                  dayTechSummary.totalAvailableHours || DEFAULT_RETAIL_TECH_COUNT * DEFAULT_RETAIL_TECH_HOURS;
                const bookingPercent = totalAvailableHours > 0 ? (bookedHours / totalAvailableHours) * 100 : 0;
                const severity = getBookingSeverity(bookingPercent);
                const isWeekendSaturday = date.getDay() === 6;
                const severityStyleSource = isWeekendSaturday ? SATURDAY_SEVERITY_STYLES : CALENDAR_SEVERITY_STYLES;
                const severityStyle = severityStyleSource[severity] || CALENDAR_SEVERITY_STYLES[severity] || {};
                const defaultRowBackground = severityStyle.backgroundColor || "var(--surface)";
                const rowBackground = isSelected ? "var(--surface-light)" : defaultRowBackground;
                const severityBorderLeft =
                  severityStyle.borderColor ? `4px solid ${severityStyle.borderColor}` : "4px solid transparent";
                const computedBorderLeftStyle = isSelected ? "4px solid var(--primary)" : severityBorderLeft;
                const bookingPercentDisplay = Number.isFinite(bookingPercent)
                  ? bookingPercent.toFixed(0)
                  : "0";
                const availabilityLabelColor = severityStyle.textColor || "var(--text-primary)";
                const todayShadow = isSameDate(date, new Date()) ? "0 0 0 2px var(--primary)" : "none";
                const hoverShadow = "0 0 0 2px var(--primary)";
                const baseBoxShadow = isSelected ? hoverShadow : todayShadow;
                
                return (
                  <tr
                    key={dateKey}
                    onClick={() => setSelectedDay(date)}
                    style={{
                      cursor: "pointer",
                      backgroundColor: rowBackground,
                      transition: "background-color 0.2s",
                      borderLeft: computedBorderLeftStyle,
                      boxShadow: baseBoxShadow,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.boxShadow = hoverShadow;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.boxShadow = baseBoxShadow;
                      }
                    }}
                  >
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)", fontWeight: isSelected ? "600" : "400" }}>
                      {formatDate(date)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--surface-light)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: availabilityLabelColor,
                        }}
                      >
                        {dayTechSummary.totalTechs} tech
                        {dayTechSummary.totalTechs !== 1 ? "s" : ""} · {totalAvailableHours.toFixed(1)}h avail
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--grey-accent)",
                          marginTop: "2px",
                        }}
                      >
                        {bookingPercentDisplay}% booked
                      </div>
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      borderBottom: "1px solid var(--surface-light)",
                      color: counts.totalHours > 0 ? "var(--text-secondary)" : "var(--grey-accent-light)"
                    }}>
                      {counts.totalHours}h
                    </td>
                    <td style={{
                      padding: "10px 12px", 
                      borderBottom: "1px solid var(--surface-light)",
                      fontWeight: counts.totalJobs > 0 ? "600" : "400"
                    }}>
                      {counts.totalJobs}
                    </td>
                    <td style={{
                      padding: "10px 12px", 
                      borderBottom: "1px solid var(--surface-light)",
                      fontWeight: counts.totalJobs > 0 ? "600" : "400"
                    }}>
                      {counts.totalJobs}
                    </td>
                    <td style={{
                      padding: "10px 12px", 
                      borderBottom: "1px solid var(--surface-light)",
                      fontWeight: "500"
                    }}>
                      {counts.finishTime || "-"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                      {counts.services}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                      {counts.mot}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                      {counts.diagnosis}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                      {counts.other}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      borderBottom: "1px solid var(--surface-light)"
                    }}>
                      {staffEntries.length > 0 ? (
                        <button
                          type="button"
                          onClick={(event) => handleShowStaffOff(event, date, staffEntries)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "999px",
                            border: "1px solid var(--primary)",
                            backgroundColor: "var(--surface-light)",
                            color: "var(--primary)",
                            fontWeight: "600",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                          onMouseEnter={(event) => event.currentTarget.style.backgroundColor = "var(--surface-light)"}
                          onMouseLeave={(event) => event.currentTarget.style.backgroundColor = "var(--surface-light)"}
                        >
                          {`View ${staffEntries.length} staff off`}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Jobs for Selected Day Section */}
        <div style={{ 
          flex: "0 0 40%", 
          marginBottom: "8px", 
          border: "1px solid var(--surface-light)", 
          borderRadius: "10px", 
          padding: "16px", 
          backgroundColor: "var(--surface)", 
          boxShadow: "0 2px 6px rgba(var(--shadow-rgb),0.05)", 
          overflowY: "auto" 
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "16px" 
          }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
              Jobs for <span style={{ color: "var(--primary)" }}>{formatDateNoYear(selectedDay)}</span>
            </h3>
            <span style={{
              padding: "6px 14px",
              backgroundColor: "var(--surface)",
              borderRadius: "16px",
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--text-secondary)"
            }}>
              {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: "1", minWidth: "140px", background: "var(--surface)", borderRadius: "10px", padding: "12px", border: "1px solid var(--surface-light)" }}>
              <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "6px" }}>Total Appointments</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>{checkinStatsForSelectedDay.total}</div>
            </div>
            <div style={{ flex: "1", minWidth: "140px", background: "var(--surface)", borderRadius: "10px", padding: "12px", border: "1px solid var(--surface-light)" }}>
              <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "6px" }}>Checked In</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>{checkinStatsForSelectedDay.checkedIn}</div>
            </div>
            <div style={{ flex: "1", minWidth: "140px", background: "var(--surface)", borderRadius: "10px", padding: "12px", border: "1px solid var(--surface-light)" }}>
              <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "6px" }}>
                {isSameDate(selectedDay, new Date()) ? "Awaiting Check-in" : "Awaiting (today only)"}
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
                {isSameDate(selectedDay, new Date()) ? checkinStatsForSelectedDay.awaiting : "-"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveDayTab("jobs")}
              style={{
                padding: "8px 16px",
                border: activeDayTab === "jobs" ? "2px solid var(--primary)" : "1px solid var(--surface-light)",
                backgroundColor: activeDayTab === "jobs" ? "var(--surface-light)" : "white",
                color: activeDayTab === "jobs" ? "var(--text-primary)" : "var(--grey-accent)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: activeDayTab === "jobs" ? "600" : "500",
                fontSize: "13px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (activeDayTab !== "jobs") {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeDayTab !== "jobs") {
                  e.currentTarget.style.backgroundColor = "white";
                }
              }}
            >
              All Jobs ({sortedJobs.length})
            </button>
            
            <button
              onClick={() => setActiveDayTab("tech-hours")}
              style={{
                padding: "8px 16px",
                border: activeDayTab === "tech-hours" ? "2px solid var(--primary)" : "1px solid var(--surface-light)",
                backgroundColor: activeDayTab === "tech-hours" ? "var(--surface-light)" : "white",
                color: activeDayTab === "tech-hours" ? "var(--text-primary)" : "var(--grey-accent)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: activeDayTab === "tech-hours" ? "600" : "500",
                fontSize: "13px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (activeDayTab !== "tech-hours") {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeDayTab !== "tech-hours") {
                  e.currentTarget.style.backgroundColor = "white";
                }
              }}
            >
              Tech Hours
            </button>
          </div>
          {activeDayTab === "tech-hours" && (
            <div style={{ 
              marginBottom: "16px", 
              padding: "16px", 
              border: "2px solid var(--primary)", 
              borderRadius: "8px", 
              background: "var(--surface-light)" 
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>
                    Live Tech Availability — {formatDateNoYear(selectedDay)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--grey-accent)" }}>
                    Source: {TECH_AVAILABILITY_TABLE === "tech_hours" ? "tech_hours" : "job_clocking"} table
                  </div>
                </div>
                <span style={{
                  padding: "4px 12px",
                  borderRadius: "999px",
                  backgroundColor: "var(--surface-light)",
                  color: "var(--primary)",
                  fontWeight: "600",
                  fontSize: "13px"
                }}>
                  {techSummaryForSelectedDay.totalTechs} tech{techSummaryForSelectedDay.totalTechs !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "6px"
              }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                  Booked {totalBookedTechHours.toFixed(1)}h
                </div>
                <div style={{ fontSize: "12px", color: "var(--grey-accent-dark)" }}>
                  of {totalAvailableTechHours.toFixed(1)}h available
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: "600",
                    ...totalCapacityBadgeStyle
                  }}
                >
                  {totalCapacityLabel}
                </span>
              </div>
              {techAvailabilityError && (
                <div style={{
                  marginBottom: "10px",
                  padding: "10px 12px",
                  background: "var(--surface-light)",
                  borderRadius: "6px",
                  color: "var(--danger)",
                  fontSize: "13px"
                }}>
                  {techAvailabilityError}
                </div>
              )}
              {isTechAvailabilityLoading ? (
                <div style={{ padding: "10px 0", color: "var(--grey-accent)", fontSize: "13px" }}>
                  Loading live tech availability...
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {techsForSelectedDay.map((tech) => {
                    const latestSegment = tech.segments[tech.segments.length - 1];
                    const latestJobDisplay = latestSegment
                      ? `Job ${latestSegment.jobNumber || "-"} (${latestSegment.workType})`
                      : "No jobs recorded";
                    const latestClockIn = tech.latestClockIn
                      ? new Date(tech.latestClockIn).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                      : "-";
                    const latestClockOut = tech.latestClockOut
                      ? new Date(tech.latestClockOut).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                      : "-";
                    const availableHoursValue = parseHoursValue(tech.availableHours) ?? DEFAULT_RETAIL_TECH_HOURS;
                    const totalLogged = parseHoursValue(tech.totalHours) ?? 0;

                    return (
                      <div
                        key={tech.techId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          background: "var(--surface)",
                          borderRadius: "8px",
                          border: "1px solid var(--surface-light)",
                          boxShadow: "0 1px 2px rgba(var(--shadow-rgb),0.04)"
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>
                            {tech.name || "Retail Technician"}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--grey-accent)" }}>
                            {latestJobDisplay}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--grey-accent-light)", marginTop: "4px" }}>
                            Shift: {latestClockIn} – {tech.currentlyClockedIn ? "Present" : latestClockOut}
                            {" · "}
                            {totalLogged > 0 ? `${totalLogged.toFixed(1)}h logged` : "0h recorded"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <label style={{ fontSize: "11px", color: "var(--grey-accent)", fontWeight: "600" }}>
                            Availability
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={availableHoursValue}
                            onChange={(event) =>
                              handleTechAvailabilityChange(
                                techSummaryForSelectedDay.dateKey || selectedDay.toDateString(),
                                tech.techId,
                                event.target.value
                              )
                            }
                            style={{
                              width: "80px",
                              padding: "6px 8px",
                              borderRadius: "8px",
                              border: "1px solid var(--surface-light)",
                              fontSize: "14px",
                              textAlign: "right",
                              fontFamily: "inherit",
                              background: "var(--surface)"
                            }}
                          />
                          <span style={{ fontSize: "11px", color: "var(--grey-accent-dark)" }}>
                            hours (manual override)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeDayTab === "jobs" && (
            <>
              {/* ✅ Enhanced Jobs Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                {[
                  "Time",
                  "Job #",
                  "Reg",
                  "Vehicle",
                  "Customer",
                  "Job Type",
                  "Customer Status",
                  "Estimated Finish Time",
                  "Check-In"
                ].map(head => (
                    <th 
                      key={head} 
                      style={{ 
                        textAlign: head === "Check-In" ? "center" : "left", 
                        padding: "10px 12px", 
                        background: "var(--surface)", 
                        fontWeight: "600", 
                        borderBottom: "2px solid var(--primary)", 
                        position: "sticky", 
                        top: 0, 
                        zIndex: 1,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedJobs.length > 0 ? (
                  sortedJobs.map((job, idx) => {
                    const statusNormalized = (job.status || "").trim().toLowerCase();
                    const isBooked = statusNormalized === "booked";
                    const isCheckedIn =
                      ["checked in", "workshop/mot", "vhc complete", "vhc sent", "being washed", "complete"].includes(
                        statusNormalized
                      ) || !isBooked;
                    const isCurrentlyCheckingIn = checkingInJobId === job.id;
                    const rowBackground =
                      highlightJob === job.jobNumber
                        ? "var(--success)"
                        : idx % 2 === 0
                        ? "var(--surface)"
                        : "transparent";

                    return (
                      <tr 
                        key={idx} 
                        style={{ 
                          backgroundColor: rowBackground, 
                          transition: "background-color 0.5s",
                          cursor: "pointer"
                        }}
                        onClick={() => handleJobRowClick(job.jobNumber || job.id)}
                        onMouseEnter={(e) => {
                          if (highlightJob !== job.jobNumber) {
                            e.currentTarget.style.backgroundColor = "var(--surface)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (highlightJob !== job.jobNumber) {
                            e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--surface)" : "transparent";
                          }
                        }}
                      >
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)", fontWeight: "600" }}>
                          {job.appointment?.time || "-"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)", color: "var(--primary)", fontWeight: "600" }}>
                          {job.jobNumber || job.id || "-"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)", fontWeight: "500" }}>
                          {job.reg || "-"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                          {getVehicleDisplay(job)}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                          {job.customer || "-"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                          <span style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "var(--text-primary)"
                          }}>
                            {getDetectedJobTypeLabel(job)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              ...getCustomerStatusBadgeColors(job.waitingStatus || "Neither"),
                            }}
                          >
                            {job.waitingStatus || "Neither"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)", fontWeight: "600" }}>
                          {getEstimatedFinishTime(job)}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--surface-light)", textAlign: "center" }}>
                          {isCheckedIn ? (
                            <span style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: "600",
                              backgroundColor: "var(--success)",
                              color: "var(--info-dark)"
                            }}>
                              ✓ Checked In
                            </span>
                          ) : (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCheckIn(job);
                              }}
                              disabled={isCurrentlyCheckingIn}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: isCurrentlyCheckingIn ? "var(--background)" : "var(--info)",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: isCurrentlyCheckingIn ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                fontWeight: "600",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                if (!isCurrentlyCheckingIn) {
                                  e.currentTarget.style.backgroundColor = "var(--info-dark)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isCurrentlyCheckingIn) {
                                  e.currentTarget.style.backgroundColor = "var(--info)";
                                }
                              }}
                            >
                              {isCurrentlyCheckingIn ? "Checking In..." : "Check In"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td 
                      colSpan="9" 
                      style={{ 
                        padding: "40px", 
                        textAlign: "center", 
                        color: "var(--grey-accent-light)",
                        fontSize: "14px"
                      }}
                    >
                      No appointments booked for this day
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
            </>
          )}
        </div>
        {/* Add Note Popup */}
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}>
          <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "20px", fontWeight: "600" }}>
            Add Note for {formatDateNoYear(selectedDay)}
          </h3>
          <textarea 
            style={{ 
              width: "100%", 
              height: "120px", 
              padding: "12px", 
              borderRadius: "8px", 
              border: "1px solid var(--surface-light)",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none"
            }} 
            value={currentNote} 
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="Enter notes about this day's schedule..."
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--surface-light)"}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", gap: "10px" }}>
            <button 
              onClick={saveNote} 
              style={{ 
                flex: 1,
                padding: "10px 20px", 
                backgroundColor: "var(--primary)", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
            >
              Save Note
            </button>
            <button 
              onClick={() => setShowNotePopup(false)} 
              style={{ 
                flex: 1,
                padding: "10px 20px", 
                backgroundColor: "var(--grey-accent)", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--grey-accent-dark)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--grey-accent)"}
            >
              Cancel
            </button>
          </div>
        </Popup>
        {/* Staff Off Popup */}
        <Popup isOpen={showStaffOffPopup} onClose={() => setShowStaffOffPopup(false)}>
          <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "20px", fontWeight: "600" }}>
            Staff Off · {formatDate(staffOffPopupDate || selectedDay)}
          </h3>
          <p style={{ marginTop: 0, marginBottom: "16px", color: "var(--grey-accent)", fontSize: "14px" }}>
            Showing approved holiday/absence data for the selected roles.
          </p>
          {staffOffPopupDetails.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              {staffOffPopupDetails.map((entry, index) => (
                <div
                  key={`${entry.id}-${index}`}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--surface-light)",
                    boxShadow: "0 1px 3px rgba(var(--shadow-rgb),0.06)"
                  }}
                >
                  <div style={{ fontWeight: "600", color: "var(--text-secondary)" }}>{entry.name}</div>
                  <div style={{ fontSize: "13px", color: "var(--grey-accent-dark)", marginTop: "4px" }}>
                    {entry.role} · {entry.type}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--grey-accent)", marginBottom: "16px" }}>No recorded absences for the selected roles today.</div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowStaffOffPopup(false)}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "var(--primary)",
                color: "var(--surface)",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(event) => (event.currentTarget.style.backgroundColor = "var(--danger)")}
              onMouseLeave={(event) => (event.currentTarget.style.backgroundColor = "var(--primary)")}
            >
              Close
            </button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}
