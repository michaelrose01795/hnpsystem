// file location: src/components/Clocking/EfficiencyTab.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getEfficiencyTechnicians,
  getEfficiencyEntries,
  getAllEfficiencyEntries,
  getJobClockingAsEfficiency,
  getAllTechTargets,
  addEfficiencyEntry,
  updateEfficiencyEntry,
  deleteEfficiencyEntry,
  upsertTechTarget,
  calculateTechTotals,
  calculateOverallTotals,
  TECH_NAMES,
} from "@/lib/database/efficiency";
import ModalPortal from "@/components/popups/ModalPortal";
import { CalendarField } from "@/components/calendarAPI";
import { DropdownField } from "@/components/dropdownAPI";
import { supabase } from "@/lib/supabaseClient";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const toYmd = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseYmd = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getWeekStartMonday = (date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const roundHours = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const formatHours = (value) => roundHours(value).toFixed(2);

const buildRequestOptions = (jobNumberValue, requestRows) => {
  const trimmed = jobNumberValue.trim();
  if (!trimmed) return [];
  const totalAllocatedHours = (Array.isArray(requestRows) ? requestRows : []).reduce((sum, request) => {
    const hours = Number(request?.hours);
    return Number.isFinite(hours) ? sum + hours : sum;
  }, 0);
  const options = [
    {
      value: "job",
      label: `Job: ${trimmed}`,
      description:
        totalAllocatedHours > 0
          ? `${formatHours(totalAllocatedHours)}h allocated total`
          : "Clock onto the whole job",
      allocatedHours: totalAllocatedHours > 0 ? roundHours(totalAllocatedHours) : null,
    },
  ];

  (Array.isArray(requestRows) ? requestRows : []).forEach((request, index) => {
    const order =
      request?.sort_order !== null && request?.sort_order !== undefined
        ? request.sort_order
        : index + 1;
    const requestId = request?.request_id ?? request?.id ?? null;
    if (!requestId) return;
    const description = request?.description || `Request ${order}`;
    options.push({
      value: `request:${requestId}`,
      label: `Req ${order}: ${description}`,
      description: request?.hours ? `${formatHours(request.hours)}h allocated` : "",
      allocatedHours: request?.hours !== null && request?.hours !== undefined
        ? roundHours(request.hours)
        : null,
    });
  });

  return options;
};

/**
 * EfficiencyTab - shows efficiency data for technicians.
 *
 * Props:
 *   editable        - boolean: whether entries can be added/edited/deleted
 *   filterUserId    - number|null: if set, only show Overall + this tech's tab
 *   editableUserId  - number|null: if set, only this user's tab is editable (others read-only)
 */
export default function EfficiencyTab({
  editable = false,
  filterUserId = null,
  editableUserId = null,
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [technicians, setTechnicians] = useState([]);
  const [activeTab, setActiveTab] = useState("overall");
  const [entries, setEntries] = useState([]);
  const [targets, setTargets] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodFilter, setPeriodFilter] = useState("month");
  const [filterDate, setFilterDate] = useState(toYmd(now));
  const [overviewTechFilter, setOverviewTechFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state for add/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formDate, setFormDate] = useState("");
  const [formJobNumber, setFormJobNumber] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAllocatedHours, setFormAllocatedHours] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDayType, setFormDayType] = useState("weekday");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [jobLookupState, setJobLookupState] = useState("idle");

  // Job request lookup state (matches Start Job popup pattern)
  const [selectedRequestValue, setSelectedRequestValue] = useState("job");
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [requestOptions, setRequestOptions] = useState([]);
  const lastJobNumberRef = useRef("");

  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Overall tab detail popup state
  const [detailPopupTechId, setDetailPopupTechId] = useState(null);
  const [detailPopupTargetTech, setDetailPopupTargetTech] = useState(null);

  // Detail popup edit mode (editing target hours / weight)
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailEditTargetHours, setDetailEditTargetHours] = useState("");
  const [detailEditWeight, setDetailEditWeight] = useState("");
  const [detailEditSubmitting, setDetailEditSubmitting] = useState(false);
  const [detailEditError, setDetailEditError] = useState("");

  // Load technicians
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const techs = await getEfficiencyTechnicians();
        if (!cancelled) setTechnicians(techs);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load technicians.");
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Filter tabs based on filterUserId
  const visibleTechs = useMemo(() => {
    if (!filterUserId) return technicians;
    return technicians.filter((t) => t.user_id === filterUserId);
  }, [technicians, filterUserId]);

  const allUserIds = useMemo(
    () => technicians.map((t) => t.user_id),
    [technicians]
  );

  // Fetch entries and targets when month/year or technicians change
  const fetchData = useCallback(async () => {
    if (allUserIds.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const [manualEntries, clockingEntries, allTargets] = await Promise.all([
        getAllEfficiencyEntries(allUserIds, selectedYear, selectedMonth),
        getJobClockingAsEfficiency(allUserIds, selectedYear, selectedMonth),
        getAllTechTargets(allUserIds),
      ]);
      // Merge manual entries + job_clocking entries, clocking entries first then manual
      const merged = [...clockingEntries, ...manualEntries];
      // Sort by date ascending
      merged.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      setEntries(merged);
      setTargets(allTargets);
    } catch (err) {
      setError(err?.message || "Failed to load efficiency data.");
    } finally {
      setLoading(false);
    }
  }, [allUserIds, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription: refresh when efficiency data or job clocking changes
  useEffect(() => {
    const channel = supabase.channel("efficiency-entries-live");
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tech_efficiency_entries" },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tech_efficiency_targets" },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_clocking" },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Set default active tab when filterUserId is set
  useEffect(() => {
    if (filterUserId && visibleTechs.length > 0 && activeTab === "overall") {
      // Keep overall as default - it's fine
    }
  }, [filterUserId, visibleTechs, activeTab]);

  useEffect(() => {
    const current = parseYmd(filterDate);
    if (current && current.getFullYear() === selectedYear && current.getMonth() + 1 === selectedMonth) {
      return;
    }
    setFilterDate(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`);
  }, [filterDate, selectedMonth, selectedYear]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filterDateValue = useMemo(() => {
    const parsed = parseYmd(filterDate);
    if (parsed) return parsed;
    return new Date(selectedYear, selectedMonth - 1, 1);
  }, [filterDate, selectedMonth, selectedYear]);

  const periodFilteredEntries = useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    const filterDayYmd = toYmd(filterDateValue);
    const filterWeekStart = getWeekStartMonday(filterDateValue);
    const filterWeekEnd = new Date(filterWeekStart);
    filterWeekEnd.setDate(filterWeekStart.getDate() + 7);

    return entries.filter((entry) => {
      if (!entry?.date) return false;
      if (periodFilter === "month") return true;
      if (periodFilter === "day") {
        return entry.date === filterDayYmd;
      }
      if (periodFilter === "week") {
        const entryDate = parseYmd(entry.date);
        if (!entryDate) return false;
        return entryDate >= filterWeekStart && entryDate < filterWeekEnd;
      }
      return true;
    });
  }, [entries, filterDateValue, periodFilter]);

  const searchedEntries = useMemo(() => {
    if (!normalizedSearch) return periodFilteredEntries;
    return periodFilteredEntries.filter((entry) => {
      const jobNumber = String(entry.job_number || "").toLowerCase();
      const description = String(entry.job_description || "").toLowerCase();
      const notes = String(entry.notes || "").toLowerCase();
      const hoursSpent = String(entry.hours_spent ?? "").toLowerCase();
      const allocatedHours = String(entry.allocated_hours ?? "").toLowerCase();
      return (
        jobNumber.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        notes.includes(normalizedSearch) ||
        hoursSpent.includes(normalizedSearch) ||
        allocatedHours.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, periodFilteredEntries]);

  const overviewEntries = useMemo(() => {
    if (overviewTechFilter === "all") return searchedEntries;
    const selectedTechId = Number(overviewTechFilter);
    if (!Number.isFinite(selectedTechId)) return searchedEntries;
    return searchedEntries.filter((entry) => entry.user_id === selectedTechId);
  }, [overviewTechFilter, searchedEntries]);

  // Group entries by user
  const entriesByUser = useMemo(() => {
    const map = new Map();
    searchedEntries.forEach((e) => {
      if (!map.has(e.user_id)) map.set(e.user_id, []);
      map.get(e.user_id).push(e);
    });
    return map;
  }, [searchedEntries]);

  // Per-tech summaries (respecting current filters/search)
  const techSummaries = useMemo(() => {
    return visibleTechs.map((tech) => {
      const techEntries = entriesByUser.get(tech.user_id) || [];
      const target = targets.get(tech.user_id) || { monthlyTargetHours: 160, weight: 1.0 };
      const totals = calculateTechTotals(techEntries, target);
      return {
        tech,
        entries: techEntries,
        target,
        totals,
        weight: target.weight,
      };
    });
  }, [entriesByUser, targets, visibleTechs]);

  const overviewTechSummaries = useMemo(() => {
    if (overviewTechFilter === "all") return techSummaries;
    const selectedTechId = Number(overviewTechFilter);
    return techSummaries.filter((summary) => summary.tech.user_id === selectedTechId);
  }, [overviewTechFilter, techSummaries]);

  // Overall totals (respecting filters/search + optional overview tech filter)
  const overallTotals = useMemo(
    () => calculateOverallTotals(overviewTechSummaries),
    [overviewTechSummaries]
  );

  // Current tab data
  const activeTechId =
    activeTab === "overall" ? null : Number(activeTab);
  const activeSummary = activeTechId
    ? techSummaries.find((s) => s.tech.user_id === activeTechId)
    : null;

  const totalsForFilteredSet = useMemo(() => {
    const sourceEntries = activeTab === "overall" ? overviewEntries : activeSummary?.entries || [];
    return sourceEntries.reduce(
      (acc, entry) => {
        const logged = Number(entry.hours_spent || 0);
        const allocated = Number(entry.allocated_hours || 0);
        acc.logged += logged;
        acc.allocated += allocated;
        return acc;
      },
      { logged: 0, allocated: 0 }
    );
  }, [activeSummary?.entries, activeTab, overviewEntries]);

  const filteredSetDifference = Number(
    (totalsForFilteredSet.logged - totalsForFilteredSet.allocated).toFixed(2)
  );

  const isTabEditable =
    editable &&
    activeTechId != null &&
    (editableUserId == null || editableUserId === activeTechId);

  // Detail popup data
  const detailPopupSummary = detailPopupTechId
    ? techSummaries.find((s) => s.tech.user_id === detailPopupTechId)
    : null;
  const isDetailPopupEditable =
    editable &&
    detailPopupTechId != null &&
    (editableUserId == null || editableUserId === detailPopupTechId);

  const openDetailPopup = (techUserId) => {
    setDetailPopupTechId(techUserId);
    setDetailEditMode(false);
    setDetailEditError("");
  };

  const closeDetailPopup = () => {
    setDetailPopupTechId(null);
    setDetailEditMode(false);
    setDetailEditError("");
  };

  const startDetailEdit = () => {
    if (!detailPopupSummary) return;
    setDetailEditTargetHours(String(detailPopupSummary.target.monthlyTargetHours));
    setDetailEditWeight(String(detailPopupSummary.weight));
    setDetailEditError("");
    setDetailEditMode(true);
  };

  const cancelDetailEdit = () => {
    setDetailEditMode(false);
    setDetailEditError("");
  };

  const saveDetailEdit = async () => {
    const hrs = Number(detailEditTargetHours);
    const wt = Number(detailEditWeight);
    if (!detailEditTargetHours || Number.isNaN(hrs) || hrs <= 0) {
      setDetailEditError("Target hours must be greater than 0.");
      return;
    }
    if (!detailEditWeight || Number.isNaN(wt) || wt < 0 || wt > 1) {
      setDetailEditError("Weight must be between 0 and 1.");
      return;
    }
    setDetailEditSubmitting(true);
    setDetailEditError("");
    try {
      await upsertTechTarget(detailPopupTechId, {
        monthlyTargetHours: hrs,
        weight: wt,
      });
      setDetailEditMode(false);
      await fetchData();
    } catch (err) {
      setDetailEditError(err?.message || "Failed to save.");
    } finally {
      setDetailEditSubmitting(false);
    }
  };

  // Open add modal targeted at a specific tech (from detail popup)
  const openAddModalForTech = (techUserId) => {
    setEditingEntry(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormJobNumber("");
    setFormDescription("");
    setFormAllocatedHours("");
    setFormHours("");
    setFormNotes("");
    setFormDayType("weekday");
    setFormError("");
    setJobLookupState("idle");
    resetRequestState();
    // Temporarily store target tech ID for the add operation
    setDetailPopupTargetTech(techUserId);
    setModalOpen(true);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Reset request-related state
  const resetRequestState = () => {
    setSelectedRequestValue("job");
    setSelectedRequestId(null);
    setRequestOptions([]);
    lastJobNumberRef.current = "";
  };

  // Modal handlers
  const openAddModal = () => {
    setEditingEntry(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormJobNumber("");
    setFormDescription("");
    setFormAllocatedHours("");
    setFormHours("");
    setFormNotes("");
    setFormDayType("weekday");
    setFormError("");
    setJobLookupState("idle");
    resetRequestState();
    setModalOpen(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormJobNumber(entry.job_number || "");
    setFormDescription(entry.job_description || "");
    setFormAllocatedHours(
      entry.allocated_hours !== null && entry.allocated_hours !== undefined
        ? formatHours(entry.allocated_hours)
        : ""
    );
    setFormHours(formatHours(entry.hours_spent));
    setFormNotes(entry.notes || "");
    setFormDayType(entry.day_type);
    setFormError("");
    setJobLookupState("idle");
    resetRequestState();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEntry(null);
    setFormError("");
    setFormSubmitting(false);
    setDetailPopupTargetTech(null);
    setJobLookupState("idle");
    resetRequestState();
  };

  // Load job requests when job number changes (same pattern as Start Job popup)
  useEffect(() => {
    if (!modalOpen) return;
    const trimmed = formJobNumber.trim();
    if (!trimmed) {
      setRequestOptions([]);
      setSelectedRequestValue("job");
      setSelectedRequestId(null);
      setJobLookupState("idle");
      lastJobNumberRef.current = "";
      return;
    }

    if (trimmed !== lastJobNumberRef.current) {
      setSelectedRequestValue("job");
      setSelectedRequestId(null);
      lastJobNumberRef.current = trimmed;
    }

    let isMounted = true;
    const fallbackOptions = buildRequestOptions(trimmed, []);
    setRequestOptions(fallbackOptions);
    setJobLookupState("loading");

    const loadRequests = async () => {
      try {
        // Look up the job by job_number
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("id, job_number, description")
          .ilike("job_number", trimmed)
          .maybeSingle();

        if (jobError || !jobData?.id) {
          if (!isMounted) return;
          setJobLookupState("unmatched");
          setRequestOptions(fallbackOptions);
          return;
        }

        if (!isMounted) return;
        setJobLookupState("matched");
        if (!formDescription.trim() && jobData.description) {
          setFormDescription(jobData.description);
        }

        const { data, error } = await supabase
          .from("job_requests")
          .select("request_id, description, hours, sort_order")
          .eq("job_id", Number(jobData.id))
          .order("sort_order", { ascending: true });
        if (error) throw error;
        if (!isMounted) return;
        const nextOptions = buildRequestOptions(trimmed, data || []);
        setRequestOptions(nextOptions);
      } catch (err) {
        console.warn("Failed to load job requests:", err);
        if (!isMounted) return;
        setJobLookupState("unmatched");
        setRequestOptions(fallbackOptions);
      }
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [formJobNumber, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!formJobNumber.trim()) return;
    const selected = requestOptions.find((option) => option.value === selectedRequestValue);
    if (!selected || selected.allocatedHours === null || selected.allocatedHours === undefined) return;
    setFormAllocatedHours(formatHours(selected.allocatedHours));
  }, [formJobNumber, modalOpen, requestOptions, selectedRequestValue]);

  // Derive the final job_number string to save (includes request context)
  const resolveJobNumberForSave = () => {
    const baseJobNumber = formJobNumber.trim();
    if (!baseJobNumber) {
      return null;
    }
    if (!selectedRequestValue || selectedRequestValue === "job") {
      return baseJobNumber;
    }
    const selected = requestOptions.find((o) => o.value === selectedRequestValue);
    if (selected) {
      return `${baseJobNumber} - ${selected.label}`;
    }
    return baseJobNumber;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formDate) { setFormError("Date is required."); return; }
    if (!formJobNumber.trim() && !formDescription.trim()) {
      setFormError("Enter a job number or a job description.");
      return;
    }
    const hours = Number(formHours);
    if (!formHours || Number.isNaN(hours) || hours < 0.1) {
      setFormError("Total clocked must be at least 0.1 hours.");
      return;
    }
    const allocatedHoursParsed =
      formAllocatedHours === "" ? null : Number(formAllocatedHours);
    if (
      formAllocatedHours !== "" &&
      (Number.isNaN(allocatedHoursParsed) || allocatedHoursParsed < 0.1)
    ) {
      setFormError("Allocated hours must be at least 0.1 when provided.");
      return;
    }
    if (!formDayType) { setFormError("Day type is required."); return; }

    const jobNumberToSave = resolveJobNumberForSave();
    const normalizedHours = roundHours(hours);
    const normalizedAllocatedHours =
      allocatedHoursParsed === null ? null : roundHours(allocatedHoursParsed);

    setFormSubmitting(true);
    try {
      if (editingEntry) {
        await updateEfficiencyEntry(editingEntry.id, {
          date: formDate,
          jobNumber: jobNumberToSave,
          hoursSpent: normalizedHours,
          notes: formNotes.trim(),
          jobDescription: formDescription.trim(),
          allocatedHours: normalizedAllocatedHours,
          dayType: formDayType,
        });
      } else {
        const targetUserId = activeTechId || detailPopupTargetTech;
        await addEfficiencyEntry({
          userId: targetUserId,
          date: formDate,
          jobNumber: jobNumberToSave,
          hoursSpent: normalizedHours,
          notes: formNotes.trim(),
          jobDescription: formDescription.trim(),
          allocatedHours: normalizedAllocatedHours,
          dayType: formDayType,
        });
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError(err?.message || "Failed to save entry.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (entryId) => {
    setDeleteSubmitting(true);
    try {
      await deleteEfficiencyEntry(entryId);
      await fetchData();
    } catch (err) {
      setError(err?.message || "Failed to delete entry.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleDeleteFromEditModal = async () => {
    if (!editingEntry?.id) return;
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm("Delete this job entry?");
    if (!confirmed) return;
    await handleDelete(editingEntry.id);
    closeModal();
  };

  // Styles
  const tabBarStyle = {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    padding: "4px",
    borderRadius: "14px",
    background: "var(--surface-light)",
    border: "1px solid var(--surface-light)",
  };

  const tabStyle = (isActive) => ({
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    background: isActive ? "var(--primary)" : "transparent",
    color: isActive ? "var(--surface)" : "var(--primary-dark)",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  const monthNavStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  const monthBtnStyle = {
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
    color: "var(--primary-dark)",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
  };

  const sectionStyle = {
    background: "var(--surface)",
    borderRadius: "18px",
    padding: "24px",
    border: "1px solid var(--surface-light)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const statCardStyle = {
    borderRadius: "14px",
    padding: "16px",
    background: "var(--danger-surface)",
    border: "1px solid var(--surface-light)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  };

  const tableWrapperStyle = {
    borderRadius: "14px",
    border: "1px solid var(--surface-light)",
    overflow: "hidden",
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.9rem",
  };

  const thStyle = {
    textAlign: "left",
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--grey-accent)",
    background: "var(--surface-light)",
    borderBottom: "1px solid var(--surface-light)",
    padding: "12px 16px",
  };

  const tdStyle = {
    padding: "12px 16px",
    borderBottom: "1px solid var(--surface-light)",
    color: "var(--text-color)",
  };

  const effColor = (pct) => {
    if (pct >= 100) return "var(--success)";
    if (pct >= 80) return "var(--primary)";
    return "var(--danger)";
  };

  // Download PDF handler - generates a portrait B&W PDF with 31 rows
  const handleDownload = async () => {
    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
      const autoTableModule = await import("jspdf-autotable");

      // Register the plugin on jsPDF so doc.autoTable works
      if (autoTableModule.applyPlugin) {
        autoTableModule.applyPlugin(jsPDF);
      }

      const techName = activeSummary ? activeSummary.tech.first_name : "Overall";
      const title = activeTab === "overall"
        ? `Overall Efficiency - ${MONTHS[selectedMonth - 1]} ${selectedYear}`
        : `${techName} - ${MONTHS[selectedMonth - 1]} ${selectedYear}`;
      const fileName = activeTab === "overall"
        ? `efficiency-overall-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.pdf`
        : `efficiency-${techName.toLowerCase()}-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.pdf`;

      // Build existing entries map by day number
      const existingByDay = new Map();
      if (activeSummary) {
        activeSummary.entries.forEach((entry) => {
          const day = new Date(entry.date).getDate();
          if (!existingByDay.has(day)) existingByDay.set(day, []);
          existingByDay.get(day).push(entry);
        });
      }

      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const rows = [];
      for (let day = 1; day <= 31; day++) {
        const entriesForDay = existingByDay.get(day) || [];
        if (entriesForDay.length > 0) {
          entriesForDay.forEach((entry) => {
            rows.push([
              `${String(day).padStart(2, "0")}/${String(selectedMonth).padStart(2, "0")}/${selectedYear}`,
              entry.job_number || "",
              entry.hours_spent ? String(entry.hours_spent) : "",
              entry.notes || "",
              entry.day_type || "",
            ]);
          });
        } else {
          rows.push([
            day <= daysInMonth
              ? `${String(day).padStart(2, "0")}/${String(selectedMonth).padStart(2, "0")}/${selectedYear}`
              : "",
            "", "", "", "",
          ]);
        }
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, 10, 14);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text("Efficiency Timesheet", 10, 20);
      doc.setTextColor(0);

      // Table - use doc.autoTable after plugin is applied
      doc.autoTable({
        startY: 25,
        head: [["Date", "Job Number", "Hours Spent", "Notes", "Day Type"]],
        body: rows,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 32 },
          2: { cellWidth: 22 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 26 },
        },
        margin: { left: 10, right: 10 },
      });

      // Summary row below the table
      const finalY = (doc.lastAutoTable?.finalY ?? 280) + 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Actual Hours:", 10, finalY);
      doc.text("Target Hours:", 60, finalY);
      doc.text("Difference:", 110, finalY);
      doc.text("Efficiency:", 155, finalY);

      doc.save(fileName);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Combined row: Tabs + Month Nav + Print */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        {/* Tab bar */}
        <div style={{ ...tabBarStyle, flex: "1 1 auto" }}>
          <button
            type="button"
            style={tabStyle(activeTab === "overall")}
            onClick={() => setActiveTab("overall")}
          >
            Overall
          </button>
          {visibleTechs.map((tech) => (
            <button
              key={tech.user_id}
              type="button"
              style={tabStyle(activeTab === String(tech.user_id))}
              onClick={() => setActiveTab(String(tech.user_id))}
            >
              {tech.first_name}
            </button>
          ))}
        </div>

        {/* Month navigation */}
        <div style={{ ...monthNavStyle, flexShrink: 0 }}>
          <button type="button" style={monthBtnStyle} onClick={handlePrevMonth}>
            &lsaquo; Prev
          </button>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary-dark)", minWidth: "150px", textAlign: "center" }}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </span>
          <button type="button" style={monthBtnStyle} onClick={handleNextMonth}>
            Next &rsaquo;
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {activeTab !== "overall" && (
            <button
              type="button"
              onClick={handleDownload}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface)",
                color: "var(--primary-dark)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              &#8595; Download
            </button>
          )}
          {isTabEditable && activeTab !== "overall" && (
            <button
              type="button"
              onClick={openAddModal}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                background: "var(--primary)",
                color: "var(--surface)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              + Add Job Entry
            </button>
          )}
        </div>
      </div>

      <div style={{ ...sectionStyle, padding: "16px 18px", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "6px",
              borderRadius: "999px",
              backgroundColor: "var(--surface-light)",
              border: "1px solid var(--surface-light)",
              flex: "0 0 auto",
            }}
          >
            {["day", "week", "month"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPeriodFilter(mode)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border:
                    periodFilter === mode
                      ? "1px solid var(--primary)"
                      : "1px solid transparent",
                  backgroundColor: periodFilter === mode ? "var(--surface)" : "transparent",
                  color:
                    periodFilter === mode
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: periodFilter === mode ? 600 : 500,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          <div style={{ width: "fit-content", flex: "0 0 auto" }}>
            <CalendarField
              id="efficiencyFilterDate"
              className="compact-picker efficiency-filter-field efficiency-filter-calendar"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
            />
          </div>
          {activeTab === "overall" && (
            <div style={{ width: "fit-content", flex: "0 0 auto" }}>
              <DropdownField
                id="efficiencyOverviewTech"
                className="compact-picker efficiency-tech-filter-dropdown"
                value={overviewTechFilter}
                onChange={(event) => setOverviewTechFilter(event.target.value)}
                placeholder="All technicians"
                options={[
                  { key: "all", value: "all", label: "All technicians" },
                  ...visibleTechs.map((tech) => ({
                    key: `tech-${tech.user_id}`,
                    value: String(tech.user_id),
                    label: tech.first_name,
                  })),
                ]}
              />
            </div>
          )}
          <div style={{ width: "min(220px, 100%)", flex: "0 1 220px" }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search job number, logged time, description..."
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(var(--primary-rgb), 0.22)",
                background: "linear-gradient(180deg, rgba(var(--primary-rgb), 0.12), rgba(var(--primary-rgb), 0.06))",
                padding: "10px 16px",
                width: "100%",
                fontSize: "0.86rem",
                color: "var(--text-primary)",
                boxShadow: "inset 0 1px 0 rgba(var(--surface-rgb), 0.45)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          borderRadius: "14px",
          padding: "14px 18px",
          background: "var(--danger-surface)",
          border: "1px solid var(--danger)",
          color: "var(--danger)",
          fontSize: "0.9rem",
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={sectionStyle}>
          <p style={{ color: "var(--info)", margin: 0 }}>Loading efficiency data...</p>
        </div>
      )}

      {/* Overall Tab */}
      {!loading && activeTab === "overall" && (
        <>
          {/* Overall stats */}
          <div style={sectionStyle}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--primary-dark)" }}>
              Overall Efficiency - {MONTHS[selectedMonth - 1]} {selectedYear}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Logged Total
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {formatHours(totalsForFilteredSet.logged)}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Allocated Total
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {formatHours(totalsForFilteredSet.allocated)}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Logged - Allocated
                </span>
                <strong style={{ fontSize: "1.6rem", color: filteredSetDifference >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {filteredSetDifference >= 0 ? "+" : ""}{formatHours(Math.abs(filteredSetDifference))}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Weighted Actual
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {overallTotals.weightedActual}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Weighted Target
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {overallTotals.weightedTarget}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Difference
                </span>
                <strong style={{ fontSize: "1.6rem", color: overallTotals.difference >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {overallTotals.difference >= 0 ? "+" : ""}{overallTotals.difference}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Overall Efficiency
                </span>
                <strong style={{ fontSize: "1.6rem", color: effColor(overallTotals.efficiencyPct) }}>
                  {overallTotals.efficiencyPct}%
                </strong>
              </div>
            </div>
          </div>

          {/* Technician summary table */}
          <div style={sectionStyle}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--primary-dark)" }}>
              Technician Breakdown
            </h3>
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Technician</th>
                    <th style={thStyle}>Weight</th>
                    <th style={thStyle}>Actual Hours</th>
                    <th style={thStyle}>Target Hours</th>
                    <th style={thStyle}>Difference</th>
                    <th style={thStyle}>Efficiency %</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewTechSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--grey-accent)" }}>
                        No technicians configured.
                      </td>
                    </tr>
                  ) : (
                    overviewTechSummaries.map(({ tech, totals, weight }) => (
                      <tr
                        key={tech.user_id}
                        onClick={() => openDetailPopup(tech.user_id)}
                        style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-light)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{tech.first_name}</td>
                        <td style={tdStyle}>{(weight * 100).toFixed(0)}%</td>
                        <td style={tdStyle}>{totals.actualHours}h</td>
                        <td style={tdStyle}>{totals.targetHours}h</td>
                        <td style={{ ...tdStyle, color: totals.difference >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                          {totals.difference >= 0 ? "+" : ""}{totals.difference}h
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: effColor(totals.efficiencyPct) }}>
                          {totals.efficiencyPct}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

      {/* Individual technician tab */}
      {!loading && activeTab !== "overall" && activeSummary && (
        <>
          {/* Tech stats */}
          <div style={sectionStyle}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--primary-dark)" }}>
              {activeSummary.tech.first_name} - {MONTHS[selectedMonth - 1]} {selectedYear}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Logged Total
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {formatHours(totalsForFilteredSet.logged)}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Allocated Total
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {formatHours(totalsForFilteredSet.allocated)}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Logged - Allocated
                </span>
                <strong style={{ fontSize: "1.6rem", color: filteredSetDifference >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {filteredSetDifference >= 0 ? "+" : ""}{formatHours(Math.abs(filteredSetDifference))}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Monthly Target
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {activeSummary.totals.targetHours}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Efficiency
                </span>
                <strong style={{ fontSize: "1.6rem", color: effColor(activeSummary.totals.efficiencyPct) }}>
                  {activeSummary.totals.efficiencyPct}%
                </strong>
              </div>
            </div>
          </div>

          {/* Entries table */}
          <div style={sectionStyle}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--primary-dark)" }}>
              Entries
            </h3>
            <div style={tableWrapperStyle}>
              <div style={{ maxHeight: "520px", overflowY: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Job Number</th>
                      <th style={thStyle}>Job Description</th>
                      <th style={thStyle}>Allocated Total</th>
                      <th style={thStyle}>Logged Total</th>
                      <th style={thStyle}>Difference</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Day Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSummary.entries.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "var(--grey-accent)", padding: "32px 16px" }}>
                          No entries for {MONTHS[selectedMonth - 1]} {selectedYear}. {isTabEditable ? "Click \"+ Add Job Entry\" to get started." : ""}
                        </td>
                      </tr>
                    ) : (
                      activeSummary.entries.map((entry) => {
                        const isFromClocking = entry._source === "job_clocking";
                        const logged = Number(entry.hours_spent || 0);
                        const allocated = Number(entry.allocated_hours || 0);
                        const rowDifference = Number((logged - allocated).toFixed(2));
                        return (
                        <tr
                          key={entry.id}
                          onClick={() => {
                            if (!isTabEditable || isFromClocking) return;
                            openEditModal(entry);
                          }}
                          style={{
                            cursor: isTabEditable && !isFromClocking ? "pointer" : "default",
                            backgroundColor: isTabEditable && !isFromClocking ? "transparent" : undefined,
                          }}
                        >
                          <td style={tdStyle}>
                            {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{entry.job_number}</td>
                          <td style={{ ...tdStyle, maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.job_description || "—"}
                          </td>
                          <td style={tdStyle}>
                            {entry.allocated_hours !== null && entry.allocated_hours !== undefined
                              ? `${formatHours(entry.allocated_hours)}h`
                              : "—"}
                          </td>
                          <td style={tdStyle}>{formatHours(logged)}h</td>
                          <td style={{ ...tdStyle, color: rowDifference >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                            {rowDifference >= 0 ? "+" : ""}{formatHours(Math.abs(rowDifference))}h
                          </td>
                          <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.notes || "—"}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "capitalize",
                              background: entry.day_type === "saturday" ? "var(--info-surface)" : "var(--success-surface)",
                              color: entry.day_type === "saturday" ? "var(--info)" : "var(--success-dark)",
                              border: `1px solid ${entry.day_type === "saturday" ? "var(--info)" : "var(--success)"}22`,
                            }}>
                              {entry.day_type}
                            </span>
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
        </>
      )}

      {/* Detail Popup - shows entries for a tech from the overall tab */}
      {detailPopupTechId && detailPopupSummary && (
        <ModalPortal>
          <div
            className="popup-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeDetailPopup(); }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="popup-card"
              style={{
                borderRadius: "32px",
                width: "100%",
                maxWidth: "820px",
                maxHeight: "90vh",
                overflowY: "auto",
                border: "1px solid var(--surface-light)",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                    Efficiency Detail
                  </p>
                  <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", color: "var(--primary-dark)" }}>
                    {detailPopupSummary.tech.first_name} - {MONTHS[selectedMonth - 1]} {selectedYear}
                  </h3>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {isDetailPopupEditable && (
                    <button
                      type="button"
                      onClick={() => openAddModalForTech(detailPopupTechId)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: "var(--primary)",
                        color: "var(--surface)",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      + Add Job Entry
                    </button>
                  )}
                  {isDetailPopupEditable && (
                    <button
                      type="button"
                      onClick={detailEditMode ? cancelDetailEdit : startDetailEdit}
                      aria-label={detailEditMode ? "Cancel edit" : "Edit details"}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        border: detailEditMode ? "1px solid var(--primary)" : "1px solid var(--surface-light)",
                        background: detailEditMode ? "var(--primary)" : "var(--surface)",
                        color: detailEditMode ? "var(--surface)" : "var(--primary)",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={detailEditMode ? "Cancel edit" : "Edit target & weight"}
                    >
                      &#9998;
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeDetailPopup}
                    aria-label="Close"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface)",
                      color: "var(--info)",
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Edit target & weight inline form */}
              {detailEditMode && (
                <div style={{
                  borderRadius: "14px",
                  padding: "16px 20px",
                  background: "var(--danger-surface)",
                  border: "1px solid var(--surface-light)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)", fontWeight: 600 }}>
                    Edit Target &amp; Weight
                  </span>
                  {detailEditError && (
                    <div style={{
                      borderRadius: "10px",
                      padding: "8px 12px",
                      border: "1px solid var(--danger)",
                      background: "var(--danger-surface)",
                      color: "var(--danger-dark)",
                      fontSize: "0.82rem",
                    }}>
                      {detailEditError}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "end" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--grey-accent)" }}>
                        Monthly Target Hours
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={detailEditTargetHours}
                        onChange={(e) => setDetailEditTargetHours(e.target.value)}
                        style={{
                          borderRadius: "10px",
                          border: "1px solid var(--surface-light)",
                          background: "var(--surface)",
                          padding: "10px 12px",
                          fontSize: "0.9rem",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--grey-accent)" }}>
                        Weight (0 - 1)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={detailEditWeight}
                        onChange={(e) => setDetailEditWeight(e.target.value)}
                        style={{
                          borderRadius: "10px",
                          border: "1px solid var(--surface-light)",
                          background: "var(--surface)",
                          padding: "10px 12px",
                          fontSize: "0.9rem",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveDetailEdit}
                      disabled={detailEditSubmitting}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        background: "var(--primary)",
                        color: "var(--surface)",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: detailEditSubmitting ? "not-allowed" : "pointer",
                        opacity: detailEditSubmitting ? 0.7 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {detailEditSubmitting ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {/* Summary stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                <div style={statCardStyle}>
                  <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                    Actual Hours
                  </span>
                  <strong style={{ fontSize: "1.3rem", color: "var(--primary-dark)" }}>
                    {detailPopupSummary.totals.actualHours}h
                  </strong>
                </div>
                <div style={statCardStyle}>
                  <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                    Target Hours
                  </span>
                  <strong style={{ fontSize: "1.3rem", color: "var(--primary-dark)" }}>
                    {detailPopupSummary.totals.targetHours}h
                  </strong>
                </div>
                <div style={statCardStyle}>
                  <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                    Difference
                  </span>
                  <strong style={{ fontSize: "1.3rem", color: detailPopupSummary.totals.difference >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {detailPopupSummary.totals.difference >= 0 ? "+" : ""}{detailPopupSummary.totals.difference}h
                  </strong>
                </div>
                <div style={statCardStyle}>
                  <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                    Efficiency
                  </span>
                  <strong style={{ fontSize: "1.3rem", color: effColor(detailPopupSummary.totals.efficiencyPct) }}>
                    {detailPopupSummary.totals.efficiencyPct}%
                  </strong>
                </div>
              </div>

              {/* Entries table */}
              <div style={tableWrapperStyle}>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Job Number</th>
                        <th style={thStyle}>Hours Spent</th>
                        <th style={thStyle}>Notes</th>
                        <th style={thStyle}>Day Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailPopupSummary.entries.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "var(--grey-accent)", padding: "32px 16px" }}>
                            No entries for {MONTHS[selectedMonth - 1]} {selectedYear}.
                          </td>
                        </tr>
                      ) : (
                        detailPopupSummary.entries.map((entry) => {
                          const isFromClocking = entry._source === "job_clocking";
                          return (
                          <tr
                            key={entry.id}
                            onClick={() => {
                              if (!isDetailPopupEditable || isFromClocking) return;
                              openEditModal(entry);
                            }}
                            style={{
                              cursor: isDetailPopupEditable && !isFromClocking ? "pointer" : "default",
                            }}
                          >
                            <td style={tdStyle}>
                              {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{entry.job_number}</td>
                            <td style={tdStyle}>{formatHours(entry.hours_spent)}h</td>
                            <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {entry.notes || "\u2014"}
                            </td>
                            <td style={tdStyle}>
                              <span style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                background: entry.day_type === "saturday" ? "var(--info-surface)" : "var(--success-surface)",
                                color: entry.day_type === "saturday" ? "var(--info)" : "var(--success-dark)",
                                border: `1px solid ${entry.day_type === "saturday" ? "var(--info)" : "var(--success)"}22`,
                              }}>
                                {entry.day_type}
                              </span>
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
          </div>
        </ModalPortal>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <ModalPortal>
          <div
            className="efficiency-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 9999,
              backdropFilter: "blur(8px)",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
            role="dialog"
            aria-modal="true"
          >
            <div
              style={{
                width: "min(580px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                borderRadius: "22px",
                background: "var(--surface)",
                border: "1px solid var(--surface-light)",
                boxShadow: "0 25px 60px rgba(15, 15, 15, 0.25)",
                padding: "28px 32px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                    Job Entry
                  </p>
                  <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", color: "var(--primary-dark)" }}>
                    {editingEntry ? "Edit Job Entry" : "New Job Entry"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                    color: "var(--info)",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  &times;
                </button>
              </div>

              {formError && (
                <div style={{
                  borderRadius: "14px",
                  padding: "12px 16px",
                  border: "1px solid var(--danger)",
                  background: "var(--danger-surface)",
                  color: "var(--danger-dark)",
                  fontSize: "0.85rem",
                }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Row 1: Date + Job Number */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <CalendarField
                    id="efficiencyDate"
                    label="Date"
                    value={formDate}
                    onChange={(event) => setFormDate(event.target.value)}
                    required
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      htmlFor="efficiencyJobNumber"
                      style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--grey-accent)" }}
                    >
                      Job Number
                    </label>
                    <input
                      id="efficiencyJobNumber"
                      type="text"
                      value={formJobNumber}
                      onChange={(e) => {
                        setFormJobNumber(e.target.value);
                        setFormError("");
                      }}
                      placeholder="e.g., 00001 (optional)"
                      style={{
                        borderRadius: "16px",
                        border: "1px solid var(--surface-light)",
                        background: "var(--surface-light)",
                        padding: "12px 14px",
                        fontSize: "0.95rem",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.76rem",
                        color:
                          jobLookupState === "matched"
                            ? "var(--success)"
                            : jobLookupState === "unmatched"
                              ? "var(--danger)"
                              : "var(--grey-accent)",
                      }}
                    >
                      {jobLookupState === "matched"
                        ? "Job recognised. Allocated hours/description loaded."
                        : jobLookupState === "unmatched"
                          ? "Job not recognised. Enter details manually."
                          : jobLookupState === "loading"
                            ? "Checking job number..."
                            : "You can still save without a job number."}
                    </span>
                  </div>
                </div>

                {/* Work type selector (same as Start Job popup) */}
                <DropdownField
                  value={selectedRequestValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedRequestValue(val);
                    if (val.startsWith("request:")) {
                      const idValue = Number(val.replace("request:", ""));
                      setSelectedRequestId(Number.isFinite(idValue) ? idValue : null);
                    } else {
                      setSelectedRequestId(null);
                    }
                  }}
                  options={requestOptions}
                  placeholder={formJobNumber.trim() ? `Job: ${formJobNumber.trim()}` : "No job number"}
                  disabled={!formJobNumber.trim()}
                  className="efficiency-request-dropdown"
                />

                {/* Row 2: Allocated Hours + Day Type */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      htmlFor="efficiencyAllocatedHours"
                      style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--grey-accent)" }}
                    >
                      Allocated Hours
                    </label>
                    <input
                      id="efficiencyAllocatedHours"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formAllocatedHours}
                      onChange={(e) => setFormAllocatedHours(e.target.value)}
                      placeholder="Auto from job/request or enter manually"
                      style={{
                        borderRadius: "16px",
                        border: "1px solid var(--surface-light)",
                        background: "var(--surface-light)",
                        padding: "12px 14px",
                        fontSize: "0.95rem",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                  </div>
                  <DropdownField
                    id="efficiencyDayType"
                    label="Day Type"
                    placeholder="Select day type"
                    options={[
                      { key: "weekday", value: "weekday", label: "Weekday", description: "Monday - Friday" },
                      { key: "saturday", value: "saturday", label: "Saturday", description: "Saturday shift" },
                    ]}
                    value={formDayType}
                    onChange={(event) => setFormDayType(event.target.value)}
                    required
                  />
                </div>

                {/* Row 3: Job Description */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor="efficiencyJobDescription"
                    style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--grey-accent)" }}
                  >
                    Job Description
                  </label>
                  <textarea
                    id="efficiencyJobDescription"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the job when no matching job number is found..."
                    rows={2}
                    style={{
                      borderRadius: "16px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface-light)",
                      padding: "12px 14px",
                      fontSize: "0.95rem",
                      color: "var(--text-primary)",
                      outline: "none",
                      resize: "vertical",
                      minHeight: "64px",
                    }}
                  />
                </div>

                {/* Row 4: Total Clocked */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      htmlFor="efficiencyHours"
                      style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--grey-accent)" }}
                    >
                      Total Clocked
                    </label>
                    <input
                      id="efficiencyHours"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formHours}
                      onChange={(e) => setFormHours(e.target.value)}
                      placeholder="e.g. 0.1"
                      required
                      style={{
                        borderRadius: "16px",
                        border: "1px solid var(--surface-light)",
                        background: "var(--surface-light)",
                        padding: "12px 14px",
                        fontSize: "0.95rem",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Row 5: Notes (full width) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor="efficiencyNotes"
                    style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--grey-accent)" }}
                  >
                    Notes
                  </label>
                  <textarea
                    id="efficiencyNotes"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={3}
                    style={{
                      borderRadius: "16px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface-light)",
                      padding: "12px 14px",
                      fontSize: "0.95rem",
                      color: "var(--text-primary)",
                      outline: "none",
                      resize: "vertical",
                      minHeight: "70px",
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", paddingTop: "4px" }}>
                  <div>
                    {editingEntry && editingEntry._source !== "job_clocking" && (
                      <button
                        type="button"
                        onClick={handleDeleteFromEditModal}
                        disabled={deleteSubmitting}
                        style={{
                          padding: "12px 20px",
                          borderRadius: "14px",
                          border: "1px solid var(--danger)33",
                          background: "var(--danger-surface)",
                          color: "var(--danger)",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          cursor: deleteSubmitting ? "not-allowed" : "pointer",
                          opacity: deleteSubmitting ? 0.7 : 1,
                        }}
                      >
                        {deleteSubmitting ? "Deleting..." : "Delete Entry"}
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "14px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface)",
                      color: "var(--info)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "14px",
                      border: "none",
                      background: "var(--primary)",
                      color: "var(--surface)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: formSubmitting ? "not-allowed" : "pointer",
                      opacity: formSubmitting ? 0.7 : 1,
                    }}
                  >
                    {formSubmitting ? "Saving..." : editingEntry ? "Update Job Entry" : "Add Job Entry"}
                  </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
          <style jsx>{`
            :global([data-theme="dark"]) .efficiency-modal-overlay {
              background: rgba(10, 10, 10, 0.8);
            }
            :global(:not([data-theme="dark"])) .efficiency-modal-overlay {
              background: rgba(50, 50, 50, 0.45);
            }
            :global(.efficiency-request-dropdown) {
              width: 100%;
            }
            :global(.efficiency-request-dropdown .dropdown-api__control) {
              min-height: 44px;
              padding: 12px;
              border-radius: 16px;
              border: 1px solid var(--surface-light);
              font-size: 14px;
              background: var(--surface-light);
              gap: 8px;
            }
            :global(.efficiency-request-dropdown .dropdown-api__value) {
              font-size: 14px;
              font-weight: 500;
            }
            :global(.efficiency-request-dropdown.dropdown-api.is-open .dropdown-api__control),
            :global(.efficiency-request-dropdown .dropdown-api__control:focus-visible) {
              border-color: var(--primary);
              background: var(--surface);
            }
            :global(.efficiency-request-dropdown .dropdown-api__menu) {
              max-height: 144px !important;
              overflow-y: auto !important;
            }
            :global(.efficiency-request-dropdown .dropdown-api__option-description) {
              display: inline-flex;
              align-items: center;
              width: fit-content;
              padding: 2px 8px;
              border-radius: 999px;
              border: 1px solid var(--success);
              color: var(--success);
              background: rgba(var(--success-rgb), 0.08);
              font-weight: 600;
              font-size: 0.7rem;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            :global(.efficiency-filter-calendar) {
              width: fit-content;
            }
            :global(.efficiency-filter-calendar .calendar-api__field) {
              width: fit-content;
            }
            :global(.efficiency-filter-calendar .calendar-api__label),
            :global(.efficiency-tech-filter-dropdown .dropdown-api__label) {
              display: none;
            }
            :global(.efficiency-filter-calendar .calendar-api__control),
            :global(.efficiency-tech-filter-dropdown .dropdown-api__control) {
              width: fit-content !important;
              min-width: 0 !important;
              min-height: unset !important;
              padding: 10px 14px !important;
              border-radius: 999px !important;
              border: 1px solid rgba(var(--primary-rgb), 0.22) !important;
              background: linear-gradient(
                180deg,
                rgba(var(--primary-rgb), 0.12),
                rgba(var(--primary-rgb), 0.06)
              ) !important;
              color: var(--text-primary) !important;
              box-shadow: inset 0 1px 0 rgba(var(--surface-rgb), 0.45) !important;
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
            }
            :global(.efficiency-filter-calendar .calendar-api__value),
            :global(.efficiency-tech-filter-dropdown .dropdown-api__value) {
              flex: 0 0 auto !important;
              white-space: nowrap;
              font-size: 0.86rem !important;
              font-weight: 600 !important;
              color: var(--text-primary) !important;
            }
            :global(.efficiency-tech-filter-dropdown) {
              width: fit-content;
            }
            :global(.efficiency-tech-filter-dropdown .dropdown-api__control) {
              max-width: 17ch;
            }
            :global(.efficiency-filter-calendar .calendar-api__control:hover:not(:disabled)),
            :global(.efficiency-tech-filter-dropdown .dropdown-api__control:hover:not(:disabled)),
            :global(.efficiency-tech-filter-dropdown.dropdown-api.is-open .dropdown-api__control),
            :global(.efficiency-tech-filter-dropdown .dropdown-api__control:focus-visible) {
              border-color: rgba(var(--primary-rgb), 0.45) !important;
              background: linear-gradient(
                180deg,
                rgba(var(--primary-rgb), 0.18),
                rgba(var(--primary-rgb), 0.1)
              ) !important;
            }
            :global(.efficiency-tech-filter-dropdown .dropdown-api__menu) {
              min-width: 100%;
              width: max-content;
            }
          `}</style>
        </ModalPortal>
      )}
    </div>
  );
}
