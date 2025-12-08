"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const STATUS_STATES = ["In Progress", "Tea Break", "Waiting for Job"];

const STATUS_BADGE_STYLES = {
  "In Progress": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Tea Break": "bg-amber-100 text-amber-800 border-amber-200",
  "Waiting for Job": "bg-slate-100 text-slate-700 border-slate-200",
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

export default function UserClockingHistory() {
  const router = useRouter();
  const userIdParam = router.query.userId;
  const numericUserId = useMemo(
    () => (userIdParam ? Number(userIdParam) : null),
    [userIdParam]
  );

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
        "aftersales manager",
      ]),
    []
  );
  const userRoles = currentUser?.roles?.map((role) => role.toLowerCase()) || [];
  const isManager = userRoles.some((role) => managerRoles.has(role));

  const [activeJobs, setActiveJobs] = useState([]);
  const [activeJobsLoading, setActiveJobsLoading] = useState(true);
  const [formJobNumber, setFormJobNumber] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [formStartTime, setFormStartTime] = useState("");
  const [formFinishTime, setFormFinishTime] = useState("");
  const [formStatus, setFormStatus] = useState("In Progress");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!numericUserId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: records, error: recordsError } = await supabase
        .from("time_records")
        .select("id, job_number, clock_in, clock_out, notes, work_type")
        .eq("user_id", numericUserId)
        .eq("date", today)
        .order("clock_in", { ascending: false });

      if (recordsError) {
        throw recordsError;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, role")
        .eq("user_id", numericUserId)
        .maybeSingle();

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
  }, [numericUserId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!numericUserId) return undefined;

    const channel = supabase.channel(`clocking-user-${numericUserId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_records",
          filter: `user_id=eq.${numericUserId}`,
        },
        () => fetchEntries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries, numericUserId]);

  const fetchActiveJobs = useCallback(async () => {
    setActiveJobsLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_clocking")
        .select("job_id, job_number")
        .is("clock_out", null);

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
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_clocking" },
        () => fetchActiveJobs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveJobs]);

  const handleJobNumberChange = (value) => {
    setFormJobNumber(value);
    const match =
      activeJobs.find(
        (job) => job.job_number?.toLowerCase() === (value || "").trim().toLowerCase()
      ) || null;
    setSelectedJobId(match?.job_id ?? null);
  };

  const resolveJobIdByNumber = useCallback(
    async (jobNumber) => {
      const normalized = jobNumber.trim();
      if (!normalized) return null;

      const existing = activeJobs.find(
        (job) => job.job_number?.toLowerCase() === normalized.toLowerCase()
      );
      if (existing) return existing.job_id;

      const { data, error } = await supabase
        .from("jobs")
        .select("id")
        .ilike("job_number", normalized)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.id ?? null;
    },
    [activeJobs]
  );

  const handleManualEntrySubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormError("");
      setFormSuccess("");

      if (!numericUserId) {
        setFormError("Unable to identify the user.");
        return;
      }

      if (!formStartTime || !formFinishTime) {
        setFormError("Start and finish times are required.");
        return;
      }

      const baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0);
      const startDate = buildDateFromTime(formStartTime, baseDate);
      const finishDate = buildDateFromTime(formFinishTime, startDate || baseDate);

      if (!startDate || !finishDate) {
        setFormError("Please provide valid time values.");
        return;
      }

      if (finishDate <= startDate) {
        finishDate.setDate(finishDate.getDate() + 1);
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
          setFormError("Unable to resolve job number.");
          return;
        }
        if (!jobIdForEntry) {
          setFormError("Job number not found in the system.");
          return;
        }
      }

      const dateString = startDate.toISOString().split("T")[0];
      const hoursWorked = Number((durationMs / (1000 * 60 * 60)).toFixed(2));

      setFormSubmitting(true);

      try {
        const { error: insertError } = await supabase.from("time_records").insert([
          {
            user_id: numericUserId,
            job_id: jobIdForEntry,
            job_number: jobNumberTrimmed || null,
            clock_in: startDate.toISOString(),
            clock_out: finishDate.toISOString(),
            date: dateString,
            hours_worked: hoursWorked,
            notes: formStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

        if (insertError) {
          throw insertError;
        }

        if (jobNumberTrimmed && jobIdForEntry) {
          const { error: jobClockingError } = await supabase.from("job_clocking").insert([
            {
              user_id: numericUserId,
              job_id: jobIdForEntry,
              job_number: jobNumberTrimmed,
              clock_in: startDate.toISOString(),
              clock_out: finishDate.toISOString(),
              work_type: "manual",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

          if (jobClockingError) {
            throw jobClockingError;
          }

          const { error: jobUpdateError } = await supabase
            .from("jobs")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", jobIdForEntry);

          if (jobUpdateError) {
            throw jobUpdateError;
          }
        }

        setFormSuccess("Clocking entry saved successfully.");
        setFormJobNumber("");
        setSelectedJobId(null);
        setFormStartTime("");
        setFormFinishTime("");
        setFormStatus("In Progress");
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
      numericUserId,
      formStartTime,
      formFinishTime,
      formJobNumber,
      formStatus,
      selectedJobId,
      fetchEntries,
      fetchActiveJobs,
      resolveJobIdByNumber,
    ]
  );

  const headerName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
    : `ID ${numericUserId || "?"}`;
  const liveRecord = entries.find((entry) => !entry.clock_out) || entries[0] || null;
  const currentStatus = liveRecord ? deriveStatus(liveRecord) : null;
  const todayLabel = new Date().toLocaleDateString("en-GB");

  return (
    <Layout>
      <div className="bg-slate-50 py-10">
        <div className="mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6 lg:px-10">
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 ">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Clocking history · Today
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">{headerName}</h1>
                {user?.role && (
                  <p className="text-sm font-medium text-slate-500">{user.role}</p>
                )}
              </div>
              <div className="flex flex-col items-start gap-3 text-sm text-slate-500 sm:items-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Today · {todayLabel}
                </span>
                {currentStatus?.status && (
                  <span
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold tracking-wide ${
                      STATUS_BADGE_STYLES[currentStatus.status] || "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {currentStatus.status}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Entries logged</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{entries.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Active jobs</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{activeJobs.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {currentStatus?.status || "Waiting for Job"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Live refresh</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {loading ? "Refreshing…" : "Live"}
                </p>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 ">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Entries for {todayLabel}
                </p>
                <p className="text-xs text-slate-500">
                  Ordered by most recent clock-in time, auto refreshed from Supabase.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {loading ? "Refreshing…" : "Live"}
              </span>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              <div className="max-h-[520px] overflow-y-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Job Number</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">Finish</th>
                      <th className="px-4 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">
                          No clocking entries recorded yet for today.
                        </td>
                      </tr>
                    ) : (
                      entries.map((record) => {
                        const status = deriveStatus(record);
                        const chip = STATUS_BADGE_STYLES[status];
                        return (
                          <tr key={record.id} className="border-b border-slate-100">
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                  chip || "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {STATUS_STATES.includes(status) ? status : "Waiting for Job"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              {record.job_number || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{formatTime(record.clock_in)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{formatTime(record.clock_out)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {formatDuration(record.clock_in, record.clock_out)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {isManager && (
            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 ">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Manager tools
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Add clocking entry</h2>
                <p className="text-sm text-slate-500">
                  Create manual entries for this technician. Entries are stored in the official time
                  records and linked to the job clocking log.
                </p>
              </div>

              {formError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleManualEntrySubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job number
                  </label>
                  <input
                    list="active-job-list"
                    value={formJobNumber}
                    onChange={(event) => handleJobNumberChange(event.target.value)}
                    placeholder="Select active job or enter manually"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-rose-400 focus:outline-none"
                  />
                  <datalist id="active-job-list">
                    {activeJobs.map((entry) => (
                      <option key={`${entry.job_number}-${entry.job_id}`} value={entry.job_number} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-xs text-slate-400">
                    {activeJobsLoading
                      ? "Loading active jobs..."
                      : "Select from open jobs or enter any job number."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(event) => setFormStartTime(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Finish time
                    </label>
                    <input
                      type="time"
                      value={formFinishTime}
                      onChange={(event) => setFormFinishTime(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(event) => setFormStatus(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-rose-400 focus:outline-none"
                  >
                    {STATUS_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white  transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {formSubmitting ? "Saving entry…" : "Save clocking entry"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
