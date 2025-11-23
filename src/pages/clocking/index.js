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
  "In Progress": "bg-emerald-50 border-emerald-200 text-emerald-800",
  "Waiting for Job": "bg-sky-50 border-sky-200 text-sky-800",
  "Tea Break": "bg-amber-50 border-amber-200 text-amber-800",
  "On MOT": "bg-purple-50 border-purple-200 text-purple-800",
  "Not Clocked In": "bg-slate-50 border-slate-200 text-slate-700",
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

      setTeamStatus(prepared);
      setError("");

      if (onSummaryChange) {
        onSummaryChange({
          total: prepared.length,
          inProgress: prepared.filter((tech) => tech.status === "In Progress").length,
          onMot: prepared.filter((tech) => tech.status === "On MOT").length,
          teaBreak: prepared.filter((tech) => tech.status === "Tea Break").length,
          waiting: prepared.filter((tech) => tech.status === "Waiting for Job").length,
          notClocked: prepared.filter((tech) => tech.status === "Not Clocked In").length,
          lastUpdated: new Date().toISOString(),
        });
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

  const statusHeader = loading ? "Updating…" : "Live";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workshop clocking
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Technicians & MOT Testers
          </h2>
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-wide ${
            loading ? "text-rose-600" : "text-emerald-600"
          }`}
        >
          {statusHeader}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && teamStatus.length === 0 ? (
        <p className="text-sm text-slate-500">Loading live clocking…</p>
      ) : (
        <>
          {teamStatus.length === 0 ? (
            <p className="text-sm text-slate-500">
              No technicians or MOT testers are currently clocked in.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teamStatus.map((tech) => (
                <Link
                  key={tech.userId}
                  href={`/clocking/${tech.userId}`}
                  className="group block h-full"
                >
                  <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {tech.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {tech.role}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${STATUS_STYLES[tech.status]}`}
                      >
                        {tech.status}
                      </span>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Current job
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {(tech.status === "In Progress" || tech.status === "On MOT") &&
                          tech.jobNumber
                            ? tech.jobNumber
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Time on activity
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {tech.timeOnActivity}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.65rem] text-slate-600">
                        {tech.role}
                      </span>
                      <span className="text-[0.65rem] text-slate-400">Tap for details</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
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
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
          className="rounded-full border border-rose-100 bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workshop clocking
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">
              Unified clocking workspace
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Track technicians, MOT testers, and service leaders across live shifts.
              Use the tabs to jump between the high-level overview, your own clocking,
              or a controller-style roster summary.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-transparent bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {CLOCKING_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 min-w-[140px] rounded-2xl px-4 py-2 text-sm font-semibold transition md:flex-none ${
                        activeTab === tab.key
                          ? "border border-rose-600 bg-rose-600 text-white shadow-lg"
                          : "border border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {renderedTab}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status snapshot
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mt-2">
                  {overviewStats?.total ?? 0} technicians tracked
                </h2>
                <div className="mt-4 grid gap-3">
                  {[
                    { label: "In progress", value: overviewStats?.inProgress ?? 0 },
                    { label: "On MOT", value: overviewStats?.onMot ?? 0 },
                    { label: "Tea Breaks", value: overviewStats?.teaBreak ?? 0 },
                    { label: "Waiting", value: overviewStats?.waiting ?? 0 },
                    { label: "Offline", value: overviewStats?.notClocked ?? 0 },
                  ].map((line) => (
                    <div key={line.label} className="flex items-center justify-between text-sm text-slate-600">
                      <span>{line.label}</span>
                      <span className="font-semibold text-slate-900">{line.value}</span>
                    </div>
                  ))}
                </div>
                {overviewStats?.lastUpdated && (
                  <p className="mt-4 text-xs text-slate-500">
                    Last refreshed at{" "}
                    {new Date(overviewStats.lastUpdated).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status legend
                </p>
                <div className="mt-4 space-y-2">
                  {legendRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2 text-sm font-semibold text-slate-600"
                    >
                      <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-semibold tracking-wide ${row.style}`}
                      >
                        {row.label}
                      </div>
                      <span className="text-xs text-slate-400">Live</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  The legend mirrors the overview cards so you can quickly scan statuses across the team.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
