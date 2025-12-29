// file location: src/components/JobCards/ClockingHistorySection.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
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

const calculateDurationHours = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = endDate.getTime() - startDate.getTime();
  if (diff <= 0) return null;
  return Number((diff / (1000 * 60 * 60)).toFixed(2));
};

const parseRequestSnapshot = (raw) => {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.requestLabel) {
        return {
          requestLabel: parsed.requestLabel,
          requestKey: parsed.requestKey || null,
          requestTitle: parsed.requestTitle || parsed.requestLabel
        };
      }
    } catch (_error) {
      // fall through
    }
  }
  return null;
};

export default function ClockingHistorySection({
  jobId,
  jobNumber,
  requests = [],
  jobAllocatedHours = null,
  refreshSignal = 0,
  enableRequestClick = false,
  onRequestClick,
  title = "Clocking history"
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchEntries = useCallback(async () => {
    if (!jobId) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("time_records")
        .select(`
          id,
          user_id,
          job_id,
          job_number,
          date,
          clock_in,
          clock_out,
          hours_worked,
          notes,
          created_at,
          updated_at,
          users:user_id(
            user_id,
            first_name,
            last_name
          )
        `)
        .eq("job_id", jobId)
        .order("clock_in", { ascending: false });

      if (queryError) {
        throw queryError;
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        technicianName: `${row.users?.first_name || ""} ${row.users?.last_name || ""}`.trim() || "Unknown",
        jobNumber: row.job_number || "",
        clockIn: row.clock_in,
        clockOut: row.clock_out,
        hoursWorked: row.hours_worked !== null && row.hours_worked !== undefined ? Number(row.hours_worked) : null,
        notes: row.notes || "",
        raw: row
      }));

      setEntries(mapped);
    } catch (err) {
      console.error("❌ Failed to load job clocking history:", err);
      setError(err?.message || "Unable to load clocking entries.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setEntries([]);
      return;
    }
    fetchEntries();
  }, [jobId, fetchEntries, refreshSignal]);

  useEffect(() => {
    if (!jobId) return;
    const channelName = `job-clock-history-${jobId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_records",
          filter: `job_id=eq.${jobId}`
        },
        () => {
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchEntries]);

  const requestMap = useMemo(() => {
    const map = new Map();
    (requests || []).forEach((request) => {
      if (request?.key) {
        map.set(request.key, request);
      }
    });
    return map;
  }, [requests]);

  const fallbackJobHours = useMemo(() => {
    if (typeof jobAllocatedHours === "number" && !Number.isNaN(jobAllocatedHours)) {
      return jobAllocatedHours;
    }
    const total = (requests || []).reduce((sum, request) => {
      const hours = Number(request?.hours) || 0;
      return sum + hours;
    }, 0);
    return total > 0 ? Number(total.toFixed(2)) : null;
  }, [jobAllocatedHours, requests]);

  const derivedRows = useMemo(() => {
    return entries.map((entry) => {
      const snapshot = parseRequestSnapshot(entry.notes);
      const requestKey = snapshot?.requestKey || null;
      const requestDefinition = requestKey ? requestMap.get(requestKey) : null;
      const isJobLevel = !snapshot?.requestKey || snapshot.requestKey === "job";
      const baseLabel = snapshot?.requestLabel || `Job #${entry.jobNumber || jobNumber || ""}`.trim();
      const requestLabel = baseLabel || `Job #${jobNumber || entry.jobNumber || ""}`;
      const requestTitle = snapshot?.requestTitle || requestDefinition?.title || requestLabel;
      const requestHours =
        requestDefinition?.hours !== null && requestDefinition?.hours !== undefined
          ? Number(requestDefinition.hours)
          : isJobLevel
          ? fallbackJobHours
          : null;
      const durationHours =
        entry.hoursWorked !== null && entry.hoursWorked !== undefined && !Number.isNaN(entry.hoursWorked)
          ? Number(entry.hoursWorked)
          : calculateDurationHours(entry.clockIn, entry.clockOut);

      return {
        id: entry.id,
        technicianName: entry.technicianName,
        requestLabel,
        requestTitle,
        requestHours: requestHours !== null && !Number.isNaN(requestHours) ? Number(requestHours.toFixed(2)) : null,
        requestKey: requestKey || (isJobLevel ? "job" : null),
        dateOn: formatDate(entry.clockIn),
        timeOn: formatTime(entry.clockIn),
        dateOff: formatDate(entry.clockOut),
        timeOff: formatTime(entry.clockOut),
        timeTaken: durationHours !== null && !Number.isNaN(durationHours) ? Number(durationHours.toFixed(2)) : null,
        rawEntry: entry
      };
    });
  }, [entries, requestMap, fallbackJobHours, jobNumber]);

  const shouldScroll = derivedRows.length > 5;
  const bodyMaxHeight = shouldScroll ? "345px" : "auto";

  return (
    <section
      style={{
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid var(--surface-light)",
        backgroundColor: "var(--surface-light)",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "var(--grey-accent)" }}>
            All live clocking and manual entries linked to Job #{jobNumber || "—"}.
          </p>
        </div>
        {loading && (
          <span style={{ fontSize: "0.85rem", color: "var(--grey-accent)" }}>
            Updating…
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            borderRadius: "10px",
            border: "1px solid var(--danger)",
            backgroundColor: "var(--danger-surface)",
            color: "var(--danger-dark)",
            padding: "10px 14px",
            fontSize: "0.9rem"
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          borderRadius: "10px",
          border: "1px solid var(--surface-light)",
          overflow: "hidden"
        }}
      >
        <div style={{ width: "100%", overflowX: "auto" }}>
          <div style={{ maxHeight: bodyMaxHeight, overflowY: shouldScroll ? "auto" : "visible" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  {[
                    "Tech name",
                    "Request",
                    "Date on",
                    "Time on",
                    "Date off",
                    "Time off",
                    "Time taken",
                    "Time allocated"
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "var(--surface-light)",
                        borderBottom: "1px solid var(--surface-light)",
                        textAlign: "left",
                        fontSize: "0.75rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--grey-accent)",
                        padding: "12px 14px",
                        zIndex: 2
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && derivedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "16px", textAlign: "center", color: "var(--grey-accent)" }}>
                      Loading clocking entries…
                    </td>
                  </tr>
                ) : derivedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "16px", textAlign: "center", color: "var(--grey-accent)" }}>
                      No clocking entries recorded for this job yet.
                    </td>
                  </tr>
                ) : (
                  derivedRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)", fontWeight: 600 }}>
                        {row.technicianName}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid var(--surface-light)",
                          color: enableRequestClick ? "var(--primary)" : "var(--text-primary)",
                          fontWeight: enableRequestClick ? 600 : 500,
                          cursor: enableRequestClick ? "pointer" : "default"
                        }}
                        onClick={() => {
                          if (enableRequestClick && typeof onRequestClick === "function") {
                            onRequestClick({
                              requestLabel: row.requestLabel,
                              requestKey: row.requestKey,
                              requestTitle: row.requestTitle,
                              requestHours: row.requestHours,
                              technicianName: row.technicianName,
                              entryId: row.id
                            });
                          }
                        }}
                      >
                        {row.requestLabel}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)" }}>{row.dateOn}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)" }}>{row.timeOn}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)" }}>{row.dateOff}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)" }}>{row.timeOff}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)" }}>
                        {row.timeTaken !== null ? `${row.timeTaken.toFixed(2)}h` : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--surface-light)" }}>
                        {row.requestHours !== null ? `${row.requestHours.toFixed(2)}h` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
