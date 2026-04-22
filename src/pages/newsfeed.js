// file location: src/pages/newsfeed.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import { supabase } from "@/lib/database/supabaseClient";
import { useUser } from "@/context/UserContext";
import { MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import { roleCategories } from "@/config/users";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import NewsFeedUi from "@/components/page-ui/newsfeed-ui"; // Extracted presentation layer.

const FALLBACK_UPDATES = [
{
  id: "fallback-1",
  title: "Workshop Clean-up & Tool Audit",
  author: "Tom — Service Manager",
  created_at: "2025-10-21T14:00:00.000Z",
  departments: ["Workshop"],
  content:
  "Reminder: full workshop clean-up and tool audit on Friday at 3 PM. Please ensure all shared tools are returned and bays are left clear by Thursday evening."
},
{
  id: "fallback-2",
  title: "Record Sales Week — Thank You Team!",
  author: "Sarah — Sales Manager",
  created_at: "2025-10-20T10:30:00.000Z",
  departments: ["Sales"],
  content:
  "We’ve achieved a new milestone with 27 cars sold last week! Huge thanks to everyone, especially valeting and prep teams for their fast turnarounds."
},
{
  id: "fallback-3",
  title: "Parts Stocktake Reminder",
  author: "Jamie — Parts Manager",
  created_at: "2025-10-19T09:45:00.000Z",
  departments: ["Parts"],
  content:
  "End-of-month stocktake will take place Tuesday morning. Please ensure all deliveries are logged before Monday afternoon."
}];


const BASE_DEPARTMENTS = [
"General",
"Service",
"Workshop",
"Parts",
"Sales",
"Valeting",
"Admin",
"HR"];


const SALES_RETAIL_DEPARTMENTS = [
...(roleCategories?.Retail || []),
...(roleCategories?.Sales || [])];


const AVAILABLE_DEPARTMENTS = Array.from(
  new Set([...BASE_DEPARTMENTS, ...SALES_RETAIL_DEPARTMENTS].filter(Boolean))
);

const SECTION_ORDER = AVAILABLE_DEPARTMENTS;

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
  const canonicalDepartments = new Map(
    AVAILABLE_DEPARTMENTS.map((department) => [department.toLowerCase(), department])
  );
  const sanitized = (role) =>
  String(role || "").
  toLowerCase().
  replace(/[-_]/g, " ").
  trim();
  const mapped = new Set();
  roles.forEach((role) => {
    const exactRole = String(role || "").trim();
    const exactMatch = canonicalDepartments.get(exactRole.toLowerCase());
    if (exactMatch) {
      mapped.add(exactMatch);
    }

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
  } catch {
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
    departments: []
  });
  const [notificationError, setNotificationError] = useState("");

  const userRoles = useMemo(() => user?.roles || [], [user?.roles]);
  const userDepartments = useMemo(() => deriveDepartmentsFromRoles(userRoles), [userRoles]);
  const canManageUpdates = useMemo(() => isManagerRole(userRoles), [userRoles]);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.
      from("news_updates").
      select("id, title, content, departments, author, created_at").
      order("created_at", { ascending: false }).
      limit(200);
      if (!error && Array.isArray(data)) {
        setUpdates(
          data.map((row) => ({
            id: row.id ?? row.title,
            title: row.title,
            content: row.content,
            author: row.author,
            created_at: row.created_at,
            departments: normalizeDepartments(row.departments)
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
    const channel = supabase.
    channel("news-feed-updates").
    on(
      "postgres_changes",
      { event: "*", schema: "public", table: "news_updates" },
      () => {
        fetchUpdates();
      }
    ).
    subscribe();
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
        created_by: dbUserId
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

  return <NewsFeedUi view="section1" accessibleUpdates={accessibleUpdates} AVAILABLE_DEPARTMENTS={AVAILABLE_DEPARTMENTS} canManageUpdates={canManageUpdates} formatTimeAgo={formatTimeAgo} formState={formState} handleCreateUpdate={handleCreateUpdate} loading={loading} modalOpen={modalOpen} ModalPortal={ModalPortal} MultiSelectDropdown={MultiSelectDropdown} notificationError={notificationError} resetModal={resetModal} saving={saving} setFormState={setFormState} setModalOpen={setModalOpen} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} />;
























































































































































































































































































































































































}
