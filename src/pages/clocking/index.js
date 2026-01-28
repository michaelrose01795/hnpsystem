"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { clockInToJob, clockOutFromJob } from "@/lib/database/jobClocking";
import { generateTechnicianSlug } from "@/utils/technicianSlug";
import ModalPortal from "@/components/popups/ModalPortal";

const TECH_ROLES = ["Techs", "Technician", "Technician Lead", "Lead Technician"];
const MOT_ROLES = ["MOT Tester", "Tester"];
const TARGET_ROLES = [...new Set([...TECH_ROLES, ...MOT_ROLES])];
const TARGET_ROLE_SET = new Set(TARGET_ROLES.map((role) => role.toLowerCase()));
const MOT_ROLE_SET = new Set(MOT_ROLES.map((role) => role.toLowerCase()));

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

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Summary Stats Section */}
      <section
        style={{
          background: "var(--surface)",
          borderRadius: "18px",
          padding: "24px",
          border: "1px solid var(--surface-light)",
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
                borderRadius: "18px",
                padding: "16px",
                background: "var(--danger-surface)",
                border: "1px solid var(--surface-light)",
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
              <strong style={{ fontSize: "1.8rem", color: "var(--primary-dark)" }}>
                {summaryStats.total}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                All technicians
              </span>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px",
                background: "var(--danger-surface)",
                border: "1px solid var(--success)22",
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
              <strong style={{ fontSize: "1.8rem", color: "var(--success)" }}>
                {summaryStats.inProgress}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                Active on jobs
              </span>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px",
                background: "var(--danger-surface)",
                border: "1px solid var(--info)22",
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
              <strong style={{ fontSize: "1.8rem", color: "var(--info)" }}>
                {summaryStats.onMot}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                On MOT tests
              </span>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px",
                background: "var(--danger-surface)",
                border: "1px solid var(--accent-purple)22",
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
              <strong style={{ fontSize: "1.8rem", color: "var(--accent-purple)" }}>
                {summaryStats.teaBreak}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                On break
              </span>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px",
                background: "var(--danger-surface)",
                border: "1px solid var(--primary)22",
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
              <strong style={{ fontSize: "1.8rem", color: "var(--primary)" }}>
                {summaryStats.waiting}
              </strong>
              <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                Awaiting jobs
              </span>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px",
                background: "var(--danger-surface)",
                border: "1px solid var(--grey-accent)22",
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
              <strong style={{ fontSize: "1.8rem", color: "var(--grey-accent)" }}>
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
            borderRadius: "14px",
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
          borderRadius: "18px",
          padding: "24px",
          border: "1px solid var(--surface-light)",
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
              borderRadius: "14px",
              padding: "32px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
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
              const buttonPalette =
                tech.status === "Not Clocked In"
                  ? {
                      background: "var(--danger-surface)",
                      border: "1px solid var(--danger-dark)",
                      color: "var(--danger-dark)",
                    }
                  : {
                      background: "var(--success-surface)",
                      border: "1px solid var(--success)",
                      color: "var(--success-dark)",
                    };

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
                      borderRadius: "18px",
                      padding: "20px",
                      background: "var(--background)",
                      border: "1px solid var(--surface-light)",
                      boxShadow: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      height: "100%",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
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
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: "8px",
                            padding: "6px 12px",
                            borderRadius: "999px",
                            border: "1px solid var(--surface-light)",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--info)",
                            background: "var(--surface)",
                          }}
                        >
                          {tech.role}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        {showClockButton ? (
                          <>
                            <button
                              type="button"
                              onClick={handleClockButtonClick}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                background: buttonPalette.background,
                                border: buttonPalette.border,
                                color: buttonPalette.color,
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
                              padding: "6px 12px",
                              borderRadius: "10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              color: "#334155",
                              ...(tech.status === "Tea Break" && {
                                background: "#fef3c7",
                                border: "1px solid #fcd34d",
                                color: "#92400e",
                              }),
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
                        borderRadius: "12px",
                        padding: "12px",
                        background: "var(--surface)",
                        border: "1px solid var(--surface-light)",
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
                        borderRadius: "12px",
                        padding: "12px",
                        background: "var(--surface)",
                        border: "1px solid var(--surface-light)",
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
                        padding: "8px 14px",
                        borderRadius: "999px",
                        background: "var(--primary)",
                        color: "var(--surface)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              zIndex: 50,
              backdropFilter: "blur(4px)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clocking-modal-title"
          >
            <div
              style={{
                width: "min(460px, 100%)",
                borderRadius: "22px",
                background: "var(--surface)",
                border: "1px solid var(--surface-light)",
                boxShadow: "0 25px 60px rgba(15, 15, 15, 0.25)",
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
                  borderRadius: "14px",
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
                  borderRadius: "16px",
                  border: "1px solid var(--surface-light)",
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
                    borderRadius: "14px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface-light)",
                    padding: "12px",
                    fontSize: "0.95rem",
                    color: "var(--info)",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={closeClockModal}
                style={{
                  padding: "10px 18px",
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface)",
                  color: "var(--info)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={modalTechClockedIn ? handleClockOutSubmit : handleClockInSubmit}
                disabled={modalActionDisabled}
                style={{
                  padding: "10px 18px",
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--surface)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
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
      `}</style>
    </div>
  );
}

export default function ClockingPage() {
  return (
    <Layout>
      <div className="bg-slate-50 py-10">
        <div className="mx-auto w-full max-w-none space-y-6 px-4 sm:px-6 lg:px-10">
          <ClockingOverviewTab />
        </div>
      </div>
    </Layout>
  );
}
