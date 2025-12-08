"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

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

const formatDate = (value) => {
  if (!value) return "Unknown date";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    return "Unknown date";
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
  const [departmentMenuOpen, setDepartmentMenuOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const departmentMenuRef = useRef(null);

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

  useEffect(() => {
    if (!departmentMenuOpen) return undefined;
    const handleClick = (event) => {
      if (departmentMenuRef.current && !departmentMenuRef.current.contains(event.target)) {
        setDepartmentMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [departmentMenuOpen]);

  const sectionFeeds = useMemo(() => {
    const accessibleSections = SECTION_ORDER.filter(
      (section) => section === "General" || userDepartments.includes(section)
    );
    return accessibleSections
      .map((label) => {
        const posts = updates.filter((update) => matchesSection(update, label));
        return { label, posts };
      })
      .filter((section) => section.posts.length > 0);
  }, [updates, userDepartments]);

  const handleDepartmentToggle = (department) => {
    setFormState((previous) => {
      const hasDept = previous.departments.includes(department);
      const nextDepartments = hasDept
        ? previous.departments.filter((dept) => dept !== department)
        : [...previous.departments, department];
      return { ...previous, departments: nextDepartments };
    });
  };

  const resetModal = () => {
    setFormState({ title: "", content: "", departments: [] });
    setNotificationError("");
    setDepartmentMenuOpen(false);
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

  const departmentsSummary = formState.departments.length === 0 ? "Choose departments" : null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {canManageUpdates && (
          <div className="flex justify-end items-center mb-10">
            <button
              onClick={() => {
                resetModal();
                setModalOpen(true);
              }}
              className="px-5 py-2 font-semibold text-white rounded-xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
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
          <p className="text-sm text-gray-400 mb-6">Loading latest updates…</p>
        )}

        {!loading && sectionFeeds.length === 0 && (
          <p className="text-sm text-gray-400 mb-6">
            No updates published for your departments yet.
          </p>
        )}

        <div className="space-y-10">
          {sectionFeeds.map((section) => (
            <section
              key={section.label}
              className="rounded-3xl p-8 border border-[var(--surface-light)] transition-all duration-300"
              style={{ background: "var(--surface)" }}
            >
              <h2
                className="text-2xl font-semibold mb-6 pb-2 border-b border-[var(--surface-light)]"
                style={{ color: "var(--primary)" }}
              >
                {section.label} Department
              </h2>

              <div className="flex flex-col gap-6">
                {section.posts.map((post) => (
                  <article
                    key={post.id ?? post.title}
                    className="rounded-2xl bg-[var(--surface-light)] shadow-md p-6 border border-[var(--surface-light)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary-light)]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {post.title}
                      </h3>
                      <span
                        className="text-xs font-medium px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--surface-light)",
                          color: "var(--primary)",
                        }}
                      >
                        {(post.departments && post.departments[0]) || section.label}
                      </span>
                    </div>

                    <p className="text-gray-700 mb-4 leading-relaxed">{post.content}</p>

                    <div className="flex justify-between text-sm text-gray-500 border-t border-gray-100 pt-3">
                      <span>{post.author || "System"}</span>
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
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
                >
                  Visible to Departments
                </label>

                {/* Selected Departments Display */}
                <div
                  style={{
                    minHeight: "48px",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    marginBottom: "8px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  {formState.departments.length === 0 ? (
                    <span style={{ color: "#999", fontSize: "15px" }}>No departments selected</span>
                  ) : (
                    formState.departments.map((dept) => (
                      <span
                        key={dept}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          backgroundColor: "var(--primary)",
                          color: "white",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}
                      >
                        {dept}
                        <button
                          type="button"
                          onClick={() => handleDepartmentToggle(dept)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "16px",
                            lineHeight: "1",
                            padding: "0",
                            marginLeft: "2px",
                          }}
                          aria-label={`Remove ${dept}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Department Selection Dropdown */}
                <div style={{ position: "relative" }} ref={departmentMenuRef}>
                  <button
                    type="button"
                    onClick={() => setDepartmentMenuOpen((previous) => !previous)}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onMouseLeave={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  >
                    <span style={{ fontWeight: "500" }}>
                      {departmentMenuOpen ? "Select departments to add" : "Add departments"}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        padding: "4px 12px",
                        borderRadius: "8px",
                        backgroundColor: "var(--primary)",
                        color: "white",
                      }}
                    >
                      {departmentMenuOpen ? "Close" : "Select"}
                    </span>
                  </button>
                  {departmentMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        marginTop: "8px",
                        left: 0,
                        right: 0,
                        backgroundColor: "var(--surface)",
                        borderRadius: "12px",
                        border: "2px solid var(--primary)",
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
                        zIndex: 1000,
                        maxHeight: "280px",
                        overflowY: "auto",
                      }}
                    >
                      {AVAILABLE_DEPARTMENTS.map((department, index) => (
                        <label
                          key={department}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "14px 16px",
                            fontSize: "15px",
                            cursor: "pointer",
                            borderBottom: index < AVAILABLE_DEPARTMENTS.length - 1 ? "1px solid var(--surface-light)" : "none",
                            transition: "background-color 0.2s",
                            backgroundColor: formState.departments.includes(department) ? "var(--surface-light)" : "transparent",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-light)")}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = formState.departments.includes(department) ? "var(--surface-light)" : "transparent";
                          }}
                        >
                          <span style={{ fontWeight: "500" }}>{department}</span>
                          <input
                            type="checkbox"
                            checked={formState.departments.includes(department)}
                            onChange={() => handleDepartmentToggle(department)}
                            style={{
                              width: "20px",
                              height: "20px",
                              cursor: "pointer",
                              accentColor: "var(--primary)",
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
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
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
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
