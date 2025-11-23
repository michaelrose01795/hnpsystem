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
  "In Progress": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Waiting for Job": "border-sky-200 bg-sky-50 text-sky-800",
  "Tea Break": "border-amber-200 bg-amber-50 text-amber-800",
  "On MOT": "border-purple-200 bg-purple-50 text-purple-800",
  "Not Clocked In": "border-slate-200 bg-slate-50 text-slate-700",
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

const getDurationMs = (startValue, endValue) => {
  if (!startValue) return 0;
  const startMs = new Date(startValue).getTime();
  if (Number.isNaN(startMs)) return 0;
  const endMs = endValue ? new Date(endValue).getTime() : Date.now();
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, endMs - startMs);
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

const deriveStatus = (jobEntry, timeRecord, referenceTime) => {
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
    status: "Not Clocked In",
    duration: 0,
    jobNumber: null,
  };
};

function ClockingOverviewTab() {
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
          referenceTime
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

      setTeamStatus(prepared);
      setError("");
    } catch (err) {
      console.error("Failed to load clocking dashboard", err);
      setError(err?.message || "Unable to load clocking data.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Live overview
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
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
              No technicians or MOT testers were found in the clocking system.
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
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
    return latestByUser.map((record) => {
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
  }, [latestByUser]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

  const renderedTab = useMemo(() => {
    switch (activeTab) {
      case "tech":
        return <TechnicianClockingTab />;
      case "controller":
        return <ControllerClockingTab />;
      default:
        return <ClockingOverviewTab />;
    }
  }, [activeTab]);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workshop clocking
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Unified clocking workspace
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
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

        {renderedTab}
      </div>
    </Layout>
  );
}
