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
  const [requestsAllocatedTotal, setRequestsAllocatedTotal] = useState(null);

  const fetchEntries = useCallback(async () => {
    if (!jobId) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("job_clocking")
        .select(`
          id,
          user_id,
          job_id,
          job_number,
          clock_in,
          clock_out,
          work_type,
          request_id,
          created_at,
          updated_at,
          users:user_id(
            user_id,
            first_name,
            last_name
          ),
          request:request_id(
            request_id,
            description,
            hours,
            sort_order
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
        requestId: row.request_id ?? null,
        requestDescription: row.request?.description || "",
        requestHours:
          row.request?.hours !== null && row.request?.hours !== undefined
            ? Number(row.request.hours)
            : null,
        requestSortOrder:
          row.request?.sort_order !== null && row.request?.sort_order !== undefined
            ? Number(row.request.sort_order)
            : null,
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
    if (!jobId) {
      setRequestsAllocatedTotal(null);
      return;
    }
    let isMounted = true;
    const loadAllocatedTotal = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("job_requests")
          .select("hours")
          .eq("job_id", jobId);
        if (queryError) throw queryError;
        const total = (data || []).reduce((sum, row) => {
          const hours = Number(row?.hours);
          return Number.isFinite(hours) ? sum + hours : sum;
        }, 0);
        if (isMounted) {
          setRequestsAllocatedTotal(total > 0 ? Number(total.toFixed(2)) : null);
        }
      } catch (err) {
        console.error("Failed to load allocated hours total:", err);
        if (isMounted) {
          setRequestsAllocatedTotal(null);
        }
      }
    };
    loadAllocatedTotal();
    return () => {
      isMounted = false;
    };
  }, [jobId]);

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
          table: "job_clocking",
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

  const totalAllocatedForRequests = useMemo(() => {
    if (typeof requestsAllocatedTotal === "number" && !Number.isNaN(requestsAllocatedTotal)) {
      return requestsAllocatedTotal;
    }
    return null;
  }, [requestsAllocatedTotal]);

  const derivedRows = useMemo(() => {
    return entries.map((entry) => {
      const hasRequest = Boolean(entry.requestId);
      const requestIndex = hasRequest
        ? entry.requestSortOrder !== null && !Number.isNaN(entry.requestSortOrder)
          ? entry.requestSortOrder
          : entry.requestId
        : null;
      const baseJobNumber = entry.jobNumber || jobNumber || "";
      const requestLabel = hasRequest
        ? `Req ${requestIndex}: ${baseJobNumber}`.trim()
        : `Job: ${baseJobNumber}`.trim();
      const requestTitle = requestLabel;
      const requestHours =
        entry.requestHours !== null && entry.requestHours !== undefined
          ? entry.requestHours
          : hasRequest
          ? null
          : fallbackJobHours;
      const durationHours =
        calculateDurationHours(entry.clockIn, entry.clockOut);

      return {
        id: entry.id,
        technicianName: entry.technicianName,
        requestLabel,
        requestTitle,
        requestHours: requestHours !== null && !Number.isNaN(requestHours) ? Number(requestHours.toFixed(2)) : null,
        requestKey: hasRequest ? String(entry.requestId) : "job",
        dateOn: formatDate(entry.clockIn),
        timeOn: formatTime(entry.clockIn),
        dateOff: formatDate(entry.clockOut),
        timeOff: formatTime(entry.clockOut),
        timeTaken: durationHours !== null && !Number.isNaN(durationHours) ? Number(durationHours.toFixed(2)) : null,
        rawEntry: entry
      };
    });
  }, [entries, fallbackJobHours, jobNumber]);

  const shouldScroll = derivedRows.length > 5;
  const rowHeight = 48;
  const headerHeight = 44;
  const bodyMaxHeight = shouldScroll ? `${rowHeight * 5 + headerHeight}px` : "auto";

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
              {derivedRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "12px 14px",
                        borderTop: "1px solid var(--surface-light)",
                        fontWeight: 600,
                        textAlign: "right",
                        color: "var(--grey-accent)"
                      }}
                    >
                      Totals
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderTop: "1px solid var(--surface-light)",
                        fontWeight: 600,
                        color: "var(--text-primary)"
                      }}
                    >
                      <div>
                        Requests total: {totalAllocatedForRequests !== null ? `${totalAllocatedForRequests.toFixed(2)}h` : "—"}
                      </div>
                      <div>
                        Job total: {fallbackJobHours !== null ? `${Number(fallbackJobHours).toFixed(2)}h` : "—"}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
