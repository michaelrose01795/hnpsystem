// file location: src/components/page-ui/job-cards/service-history/CompareJobsModal.js
// "Compare jobs" popup: the user picks two jobs from the vehicle's history and
// sees their details side by side (header fields, work carried out, parts tally).
//
// Layer alternation (CLAUDE.md §3.0): the PopupModal card is a --surface, so the
// two comparison columns are <LayerTheme>.

import { useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  JobFieldsGrid,
  PartsTallyList,
  WorkCarriedOutList,
} from "./SelectedJobDetail";
import { formatText } from "./historyFormat";

const titleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "var(--text-1)",
};

const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};

const selectStyle = {
  width: "100%",
  minHeight: "var(--control-height)",
  padding: "var(--control-padding)",
  borderRadius: "var(--input-radius)",
  background: "var(--input-bg)",
  color: "var(--text-1)",
};

const jobKey = (job) => job?.id ?? job?.jobNumber;

function ComparePicker({ label, value, onChange, history }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "160px" }}>
      <span style={eyebrowStyle}>{label}</span>
      <select style={selectStyle} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a job…</option>
        {history.map((job) => (
          <option key={jobKey(job)} value={String(jobKey(job))}>
            {formatText(job.jobNumber)} — {formatText(job.serviceDateFormatted)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareColumn({ job }) {
  if (!job) {
    return (
      <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", margin: 0 }}>
          No job selected.
        </p>
      </LayerTheme>
    );
  }
  return (
    <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-4)" style={{ flex: 1, minWidth: 0 }}>
      <p style={titleStyle}>{formatText(job.jobNumber)}</p>
      <JobFieldsGrid job={job} />
      <WorkCarriedOutList job={job} />
      <PartsTallyList parts={job.parts} />
    </LayerTheme>
  );
}

export default function CompareJobsModal({ isOpen, onClose, history = [], initialJobId }) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  // Seed the left column with the currently-selected job each time the modal
  // opens, and default the right column to the next job for a useful first view.
  useEffect(() => {
    if (!isOpen) return;
    const seedLeft = initialJobId != null ? String(initialJobId) : "";
    setLeftId(seedLeft);
    const other = history.find((job) => String(jobKey(job)) !== seedLeft);
    setRightId(other ? String(jobKey(other)) : "");
  }, [isOpen, initialJobId, history]);

  const leftJob = history.find((job) => String(jobKey(job)) === String(leftId)) || null;
  const rightJob = history.find((job) => String(jobKey(job)) === String(rightId)) || null;

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Compare jobs"
      cardStyle={{ width: "min(100%, 980px)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 style={titleStyle}>Compare Jobs</h2>
        <button type="button" onClick={onClose} className="app-btn app-btn--ghost">Close</button>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <ComparePicker label="Job A" value={leftId} onChange={setLeftId} history={history} />
        <ComparePicker label="Job B" value={rightId} onChange={setRightId} history={history} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "stretch" }}>
        <CompareColumn job={leftJob} />
        <CompareColumn job={rightJob} />
      </div>
    </PopupModal>
  );
}
