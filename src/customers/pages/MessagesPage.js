// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/MessagesPage.js
import React, { useEffect, useState } from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
};

const formatNotificationTimestamp = (value) => {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CustomerMessagesPage() {
  const { timeline, isLoading, error } = useCustomerPortalData();
  const { dbUserId } = useUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [directoryResults, setDirectoryResults] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [conversationFeedback, setConversationFeedback] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [startingConversationId, setStartingConversationId] = useState(null);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");

  useEffect(() => {
    const trimmedSearch = searchTerm.trim();
    if (!trimmedSearch) {
      setDirectoryResults([]);
      setDirectoryError("");
      setDirectoryLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setDirectoryLoading(true);
    setDirectoryError("");

    (async () => {
      try {
        const response = await fetch(
          `/api/messages/users${buildQuery({ q: trimmedSearch, limit: 8 })}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load team matching that name.");
        }
        if (!cancelled) {
          setDirectoryResults(payload.data || []);
        }
      } catch (fetchError) {
        if (cancelled || fetchError.name === "AbortError") {
          return;
        }
        console.error("❌ Customer message search failed:", fetchError);
        setDirectoryError(fetchError.message || "Failed to load team members.");
        setDirectoryResults([]);
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const loadSystemNotifications = async () => {
      setSystemLoading(true);
      setSystemError("");
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("notification_id, message, created_at")
          .or("target_role.ilike.%customer%,target_role.is.null")
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        if (!cancelled) {
          setSystemNotifications(data || []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setSystemError(
            fetchError?.message || "Unable to load system notifications."
          );
          setSystemNotifications([]);
        }
      } finally {
        if (!cancelled) {
          setSystemLoading(false);
        }
      }
    };

    loadSystemNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartConversation = async (targetUser) => {
    if (!dbUserId || !targetUser?.id) return;
    setConversationError("");
    setConversationFeedback("");
    setStartingConversationId(targetUser.id);
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct",
          createdBy: dbUserId,
          targetUserId: targetUser.id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to start conversation right now.");
      }
      setConversationFeedback(
        `Conversation opened with ${targetUser.name || targetUser.email || "that team member"}.`
      );
    } catch (startError) {
      console.error("❌ Failed to start customer conversation:", startError);
      setConversationError(startError.message || "Unable to start conversation.");
    } finally {
      setStartingConversationId(null);
    }
  };

  const hasSearchTerm = Boolean(searchTerm.trim());

  return (
    <CustomerLayout pageTitle="Messages">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-2xl border border-[#ffe0e0] bg-white p-5 text-sm text-slate-500 shadow mb-4">
          Loading messages…
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Message centre</p>
              <h3 className="text-xl font-semibold text-slate-900">
                Message the right person
              </h3>
            </div>
            <span className="text-xs font-semibold text-[#d10000]">
              Conversations stay linked to your job
            </span>
          </header>

          <div className="mt-4 space-y-6">
            <div className="rounded-2xl border border-dashed border-[#ffe5e5] bg-[#fffafa] p-4 shadow-[0_6px_16px_rgba(209,0,0,0.1)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">
                    Pinned thread
                  </p>
                  <h4 className="text-lg font-semibold text-slate-900">System notifications</h4>
                  <p className="text-xs text-slate-500">
                    Stock updates, approved work, VHC progress, and consumables alerts.
                  </p>
                </div>
                <span className="rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-semibold text-[#b91c1c]">
                  Read only
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {systemLoading && (
                  <p className="text-sm text-slate-500">Fetching system updates…</p>
                )}
                {!systemLoading && systemError && (
                  <p className="text-sm text-red-600">{systemError}</p>
                )}
                {!systemLoading && !systemError && systemNotifications.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No system notifications yet.
                  </p>
                )}
                {!systemLoading && !systemError && systemNotifications.length > 0 && (
                  <div className="space-y-3">
                    {systemNotifications.map((note) => (
                      <article
                        key={`system-${note.notification_id}`}
                        className="space-y-1 rounded-2xl border border-[#ffe5e5] bg-white/70 px-4 py-3 text-sm"
                      >
                        <p className="text-sm text-slate-900">{note.message || "System update"}</p>
                        <p className="text-xs text-slate-500">
                          {formatNotificationTimestamp(note.created_at)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Only the system posts here; this thread cannot be deleted or renamed.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="message-search"
                  className="text-xs font-semibold uppercase text-slate-500"
                >
                  Search by name or email
                </label>
                <input
                  id="message-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Start typing to find someone to message…"
                  className="w-full rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-3 text-sm text-slate-900 focus:border-[#d10000] focus:outline-none"
                />
              </div>

              {hasSearchTerm ? (
                <div className="space-y-3">
                  {directoryLoading && (
                    <p className="text-sm text-slate-500">Searching your team…</p>
                  )}
                  {!directoryLoading && directoryError && (
                    <p className="text-sm text-red-600">{directoryError}</p>
                  )}
                  {!directoryLoading && !directoryError && directoryResults.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No team members match that search.
                    </p>
                  )}
                  {!directoryLoading && !directoryError && directoryResults.length > 0 && (
                    <div className="space-y-3">
                      {directoryResults.map((result) => (
                        <div
                          key={result.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-4 text-sm shadow-[0_6px_20px_rgba(209,0,0,0.06)]"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{result.name}</p>
                            <p className="text-xs text-slate-500">
                              {result.role || "Team member"} &middot; {result.email || "No email"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartConversation(result)}
                            disabled={!dbUserId || startingConversationId === result.id}
                            className="rounded-full bg-[#d10000] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#b50d0d] disabled:cursor-not-allowed disabled:bg-[#f0a8a8]"
                          >
                            {startingConversationId === result.id ? "Starting…" : "Start conversation"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Search for a team member before you start a new conversation.
                </p>
              )}

              {conversationFeedback && (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {conversationFeedback}
                </p>
              )}
              {conversationError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {conversationError}
                </p>
              )}
              {hasSearchTerm && !dbUserId && !conversationFeedback && !conversationError && (
                <p className="text-xs text-slate-500">
                  We are linking your account so you can start conversations—give us a moment.
                </p>
              )}
            </div>
          </div>
        </section>
        <AppointmentTimeline events={timeline} />
      </div>
    </CustomerLayout>
  );
}
