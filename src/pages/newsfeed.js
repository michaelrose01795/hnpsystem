"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { MultiSelectDropdown } from "@/components/dropdownAPI";

const FALLBACK_UPDATES = [
  {
    id: "fallback-1",
    title: "Workshop Clean-up & Tool Audit",
    author: "Tom — Service Manager",
    created_at: "2025-10-21T14:00:00.000Z",
    departments: ["Workshop"],
    content:
      "Reminder: full workshop clean-up and tool audit on Friday at 3 PM. Please ensure all shared tools are returned and bays are left clear by Thursday evening.",
  },
  {
    id: "fallback-2",
    title: "Record Sales Week — Thank You Team!",
    author: "Sarah — Sales Manager",
    created_at: "2025-10-20T10:30:00.000Z",
    departments: ["Sales"],
    content:
      "We’ve achieved a new milestone with 27 cars sold last week! Huge thanks to everyone, especially valeting and prep teams for their fast turnarounds.",
  },
  {
    id: "fallback-3",
    title: "Parts Stocktake Reminder",
    author: "Jamie — Parts Manager",
    created_at: "2025-10-19T09:45:00.000Z",
    departments: ["Parts"],
    content:
      "End-of-month stocktake will take place Tuesday morning. Please ensure all deliveries are logged before Monday afternoon.",
  },
];

const AVAILABLE_DEPARTMENTS = [
  "General",
  "Service",
  "Workshop",
  "Parts",
  "Sales",
  "Valeting",
  "Admin",
  "HR",
];

const SECTION_ORDER = [
  "General",
  "Service",
  "Workshop",
  "Parts",
  "Sales",
  "Valeting",
  "Admin",
  "HR",
];

const normalizeDepartment = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  const key = normalized.toLowerCase();
  const match = AVAILABLE_DEPARTMENTS.find((dept) => dept.toLowerCase() === key);
  return match || normalized;
};

const normalizeDepartments = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map(normalizeDepartment).filter(Boolean)));
  }
  return [normalizeDepartment(input)].filter(Boolean);
};

const deriveDepartmentsFromRoles = (roles = []) => {
  const sanitized = (role) =>
    String(role || "")
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .trim();
  const mapped = new Set();
  roles.forEach((role) => {
    const normalized = sanitized(role);
    if (!normalized) return;
    if (normalized.includes("service") || normalized.includes("after sales") || normalized.includes("aftersales")) {
      mapped.add("Service");
    }
    if (normalized.includes("workshop") || normalized.includes("tech") || normalized.includes("mot")) {
      mapped.add("Workshop");
    }
    if (normalized.includes("parts")) {
      mapped.add("Parts");
    }
    if (normalized.includes("sales") && !normalized.includes("after sales")) {
      mapped.add("Sales");
    }
    if (normalized.includes("valet")) {
      mapped.add("Valeting");
    }
    if (normalized.includes("hr")) {
      mapped.add("HR");
    }
    if (normalized.includes("admin") || normalized.includes("owner")) {
      mapped.add("Admin");
    }
  });
  return Array.from(mapped);
};

const formatTimeAgo = (value) => {
  if (!value) return "Unknown time";
  try {
    const date = new Date(value);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
    } else if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `${months} month${months === 1 ? "" : "s"} ago`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return `${years} year${years === 1 ? "" : "s"} ago`;
    }
  } catch (error) {
    return "Unknown time";
  }
};

const isManagerRole = (roles = []) =>
  roles.some((role) => /(manager|director|owner)/i.test(role));

const matchesSection = (update, section) => {
  const payload = Array.isArray(update.departments) ? update.departments : [];
  if (section === "General") {
    return payload.length === 0 || payload.includes("General");
  }
  return payload.includes(section);
};

export default function NewsFeed() {
  const { user, dbUserId } = useUser();
  const [updates, setUpdates] = useState(FALLBACK_UPDATES);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    title: "",
    content: "",
    departments: [],
  });
  const [notificationError, setNotificationError] = useState("");

  const userRoles = user?.roles || [];
  const userDepartments = useMemo(() => deriveDepartmentsFromRoles(userRoles), [userRoles]);
  const canManageUpdates = useMemo(() => isManagerRole(userRoles), [userRoles]);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("news_updates")
        .select("id, title, content, departments, author, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && Array.isArray(data)) {
        setUpdates(
          data.map((row) => ({
            id: row.id ?? row.title,
            title: row.title,
            content: row.content,
            author: row.author,
            created_at: row.created_at,
            departments: normalizeDepartments(row.departments),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load news updates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpdates();
    const channel = supabase
      .channel("news-feed-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "news_updates" },
        () => {
          fetchUpdates();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUpdates]);

  const accessibleUpdates = useMemo(() => {
    const accessibleSections = SECTION_ORDER.filter(
      (section) => section === "General" || userDepartments.includes(section)
    );
    return updates.filter((update) =>
      accessibleSections.some((section) => matchesSection(update, section))
    );
  }, [updates, userDepartments]);

  const resetModal = () => {
    setFormState({ title: "", content: "", departments: [] });
    setNotificationError("");
  };

  const handleCreateUpdate = async () => {
    setNotificationError("");
    if (!formState.title.trim() || !formState.content.trim() || formState.departments.length === 0) {
      setNotificationError("Provide a title, description, and target departments.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formState.title.trim(),
        content: formState.content.trim(),
        departments: formState.departments,
        author: user?.username || "System",
        created_by: dbUserId,
      };
      const { error } = await supabase.from("news_updates").insert([payload]);
      if (error) {
        throw error;
      }
      resetModal();
      setModalOpen(false);
      await fetchUpdates();
    } catch (error) {
      console.error("Failed to save update:", error);
      setNotificationError("Unable to save updates right now. Please try again later.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {canManageUpdates && (
          <div className="flex justify-end items-center mb-12">
            <button
              onClick={() => {
                resetModal();
                setModalOpen(true);
              }}
              className="px-5 py-2 font-semibold text-white rounded-xl  transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                backgroundColor: "var(--primary)",
                border: "1px solid var(--primary-dark)",
              }}
              type="button"
            >
              + Add Update
            </button>
          </div>
        )}

        {loading && (
          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-secondary)", opacity: 0.7 }}
          >
            Loading latest updates…
          </p>
        )}

        {!loading && accessibleUpdates.length === 0 && (
          <div
            className="text-center py-16"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "16px",
              backgroundColor: "var(--layer-section-level-1)",
            }}
          >
            <p
              className="text-sm"
              style={{ color: "var(--text-secondary)", opacity: 0.7 }}
            >
              No updates published for your departments yet.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {accessibleUpdates.map((update) => (
            <article
              key={update.id ?? update.title}
              style={{
                padding: "20px 24px",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                backgroundColor: "var(--layer-section-level-1)",
                cursor: "pointer",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                maxWidth: "100%",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Title */}
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "var(--text-primary)",
                }}
              >
                {update.title}
              </h2>

              {/* Author and Time */}
              <div
                style={{
                  fontSize: "11px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--text-secondary)",
                  opacity: 0.7,
                }}
              >
                <span>{update.author || "System"}</span>
                <span>•</span>
                <span>{formatTimeAgo(update.created_at)}</span>
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: "15px",
                  lineHeight: "1.6",
                  color: "var(--text-primary)",
                  opacity: 0.9,
                  maxHeight: "calc(1.6em * 20)",
                  overflowY: "auto",
                }}
              >
                {update.content}
              </div>
            </article>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div
          className="popup-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              resetModal();
            }
          }}
        >
          <div
            className="popup-card"
            role="dialog"
            aria-modal="true"
            style={{
              borderRadius: "32px",
              width: "100%",
              maxWidth: "650px",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--surface-light)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid var(--surface-light)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "var(--primary)",
                }}
              >
                Share an Update
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  resetModal();
                }}
                type="button"
                aria-label="Close update modal"
                style={{
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#888",
                  fontSize: "24px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-light)";
                  e.currentTarget.style.color = "#666";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#888";
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "32px" }}>
              {/* Title Field */}
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--primary)",
                  }}
                  htmlFor="news-title"
                >
                  Title
                </label>
                <input
                  id="news-title"
                  type="text"
                  placeholder="Enter update title..."
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((previous) => ({ ...previous, title: event.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    fontSize: "15px",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                />
              </div>

              {/* Description Field */}
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--primary)",
                  }}
                  htmlFor="news-content"
                >
                  Description
                </label>
                <textarea
                  id="news-content"
                  rows={5}
                  placeholder="Write your update details..."
                  value={formState.content}
                  onChange={(event) =>
                    setFormState((previous) => ({ ...previous, content: event.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    fontSize: "15px",
                    transition: "border-color 0.2s",
                    resize: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                />
              </div>

              {/* Departments Field */}
              <div style={{ marginBottom: "24px" }}>
                <MultiSelectDropdown
                  label="Visible to Departments"
                  placeholder="Add departments"
                  options={AVAILABLE_DEPARTMENTS}
                  value={formState.departments}
                  onChange={(selectedDepartments) => {
                    setFormState((prev) => ({
                      ...prev,
                      departments: selectedDepartments,
                    }));
                  }}
                  emptyState="No departments available"
                />
              </div>

              {/* Error Message */}
              {notificationError && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid #fecaca",
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {notificationError}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: "24px 32px",
                borderTop: "1px solid var(--surface-light)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetModal();
                }}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "2px solid var(--surface-light)",
                  backgroundColor: "transparent",
                  fontSize: "15px",
                  fontWeight: "bold",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.backgroundColor = "var(--surface-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--surface-light)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateUpdate}
                disabled={saving}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "2px solid var(--primary-dark)",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: "bold",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  transition: "all 0.2s",
                  boxShadow: "none",
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
                  }
                }}
              >
                {saving ? "Publishing…" : "Publish Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
