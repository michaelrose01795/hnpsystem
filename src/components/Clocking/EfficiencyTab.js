// file location: src/components/Clocking/EfficiencyTab.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getEfficiencyTechnicians,
  getEfficiencyEntries,
  getAllEfficiencyEntries,
  getAllTechTargets,
  addEfficiencyEntry,
  updateEfficiencyEntry,
  deleteEfficiencyEntry,
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

const buildRequestOptions = (jobNumberValue, requestRows) => {
  const trimmed = jobNumberValue.trim();
  if (!trimmed) return [];
  const options = [
    {
      value: "job",
      label: `Job: ${trimmed}`,
      description: "Clock onto the whole job",
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
      description: request?.hours ? `${request.hours}h allocated` : "",
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

  // Modal state for add/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formDate, setFormDate] = useState("");
  const [formJobNumber, setFormJobNumber] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDayType, setFormDayType] = useState("weekday");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Job request lookup state (matches Start Job popup pattern)
  const [selectedRequestValue, setSelectedRequestValue] = useState("job");
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [requestOptions, setRequestOptions] = useState([]);
  const lastJobNumberRef = useRef("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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
      const [allEntries, allTargets] = await Promise.all([
        getAllEfficiencyEntries(allUserIds, selectedYear, selectedMonth),
        getAllTechTargets(allUserIds),
      ]);
      setEntries(allEntries);
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

  // Set default active tab when filterUserId is set
  useEffect(() => {
    if (filterUserId && visibleTechs.length > 0 && activeTab === "overall") {
      // Keep overall as default - it's fine
    }
  }, [filterUserId, visibleTechs, activeTab]);

  // Group entries by user
  const entriesByUser = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      if (!map.has(e.user_id)) map.set(e.user_id, []);
      map.get(e.user_id).push(e);
    });
    return map;
  }, [entries]);

  // Per-tech summaries
  const techSummaries = useMemo(() => {
    return technicians.map((tech) => {
      const techEntries = entriesByUser.get(tech.user_id) || [];
      const target = targets.get(tech.user_id) || { monthlyTargetHours: 160, weight: 0.75 };
      const totals = calculateTechTotals(techEntries, target);
      return {
        tech,
        entries: techEntries,
        target,
        totals,
        weight: target.weight,
      };
    });
  }, [technicians, entriesByUser, targets]);

  // Overall totals
  const overallTotals = useMemo(
    () => calculateOverallTotals(techSummaries),
    [techSummaries]
  );

  // Current tab data
  const activeTechId =
    activeTab === "overall" ? null : Number(activeTab);
  const activeSummary = activeTechId
    ? techSummaries.find((s) => s.tech.user_id === activeTechId)
    : null;

  const isTabEditable =
    editable &&
    activeTechId != null &&
    (editableUserId == null || editableUserId === activeTechId);

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
    setFormHours("");
    setFormNotes("");
    setFormDayType("weekday");
    setFormError("");
    resetRequestState();
    setModalOpen(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormJobNumber(entry.job_number);
    setFormHours(String(entry.hours_spent));
    setFormNotes(entry.notes || "");
    setFormDayType(entry.day_type);
    setFormError("");
    resetRequestState();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEntry(null);
    setFormError("");
    setFormSubmitting(false);
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

    const loadRequests = async () => {
      try {
        // Look up the job by job_number
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("id, job_number")
          .ilike("job_number", trimmed)
          .maybeSingle();

        if (jobError || !jobData?.id) {
          if (!isMounted) return;
          setRequestOptions(fallbackOptions);
          return;
        }

        const { data, error } = await supabase
          .from("job_requests")
          .select("request_id, description, hours, sort_order")
          .eq("job_id", Number(jobData.id))
          .order("sort_order", { ascending: true });
        if (error) throw error;
        if (!isMounted) return;
        setRequestOptions(buildRequestOptions(trimmed, data || []));
      } catch (err) {
        console.warn("Failed to load job requests:", err);
        if (!isMounted) return;
        setRequestOptions(fallbackOptions);
      }
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [formJobNumber, modalOpen]);

  // Derive the final job_number string to save (includes request context)
  const resolveJobNumberForSave = () => {
    const baseJobNumber = formJobNumber.trim();
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
    if (!formJobNumber.trim()) { setFormError("Job number is required."); return; }
    const hours = Number(formHours);
    if (!formHours || Number.isNaN(hours) || hours <= 0) {
      setFormError("Hours must be greater than 0.");
      return;
    }
    if (!formDayType) { setFormError("Day type is required."); return; }

    const jobNumberToSave = resolveJobNumberForSave();

    setFormSubmitting(true);
    try {
      if (editingEntry) {
        await updateEfficiencyEntry(editingEntry.id, {
          date: formDate,
          jobNumber: jobNumberToSave,
          hoursSpent: hours,
          notes: formNotes.trim(),
          dayType: formDayType,
        });
      } else {
        await addEfficiencyEntry({
          userId: activeTechId,
          date: formDate,
          jobNumber: jobNumberToSave,
          hoursSpent: hours,
          notes: formNotes.trim(),
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
      setDeletingId(null);
      await fetchData();
    } catch (err) {
      setError(err?.message || "Failed to delete entry.");
    } finally {
      setDeleteSubmitting(false);
    }
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

  // Get the display name for the active tab (used in print)
  const activeTechName = activeSummary
    ? activeSummary.tech.first_name
    : "Overall";

  // Print handler - creates a portrait B&W print template with 31 rows
  const handlePrint = () => {
    const title = activeTab === "overall"
      ? `Overall Efficiency - ${MONTHS[selectedMonth - 1]} ${selectedYear}`
      : `${activeTechName} - ${MONTHS[selectedMonth - 1]} ${selectedYear}`;

    // Build existing entries map by day number for pre-filling
    const existingByDay = new Map();
    if (activeSummary) {
      activeSummary.entries.forEach((entry) => {
        const day = new Date(entry.date).getDate();
        if (!existingByDay.has(day)) existingByDay.set(day, []);
        existingByDay.get(day).push(entry);
      });
    }

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let tableRows = "";
    for (let day = 1; day <= 31; day++) {
      const entriesForDay = existingByDay.get(day) || [];
      if (entriesForDay.length > 0) {
        entriesForDay.forEach((entry, idx) => {
          tableRows += `<tr>
            ${idx === 0 ? `<td rowspan="${entriesForDay.length}">${String(day).padStart(2, "0")}/${String(selectedMonth).padStart(2, "0")}/${selectedYear}</td>` : ""}
            <td>${entry.job_number || ""}</td>
            <td>${entry.hours_spent || ""}</td>
            <td>${entry.notes || ""}</td>
            <td>${entry.day_type || ""}</td>
          </tr>`;
        });
      } else {
        const dateStr = day <= daysInMonth
          ? `${String(day).padStart(2, "0")}/${String(selectedMonth).padStart(2, "0")}/${selectedYear}`
          : "";
        tableRows += `<tr>
          <td>${dateStr}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`;
      }
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page { size: portrait; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; padding: 8px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    h2 { font-size: 13px; font-weight: 400; margin-bottom: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #000; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #e8e8e8; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
    td { min-height: 22px; }
    tr { page-break-inside: avoid; }
    .summary { margin-top: 12px; font-size: 12px; }
    .summary td { font-weight: 600; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <h2>Efficiency Timesheet</h2>
  <table>
    <thead>
      <tr>
        <th style="width:14%">Date</th>
        <th style="width:18%">Job Number</th>
        <th style="width:12%">Hours Spent</th>
        <th style="width:40%">Notes</th>
        <th style="width:16%">Day Type</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <table class="summary">
    <tr>
      <td>Actual Hours:</td>
      <td>Target Hours:</td>
      <td>Difference:</td>
      <td>Efficiency:</td>
    </tr>
  </table>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
              onClick={handlePrint}
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
              <span style={{ fontSize: "1rem" }}>&#128438;</span> Print
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
              + Add Entry
            </button>
          )}
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
                  {techSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--grey-accent)" }}>
                        No technicians configured.
                      </td>
                    </tr>
                  ) : (
                    techSummaries.map(({ tech, totals, weight }) => (
                      <tr key={tech.user_id}>
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
                  Actual Hours
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {activeSummary.totals.actualHours}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Target Hours
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                  {activeSummary.totals.targetHours}h
                </strong>
              </div>
              <div style={statCardStyle}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Difference
                </span>
                <strong style={{ fontSize: "1.6rem", color: activeSummary.totals.difference >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {activeSummary.totals.difference >= 0 ? "+" : ""}{activeSummary.totals.difference}h
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
                      <th style={thStyle}>Hours Spent</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Day Type</th>
                      {isTabEditable && <th style={thStyle}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSummary.entries.length === 0 ? (
                      <tr>
                        <td colSpan={isTabEditable ? 6 : 5} style={{ ...tdStyle, textAlign: "center", color: "var(--grey-accent)", padding: "32px 16px" }}>
                          No entries for {MONTHS[selectedMonth - 1]} {selectedYear}. {isTabEditable ? "Click \"+ Add Entry\" to get started." : ""}
                        </td>
                      </tr>
                    ) : (
                      activeSummary.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td style={tdStyle}>
                            {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{entry.job_number}</td>
                          <td style={tdStyle}>{entry.hours_spent}h</td>
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
                          {isTabEditable && (
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(entry)}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--surface-light)",
                                    background: "var(--surface)",
                                    color: "var(--primary)",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit
                                </button>
                                {deletingId === entry.id ? (
                                  <div style={{ display: "flex", gap: "4px" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(entry.id)}
                                      disabled={deleteSubmitting}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "var(--danger)",
                                        color: "var(--surface)",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        cursor: deleteSubmitting ? "not-allowed" : "pointer",
                                        opacity: deleteSubmitting ? 0.7 : 1,
                                      }}
                                    >
                                      {deleteSubmitting ? "..." : "Yes"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingId(null)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: "8px",
                                        border: "1px solid var(--surface-light)",
                                        background: "var(--surface)",
                                        color: "var(--info)",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingId(entry.id)}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      border: "1px solid var(--danger)33",
                                      background: "var(--danger-surface)",
                                      color: "var(--danger)",
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <ModalPortal>
          <div
            className="efficiency-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              zIndex: 50,
              backdropFilter: "blur(4px)",
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
                    Efficiency Entry
                  </p>
                  <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", color: "var(--primary-dark)" }}>
                    {editingEntry ? "Edit Entry" : "New Entry"}
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
                      placeholder="e.g., 00001"
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

                {/* Row 2: Hours + Day Type */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      htmlFor="efficiencyHours"
                      style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--grey-accent)" }}
                    >
                      Hours Spent
                    </label>
                    <input
                      id="efficiencyHours"
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={formHours}
                      onChange={(e) => setFormHours(e.target.value)}
                      placeholder="e.g. 2.5"
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

                {/* Row 3: Notes (full width) */}
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
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "4px" }}>
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
                    {formSubmitting ? "Saving..." : editingEntry ? "Update Entry" : "Add Entry"}
                  </button>
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
          `}</style>
        </ModalPortal>
      )}
    </div>
  );
}
