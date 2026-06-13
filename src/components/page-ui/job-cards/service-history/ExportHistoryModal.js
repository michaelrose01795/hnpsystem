// file location: src/components/page-ui/job-cards/service-history/ExportHistoryModal.js
// "Export history" popup. The user chooses what to export:
//   1. The selected job's details (single row)
//   2. The full history list (every job)
//   3. Hand-picked history items (checkbox selection)
// Export is a client-side CSV download via src/utils/exportUtils.js.
//
// Layer alternation (CLAUDE.md §3.0): PopupModal card is --surface, so the
// option blocks are <LayerTheme>.

import { useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import { exportToCsv } from "@/utils/exportUtils";
import { joinRequests } from "./historyFormat";

const titleStyle = { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-1)" };

const optionLabelStyle = { fontSize: "0.95rem", fontWeight: 600, color: "var(--text-1)" };
const optionHintStyle = { fontSize: "0.8rem", color: "rgba(var(--text-1-rgb), 0.6)" };

const CSV_COLUMNS = [
  "Job Number",
  "Date",
  "Status",
  "Mileage",
  "Advisor",
  "Technician",
  "Parts User",
  "Allocated",
  "On Order",
  "Back Order",
  "Total Parts",
  "Spend",
  "Requests",
];

const jobKey = (job) => job?.id ?? job?.jobNumber;

// Flatten one history job into a CSV row keyed by CSV_COLUMNS.
const toCsvRow = (job) => {
  const parts = job.parts || {};
  return {
    "Job Number": job.jobNumber ?? "",
    Date: job.serviceDateFormatted ?? "",
    Status: job.status ?? "",
    Mileage: typeof job.mileage === "number" ? job.mileage : "",
    Advisor: job.advisor ?? "",
    Technician: job.technician ?? "",
    "Parts User": job.partsUser ?? "",
    Allocated: parts.allocated ?? 0,
    "On Order": parts.onOrder ?? 0,
    "Back Order": parts.backOrder ?? 0,
    "Total Parts": parts.total ?? 0,
    Spend: typeof job.spend === "number" ? job.spend.toFixed(2) : "",
    Requests: joinRequests(job).join(" | "),
  };
};

const MODES = [
  { id: "selected", label: "Selected job details", hint: "Export the currently selected job as a single row." },
  { id: "list", label: "Full history list", hint: "Export every job in this vehicle's history." },
  { id: "pick", label: "Choose history items", hint: "Tick the specific jobs you want to export." },
];

export default function ExportHistoryModal({ isOpen, onClose, history = [], selectedJob }) {
  const [mode, setMode] = useState("list");
  const [pickedIds, setPickedIds] = useState(() => new Set());

  useEffect(() => {
    if (!isOpen) return;
    setMode(selectedJob ? "selected" : "list");
    setPickedIds(new Set());
  }, [isOpen, selectedJob]);

  const togglePicked = (id) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows = useMemo(() => {
    if (mode === "selected") return selectedJob ? [toCsvRow(selectedJob)] : [];
    if (mode === "pick") {
      return history.filter((job) => pickedIds.has(jobKey(job))).map(toCsvRow);
    }
    return history.map(toCsvRow);
  }, [mode, history, selectedJob, pickedIds]);

  const handleExport = () => {
    if (!rows.length) return;
    exportToCsv("vehicle-service-history.csv", rows, CSV_COLUMNS);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Export history"
      cardStyle={{ width: "min(100%, 620px)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 style={titleStyle}>Export History</h2>
        <button type="button" onClick={onClose} className="app-btn app-btn--ghost">Close</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {MODES.map((option) => {
          const disabled = option.id === "selected" && !selectedJob;
          return (
            <LayerTheme
              key={option.id}
              as="label"
              radius="var(--radius-sm)"
              padding="var(--space-4)"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "var(--space-3)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <input
                type="radio"
                name="export-mode"
                value={option.id}
                checked={mode === option.id}
                disabled={disabled}
                onChange={() => setMode(option.id)}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={optionLabelStyle}>{option.label}</span>
                <span style={optionHintStyle}>{option.hint}</span>
              </span>
            </LayerTheme>
          );
        })}
      </div>

      {/* Per-item picker, only when "Choose history items" is active. */}
      {mode === "pick" && (
        <LayerTheme radius="var(--radius-sm)" padding="var(--space-3)" style={{ maxHeight: "240px", overflowY: "auto" }} className="themed-scrollbar">
          {history.map((job) => {
            const id = jobKey(job);
            return (
              <label
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "8px 0",
                  borderBottom: "var(--separating-line)",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={pickedIds.has(id)} onChange={() => togglePicked(id)} />
                <span style={{ color: "var(--text-1)" }}>
                  {job.jobNumber} — {job.serviceDateFormatted}
                </span>
              </label>
            );
          })}
        </LayerTheme>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <span style={{ ...optionHintStyle, alignSelf: "center", marginRight: "auto" }}>
          {rows.length} job{rows.length === 1 ? "" : "s"} ready to export
        </span>
        <button type="button" onClick={onClose} className="app-btn app-btn--secondary">Cancel</button>
        <button type="button" onClick={handleExport} disabled={!rows.length} className="app-btn app-btn--primary">
          Export CSV
        </button>
      </div>
    </PopupModal>
  );
}
