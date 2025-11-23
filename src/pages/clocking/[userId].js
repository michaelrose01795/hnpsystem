"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";

const STATUS_STATES = ["In Progress", "Tea Break", "Waiting for Job"];

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

  const headerName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
    : `ID ${numericUserId || "?"}`;

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Clocking history · Today
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {headerName}
          </h1>
          {user?.role && (
            <p className="text-sm font-medium text-slate-500">{user.role}</p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Entries for {new Date().toLocaleDateString("en-GB")}
            </p>
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              {loading ? "Refreshing…" : "Live"}
            </span>
          </div>

          <div
            className="mt-3 overflow-y-auto rounded-2xl border border-slate-100"
            style={{ maxHeight: 520 }}
          >
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
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-xs text-slate-500"
                    >
                      No clocking entries recorded yet for today.
                    </td>
                  </tr>
                ) : (
                  entries.map((record) => {
                    const status = deriveStatus(record);
                    return (
                      <tr
                        key={record.id}
                        className="border-b border-slate-100"
                      >
                        <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {STATUS_STATES.includes(status) ? status : "Waiting for Job"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {record.job_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatTime(record.clock_in)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatTime(record.clock_out)}
                        </td>
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
      </div>
    </Layout>
  );
}
