// ✅ Redesigned NotesTab — overview stats + filter bar + 70/30 list/detail split
// file location: src/components/NotesTab.js
//
// Layout (follows the Service History tab redesign + staffglobal.css conventions):
//   1. Flat toolbar row       → compact stats plus search and "Add note" button.
//   2. 70/30 split            → left: notes list + inline composer; right: the
//      selected note's detail (category, created/updated, activity timeline,
//      "Visible to" roles with an Edit access toggle).
//
// Data model note: job_notes has no pinned/title/category/access columns
// (src/lib/database/schema/schemaReference.sql). So:
//   • pinned  → client-side, persisted to localStorage per job (no schema change)
//   • title   → derived from note linkage; description = the note text
//   • category / "visible to" / access → derived from hidden_from_customer
//   • role filters → derived from the note author's role (created_by)
// All persistence still flows through the existing src/lib/database/notes.js helpers.
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  getNotesByJob,
  createJobNote,
  updateJobNote,
  deleteJobNote,
  getActiveStaff,
  getNoteViewers,
  addNoteViewer,
  removeNoteViewer,
} from "@/lib/database/notes";
import { normalizeRequests } from "@/lib/jobCards/utils";
import { useConfirmation } from "@/context/ConfirmationContext";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import SearchBar from "@/components/ui/searchBarAPI/SearchBar";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import useIsMobile from "@/hooks/useIsMobile";
import { InlineLoading, SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

/* ---- shared text styles (mirrors the Service History tab redesign) ---- */
const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};
const metaStyle = { fontSize: "0.8rem", color: "rgba(var(--text-1-rgb), 0.7)" };
const fieldLabelStyle = {
  fontSize: "0.6rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(var(--text-1-rgb), 0.6)",
  fontWeight: 700,
};

const statLabelStyle = {
  fontSize: "10px",
  letterSpacing: "0.04em",
  lineHeight: 1,
  textTransform: "uppercase",
  color: "var(--grey-accent)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const statValueStyle = {
  fontSize: "18px",
  fontWeight: 700,
  color: "var(--accentText)",
  lineHeight: 1,
  wordBreak: "break-word",
};

const statTileStyle = {
  backgroundColor: "var(--surface)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  columnGap: "8px",
  rowGap: "2px",
  minWidth: 0,
  minHeight: "44px",
};

const toIntegerOrNull = (value) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? numericValue : null;
};

const formatRequestStatusLabel = (status) => {
  const rawStatus = String(status || "").trim();
  if (!rawStatus) return "Unknown";
  return rawStatus
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getRequestText = (request) =>
  String(request?.text ?? request?.description ?? request?.requestText ?? request ?? "").trim();

const buildRequestOptions = (jobData) => {
  const structuredRequests = Array.isArray(jobData?.jobRequests)
    ? jobData.jobRequests
    : Array.isArray(jobData?.job_requests)
    ? jobData.job_requests
    : [];

  if (structuredRequests.length) {
    return structuredRequests
      .map((request, index) => {
        const sortOrder = toIntegerOrNull(request?.sortOrder ?? request?.sort_order) ?? index + 1;
        return {
          requestIndex: sortOrder,
          requestId: request?.requestId ?? request?.request_id ?? null,
          text: getRequestText(request),
          hours: request?.hours ?? request?.time ?? null,
          jobType: request?.jobType ?? request?.job_type ?? request?.paymentType ?? "",
          status: request?.status ?? "",
          source: request?.requestSource ?? request?.request_source ?? "",
          noteText: request?.noteText ?? request?.note_text ?? "",
          createdAt: request?.createdAt ?? request?.created_at ?? null,
          updatedAt: request?.updatedAt ?? request?.updated_at ?? null,
        };
      })
      .sort((a, b) => a.requestIndex - b.requestIndex);
  }

  return normalizeRequests(jobData?.requests).map((request, index) => ({
    requestIndex: index + 1,
    requestId: request?.requestId ?? request?.request_id ?? null,
    text: getRequestText(request),
    hours: request?.hours ?? request?.time ?? null,
    jobType: request?.jobType ?? request?.paymentType ?? "",
    status: request?.status ?? "",
    source: request?.requestSource ?? "",
    noteText: request?.noteText ?? "",
    createdAt: request?.createdAt ?? null,
    updatedAt: request?.updatedAt ?? null,
  }));
};

/* ---- filter definitions ---- */
const FILTERS = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "internal", label: "Internal" },
  { id: "customer", label: "Customer Visible" },
  { id: "workshop", label: "Workshop" },
  { id: "parts", label: "Parts" },
  { id: "advisor", label: "Advisor" },
  { id: "manager", label: "Manager" },
];
const ROLE_FILTERS = ["workshop", "parts", "advisor", "manager"];

// Map an author's role string onto one of the four role filter groups.
const roleGroupOf = (role) => {
  const r = String(role || "").toLowerCase();
  if (!r) return "other";
  if (r.includes("manager") || r.includes("owner") || r.includes("admin")) return "manager";
  if (r.includes("part")) return "parts";
  if (r.includes("advisor") || r.includes("service")) return "advisor";
  if (
    r.includes("workshop") ||
    r.includes("tech") ||
    r.includes("mot") ||
    r.includes("paint") ||
    r.includes("valet")
  )
    return "workshop";
  return "other";
};
const ROLE_GROUP_LABELS = {
  workshop: "Workshop",
  parts: "Parts",
  advisor: "Service Advisor",
  manager: "Manager / Admin",
  other: "Staff",
};

export default function NotesTabNew({
  jobData,
  canEdit,
  actingUserNumericId,
  onNotesChange,
  onNoteAdded,
  highlightNoteIds = [],
  noteHistoryJobs = [],
}) {
  const jobId = jobData?.id;
  const { confirm } = useConfirmation();
  const isMobile = useIsMobile(900);

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteHidden, setNewNoteHidden] = useState(true); // Default: hidden from customer
  const [showAddNote, setShowAddNote] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savingNewNote, setSavingNewNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [error, setError] = useState("");
  const [linkingNote, setLinkingNote] = useState(null);

  // Redesign-only UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [editingAccess, setEditingAccess] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => new Set());

  // Per-note viewer access (backed by public.note_viewers).
  const [staffOptions, setStaffOptions] = useState([]);
  const [noteViewers, setNoteViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [showAddViewer, setShowAddViewer] = useState(false);
  const [viewerToAdd, setViewerToAdd] = useState("");

  const requestOptions = useMemo(() => buildRequestOptions(jobData), [jobData]);
  const requestOptionsByIndex = useMemo(() => {
    const byIndex = new Map();
    requestOptions.forEach((request) => {
      byIndex.set(request.requestIndex, request);
    });
    return byIndex;
  }, [requestOptions]);
  const authorisedItems = useMemo(
    () =>
      (jobData?.vhcChecks || []).filter(
        (check) => String(check?.approval_status || "").toLowerCase() === "authorized"
      ),
    [jobData?.vhcChecks]
  );
  const authorisedParts = useMemo(() => {
    const parts = Array.isArray(jobData?.partsAllocations)
      ? jobData.partsAllocations
      : Array.isArray(jobData?.parts_job_items)
      ? jobData.parts_job_items
      : [];
    return parts.filter((part) => part?.authorised === true);
  }, [jobData?.partsAllocations, jobData?.parts_job_items]);
  const highlightedNoteIdSet = useMemo(
    () => new Set(Array.isArray(highlightNoteIds) ? highlightNoteIds : []),
    [highlightNoteIds]
  );

  const historyJobsWithNotes = useMemo(() => {
    const historyJobs = Array.isArray(noteHistoryJobs) ? noteHistoryJobs : [];
    const currentJobId = jobData?.id ?? jobId ?? null;
    const currentJobNumber = jobData?.jobNumber || jobData?.job_number || "";
    const seenJobKeys = new Set();
    const withCurrentNotes = historyJobs.map((job) => {
      const jobKey = String(job.id ?? job.jobId ?? job.jobNumber ?? "");
      if (jobKey) seenJobKeys.add(jobKey);
      const matchesCurrent =
        (currentJobId && Number(job.id ?? job.jobId) === Number(currentJobId)) ||
        (currentJobNumber && String(job.jobNumber || "").trim() === String(currentJobNumber).trim());

      return {
        ...job,
        notes: matchesCurrent ? notes : Array.isArray(job.notes) ? job.notes : [],
      };
    });

    if (currentJobId && !seenJobKeys.has(String(currentJobId))) {
      withCurrentNotes.unshift({
        id: currentJobId,
        jobNumber: currentJobNumber,
        serviceDate: jobData?.appointment?.date || jobData?.createdAt || null,
        serviceDateFormatted: jobData?.appointment?.date || "Current jobcard",
        mileage: jobData?.mileage || jobData?.milage || "",
        notes,
      });
    }

    return withCurrentNotes
      .map((job) => ({
        ...job,
        notes: Array.isArray(job.notes)
          ? job.notes.filter((note) => String(note.noteText || note.note_text || "").trim())
          : [],
      }))
      .filter((job) => job.notes.length > 0);
  }, [jobData, jobId, noteHistoryJobs, notes]);

  // Load notes
  useEffect(() => {
    if (!jobId) return;
    loadNotes();
  }, [jobId]);

  // Hydrate pinned set from localStorage (client-only; no schema column exists).
  useEffect(() => {
    if (typeof window === "undefined" || !jobId) return;
    try {
      const raw = window.localStorage.getItem(`hnp:pinnedNotes:${jobId}`);
      setPinnedIds(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setPinnedIds(new Set());
    }
  }, [jobId]);

  // Load the active staff list once (used by the "Add user" picker).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const staff = await getActiveStaff();
      if (!cancelled) setStaffOptions(staff);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the explicit viewers for the currently selected note.
  useEffect(() => {
    let cancelled = false;
    setShowAddViewer(false);
    setViewerToAdd("");
    if (!selectedNoteId) {
      setNoteViewers([]);
      return undefined;
    }
    setViewersLoading(true);
    (async () => {
      const viewers = await getNoteViewers(selectedNoteId);
      if (!cancelled) {
        setNoteViewers(viewers);
        setViewersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteId]);

  const togglePin = (noteId) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      if (typeof window !== "undefined" && jobId) {
        try {
          window.localStorage.setItem(`hnp:pinnedNotes:${jobId}`, JSON.stringify([...next]));
        } catch {
          /* ignore quota / disabled storage */
        }
      }
      return next;
    });
  };

  const loadNotes = async () => {
    setLoading(true);
    setError("");
    try {
      const fetchedNotes = await getNotesByJob(jobId);
      const nextNotes = fetchedNotes || [];
      setNotes(nextNotes);
      if (typeof onNotesChange === "function") {
        onNotesChange(nextNotes);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!canEdit || !newNoteText.trim()) return;

    setSavingNewNote(true);
    setError("");
    try {
      const result = await createJobNote({
        job_id: jobId,
        user_id: actingUserNumericId,
        note_text: newNoteText.trim(),
        hidden_from_customer: newNoteHidden,
      });

      if (result.success) {
        const createdNoteId = result?.data?.note_id ?? null;
        if (createdNoteId && typeof onNoteAdded === "function") {
          onNoteAdded(createdNoteId);
        }
        if (createdNoteId) setSelectedNoteId(createdNoteId);
        setNewNoteText("");
        setNewNoteHidden(true); // Reset to default
        setShowAddNote(false);
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to create note");
      }
    } catch (err) {
      console.error("Failed to add note:", err);
      setError("Failed to add note");
    } finally {
      setSavingNewNote(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.noteId);
    setEditingNoteText(note.noteText);
  };

  const handleSaveEdit = async (noteId) => {
    if (!editingNoteText.trim()) return;

    try {
      const result = await updateJobNote(
        noteId,
        { noteText: editingNoteText.trim() },
        actingUserNumericId
      );

      if (result.success) {
        setEditingNoteId(null);
        setEditingNoteText("");
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to update note");
      }
    } catch (err) {
      console.error("Failed to update note:", err);
      setError("Failed to update note");
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const handleToggleHiddenFromCustomer = async (note) => {
    if (!canEdit) return;

    try {
      const result = await updateJobNote(
        note.noteId,
        { hiddenFromCustomer: !note.hiddenFromCustomer },
        actingUserNumericId
      );

      if (result.success) {
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to toggle visibility");
      }
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
      setError("Failed to toggle visibility");
    }
  };

  const handleAddViewer = async () => {
    if (!canEdit || !selectedNoteId || !viewerToAdd) return;
    const userId = Number(viewerToAdd);
    if (!Number.isInteger(userId)) return;

    try {
      const result = await addNoteViewer({
        noteId: selectedNoteId,
        userId,
        addedBy: actingUserNumericId ?? null,
      });
      if (result.success) {
        const viewers = await getNoteViewers(selectedNoteId);
        setNoteViewers(viewers);
        setViewerToAdd("");
        setShowAddViewer(false);
      } else {
        setError(result.error?.message || "Failed to add viewer");
      }
    } catch (err) {
      console.error("Failed to add viewer:", err);
      setError("Failed to add viewer");
    }
  };

  const handleRemoveViewer = async (userId) => {
    if (!canEdit || !selectedNoteId) return;
    try {
      const result = await removeNoteViewer(selectedNoteId, userId);
      if (result.success) {
        setNoteViewers((prev) => prev.filter((viewer) => viewer.userId !== userId));
      } else {
        setError(result.error?.message || "Failed to remove viewer");
      }
    } catch (err) {
      console.error("Failed to remove viewer:", err);
      setError("Failed to remove viewer");
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!canEdit) return;
    const confirmed = await confirm({
      title: "Delete note",
      message: "Are you sure you want to delete this note?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      const result = await deleteJobNote(noteId, actingUserNumericId);

      if (result.success) {
        await loadNotes();
      } else {
        setError(result.error?.message || "Failed to delete note");
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
      setError("Failed to delete note");
    }
  };

  const resolveLinkLabel = (note) => {
    const requestCount = Array.isArray(note.linkedRequestIndices) ? note.linkedRequestIndices.length : 0;
    const vhcCount = Array.isArray(note.linkedVhcIds) ? note.linkedVhcIds.length : 0;
    const partCount = Array.isArray(note.linkedPartIds) ? note.linkedPartIds.length : 0;
    if (!requestCount && !vhcCount && !partCount) return "";
    const parts = [];
    if (requestCount) parts.push(`Requests ${requestCount}`);
    if (vhcCount) parts.push(`Authorised ${vhcCount}`);
    if (partCount) parts.push(`Parts ${partCount}`);
    return parts.join(" • ");
  };

  const normalizeLinkIds = (values) =>
    (Array.isArray(values) ? values : [])
      .map((value) => toIntegerOrNull(value))
      .filter((value) => value !== null);

  const handleLinkNote = async (note, link) => {
    if (!note?.noteId) return;
    const currentRequestLinks = normalizeLinkIds(note.linkedRequestIndices);
    const currentVhcLinks = normalizeLinkIds(note.linkedVhcIds);
    const currentPartLinks = normalizeLinkIds(note.linkedPartIds);
    let nextRequestLinks = currentRequestLinks;
    let nextVhcLinks = currentVhcLinks;
    let nextPartLinks = currentPartLinks;
    const linkedRequestIndex = toIntegerOrNull(link?.linkedRequestIndex);
    const linkedVhcId = toIntegerOrNull(link?.linkedVhcId);
    const linkedPartId = toIntegerOrNull(link?.linkedPartId);

    if (link?.clear) {
      nextRequestLinks = [];
      nextVhcLinks = [];
      nextPartLinks = [];
    } else if (linkedRequestIndex !== null) {
      if (currentRequestLinks.includes(linkedRequestIndex)) {
        nextRequestLinks = currentRequestLinks.filter((value) => value !== linkedRequestIndex);
      } else {
        nextRequestLinks = [...currentRequestLinks, linkedRequestIndex].sort((a, b) => a - b);
      }
    } else if (linkedVhcId !== null) {
      if (currentVhcLinks.includes(linkedVhcId)) {
        nextVhcLinks = currentVhcLinks.filter((value) => value !== linkedVhcId);
      } else {
        nextVhcLinks = [...currentVhcLinks, linkedVhcId];
      }
    } else if (linkedPartId !== null) {
      if (currentPartLinks.includes(linkedPartId)) {
        nextPartLinks = currentPartLinks.filter((value) => value !== linkedPartId);
      } else {
        nextPartLinks = [...currentPartLinks, linkedPartId];
      }
    }
    try {
      const result = await updateJobNote(
        note.noteId,
        {
          linkedRequestIndex: nextRequestLinks[0] ?? null,
          linkedVhcId: nextVhcLinks[0] ?? null,
          linkedPartId: nextPartLinks[0] ?? null,
          linkedRequestIndices: nextRequestLinks,
          linkedVhcIds: nextVhcLinks,
          linkedPartIds: nextPartLinks,
        },
        actingUserNumericId
      );
      if (!result.success) {
        setError(result.error?.message || "Failed to link note");
        return;
      }
      await loadNotes();
    } catch (err) {
      console.error("Failed to link note:", err);
      setError("Failed to link note");
    }
  };

  const isLinkedToRequest = (note, requestIndex) => normalizeLinkIds(note?.linkedRequestIndices).includes(requestIndex);
  const isLinkedToAuthorised = (note, item) =>
    normalizeLinkIds(note?.linkedVhcIds).includes(toIntegerOrNull(item?.vhc_id ?? item?.id));
  const isLinkedToPart = (note, partId) =>
    normalizeLinkIds(note?.linkedPartIds).includes(toIntegerOrNull(partId));

  const formatDateTime = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleString("en-GB", {
        hour12: false,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  // Derive a presentational title + category for a note from its linkage.
  const deriveNoteMeta = (note) => {
    const reqIdx = normalizeLinkIds(note.linkedRequestIndices);
    const vhcIds = normalizeLinkIds(note.linkedVhcIds);
    const partIds = normalizeLinkIds(note.linkedPartIds);
    if (reqIdx.length) {
      const n = reqIdx[0];
      const req = requestOptionsByIndex.get(n) || requestOptions.find((request) => request.requestIndex === n);
      const reqText = req?.text || "";
      return {
        title: `Request ${n}`,
        category: "Customer Request",
        request: req || null,
        requestText: reqText,
      };
    }
    if (vhcIds.length) {
      const item = authorisedItems.find((i) => toIntegerOrNull(i.vhc_id ?? i.id) === vhcIds[0]);
      return { title: item?.issue_title || item?.section || "VHC item", category: "VHC Item", request: null, requestText: "" };
    }
    if (partIds.length) {
      return { title: "Linked part", category: "Part", request: null, requestText: "" };
    }
    return { title: "General note", category: "General", request: null, requestText: "" };
  };

  /* ---- derived collections (filter + search + pin ordering) ---- */
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesFilter = (note) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "pinned") return pinnedIds.has(note.noteId);
      if (activeFilter === "internal") return !!note.hiddenFromCustomer;
      if (activeFilter === "customer") return !note.hiddenFromCustomer;
      if (ROLE_FILTERS.includes(activeFilter)) return roleGroupOf(note.createdByRole) === activeFilter;
      return true;
    };
    const matchesSearch = (note) => {
      if (!q) return true;
      const meta = deriveNoteMeta(note);
      const hay = `${note.noteText || ""} ${note.createdBy || ""} ${meta.title} ${meta.category}`.toLowerCase();
      return hay.includes(q);
    };
    return notes
      .filter((note) => matchesFilter(note) && matchesSearch(note))
      .sort((a, b) => (pinnedIds.has(b.noteId) ? 1 : 0) - (pinnedIds.has(a.noteId) ? 1 : 0));
    // deriveNoteMeta depends on requestOptions/requestOptionsByIndex/authorisedItems via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, activeFilter, searchQuery, pinnedIds, requestOptions, requestOptionsByIndex, authorisedItems]);

  // Keep the detail-panel selection valid as the filtered list changes.
  useEffect(() => {
    if (!filteredNotes.length) {
      setSelectedNoteId(null);
      return;
    }
    if (!filteredNotes.some((n) => n.noteId === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].noteId);
    }
  }, [filteredNotes, selectedNoteId]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.noteId === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  /* ---- overview stats ---- */
  const stats = useMemo(() => {
    const total = notes.length;
    const pinned = notes.filter((n) => pinnedIds.has(n.noteId)).length;
    const internal = notes.filter((n) => n.hiddenFromCustomer).length;
    const customerView = notes.filter((n) => !n.hiddenFromCustomer).length;
    const lastUpdatedTs = notes.reduce((acc, n) => {
      const ts = new Date(n.updatedAt || n.createdAt || 0).getTime();
      return Number.isFinite(ts) && ts > acc ? ts : acc;
    }, 0);
    return {
      total,
      pinned,
      internal,
      customerView,
      lastUpdated: lastUpdatedTs ? formatDateTime(new Date(lastUpdatedTs).toISOString()) : "—",
    };
  }, [notes, pinnedIds]);

  // Per-filter counts shown as badges on the filter pills.
  const filterCount = (id) => {
    if (id === "all") return notes.length;
    if (id === "pinned") return notes.filter((n) => pinnedIds.has(n.noteId)).length;
    if (id === "internal") return notes.filter((n) => n.hiddenFromCustomer).length;
    if (id === "customer") return notes.filter((n) => !n.hiddenFromCustomer).length;
    return notes.filter((n) => roleGroupOf(n.createdByRole) === id).length;
  };

  if (loading) {
    // Skeleton rows keep the tab's shape while notes load, so there is no
    // layout jump when the real list replaces the placeholder.
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading notes"
        style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px 4px" }}
      >
        <SkeletonKeyframes />
        <SkeletonBlock width="42%" height="16px" />
        <SkeletonBlock width="100%" height="52px" borderRadius="var(--radius-sm, 8px)" />
        <SkeletonBlock width="100%" height="52px" borderRadius="var(--radius-sm, 8px)" />
        <SkeletonBlock width="88%" height="52px" borderRadius="var(--radius-sm, 8px)" />
      </div>
    );
  }

  // Filter options for the Overview-row dropdown (label + live count).
  const filterOptions = FILTERS.map((filter) => ({
    value: filter.id,
    label: `${filter.label} (${filterCount(filter.id)})`,
  }));

  const statTiles = [
    { label: "Total Notes", value: stats.total },
    { label: "Customer View", value: stats.customerView },
  ];

  const splitColumns = isMobile ? "1fr" : "minmax(0, 7fr) minmax(0, 3fr)";

  return (
    <>
      {error && (
        <div
          style={{
            padding: "12px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--warning-surface)",
            color: "var(--danger)",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            flex: "1 1 320px",
            minWidth: 0,
          }}
        >
          {statTiles.map((tile) => (
            <div key={tile.label} style={statTileStyle}>
              <span style={statLabelStyle}>{tile.label}</span>
              <span style={statValueStyle}>{tile.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
          <DropdownField
            options={filterOptions}
            value={activeFilter}
            onValueChange={(value) => setActiveFilter(value)}
            ariaLabel="Filter notes"
            size="sm"
            style={{ width: "200px", maxWidth: "100%" }}
          />
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search notes…"
            ariaLabel="Search notes"
            style={{ width: "240px", maxWidth: "100%" }}
          />
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? "Hide history" : "Show history"}
          </button>
          {canEdit && (
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => {
                setShowAddNote(true);
                if (typeof window !== "undefined") {
                  window.requestAnimationFrame(() => {
                    document
                      .getElementById("jobcard-note-composer")
                      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  });
                }
              }}
            >
              + Add note
            </button>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* 1. 70/30 split — list (left) / detail (right)                 */}
      {/* ============================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: splitColumns,
          gap: "var(--page-stack-gap)",
          alignItems: "start",
        }}
      >
        {/* ---- LEFT 70%: composer + notes list ---- */}
        <LayerSurface
          sectionKey="jobcard-notes-list"
          parentKey="jobcard-tab-content-shell"
          gap="var(--space-4)"
          style={{ minWidth: 0 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <p style={eyebrowStyle}>Notes list</p>
            <span style={metaStyle}>
              {filteredNotes.length} of {notes.length} shown
            </span>
          </div>

          {/* Inline composer */}
          {canEdit && showAddNote && (
            <LayerTheme id="jobcard-note-composer" radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-3)">
              <span style={fieldLabelStyle}>New note</span>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onInput={(e) => {
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 220)}px`;
                }}
                placeholder="Type your note here…"
                style={{
                  width: "100%",
                  minHeight: "72px",
                  maxHeight: "220px",
                  padding: "12px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  resize: "none",
                  overflowY: "auto",
                  background: "var(--surface)",
                  color: "var(--text-1)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "var(--text-1)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newNoteHidden}
                    onChange={(e) => setNewNoteHidden(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Hide from customer
                </label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    type="button"
                    className="app-btn app-btn--secondary app-btn--sm"
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteText("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn--primary app-btn--sm"
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim() || savingNewNote}
                  >
                    {savingNewNote ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            </LayerTheme>
          )}

          {/* Notes list */}
          {filteredNotes.length === 0 ? (
            <LayerTheme radius="var(--radius-sm)" padding="var(--space-6)" gap="var(--space-2)" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px" }}>📝</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)" }}>
                {notes.length === 0 ? "No notes yet" : "No notes match this filter"}
              </div>
              <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", fontSize: "13px", margin: 0 }}>
                {notes.length === 0
                  ? canEdit
                    ? "Use “Add note” to create the first one."
                    : "No notes have been added to this job."
                  : "Try a different filter or clear the search."}
              </p>
            </LayerTheme>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                maxHeight: isMobile ? "none" : "min(70vh, 820px)",
                overflowY: isMobile ? "visible" : "auto",
                paddingRight: isMobile ? 0 : "4px",
              }}
            >
              {filteredNotes.map((note) => {
                const meta = deriveNoteMeta(note);
                const isSelected = note.noteId === selectedNoteId;
                const isPinned = pinnedIds.has(note.noteId);
                const isHighlighted = highlightedNoteIdSet.has(note.noteId);
                const isEditing = editingNoteId === note.noteId;

                return (
                  <LayerTheme
                    key={note.noteId}
                    radius="var(--radius-sm)"
                    padding="var(--space-4)"
                    gap="var(--space-2)"
                    style={{
                      minWidth: 0,
                      // Selection / highlight rings via box-shadow (never a border).
                      boxShadow: isSelected
                        ? "var(--focus-ring, 0 0 0 2px var(--accent-strong))"
                        : isHighlighted
                        ? "0 0 0 2px var(--success-base)"
                        : "none",
                    }}
                  >
                    {/* Row header: title + pin + visibility */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-2)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedNoteId(note.noteId)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: 700,
                            color: "var(--accentText)",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {meta.title}
                        </span>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-1)",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {note.noteText}
                        </span>
                      </button>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flex: "0 0 auto" }}>
                        <button
                          type="button"
                          onClick={() => togglePin(note.noteId)}
                          title={isPinned ? "Unpin note" : "Pin note"}
                          aria-label={isPinned ? "Unpin note" : "Pin note"}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "16px",
                            lineHeight: 1,
                            padding: "2px",
                            opacity: isPinned ? 1 : 0.4,
                          }}
                        >
                          📌
                        </button>
                        <span
                          className={`app-badge ${note.hiddenFromCustomer ? "app-badge--warning" : "app-badge--success"}`}
                        >
                          {note.hiddenFromCustomer ? "Internal" : "Customer"}
                        </span>
                      </div>
                    </div>

                    {/* Inline editor (when editing this note) */}
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onInput={(e) => {
                            e.currentTarget.style.height = "auto";
                            e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 260)}px`;
                          }}
                          style={{
                            width: "100%",
                            minHeight: "80px",
                            maxHeight: "260px",
                            padding: "12px",
                            borderRadius: "var(--radius-xs)",
                            fontSize: "14px",
                            lineHeight: 1.6,
                            resize: "none",
                            overflowY: "auto",
                            background: "var(--surface)",
                            color: "var(--text-1)",
                          }}
                        />
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <button
                            type="button"
                            className="app-btn app-btn--primary app-btn--sm"
                            onClick={() => handleSaveEdit(note.noteId)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn--secondary app-btn--sm"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Footer: by who + date + quick actions */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "var(--space-2)",
                            flexWrap: "wrap",
                            ...metaStyle,
                          }}
                        >
                          <span style={{ overflowWrap: "anywhere" }}>
                            {note.createdBy} · {formatDateTime(note.createdAt)}
                          </span>
                          {/* Edit / Link / Delete actions live only in the detail panel (right column). */}
                        </div>
                      </>
                    )}
                  </LayerTheme>
                );
              })}
            </div>
          )}
        </LayerSurface>

        {/* ---- RIGHT 30%: selected note detail ---- */}
        <LayerSurface
          sectionKey="jobcard-notes-detail"
          parentKey="jobcard-tab-content-shell"
          gap="var(--space-4)"
          style={{ minWidth: 0, position: isMobile ? "static" : "sticky", top: "12px" }}
        >
          <p style={eyebrowStyle}>Note details</p>

          {!selectedNote ? (
            <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", margin: 0 }}>
              Select a note from the list to see its details.
            </p>
          ) : (
            (() => {
              const meta = deriveNoteMeta(selectedNote);
              const linkLabel = resolveLinkLabel(selectedNote);
              const wasUpdated =
                selectedNote.updatedAt && selectedNote.updatedAt !== selectedNote.createdAt;
              const authorGroup = roleGroupOf(selectedNote.createdByRole);
              const timeline = [
                { label: "Created", who: selectedNote.createdBy, when: selectedNote.createdAt, tone: "var(--accent-strong)" },
                ...(wasUpdated
                  ? [{ label: "Updated", who: selectedNote.lastUpdatedBy, when: selectedNote.updatedAt, tone: "var(--theme-hover)" }]
                  : []),
                ...(linkLabel
                  ? [{ label: `Linked — ${linkLabel}`, who: "", when: null, tone: "var(--theme-hover)" }]
                  : []),
              ];

              return (
                <>
                  {/* Fields grid */}
                  <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-3)">
                    <div
                      style={{
                        display: "grid",
                        gap: "var(--space-3)",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <span style={fieldLabelStyle}>Category</span>
                        <span className="app-badge app-badge--control">{meta.category}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <span style={fieldLabelStyle}>Created by</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-1)", overflowWrap: "anywhere" }}>
                          {selectedNote.createdBy}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <span style={fieldLabelStyle}>Created date</span>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                          {formatDateTime(selectedNote.createdAt)}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <span style={fieldLabelStyle}>Updated date</span>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                          {wasUpdated ? formatDateTime(selectedNote.updatedAt) : "—"}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-1)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {selectedNote.noteText}
                    </div>
                  </LayerTheme>

                  {/* Linked request data */}
                  {meta.category === "Customer Request" && (
                    <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-3)">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <span style={fieldLabelStyle}>Linked request</span>
                        <span className="app-badge app-badge--control">{meta.title}</span>
                      </div>
                      {meta.request ? (
                        <>
                          <div
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: 700,
                              color: "var(--text-1)",
                              lineHeight: 1.5,
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {meta.request.text || "No request description saved."}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: "var(--space-3)",
                              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <span style={fieldLabelStyle}>Status</span>
                              <span className="app-badge app-badge--control">{formatRequestStatusLabel(meta.request.status)}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <span style={fieldLabelStyle}>Type</span>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-1)", overflowWrap: "anywhere" }}>
                                {meta.request.jobType || "Unknown"}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <span style={fieldLabelStyle}>Labour time</span>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                                {meta.request.hours !== null && meta.request.hours !== undefined && meta.request.hours !== ""
                                  ? `${meta.request.hours}h`
                                  : "Unknown"}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <span style={fieldLabelStyle}>Request created</span>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                                {meta.request.createdAt ? formatDateTime(meta.request.createdAt) : "Unknown"}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <span style={fieldLabelStyle}>Request updated</span>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                                {meta.request.updatedAt ? formatDateTime(meta.request.updatedAt) : "Unknown"}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                              <span style={fieldLabelStyle}>Linked by</span>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-1)", overflowWrap: "anywhere" }}>
                                {selectedNote.lastUpdatedBy || selectedNote.createdBy || "Unknown"}
                              </span>
                            </div>
                          </div>
                          {meta.request.noteText ? (
                            <div style={{ fontSize: "0.82rem", color: "rgba(var(--text-1-rgb), 0.75)", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                              {meta.request.noteText}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", fontSize: "0.85rem", margin: 0 }}>
                          This note is saved against {meta.title}, but that request is not in the current job request list.
                        </p>
                      )}
                    </LayerTheme>
                  )}

                  {/* Activity timeline */}
                  <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-3)">
                    <span style={fieldLabelStyle}>Activity timeline</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      {timeline.map((event, index) => (
                        <div key={`${event.label}-${index}`} style={{ display: "flex", gap: "var(--space-3)", alignItems: "stretch" }}>
                          <div style={{ position: "relative", width: "12px", flex: "0 0 12px", display: "flex", justifyContent: "center" }}>
                            {index < timeline.length - 1 && (
                              <span aria-hidden style={{ position: "absolute", top: "12px", bottom: "-12px", width: "2px", background: "var(--theme-hover)" }} />
                            )}
                            <span aria-hidden style={{ position: "absolute", top: "2px", width: "12px", height: "12px", borderRadius: "var(--radius-pill)", background: event.tone }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)", overflowWrap: "anywhere" }}>
                              {event.label}
                            </span>
                            <span style={metaStyle}>
                              {[event.who, event.when ? formatDateTime(event.when) : ""].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </LayerTheme>

                  {/* Visible to + Edit access */}
                  <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-3)">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
                      <span style={fieldLabelStyle}>Visible to</span>
                      {canEdit && (
                        <button
                          type="button"
                          className="app-btn app-btn--secondary app-btn--xs"
                          onClick={() => setEditingAccess((v) => !v)}
                        >
                          {editingAccess ? "Done" : "Edit access"}
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
                      {/* Author's role group always has access; other staff roles do too. */}
                      <span className="app-badge app-badge--success">
                        {ROLE_GROUP_LABELS[authorGroup] || "Staff"}
                      </span>
                      <span className="app-badge app-badge--control">All staff</span>
                      <span className={`app-badge ${selectedNote.hiddenFromCustomer ? "app-badge--control" : "app-badge--success"}`} style={selectedNote.hiddenFromCustomer ? { opacity: 0.5 } : undefined}>
                        Customer {selectedNote.hiddenFromCustomer ? "(hidden)" : "(visible)"}
                      </span>

                      {/* Explicitly-granted viewers (public.note_viewers). */}
                      {noteViewers.map((viewer) => (
                        <span
                          key={viewer.userId}
                          className="app-badge app-badge--accent-soft"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          {viewer.name}
                          {editingAccess && canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveViewer(viewer.userId)}
                              title={`Remove ${viewer.name}`}
                              aria-label={`Remove ${viewer.name}`}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer",
                                fontSize: "13px",
                                lineHeight: 1,
                                padding: 0,
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {editingAccess && canEdit && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-2)",
                          paddingTop: "var(--space-2)",
                          borderTop: "var(--separating-line)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "var(--space-2)",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                            Customer can view this note
                          </span>
                          <button
                            type="button"
                            className={`app-btn app-btn--sm ${selectedNote.hiddenFromCustomer ? "app-btn--secondary" : "app-btn--primary"}`}
                            onClick={() => handleToggleHiddenFromCustomer(selectedNote)}
                          >
                            {selectedNote.hiddenFromCustomer ? "Make visible" : "Make internal"}
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "var(--space-2)",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
                            Give a specific staff member access
                          </span>
                          <button
                            type="button"
                            className="app-btn app-btn--secondary app-btn--sm"
                            onClick={() => {
                              setViewerToAdd("");
                              setShowAddViewer(true);
                            }}
                          >
                            + Add user
                          </button>
                        </div>
                        {viewersLoading && (
                          <InlineLoading width={110} height={12} label="Loading viewers" />
                        )}
                      </div>
                    )}
                  </LayerTheme>

                  {/* Detail actions */}
                  {canEdit && (
                    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleEditNote(selectedNote)}>
                        Edit note
                      </button>
                      <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => setLinkingNote(selectedNote)}>
                        Link
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn--secondary app-btn--sm"
                        onClick={() => togglePin(selectedNote.noteId)}
                      >
                        {pinnedIds.has(selectedNote.noteId) ? "Unpin" : "Pin"}
                      </button>
                      <button type="button" className="app-btn app-btn--danger app-btn--sm" onClick={() => handleDeleteNote(selectedNote.noteId)}>
                        Delete
                      </button>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </LayerSurface>
      </div>

      {/* ============================================================= */}
      {/* History (toggled from the overview toolbar)                   */}
      {/* ============================================================= */}
      {showHistory && (
        <LayerSurface
          sectionKey="jobcard-tab-notes-history"
          parentKey="jobcard-tab-content-shell"
          gap="var(--layout-card-gap)"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accentText)" }}>History notes</div>
              <div style={{ fontSize: "12px", color: "var(--text-1)", marginTop: "4px" }}>
                Notes grouped by jobcard for this vehicle history.
              </div>
            </div>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--control-bg)",
                color: "var(--text-1)",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {historyJobsWithNotes.length} jobcard{historyJobsWithNotes.length === 1 ? "" : "s"}
            </span>
          </div>

          {historyJobsWithNotes.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-1)" }}>
              No history notes have been added for this vehicle yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {historyJobsWithNotes.map((job) => (
                <LayerTheme key={job.id || job.jobNumber} radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-2)">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>
                      Jobcard {job.jobNumber || "Unknown"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-1)" }}>
                      {job.serviceDateFormatted || "Date unknown"}
                      {job.mileage ? ` | ${job.mileage} miles` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {job.notes.map((note, index) => (
                      <div
                        key={note.noteId || `${job.id || job.jobNumber}-note-${index}`}
                        style={{
                          padding: "10px 0",
                          // Row separators are the one allowed in-list line (CLAUDE.md §3.0a).
                          borderBottom: index === job.notes.length - 1 ? "none" : "var(--separating-line)",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: "12px",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-1)" }}>
                            {formatDateTime(note.createdAt || note.created_at)}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-1)", marginTop: "2px", overflowWrap: "anywhere" }}>
                            {note.createdBy || "Unknown"}
                            {note.createdByEmail ? ` (${note.createdByEmail})` : ""}
                          </div>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          {note.noteText || note.note_text}
                        </div>
                      </div>
                    ))}
                  </div>
                </LayerTheme>
              ))}
            </div>
          )}
        </LayerSurface>
      )}

      {/* ============================================================= */}
      {/* Add viewer modal — grant a staff member access to the note    */}
      {/* ============================================================= */}
      {showAddViewer &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const existingViewerIds = new Set(noteViewers.map((viewer) => viewer.userId));
            const availableStaff = staffOptions.filter(
              (staff) => !existingViewerIds.has(staff.id)
            );
            const staffSelectOptions = availableStaff.map((staff) => ({
              value: String(staff.id),
              label: staff.role ? `${staff.name} · ${staff.role}` : staff.name,
            }));

            return (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(10, 10, 20, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 230,
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--section-card-padding)",
                    width: "min(420px, 100%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accentText)" }}>Add viewer</div>
                    <button
                      type="button"
                      className="app-btn app-btn--secondary app-btn--sm"
                      onClick={() => {
                        setShowAddViewer(false);
                        setViewerToAdd("");
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <span style={{ fontSize: "13px", color: "rgba(var(--text-1-rgb), 0.7)" }}>
                    Select a staff member to give access to this note.
                  </span>

                  {staffSelectOptions.length === 0 ? (
                    <span style={{ fontSize: "13px", color: "rgba(var(--text-1-rgb), 0.6)" }}>
                      All active staff already have access.
                    </span>
                  ) : (
                    <DropdownField
                      options={staffSelectOptions}
                      value={viewerToAdd}
                      onValueChange={(value) => setViewerToAdd(value)}
                      placeholder="Select a staff member…"
                      ariaLabel="Select staff member to add"
                      style={{ width: "100%" }}
                    />
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      className="app-btn app-btn--secondary app-btn--sm"
                      onClick={() => {
                        setShowAddViewer(false);
                        setViewerToAdd("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="app-btn app-btn--primary app-btn--sm"
                      onClick={handleAddViewer}
                      disabled={!viewerToAdd || staffSelectOptions.length === 0}
                    >
                      Add viewer
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}

      {/* ============================================================= */}
      {/* Link note modal (unchanged behaviour)                         */}
      {/* ============================================================= */}
      {linkingNote &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(10, 10, 20, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: "var(--z-modal)",
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: "var(--radius-md)",
                padding: "var(--section-card-padding)",
                width: "min(520px, 100%)",
                maxHeight: "85vh",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accentText)" }}>Link note</div>
                <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => setLinkingNote(null)}>
                  Close
                </button>
              </div>
              <button
                type="button"
                className="app-btn app-btn--secondary app-btn--sm"
                style={{ alignSelf: "flex-start" }}
                onClick={() => handleLinkNote(linkingNote, { clear: true })}
              >
                Clear link
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginBottom: "8px" }}>
                    Customer requests
                  </div>
                  {requestOptions.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "rgba(var(--text-1-rgb), 0.6)" }}>No requests available.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {requestOptions.map((req) => {
                        const activeNote = notes.find((note) => note.noteId === linkingNote.noteId) || linkingNote;
                        const isSelected = isLinkedToRequest(activeNote, req.requestIndex);
                        return (
                          <button
                            key={`request-link-${req.requestId || req.requestIndex}`}
                            type="button"
                            onClick={() => handleLinkNote(activeNote, { linkedRequestIndex: req.requestIndex })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "var(--radius-sm)",
                              border: "none",
                              backgroundColor: isSelected ? "var(--success-surface)" : "var(--theme)",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "13px",
                              color: isSelected ? "var(--success-dark)" : "var(--text-1)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <span>
                              Request {req.requestIndex}: {req.text || "No request description saved."}
                            </span>
                            {isSelected && <span style={{ fontSize: "11px", fontWeight: 700 }}>Selected</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginBottom: "8px" }}>
                    Authorised items
                  </div>
                  {authorisedItems.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "rgba(var(--text-1-rgb), 0.6)" }}>No authorised items available.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {authorisedItems.map((item) => {
                        const itemId = item.vhc_id ?? item.id;
                        const activeNote = notes.find((note) => note.noteId === linkingNote.noteId) || linkingNote;
                        const isSelected = isLinkedToAuthorised(activeNote, item);
                        return (
                          <button
                            key={`authorized-link-${itemId}`}
                            type="button"
                            onClick={() => handleLinkNote(activeNote, { linkedVhcId: itemId })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "var(--radius-sm)",
                              border: "none",
                              backgroundColor: isSelected ? "var(--success-surface)" : "var(--theme)",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "13px",
                              color: isSelected ? "var(--success-dark)" : "var(--text-1)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <span>{item.issue_title || item.section}</span>
                            {isSelected && <span style={{ fontSize: "11px", fontWeight: 700 }}>Selected</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginBottom: "8px" }}>
                    Authorised parts
                  </div>
                  {authorisedParts.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "rgba(var(--text-1-rgb), 0.6)" }}>No authorised parts available.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {authorisedParts.map((part) => {
                        const activeNote = notes.find((note) => note.noteId === linkingNote.noteId) || linkingNote;
                        const partId = part.partId ?? part.part_id ?? part.id;
                        const partLabel =
                          part.part?.name ||
                          part.part?.part_number ||
                          part.part_number ||
                          part.partNumber ||
                          "Authorised part";
                        const isSelected = isLinkedToPart(activeNote, partId);
                        return (
                          <button
                            key={`authorized-part-link-${partId}`}
                            type="button"
                            onClick={() => handleLinkNote(activeNote, { linkedPartId: partId })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "var(--radius-sm)",
                              border: "none",
                              backgroundColor: isSelected ? "var(--success-surface)" : "var(--theme)",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "13px",
                              color: isSelected ? "var(--success-dark)" : "var(--text-1)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <span>{partLabel}</span>
                            {isSelected && <span style={{ fontSize: "11px", fontWeight: 700 }}>Selected</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
