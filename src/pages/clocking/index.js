// file: src/pages/clocking/index.js
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";

const TECH_ROLES = ["Techs", "Technician", "Technician Lead", "Lead Technician"];
const MOT_ROLES = ["MOT Tester", "Tester"];
const TARGET_ROLES = [...new Set([...TECH_ROLES, ...MOT_ROLES])];

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

function ClockingDashboard() {
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workshop clocking
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Technicians & MOT Testers
          </h1>
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

export default function ClockingPage() {
  return (
    <Layout>
      <div className="p-6">
        <ClockingDashboard />
      </div>
    </Layout>
  );
}
