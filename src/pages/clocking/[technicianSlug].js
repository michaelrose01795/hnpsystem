// file location: src/pages/clocking/[technicianSlug].js
// file: src/pages/clocking/[technicianSlug].js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PageContainer, PageWrapper } from "@/components/ui";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/database/supabaseClient";
import { generateTechnicianSlug } from "@/utils/technicianSlug";
import ClockingHistorySection from "@/components/JobCards/ClockingHistorySection";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import { STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import UserClockingHistoryUi from "@/components/page-ui/clocking/clocking-technician-slug-ui"; // Extracted presentation layer.

const STATUS_STATES = ["In Progress", "Tea Break", "Waiting for Job"];

const STATUS_BADGE_STYLES = {
  "In Progress": {
    background: "var(--layer-section-level-1)",
    border: "none",
    color: "var(--success-dark)"
  },
  "Tea Break": {
    background: "var(--layer-section-level-1)",
    border: "none",
    color: "var(--warning-dark)"
  },
  "Waiting for Job": {
    background: "var(--layer-section-level-1)",
    border: "none",
    color: "var(--info)"
  }
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDuration = (start, end) => {
  if (!start) return "—";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "—";
  const diff = Math.max(0, endMs - startMs);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const segments = [];
  if (hours) segments.push(`${hours}h`);
  if (mins) segments.push(`${mins}m`);
  if (!segments.length) segments.push("0m");
  return segments.join(" ");
};

const deriveStatus = (record) => {
  const noteText = (record?.notes || "").toString().toLowerCase();
  if (noteText.includes("tea") || noteText.includes("break")) {
    return "Tea Break";
  }
  if (record?.job_number) {
    return "In Progress";
  }
  return "Waiting for Job";
};

const buildDateFromTime = (timeValue, baseDate = new Date()) => {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(":").map((segment) => parseInt(segment, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const isClockingLockedStatus = (statusValue) => {
  const statusId = resolveMainStatusId(statusValue);
  return (
    statusId === JOB_STATUSES.INVOICED ||
    statusId === JOB_STATUSES.RELEASED ||
    String(statusValue || "").trim().toLowerCase() === "archived");

};

export default function UserClockingHistory() {
  const router = useRouter();
  const slugParamRaw = router.query.technicianSlug;
  const userIdQueryRaw = router.query.userId;
  const slugParam = Array.isArray(slugParamRaw) ? slugParamRaw[0] : slugParamRaw;
  const userIdFromQuery = Array.isArray(userIdQueryRaw) ? userIdQueryRaw[0] : userIdQueryRaw;
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const [slugLookupPending, setSlugLookupPending] = useState(false);

  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user: currentUser } = useUser();
  const managerRoles = useMemo(
    () =>
    new Set([
    "workshop manager",
    "service manager",
    "after sales manager",
    "after sales director",
    "admin manager",
    "aftersales manager"]
    ),
    []
  );
  const userRoles = currentUser?.roles?.map((role) => role.toLowerCase()) || [];
  const isManager = userRoles.some((role) => managerRoles.has(role));

  const [activeJobs, setActiveJobs] = useState([]);
  const [activeJobsLoading, setActiveJobsLoading] = useState(true);
  const [formJobNumber, setFormJobNumber] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState("job");
  const [jobRequests, setJobRequests] = useState([]);
  const [clockInDate, setClockInDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clockOutDate, setClockOutDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formStartTime, setFormStartTime] = useState("");
  const [formFinishTime, setFormFinishTime] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [lastClockedJobId, setLastClockedJobId] = useState(null);
  const [lastClockedJobNumber, setLastClockedJobNumber] = useState("");
  const [lastClockedJobRequests, setLastClockedJobRequests] = useState([]);
  const [lastClockedJobAllocatedHours, setLastClockedJobAllocatedHours] = useState(null);
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0);
  const [selectedJobLockedMessage, setSelectedJobLockedMessage] = useState("");

  useEffect(() => {
    if (resolvedUserId) {
      return;
    }

    if (userIdFromQuery) {
      const numeric = Number(userIdFromQuery);
      if (!Number.isNaN(numeric)) {
        setResolvedUserId(numeric);
        return;
      }
    }

    if (!slugParam) {
      return;
    }

    // New slug format: "{Name}-{userId}" — extract the trailing ID first.
    const trailingId = slugParam.match(/-(\d+)$/);
    if (trailingId) {
      const numeric = Number(trailingId[1]);
      if (!Number.isNaN(numeric)) {
        setResolvedUserId(numeric);
        return;
      }
    }

    // Legacy: slug was leading digits only (e.g. "5Smith").
    const leadingDigits = slugParam.match(/^(\d+)/);
    if (leadingDigits) {
      const numeric = Number(leadingDigits[1]);
      if (!Number.isNaN(numeric)) {
        setResolvedUserId(numeric);
        return;
      }
    }

    let cancelled = false;

    const fetchUserForSlug = async () => {
      setSlugLookupPending(true);
      try {
        const { data, error } = await supabase.
        from("users").
        select("user_id, first_name, last_name").
        order("user_id", { ascending: true });

        if (error) {
          throw error;
        }

        const match = (data || []).find(
          (record) =>
          generateTechnicianSlug(record.first_name, record.last_name, record.user_id) === slugParam
        );

        if (!cancelled && match?.user_id) {
          setResolvedUserId(match.user_id);
          const canonicalSlug = generateTechnicianSlug(match.first_name, match.last_name, match.user_id);
          if (canonicalSlug && canonicalSlug !== slugParam) {
            router.replace(`/clocking/${canonicalSlug}`, undefined, {
              shallow: true,
              scroll: false
            });
          }
        } else if (!cancelled && !match) {
          setError("Technician not found.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Unable to identify technician.");
        }
      } finally {
        if (!cancelled) {
          setSlugLookupPending(false);
        }
      }
    };

    fetchUserForSlug();

    return () => {
      cancelled = true;
    };
  }, [slugParam, userIdFromQuery, router, resolvedUserId]);

  const technicianUserId = resolvedUserId ? Number(resolvedUserId) : null;

  const fetchEntries = useCallback(async () => {
    if (!technicianUserId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: records, error: recordsError } = await supabase.
      from("time_records").
      select("id, job_number, clock_in, clock_out, notes").
      eq("user_id", technicianUserId).
      eq("date", today).
      order("clock_in", { ascending: false });

      if (recordsError) {
        throw recordsError;
      }

      const { data: userData, error: userError } = await supabase.
      from("users").
      select("user_id, first_name, last_name, role").
      eq("user_id", technicianUserId).
      maybeSingle();

      if (userError) {
        throw userError;
      }

      setUser(userData || null);
      setEntries(records || []);
      setError("");
    } catch (err) {
      console.error("Failed to load user clocking history", err);
      setError(err?.message || "Unable to load user clocking.");
    } finally {
      setLoading(false);
    }
  }, [technicianUserId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!technicianUserId) return undefined;

    const channel = supabase.channel(`clocking-user-${technicianUserId}`);

    channel.
    on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "time_records",
        filter: `user_id=eq.${technicianUserId}`
      },
      () => fetchEntries()
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries, technicianUserId]);

  const fetchActiveJobs = useCallback(async () => {
    setActiveJobsLoading(true);
    try {
      const { data, error } = await supabase.
      from("job_clocking").
      select("job_id, job_number").
      is("clock_out", null);

      if (error) {
        throw error;
      }

      const seen = new Set();
      const unique = [];
      (data || []).forEach((entry) => {
        const number = (entry.job_number || "").toString().trim();
        if (number && !seen.has(number)) {
          seen.add(number);
          unique.push({ job_id: entry.job_id, job_number: number });
        }
      });
      unique.sort((a, b) => a.job_number.localeCompare(b.job_number));
      setActiveJobs(unique);
    } catch (err) {
      console.error("Failed to load active jobs", err);
    } finally {
      setActiveJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveJobs();
  }, [fetchActiveJobs]);

  useEffect(() => {
    const channel = supabase.channel("manual-job-clockings");
    channel.
    on(
      "postgres_changes",
      { event: "*", schema: "public", table: "job_clocking" },
      () => fetchActiveJobs()
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveJobs]);

  const handleJobNumberChange = async (value) => {
    setFormJobNumber(value);
    setSelectedJobLockedMessage("");
    const match =
    activeJobs.find(
      (job) => job.job_number?.toLowerCase() === (value || "").trim().toLowerCase()
    ) || null;
    setSelectedJobId(match?.job_id ?? null);

    // Fetch requests for the selected job
    if (match?.job_id) {
      try {
        const { data: jobRecord, error: jobRecordError } = await supabase.
        from("jobs").
        select("status").
        eq("id", match.job_id).
        maybeSingle();

        if (jobRecordError) {
          throw jobRecordError;
        }

        if (isClockingLockedStatus(jobRecord?.status)) {
          setSelectedJobLockedMessage(
            `Job ${match.job_number} is ${jobRecord?.status || "locked"} and can no longer be clocked onto.`
          );
        }

        const { data, error } = await supabase.
        from("job_requests").
        select("request_id, description, hours, job_type, sort_order").
        eq("job_id", match.job_id).
        order("sort_order", { ascending: true });

        if (!error && data) {
          setJobRequests(data);
          setSelectedRequest("job"); // Reset to job level
        } else {
          setJobRequests([]);
        }
      } catch (err) {
        console.error("Failed to fetch job requests:", err);
        setJobRequests([]);
      }
    } else {
      setJobRequests([]);
      setSelectedRequest("job");
    }
  };

  const resolveJobIdByNumber = useCallback(
    async (jobNumber) => {
      const normalized = jobNumber.trim();
      if (!normalized) return null;

      const existing = activeJobs.find(
        (job) => job.job_number?.toLowerCase() === normalized.toLowerCase()
      );
      if (existing) return existing.job_id;

      const { data, error } = await supabase.
      from("jobs").
      select("id, status, job_number").
      ilike("job_number", normalized).
      maybeSingle();

      if (error) {
        throw error;
      }

      if (isClockingLockedStatus(data?.status)) {
        throw new Error(
          `Job ${data?.job_number || normalized} is ${data?.status || "locked"} and can no longer be clocked onto.`
        );
      }

      return data?.id ?? null;
    },
    [activeJobs]
  );

  const requestOptions = useMemo(() => {
    const options = [
    {
      key: "job",
      value: "job",
      label: formJobNumber ? `Job #${formJobNumber}` : "Job (select job first)",
      description: "Clock onto the main job"
    }];


    jobRequests.forEach((req) => {
      const requestKey = `R${req.request_id}`;
      options.push({
        key: requestKey,
        value: requestKey,
        label: `${requestKey}: ${req.description || "Request"}`,
        description: `${req.hours || 0}h allocated`
      });
    });

    return options;
  }, [jobRequests, formJobNumber]);

  const handleManualEntrySubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormError("");
      setFormSuccess("");

      if (!technicianUserId) {
        setFormError("Unable to identify the user.");
        return;
      }

      if (!clockInDate || !clockOutDate) {
        setFormError("Clock-in and clock-out dates are required.");
        return;
      }

      if (!formStartTime || !formFinishTime) {
        setFormError("Start and finish times are required.");
        return;
      }

      const startDate = buildDateFromTime(formStartTime, new Date(clockInDate));
      const finishDate = buildDateFromTime(formFinishTime, new Date(clockOutDate));

      if (!startDate || !finishDate) {
        setFormError("Please provide valid time values.");
        return;
      }

      if (finishDate <= startDate) {
        setFormError("Clock-out must be after clock-in.");
        return;
      }

      const durationMs = finishDate.getTime() - startDate.getTime();
      if (durationMs <= 0) {
        setFormError("Finish time must come after start time.");
        return;
      }

      const jobNumberTrimmed = formJobNumber.trim();
      let jobIdForEntry = selectedJobId;

      if (jobNumberTrimmed && !jobIdForEntry) {
        try {
          jobIdForEntry = await resolveJobIdByNumber(jobNumberTrimmed);
        } catch (err) {
          setFormError(err?.message || "Unable to resolve job number.");
          return;
        }
        if (!jobIdForEntry) {
          setFormError("Job number not found in the system.");
          return;
        }
      }

      if (selectedJobLockedMessage) {
        setFormError(selectedJobLockedMessage);
        return;
      }

      const dateString = clockInDate;
      const hoursWorked = Number((durationMs / (1000 * 60 * 60)).toFixed(2));

      setFormSubmitting(true);

      try {
        // Build request snapshot for notes field
        const selectedRequestData = jobRequests.find((r) => `R${r.request_id}` === selectedRequest);
        let notesPayload = null;

        if (selectedRequest && selectedRequest !== "job") {
          notesPayload = JSON.stringify({
            requestKey: selectedRequest,
            requestLabel: selectedRequest,
            requestTitle: selectedRequestData?.description || selectedRequest,
            requestHours: selectedRequestData?.hours || null
          });
        } else {
          notesPayload = JSON.stringify({
            requestKey: "job",
            requestLabel: `Job #${jobNumberTrimmed}`,
            requestTitle: `Job #${jobNumberTrimmed}`
          });
        }

        const { error: insertError } = await supabase.from("time_records").insert([
        {
          user_id: technicianUserId,
          job_id: jobIdForEntry,
          job_number: jobNumberTrimmed || null,
          clock_in: startDate.toISOString(),
          clock_out: finishDate.toISOString(),
          date: dateString,
          hours_worked: hoursWorked,
          notes: notesPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
        );

        if (insertError) {
          throw insertError;
        }

        if (jobNumberTrimmed && jobIdForEntry) {
          const { error: jobClockingError } = await supabase.from("job_clocking").insert([
          {
            user_id: technicianUserId,
            job_id: jobIdForEntry,
            job_number: jobNumberTrimmed,
            clock_in: startDate.toISOString(),
            clock_out: finishDate.toISOString(),
            work_type: "manual",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
          );

          if (jobClockingError) {
            throw jobClockingError;
          }

          const { error: jobUpdateError } = await supabase.
          from("jobs").
          update({ updated_at: new Date().toISOString() }).
          eq("id", jobIdForEntry);

          if (jobUpdateError) {
            throw jobUpdateError;
          }
        }

        setFormSuccess("Clocking entry saved successfully.");
        setLastClockedJobId(jobIdForEntry);
        setLastClockedJobNumber(jobNumberTrimmed);

        // Fetch job details for ClockingHistorySection
        try {
          const { data: jobData, error: jobError } = await supabase.
          from("jobs").
          select("labour_hours, requests").
          eq("id", jobIdForEntry).
          single();

          if (!jobError && jobData) {
            setLastClockedJobAllocatedHours(jobData.labour_hours || null);

            // Normalize requests from the job
            const normalizedRequests = [];
            if (jobData.requests && typeof jobData.requests === 'object') {
              Object.entries(jobData.requests).forEach(([key, req]) => {
                if (req && typeof req === 'object') {
                  normalizedRequests.push({
                    key,
                    title: req.title || req.description || key,
                    hours: req.hours || req.labour_hours || 0
                  });
                }
              });
            }
            setLastClockedJobRequests(normalizedRequests);
          }
        } catch (err) {
          console.error("Failed to fetch job details for history:", err);
        }

        setHistoryRefreshSignal((prev) => prev + 1);
        setFormJobNumber("");
        setSelectedJobId(null);
        setSelectedRequest("job");
        setJobRequests([]);
        setClockInDate(new Date().toISOString().split("T")[0]);
        setClockOutDate(new Date().toISOString().split("T")[0]);
        setFormStartTime("");
        setFormFinishTime("");
        fetchEntries();
        fetchActiveJobs();
      } catch (err) {
        console.error("Manual entry error:", err);
        setFormError(err?.message || "Unable to save the entry.");
      } finally {
        setFormSubmitting(false);
      }
    },
    [
    technicianUserId,
    clockInDate,
    clockOutDate,
    formStartTime,
    formFinishTime,
    formJobNumber,
    selectedRequest,
    selectedJobId,
    jobRequests,
    fetchEntries,
    fetchActiveJobs,
    resolveJobIdByNumber]

  );

  const liveRecord = entries.find((entry) => !entry.clock_out) || entries[0] || null;
  const currentStatus = liveRecord ? deriveStatus(liveRecord) : null;

  const basePanelStyle = {
    borderRadius: "var(--radius-xl)",
    border: "none",
    background: "var(--layer-section-level-2)",
    padding: "32px",
    boxShadow: "none",
    display: "flex",
    flexDirection: "column",
    gap: "24px"
  };

  const badgeBaseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 18px",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  };

  const tableWrapperStyle = {
    borderRadius: "var(--radius-xl)",
    border: "none",
    overflow: "hidden"
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.9rem"
  };

  const tableHeaderStyle = {
    textAlign: "left",
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--grey-accent)",
    background: "var(--surface-light)",
    borderBottom: "1px solid var(--surface-light)",
    padding: "14px 18px"
  };

  const tableCellStyle = {
    padding: "14px 18px",
    borderBottom: "1px solid var(--surface-light)",
    color: "var(--text-color)"
  };

  const managerBadgeStyle = {
    ...badgeBaseStyle,
    background: "var(--layer-section-level-1)",
    border: "none",
    color: "var(--info)"
  };

  const inputStyle = {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--surface-light)",
    padding: "12px 14px",
    fontSize: "0.95rem",
    color: "var(--text-primary)",
    outline: "none"
  };

  const buttonPrimaryStyle = {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--primary)",
    color: "var(--surface)",
    fontSize: "0.95rem",
    fontWeight: 600,
    padding: "12px 18px",
    cursor: "pointer"
  };

  const buttonSecondaryStyle = {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "transparent",
    color: "var(--info)",
    fontSize: "0.95rem",
    fontWeight: 600,
    padding: "12px 18px",
    cursor: "pointer"
  };

  return <UserClockingHistoryUi view="section1" activeJobs={activeJobs} activeJobsLoading={activeJobsLoading} badgeBaseStyle={badgeBaseStyle} basePanelStyle={basePanelStyle} buttonPrimaryStyle={buttonPrimaryStyle} buttonSecondaryStyle={buttonSecondaryStyle} CalendarField={CalendarField} clockInDate={clockInDate} ClockingHistorySection={ClockingHistorySection} clockOutDate={clockOutDate} deriveStatus={deriveStatus} DropdownField={DropdownField} entries={entries} error={error} formatDuration={formatDuration} formatTime={formatTime} formError={formError} formFinishTime={formFinishTime} formJobNumber={formJobNumber} formStartTime={formStartTime} formSubmitting={formSubmitting} formSuccess={formSuccess} handleJobNumberChange={handleJobNumberChange} handleManualEntrySubmit={handleManualEntrySubmit} historyRefreshSignal={historyRefreshSignal} inputStyle={inputStyle} isManager={isManager} lastClockedJobId={lastClockedJobId} lastClockedJobNumber={lastClockedJobNumber} loading={loading} managerBadgeStyle={managerBadgeStyle} PageContainer={PageContainer} PageWrapper={PageWrapper} requestOptions={requestOptions} selectedJobLockedMessage={selectedJobLockedMessage} selectedRequest={selectedRequest} setClockInDate={setClockInDate} setClockOutDate={setClockOutDate} setFormError={setFormError} setFormFinishTime={setFormFinishTime} setFormJobNumber={setFormJobNumber} setFormStartTime={setFormStartTime} setFormSuccess={setFormSuccess} setJobRequests={setJobRequests} setSelectedJobId={setSelectedJobId} setSelectedJobLockedMessage={setSelectedJobLockedMessage} setSelectedRequest={setSelectedRequest} STATUS_BADGE_STYLES={STATUS_BADGE_STYLES} STATUS_STATES={STATUS_STATES} tableCellStyle={tableCellStyle} tableHeaderStyle={tableHeaderStyle} tableStyle={tableStyle} tableWrapperStyle={tableWrapperStyle} TimePickerField={TimePickerField} />;



















































































































































































































































































}
