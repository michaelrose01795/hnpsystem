"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { clockInToJob, clockOutFromJob } from "@/lib/database/jobClocking";
import { generateTechnicianSlug } from "@/utils/technicianSlug";
import ModalPortal from "@/components/popups/ModalPortal";
import dynamic from "next/dynamic";
const EfficiencyTab = dynamic(() => import("@/components/Clocking/EfficiencyTab"), { ssr: false });

const TECH_ROLES = ["Techs", "Technician", "Technician Lead", "Lead Technician"];
const MOT_ROLES = ["MOT Tester", "Tester"];
const TARGET_ROLES = [...new Set([...TECH_ROLES, ...MOT_ROLES])];
const TARGET_ROLE_SET = new Set(TARGET_ROLES.map((role) => role.toLowerCase()));
const MOT_ROLE_SET = new Set(MOT_ROLES.map((role) => role.toLowerCase()));

const SUMMARY_CARD_STYLES = {
  total: {
    background: "rgba(var(--primary-rgb), 0.12)",
    border: "none",
    valueColor: "var(--primary-dark)",
  },
  inProgress: {
    background: "rgba(var(--primary-rgb), 0.12)",
    border: "none",
    valueColor: "var(--primary-dark)",
  },
  onMot: {
    background: "rgba(var(--primary-rgb), 0.12)",
    border: "none",
    valueColor: "var(--primary-dark)",
  },
  teaBreak: {
    background: "rgba(var(--primary-rgb), 0.12)",
    border: "none",
    valueColor: "var(--primary-dark)",
  },
  waiting: {
    background: "rgba(var(--primary-rgb), 0.12)",
    border: "none",
    valueColor: "var(--primary-dark)",
  },
  notClocked: {
    background: "rgba(var(--primary-rgb), 0.12)",
    border: "none",
    valueColor: "var(--primary-dark)",
  },
};

const TECH_STATUS_STYLES = {
  "Not Clocked In": {
    background: "rgba(var(--primary-rgb), 0.10)",
    border: "none",
    color: "var(--primary-dark)",
  },
  "Waiting for Job": {
    background: "rgba(var(--primary-rgb), 0.10)",
    border: "none",
    color: "var(--primary-dark)",
  },
  "Tea Break": {
    background: "rgba(var(--primary-rgb), 0.10)",
    border: "none",
    color: "var(--primary-dark)",
  },
  "In Progress": {
    background: "rgba(var(--primary-rgb), 0.10)",
    border: "none",
    color: "var(--primary-dark)",
  },
  "On MOT": {
    background: "rgba(var(--primary-rgb), 0.10)",
    border: "none",
    color: "var(--primary-dark)",
  },
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDurationMs = (startValue, endValue) => {
  if (!startValue) return 0;
  const startMs = new Date(startValue).getTime();
  if (Number.isNaN(startMs)) return 0;
  const endMs = endValue ? new Date(endValue).getTime() : Date.now();
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, endMs - startMs);
};

const formatDuration = (durationMs) => {
  if (!durationMs || durationMs < 1000) {
    return "0.00h";
  }
  const hours = durationMs / 3600000;
  return `${hours.toFixed(2)}h`;
};

const deriveStatus = (jobEntry, timeRecord, referenceTime, hasClocked = false) => {
  if (jobEntry) {
    const jobStatus = (jobEntry.job?.status || "").toString().toLowerCase();
    const categories = Array.isArray(jobEntry.job?.job_categories)
      ? jobEntry.job.job_categories.map((item) => (item || "").toString().toLowerCase())
      : [];
    const isMotJob = jobStatus.includes("mot") || categories.some((cat) => cat.includes("mot"));
    const clockInMs = jobEntry.clock_in ? new Date(jobEntry.clock_in).getTime() : null;
    const duration = clockInMs ? Math.max(0, referenceTime - clockInMs) : 0;
    return {
      status: isMotJob ? "On MOT" : "In Progress",
      duration,
      jobNumber: jobEntry.job_number || jobEntry.job?.job_number || null,
      jobId: jobEntry.job_id || jobEntry.job?.id || null,
      clockingId: jobEntry.id || null,
      clockIn: jobEntry.clock_in || null,
    };
  }

  if (timeRecord) {
    const noteText = (timeRecord.notes || "").toString().toLowerCase();
    const isTea = noteText.includes("tea") || noteText.includes("break");
    const clockInMs = timeRecord.clock_in ? new Date(timeRecord.clock_in).getTime() : null;
    const duration = clockInMs ? Math.max(0, referenceTime - clockInMs) : 0;
    return {
      status: isTea ? "Tea Break" : "Waiting for Job",
      duration,
      jobNumber: null,
      jobId: null,
      clockingId: null,
      clockIn: timeRecord.clock_in || null,
    };
  }

  return {
    status: hasClocked ? "Waiting for Job" : "Not Clocked In",
    duration: 0,
    jobNumber: null,
    jobId: null,
    clockingId: null,
    clockIn: null,
  };
};

function ClockingOverviewTab({ onSummaryChange }) {
  const [teamStatus, setTeamStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [modalJobNumber, setModalJobNumber] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchClocking = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, role")
        .in("role", TARGET_ROLES)
        .order("first_name", { ascending: true });

      if (usersError) throw usersError;

      const { data: timeRecords, error: timeError } = await supabase
        .from("time_records")
        .select("user_id, clock_in, notes")
        .eq("date", today)
        .is("clock_out", null);

      if (timeError) throw timeError;

      const { data: jobClocking, error: jobError } = await supabase
        .from("job_clocking")
        .select(
          `
            id,
            user_id,
            job_id,
            job_number,
            clock_in,
            job:job_id (
              id,
              job_number,
              status,
              job_categories
            )
          `
        )
        .is("clock_out", null);

      if (jobError) throw jobError;

      const userIds = (users || []).map((user) => user.user_id).filter(Boolean);
      let clockedUserIds = new Set();
      if (userIds.length > 0) {
        const { data: historyRecords, error: historyError } = await supabase
          .from("time_records")
          .select("user_id")
          .in("user_id", userIds)
          .eq("date", today);

        if (historyError) {
          throw historyError;
        }

        clockedUserIds = new Set((historyRecords || []).map((record) => record.user_id));
      }

      const timeMap = new Map(
        (timeRecords || []).map((record) => [record.user_id, record])
      );
      const jobMap = new Map();
      (jobClocking || []).forEach((entry) => {
        if (!jobMap.has(entry.user_id)) {
          jobMap.set(entry.user_id, entry);
        }
      });

      const referenceTime = Date.now();

      const prepared = (users || []).map((user) => {
        const jobEntry = jobMap.get(user.user_id);
        const timeRecord = timeMap.get(user.user_id);
        const derived = deriveStatus(
          jobEntry,
          timeRecord,
          referenceTime,
          clockedUserIds.has(user.user_id)
        );
        const roleLabel = user.role || "Tech";
        const isMotRole = MOT_ROLE_SET.has((roleLabel || "").toLowerCase());
        const isActiveJob = derived.status === "In Progress" || derived.status === "On MOT";

        const slug = generateTechnicianSlug(user.first_name, user.last_name, user.user_id);

        return {
          userId: user.user_id,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unnamed",
          role: roleLabel,
          isMotRole,
          slug: slug || `${user.user_id}`,
          status: derived.status,
          jobNumber: derived.jobNumber,
          jobId: derived.jobId,
          clockEntryId: derived.clockingId,
          clockIn: derived.clockIn,
          timeOnActivity: isActiveJob && derived.duration > 0 ? formatDuration(derived.duration) : "—",
        };
      });

      prepared.sort((a, b) => {
        if (a.isMotRole !== b.isMotRole) {
          return a.isMotRole ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      const summaryPayload = {
        total: prepared.length,
        inProgress: prepared.filter((tech) => tech.status === "In Progress").length,
        onMot: prepared.filter((tech) => tech.status === "On MOT").length,
        teaBreak: prepared.filter((tech) => tech.status === "Tea Break").length,
        waiting: prepared.filter((tech) => tech.status === "Waiting for Job").length,
        notClocked: prepared.filter((tech) => tech.status === "Not Clocked In").length,
        lastUpdated: new Date().toISOString(),
      };

      setTeamStatus(prepared);
      setError("");
      setLastUpdated(summaryPayload.lastUpdated);

      if (onSummaryChange) {
        onSummaryChange(summaryPayload);
      }
    } catch (err) {
      console.error("Failed to load clocking dashboard", err);
      setError(err?.message || "Unable to load clocking data.");
    } finally {
      setLoading(false);
    }
  }, [onSummaryChange]);

  useEffect(() => {
    fetchClocking();
  }, [fetchClocking]);

  useEffect(() => {
    const channel = supabase.channel("clocking-dashboard");
    const refresh = () => {
      fetchClocking();
    };

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_records" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_clocking" },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClocking]);

  useEffect(() => {
    if (!selectedTechnician) {
      return;
    }
    const updated = teamStatus.find((tech) => tech.userId === selectedTechnician.userId);
    if (!updated) {
      return;
    }
    setSelectedTechnician((prev) => {
      if (!prev) {
        return prev;
      }
      const unchanged =
        prev.status === updated.status &&
        prev.jobNumber === updated.jobNumber &&
        prev.timeOnActivity === updated.timeOnActivity &&
        prev.clockEntryId === updated.clockEntryId &&
        prev.jobId === updated.jobId;
      if (unchanged) {
        return prev;
      }
      return { ...prev, ...updated };
    });
  }, [teamStatus, selectedTechnician]);

  const resolveJobIdByNumber = useCallback(async (jobNumber) => {
    const normalized = (jobNumber || "").trim();
    if (!normalized) {
      throw new Error("Enter a job number.");
    }

    const { data, error } = await supabase
      .from("jobs")
      .select("id, job_number")
      .ilike("job_number", normalized)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.id) {
      throw new Error("Job number not found.");
    }

    return data;
  }, []);

  const closeClockModal = useCallback(() => {
    setSelectedTechnician(null);
    setModalJobNumber("");
    setModalError("");
    setModalSubmitting(false);
  }, []);

  const openClockModal = useCallback((tech) => {
    setSelectedTechnician(tech);
    setModalJobNumber(tech.jobNumber || "");
    setModalError("");
    setModalSubmitting(false);
  }, []);

  const handleClockInSubmit = useCallback(async () => {
    if (!selectedTechnician) {
      return;
    }
    const trimmedNumber = (modalJobNumber || "").trim();
    if (!trimmedNumber) {
      setModalError("Please enter a job number.");
      return;
    }

    setModalSubmitting(true);
    try {
      const jobRecord = await resolveJobIdByNumber(trimmedNumber);
      const result = await clockInToJob({
        userId: selectedTechnician.userId,
        jobId: jobRecord.id,
        jobNumber: jobRecord.job_number || trimmedNumber,
        workType: "manual",
      });

      if (!result?.success) {
        throw new Error(result?.error || "Unable to clock onto the job.");
      }

      await fetchClocking();
      closeClockModal();
    } catch (err) {
      setModalError(err?.message || "Unable to clock onto the job.");
    } finally {
      setModalSubmitting(false);
    }
  }, [selectedTechnician, modalJobNumber, resolveJobIdByNumber, fetchClocking, closeClockModal]);

  const handleClockOutSubmit = useCallback(async () => {
    if (!selectedTechnician?.clockEntryId) {
      setModalError("No active clocking entry found for this user.");
      return;
    }
    setModalSubmitting(true);
    try {
      const result = await clockOutFromJob({
        userId: selectedTechnician.userId,
        jobId: selectedTechnician.jobId,
        clockingId: selectedTechnician.clockEntryId,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Unable to clock the user off.");
      }

      await fetchClocking();
      setModalError("");
      setModalJobNumber("");
      setSelectedTechnician((prev) =>
        prev
          ? {
              ...prev,
              status: "Not Clocked In",
              jobNumber: null,
              jobId: null,
              clockEntryId: null,
              timeOnActivity: "—",
            }
          : prev
      );
    } catch (err) {
      setModalError(err?.message || "Unable to clock the user off.");
    } finally {
      setModalSubmitting(false);
    }
  }, [selectedTechnician, fetchClocking]);

  const summaryStats = useMemo(() => {
    const summary = {
      total: teamStatus.length,
      inProgress: 0,
      onMot: 0,
      teaBreak: 0,
      waiting: 0,
      notClocked: 0,
    };

    teamStatus.forEach((tech) => {
      if (tech.status === "In Progress") summary.inProgress += 1;
      else if (tech.status === "On MOT") summary.onMot += 1;
      else if (tech.status === "Tea Break") summary.teaBreak += 1;
      else if (tech.status === "Waiting for Job") summary.waiting += 1;
      else if (tech.status === "Not Clocked In") summary.notClocked += 1;
    });

    return summary;
  }, [teamStatus]);

  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const modalOpen = Boolean(selectedTechnician);
  const modalTechClockedIn =
    selectedTechnician &&
    (selectedTechnician.status === "In Progress" || selectedTechnician.status === "On MOT");
  const trimmedModalJobNumber = (modalJobNumber || "").trim();
  const modalActionDisabled = modalSubmitting || (!modalTechClockedIn && !trimmedModalJobNumber);
  const modalActionLabel = modalTechClockedIn ? "Clock off" : "Clock in";
  const jobNumberInputId = "clocking-job-number-input";
  const statusPillBaseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: "var(--control-radius)",
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    minHeight: "auto",
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Summary Stats Section */}
      <section
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>
            Summary Statistics
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>
            Last updated {formattedLastUpdated}
          </p>
        </div>

        {loading && teamStatus.length === 0 ? (
          <p style={{ color: "var(--info)" }}>Loading statistics...</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: SUMMARY_CARD_STYLES.total.background,
                border: SUMMARY_CARD_STYLES.total.border,
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.78rem",
                  color: "var(--info)",
                }}
              >
                Technicians Total
              </span>
              <strong style={{ fontSize: "1.8rem", color: SUMMARY_CARD_STYLES.total.valueColor }}>
                {summaryStats.total}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                All technicians
              </span>
            </div>

            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: SUMMARY_CARD_STYLES.inProgress.background,
                border: SUMMARY_CARD_STYLES.inProgress.border,
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.78rem",
                  color: "var(--info)",
                }}
              >
                In Progress
              </span>
              <strong style={{ fontSize: "1.8rem", color: SUMMARY_CARD_STYLES.inProgress.valueColor }}>
                {summaryStats.inProgress}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                Active on jobs
              </span>
            </div>

            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: SUMMARY_CARD_STYLES.onMot.background,
                border: SUMMARY_CARD_STYLES.onMot.border,
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.78rem",
                  color: "var(--info)",
                }}
              >
                MOT Count
              </span>
              <strong style={{ fontSize: "1.8rem", color: SUMMARY_CARD_STYLES.onMot.valueColor }}>
                {summaryStats.onMot}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                On MOT tests
              </span>
            </div>

            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: SUMMARY_CARD_STYLES.teaBreak.background,
                border: SUMMARY_CARD_STYLES.teaBreak.border,
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.78rem",
                  color: "var(--info)",
                }}
              >
                Tea Break
              </span>
              <strong style={{ fontSize: "1.8rem", color: SUMMARY_CARD_STYLES.teaBreak.valueColor }}>
                {summaryStats.teaBreak}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                On break
              </span>
            </div>

            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: SUMMARY_CARD_STYLES.waiting.background,
                border: SUMMARY_CARD_STYLES.waiting.border,
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.78rem",
                  color: "var(--info)",
                }}
              >
                Waiting
              </span>
              <strong style={{ fontSize: "1.8rem", color: SUMMARY_CARD_STYLES.waiting.valueColor }}>
                {summaryStats.waiting}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                Awaiting jobs
              </span>
            </div>

            <div
              style={{
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: SUMMARY_CARD_STYLES.notClocked.background,
                border: SUMMARY_CARD_STYLES.notClocked.border,
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.78rem",
                  color: "var(--info)",
                }}
              >
                Offline
              </span>
              <strong style={{ fontSize: "1.8rem", color: SUMMARY_CARD_STYLES.notClocked.valueColor }}>
                {summaryStats.notClocked}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                Not clocked in
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Error Display */}
      {error && (
        <div
          style={{
            borderRadius: "var(--radius-md)",
            padding: "14px 18px",
            background: "var(--danger-surface)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Technician Grid Section */}
      <section
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>
            Technician Status
          </h2>
        </div>

        {loading && teamStatus.length === 0 ? (
          <p style={{ color: "var(--info)" }}>Loading technician data...</p>
        ) : teamStatus.length === 0 ? (
          <div
            style={{
              borderRadius: "var(--radius-md)",
              padding: "32px",
              background: "rgba(var(--grey-accent-rgb), 0.16)",
              border: "none",
              textAlign: "center",
              color: "var(--info)",
            }}
          >
            No technicians or MOT testers are currently clocked in.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {teamStatus.map((tech) => {
              const showClockButton =
                tech.status === "Not Clocked In" ||
                tech.status === "In Progress" ||
                tech.status === "On MOT";
              const clockButtonLabel =
                tech.status === "Not Clocked In" ? "Not clocked in" : "Clocked in";
              const statusStyle = TECH_STATUS_STYLES[tech.status] || TECH_STATUS_STYLES["Waiting for Job"];

              const handleClockButtonClick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                openClockModal(tech);
              };

              return (
                <Link
                  key={tech.userId}
                  href={`/clocking/${tech.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <article
                    style={{
                      borderRadius: "var(--radius-md)",
                      padding: "20px",
                      background: "var(--background)",
                      border: "none",
                      boxShadow: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      height: "100%",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.position = "relative";
                      e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.zIndex = "0";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            color: "var(--primary-dark)",
                          }}
                        >
                          {tech.name}
                        </h3>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        {showClockButton ? (
                          <>
                            <button
                              type="button"
                              className="clocking-status-pill"
                              onClick={handleClockButtonClick}
                              style={{
                                ...statusPillBaseStyle,
                                background: statusStyle.background,
                                border: statusStyle.border,
                                color: statusStyle.color,
                                cursor: "pointer",
                              }}
                            >
                              {clockButtonLabel}
                            </button>
                            {tech.status !== "Not Clocked In" && (
                              <span style={{ fontSize: "0.7rem", color: "var(--info)" }}>{tech.status}</span>
                            )}
                          </>
                        ) : (
                          <span
                            style={{
                              ...statusPillBaseStyle,
                              padding: "6px 12px",
                              background: statusStyle.background,
                              border: statusStyle.border,
                              color: statusStyle.color,
                            }}
                          >
                            {tech.status}
                          </span>
                        )}
                      </div>
                    </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: "var(--radius-sm)",
                        padding: "12px",
                        background: "var(--surface)",
                        border: "none",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--info)",
                        }}
                      >
                        Current Job
                      </p>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "var(--primary-dark)",
                        }}
                      >
                        {(tech.status === "In Progress" || tech.status === "On MOT") && tech.jobNumber
                          ? tech.jobNumber
                          : "—"}
                      </p>
                    </div>

                    <div
                      style={{
                        borderRadius: "var(--radius-sm)",
                        padding: "12px",
                        background: "var(--surface)",
                        border: "none",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--info)",
                        }}
                      >
                        Time
                      </p>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "var(--primary-dark)",
                        }}
                      >
                        {tech.timeOnActivity}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "auto",
                      paddingTop: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--info)",
                      }}
                    >
                      {(tech.status === "In Progress" || tech.status === "On MOT") && tech.jobNumber
                        ? "Active assignment"
                        : "Awaiting assignment"}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "var(--control-padding)",
                        borderRadius: "var(--control-radius)",
                        background: "var(--primary)",
                        color: "var(--text-inverse)",
                        fontSize: "var(--control-font-size)",
                        fontWeight: 600,
                        minHeight: "var(--control-height)",
                      }}
                    >
                      View details
                      <span style={{ fontSize: "0.9rem" }}>&gt;</span>
                    </span>
                  </div>
                </article>
              </Link>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && selectedTechnician && (
        <ModalPortal>
          <div
            className="clocking-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 9999,
              backdropFilter: "blur(8px)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clocking-modal-title"
          >
            <div
              style={{
                width: "min(460px, 100%)",
                borderRadius: "var(--radius-lg)",
                background: "var(--surface)",
                border: "none",
                boxShadow: "var(--shadow-xl)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
            <div>
              <p style={{ margin: 0, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                {selectedTechnician.name} · {selectedTechnician.role}
              </p>
              <h3 id="clocking-modal-title" style={{ margin: "6px 0 4px", fontSize: "1.3rem", color: "var(--primary-dark)" }}>
                Clocking control
              </h3>
              {!modalTechClockedIn && <div style={{ height: "8px" }} />}
            </div>

            {modalError && (
              <div
                style={{
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  border: "1px solid var(--danger)",
                  background: "var(--danger-surface)",
                  color: "var(--danger-dark)",
                  fontSize: "0.85rem",
                }}
              >
                {modalError}
              </div>
            )}

            {modalTechClockedIn ? (
              <div
                style={{
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: "var(--surface-light)",
                  padding: "16px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--info)" }}>
                  <span style={{ fontWeight: 600 }}>Job number</span>
                  <span>{selectedTechnician.jobNumber || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--info)" }}>
                  <span style={{ fontWeight: 600 }}>Time on job</span>
                  <span>{selectedTechnician.timeOnActivity}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--info)" }}>
                  <span style={{ fontWeight: 600 }}>Status</span>
                  <span>{selectedTechnician.status}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label htmlFor={jobNumberInputId} style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                  Job number
                </label>
                <input
                  id={jobNumberInputId}
                  type="text"
                  value={modalJobNumber}
                  onChange={(event) => setModalJobNumber(event.target.value)}
                  placeholder="job number"
                  style={{
                    width: "100%",
                    borderRadius: "var(--control-radius)",
                    border: "none",
                    background: "var(--control-bg)",
                    padding: "var(--control-padding)",
                    fontSize: "var(--control-font-size)",
                    color: "var(--text-primary)",
                    minHeight: "var(--control-height)",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                className="clocking-modal-btn-secondary"
                onClick={closeClockModal}
                style={{
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  border: "none",
                  background: "rgba(var(--primary-rgb), 0.08)",
                  color: "var(--primary-dark)",
                  fontSize: "var(--control-font-size)",
                  fontWeight: 600,
                  minHeight: "var(--control-height)",
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="clocking-modal-btn-primary"
                onClick={modalTechClockedIn ? handleClockOutSubmit : handleClockInSubmit}
                disabled={modalActionDisabled}
                style={{
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--text-inverse)",
                  fontSize: "var(--control-font-size)",
                  fontWeight: 600,
                  minHeight: "var(--control-height)",
                  cursor: modalActionDisabled ? "not-allowed" : "pointer",
                  opacity: modalActionDisabled ? 0.7 : 1,
                }}
              >
                {modalActionLabel}
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
      <style jsx>{`
        #${jobNumberInputId}::placeholder {
          color: var(--grey-accent);
          opacity: 1;
        }
        :global([data-theme="dark"]) .clocking-modal-overlay {
          background: rgba(10, 10, 10, 0.8);
        }
        :global(:not([data-theme="dark"])) .clocking-modal-overlay {
          background: rgba(50, 50, 50, 0.45);
        }
        :global(.clocking-status-pill),
        :global(.clocking-status-pill:hover),
        :global(.clocking-status-pill:active) {
          transform: none !important;
          box-shadow: none !important;
        }
        :global(.clocking-modal-btn-secondary),
        :global(.clocking-modal-btn-secondary:hover) {
          background: rgba(var(--primary-rgb), 0.08) !important;
          color: var(--primary-dark) !important;
          border: none !important;
          transform: none !important;
          box-shadow: none !important;
        }
        :global(.clocking-modal-btn-secondary:hover) {
          background: rgba(var(--primary-rgb), 0.14) !important;
        }
        :global(.clocking-modal-btn-primary),
        :global(.clocking-modal-btn-primary:hover) {
          transform: none !important;
          box-shadow: none !important;
        }
        :global(.clocking-modal-btn-primary:hover) {
          background: var(--primary-light) !important;
        }
      `}</style>
    </div>
  );
}

export default function ClockingPage() {
  const [pageTab, setPageTab] = useState("overview");

  const pageTabStyle = (isActive) => ({
    padding: "var(--control-padding)",
    borderRadius: "var(--control-radius)",
    border: "none",
    background: isActive ? "var(--primary)" : "transparent",
    color: isActive ? "var(--text-inverse)" : "var(--primary-dark)",
    fontWeight: 600,
    fontSize: "var(--control-font-size)",
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease",
    minHeight: "var(--control-height)",
    transform: "none",
    boxShadow: "none",
  });

  return (
    <Layout>
      <div style={{ background: "var(--background)", minHeight: "100vh", padding: "40px 0" }}>
        <div className="mx-auto w-full max-w-none space-y-6 px-4 sm:px-6 lg:px-10">
          {/* Page-level tabs: Overview | Efficiency */}
          <div className="clocking-tab-bar" style={{
            display: "inline-flex",
            gap: "12px",
            padding: "8px",
            borderRadius: "var(--control-radius)",
            background: "var(--tab-container-bg)",
            border: "none",
          }}>
            <button type="button" style={pageTabStyle(pageTab === "overview")} onClick={() => setPageTab("overview")}>
              Overview
            </button>
            <button type="button" style={pageTabStyle(pageTab === "efficiency")} onClick={() => setPageTab("efficiency")}>
              Efficiency
            </button>
          </div>

          {pageTab === "overview" && <ClockingOverviewTab />}
          {pageTab === "efficiency" && <EfficiencyTab editable={false} />}
        </div>
      </div>
      <style jsx>{`
        .clocking-tab-bar button {
          transform: none !important;
          box-shadow: none !important;
        }
        .clocking-tab-bar button:hover {
          transform: none !important;
          box-shadow: none !important;
          filter: brightness(1.08);
        }
      `}</style>
    </Layout>
  );
}
