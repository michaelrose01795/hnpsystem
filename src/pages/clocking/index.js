"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { clockIn as clockInRecord, clockOut as clockOutRecord } from "@/lib/database/clocking";
import { supabase } from "@/lib/supabaseClient";

const TECH_ROLES = ["Techs", "Technician", "Technician Lead", "Lead Technician"];
const MOT_ROLES = ["MOT Tester", "Tester"];
const TARGET_ROLES = [...new Set([...TECH_ROLES, ...MOT_ROLES])];
const TARGET_ROLE_SET = new Set(TARGET_ROLES.map((role) => role.toLowerCase()));

const STATUS_STYLES = {
  "In Progress": "bg-emerald-100 border-emerald-300 text-emerald-800",
  "Waiting for Job": "bg-slate-100 border-slate-300 text-slate-700",
  "Tea Break": "bg-amber-100 border-amber-300 text-amber-800",
  "On MOT": "bg-sky-100 border-sky-300 text-sky-800",
  "Not Clocked In": "bg-slate-100 border-slate-300 text-slate-600",
};

const STATUS_LEGEND_ORDER = [
  "In Progress",
  "On MOT",
  "Tea Break",
  "Waiting for Job",
  "Not Clocked In",
];

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
    return "0m";
  }
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes) {
    parts.push(`${minutes}m`);
  }
  if (!parts.length) {
    parts.push("0m");
  }
  return parts.join(" ");
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
    };
  }

  return {
    status: hasClocked ? "Waiting for Job" : "Not Clocked In",
    duration: 0,
    jobNumber: null,
  };
};

function ClockingOverviewTab({ onSummaryChange }) {
  const [teamStatus, setTeamStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

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
            user_id,
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
        const { status, duration, jobNumber } = deriveStatus(
          jobEntry,
          timeRecord,
          referenceTime,
          clockedUserIds.has(user.user_id)
        );

        return {
          userId: user.user_id,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unnamed",
          role: user.role || "Tech",
          status,
          jobNumber,
          timeOnActivity: duration > 0 ? formatDuration(duration) : "—",
        };
      });

      prepared.sort((a, b) => a.name.localeCompare(b.name));

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

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Header */}
      <header
        style={{
          borderRadius: "18px",
          padding: "24px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface)",
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontSize: "0.78rem",
            color: "var(--primary-dark)",
          }}
        >
          Workshop Operations
        </span>
        <h1 style={{ margin: 0, fontSize: "1.8rem", color: "var(--danger-dark)" }}>
          Live Workshop Overview
        </h1>
        <p style={{ margin: 0, color: "var(--info)" }}>
          Real-time technician status and activity feed
        </p>
      </header>

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
          <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
            Live technician activity and job assignments
          </p>
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
            {teamStatus.map((tech) => (
              <Link
                key={tech.userId}
                href={`/clocking/${tech.userId}`}
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "var(--primary-dark)" }}>
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
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        ...(tech.status === "In Progress" && {
                          background: "#d1fae5",
                          border: "1px solid #6ee7b7",
                          color: "#065f46",
                        }),
                        ...(tech.status === "On MOT" && {
                          background: "#dbeafe",
                          border: "1px solid #7dd3fc",
                          color: "#075985",
                        }),
                        ...(tech.status === "Tea Break" && {
                          background: "#fef3c7",
                          border: "1px solid #fcd34d",
                          color: "#92400e",
                        }),
                        ...(tech.status === "Waiting for Job" && {
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          color: "#334155",
                        }),
                        ...(tech.status === "Not Clocked In" && {
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          color: "#64748b",
                        }),
                      }}
                    >
                      {tech.status}
                    </span>
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
            ))}
          </div>
        )}
      </section>

      {/* Status Snapshot Summary Section */}
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
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--info)",
              fontWeight: 600,
            }}
          >
            Status Snapshot Summary
          </p>
          <h3 style={{ margin: "6px 0 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--primary-dark)" }}>
            {summaryStats.total} technicians monitored
          </h3>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
          }}
        >
          <div
            style={{
              borderRadius: "14px",
              padding: "14px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--info)" }}>
              Technicians
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 600, color: "var(--primary-dark)" }}>
              {summaryStats.total}
            </p>
          </div>

          <div
            style={{
              borderRadius: "14px",
              padding: "14px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--info)" }}>
              In Progress
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 600, color: "var(--success)" }}>
              {summaryStats.inProgress}
            </p>
          </div>

          <div
            style={{
              borderRadius: "14px",
              padding: "14px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--info)" }}>
              On MOT
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 600, color: "var(--info)" }}>
              {summaryStats.onMot}
            </p>
          </div>

          <div
            style={{
              borderRadius: "14px",
              padding: "14px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--info)" }}>
              Tea Break
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 600, color: "var(--accent-purple)" }}>
              {summaryStats.teaBreak}
            </p>
          </div>

          <div
            style={{
              borderRadius: "14px",
              padding: "14px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--info)" }}>
              Waiting
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 600, color: "var(--primary)" }}>
              {summaryStats.waiting}
            </p>
          </div>

          <div
            style={{
              borderRadius: "14px",
              padding: "14px",
              background: "var(--danger-surface)",
              border: "1px solid var(--surface-light)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--info)" }}>
              Offline
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 600, color: "var(--grey-accent)" }}>
              {summaryStats.notClocked}
            </p>
          </div>
        </div>

        <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--info)" }}>
          Last refreshed {formattedLastUpdated}. Figures update automatically from the live clocking feed.
        </p>
      </section>
    </div>
  );
}

function TechnicianClockingTab() {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("time_records")
        .select("id, job_number, clock_in, clock_out, notes, work_type")
        .eq("user_id", userId)
        .eq("date", today)
        .order("clock_in", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Failed to load technician entries", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase.channel(`clocking-tech-${userId}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_records",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchEntries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries, userId]);

  const activeEntry = entries.find((entry) => !entry.clock_out);
  const status = deriveStatus(null, activeEntry, Date.now()).status;

  const handleToggle = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      if (activeEntry) {
        await clockOutRecord(userId);
      } else {
        await clockInRecord(userId);
      }
    } catch (err) {
      console.error("Failed to toggle clocking", err);
    } finally {
      setBusy(false);
      fetchEntries();
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 ">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Technician clocking
          </p>
          <h2 className="text-lg font-semibold text-slate-900">My log for today</h2>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current status</p>
          <p className="text-sm font-semibold text-slate-900">{status}</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={!userId || busy}
          className="rounded-full border border-rose-100 bg-rose-600 px-4 py-2 text-sm font-semibold text-white  transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : activeEntry ? "Clock Out" : "Clock In"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading your entries…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No clocking records for today.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((record) => (
            <div
              key={record.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>{deriveStatus(null, record, Date.now()).status}</span>
                <span>{record.work_type?.toUpperCase() || "INITIAL"}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-4">
                <span className="text-sm font-semibold text-slate-900">
                  {record.job_number || "General shift"}
                </span>
                <span className="text-xs text-slate-500">
                  {formatTime(record.clock_in)} – {formatTime(record.clock_out)}
                </span>
                <span className="text-xs text-slate-500">
                  Duration: {formatDuration(getDurationMs(record.clock_in, record.clock_out))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ControllerClockingTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchControllerRecords = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("time_records")
        .select(`
          id,
          user_id,
          job_number,
          clock_in,
          clock_out,
          notes,
          user:user_id(
            user_id,
            first_name,
            last_name,
            role
          )
        `)
        .eq("date", today)
        .order("clock_in", { ascending: false });

      if (error) throw error;

      const filtered = (data || []).filter((record) => {
        const role = (record?.user?.role || "").toLowerCase();
        return TARGET_ROLE_SET.has(role);
      });

      setRecords(filtered);
    } catch (err) {
      console.error("Failed to load controller clocking data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchControllerRecords();
  }, [fetchControllerRecords]);

  useEffect(() => {
    const channel = supabase.channel("clocking-controller");
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_records" },
        () => fetchControllerRecords()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchControllerRecords]);

  const latestByUser = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      const existing = map.get(record.user_id);
      const candidateTime = new Date(record.clock_in || 0).getTime();
      const existingTime = existing ? new Date(existing.clock_in || 0).getTime() : 0;
      if (!existing || candidateTime > existingTime) {
        map.set(record.user_id, record);
      }
    });
    return Array.from(map.values());
  }, [records]);

  const rows = useMemo(() => {
    const now = Date.now();
    const mapped = latestByUser.map((record) => {
      const name = `${record.user?.first_name || ""} ${record.user?.last_name || ""}`.trim() || `ID ${record.user_id}`;
      const status = deriveStatus(null, record, now).status;
      return {
        id: record.id,
        name,
        role: record.user?.role || "Tech",
        jobNumber: record.job_number || "—",
        clockIn: formatTime(record.clock_in),
        clockOut: formatTime(record.clock_out),
        duration: formatDuration(getDurationMs(record.clock_in, record.clock_out)),
        status,
      };
    });

    const orderMap = STATUS_LEGEND_ORDER.reduce((acc, value, index) => {
      acc[value] = index;
      return acc;
    }, {});

    return mapped.sort((a, b) => {
      const diff = (orderMap[a.status] ?? 999) - (orderMap[b.status] ?? 999);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [latestByUser]);

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 ">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Controller view
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Active time records
          </h2>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {rows.length} techs monitored
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading latest entries…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No active clocking entries for today.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Finish</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.role}</td>
                  <td className="px-4 py-3 text-slate-600">{row.status}</td>
                  <td className="px-4 py-3 text-slate-900">{row.jobNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{row.clockIn}</td>
                  <td className="px-4 py-3 text-slate-600">{row.clockOut}</td>
                  <td className="px-4 py-3 text-slate-600">{row.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CLOCKING_TABS = [
  { key: "overview", label: "Overview" },
  { key: "tech", label: "Technician Clocking" },
  { key: "controller", label: "Controller Clocking" },
];

export default function ClockingPage() {
  const [activeTab, setActiveTab] = useState(CLOCKING_TABS[0].key);
  const [overviewStats, setOverviewStats] = useState(null);

  const renderedTab = useMemo(() => {
    switch (activeTab) {
      case "tech":
        return <TechnicianClockingTab />;
      case "controller":
        return <ControllerClockingTab />;
      default:
        return <ClockingOverviewTab onSummaryChange={setOverviewStats} />;
    }
  }, [activeTab]);

  const legendRows = STATUS_LEGEND_ORDER.map((label) => ({
    label,
    style: STATUS_STYLES[label],
  }));

  return (
    <Layout>
      <div className="bg-slate-50 py-10">
        <div className="mx-auto w-full max-w-none space-y-6 px-4 sm:px-6 lg:px-10">
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-8 ">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-4xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Workshop clocking
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Unified clocking workspace
                </h1>
                <p className="text-base text-slate-500">
                  Monitor every technician and MOT tester from a single dashboard. Switch
                  tabs to deep dive into personal logs or controller grade records.
                </p>
                {overviewStats && (
                  <p className="text-sm text-slate-500">
                    Tracking {overviewStats.total} technicians · Last update {overviewStats.lastUpdated
                      ? new Date(overviewStats.lastUpdated).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {legendRows.map((row) => (
                  <span
                    key={row.label}
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold tracking-wide ${row.style}`}
                  >
                    {row.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-transparent bg-white p-4 ">
              <div className="flex flex-wrap gap-2">
                {CLOCKING_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 min-w-[160px] rounded-2xl px-4 py-2 text-sm font-semibold transition md:flex-none ${
                      activeTab === tab.key
                        ? "border border-rose-600 bg-rose-600 text-white "
                        : "border border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {renderedTab}
          </section>
        </div>
      </div>
    </Layout>
  );
}
